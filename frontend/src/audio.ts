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
export function stopVoice() { gen++; chain = Promise.resolve(); try { current?.stop(); } catch { /* yok */ } current = null; live.forEach((x) => { try { x.stop(); } catch { /* yok */ } }); live = []; stopSpeaking(); }
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
interface VoiceStream { pcm: Float32Array[]; done: boolean; buffer: AudioBuffer | null; notify: (() => void) | null; }
const API_BASE = import.meta.env.VITE_API_BASE ?? '';
let live: AudioBufferSourceNode[] = [];
/** Sesi HEMEN istemeye başlar: önce akışlı Gemini (ham PCM), olmazsa /api/tts (Azure vb.), o da olmazsa boş (tarayıcı sesi) */
function openVoice(text: string, lang: 'tr' | 'en', style: string): VoiceStream {
  const vs: VoiceStream = { pcm: [], done: false, buffer: null, notify: null };
  const ping = () => { const n = vs.notify; vs.notify = null; n?.(); };
  (async () => {
    try {
      if (ttsOff || !ctx) return;
      const r = await fetch(`${API_BASE}/api/tts_stream`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text, lang, style }) });
      if (r.ok && r.body) {
        const rd = r.body.getReader();
        let carry: Uint8Array | null = null;
        for (;;) {
          const { value, done } = await rd.read();
          if (done) break;
          let bytes = value;
          if (carry) { const m = new Uint8Array(carry.length + bytes.length); m.set(carry); m.set(bytes, carry.length); bytes = m; carry = null; }
          const even = bytes.length & ~1;
          if (even < bytes.length) carry = bytes.slice(even);
          const dv = new DataView(bytes.buffer, bytes.byteOffset, even);
          const f = new Float32Array(even / 2);
          for (let k = 0; k < f.length; k++) f[k] = dv.getInt16(k * 2, true) / 32768;
          if (f.length) { vs.pcm.push(f); ping(); }
        }
      } else {
        const b = await fetchVoice(text, lang, style); // yedek: tam dosya (Azure / Gemini)
        if (b) vs.buffer = b;
      }
    } catch { /* tarayıcı sesine düşülür */ } finally { vs.done = true; ping(); }
  })();
  return vs;
}
async function playVoice(vs: VoiceStream, my: number, text: string, lang: 'tr' | 'en') {
  let i = 0, at = 0;
  for (;;) {
    if (my !== gen) return;
    if (i < vs.pcm.length) {
      const f = vs.pcm[i++];
      const b = ctx!.createBuffer(1, f.length, 24000); b.copyToChannel(f as Float32Array<ArrayBuffer>, 0);
      const src = ctx!.createBufferSource(); src.buffer = b; src.connect(ctx!.destination);
      at = Math.max(at, ctx!.currentTime + 0.12); src.start(at); at += b.duration; live.push(src);
      continue;
    }
    if (vs.done) break;
    await new Promise<void>((res) => { vs.notify = res; });
  }
  if (my !== gen) return;
  if (i === 0) { if (vs.buffer) await play(vs.buffer); else await browserSay(text, lang); return; }
  const remain = at - ctx!.currentTime;
  if (remain > 0) await new Promise((r) => setTimeout(r, remain * 1000));
  live = [];
}
/** Bir cümleyi/cevabı sıraya ekle: ses isteği HEMEN başlar (akışlı), çalma sırayla */
export function speakSentence(text: string, lang: 'tr' | 'en', style: 'calm' | 'urgent' = 'calm'): Promise<void> {
  const clean = text.replace(/[*_#`>]/g, '').trim();
  if (!clean) return Promise.resolve();
  const my = gen;
  const vs = openVoice(clean, lang, style);
  chain = chain.then(() => playVoice(vs, my, clean, lang));
  return chain;
}
/** Önbelleği ısıt (alarm anonsları): sesi üretip disk önbelleğine yazdırır, çalmaz */
export async function prewarmVoice(texts: string[], lang: 'tr' | 'en', style: 'calm' | 'urgent' = 'urgent') {
  for (const text of texts) {
    try { const r = await fetch(`${API_BASE}/api/tts_stream`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text, lang, style }) }); if (r.status === 503) return; await r.arrayBuffer(); } catch { return; }
  }
}
