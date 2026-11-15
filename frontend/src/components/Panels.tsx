// Sağ ve alt paneller: değerlendirme, bölge bilgisi, kabin, görev zaman çizelgesi, trend.
// AI notu: Claude (Anthropic) yardımıyla yazılmıştır.
import { AnimatePresence, motion } from 'motion/react';
import { SpaceWeather } from './Extras';
import { INDICATORS, statusRank } from '../engine/indicators';
import { REGIONS } from '../engine/regions';
import { adviceFor } from '../engine/guidance';
import { ENVS, MISSION_DAYS, boneLossPct, cumulativeMSv, equivUSvH } from '../engine/environment';
import type { IndicatorId, Status } from '../engine/types';
import { useApp, activeAlerts, evalLatest, latest } from '../store';
import { t } from '../i18n';
import { Panel, ProvTag, StatusChip, STATUS_COLOR, STATUS_GLYPH } from './Hud';
import { AiCard } from './Ai';
import { RoutinePanel } from './Checkin';
import { useFatigue } from '../fatigue';
import { useState } from 'react';
import { InfoTip, SourceTags, toSteps } from './Info';
import { ScenarioList, ExtraAlertCards } from './Scenario';
import { LabPanel } from './Lab';
import { useExModal } from './ExercisePlan';
import { useScenario, suitCO2Status } from '../scenario';

// Uyarı görünürlüğü animasyona BAĞLI DEĞİL: yalnızca konum kayar, opaklık her zaman 1 (animasyon çalışmasa da okunur).
const fade = { initial: { y: 8 }, animate: { y: 0 }, transition: { duration: 0.2 } };

/* ---------------- Sağlık değerlendirmesi ---------------- */
export function AssessmentPanel() {
  const { readings, lang, selectIndicator } = useApp();
  const alerts = activeAlerts(readings).filter((a) => a.id !== 'diastolic' || evalLatest(readings, 'systolic').status === 'ok');
  const extra = useScenario((s) => s.extra);
  const overall: Status = [...extra.map((x) => x.status), alerts[0]?.status ?? 'ok'].reduce((a, b) => (statusRank(b) > statusRank(a) ? b : a), 'ok' as Status);
  return (
    <Panel title={t('ui.assessment', lang)} right={<StatusChip s={overall} label={`${alerts.length + extra.length}`} />} className="assess">
      <AiCard />
      <ExtraAlertCards />
      <FatigueCue />
      <div className="alerts" role="status" aria-live="polite">
        <AnimatePresence initial={false}>
          {alerts.length === 0 && extra.length === 0 && <motion.p key="ok" {...fade} className="nominal">● {t('ui.allNominal', lang)}</motion.p>}
          {alerts.map((a) => {
            const adv = adviceFor(a.id, a.status);
            return (
              <motion.button key={a.id} layout {...fade} className="alert" style={{ borderLeftColor: STATUS_COLOR[a.status] }} onClick={() => selectIndicator(a.id)}>
                <div className="alert-h">
                  <span style={{ color: STATUS_COLOR[a.status] }}>{STATUS_GLYPH[a.status]} {t(`ind.${a.id}`, lang)}: <b className="num">{a.reading.value.toFixed(INDICATORS[a.id].decimals)} {INDICATORS[a.id].unit}</b> · {t(a.labelKey, lang)}</span>
                  <span className={`esc esc-${adv.escalate}`}>{t(`esc.${adv.escalate}`, lang)}</span>
                </div>
                <ol className="steps">{toSteps(adv.action[lang]).map((st, i) => <li key={i}>{st}</li>)}</ol>
                <SourceTags sources={adv.sources} />
              </motion.button>
            );
          })}
        </AnimatePresence>
      </div>
    </Panel>
  );
}

