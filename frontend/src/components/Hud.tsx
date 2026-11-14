// HUD kabuğu parçaları: panel çerçevesi, üst bar, yaşamsal bulgular, EKG, ölçüm girişi.
// Tasarım: docs/design_system.md (v2, kullanıcının HUD tercihi + 4 değişmez kural). AI notu: Claude (Anthropic) yardımıyla yazılmıştır.
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { INDICATORS, VITAL_ROWS, worst, type VitalRow } from '../engine/indicators';
import type { GlucoseCtx, IndicatorId, Provenance, Status } from '../engine/types';
import { useScenario } from '../scenario';
import { ENVS, ENV_LABEL, ENV_ORDER, equivUSvH, cumulativeMSv, type EnvId } from '../engine/environment';
import { useApp, evalLatest, latest } from '../store';
import { t } from '../i18n';
import { ActivitySelect } from './Ai';
import { InfoTip } from './Info';

export const STATUS_COLOR: Record<Status, string> = {
  ok: '#3fb950', watch: '#d4a72c', warn: '#f0883e', critical: '#f85149', unknown: '#6e7681',
};
export const STATUS_GLYPH: Record<Status, string> = { ok: '●', watch: '▲', warn: '◆', critical: '✖', unknown: '○' };

export function Panel({ title, right, children, className = '' }: { title: string; right?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`panel ${className}`}>
      <header className="panel-h"><span>{title}</span>{right}</header>
      <div className="panel-b">{children}</div>
    </section>
  );
}

export function ProvTag({ p, compact = false }: { p: Provenance; compact?: boolean }) {
  const lang = useApp((s) => s.lang);
  return <span className={`prov prov-${p} ${compact ? 'compact' : ''}`} title={t(`prov.${p}`, lang)} aria-label={t(`prov.${p}`, lang)}>{compact ? '' : t(`prov.${p}`, lang)}</span>;
}

export function StatusChip({ s, label }: { s: Status; label: string }) {
  return <span className="schip" style={{ color: STATUS_COLOR[s], borderColor: STATUS_COLOR[s] }}><b>{STATUS_GLYPH[s]}</b> {label}</span>;
}

const ago = (ms: number, lang: 'tr' | 'en') => {
  const m = Math.round(ms / 60000);
  if (m < 1) return t('ui.now', lang);
  return m < 60 ? `${m} ${t('ui.min', lang)} ${t('ui.ago', lang)}` : `${Math.round(m / 60)} ${t('ui.hour', lang)} ${t('ui.ago', lang)}`;
};

/* ---------------- Üst bar ---------------- */
export function TopBar() {
  const { lang, setLang, env, setEnv, missionDay } = useApp();
  const e = ENVS[env];
  const h = equivUSvH(e);
  const cum = cumulativeMSv(e, missionDay);
  // Gerçek veri tekrarı sürerken üst bar tekrarın o anki değerini gösterir (çelişki olmasın)
  const replay = useScenario((s) => s.replay);
  const rp = replay?.series[replay.idx]; const rpBase = replay?.baseline ?? 1;
  const [d0, d1] = e.commDelayOneWaySec;
  const fmtDelay = (s: number) => (s < 60 ? `${s.toFixed(1)} s` : `${Math.round(s / 60)} min`);
  return (
    <header className="topbar">
      <div className="brand"><span className="logo">◎</span><div><b>{t('app.title', lang)}</b><small>{t('app.subtitle', lang)}</small></div></div>
      <label className="tb-item"><span>{t('ui.env', lang)}</span>
        <select value={env} onChange={(ev) => setEnv(ev.target.value as EnvId)}>
          {ENV_ORDER.map((id) => <option key={id} value={id}>{ENV_LABEL[id][lang]}</option>)}
        </select>
      </label>
      <ActivitySelect />
      <div className="tb-item"><span>{t('ui.day', lang)}</span><b className="num">{missionDay}</b></div>
      <div className="tb-item"><span>{t('ui.delay', lang)} ({t('ui.oneWay', lang)})</span><b className="num">{d0 === d1 ? fmtDelay(d0) : `${fmtDelay(d0)}–${fmtDelay(d1)}`}</b></div>
      <div className="tb-item"><span>{t('ui.doseRate', lang)} <InfoTip k="doseRate" /></span>
        {rp ? <b className="num" style={{ color: rp.v / rpBase >= 10 ? STATUS_COLOR.critical : rp.v / rpBase >= 3 ? STATUS_COLOR.warn : undefined }}>{rp.v.toFixed(1)} µGy/h <small>({t('scen.replay', lang)})</small></b>
          : <b className="num">{e.absorbedUGyH != null ? `${e.absorbedUGyH.toFixed(1)} µGy/h` : t('ui.noData', lang)}</b>}
        {e.absorbedUGyH != null && <ProvTag p="NASA_MEASUREMENT" />}
      </div>
      <div className="tb-item"><span>{t('ui.cumDose', lang)} <InfoTip k="cumDose" /></span>
        <b className="num">{cum != null ? `≈${cum.toFixed(0)} mSv` : t('ui.noData', lang)}</b>
        {cum != null && <ProvTag p={h.basis === 'measured' ? 'PROJECTION' : 'PUBLISHED'} />}
      </div>
      <div className="tb-spacer" />
      <span className="role">{t('ui.role', lang)} · C-01</span>
      <span className="disc">{t('app.disclaimer', lang)}</span>
      <button className="lang" onClick={() => setLang(lang === 'tr' ? 'en' : 'tr')}>{lang === 'tr' ? 'EN' : 'TR'}</button>
    </header>
  );
}

