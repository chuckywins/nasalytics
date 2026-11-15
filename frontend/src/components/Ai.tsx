// AI bileşenleri: AI değerlendirme kartı, kritik alarm bandı, oturum kapısı, aktivite seçici, VEGA bas-konuş.
// AI notu: Claude (Anthropic) yardımıyla yazılmıştır.
import { useEffect, useRef, useState } from 'react';
import { INDICATORS, INDICATOR_ORDER } from '../engine/indicators';
import { adviceFor } from '../engine/guidance';
import type { Activity, Escalation, IndicatorId } from '../engine/types';
import { useApp, activeAlerts, stableStatus, evalLatest } from '../store';
import { askVega, maxEsc } from '../ai';
import { grabCameraFrame } from './FatigueCam';
import { useFatigue } from '../fatigue';
import { startAlarm, stopAlarm, unlockAudio, speakSentence, stopVoice, beginReply, prewarmVoice } from '../audio';
import { t } from '../i18n';
import { useScenario, allCaptions } from '../scenario';
import { reportSymptom } from '../symptoms';
import { VegaWave, waveBump } from './VegaWave';
import { useExModal } from './ExercisePlan';
import { startMicMeter, stopMicMeter } from '../audio';
import { useTelemetry } from '../telemetry';

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
      {ai.status === 'error' && <p className="muted">{t(ai.error === 'LOS' ? 'los.aiOff' : 'ai.offline', lang)}</p>}
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
        <button className="primary big" onClick={() => { unlockAudio(); useTelemetry.getState().setRole('astronaut'); startSession(); }}>{t('gate.asAstronaut', lang)}</button>
        <div className="gate-roles">
          <button onClick={() => { unlockAudio(); useTelemetry.getState().setRole('cmo'); startSession(); }}>{t('gate.asCmo', lang)}</button>
          <button onClick={() => { unlockAudio(); useTelemetry.getState().setRole('ground'); startSession(); }}>{t('gate.asGround', lang)}</button>
        </div>
        <p className="muted small">{t('gate.roleHint', lang)}</p>
        <button className="lang" onClick={() => setLang(lang === 'tr' ? 'en' : 'tr')}>{lang === 'tr' ? 'English' : 'Türkçe'}</button>
        <p className="muted small">{t('app.disclaimer', lang)}</p>
      </div>
    </div>
  );
}

/* ---------------- Kritik alarm: ses + konuşma + onay ---------------- */
/** Alarm anonsu: değer içermez (ekranda) → metin sabit, sesi disk önbelleğinden anında çalar */
const alarmPhrase = (id: IndicatorId, lang: 'tr' | 'en') => `${t('alarm.critical', lang)}. ${t(`ind.${id}`, lang)}. ${adviceFor(id, 'critical').action[lang].split('.')[0]}.`;
let prewarmed = '';
const radPhrase = (lang: 'tr' | 'en') => `${t('alarm.critical', lang)}. ${t('alarm.radiation', lang)}. ${t('alarm.radAction', lang)}.`;
const suitPhrase = (lang: 'tr' | 'en') => `${t('alarm.critical', lang)}. ${t('alarm.suitCO2', lang)}. ${t('alarm.suitAction', lang)}.`;
const extraPhrase = (id: string, lang: 'tr' | 'en') => (id === 'suitCO2' ? suitPhrase(lang) : radPhrase(lang));

