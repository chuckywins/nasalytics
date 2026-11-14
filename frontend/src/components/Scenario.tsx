// Senaryo arayüzü: liste (görev paneli sekmesi), kalıcı "SENARYO · SİMÜLASYON" bandı, gerçek veri tekrar grafiği, ek uyarı kartları.
// AI notu: Claude (Anthropic) yardımıyla yazılmıştır.
import { useApp } from '../store';
import { t } from '../i18n';
import { SCENARIOS, SCEN_META, useScenario, startScenario, stopScenario, type ExtraAlert } from '../scenario';
import { ProvTag, STATUS_COLOR, STATUS_GLYPH } from './Hud';
import { SourceTags } from './Info';

export function ScenarioList() {
  const lang = useApp((s) => s.lang);
  const cur = useScenario((s) => s.id);
  return (
    <div className="scen-list">
      {SCENARIOS.map((id) => {
        const m = SCEN_META[id];
        return (
          <button key={id} className={`scen-item ${cur === id ? 'on' : ''}`} title={m.desc[lang]} onClick={() => (cur === id ? stopScenario() : startScenario(id))}>
            <span className="scen-t">{cur === id ? '■' : '▶'} {m.title[lang]}</span>
            <ProvTag p={m.prov} />
          </button>
        );
      })}
    </div>
  );
}

/** Ortadaki kalıcı bant: senaryo adı, anlatım, gerçek UTC tekrar saati ve sıkıştırma, durdur */
export function ScenarioBanner() {
  const lang = useApp((s) => s.lang);
  const { id, caption, replay, done } = useScenario();
  if (!id) return null;
  const p = replay?.series[replay.idx];
  return (
    <div className="scen-banner" role="status" aria-live="polite">
      <div className="scen-row">
        <b className="scen-tag">{t('scen.tag', lang)}</b>
        <span className="scen-title">{SCEN_META[id].title[lang]}</span>
        {p && <span className="num muted">UTC {p.t.replace('T', ' ')} · ×{replay!.compression.toLocaleString()}</span>}
        <button className="scen-stop" onClick={stopScenario}>{done ? t('scen.close', lang) : t('scen.stop', lang)}</button>
      </div>
      {caption && <p className="scen-cap">{caption[lang]}</p>}
      {replay && <ReplayChart />}
    </div>
  );
}

function ReplayChart() {
  const lang = useApp((s) => s.lang);
  const r = useScenario((s) => s.replay)!;
  const W = 520, H = 70, P = 3;
  const max = Math.max(...r.series.map((p) => p.v));
  const x = (i: number) => P + (i / (r.series.length - 1)) * (W - 2 * P);
  const y = (v: number) => H - P - (Math.log10(Math.max(v, 1)) / Math.log10(max)) * (H - 2 * P); // log ölçek: taban ve tepe birlikte okunur
  const shown = r.series.slice(0, r.idx + 1);
  const cur = r.series[r.idx];
  const mult = cur.v / r.baseline;
  const evIdx = r.events.map((e) => ({ ...e, i: r.series.findIndex((p) => p.t >= e.t) })).filter((e) => e.i >= 0 && e.i <= r.idx);
  return (
    <div className="replay">
      <div className="replay-h">
        <span>{r.label[lang]} <ProvTag p="NASA_MEASUREMENT" /></span>
        <span className="num"><b style={{ color: mult >= 10 ? STATUS_COLOR.critical : mult >= 3 ? STATUS_COLOR.warn : undefined }}>{cur.v.toFixed(1)} {r.unit}</b> · ×{mult.toFixed(1)} {cur.hl === true ? t('scen.highLat', lang) : cur.hl === false ? t('scen.lowLat', lang) : ''}</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label={r.label[lang]}>
        <line x1={0} x2={W} y1={y(r.baseline)} y2={y(r.baseline)} stroke="#5ad1e6" strokeDasharray="4 3" strokeWidth={1} vectorEffect="non-scaling-stroke" />
        <line x1={0} x2={W} y1={y(r.baseline * 3)} y2={y(r.baseline * 3)} stroke={STATUS_COLOR.warn} strokeDasharray="2 3" strokeWidth={1} vectorEffect="non-scaling-stroke" opacity={0.6} />
        {shown.map((p, i) => <line key={i} x1={x(i)} x2={x(i)} y1={H - P} y2={y(p.v)} stroke={p.hl === true ? '#e9eef4' : p.hl === false ? '#5b6b7c' : '#c9d6e3'} strokeWidth={p.hl === true ? 2 : 1} vectorEffect="non-scaling-stroke" />)}
        {evIdx.map((e) => <line key={e.t} x1={x(e.i)} x2={x(e.i)} y1={0} y2={H} stroke={STATUS_COLOR.watch} strokeWidth={1} vectorEffect="non-scaling-stroke" />)}
      </svg>
      <div className="replay-f">
        <span className="muted">{t('scen.baseline', lang)} {r.baseline.toFixed(1)} {r.unit} ({r.baselineNote[lang]}) · {t('scen.log', lang)}</span>
        <span className="num">Σ {r.doseSoFar.toFixed(r.doseSoFar < 1 ? 3 : 2)} {r.doseUnit[lang]}{r.limit ? ` · ${r.limit[lang]}` : ''}</span>
      </div>
      {evIdx.length > 0 && <div className="muted replay-ev">{evIdx.map((e) => `▲ ${e.t.slice(5).replace('T', ' ')} ${e.text[lang]}`).join('   ')}</div>}
      <SourceTags sources={r.source} />
    </div>
  );
}

/** Senaryonun ek uyarı kartları (radyasyon, kıyafet CO₂, DCS) — değerlendirme panelinde kural uyarılarıyla aynı biçim */
export function ExtraAlertCards() {
  const lang = useApp((s) => s.lang);
  const extra = useScenario((s) => s.extra);
  return <>{extra.map((a: ExtraAlert) => (
    <div key={a.id} className="alert" style={{ borderLeftColor: STATUS_COLOR[a.status] }}>
      <div className="alert-h">
        <span style={{ color: STATUS_COLOR[a.status] }}>{STATUS_GLYPH[a.status]} {a.title[lang]}: <b className="num">{a.value}</b> · {a.label[lang]}</span>
        <span className={`esc esc-${a.escalate}`}>{t(`esc.${a.escalate}`, lang)}</span>
      </div>
      <ol className="steps">{a.steps.map((s, i) => <li key={i}>{s[lang]}</li>)}</ol>
      {a.note && <p className="muted small">{a.note[lang]} <ProvTag p={a.prov} /></p>}
      <SourceTags sources={a.sources} />
    </div>
  ))}</>;
}
