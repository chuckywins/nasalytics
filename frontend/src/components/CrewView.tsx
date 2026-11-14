// Mürettebat sağlık görevlisi (CMO) ve yer kontrol görünümleri. Her kart bir astronot cihazıdır.
// Yer kontrol: veri "şimdi − tek yön gecikme" anından gösterilir; henüz ulaşmamış veri için geri sayım. Gecikme sıkıştırılırsa yazılır.
// AI notu: Claude (Anthropic) yardımıyla yazılmıştır.
import { useEffect, useState } from 'react';
import { useApp } from '../store';
import { t } from '../i18n';
import { ENV_LABEL, type EnvId } from '../engine/environment';
import { statusRank } from '../engine/indicators';
import type { Escalation, Status } from '../engine/types';
import { useTelemetry, delayMsFor, type Packet } from '../telemetry';
import { STATUS_COLOR, STATUS_GLYPH, ProvTag } from './Hud';
import { InterventionPanel } from './Intervention';

const ROWS = ['heartRate', 'spo2', 'respRate', 'bodyTemp', 'glucose', 'sleepHours', 'mood', 'cabinCO2'] as const;
const ENV_BY_LABEL: Record<string, EnvId> = { 'ISS (LEO)': 'iss', 'Orion / lunar transit': 'lunar_transit', 'Lunar base': 'lunar_surface', 'Mars transit': 'mars_transit', 'Mars base': 'mars_surface', Interplanetary: 'deep_space_1au' };
const fmtDur = (ms: number) => { const s = Math.max(0, Math.round(ms / 1000)); return s < 60 ? `${s} s` : `${Math.floor(s / 60)} min ${String(s % 60).padStart(2, '0')} s`; };
const ESC_RANK: Record<Escalation, number> = { self: 0, crew: 1, ground: 2 };

function CrewCard({ k, list, now, sel, onSel }: { k: string; list: Packet[]; now: number; sel: boolean; onSel: () => void }) {
  const lang = useApp((s) => s.lang);
  const { role, compress } = useTelemetry();
  const newest = list[list.length - 1];
  const delay = delayMsFor(newest, role, compress);
  const shown = [...list].reverse().find((p) => p.t <= now - delay);
  const local = k.startsWith('local:');
  const head = (
    <div className="cc-h">
      <b>{newest.crewId}</b>{local && <span className="muted"> · {t('view.thisDevice', lang)}</span>}
      <span className="muted">{ENV_LABEL[ENV_BY_LABEL[newest.snap.environment] ?? 'iss'][lang]} · {t(`act.${newest.snap.activity}`, lang)}</span>
    </div>
  );
  if (!shown) {
    const eta = list[0].t + delay - now;
    return <div className={`crew-card ${sel ? 'sel' : ''}`} onClick={onSel}>{head}<p className="cc-wait">{t('view.inTransit', lang)} <b className="num">{fmtDur(eta)}</b></p><p className="muted small">{t('view.transitNote', lang)}</p></div>;
  }
  const s = shown.snap, ui = shown.ui;
  const ind = Object.fromEntries(s.indicators.map((x) => [x.id, x]));
  const worst: Status = [...s.indicators.map((x) => x.status as Status), ...ui.extra.map((x) => x.status)].reduce((a, b) => (statusRank(b) > statusRank(a) ? b : a), 'ok' as Status);
  const esc = ui.extra.reduce<Escalation>((a, x) => (ESC_RANK[x.escalate] > ESC_RANK[a] ? x.escalate : a), ui.ai?.escalate ?? 'self');
  const hr = list.filter((p) => p.t <= shown.t).slice(-60).map((p) => p.snap.indicators.find((x) => x.id === 'heartRate')?.value ?? 0);
  const W = 200, H = 28;
  const lo = Math.min(...hr, 50), hi = Math.max(...hr, 120);
  const path = hr.map((v, i) => `${i ? 'L' : 'M'}${((i / Math.max(1, hr.length - 1)) * W).toFixed(1)},${(H - ((v - lo) / (hi - lo)) * H).toFixed(1)}`).join('');
  return (
    <div className={`crew-card ${sel ? 'sel' : ''}`} onClick={onSel} style={{ borderColor: worst === 'ok' ? undefined : STATUS_COLOR[worst] }}>
      {head}
      <div className="cc-meta muted small num">
        {t('view.dataAge', lang)}: {fmtDur(now - shown.t)}{delay > 0 && <> · {t('view.delay', lang)} {fmtDur(delay)}{compress ? ` (${t('view.compressed', lang)})` : ''}</>}
      </div>
      {ui.alarm.length > 0 && <div className="cc-alarm">✖ {t('alarm.critical', lang)}: {ui.alarm.map((id) => (id === 'radiation' ? t('alarm.radiation', lang) : t(`ind.${id}`, lang))).join(', ')}</div>}
      {ui.scenario && <div className="cc-scen"><b className="scen-tag">{t('scen.tag', lang)}</b> {ui.scenario.title[lang]}{ui.scenario.caption && <div className="muted small">{ui.scenario.caption[lang]}</div>}</div>}
      <div className="cc-grid">
        <span className="cc-l">{t('ind.systolic', lang).split(' ')[0]}</span><b className="num">{ui.bp}</b>
        {ROWS.map((id) => {
          const x = ind[id]; if (!x) return null;
          const st = x.status as Status;
          return [<span key={id + 'l'} className="cc-l">{t(`ind.${id}`, lang)}</span>,
            <b key={id + 'v'} className="num" style={{ color: st === 'ok' ? undefined : STATUS_COLOR[st] }}>{STATUS_GLYPH[st]} {x.value} <small>{x.unit}</small></b>];
        })}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="cc-spark" aria-hidden><path d={path} fill="none" stroke="#5ad1e6" strokeWidth={1.4} vectorEffect="non-scaling-stroke" /></svg>
      {ui.extra.map((x, i) => <div key={i} className="small" style={{ color: STATUS_COLOR[x.status] }}>{STATUS_GLYPH[x.status]} {x.title[lang]}: {x.value} · {x.label[lang]}</div>)}
      {ui.ai && <div className="cc-ai small"><span className="ai-tag">✦ AI</span> {ui.ai.headline}</div>}
      <div className="cc-f"><span className={`esc esc-${esc}`}>{t(`esc.${esc}`, lang)}</span><ProvTag p="SIMULATED" /></div>
    </div>
  );
}

