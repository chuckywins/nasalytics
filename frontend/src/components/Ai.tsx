// AI bileşenleri: AI değerlendirme kartı, kritik alarm bandı, oturum kapısı, aktivite seçici, VEGA bas-konuş.
// AI notu: Claude (Anthropic) yardımıyla yazılmıştır.
import { useEffect, useRef, useState } from 'react';
import { INDICATORS } from '../engine/indicators';
import { adviceFor } from '../engine/guidance';
import type { Activity, Escalation, IndicatorId } from '../engine/types';
import { useApp, activeAlerts } from '../store';
import { askVega, maxEsc } from '../ai';
import { startAlarm, stopAlarm, speak, stopSpeaking, unlockAudio } from '../audio';
import { t } from '../i18n';

/* ---------------- AI değerlendirme kartı ---------------- */
export function AiCard() {
  const { ai, lang, readings } = useApp();
  const alerts = activeAlerts(readings);
  const ruleEsc = alerts.reduce<Escalation>((acc, a) => maxEsc(acc, adviceFor(a.id, a.status).escalate), 'self');
  const esc = maxEsc(ruleEsc, ai.data?.escalate);
  const age = ai.at ? Math.round((Date.now() - ai.at) / 1000) : null;
  return (
    <div className="aicard" aria-live="polite">
      <div className="ai-h">
        <span className="ai-tag">✦ AI · Claude {ai.model?.includes('sonnet') ? 'Sonnet 5.5' : ''}</span>
        {ai.status === 'loading' && <span className="ai-busy">{t('ai.thinking', lang)}</span>}
        {ai.status === 'ok' && <span className="muted">{age}s · {((ai.latencyMs ?? 0) / 1000).toFixed(1)}s</span>}
        {(ai.status === 'ok' || alerts.length > 0) && <span className={`esc esc-${esc}`}>{t(`esc.${esc}`, lang)}</span>}
      </div>
      {ai.status === 'error' && <p className="muted">{t('ai.offline', lang)}</p>}
      {ai.status === 'idle' && <p className="muted">{t('ai.waiting', lang)}</p>}
      {ai.data && (
        <>
          <p className="ai-head">{ai.data.headline}</p>
          <p className="ai-body">{ai.data.assessment}</p>
          {ai.data.actions?.length > 0 && <ol className="ai-actions">{ai.data.actions.slice(0, 3).map((a, i) => <li key={i}>{a}</li>)}</ol>}
          {ai.data.cues && ai.data.cues.length > 0 && <p className="ai-cues"><b>{t('ai.confirm', lang)}:</b> {ai.data.cues.join(' · ')}</p>}
          <p className="ai-foot">{t('ai.disclaimer', lang)}{ai.data.confidence ? ` · ${t('ai.confidence', lang)}: ${ai.data.confidence}` : ''}</p>
        </>
      )}
    </div>
  );
}

/* ---------------- Oturum kapısı: ses/konuşma izni için tek tıklama ---------------- */
export function SessionGate() {
  const { sessionStarted, startSession, lang, setLang } = useApp();
  if (sessionStarted) return null;
  return (
    <div className="gate" role="dialog" aria-modal="true">
      <div className="gate-box">
        <div className="logo-big">◎</div>
        <h2>{t('app.title', lang)}</h2>
        <p>{t('gate.text', lang)}</p>
        <button className="primary big" onClick={() => { unlockAudio(); startSession(); }}>{t('gate.start', lang)}</button>
        <button className="lang" onClick={() => setLang(lang === 'tr' ? 'en' : 'tr')}>{lang === 'tr' ? 'English' : 'Türkçe'}</button>
        <p className="muted small">{t('app.disclaimer', lang)}</p>
      </div>
    </div>
  );
}

/* ---------------- Kritik alarm: ses + konuşma + onay ---------------- */
export function AlarmBanner() {
  const { readings, acked, ack, lang, sessionStarted } = useApp();
  const crit = activeAlerts(readings).filter((a) => a.status === 'critical');
  const unacked = crit.filter((a) => !acked.includes(a.id));
  const key = unacked.map((a) => a.id).join(',');
  const spokenFor = useRef('');
  useEffect(() => {
    if (!sessionStarted) return;
    if (unacked.length > 0) {
      startAlarm();
      if (spokenFor.current !== key) {
        spokenFor.current = key;
        const a = unacked[0];
        speak(`${t('alarm.critical', lang)}. ${t(`ind.${a.id}`, lang)} ${a.reading.value.toFixed(INDICATORS[a.id].decimals)}. ${adviceFor(a.id, a.status).action[lang].split('.')[0]}.`, lang, { interrupt: true });
      }
    } else { stopAlarm(); spokenFor.current = ''; }
  }, [key, sessionStarted, lang]); // eslint-disable-line react-hooks/exhaustive-deps
  // Kritikten çıkan göstergelerin onayını sıfırla (yeniden kritik olursa yine çalsın)
  useEffect(() => {
    const st = useApp.getState();
    const critIds = crit.map((a) => a.id);
    if (st.acked.some((id) => !critIds.includes(id))) useApp.setState({ acked: st.acked.filter((id) => critIds.includes(id)) });
  });
  if (unacked.length === 0) return null;
  return (
    <div className="alarm" role="alert">
      <span className="alarm-icon">✖</span>
      <div className="alarm-txt">
        <b>{t('alarm.critical', lang)}</b>
        {unacked.slice(0, 3).map((a) => <span key={a.id}>{t(`ind.${a.id}`, lang)}: <b className="num">{a.reading.value.toFixed(INDICATORS[a.id].decimals)} {INDICATORS[a.id].unit}</b> · {t(a.labelKey, lang)}</span>)}
        {unacked.length > 3 && <span className="muted">+{unacked.length - 3} {t('alarm.more', lang)}</span>}
      </div>
      <button className="ack" onClick={() => { ack(unacked.map((a) => a.id) as IndicatorId[]); stopAlarm(); stopSpeaking(); }}>{t('alarm.ack', lang)}</button>
    </div>
  );
}

