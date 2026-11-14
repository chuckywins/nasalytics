"""İnce Claude proxy'si: API anahtarı yalnızca burada durur.

Uç noktalar:
  GET  /api/health
  POST /api/assess  → AI sağlık değerlendirmesi (Sonnet 5.5, zorunlu araç çağrısı ile şemalı JSON)
  POST /api/vega  → Sesli asistan (Haiku 5.5, SSE akışı)

Güvenlik: IP başına dakikalık hız sınırı + günlük tahmini harcama tavanı.
Bilgi bankası (docs/research_notes.md) sistem isteminde, prompt cache ile.
Çalıştırma: python -m uvicorn backend.server:app --port 8787   (proje kökünden)
AI notu: Claude (Anthropic) yardımıyla yazılmıştır.
"""
from __future__ import annotations

import json
import os
import time
from collections import defaultdict, deque
from pathlib import Path

import anthropic
import base64
import struct
import httpx
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

ROOT = Path(__file__).resolve().parent.parent


def load_env() -> None:
    p = ROOT / ".env"
    if not p.exists():
        return
    for line in p.read_text(encoding="utf-8").splitlines():
        if "=" in line and not line.strip().startswith("#"):
            k, v = line.split("=", 1)
            os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))


load_env()
client = anthropic.Anthropic(api_key=os.environ.get("ANTHROPIC_API_KEY"))

MODEL_ASSESS = os.environ.get("MODEL_ASSESS", "claude-sonnet-5-5")
MODEL_VEGA = os.environ.get("MODEL_VEGA", "claude-haiku-5-5")
DAILY_BUDGET_USD = float(os.environ.get("DAILY_BUDGET_USD", "40"))
RATE_PER_MIN = int(os.environ.get("RATE_PER_MIN", "40"))
# $ / MTok (giriş, çıkış), platform dokümanından (2026-11-14)
PRICE = {"claude-sonnet-5-5": (2.0, 10.0), "claude-haiku-5-5": (0.10, 0.50), "claude-opus-5-5": (4.0, 20.0)}

KB = (ROOT / "docs" / "research_notes.md").read_text(encoding="utf-8")

BASE_RULES = """You are the onboard health assistant of an astronaut self-monitoring prototype (NASA Space Apps 2026).
Hard rules:
- Use ONLY the numbers given in the snapshot and the knowledge base. Never invent measurements, thresholds or sources.
- You are not a doctor and must not diagnose. Inferred states (fatigue, low mood, stress) are cues for the astronaut to confirm.
- No drug names or doses. Medication decisions belong to the crew medical officer (CMO) or flight surgeon.
- Simulated values are labelled SIMULATED in the snapshot; you may mention that the data is simulated if relevant.
- The deterministic rule engine has already raised alerts; you may add context, combine signals and order actions,
  and you may RAISE escalation, but you never say an alert is safe to ignore.
- Escalation levels: self (astronaut handles it), crew (crew medical officer), ground (flight surgeon; mind the one-way comm delay).
- Answer in the language requested (tr = Turkish, en = English). Be brief, imperative, calm.

CLINICAL THRESHOLDS USED BY THE RULE ENGINE (same numbers as the app; cite these when judging a value):
- Glucose (ADA): fasting 70-99 mg/dL normal, 100-125 prediabetes range, >=126 high; after a meal (~2 h) <140 normal,
  140-199 high-for-after-meal, >=200 high; hypoglycaemia <70 (level 1), <54 (level 2, serious). Inspiration4 lab range 65-99.
  If fasting/after-meal context is unknown, say both interpretations briefly and ask.
- Blood pressure (AHA): <120/<80 normal; 120-129/<80 elevated; 130-139 or 80-89 stage 1; >=140 or >=90 stage 2; >180 or >120 crisis.
- Heart rate (AHA): rest 60-100 bpm; during exercise/EVA up to ~85% of max (~220-age) is expected.
- SpO2: >=95% normal, 92-94 low-normal, <92 hypoxaemia, <88 severe. Body temperature: fever >=38.0 C (CDC).
- Sleep: adults >=7 h (AASM/SRS). Cabin CO2: 1-hour average <=3 mmHg (NASA-STD-3001 V2 [6004]).
"""

