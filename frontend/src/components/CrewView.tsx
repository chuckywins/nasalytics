// Mürettebat sağlık görevlisi (CMO) ve yer kontrol görünümleri. Her kart bir astronot cihazıdır.
// Yer kontrol: veri "şimdi − tek yön gecikme" anından gösterilir; henüz ulaşmamış veri için geri sayım. Gecikme sıkıştırılırsa yazılır.
// AI notu: Claude (Anthropic) yardımıyla yazılmıştır.
import { useEffect, useRef, useState } from 'react';
import { useApp } from '../store';
import { t } from '../i18n';
import { ENV_LABEL, type EnvId } from '../engine/environment';
import { statusRank } from '../engine/indicators';
import type { Escalation, Status } from '../engine/types';
import { useTelemetry, useNotices, delayMsFor, type Packet } from '../telemetry';
import { STATUS_COLOR, STATUS_GLYPH, ProvTag } from './Hud';
import { InterventionPanel } from './Intervention';
import { useIsMobile } from '../mobile';

const ROWS = ['heartRate', 'spo2', 'respRate', 'bodyTemp', 'glucose', 'sleepHours', 'mood', 'cabinCO2'] as const;
const ENV_BY_LABEL: Record<string, EnvId> = { 'ISS (LEO)': 'iss', 'Orion / lunar transit': 'lunar_transit', 'Lunar base': 'lunar_surface', 'Mars transit': 'mars_transit', 'Mars base': 'mars_surface', Interplanetary: 'deep_space_1au' };
const fmtDur = (ms: number) => { const s = Math.max(0, Math.round(ms / 1000)); return s < 60 ? `${s} s` : `${Math.floor(s / 60)} min ${String(s % 60).padStart(2, '0')} s`; };
const ESC_RANK: Record<Escalation, number> = { self: 0, crew: 1, ground: 2 };