function FatigueCue() {
  const lang = useApp((s) => s.lang);
  const f = useFatigue();
  if (!f.enabled || (f.status !== 'watch' && f.status !== 'warn')) return null;
  return (
    <div className="alert" style={{ borderLeftColor: STATUS_COLOR[f.status] }}>
      <div className="alert-h"><span style={{ color: STATUS_COLOR[f.status] }}>{STATUS_GLYPH[f.status]} {t('fc.cardTitle', lang)}: <b className="num">PERCLOS {f.perclos != null ? `%${(f.perclos * 100).toFixed(0)}` : '–'}</b></span><span className="esc esc-self">{t('esc.self', lang)}</span></div>
      <p>{t('fc.cardBody', lang)}</p>
      <ol className="steps"><li>{t('fc.step1', lang)}</li><li>{t('fc.step2', lang)}</li><li>{t('fc.step3', lang)}</li></ol>
    </div>
  );
}

/* ---------------- Bölge bilgisi ---------------- */
export function RegionPanel() {
  const { selectedRegion, lang, readings, selectIndicator, selectRegion } = useApp();
  if (!selectedRegion) return <Panel title={t('ui.clickBody', lang)} className="region"><p className="muted">{lang === 'tr' ? 'Organ işlevi, uzayda ne olduğu ve ilgili NASA kaynakları burada görünür.' : 'Organ function, what happens in space and NASA sources appear here.'}</p></Panel>;
  const info = REGIONS[selectedRegion];
  return (
    <Panel title={info.name[lang]} right={<><span className="haz" title="RIDGE">{info.hazards.join(' ')}</span><button className="x" aria-label="close" onClick={() => selectRegion(null)}>×</button></>} className="region">
      <p><b>{t('ui.function', lang)}:</b> {info.func[lang]}</p>
      <p><b>{t('ui.inSpace', lang)}</b> {info.spaceEffect[lang]}</p>
      <div className="chips">
        {info.indicators.length === 0 ? <span className="muted">{t('ui.noIndicator', lang)}</span> : info.indicators.map((id) => {
          const ev = evalLatest(readings, id);
          return <button key={id} className="chip" style={{ borderColor: STATUS_COLOR[ev.status] }} onClick={() => selectIndicator(id)}>{STATUS_GLYPH[ev.status]} {t(`ind.${id}`, lang)}</button>;
        })}
      </div>
      {(selectedRegion === 'bone' || selectedRegion === 'bone_load' || selectedRegion === 'muscle') && <p className="small">{t('ex.regionHint', lang)} <button className="ex-open" onClick={() => useExModal.getState().show('moves')}>▶ {t('ex.mode', lang)}</button></p>}
      <SourceTags sources={info.sources} />
    </Panel>
  );
}

/* ---------------- Kabin atmosferi ---------------- */
function Gauge({ label, info, value, unit, lo, hi, limitLo, limitHi, status, decimals = 1 }: { label: string; info?: string; value: number; unit: string; lo: number; hi: number; limitLo?: number; limitHi?: number; status: Status; decimals?: number }) {
  const pct = (v: number) => `${Math.min(100, Math.max(0, ((v - lo) / (hi - lo)) * 100))}%`;
  return (
    <div className="gauge">
      <div className="g-h"><span>{label} {info && <InfoTip k={info} />}</span><b className="num" style={{ color: status === 'ok' ? undefined : STATUS_COLOR[status] }}>{value.toFixed(decimals)} <small>{unit}</small></b></div>
      <div className="g-bar">
        <div className="g-fill" style={{ width: pct(value), background: status === 'ok' ? '#5ad1e6' : STATUS_COLOR[status] }} />
        {limitLo != null && <div className="g-lim" style={{ left: pct(limitLo) }} />}
        {limitHi != null && <div className="g-lim" style={{ left: pct(limitHi) }} />}
      </div>
    </div>
  );
}
export function CabinPanel() {
  const { readings, cabin, lang } = useApp();
  const co2 = evalLatest(readings, 'cabinCO2');
  const pStatus: Status = cabin.pressurePsia < 5.0 || cabin.pressurePsia > 15.0 ? 'critical' : 'ok';
  const suit = useScenario((s) => s.suit);
  if (suit) return (
    <Panel title={t('suit.title', lang)} right={<ProvTag p="SIMULATED" />} className="cabin">
      <Gauge label={t('suit.co2', lang)} value={suit.ppCO2mmHg} unit="mmHg" lo={0} hi={18} limitHi={15} status={suitCO2Status(suit.ppCO2mmHg)} />
      <Gauge label="ppO₂ (%100 O₂)" value={suit.ppO2mmHg} unit="mmHg" lo={0} hi={300} status="ok" decimals={0} />
      <Gauge label={t('suit.pressure', lang)} value={suit.pressurePsia} unit="psia" lo={0} hi={16} status="ok" />
      <div className="src"><ProvTag p="NASA_STANDARD" /><span>V2 [11035] [11039] Tablo 23 · TB-037 (4,3 psia)</span></div>
    </Panel>
  );
  return (
    <Panel title={t('ui.cabin', lang)} right={<ProvTag p="SIMULATED" />} className="cabin">
      <Gauge info="cabinCO2" label={`CO₂ (${t('ui.limit', lang)} 3 mmHg)`} value={co2.reading.value} unit="mmHg" lo={0} hi={8} limitHi={3} status={co2.status} />
      <Gauge info="o2" label={t('ui.o2', lang)} value={cabin.o2Pct} unit="%" lo={15} hi={30} status="ok" />
      <Gauge info="pressure" label={`${t('ui.pressure', lang)} (5.0–15.0 psia)`} value={cabin.pressurePsia} unit="psia" lo={0} hi={16} limitLo={5} limitHi={15} status={pStatus} />
      <div className="src"><ProvTag p="NASA_STANDARD" /><span>NASA-STD-3001 V2 [6004] [6006]</span></div>
    </Panel>
  );
}