SYSTEM_BLOCKS = [
    {"type": "text", "text": BASE_RULES},
    {"type": "text", "text": "KNOWLEDGE BASE (sourced research notes, Turkish):\n\n" + KB, "cache_control": {"type": "ephemeral"}},
]

ASSESS_TOOL = {
    "name": "report_assessment",
    "description": "Return the structured health assessment shown on the astronaut's screen.",
    "input_schema": {
        "type": "object",
        "properties": {
            "headline": {"type": "string", "description": "One short line, max 12 words."},
            "assessment": {"type": "string", "description": "2-3 sentences: what the readings mean together, in context (environment, activity, mission day)."},
            "actions": {"type": "array", "maxItems": 3, "items": {"type": "string"}, "description": "Up to 3 imperative steps, most urgent first."},
            "escalate": {"type": "string", "enum": ["self", "crew", "ground"]},
            "cues": {"type": "array", "maxItems": 3, "items": {"type": "string"}, "description": "Signal combinations worth confirming (e.g. high resp. rate with high cabin CO2)."},
            "confidence": {"type": "string", "enum": ["low", "medium", "high"]},
        },
        "required": ["headline", "assessment", "actions", "escalate", "confidence"],
    },
}

# VEGA sesli komutla değer girişi: astronot açıkça "güncelle/kaydet/gir" dediğinde. Değer USER_INPUT olarak kaydedilir.
UPDATE_TOOL = {
    "name": "update_reading",
    "description": "Record a value the astronaut EXPLICITLY asks to update/enter/set (e.g. 'set my heart rate to 150', 'update fasting glucose to 50'). "
                   "Never call it for questions or hypotheticals. For blood pressure call it twice (systolic and diastolic).",
    "input_schema": {
        "type": "object",
        "properties": {
            "indicator": {"type": "string", "enum": ["heartRate", "systolic", "diastolic", "spo2", "respRate", "bodyTemp", "glucose", "sleepHours", "mood", "cabinCO2"],
                          "description": "heartRate bpm, systolic/diastolic mmHg, spo2 %, respRate breaths/min, bodyTemp C, glucose mg/dL, sleepHours h, mood 1-5, cabinCO2 mmHg"},
            "value": {"type": "number"},
            "glucose_context": {"type": "string", "enum": ["fasting", "postprandial"], "description": "Only for glucose. 'açlık/fasting' -> fasting, 'tokluk/after meal' -> postprandial."},
        },
        "required": ["indicator", "value"],
    },
}

app = FastAPI(title="Astronaut Health Monitor proxy")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

_hits: dict[str, deque] = defaultdict(deque)
_spend = {"day": time.strftime("%Y-%m-%d"), "usd": 0.0}


def guard(req: Request) -> None:
    ip = req.client.host if req.client else "?"
    now = time.time()
    q = _hits[ip]
    while q and now - q[0] > 60:
        q.popleft()
    if len(q) >= RATE_PER_MIN:
        raise HTTPException(429, "rate limit")
    q.append(now)
    today = time.strftime("%Y-%m-%d")
    if _spend["day"] != today:
        _spend.update(day=today, usd=0.0)
    if _spend["usd"] >= DAILY_BUDGET_USD:
        raise HTTPException(402, "daily AI budget reached")


def account(model: str, usage) -> None:
    pin, pout = PRICE.get(model, (4.0, 20.0))
    inp = (usage.input_tokens or 0) + (getattr(usage, "cache_creation_input_tokens", 0) or 0) * 1.25 \
        + (getattr(usage, "cache_read_input_tokens", 0) or 0) * 0.1
    _spend["usd"] += (inp * pin + (usage.output_tokens or 0) * pout) / 1e6