function CrewCard({ k, list, now, sel, onSel }: { k: string; list: Packet[]; now: number; sel: boolean; onSel: () => void }) {
  const lang = useApp((s) => s.lang);
  const { role, compress } = useTelemetry();
  const held = useTelemetry((s) => s.held[k] ?? 0);
  const newest = list[list.length - 1];
  const delay = delayMsFor(newest, role, compress);
  const shown = [...list].reverse().find((p) => p.t <= now - delay);
  const local = k.startsWith('local:');
  const head = (
    <div className="cc-h">
      <b>{newest.crewId}</b>{newest.snap.crewRecord?.name ? <span> · {String(newest.snap.crewRecord.name)}</span> : null}{local && <span className="muted"> · {t('view.thisDevice', lang)}</span>}
      <span className="muted">{ENV_LABEL[ENV_BY_LABEL[newest.snap.environment] ?? 'iss'][lang]} · {t(`act.${newest.snap.activity}`, lang)}</span>
    </div>
  );
  const losLine = role === 'ground' && held > 0
    ? <div className="cc-los small">📡 <b>{t('los.title', lang)}</b> · {held} {t('los.held', lang)}</div>
    : newest.ui.linkDown ? <div className="cc-los small">📡 {t('los.cmo', lang)}</div> : null;
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
      {losLine}
      <div className="cc-meta muted small num">
        {t('view.dataAge', lang)}: {fmtDur(now - shown.t)}{delay > 0 && <> · {t('view.delay', lang)} {fmtDur(delay)}{compress ? ` (${t('view.compressed', lang)})` : ''}</>}
      </div>
      {ui.alarm.length > 0 && <div className="cc-alarm">✖ {t('alarm.critical', lang)}: {ui.alarm.map((id) => ui.extra.find((x) => x.id === id)?.title[lang] ?? t(`ind.${id}`, lang)).join(', ')}</div>}
      {s.crewRecord && (s.crewRecord.allergies || s.crewRecord.blood) && <div className="cc-rec small">🩺 {s.crewRecord.allergies ? <><b>{t('rec.allergies', lang)}:</b> {String(s.crewRecord.allergies)} </> : null}{s.crewRecord.blood ? <span className="muted">· {t('rec.blood', lang)} {String(s.crewRecord.blood)}</span> : null}</div>}
      {s.personalBaseline && <div className="cc-meta muted small num">{t('base.short', lang)} ♥ {s.personalBaseline.restingHrMedian} → {s.personalBaseline.deltaNow >= 0 ? '+' : ''}{s.personalBaseline.deltaNow} bpm ({t('base.ctx', lang)})</div>}
      {(s.reportedSymptoms ?? []).length > 0 && <div className="cc-sym small">🔔 {t('iv.reported', lang)} ({t(`src.${s.reportedSymptoms[s.reportedSymptoms.length - 1].source}`, lang)}): “{s.reportedSymptoms[s.reportedSymptoms.length - 1].quote}”</div>}
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
  const { role, buf, connected, compress, setCompress, held } = useTelemetry();
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const h = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(h); }, []);
  // Uzak cihazlar önce; aynı kimlikli uzak cihaz varsa yerel kopya gizlenir
  const [sel, setSel] = useState<string | null>(null);
  const mobile = useIsMobile();
  const alive = (k: string) => { const l = buf[k]; const last = l[l.length - 1]; return (held[k] ?? 0) > 0 || now - last.t < 180_000 + delayMsFor(last, role, compress); };
  // Aynı kimlikte yerel ve uzak kopya varsa DAHA YENİ olan gösterilir: tek telefonda astronottan CMO'ya geçilince
  // sunucunun tekrar oynattığı eski paket, cihazın kendi canlı verisini gizlemesin
  const newestT = (k: string) => buf[k]?.[buf[k].length - 1]?.t ?? 0;
  const keys = Object.keys(buf).filter((k) => {
    if (!buf[k].length || !alive(k)) return false;
    if (k.startsWith('local:')) { const r = k.slice(6); return !(buf[r]?.length && newestT(r) >= newestT(k) - 5000); }
    const l = `local:${k}`; return !(buf[l]?.length && newestT(k) < newestT(l) - 5000);
  }).sort((a, b) => Number(a.startsWith('local:')) - Number(b.startsWith('local:')) || a.localeCompare(b));
  // Seçili astronot: kullanıcı seçimi; yoksa en ciddi durumdaki (gösterilen pakete göre)
  const shownOf = (k: string) => { const l = buf[k]; const d = delayMsFor(l[l.length - 1], role, compress); return [...l].reverse().find((p) => p.t <= now - d); };
  // Belirti bildirimi de seçimi etkiler: yaşamsal değerleri normal ama "kendimi iyi hissetmiyorum" diyen astronot öne gelir
  const sevOf = (k: string) => { const p = shownOf(k); return p ? Math.max(0, ...p.snap.indicators.map((x) => statusRank(x.status as Status)), (p.snap.reportedSymptoms ?? []).length ? statusRank('warn') : 0) : -1; };
  const selKey = sel && keys.includes(sel) ? sel : [...keys].sort((a, b) => sevOf(b) - sevOf(a))[0];
  const selShown = selKey ? shownOf(selKey) : undefined;
  // CMO bildirimi: GÖSTERİLEN pakette yeni belirti → üstte kalıcı bildirim (yer kontrolüne bildirim yok; veri gecikmeli kartta görünür)
  const seen = useRef<Set<string> | null>(null);
  const [toasts, setToasts] = useState<{ id: string; key: string; crewId: string; quote: string; category: string }[]>([]);
  useEffect(() => {
    if (role !== 'cmo') return;
    const all = keys.flatMap((k) => (shownOf(k)?.snap.reportedSymptoms ?? []).map((x) => ({ ...x, key: k, crewId: buf[k][0].crewId })));
    if (!seen.current) { seen.current = new Set(all.filter((x) => x.minutesAgo >= 1).map((x) => x.id)); } // açılışta eski bildirimleri tekrar çalma
    const fresh = all.filter((x) => !seen.current!.has(x.id) && x.minutesAgo < 1); // yalnızca yeni (<~1 dk) bildirim açılır
    if (fresh.length) { fresh.forEach((x) => seen.current!.add(x.id)); setToasts((ts) => [...ts, ...fresh.map((x) => ({ id: x.id, key: x.key, crewId: x.crewId, quote: x.quote, category: x.category }))].slice(-3)); }
  }); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="crew-view">
      <div className="cv-h">
        <b>{t(role === 'cmo' ? 'view.cmoTitle' : 'view.groundTitle', lang)}</b>
        <span className={`cv-conn ${connected ? 'on' : ''}`}>● {connected ? t('view.live', lang) : t('view.localOnly', lang)}</span>
        <span className="muted small">{t(role === 'cmo' ? 'view.cmoNote' : 'view.groundNote', lang)}</span>
        {role === 'ground' && <label className="cv-comp small"><input type="checkbox" checked={compress} onChange={(e) => setCompress(e.target.checked)} /> {t('view.compress', lang)}</label>}
      </div>
      {toasts.length > 0 && <div className="sym-toasts" role="status" aria-live="assertive">{toasts.map((x) => (
        <div key={x.id} className="sym-toast"><b>🔔 {x.crewId} · {t('notice.vega', lang)}</b> “{x.quote}” <span className="muted small">({t(`sym.${x.category}`, lang)})</span>
          <button onClick={() => { setSel(x.key); setToasts((ts) => ts.filter((y) => y.id !== x.id)); }}>{t('notice.view', lang)}</button>
          <button className="ghost" aria-label={t('notice.dismiss', lang)} onClick={() => setToasts((ts) => ts.filter((y) => y.id !== x.id))}>✕</button></div>))}</div>}
      <div className="cv-body">
        <div className="cv-grid">
          {keys.length === 0 ? <p className="muted">{t('view.empty', lang)}</p> : keys.map((k) => <CrewCard key={k} k={k} list={buf[k]} now={now} sel={k === selKey} onSel={() => setSel(k)} />)}
        </div>
        {mobile ? (sel && selShown && <div className="m-intv"><button className="m-back" onClick={() => setSel(null)}>{t('m.back', lang)}</button><InterventionPanel p={selShown} role={role} compress={compress} /></div>)
          : selShown ? <InterventionPanel p={selShown} role={role} compress={compress} /> : <div className="intv muted">{t('iv.pick', lang)}</div>}
      </div>
    </div>
  );
}


/** Diğer mürettebat cihazı (astronot görünümü): bir ekip arkadaşı VEGA'ya belirti bildirince kısa bildirim */
export function CrewNotices() {
  const lang = useApp((s) => s.lang);
  const { list, dismiss } = useNotices();
  if (!list.length) return null;
  return (
    <div className="sym-toasts crew" role="status" aria-live="polite">
      {list.map((n) => (
        <div key={n.id} className="sym-toast"><b>🔔 {n.crewId} · {t('notice.crew', lang)}</b> “{n.quote}” <span className="muted small">({t(`sym.${n.category}`, lang)} · {t('notice.cmoInformed', lang)})</span>
          <button className="ghost" aria-label={t('notice.dismiss', lang)} onClick={() => dismiss(n.id)}>✕</button></div>
      ))}
    </div>
  );
}
