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

// ---- VEGA'nın gerçekçi sesi: sunucu /api/tts (Google Gemini TTS). Başarısızsa tarayıcı sesi. ----
// Cevabın tamamı TEK istekle seslendirilir (ses cevabın ortasında değişmez, kota korunur).
// Alarm anonsları her zaman tarayıcı sesiyle anında okunur (çevrimdışı da çalışmalı).
let ttsOff = false;
export const geminiVoice = () => !ttsOff && !!ctx;
let current: AudioBufferSourceNode | null = null;
let gen = 0;
export function stopVoice() { gen++; try { current?.stop(); } catch { /* yok */ } current = null; stopSpeaking(); }
export async function speakReply(text: string, lang: 'tr' | 'en', style: 'calm' | 'urgent' = 'calm') {
  const my = ++gen;
  const clean = text.replace(/[*_#`>]/g, '').trim();
  if (!clean) return;
  const fallback = () => { if (my !== gen) return; clean.split(/(?<=[.!?;])\s+/).forEach((x) => x && speak(x, lang)); };
  if (ttsOff || !ctx) return fallback();
  try {
    const r = await fetch(`${import.meta.env.VITE_API_BASE ?? ''}/api/tts`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: clean, style }) });
    if (r.status === 503) ttsOff = true;
    if (!r.ok) return fallback();
    const buf = await ctx.decodeAudioData(await r.arrayBuffer());
    if (my !== gen) return;
    const src = ctx.createBufferSource(); src.buffer = buf; src.connect(ctx.destination);
    current = src; src.start();
  } catch { fallback(); }
}