@app.get("/api/health")
def health():
    return {"ok": True, "models": {"assess": MODEL_ASSESS, "vega": MODEL_VEGA}, "spentTodayUsd": round(_spend["usd"], 4), "budgetUsd": DAILY_BUDGET_USD}


@app.post("/api/assess")
async def assess(req: Request):
    guard(req)
    body = await req.json()
    lang = body.get("lang", "tr")
    snapshot = json.dumps(body.get("snapshot", {}), ensure_ascii=False)
    t0 = time.time()
    msg = client.messages.create(
        model=MODEL_ASSESS,
        max_tokens=2000,
        system=SYSTEM_BLOCKS,
        extra_body={"output_config": {"effort": "low"}},  # 13,6 sn → ~6 sn (ölçüldü)
        tools=[ASSESS_TOOL],
        # Not: Sonnet 5.5 zorunlu tool_choice ("tool"/"any") desteklemiyor → auto + talimat + metin yedeği
        tool_choice={"type": "auto"},
        messages=[{"role": "user", "content": f"Language: {lang}\nCurrent snapshot (JSON):\n{snapshot}\n\n"
                   "Assess the astronaut's current health state. You MUST respond by calling the report_assessment tool exactly once."}],
    )
    account(MODEL_ASSESS, msg.usage)
    out = next((b.input for b in msg.content if b.type == "tool_use"), None)
    if out is None:  # yedek: metinden JSON ayrıştır
        txt = "".join(getattr(b, "text", "") for b in msg.content)
        try:
            out = json.loads(txt[txt.index("{"): txt.rindex("}") + 1])
        except (ValueError, json.JSONDecodeError):
            raise HTTPException(502, "no assessment")
    return {"assessment": out, "model": MODEL_ASSESS, "latencyMs": int((time.time() - t0) * 1000)}


VISION_TOOL = {
    "name": "report_reading",
    "description": "Report what the image shows. For a medical device display, extract the numbers exactly as shown.",
    "input_schema": {
        "type": "object",
        "properties": {
            "kind": {"type": "string", "enum": ["device", "ultrasound", "other"]},
            "device": {"type": "string", "description": "e.g. glucometer, blood pressure monitor, pulse oximeter, thermometer, unknown"},
            "readings": {"type": "array", "maxItems": 4, "items": {"type": "object", "properties": {
                "indicator": {"type": "string", "enum": ["glucose", "systolic", "diastolic", "heartRate", "spo2", "bodyTemp"]},
                "value": {"type": "number"}, "unit": {"type": "string"}}, "required": ["indicator", "value", "unit"]}},
            "observations": {"type": "array", "maxItems": 4, "items": {"type": "string"}, "description": "For ultrasound/other: neutral visual observations only, no diagnosis."},
            "legible": {"type": "boolean", "description": "False if the display/image is unreadable or ambiguous."},
            "note": {"type": "string", "description": "One short sentence for the astronaut (e.g. ask to retake, or what to confirm)."},
        },
        "required": ["kind", "readings", "legible", "note"],
    },
}