/* ---------------- Aktivite seçici ---------------- */
export function ActivitySelect() {
  const { activity, setActivity, lang } = useApp();
  return (
    <div className="tb-item"><span>{t('ui.activity', lang)}</span>
      <div className="seg small" role="group">
        {(['rest', 'exercise', 'eva'] as Activity[]).map((a) => <button key={a} aria-pressed={activity === a} className={activity === a ? 'on' : ''} onClick={() => setActivity(a)}>{t(`act.${a}`, lang)}</button>)}
      </div>
    </div>
  );
}

/* ---------------- VEGA: bas-konuş (Web Speech) + yazılı yedek ---------------- */
type Msg = { role: 'user' | 'assistant'; content: string };
// Web Speech API tipleri TS lib'de yok
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SR = any;
export function Vega() {
  const { lang } = useApp();
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState('');
  const [reply, setReply] = useState('');
  const [busy, setBusy] = useState(false);
  const [text, setText] = useState('');
  const [err, setErr] = useState('');
  const hist = useRef<Msg[]>([]);
  const rec = useRef<SR>(null);
  const finalText = useRef('');
  const abort = useRef<AbortController | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const SRClass: SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

  const send = async (q: string) => {
    if (!q.trim()) return;
    abort.current?.abort(); stopSpeaking();
    const c = new AbortController(); abort.current = c;
    setBusy(true); setReply(''); setErr('');
    try {
      const full = await askVega(q, hist.current, setReply, (s) => speak(s, lang), c.signal);
      hist.current = [...hist.current, { role: 'user' as const, content: q }, { role: 'assistant' as const, content: full }].slice(-8);
    } catch (e) {
      if ((e as Error).name !== 'AbortError') setErr(t('ai.offline', lang));
    } finally { setBusy(false); }
  };

  const start = () => {
    if (!SRClass) { setErr(t('vega.noSpeech', lang)); return; }
    stopSpeaking();
    const r = new SRClass();
    r.lang = lang === 'tr' ? 'tr-TR' : 'en-US'; r.interimResults = true; r.continuous = true;
    finalText.current = '';
    r.onresult = (e: SR) => {
      let fin = '', inter = '';
      for (let i = 0; i < e.results.length; i++) { if (e.results[i].isFinal) fin += e.results[i][0].transcript; else inter += e.results[i][0].transcript; }
      finalText.current = fin; setInterim(fin + inter);
    };
    r.onerror = (e: SR) => { setErr(`${t('vega.micError', lang)} (${e.error})`); setListening(false); };
    rec.current = r; r.start(); setListening(true); setInterim('');
  };
  const stop = () => {
    const r = rec.current; if (!r) return;
    r.onend = () => { const q = (finalText.current || interim).trim(); setListening(false); if (q) void send(q); };
    r.stop();
  };
  // Boşluk tuşu = bas-konuş (yazı alanındayken değil)
  useEffect(() => {
    const isField = (el: EventTarget | null) => el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement;
    const down = (e: KeyboardEvent) => { if (e.code === 'Space' && !e.repeat && !isField(e.target)) { e.preventDefault(); start(); } };
    const up = (e: KeyboardEvent) => { if (e.code === 'Space' && !isField(e.target)) { e.preventDefault(); stop(); } };
    window.addEventListener('keydown', down); window.addEventListener('keyup', up);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); };
  });

  return (
    <div className="vega">
      <button className={`ptt ${listening ? 'on' : ''}`} onPointerDown={start} onPointerUp={stop} onPointerLeave={() => listening && stop()} aria-pressed={listening} title={t('vega.hint', lang)}>
        <span className="ptt-dot" />{listening ? t('vega.listening', lang) : 'VEGA'}
      </button>
      <div className="j-text">
        {listening || interim ? <p className="j-user">“{interim || '…'}”</p> : null}
        {busy && !reply && <p className="muted">{t('ai.thinking', lang)}</p>}
        {reply && <p className="j-reply"><span className="ai-tag">✦ AI</span> {reply}</p>}
        {err && <p className="j-err">{err}</p>}
        {!listening && !interim && !reply && !busy && !err && <p className="muted">{t('vega.hint', lang)}</p>}
      </div>
      <form onSubmit={(e) => { e.preventDefault(); void send(text); setInterim(text); setText(''); }}>
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder={t('vega.type', lang)} aria-label={t('vega.type', lang)} />
      </form>
    </div>
  );
}

