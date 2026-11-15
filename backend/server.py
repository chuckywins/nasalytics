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

import concurrent.futures
import hashlib
import json
import re
import os
import time
from collections import defaultdict, deque
from pathlib import Path

import anthropic
import base64
import struct
from xml.sax.saxutils import escape as xml_escape
import httpx
from fastapi import FastAPI, HTTPException, Request, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from starlette.concurrency import run_in_threadpool

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
RATE_PER_MIN = int(os.environ.get("RATE_PER_MIN", "120"))  # ekip laptopları Vite vekili üzerinden aynı IP (127.0.0.1) ile gelir
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
    {"type": "text", "text": "KNOWLEDGE BASE (sourced research notes, Turkish):\n\n" + KB, "cache_control": {"type": "ephemeral", "ttl": "1h"}},
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

NO_UPDATE_TOOL = {
    "name": "no_update",
    "description": "Use when the message is NOT an explicit request to record a value (a question, hypothetical, unclear value/unit). "
                   "Put your short spoken answer in 'reply'. Never claim that something was recorded here.",
    "input_schema": {"type": "object", "properties": {"reply": {"type": "string", "description": "Spoken answer, max 2 sentences, in the requested language."}}, "required": ["reply"]},
}

# ---- Müdahale sıralaması (CMO / yer kontrol): AI yalnız kütüphane KİMLİKLERİNİ sıralar; doz/ilaç asla modelden geçmez ----
IV_TOOL = {
    "name": "rank_interventions",
    "description": "Rank applicable protocol cards and propose a concrete do-now plan that references library drug IDs.",
    "input_schema": {"type": "object", "properties": {
        "ranked": {"type": "array", "maxItems": 6, "items": {"type": "object", "properties": {
            "id": {"type": "string", "description": "Library protocol id"}, "why": {"type": "string", "description": "One short sentence citing readings/symptoms and what the CMO must confirm."}},
            "required": ["id", "why"]}},
        "plan": {"type": "array", "maxItems": 6, "description": "Ordered do-now actions. Use drugId to prescribe a library medication (the screen shows its verbatim name, dose and page). Use protocol for a non-drug card.",
                 "items": {"type": "object", "properties": {"drugId": {"type": "string"}, "protocol": {"type": "string"}, "why": {"type": "string", "description": "Why this now; no amounts."}}, "required": ["why"]}},
        "offFormulary": {"type": "array", "maxItems": 3, "description": "Optional: a medication with no library procedure that a clinician might consider. If it is in the ISS kit list, set kitId (the screen shows its kit strength); otherwise name/class only. Never an amount.",
                         "items": {"type": "object", "properties": {"kitId": {"type": "string"}, "name": {"type": "string"}, "why": {"type": "string"}}, "required": ["name", "why"]}},
        "summary": {"type": "string", "description": "Max 2 sentences: overall situation and the single most important next action."},
        "escalate": {"type": "string", "enum": ["self", "crew", "ground"]}},
        "required": ["ranked", "plan", "summary", "escalate"]},
}
DRUG_WORDS = ["epinefrin", "nitrogliserin", "salbutamol", "parasetamol", "aspirin", "proventil", "albuterol", "saline", "serum fizyolojik", "epinephrine", "adrenalin", "epi pen", "benadryl", "valium",
              "diazepam", "ambien", "restoril", "diamox", "glucagon", "glukagon", "insulin", "insülin", "nitroglycerin", "atropine"]
DOSE_RE = re.compile(r"\b\d+(?:[.,]\d+)?\s?(?:mg|mcg|µg|ml|mL|tab|tablet|puff|ampul)\b(?!\s?/)", re.I)  # "50 mg/dL" doz değildir


# ---- VEGA belirti bildirimi: AYRI ve hızlı çağrı (ses akışına ikinci araç eklemek akışı bozmuştu) ----
SYMPTOM_TOOL = {
    "name": "report_symptom",
    "description": "The astronaut is reporting a CURRENT symptom or feeling unwell about THEMSELVES right now.",
    "input_schema": {"type": "object", "properties": {
        "category": {"type": "string", "enum": ["chestPain", "breathing", "nausea", "pain", "allergy", "dizzy", "unwell", "other"],
                     "description": "chestPain chest pain/pressure; breathing shortness of breath/wheeze; nausea nausea/vomiting; pain headache or other pain; allergy itching/hives/swelling; dizzy dizziness/faint; unwell general malaise; other"},
        "quote": {"type": "string", "description": "The symptom in the astronaut's own words, short, in their language (no numbers, no advice)."}},
        "required": ["category", "quote"]},
}
NO_SYMPTOM_TOOL = {"name": "no_symptom", "description": "Not a current first-person symptom report: a question, hypothetical ('what if my head hurts'), negation ('my head does not hurt'), past/resolved, or about someone else.",
                   "input_schema": {"type": "object", "properties": {}}}