@app.post("/api/vision")
async def vision(req: Request):
    """Kamera görüntüsü: ölçüm cihazı ekranından değer okuma veya ultrason görüntüsü için tarafsız gözlem.
    Görüntü yalnızca kullanıcı 'Yakala' dediğinde gönderilir; saklanmaz."""
    guard(req)
    body = await req.json()
    lang, mode = body.get("lang", "tr"), body.get("mode", "device")
    img = body.get("image", "")
    if not img.startswith("data:image/") or len(img) > 6_000_000:
        raise HTTPException(400, "bad image")
    media, b64 = img[5:].split(";base64,", 1)
    task = ("Read the medical device display. Extract only numbers you can clearly see; never guess digits. "
            "Blood pressure monitors usually show systolic, diastolic and pulse. If unreadable, set legible=false."
            if mode == "device" else
            "This is an ultrasound or medical image captured by an astronaut. Give neutral visual observations only "
            "(image quality, which structures are visible if obvious). Do NOT diagnose. Say it should be reviewed by the CMO/flight surgeon.")
    t0 = time.time()
    msg = client.messages.create(
        model=MODEL_ASSESS, max_tokens=2000, system=SYSTEM_BLOCKS, tools=[VISION_TOOL], tool_choice={"type": "auto"},
        extra_body={"output_config": {"effort": "low"}},
        messages=[{"role": "user", "content": [
            {"type": "image", "source": {"type": "base64", "media_type": media, "data": b64}},
            {"type": "text", "text": f"Language for 'note' and 'observations': {lang}. {task} You MUST call report_reading exactly once."},
        ]}],
    )
    account(MODEL_ASSESS, msg.usage)
    out = next((b.input for b in msg.content if b.type == "tool_use"), None)
    if out is None:
        raise HTTPException(502, "no reading")
    return {"result": out, "model": MODEL_ASSESS, "latencyMs": int((time.time() - t0) * 1000)}


VOICE_TOOL = {
    "name": "report_voice_log",
    "description": "Report behavioral-health cues from the astronaut's daily spoken log.",
    "input_schema": {
        "type": "object",
        "properties": {
            "summary": {"type": "string", "description": "One or two sentences summarising what the astronaut said."},
            "cues": {"type": "array", "maxItems": 4, "items": {"type": "object", "properties": {
                "domain": {"type": "string", "enum": ["stress", "fatigue", "low_mood", "isolation"]},
                "level": {"type": "string", "enum": ["none", "low", "moderate", "high"]},
                "evidence": {"type": "string", "description": "A short exact quote from the transcript or a measured metric. Empty if none."}},
                "required": ["domain", "level", "evidence"]}},
            "followUp": {"type": "string", "description": "One gentle, practical suggestion (e.g. take a break, schedule a family call, talk to the behavioral health team)."},
        },
        "required": ["summary", "cues", "followUp"],
    },
}


@app.post("/api/voicelog")
async def voicelog(req: Request):
    """Günlük sesli kayıt: transkript + hesaplanmış ses ölçüleri → davranışsal sağlık İPUÇLARI (teşhis değil)."""
    guard(req)
    body = await req.json()
    lang = body.get("lang", "tr")
    transcript = str(body.get("transcript", ""))[:4000]
    metrics = json.dumps(body.get("metrics", {}), ensure_ascii=False)
    if len(transcript.split()) < 3:
        raise HTTPException(400, "transcript too short")
    t0 = time.time()
    msg = client.messages.create(
        model=MODEL_ASSESS, max_tokens=2000, system=SYSTEM_BLOCKS, tools=[VOICE_TOOL], tool_choice={"type": "auto"},
        extra_body={"output_config": {"effort": "low"}},
        messages=[{"role": "user", "content":
                   f"Language for all text fields: {lang}.\nDaily voice log transcript:\n\"\"\"{transcript}\"\"\"\n"
                   f"Measured speech metrics (computed on device): {metrics}\n"
                   "Identify cues of stress, fatigue, low mood or isolation. Every cue above 'none' MUST quote evidence. "
                   "These are cues for the astronaut to confirm, never a diagnosis. Do not over-interpret a single sentence. "
                   "You MUST call report_voice_log exactly once."}],
    )
    account(MODEL_ASSESS, msg.usage)
    out = next((b.input for b in msg.content if b.type == "tool_use"), None)
    if out is None:
        raise HTTPException(502, "no voice analysis")
    return {"result": out, "model": MODEL_ASSESS, "latencyMs": int((time.time() - t0) * 1000)}


