// Günlük check-in arayüzü: rutin görev listesi + puan/seri/rozet, reaksiyon testi, sesli günlük, hatırlatma.
// AI notu: Claude (Anthropic) yardımıyla yazılmıştır.
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useApp } from '../store';
import { useCheckin, TASKS, syncToday, doneToday, streak, totalXp, badges, type TaskId, type ReactionResult, type VoiceResult } from '../checkin';
import type { IndicatorId } from '../engine/types';
import { t } from '../i18n';
import { InfoTip } from './Info';

const TASK_IND: Partial<Record<TaskId, IndicatorId>> = { bp: 'systolic', glucose: 'glucose', sleep: 'sleepHours', mood: 'mood' };
const BADGE_ICON: Record<string, string> = { first: '◆', fullDay: '★', streak3: '▲', vigilant: '◎', voice: '◉' };

/* ---------------- Rutin paneli ---------------- */
export function RoutinePanel() {
  const lang = useApp((s) => s.lang);
  const readings = useApp((s) => s.readings);
  const ck = useCheckin();
  const [modal, setModal] = useState<'reaction' | 'voice' | null>(null);
  const done = doneToday(); // render: yalnızca okur
  useEffect(() => { syncToday(); }, [done.length, readings]); // kayıt: efektte
  const sk = streak(ck.days), xp = totalXp(ck.days);
  const act = (task: TaskId) => {
    if (TASK_IND[task]) useApp.getState().selectIndicator(TASK_IND[task]!);
    else if (task === 'reaction' || task === 'voice') setModal(task);
    else ck.toggleManual(task);
  };
  return (
    <div className="routine">
      <div className="r-head">
        <div className="r-prog"><b className="num">{done.length}/{TASKS.length}</b> {t('ck.today', lang)}
          <div className="g-bar"><div className="g-fill" style={{ width: `${(done.length / TASKS.length) * 100}%`, background: '#5ad1e6' }} /></div>
        </div>
        <span className="r-stat" title={t('ck.streakHint', lang)}>▲ <b className="num">{sk}</b> {t('ck.streak', lang)}</span>
        <span className="r-stat">✦ <b className="num">{xp}</b> XP</span>
        <span className="badges">{badges(ck).map((b) => <span key={b.id} className={`badge ${b.earned ? 'on' : ''}`} title={`${t(`badge.${b.id}`, lang)}${b.earned ? '' : ` (${t('ck.locked', lang)})`}`}>{BADGE_ICON[b.id]}</span>)}</span>
        <InfoTip k="routine" />
      </div>
      <div className="tasks">
        {TASKS.map((task) => {
          const ok = done.includes(task);
          return (
            <button key={task} className={`task ${ok ? 'ok' : ''}`} onClick={() => act(task)} aria-pressed={ok}>
              <span className="t-check">{ok ? '✓' : '○'}</span>
              <span className="t-name">{t(`task.${task}`, lang)}</span>
              {!ok && <span className="t-cta">{t(TASK_IND[task] ? 'ck.measure' : task === 'exercise' ? 'ck.mark' : 'ck.start', lang)}</span>}
            </button>
          );
        })}
      </div>
      {modal === 'reaction' && createPortal(<ReactionTest onClose={() => setModal(null)} />, document.body)}
      {modal === 'voice' && createPortal(<VoiceLog onClose={() => setModal(null)} />, document.body)}
    </div>
  );
}