/* ---------------- Yaşamsal bulgular ---------------- */
function rowEval(row: VitalRow, readings: ReturnType<typeof useApp.getState>['readings']) {
  if (row === 'bp') {
    const s = evalLatest(readings, 'systolic'), d = evalLatest(readings, 'diastolic');
    const status = worst(s.status, d.status);
    return { id: 'systolic' as IndicatorId, value: `${s.reading.value.toFixed(0)}/${d.reading.value.toFixed(0)}`, unit: 'mmHg', status, labelKey: s.status === status ? s.labelKey : d.labelKey, reading: s.reading };
  }
  const e = evalLatest(readings, row);
  return { id: row as IndicatorId, value: e.reading.value.toFixed(INDICATORS[row].decimals), unit: INDICATORS[row].unit, status: e.status, labelKey: e.labelKey, reading: e.reading };
}

export function VitalsPanel() {
  const { readings, lang, selectedIndicator, selectIndicator } = useApp();
  const [, force] = useState(0);
  useEffect(() => { const i = setInterval(() => force((x) => x + 1), 30000); return () => clearInterval(i); }, []);
  return (
    <Panel title={t('ui.vitals', lang)} right={<span className="live">● {t('ui.live', lang)}</span>}>
      <div className="vitals">
        {VITAL_ROWS.map((row) => {
          const r = rowEval(row, readings);
          const sel = r.id === selectedIndicator || (row === 'bp' && selectedIndicator === 'diastolic');
          const spot = INDICATORS[r.id].mode === 'spot';
          return (
            <div key={row} role="button" tabIndex={0} className={`vrow ${sel ? 'sel' : ''}`} style={{ borderLeftColor: STATUS_COLOR[r.status] }} onClick={() => selectIndicator(r.id)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selectIndicator(r.id); } }} aria-pressed={sel}>
              <span className="vname"><b className="vglyph" style={{ color: STATUS_COLOR[r.status] }} aria-label={t(r.labelKey, lang)}>{STATUS_GLYPH[r.status]}</b>{t(row === 'bp' ? 'ind.bp' : `ind.${row}`, lang)}
                <small>{spot ? ago(Date.now() - r.reading.t, lang) : t('ui.live', lang)}{r.reading.ctx ? ` · ${t(`ui.${r.reading.ctx}`, lang)}` : ''}</small>
              </span>
              <span className="vval num">{r.value}<small>{r.unit}</small></span>
              <span className="vstat" style={{ color: STATUS_COLOR[r.status] }} title={t(r.labelKey, lang)}>{STATUS_GLYPH[r.status]} {t(r.labelKey, lang)}</span>
              <span className="vtags"><InfoTip k={row} /><ProvTag p={r.reading.provenance} compact /></span>
            </div>
          );
        })}
      </div>
    </Panel>
  );
}