SYMPTOM_HINT = re.compile(r"ağr|acı|bulan|kus|dön|nefes|soluk|iyi değil|iyi hisset|kötü|halsiz|yorgun|sız|kaşın|şiş|ateş|üşü|titre|ter|göğ|mide|bayıl|uyuş|karın|"
                          r"pain|hurt|ache|naus|dizz|sick|unwell|breath|itch|swell|fever|vomit|tired|weak|faint|numb|chest", re.I)


def _detect_symptom(text: str):
    """Belirti bildirimi mi? Ucuz ön süzgeç + Haiku zorunlu seçim. Hata olursa None (bildirim yok; sessizce)."""
    if not text or not SYMPTOM_HINT.search(text):
        return None
    try:
        m = client.messages.create(model=MODEL_VEGA, max_tokens=150, extra_body={"thinking": {"type": "disabled"}, "output_config": {"effort": "low"}},
                                   system="Classify one astronaut utterance. Report only a symptom the speaker has NOW.",
                                   messages=[{"role": "user", "content": text[:400]}], tools=[SYMPTOM_TOOL, NO_SYMPTOM_TOOL], tool_choice={"type": "any"})
        account(MODEL_VEGA, m.usage)
        for b in m.content:
            if b.type == "tool_use" and b.name == "report_symptom":
                return {"category": b.input.get("category", "other"), "quote": str(b.input.get("quote", ""))[:200] or text[:200]}
    except Exception as e:  # bildirim kaçarsa ses cevabı yine çalışır
        print("[symptom] error", str(e)[:120])
    return None


VEGA_TOOLS = [UPDATE_TOOL, NO_UPDATE_TOOL]  # güncelleme yolu (zorunlu seçim); soru yolu yalnızca UPDATE_TOOL

app = FastAPI(title="Astronaut Health Monitor proxy")
_sym_pool = concurrent.futures.ThreadPoolExecutor(max_workers=4)


def _warm_cache_loop():
    """Prompt önbelleğini (araçlar + kurallar + bilgi tabanı) açılışta ve her 50 dk'da ısıtır → ilk VEGA sorusu da ~1 sn."""
    import threading

    def run():
        while True:
            for model, tools in ((MODEL_VEGA, [UPDATE_TOOL]), (MODEL_VEGA, VEGA_TOOLS), (MODEL_ASSESS, [ASSESS_TOOL])):
                try:
                    r = client.messages.create(model=model, max_tokens=1, system=SYSTEM_BLOCKS, tools=tools,
                                               extra_body={"thinking": {"type": "disabled"}, "output_config": {"effort": "low"}} if model == MODEL_VEGA else {"output_config": {"effort": "low"}},
                                               messages=[{"role": "user", "content": "ping"}])
                    account(model, r.usage)
                except Exception as e:
                    print("[warm]", model, str(e)[:120])
            time.sleep(50 * 60)
    threading.Thread(target=run, daemon=True).start()
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

_hits: dict[str, deque] = defaultdict(deque)
_spend = {"day": time.strftime("%Y-%m-%d"), "usd": 0.0}