/* ---------------- Görev zaman çizelgesi + tahminler ---------------- */
export function MissionPanel() {
  const { env, missionDay, setMissionDay, lang } = useApp();
  const e = ENVS[env];
  const len = MISSION_DAYS[env];
  const day = Math.min(missionDay, len);
  const cum = cumulativeMSv(e, day);
  const bone = boneLossPct(e, day);
  const h = equivUSvH(e);
  const [tab, setTab] = useState<'routine' | 'mission' | 'scen' | 'lab' | 'wx'>('routine');
  const tabs = (
    <div className="tabs" role="tablist">
      {(['routine', 'scen', 'lab', 'mission', 'wx'] as const).map((k) => <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{t(`tab.${k}`, lang)}</button>)}
    </div>
  );
  if (tab === 'routine') return <Panel title={t('tab.routine', lang)} right={tabs} className="mission"><RoutinePanel /></Panel>;
  if (tab === 'lab') return <Panel title={t('tab.labTitle', lang)} right={tabs} className="mission"><LabPanel /></Panel>;
  if (tab === 'wx') return <Panel title={t('tab.wx', lang)} right={tabs} className="mission"><SpaceWeather /></Panel>;
  if (tab === 'scen') return <Panel title={t('tab.scen', lang)} right={tabs} className="mission"><ScenarioList /></Panel>;
  return (
    <Panel title={t('ui.timeline', lang)} right={tabs} className="mission">
      <div className="timeline">
        <input type="range" min={0} max={len} value={day} onChange={(ev) => setMissionDay(+ev.target.value)} aria-label={t('ui.day', lang)} />
        <div className="ticks num"><span>0</span><span>{Math.round(len / 4)}</span><span>{Math.round(len / 2)}</span><span>{Math.round((3 * len) / 4)}</span><span>{len}</span></div>
      </div>
      <div className="proj">
        <div>
          <span className="lbl">{t('ui.cumDose', lang)} <InfoTip k="cumDose" /> <ProvTag p={h.basis === 'measured' ? 'PROJECTION' : h.basis === 'derived' ? 'PUBLISHED' : 'ASSUMPTION'} /></span>
          {cum != null ? (<>
            <div className="g-bar big"><div className="g-fill" style={{ width: `${Math.min(100, (cum / 600) * 100)}%`, background: cum > 480 ? STATUS_COLOR.warn : '#5ad1e6' }} /></div>
            <span className="num">≈{cum.toFixed(0)} / 600 mSv · %{((cum / 600) * 100).toFixed(0)}</span>
            <small className="muted">{t('ui.detectorProxy', lang)}{h.basis === 'derived' && e.qSource ? ` · Q=${e.qualityFactor} (${e.qSource})` : ''}</small>
          </>) : <span className="muted">{t('ui.noData', lang)}</span>}
        </div>
        <div>
          <span className="lbl">{t('ui.boneLoss', lang)} <InfoTip k="boneLoss" /> <ProvTag p="PROJECTION" /></span>
          {bone ? (<>
            <div className="g-bar big"><div className="g-fill" style={{ width: `${Math.min(100, (bone.hi / 10) * 100)}%`, background: bone.hi > 5 ? STATUS_COLOR.warn : '#5ad1e6' }} /><div className="g-lim" style={{ left: '50%' }} /></div>
            <span className="num">%{bone.lo.toFixed(1)}–{bone.hi.toFixed(1)}</span>
            <small className="muted">{t('ui.boneNote', lang)}</small>
          </>) : <span className="muted">{t('ui.partialG', lang)}</span>}
        </div>
      </div>
    </Panel>
  );
}