/* ---------------- EKG şeridi (sentetik, nabza bağlı) ---------------- */
// Basit PQRST şablonu (faz 0..1 → genlik). Tanısal değildir; SİMÜLE etiketlidir.
function pqrst(p: number) {
  const g = (mu: number, s: number, a: number) => a * Math.exp(-((p - mu) ** 2) / (2 * s * s));
  return g(0.18, 0.025, 0.12) + g(0.36, 0.008, -0.12) + g(0.39, 0.012, 1.0) + g(0.42, 0.01, -0.25) + g(0.66, 0.045, 0.28);
}
export function EcgStrip() {
  const lang = useApp((s) => s.lang);
  const ref = useRef<HTMLCanvasElement>(null);
  const hrRef = useRef(70);
  const hr = latest(useApp((s) => s.readings.heartRate)).value;
  hrRef.current = hr;
  useEffect(() => {
    const c = ref.current!; const ctx = c.getContext('2d')!;
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    let raf = 0, x = 0, phase = 0, last = performance.now(), prevY = 0;
    const W = () => c.width, H = () => c.height;
    const resize = () => { c.width = c.clientWidth * devicePixelRatio; c.height = c.clientHeight * devicePixelRatio; ctx.fillStyle = '#060a10'; ctx.fillRect(0, 0, W(), H()); };
    resize();
    const ro = new ResizeObserver(() => { resize(); x = 0; prevY = 0; });
    ro.observe(c);
    const pxPerSec = () => W() / 4; // 4 saniyelik pencere
    const step = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      const n = Math.max(1, Math.round(pxPerSec() * dt));
      for (let i = 0; i < n; i++) {
        phase += (hrRef.current / 60) / pxPerSec();
        if (phase >= 1) phase -= 1;
        const y = H() * 0.62 - pqrst(phase) * H() * 0.5;
        ctx.fillStyle = '#060a10'; ctx.fillRect(x, 0, 6 * devicePixelRatio, H());
        ctx.strokeStyle = '#5ad1e6'; ctx.lineWidth = 1.6 * devicePixelRatio;
        ctx.beginPath(); ctx.moveTo(x - 1, prevY || y); ctx.lineTo(x, y); ctx.stroke();
        prevY = y; x += 1; if (x >= W()) { x = 0; prevY = 0; }
      }
      raf = requestAnimationFrame(step);
    };
    if (!reduced) raf = requestAnimationFrame(step);
    else { for (let i = 0; i < W(); i++) { const ph = (i / pxPerSec()) * (hrRef.current / 60) % 1; const y = H() * 0.62 - pqrst(ph) * H() * 0.5; ctx.fillStyle = '#5ad1e6'; ctx.fillRect(i, y, 1, 1.5); } }
    return () => { cancelAnimationFrame(raf); ro.disconnect(); };
  }, []);
  return (
    <Panel title={t('ui.ecg', lang)} right={<><InfoTip k="ecg" /><span className="num ecg-hr">{hr.toFixed(0)} bpm</span><ProvTag p="SIMULATED" /></>} className="ecg">
      <canvas ref={ref} className="ecg-canvas" aria-label="ECG" />
    </Panel>
  );
}

/* ---------------- Ölçüm girişi ---------------- */
const ENTRY: IndicatorId[] = ['systolic', 'diastolic', 'glucose', 'bodyTemp', 'sleepHours', 'mood', 'heartRate', 'spo2'];
export function EntryForm() {
  const { lang, addReading, selectedIndicator } = useApp();
  const [id, setId] = useState<IndicatorId>('glucose');
  const [val, setVal] = useState('');
  const [ctx, setCtx] = useState<GlucoseCtx>('fasting');
  useEffect(() => { if (ENTRY.includes(selectedIndicator)) setId(selectedIndicator); }, [selectedIndicator]);
  const d = INDICATORS[id];
  const v = parseFloat(val.replace(',', '.'));
  const valid = Number.isFinite(v) && v >= d.sim.min && v <= d.sim.max;
  return (
    <Panel title={t('ui.enter', lang)}>
      <form className="entry" onSubmit={(e) => { e.preventDefault(); if (valid) { addReading(id, v, id === 'glucose' ? ctx : undefined); setVal(''); } }}>
        <select value={id} onChange={(e) => setId(e.target.value as IndicatorId)} aria-label={t('ui.enter', lang)}>
          {ENTRY.map((k) => <option key={k} value={k}>{t(`ind.${k}`, lang)} ({INDICATORS[k].unit})</option>)}
        </select>
        <input inputMode="decimal" value={val} onChange={(e) => setVal(e.target.value)} placeholder={`${d.sim.min}–${d.sim.max}`} aria-invalid={val !== '' && !valid} />
        {id === 'glucose' && (
          <div className="seg" role="group">
            {(['fasting', 'postprandial'] as GlucoseCtx[]).map((c) => <button type="button" key={c} aria-pressed={ctx === c} className={ctx === c ? 'on' : ''} onClick={() => setCtx(c)}>{t(`ui.${c}`, lang)}</button>)}
          </div>
        )}
        <button type="submit" className="primary" disabled={!valid}>{t('ui.save', lang)}</button>
      </form>
    </Panel>
  );
}