/* ---------------- Reaksiyon süresi testi (PVT tarzı, kısaltılmış) ---------------- */
const TRIALS = 10;
export function ReactionTest({ onClose }: { onClose: () => void }) {
  const lang = useApp((s) => s.lang);
  const add = useCheckin((s) => s.addReaction);
  const prev = useCheckin((s) => s.reaction);
  const [phase, setPhase] = useState<'intro' | 'wait' | 'go' | 'done'>('intro');
  const [trial, setTrial] = useState(0);
  const [msg, setMsg] = useState('');
  const [res, setRes] = useState<ReactionResult | null>(null);
  const rts = useRef<number[]>([]), fs = useRef(0), t0 = useRef(0), timer = useRef<number | null>(null);

  const next = () => {
    setPhase('wait');
    timer.current = window.setTimeout(() => { t0.current = performance.now(); setPhase('go'); }, 1500 + Math.random() * 2500);
  };
  const finish = () => {
    const a = [...rts.current].sort((x, y) => x - y);
    const r: ReactionResult = { at: Date.now(), trials: a.length, rts: rts.current, falseStarts: fs.current,
      medianMs: Math.round(a[Math.floor(a.length / 2)] ?? 0), meanMs: Math.round(a.reduce((s, v) => s + v, 0) / Math.max(1, a.length)),
      lapses: a.filter((v) => v > 500).length };
    add(r); setRes(r); setPhase('done');
  };
  const press = () => {
    if (phase === 'intro' || phase === 'done') return;
    if (phase === 'wait') { if (timer.current) clearTimeout(timer.current); fs.current++; setMsg(t('rt.falseStart', lang)); next(); return; }
    const rt = performance.now() - t0.current; rts.current.push(rt); setMsg(`${Math.round(rt)} ms`);
    const n = trial + 1; setTrial(n);
    if (n >= TRIALS) finish(); else next();
  };
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.code === 'Space') { e.preventDefault(); e.stopPropagation(); press(); } if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', k, true);
    return () => { window.removeEventListener('keydown', k, true); if (timer.current) clearTimeout(timer.current); };
  });
  const base = prev.filter((p) => p !== res);
  const baseMed = base.length ? Math.round(base.map((p) => p.medianMs).sort((a, b) => a - b)[Math.floor(base.length / 2)]) : null;
  const flag = res && (res.lapses >= 2 || res.medianMs > 400 || (baseMed != null && res.medianMs > baseMed * 1.2));
  return (
    <div className="gate" role="dialog" aria-modal="true">
      <div className="cam-box">
        <header className="panel-h"><span>{t('task.reaction', lang)} <InfoTip k="reaction" /></span><button className="x" onClick={onClose} aria-label="close">×</button></header>
        {phase === 'intro' && (<>
          <p>{t('rt.intro', lang)}</p>
          <button className="primary big" onClick={() => { rts.current = []; fs.current = 0; setTrial(0); setMsg(''); next(); }}>{t('ck.start', lang)}</button>
        </>)}
        {(phase === 'wait' || phase === 'go') && (
          <button className={`rt-pad ${phase === 'go' ? 'go' : ''}`} onPointerDown={press}>
            {phase === 'go' ? t('rt.now', lang) : t('rt.wait', lang)}
            <small>{trial}/{TRIALS} · {msg}</small>
          </button>
        )}
        {phase === 'done' && res && (
          <div className="cam-res">
            <p className="num rt-stats">{t('rt.median', lang)} <b>{res.medianMs} ms</b> · {t('rt.lapses', lang)} <b>{res.lapses}</b> · {t('rt.falseStarts', lang)} <b>{res.falseStarts}</b></p>
            {baseMed != null && <p className="muted">{t('rt.baseline', lang)}: {baseMed} ms</p>}
            <p style={{ color: flag ? '#d4a72c' : undefined }}>{flag ? t('rt.flag', lang) : t('rt.ok', lang)}</p>
            <p className="ai-foot">{t('rt.disclaimer', lang)}</p>
            <button className="primary" onClick={onClose}>{t('ck.close', lang)}</button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------------- Sesli günlük ---------------- */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SR = any;
export function VoiceLog({ onClose }: { onClose: () => void }) {
  const lang = useApp((s) => s.lang);
  const add = useCheckin((s) => s.addVoice);
  const [state, setState] = useState<'idle' | 'rec' | 'busy' | 'done' | 'error'>('idle');
  const [text, setText] = useState('');
  const [secs, setSecs] = useState(0);
  const [res, setRes] = useState<VoiceResult | null>(null);
  const [err, setErr] = useState('');
  const rec = useRef<SR>(null), finalT = useRef(''), start = useRef(0), stream = useRef<MediaStream | null>(null);
  const frames = useRef({ voiced: 0, total: 0 }), raf = useRef(0), tick = useRef<number | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const SRClass: SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

  const begin = async () => {
    if (!SRClass) { setErr(t('jarvis.noSpeech', lang)); setState('error'); return; }
    setText(''); finalT.current = ''; frames.current = { voiced: 0, total: 0 };
    // Duraklama oranı: mikrofon RMS'i, ilk 0,5 sn'lik gürültü tabanının 2,5 katının altında kalan kareler "sessiz"
    try {
      stream.current = await navigator.mediaDevices.getUserMedia({ audio: true });
      const ac = new AudioContext(); const src = ac.createMediaStreamSource(stream.current); const an = ac.createAnalyser(); an.fftSize = 1024; src.connect(an);
      const buf = new Float32Array(an.fftSize); let floor = 0, n0 = 0; const t0 = performance.now();
      const loop = () => {
        an.getFloatTimeDomainData(buf); let s = 0; for (const v of buf) s += v * v; const rms = Math.sqrt(s / buf.length);
        if (performance.now() - t0 < 500) { floor += rms; n0++; } else { const thr = Math.max(0.01, (floor / Math.max(1, n0)) * 2.5); frames.current.total++; if (rms > thr) frames.current.voiced++; }
        raf.current = requestAnimationFrame(loop);
      };
      loop();
    } catch { /* mikrofon analizi yoksa duraklama oranı null kalır */ }
    const r = new SRClass(); r.lang = lang === 'tr' ? 'tr-TR' : 'en-US'; r.continuous = true; r.interimResults = true;
    r.onresult = (e: SR) => { let fin = '', inter = ''; for (let i = 0; i < e.results.length; i++) { if (e.results[i].isFinal) fin += e.results[i][0].transcript + ' '; else inter += e.results[i][0].transcript; } finalT.current = fin; setText(fin + inter); };
    r.onerror = (e: SR) => { if (e.error !== 'no-speech') { setErr(`${t('jarvis.micError', lang)} (${e.error})`); } };
    rec.current = r; r.start(); start.current = Date.now(); setState('rec'); setSecs(0);
    tick.current = window.setInterval(() => { const s = Math.round((Date.now() - start.current) / 1000); setSecs(s); if (s >= 60) stop(); }, 250);
  };
  const stop = () => {
    if (tick.current) { clearInterval(tick.current); tick.current = null; }
    cancelAnimationFrame(raf.current); stream.current?.getTracks().forEach((tr) => tr.stop());
    const r = rec.current; if (!r) return;
    r.onend = () => void analyze();
    r.stop(); rec.current = null;
  };
  const analyze = async () => {
    const transcript = (finalT.current || text).trim();
    const dur = Math.max(1, (Date.now() - start.current) / 1000);
    const words = transcript.split(/\s+/).filter(Boolean).length;
    const f = frames.current;
    const metrics = { durationSec: Math.round(dur), words, wordsPerMin: Math.round((words / dur) * 600) / 10, pauseRatio: f.total > 20 ? Math.round((1 - f.voiced / f.total) * 100) / 100 : null };
    if (words < 3) { setErr(t('vl.tooShort', lang)); setState('error'); return; }
    setState('busy');
    try {
      const rr = await fetch('/api/voicelog', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ lang, transcript, metrics }) });
      if (!rr.ok) throw new Error(`HTTP ${rr.status}`);
      const j = await rr.json();
      const v: VoiceResult = { at: Date.now(), transcript, metrics, ...j.result };
      add(v); setRes(v); setState('done');
    } catch { setErr(t('ai.offline', lang)); setState('error'); }
  };
  useEffect(() => () => { if (tick.current) clearInterval(tick.current); cancelAnimationFrame(raf.current); stream.current?.getTracks().forEach((tr) => tr.stop()); try { rec.current?.abort(); } catch { /* yok */ } }, []);
  const LV: Record<string, string> = { none: '#6e7681', low: '#5ad1e6', moderate: '#d4a72c', high: '#f0883e' };
  return (
    <div className="gate" role="dialog" aria-modal="true">
      <div className="cam-box">
        <header className="panel-h"><span>{t('task.voice', lang)} <InfoTip k="voice" /></span><button className="x" onClick={onClose} aria-label="close">×</button></header>
        <p className="vl-prompt">“{t('vl.prompt', lang)}”</p>
        <p className="muted small">{t('vl.privacy', lang)}</p>
        {state === 'idle' && <button className="primary big" onClick={begin}>◉ {t('vl.record', lang)}</button>}
        {state === 'rec' && (<>
          <button className="ptt on big" onClick={stop}><span className="ptt-dot" /> {t('vl.stop', lang)} · {secs}s / 60s</button>
          <p className="j-user">{text || '…'}</p>
        </>)}
        {state === 'busy' && <p className="ai-busy">{t('ai.thinking', lang)}</p>}
        {state === 'error' && <><p className="j-err">{err}</p><button onClick={() => { setErr(''); setState('idle'); }}>{t('cam.retake', lang)}</button></>}
        {state === 'done' && res && (
          <div className="cam-res">
            <p className="num small">{t('vl.metrics', lang)}: {res.metrics.durationSec}s · {res.metrics.words} {t('vl.words', lang)} · {res.metrics.wordsPerMin} {t('vl.wpm', lang)}{res.metrics.pauseRatio != null ? ` · ${t('vl.pause', lang)} %${Math.round(res.metrics.pauseRatio * 100)}` : ''}</p>
            <p><span className="ai-tag">✦ AI · Claude Sonnet 5.5</span> {res.summary}</p>
            <ul className="cues">{res.cues.map((c, i) => (
              <li key={i}><span className="lv" style={{ color: LV[c.level], borderColor: LV[c.level] }}>{t(`vl.${c.domain}`, lang)} · {t(`lv.${c.level}`, lang)}</span>{c.evidence && <q>{c.evidence}</q>}</li>
            ))}</ul>
            <p><b>{t('vl.followUp', lang)}:</b> {res.followUp}</p>
            <p className="ai-foot">{t('vl.disclaimer', lang)}</p>
            <button className="primary" onClick={onClose}>{t('ck.close', lang)}</button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------------- Rutin hatırlatma (kritik olmayan bildirim, 6 sn) ---------------- */
export function RoutineReminder() {
  const { lang, sessionStarted } = useApp();
  const [msg, setMsg] = useState('');
  useEffect(() => {
    if (!sessionStarted) return;
    const fire = () => {
      const { done } = syncToday();
      const pending = TASKS.filter((x) => !done.includes(x));
      if (!pending.length) return;
      setMsg(`${t('ck.reminder', lang)}: ${t(`task.${pending[0]}`, lang)}${pending.length > 1 ? ` (+${pending.length - 1})` : ''}`);
      window.setTimeout(() => setMsg(''), 6000);
    };
    const first = window.setTimeout(fire, 20000);
    const every = window.setInterval(fire, 180000);
    return () => { clearTimeout(first); clearInterval(every); };
  }, [sessionStarted, lang]);
  if (!msg) return null;
  return <div className="toast" role="status">◷ {msg}</div>;
}
