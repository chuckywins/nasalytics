// Ses: Web Audio ile üretilen tehlike alarmı (dosya yok) ve tarayıcı konuşma sentezi.
// Not: tarayıcılar kullanıcı tıklaması olmadan ses çalmaz → "Oturumu başlat" ile unlock edilir.
// Konuşma sentetiktir (AI/TTS); arayüzde ve teslimde belirtilir. AI notu: Claude (Anthropic) yardımıyla yazılmıştır.
let ctx: AudioContext | null = null;
let alarmTimer: number | null = null;

export function unlockAudio() {
  ctx = ctx ?? new AudioContext();
  if (ctx.state === 'suspended') void ctx.resume();
  // Bazı tarayıcılarda konuşma sentezini de ilk tıklamada "ısıtmak" gerekir
  try { speechSynthesis.speak(new SpeechSynthesisUtterance('')); } catch { /* yok */ }
}

function beep(freq: number, start: number, dur: number, gain = 0.18) {
  if (!ctx) return;
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = 'square'; o.frequency.value = freq;
  g.gain.setValueAtTime(0, ctx.currentTime + start);
  g.gain.linearRampToValueAtTime(gain, ctx.currentTime + start + 0.01);
  g.gain.setValueAtTime(gain, ctx.currentTime + start + dur - 0.02);
  g.gain.linearRampToValueAtTime(0, ctx.currentTime + start + dur);
  o.connect(g).connect(ctx.destination);
  o.start(ctx.currentTime + start); o.stop(ctx.currentTime + start + dur + 0.02);
}

/** Yüksek öncelikli alarm deseni (IEC 60601-1-8 esinli 3+2 darbe), onaylanana kadar her 4 sn tekrar */
export function startAlarm() {
  if (!ctx || alarmTimer != null) return;
  const burst = () => { [0, 0.18, 0.36, 0.72, 0.9].forEach((s, i) => beep(i < 3 ? 880 : 988, s, 0.12)); };
  burst();
  alarmTimer = window.setInterval(burst, 4000);
}
export function stopAlarm() { if (alarmTimer != null) { clearInterval(alarmTimer); alarmTimer = null; } }
export const alarmActive = () => alarmTimer != null;

/** Tek cümleyi seslendir (kuyruğa ekler). Dil için en uygun sesi seçer. */
export function speak(text: string, lang: 'tr' | 'en', opts: { interrupt?: boolean } = {}) {
  try {
    if (opts.interrupt) speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = lang === 'tr' ? 'tr-TR' : 'en-US';
    const voices = speechSynthesis.getVoices().filter((v) => v.lang.toLowerCase().startsWith(lang));
    // Tercih: "Natural"/"Online" (Edge nöral sesleri) > Google > diğer
    u.voice = voices.find((v) => /natural|online/i.test(v.name)) ?? voices.find((v) => /google/i.test(v.name)) ?? voices[0] ?? null;
    u.rate = 1.05;
    speechSynthesis.speak(u);
  } catch { /* konuşma sentezi yok */ }
}
export const stopSpeaking = () => { try { speechSynthesis.cancel(); } catch { /* yok */ } };

// ---- VEGA'nın gerçekçi sesi: sunucu /api/tts (Azure nöral ses; yedek Gemini TTS). Başarısızsa tarayıcı sesi. ----
// Cümle cümle boru hattı: her cümlenin sesi hemen istenir, sırayla çalınır → VEGA ilk cümlede konuşmaya başlar.
// Alarm anonsları her zaman tarayıcı sesiyle anında okunur (çevrimdışı da çalışmalı).
let ttsOff = false;
let current: AudioBufferSourceNode | null = null;
let gen = 0;
let chain: Promise<void> = Promise.resolve();
export function stopVoice() { gen++; chain = Promise.resolve(); try { current?.stop(); } catch { /* yok */ } current = null; stopSpeaking(); }
/** Yeni cevap başlıyor: önceki konuşmayı kes */
export function beginReply() { stopVoice(); return gen; }
async function fetchVoice(text: string, lang: 'tr' | 'en', style: string): Promise<AudioBuffer | null> {
  if (ttsOff || !ctx) return null;
  try {
    const r = await fetch(`${import.meta.env.VITE_API_BASE ?? ''}/api/tts`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text, lang, style }) });
    if (r.status === 503) ttsOff = true;
    if (!r.ok) return null;
    return await ctx.decodeAudioData(await r.arrayBuffer());
  } catch { return null; }
}
function play(buf: AudioBuffer) {
  return new Promise<void>((res) => { const src = ctx!.createBufferSource(); src.buffer = buf; src.connect(ctx!.destination); src.onended = () => { if (current === src) current = null; res(); }; current = src; src.start(); });
}
function browserSay(text: string, lang: 'tr' | 'en') {
  return new Promise<void>((res) => {
    try {
      const u = new SpeechSynthesisUtterance(text);
      u.lang = lang === 'tr' ? 'tr-TR' : 'en-US';
      const vs = speechSynthesis.getVoices().filter((v) => v.lang.toLowerCase().startsWith(lang));
      u.voice = vs.find((v) => /natural|online/i.test(v.name)) ?? vs.find((v) => /google/i.test(v.name)) ?? vs[0] ?? null;
      u.rate = 1.05; u.onend = () => res(); u.onerror = () => res();
      speechSynthesis.speak(u);
    } catch { res(); }
  });
}
/** Bir cümleyi sıraya ekle (ses isteği hemen başlar, çalma sırayla) */
export function speakSentence(text: string, lang: 'tr' | 'en', style: 'calm' | 'urgent' = 'calm') {
  const clean = text.replace(/[*_#`>]/g, '').trim();
  if (!clean) return;
  const my = gen;
  const audio = fetchVoice(clean, lang, style);
  chain = chain.then(async () => {
    const buf = await audio;
    if (my !== gen) return;
    if (buf) await play(buf); else await browserSay(clean, lang);
  });
}