def guard(req: Request) -> None:
    # Ters vekil (nginx/Caddy) arkasında tüm istekler 127.0.0.1 görünür → ilk X-Forwarded-For adresi kullanılır
    fwd = req.headers.get("x-forwarded-for", "")
    ip = fwd.split(",")[0].strip() if fwd else (req.client.host if req.client else "?")
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
    print(f"[usage] {model} in={usage.input_tokens} cache_w={getattr(usage, 'cache_creation_input_tokens', 0)} "
          f"cache_r={getattr(usage, 'cache_read_input_tokens', 0)} out={usage.output_tokens} day=${_spend['usd']:.3f}", flush=True)


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
    msg = await run_in_threadpool(client.messages.create,
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
    msg = await run_in_threadpool(client.messages.create,
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
    msg = await run_in_threadpool(client.messages.create,
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


@app.post("/api/interventions")
async def interventions(req: Request):
    guard(req)
    body = await req.json()
    lang = body.get("lang", "tr")
    lib = body.get("library", [])
    ids = {x.get("id") for x in lib}
    cands = [c for c in body.get("candidates", []) if c in ids]
    t0 = time.time()
    rules = ("You support a Crew Medical Officer (CMO) and a ground flight surgeon in a hackathon prototype with simulated data. "
             "OVERRIDE for this tool only: you MAY prescribe library medications, but ONLY by their drugId from the library; the screen "
             "renders the verbatim name, dose and page from NASA's ISS emergency medical procedures (2015, FOIA 2016) or the Shuttle Medical Checklist (JSC-48031), so never write an amount or number of units yourself. "
             "The 'kit' list is the ISS medical kit (2015): for a medicine in it that has no library drugId, use offFormulary with its kitId. "
             "Rank candidate cards (you may add other library ids if symptoms/snapshot support them), then give an ordered do-now plan. "
             "Respect each drug's 'condition' and locked flag (Shuttle '*' = flight-surgeon approval, in an emergency or loss of signal treatment may begin; ISS 'as directed by Surgeon'). "
             "Vital signs alone never prove a diagnosis: say what the CMO must confirm. offFormulary: name/class only, never amounts. "
             "Answer in language: " + lang)
    kit = body.get("kit", []) or []
    kit_ids = {k.get("id") for k in kit}
    drug_ids = {d.get("id") for x in lib for d in x.get("drugs", [])}

    def clean(txt):  # doz kalıbındaki HER sayı silinir: dozu ekranda kütüphane/kit satırı gösterir, model asla
        return DOSE_RE.sub("…", str(txt)[:400])

    msg = await run_in_threadpool(client.messages.create,
        model=MODEL_ASSESS, max_tokens=1500, system=SYSTEM_BLOCKS + [{"type": "text", "text": rules}], tools=[IV_TOOL], tool_choice={"type": "auto"},
        extra_body={"output_config": {"effort": "low"}},
        messages=[{"role": "user", "content": f"Library: {json.dumps(lib)}\nCandidates: {json.dumps(cands)}\nRole viewing: {body.get('role')}\n"
                                                f"ISS kit: {json.dumps(kit)}\n"
                                                f"Astronaut-reported via VEGA (self-report, not a diagnosis): {json.dumps(body.get('reported', []), ensure_ascii=False)[:800]}\n"
                                                f"CMO-typed symptoms: {str(body.get('symptoms', ''))[:400]}\nCMO-confirmed signs: {json.dumps(body.get('confirmedSigns', []))}\n"
                                                f"Snapshot: {json.dumps(body.get('snapshot', {}), ensure_ascii=False)}\nCall rank_interventions."}])
    account(MODEL_ASSESS, msg.usage)
    out = next((b.input for b in msg.content if b.type == "tool_use"), None)
    if not out:
        raise HTTPException(502, "no ranking")
    ranked = [{"id": r.get("id"), "why": clean(r.get("why", ""))} for r in out.get("ranked", []) if r.get("id") in ids]
    for c in cands:  # deterministik adaylar asla düşmez
        if c not in [r["id"] for r in ranked]:
            ranked.append({"id": c, "why": ""})
    plan = [{"drugId": it.get("drugId") if it.get("drugId") in drug_ids else None,
             "protocol": it.get("protocol") if it.get("protocol") in ids else None, "why": clean(it.get("why", ""))}
            for it in out.get("plan", []) if it.get("drugId") in drug_ids or it.get("protocol") in ids]
    off = [{"kitId": o.get("kitId") if o.get("kitId") in kit_ids else None, "name": clean(o.get("name", ""))[:60], "why": clean(o.get("why", ""))[:200]} for o in out.get("offFormulary", [])][:3]
    return {"result": {"ranked": ranked, "plan": plan, "offFormulary": off, "summary": clean(out.get("summary", "")), "escalate": out.get("escalate")},
            "latencyMs": int((time.time() - t0) * 1000), "model": MODEL_ASSESS}


@app.post("/api/vega")
async def vega(req: Request):
    guard(req)
    body = await req.json()
    lang = body.get("lang", "tr")
    snapshot = json.dumps(body.get("snapshot", {}), ensure_ascii=False)
    history = body.get("history", [])[-8:]
    voice_rules = ("\nYou are VEGA, the spoken voice of this assistant. Your reply is read aloud by text-to-speech: "
                   "max 2 short sentences, no lists, no markdown, no symbols, numbers with units spoken naturally."
                   "\nIf the astronaut explicitly asks to update/enter/set a value, call update_reading and say nothing else (the screen confirms it). "
                   " Never mention internal words like snapshot, JSON, system or tool; say your readings instead. "
                   " If asked which exercises prevent bone or muscle loss, answer ONLY from this NASA summary (OCHMO-TB-031, OCHMO-MTB-013) and never give loads, sets or reps"
                   " (the astronaut's strength and conditioning specialist personalises them): daily about 30 minutes aerobic (interval or steady, treadmill or cycle) plus 30 to 60 minutes resistive load-bearing training,"
                   " 6 to 7 sessions a week; on ISS the resistive device ARED is used for squats, deadlifts, heel raises and bench press; single-leg squats and hip abductor work load the hip,"
                   " heel raises load the calf and heel bone, deadlifts and good mornings load the lower spine; the exercise plan is on the screen under Tasks, NASA plan. "
                   "\nIf the astronaut says they feel unwell or reports a symptom, answer calmly with one short safe step (stop, rest, stay still). "
                   "The system automatically notifies the crew medical officer and the crew of reported symptoms: never tell the astronaut to report it themselves, and never say that you notified anyone (the system confirms it separately)."
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

    XB = {"thinking": {"type": "disabled"}, "output_config": {"effort": "low"}}
    SYS = SYSTEM_BLOCKS + [{"type": "text", "text": voice_rules}]
    intent = bool(re.search(r"güncelle|kaydet|ayarla|değiştir|olarak gir|\byap\b|\bgir\b|\bset\b|update|record|change|\blog\b",
                            str(body.get("text", "")).lower()))

    sym_future = _sym_pool.submit(_detect_symptom, str(body.get("text", "")))  # akışla PARALEL; ilk ses gecikmesi değişmez

    def sym_event():
        try:
            r = sym_future.result(timeout=10)
        except Exception:
            r = None
        return f"data: {json.dumps({'symptom': r}, ensure_ascii=False)}\n\n" if r else ""

    def gen():
        try:
            if intent:  # güncelleme komutu: önce kayıt (akışsız), sonra temiz sözlü onay
                # Araç seçimi zorunlu: ya update_reading ya no_update → "kaydettim" deyip kaydetmeme durumu olamaz
                first = client.messages.create(model=MODEL_VEGA, max_tokens=400, extra_body=XB, system=SYS, messages=messages,
                                               tools=VEGA_TOOLS, tool_choice={"type": "any"})
                account(MODEL_VEGA, first.usage)
                uses = [b for b in first.content if b.type == "tool_use" and b.name == "update_reading"]
                for b in uses:
                    yield f"data: {json.dumps({'action': b.input}, ensure_ascii=False)}\n\n"
                if not uses:
                    nu = [b for b in first.content if b.type == "tool_use" and b.name == "no_update"]
                    txt = nu[0].input.get("reply", "") if nu else "".join(b.text for b in first.content if b.type == "text")
                    yield f"data: {json.dumps({'t': txt}, ensure_ascii=False)}\n\n"
                ev = sym_event()
                if ev:
                    yield ev
                yield "data: [DONE]\n\n"
                return
            with client.messages.stream(model=MODEL_VEGA, max_tokens=400, extra_body={"thinking": {"type": "disabled"}, "output_config": {"effort": "low"}},  # ölçüldü: TTFT ~1,1 sn; düşünme açıkken Haiku tüm bütçeyi düşünmeye harcıyordu
                                        system=SYSTEM_BLOCKS + [{"type": "text", "text": voice_rules}], messages=messages,
                                        tools=[UPDATE_TOOL], tool_choice={"type": "auto"}) as s:  # soru yolu: no_update VERİLMEZ (model metni araca koyup akışı bozuyordu)
                head, flushed = "", False  # model bazen araç adını metne yazıyor ("no_update: ...") → baştan temizle
                for txt in s.text_stream:
                    if not flushed:
                        head += txt
                        if len(head) < 24:
                            continue
                        txt, flushed = re.sub(r"^\s*(no_update|update_reading)\s*[:：-]?\s*", "", head), True
                    yield f"data: {json.dumps({'t': txt}, ensure_ascii=False)}\n\n"
                if not flushed and head:
                    _t = re.sub(r'^\s*(no_update|update_reading)\s*[:：-]?\s*', '', head)  # Python 3.11: f-string içinde \ olamaz
                    yield f"data: {json.dumps({'t': _t}, ensure_ascii=False)}\n\n"
                final = s.get_final_message()
                account(MODEL_VEGA, final.usage)
                spoke = any(b.type == "text" and b.text.strip() for b in final.content)
                uses = [b for b in final.content if b.type == "tool_use" and b.name == "update_reading"]
                for b in uses:  # değer güncelleme komutları → istemci aralık kontrolüyle uygular, kural motoru değerlendirir
                    yield f"data: {json.dumps({'action': b.input}, ensure_ascii=False)}\n\n"
                for b in final.content:  # akış yolunda model no_update seçtiyse cevabı oradadır
                    if b.type == "tool_use" and b.name == "no_update" and not spoke:
                        yield f"data: {json.dumps({'t': b.input.get('reply', '')}, ensure_ascii=False)}\n\n"
            ev = sym_event()
            if ev:
                yield ev
            yield "data: [DONE]\n\n"
        except Exception as e:  # akış içinde hata → istemciye bildir
            yield f"data: {json.dumps({'error': str(e)[:200]})}\n\n"

    return StreamingResponse(gen(), media_type="text/event-stream", headers={"Cache-Control": "no-cache"})


# ---- Gerçekçi ses: Google Gemini TTS (isteğe bağlı; GEMINI_API_KEY yoksa istemci tarayıcı sesine düşer) ----
AZURE_KEY = os.environ.get("AZURE_SPEECH_KEY", "")
AZURE_REGION = os.environ.get("AZURE_SPEECH_REGION", "eastus")
AZURE_VOICE_TR = os.environ.get("AZURE_VOICE_TR", "tr-TR-AhmetNeural")
AZURE_VOICE_EN = os.environ.get("AZURE_VOICE_EN", "en-US-AndrewNeural")
_azure = httpx.AsyncClient(timeout=15)  # bağlantı yeniden kullanımı → ilk istekten sonra daha düşük gecikme
# Birden çok anahtar: GEMINI_API_KEYS=k1,k2,... (ve/veya GEMINI_API_KEY). Kotası dolan anahtar+model bir süre atlanır.
GEMINI_KEYS = [k.strip() for k in (os.environ.get("GEMINI_API_KEYS", "") + "," + os.environ.get("GEMINI_API_KEY", "")).split(",") if k.strip()]
GEMINI_KEYS = list(dict.fromkeys(GEMINI_KEYS))
GEMINI_KEY = GEMINI_KEYS[0] if GEMINI_KEYS else ""
GEMINI_VOICE = os.environ.get("GEMINI_VOICE", "Achird")
TTS_MODELS = [m.strip() for m in os.environ.get("GEMINI_TTS_MODEL", "gemini-3.8-flash-tts,gemini-3.8-flash-lite-tts,gemini-2.5-flash-preview-tts").split(",") if m.strip()]
TTS_STYLE = {"calm": "warm, calm and friendly, natural conversational pace",
             # Acil durum: panik değil; sakin, güven veren, net ve biraz yavaş (yönlendiren uçuş kontrolörü gibi)
             "urgent": "calm, steady and reassuring, clear and slightly slower, like a composed flight controller guiding someone through a problem"}
_tts_cool: dict[str, float] = {}
_tts_cache: dict = {}  # (metin, dil, acil) → ses; en fazla 200


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


def _retry_s(body: str) -> float:
    m = re.search(r"retry in (?:(\d+)h)?(?:(\d+)m)?(?:([\d.]+)s)?", body, re.I)
    if m and any(m.groups()):
        return (int(m.group(1) or 0) * 3600 + int(m.group(2) or 0) * 60 + float(m.group(3) or 0)) + 1
    return 86400 if re.search(r"limit: 0", body, re.I) else 60


async def _gemini(text: str, style: str):
    async with httpx.AsyncClient(timeout=30) as hc:
        for model in TTS_MODELS:  # en iyi model tüm anahtarlarda önce
            for ki, key in enumerate(GEMINI_KEYS):
                tag = f"{ki}:{model}"
                if _tts_cool.get(tag, 0) > time.time():
                    continue
                legacy = model.startswith("gemini-2.")
                content = {"type": "text", "text": f"Say in a {style} tone: {text}"} if legacy else \
                          {"type": "text", "text": text, "annotations": [{"type": "speech_metadata", "style": style}]}
                payload = {"model": model, "input": [{"type": "user_input", "content": [content]}],
                           "response_format": {"type": "audio"}, "generation_config": {"speech_config": [{"voice": GEMINI_VOICE}]}}
                try:
                    r = await hc.post("https://generativelanguage.googleapis.com/v1beta/interactions", json=payload, headers={"x-goog-api-key": key})
                except Exception:
                    continue
                if r.status_code in (404, 429):  # kota / model yok → bu anahtar+model bir süre atlanır, sıradaki denenir
                    _tts_cool[tag] = time.time() + (86400 if r.status_code == 404 else _retry_s(r.text))
                    print(f"[tts] key#{ki} {model} {r.status_code} -> skip")
                    continue
                if r.status_code in (400, 401, 403):  # geçersiz anahtar → bu anahtarı 1 saat atla
                    for m in TTS_MODELS:
                        _tts_cool[f"{ki}:{m}"] = time.time() + 3600
                    print(f"[tts] key#{ki} {r.status_code} -> key skipped")
                    break
                if r.status_code != 200:
                    continue
                a = _find_audio(r.json())
                if not a:
                    continue
                buf = base64.b64decode(a["data"])
                if buf[:4] != b"RIFF":
                    m = re.search(r"rate=(\d+)", a.get("mime_type", ""))
                    buf = _pcm_to_wav(buf, int(m.group(1)) if m else 24000)
                return buf, f"gemini:{model}#key{ki}"
    return None, None


async def _azure_tts(text: str, lang: str, urgent: bool):
    if not AZURE_KEY or _tts_cool.get("azure", 0) > time.time():
        return None, None
    voice = AZURE_VOICE_EN if lang == "en" else AZURE_VOICE_TR
    ssml = (f"<speak version='1.0' xml:lang='{'en-US' if lang == 'en' else 'tr-TR'}'><voice name='{voice}'>"
            f"<prosody rate='{'+8%' if urgent else '+0%'}'>{xml_escape(text)}</prosody></voice></speak>")
    try:
        r = await _azure.post(f"https://{AZURE_REGION}.tts.speech.microsoft.com/cognitiveservices/v1", content=ssml.encode("utf-8"),
                              headers={"Ocp-Apim-Subscription-Key": AZURE_KEY, "Content-Type": "application/ssml+xml",
                                       "X-Microsoft-OutputFormat": "audio-24khz-48kbitrate-mono-mp3", "User-Agent": "vega-proto"})
        if r.status_code == 200 and r.content:
            return r.content, f"azure:{voice}"
        if r.status_code in (401, 403, 429):
            _tts_cool["azure"] = time.time() + (3600 if r.status_code != 429 else 60)
    except Exception:
        pass
    return None, None


@app.post("/api/tts")
async def tts(req: Request):
    """Sıra: Gemini (birden çok anahtar × model) → Azure (varsa) → 429 (istemci tarayıcı sesine düşer)."""
    from fastapi.responses import Response
    if not (GEMINI_KEYS or AZURE_KEY):
        raise HTTPException(503, "no TTS key")
    guard(req)
    body = await req.json()
    text = str(body.get("text", "")).strip()[:1500]
    if not text:
        raise HTTPException(400, "empty")
    lang = "en" if body.get("lang") == "en" else "tr"
    urgent = body.get("style") == "urgent"
    ck = (text, lang, urgent)
    if ck in _tts_cache:
        buf, model, mt = _tts_cache[ck]
        return Response(buf, media_type=mt, headers={"Cache-Control": "no-store", "X-TTS-Model": model + " (cache)"})
    buf, model = await _gemini(text, TTS_STYLE["urgent" if urgent else "calm"])
    mt = "audio/wav"
    if not buf:
        buf, model = await _azure_tts(text, lang, urgent)
        mt = "audio/mpeg"
    if not buf:
        raise HTTPException(429, "tts quota")
    _tts_cache[ck] = (buf, model, mt)
    while len(_tts_cache) > 200:
        _tts_cache.pop(next(iter(_tts_cache)))
    return Response(buf, media_type=mt, headers={"Cache-Control": "no-store", "X-TTS-Model": model})


# ---- Akışlı Gemini sesi: ilk ses parçası ~4 sn'de çalmaya başlar (tam dosyayı beklemez). Ham PCM 24 kHz 16-bit LE mono. ----
# Disk önbelleği: aynı cümle (ör. alarm anonsları) bir kez üretildikten sonra anında ve kota harcamadan çalar.
TTS_CACHE_DIR = ROOT / "backend" / "tts_cache"
TTS_CACHE_DIR.mkdir(exist_ok=True)


@app.post("/api/tts_stream")
async def tts_stream(req: Request):
    from fastapi.responses import Response
    if not GEMINI_KEYS:
        raise HTTPException(503, "GEMINI_API_KEYS not set")
    body = await req.json()
    text = str(body.get("text", "")).strip()[:1500]
    if not text:
        raise HTTPException(400, "empty")
    style = TTS_STYLE["urgent" if body.get("style") == "urgent" else "calm"]
    path = TTS_CACHE_DIR / (hashlib.sha1(f"{GEMINI_VOICE}|{style}|{text}".encode("utf-8")).hexdigest() + ".pcm")
    if path.exists():  # önbellek isabeti hız sınırına sayılmaz (maliyet yok)
        return Response(path.read_bytes(), media_type="application/octet-stream", headers={"X-TTS-Model": "cache"})
    guard(req)
    hc = httpx.AsyncClient(timeout=60)
    up, tag, first, lines = None, "", b"", None

    def audio_of(line: str):
        """SSE satırı → (pcm | None, hata mesajı | None). Gemini kota dolunca HTTP 200 içinde 'event: error' yollar."""
        if not line.startswith("data:"):
            return None, None
        try:
            d = json.loads(line[5:].strip())
        except Exception:
            return None, None
        if d.get("error"):
            return None, str(d["error"].get("message", "error"))
        delta = d.get("delta") or {}
        if delta.get("data") and str(delta.get("mime_type", "audio")).startswith("audio"):
            return base64.b64decode(delta["data"]), None
        return None, None

    # Sıra: en iyi model TÜM anahtarlarda denenir, sonra bir alt model (ses kalitesi tutarlı kalsın)
    for model in TTS_MODELS:
        for ki, key in enumerate(GEMINI_KEYS):
            tag = f"{ki}:{model}"
            if _tts_cool.get(tag, 0) > time.time():
                continue
            legacy = model.startswith("gemini-2.")
            content = {"type": "text", "text": f"Say in a {style} tone: {text}"} if legacy else                       {"type": "text", "text": text, "annotations": [{"type": "speech_metadata", "style": style}]}
            payload = {"model": model, "input": [{"type": "user_input", "content": [content]}], "stream": True,
                       "response_format": {"type": "audio"}, "generation_config": {"speech_config": [{"voice": GEMINI_VOICE}]}}
            try:
                r = await hc.send(hc.build_request("POST", "https://generativelanguage.googleapis.com/v1beta/interactions",
                                                   json=payload, headers={"x-goog-api-key": key}), stream=True)
            except Exception:
                continue
            if r.status_code == 200:
                # İlk ses parçasını bekle: akış içi hata (kota) gelirse sıradaki anahtara geç
                it = r.aiter_lines()
                err = None
                try:
                    async for line in it:
                        pcm, err = audio_of(line)
                        if pcm or err:
                            first = pcm or b""
                            break
                except Exception as e:
                    err = str(e)
                if first and not err:
                    up, lines = r, it
                    break
                await r.aclose()
                _tts_cool[tag] = time.time() + (_retry_s(err or "") if err else 60)
                print(f"[tts] key#{ki} {model} stream-error -> skip: {(err or 'no audio')[:80]}")
                continue
            err = (await r.aread()).decode("utf-8", "ignore")
            await r.aclose()
            if r.status_code in (404, 429):
                _tts_cool[tag] = time.time() + (86400 if r.status_code == 404 else _retry_s(err))
                print(f"[tts] key#{ki} {model} {r.status_code} -> skip")
            elif r.status_code in (400, 401, 403):
                for m in TTS_MODELS:
                    _tts_cool[f"{ki}:{m}"] = time.time() + 3600
        if up:
            break
    if not up:
        await hc.aclose()
        raise HTTPException(429, "tts quota")

    async def gen():
        buf = bytearray(first)
        try:
            yield first
            async for line in lines:
                pcm, err = audio_of(line)
                if err:
                    break
                if pcm:
                    buf += pcm
                    yield pcm
            if len(buf) > 4800:
                path.write_bytes(bytes(buf))
        finally:
            await up.aclose()
            await hc.aclose()
    return StreamingResponse(gen(), media_type="application/octet-stream", headers={"X-TTS-Model": f"gemini:{tag} stream"})



# ---- Canlı telemetri aktarımı: astronot laptopları anlık durumu yollar; mürettebat (CMO) ve yer kontrol ekranları dinler ----
# Gecikme SUNUCUDA uygulanmaz: her paket gönderim zamanıyla damgalanır, yer kontrol ekranı "şimdi − gecikme" anını gösterir.
_crew_last: dict[str, dict] = {}
_viewers: set = set()
_astros: set = set()
_crew_seen: dict[str, float] = {}


@app.websocket("/ws/telemetry")
async def telemetry(ws: WebSocket):
    await ws.accept()
    role = ws.query_params.get("role", "astronaut")
    if role == "astronaut":
        _astros.add(ws)
    if role != "astronaut":
        _viewers.add(ws)
        for k, pkt in list(_crew_last.items()):  # yalnızca son 3 dk içinde veri gönderen cihazlar (kapanmış telefonlar birikmez)
            if time.time() - _crew_seen.get(k, 0) > 180:
                _crew_last.pop(k, None); _crew_seen.pop(k, None); continue
            await ws.send_json(pkt)
    try:
        while True:
            msg = await ws.receive_json()
            if role != "astronaut":
                continue
            if msg.get("type") == "notice":  # mürettebat bildirimi: diğer astronot cihazlarına (CMO bunu paketten görür)
                n = msg.get("notice") or {}
                note = {"type": "notice", "notice": {"id": str(n.get("id", ""))[:24], "crewId": re.sub(r"[^A-Za-z0-9-]", "", str(n.get("crewId", "")))[:8],
                                                     "t": n.get("t"), "category": str(n.get("category", "other"))[:16], "quote": str(n.get("quote", ""))[:200]}}
                for a in list(_astros):
                    if a is ws:
                        continue
                    try:
                        await a.send_json(note)
                    except Exception:
                        _astros.discard(a)
                continue
            crew = re.sub(r"[^A-Za-z0-9-]", "", str(msg.get("crewId", "C-01")))[:8] or "C-01"
            pkt = {"crewId": crew, "t": msg.get("t") or time.time() * 1000, "snap": msg.get("snap"), "ui": msg.get("ui")}
            if len(json.dumps(pkt)) > 60_000:
                continue
            _crew_last[crew] = pkt
            _crew_seen[crew] = time.time()
            for v in list(_viewers):
                try:
                    await v.send_json(pkt)
                except Exception:
                    _viewers.discard(v)
    except WebSocketDisconnect:
        pass
    finally:
        _viewers.discard(ws)
        _astros.discard(ws)


_warm_cache_loop()

# ---- Tek adres: derlenmiş arayüz (frontend/dist) aynı sunucudan → /api ve /ws aynı köken, HTTPS'te mikrofon/kamera çalışır ----
_DIST = Path(__file__).resolve().parent.parent / "frontend" / "dist"
if _DIST.is_dir():
    from fastapi.staticfiles import StaticFiles
    app.mount("/", StaticFiles(directory=str(_DIST), html=True), name="ui")


# ---- Alt dizin öneki (OpenLiteSpeed gibi öneki soymayan vekiller için): URL_PREFIX=/nasalytics ----
class _StripPrefix:
    def __init__(self, inner, prefix: str):
        self.inner, self.prefix = inner, prefix

    async def __call__(self, scope, receive, send):
        if scope["type"] in ("http", "websocket"):
            p = scope.get("path", "")
            if scope["type"] == "http" and p == self.prefix:  # /nasalytics → /nasalytics/
                await send({"type": "http.response.start", "status": 301, "headers": [(b"location", (self.prefix + "/").encode())]})
                await send({"type": "http.response.body", "body": b""})
                return
            if p.startswith(self.prefix + "/"):
                scope = dict(scope)
                scope["path"] = p[len(self.prefix):]
                scope["raw_path"] = scope["path"].encode()
        await self.inner(scope, receive, send)


_PREFIX = os.environ.get("URL_PREFIX", "").rstrip("/")
if _PREFIX:
    app = _StripPrefix(app, _PREFIX)  # noqa: F811 — uvicorn backend.server:app bunu yükler