/* ---------------- Trend grafiği (sabit klinik aralık + eşik bantları) ---------------- */
const RANGE: Record<IndicatorId, [number, number]> = {
  heartRate: [30, 180], systolic: [70, 190], diastolic: [40, 130], spo2: [80, 100], respRate: [4, 36],
  bodyTemp: [34, 41], glucose: [40, 260], sleepHours: [0, 10], mood: [1, 5], cabinCO2: [0, 8],
};
export function TrendChart() {
  const { readings, selectedIndicator: id, lang, activity } = useApp();
  const d = INDICATORS[id];
  const data = readings[id];
  const [lo0, hi0] = RANGE[id];
  const vals = data.map((r) => r.value);
  const lo = Math.min(lo0, ...vals), hi = Math.max(hi0, ...vals);
  const W = 560, H = 110, P = 4;
  const t0 = data[0].t, t1 = Math.max(latest(data).t, t0 + 1);
  const x = (tt: number) => P + ((tt - t0) / (t1 - t0)) * (W - 2 * P);
  const y = (v: number) => H - P - ((v - lo) / (hi - lo)) * (H - 2 * P);
  // Eşik bantları: değer ekseninde örnekleyip durum değişim noktalarını bul
  const bands: { from: number; to: number; s: Status }[] = [];
  const ctx = latest(data).ctx;
  const N = 120;
  for (let i = 0; i < N; i++) {
    const v0 = lo + ((hi - lo) * i) / N, v1 = lo + ((hi - lo) * (i + 1)) / N;
    const s = d.evaluate((v0 + v1) / 2, { glucose: ctx, activity }).status;
    const lastB = bands[bands.length - 1];
    if (lastB && lastB.s === s) lastB.to = v1; else bands.push({ from: v0, to: v1, s });
  }
  const path = data.map((r, i) => `${i ? 'L' : 'M'}${x(r.t).toFixed(1)},${y(r.value).toFixed(1)}`).join('');
  const last = latest(data);
  const ev = d.evaluate(last.value, { glucose: last.ctx, activity });
  return (
    <Panel title={`${t('ui.trend', lang)} · ${t(`ind.${id}`, lang)}`} right={<span className="num">{lo}–{hi} {d.unit}</span>} className="trend">
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label={t(`ind.${id}`, lang)}>
        {bands.map((b, i) => b.s !== 'ok' && <rect key={i} x={0} width={W} y={y(b.to)} height={Math.max(0, y(b.from) - y(b.to))} fill={STATUS_COLOR[b.s]} opacity={0.08} />)}
        {data.length > 1 ? <path d={path} fill="none" stroke="#c9d6e3" strokeWidth={1.6} vectorEffect="non-scaling-stroke" /> : null}
        {data.map((r, i) => r.provenance === 'USER_INPUT' || data.length === 1 ? <circle key={i} cx={x(r.t)} cy={y(r.value)} r={4} fill="none" stroke={STATUS_COLOR[d.evaluate(r.value, { glucose: r.ctx, activity }).status]} strokeWidth={2} vectorEffect="non-scaling-stroke" /> : null)}
      </svg>
      <div className="src"><StatusChip s={ev.status} label={t(ev.labelKey, lang)} /><span>{t('ui.threshold', lang)}:</span><ProvTag p={d.thresholdProvenance} />
        <SourceTags sources={d.sources} max={2} />
      </div>
    </Panel>
  );
}
