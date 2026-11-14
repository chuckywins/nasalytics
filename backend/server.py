"""İnce Claude proxy'si: API anahtarı yalnızca burada durur.

Uç noktalar:
  GET  /api/health
  POST /api/assess  → AI sağlık değerlendirmesi (Sonnet 5.5, zorunlu araç çağrısı ile şemalı JSON)
  POST /api/jarvis  → Sesli asistan (Haiku 5.5, SSE akışı)

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
MODEL_JARVIS = os.environ.get("MODEL_JARVIS", "claude-haiku-5-5")
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
    return {"ok": True, "models": {"assess": MODEL_ASSESS, "jarvis": MODEL_JARVIS}, "spentTodayUsd": round(_spend["usd"], 4), "budgetUsd": DAILY_BUDGET_USD}


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


@app.post("/api/jarvis")
async def jarvis(req: Request):
    guard(req)
    body = await req.json()
    lang = body.get("lang", "tr")
    snapshot = json.dumps(body.get("snapshot", {}), ensure_ascii=False)
    history = body.get("history", [])[-8:]
    voice_rules = ("\nYou are JARVIS, the spoken voice of this assistant. Your reply is read aloud by text-to-speech: "
                   "max 2 short sentences, no lists, no markdown, no symbols, numbers with units spoken naturally.")
    messages = [m for m in history if m.get("role") in ("user", "assistant") and m.get("content")]
    messages.append({"role": "user", "content": f"Language: {lang}\nLive snapshot: {snapshot}\n\nAstronaut says: {body.get('text', '')}"})

    def gen():
        try:
            with client.messages.stream(model=MODEL_JARVIS, max_tokens=300, extra_body={"thinking": {"type": "disabled"}, "output_config": {"effort": "low"}},  # ölçüldü: TTFT ~1,1 sn; düşünme açıkken Haiku tüm bütçeyi düşünmeye harcıyordu
                                        system=SYSTEM_BLOCKS + [{"type": "text", "text": voice_rules}], messages=messages) as s:
                for txt in s.text_stream:
                    yield f"data: {json.dumps({'t': txt}, ensure_ascii=False)}\n\n"
                account(MODEL_JARVIS, s.get_final_message().usage)
            yield "data: [DONE]\n\n"
        except Exception as e:  # akış içinde hata → istemciye bildir
            yield f"data: {json.dumps({'error': str(e)[:200]})}\n\n"

    return StreamingResponse(gen(), media_type="text/event-stream", headers={"Cache-Control": "no-cache"})