const NO_RESP_S = 60; // varsayım
export function AlarmBanner() {
  const { readings, acked, ack, lang, sessionStarted } = useApp();
  // Mandallı alarm: son 30 sn'de kritik okuma varsa alarm sürer (eşikte salınan değer alarmı aç-kapa yapmaz, tekrar konuşmaz)
  const crit = INDICATOR_ORDER.filter((id) => stableStatus(readings, id) === 'critical')
    .map((id) => ({ id, ...evalLatest(readings, id), labelKey: evalLatest(readings, id).status === 'critical' ? evalLatest(readings, id).labelKey : 'alarm.recent' }));
  const unacked = crit.filter((a) => !acked.includes(a.id));
  const extra = useScenario((s) => s.extra);
  const ackedExtra = useScenario((s) => s.ackedExtra);
  const xcrit = extra.filter((x) => x.status === 'critical' && !ackedExtra.includes(x.id));
  const key = [...unacked.map((a) => a.id), ...xcrit.map((x) => x.id)].join(',');
  const spokenFor = useRef('');
  // Yanıtsız alarm: onaylanmayan kritik alarm NO_RESP_S sn sürerse CMO ve mürettebata otomatik bildirim (bir kez / alarm kümesi).
  // Süre bizim VARSAYIMIMIZ (NASA'dan alınmış bir değer değil). Demo senaryosu sürerken duraklatılır.
  const role = useTelemetry((s) => s.role);
  const scenOn = useScenario((s) => !!s.id);
  const firstAt = useRef<{ key: string; at: number; sent: boolean } | null>(null);
  // Oturum başında tüm alarm anonslarının sesini önceden üret (bir kez; sonrası disk önbelleği)
  useEffect(() => {
    if (!sessionStarted || prewarmed === lang || location.search.includes('test')) return; // otomatik testler kota harcamasın
    prewarmed = lang;
    void prewarmVoice([...INDICATOR_ORDER.map((id) => alarmPhrase(id, lang)), radPhrase(lang), suitPhrase(lang)], lang, 'urgent').then(() => prewarmVoice([t('vega.symptomSpoken', lang), ...allCaptions(lang)], lang, 'calm'));
  }, [sessionStarted, lang]);
  useEffect(() => {
    if (!sessionStarted) return;
    if (unacked.length > 0 || xcrit.length > 0) {
      startAlarm();
      if (spokenFor.current !== key) {
        spokenFor.current = key;
        if (!useScenario.getState().id) beginReply(); // senaryo anlatımı kesilmez; alarm anonsu sıraya girer
        speakSentence(xcrit.length ? extraPhrase(xcrit[0].id, lang) : alarmPhrase(unacked[0].id, lang), lang, 'urgent');
      }
    } else { stopAlarm(); spokenFor.current = ''; }
  }, [key, sessionStarted, lang]); // eslint-disable-line react-hooks/exhaustive-deps
  // Kritikten çıkan göstergelerin onayını sıfırla (yeniden kritik olursa yine çalsın)
  useEffect(() => {
    const st = useApp.getState();
    const critIds = crit.map((a) => a.id);
    if (st.acked.some((id) => !critIds.includes(id))) useApp.setState({ acked: st.acked.filter((id) => critIds.includes(id)) });
  });
  const watch = role === 'astronaut' && sessionStarted && !scenOn && key !== '';
  if (!watch) firstAt.current = null;
  else if (!firstAt.current || firstAt.current.key !== key) firstAt.current = { key, at: Date.now(), sent: false };
  const left = firstAt.current ? Math.max(0, NO_RESP_S - Math.floor((Date.now() - firstAt.current.at) / 1000)) : null;
  useEffect(() => {
    const f = firstAt.current;
    if (!f || f.sent || left !== 0) return;
    f.sent = true;
    const what = [...xcrit.map((x) => x.title[lang]), ...unacked.map((a) => t(`ind.${a.id}`, lang))].join(', ');
    reportSymptom('unwell', `${t('noresp.quote', lang)} (${what}, ${NO_RESP_S} ${t('noresp.sec', lang)})`, 'system');
  });
  if (unacked.length === 0 && xcrit.length === 0) return null;
  return (
    <div className="alarm" role="alert">
      <span className="alarm-icon">✖</span>
      <div className="alarm-txt">
        <b>{t('alarm.critical', lang)}</b>
        {xcrit.map((x) => <span key={x.id}>{x.title[lang]}: <b className="num">{x.value}</b> · {x.label[lang]}</span>)}
        {unacked.slice(0, 3).map((a) => <span key={a.id}>{t(`ind.${a.id}`, lang)}: <b className="num">{a.reading.value.toFixed(INDICATORS[a.id].decimals)} {INDICATORS[a.id].unit}</b> · {t(a.labelKey, lang)}</span>)}
        {unacked.length > 3 && <span className="muted">+{unacked.length - 3} {t('alarm.more', lang)}</span>}
        {left != null && <span className="noresp small">{left > 0 ? `${t('noresp.count', lang)} ${left} ${t('noresp.sec', lang)}` : `✓ ${t('noresp.sent', lang)}`} <span className="muted">({t('noresp.assume', lang)})</span></span>}
      </div>
      <button className="ack" onClick={() => { ack(unacked.map((a) => a.id) as IndicatorId[]); useScenario.setState((s) => ({ ackedExtra: [...s.ackedExtra, ...xcrit.map((x) => x.id)] })); stopAlarm(); stopVoice(); }}>{t('alarm.ack', lang)}</button>
    </div>
  );
}