@app.post("/api/vega")
async def vega(req: Request):
    guard(req)
    body = await req.json()
    lang = body.get("lang", "tr")
    snapshot = json.dumps(body.get("snapshot", {}), ensure_ascii=False)
    history = body.get("history", [])[-8:]
    voice_rules = ("\nYou are VEGA, the spoken voice of this assistant. Your reply is read aloud by text-to-speech: "
                   "max 2 short sentences, no lists, no markdown, no symbols, numbers with units spoken naturally."
                   "\nIf the astronaut explicitly asks to update/enter/set a value, call update_reading and in the SAME reply say one short "
                   "sentence confirming what was recorded and how the rule-engine thresholds classify it (the snapshot still shows the OLD value). "
                   "If the value or unit is unclear, ask instead of calling the tool.")
    messages = [m for m in history if m.get("role") in ("user", "assistant") and m.get("content")]
    user_text = f"Language: {lang}\nLive snapshot: {snapshot}\n\nAstronaut says: {body.get('text', '')}"
    img = body.get("image") or ""
    if img.startswith("data:image/") and len(img) < 3_000_000:
        # Astronot açıkça "görüntüyü ekle" dediğinde tek kare. Tarafsız görsel gözlem; teşhis yok.
        media, b64 = img[5:].split(";base64,", 1)
        user_text += ("\n\nA single camera frame of the astronaut is attached because they explicitly shared it. "
                      "Describe only what is visibly relevant to their question, neutrally; no diagnosis, no identity, no emotion claims.")
        messages.append({"role": "user", "content": [{"type": "image", "source": {"type": "base64", "media_type": media, "data": b64}},
                                                     {"type": "text", "text": user_text}]})
    else:
        messages.append({"role": "user", "content": user_text})

    def gen():
        try:
            with client.messages.stream(model=MODEL_VEGA, max_tokens=400, extra_body={"thinking": {"type": "disabled"}, "output_config": {"effort": "low"}},  # ölçüldü: TTFT ~1,1 sn; düşünme açıkken Haiku tüm bütçeyi düşünmeye harcıyordu
                                        system=SYSTEM_BLOCKS + [{"type": "text", "text": voice_rules}], messages=messages,
                                        tools=[UPDATE_TOOL], tool_choice={"type": "auto"}) as s:
                for txt in s.text_stream:
                    yield f"data: {json.dumps({'t': txt}, ensure_ascii=False)}\n\n"
                final = s.get_final_message()
                account(MODEL_VEGA, final.usage)
                spoke = any(b.type == "text" and b.text.strip() for b in final.content)
                uses = [b for b in final.content if b.type == "tool_use" and b.name == "update_reading"]
                for b in uses:  # değer güncelleme komutları → istemci aralık kontrolüyle uygular, kural motoru değerlendirir
                    yield f"data: {json.dumps({'action': b.input}, ensure_ascii=False)}\n\n"
            if uses and not spoke:  # model yalnızca aracı çağırdıysa: kısa sözlü onay için ikinci tur (araçsız)
                follow = messages + [{"role": "assistant", "content": [{"type": "tool_use", "id": b.id, "name": b.name, "input": b.input} for b in uses]},
                                     {"role": "user", "content": [{"type": "tool_result", "tool_use_id": b.id, "content": "recorded"} for b in uses]}]
                with client.messages.stream(model=MODEL_VEGA, max_tokens=200, extra_body={"thinking": {"type": "disabled"}, "output_config": {"effort": "low"}},
                                            system=SYSTEM_BLOCKS + [{"type": "text", "text": voice_rules}], messages=follow, tools=[UPDATE_TOOL],
                                            tool_choice={"type": "none"}) as s2:
                    for txt in s2.text_stream:
                        yield f"data: {json.dumps({'t': txt}, ensure_ascii=False)}\n\n"
                    account(MODEL_VEGA, s2.get_final_message().usage)
            yield "data: [DONE]\n\n"
        except Exception as e:  # akış içinde hata → istemciye bildir
            yield f"data: {json.dumps({'error': str(e)[:200]})}\n\n"

    return StreamingResponse(gen(), media_type="text/event-stream", headers={"Cache-Control": "no-cache"})