export function CrewView() {
  const lang = useApp((s) => s.lang);
  const { role, buf, connected, compress, setCompress } = useTelemetry();
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const h = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(h); }, []);
  // Uzak cihazlar önce; aynı kimlikli uzak cihaz varsa yerel kopya gizlenir
  const [sel, setSel] = useState<string | null>(null);
  const keys = Object.keys(buf).filter((k) => buf[k].length && !(k.startsWith('local:') && buf[k.slice(6)]?.length)).sort((a, b) => Number(a.startsWith('local:')) - Number(b.startsWith('local:')) || a.localeCompare(b));
  // Seçili astronot: kullanıcı seçimi; yoksa en ciddi durumdaki (gösterilen pakete göre)
  const shownOf = (k: string) => { const l = buf[k]; const d = delayMsFor(l[l.length - 1], role, compress); return [...l].reverse().find((p) => p.t <= now - d); };
  const sevOf = (k: string) => { const p = shownOf(k); return p ? Math.max(0, ...p.snap.indicators.map((x) => statusRank(x.status as Status))) : -1; };
  const selKey = sel && keys.includes(sel) ? sel : [...keys].sort((a, b) => sevOf(b) - sevOf(a))[0];
  const selShown = selKey ? shownOf(selKey) : undefined;
  return (
    <div className="crew-view">
      <div className="cv-h">
        <b>{t(role === 'cmo' ? 'view.cmoTitle' : 'view.groundTitle', lang)}</b>
        <span className={`cv-conn ${connected ? 'on' : ''}`}>● {connected ? t('view.live', lang) : t('view.localOnly', lang)}</span>
        <span className="muted small">{t(role === 'cmo' ? 'view.cmoNote' : 'view.groundNote', lang)}</span>
        {role === 'ground' && <label className="cv-comp small"><input type="checkbox" checked={compress} onChange={(e) => setCompress(e.target.checked)} /> {t('view.compress', lang)}</label>}
      </div>
      <div className="cv-body">
        <div className="cv-grid">
          {keys.length === 0 ? <p className="muted">{t('view.empty', lang)}</p> : keys.map((k) => <CrewCard key={k} k={k} list={buf[k]} now={now} sel={k === selKey} onSel={() => setSel(k)} />)}
        </div>
        {selShown ? <InterventionPanel p={selShown} role={role} compress={compress} /> : <div className="intv muted">{t('iv.pick', lang)}</div>}
      </div>
    </div>
  );
}