/* ---------------- Aktivite seçici ---------------- */
export function ActivitySelect() {
  const { activity, setActivity, lang } = useApp();
  return (
    <div className="tb-item"><span>{t('ui.activity', lang)}</span>
      <div className="seg small" role="group">
        {(['rest', 'exercise', 'eva'] as Activity[]).map((a) => <button key={a} aria-pressed={activity === a} className={activity === a ? 'on' : ''} onClick={() => { setActivity(a); if (a === 'exercise') useExModal.getState().show('moves'); }}>{t(`act.${a}`, lang)}</button>)}
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
  const interimRef = useRef('');
  interimRef.current = interim;
  const [reply, setReply] = useState('');
  const [busy, setBusy] = useState(false);
  const [text, setText] = useState('');
  const [err, setErr] = useState('');
  const [withCam, setWithCam] = useState(false);
  const [sentFrame, setSentFrame] = useState(false);
  const [applied, setApplied] = useState<string[]>([]);
  const [sym, setSym] = useState('');
  const camOn = useFatigue((s) => s.enabled);
  const hist = useRef<Msg[]>([]);
  const rec = useRef<SR>(null);
  const finalText = useRef('');
  const abort = useRef<AbortController | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const SRClass: SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

  const send = async (q: string) => {
    if (!q.trim()) return;
    abort.current?.abort(); beginReply();
    const c = new AbortController(); abort.current = c;
    setBusy(true); setReply(''); setErr(''); setApplied([]); setSym('');
    try {
      const frame = withCam && camOn ? grabCameraFrame() : null;
      setSentFrame(!!frame);
      const done: string[] = [];
      let notified = false;
      const full = await askVega(q, hist.current, setReply, () => undefined, c.signal, frame, (a) => {
        // Sesli komutla değer girişi: kimlik ve fizyolojik aralık burada doğrulanır, kural motoru hemen değerlendirir
        const id = a.indicator as IndicatorId;
        const d = INDICATORS[id];
        if (!d || typeof a.value !== 'number' || a.value < d.sim.min || a.value > d.sim.max) { setErr(t('vega.badValue', lang)); return; }
        useApp.getState().addReading(id, a.value, id === 'glucose' ? a.glucose_context : undefined, 'USER_INPUT');
        done.push(`${t(`ind.${id}`, lang)} ${a.value.toFixed(d.decimals)} ${d.unit}`);
        setApplied([...done]);
      }, (x) => {
        // Belirti bildirimi: kayıt deterministik (model "bildirdim" demez); onay cümlesi sabit ve önbellekli
        if (notified) return; notified = true;
        reportSymptom(x.category, x.quote || q, 'vega');
        setSym(x.quote || q);
      });
      if (!c.signal.aborted && full.trim()) speakSentence(full, lang);
      if (!c.signal.aborted && notified) speakSentence(t('vega.symptomSpoken', lang), lang);
      // Değer kaydedildiyse VEGA konuşmaz (analizi AI değerlendirme kartı yapar); geçmişe kısa not düşülür
      hist.current = [...hist.current, { role: 'user' as const, content: q }, { role: 'assistant' as const, content: full || `[recorded: ${done.join(', ')}]` }].slice(-8);
    } catch (e) {
      if ((e as Error).name !== 'AbortError') setErr(t((e as Error).message === 'LOS' ? 'los.vega' : 'ai.offline', lang));
    } finally { setBusy(false); }
  };

  const autoOff = useRef<number | null>(null);
  const coarse = typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches;
  const start = () => {
    if (!SRClass) { setErr(t('vega.noSpeech', lang)); return; }
    if (rec.current) return;
    stopVoice();
    const r = new SRClass();
    r.lang = lang === 'tr' ? 'tr-TR' : 'en-US'; r.interimResults = true; r.continuous = true;
    finalText.current = '';
    r.onresult = (e: SR) => {
      let fin = '', inter = '';
      for (let i = 0; i < e.results.length; i++) { if (e.results[i].isFinal) fin += e.results[i][0].transcript; else inter += e.results[i][0].transcript; }
      finalText.current = fin; setInterim(fin + inter); waveBump();
    };
    r.onspeechstart = () => waveBump();
    r.onerror = (e: SR) => { if (e.error !== 'no-speech' && e.error !== 'aborted') setErr(`${t('vega.micError', lang)} (${e.error})`); };
    // Dinleme bittiğinde (ikinci dokunuş, Boşluk bırakıldı ya da tarayıcı sessizlikte kendisi kapattı) elde ne varsa gönderilir
    r.onend = () => {
      rec.current = null; setListening(false); stopMicMeter();
      if (autoOff.current) { clearTimeout(autoOff.current); autoOff.current = null; }
      const q = (finalText.current || interimRef.current).trim();
      if (q) void send(q);
    };
    rec.current = r; r.start(); setListening(true); setInterim(''); setErr('');
    if (!coarse) void startMicMeter(); // masaüstü: gerçek ses seviyesi; telefonda tanımayla çakışmasın
    autoOff.current = window.setTimeout(() => stop(), 30000); // unutulursa 30 sn sonra kendiliğinden gönderir
  };
  const stop = () => { const r = rec.current; if (!r) return; try { r.stop(); } catch { /* yok */ } };
  const toggle = () => (rec.current ? stop() : start());
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
      <VegaWave listening={listening} />
      <button className={`ptt ${listening ? 'on' : ''}`} onClick={toggle} onContextMenu={(e) => e.preventDefault()} aria-pressed={listening} title={t('vega.hint', lang)}>
        <span className="ptt-dot" />{listening ? t('vega.listening', lang) : 'VEGA'}
      </button>
      <div className="j-text">
        {listening || interim ? <p className="j-user">“{interim || '…'}”</p> : null}
        {busy && !reply && <p className="muted">{t('ai.thinking', lang)}</p>}
        {reply && <p className="j-reply"><span className="ai-tag">✦ AI{sentFrame ? ' · ◉' : ''}</span> {reply}</p>}
        {sym && <p className="j-applied">🔔 {t('vega.symptomSent', lang)}: “{sym}”</p>}
        {applied.length > 0 && <p className="j-applied">✓ {t('vega.recorded', lang)}: {applied.join(' · ')} <span className="muted">({t('vega.byVoice', lang)})</span></p>}
        {err && <p className="j-err">{err}</p>}
        {!listening && !interim && !reply && !busy && !err && <p className="muted">{t('vega.hint', lang)}</p>}
      </div>
      <button type="button" className={`camshare ${withCam && camOn ? 'on' : ''}`} disabled={!camOn} aria-pressed={withCam && camOn} onClick={() => setWithCam(!withCam)} title={t('vega.camHint', lang)}>◉ {t('vega.cam', lang)}</button>
      <form onSubmit={(e) => { e.preventDefault(); void send(text); setInterim(text); setText(''); }}>
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder={t('vega.type', lang)} aria-label={t('vega.type', lang)} />
      </form>
    </div>
  );
}