# ---- Gerçekçi ses: Google Gemini TTS (isteğe bağlı; GEMINI_API_KEY yoksa istemci tarayıcı sesine düşer) ----
GEMINI_KEY = os.environ.get("GEMINI_API_KEY", "")
GEMINI_VOICE = os.environ.get("GEMINI_VOICE", "Achird")
TTS_MODELS = [m.strip() for m in os.environ.get("GEMINI_TTS_MODEL", "gemini-3.8-flash-tts,gemini-3.8-flash-lite-tts,gemini-2.5-flash-preview-tts").split(",") if m.strip()]
TTS_STYLE = {"calm": "calm, clear and reassuring, like a spacecraft assistant, natural pace",
             "urgent": "urgent but controlled and clear, slightly faster, like a flight controller"}
_tts_cool: dict[str, float] = {}


def _pcm_to_wav(pcm: bytes, rate: int) -> bytes:
    return b"RIFF" + struct.pack("<I", 36 + len(pcm)) + b"WAVEfmt " + struct.pack("<IHHIIHH", 16, 1, 1, rate, rate * 2, 2, 16) \
        + b"data" + struct.pack("<I", len(pcm)) + pcm


def _find_audio(node):
    if isinstance(node, dict):
        if isinstance(node.get("output_audio"), dict) and node["output_audio"].get("data"):
            return node["output_audio"]
        if node.get("type") == "audio" and isinstance(node.get("data"), str):
            return node
        inl = node.get("inlineData")
        if isinstance(inl, dict) and inl.get("data") and "audio" in inl.get("mimeType", ""):
            return {"data": inl["data"], "mime_type": inl["mimeType"]}
        node = list(node.values())
    if isinstance(node, list):
        for v in node:
            f = _find_audio(v)
            if f:
                return f
    return None


@app.post("/api/tts")
async def tts(req: Request):
    from fastapi.responses import Response
    if not GEMINI_KEY:
        raise HTTPException(503, "GEMINI_API_KEY not set")
    guard(req)
    body = await req.json()
    text = str(body.get("text", "")).strip()[:1500]
    if not text:
        raise HTTPException(400, "empty")
    style = TTS_STYLE.get(body.get("style"), TTS_STYLE["calm"])
    async with httpx.AsyncClient(timeout=30) as hc:
        for model in TTS_MODELS:
            if _tts_cool.get(model, 0) > time.time():
                continue
            legacy = model.startswith("gemini-2.")
            content = {"type": "text", "text": f"Say in a {style} tone: {text}"} if legacy else \
                      {"type": "text", "text": text, "annotations": [{"type": "speech_metadata", "style": style}]}
            payload = {"model": model, "input": [{"type": "user_input", "content": [content]}],
                       "response_format": {"type": "audio"}, "generation_config": {"speech_config": [{"voice": GEMINI_VOICE}]}}
            try:
                r = await hc.post("https://generativelanguage.googleapis.com/v1beta/interactions", json=payload,
                                  headers={"x-goog-api-key": GEMINI_KEY})
            except Exception:
                continue
            if r.status_code in (404, 429):  # kota / model yok → bir süre atla, sıradakini dene
                _tts_cool[model] = time.time() + (86400 if r.status_code == 404 else 60)
                continue
            if r.status_code != 200:
                continue
            a = _find_audio(r.json())
            if not a:
                continue
            buf = base64.b64decode(a["data"])
            if buf[:4] != b"RIFF":
                import re
                m = re.search(r"rate=(\d+)", a.get("mime_type", ""))
                buf = _pcm_to_wav(buf, int(m.group(1)) if m else 24000)
            return Response(buf, media_type="audio/wav", headers={"Cache-Control": "no-store", "X-TTS-Model": model})
    raise HTTPException(429, "tts quota")
