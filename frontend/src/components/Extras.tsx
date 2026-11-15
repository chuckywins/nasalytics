// Hızlı bildirim çipleri, mürettebat sağlık kaydı penceresi, NASA DONKI uzay havası kartı, LOS düğmesi.
// AI notu: Claude (Anthropic) yardımıyla yazılmıştır.
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useApp } from '../store';
import { t } from '../i18n';
import { API } from '../base';
import { reportSymptom, useSymptoms, type SymptomCategory } from '../symptoms';
import { useRecord, bmiOf, hrPlan, type CrewRecord } from '../crew';
import { useCheckin, dayKey } from '../checkin';
import { EX_ANIM, EX_NOTE, exEquipment } from '../engine/exercise';
import { useExModal } from './ExercisePlan';
import { hrBaseline } from '../baseline';
import { HIST, histView, download, toCsv } from '../history';
import { useLink } from '../link';
import { ProvTag } from './Hud';

/* ---------- 1) Dokun-bildir: VEGA'ya konuşmadan tek dokunuşla belirti ---------- */
const CHIPS: { k: string; cat: SymptomCategory | null }[] = [
  { k: 'ok', cat: null }, { k: 'meh', cat: 'unwell' }, { k: 'bad', cat: 'unwell' },
  { k: 'dizzy', cat: 'dizzy' }, { k: 'headache', cat: 'pain' }, { k: 'nausea', cat: 'nausea' }, { k: 'chest', cat: 'chestPain' },
];
export function QuickCheck() {
  const lang = useApp((s) => s.lang);
  const [sent, setSent] = useState<string>('');
  useEffect(() => { if (!sent) return; const h = setTimeout(() => setSent(''), 6000); return () => clearTimeout(h); }, [sent]);
  const tap = (c: (typeof CHIPS)[number]) => {
    const label = t(`qc.${c.k}`, lang);
    if (!c.cat) { // "İyiyim": bu cihazın kendi dokunuş bildirimlerini kapatır (VEGA/senaryo kayıtları kalır)
      useSymptoms.setState((s) => ({ list: s.list.filter((x) => x.source !== 'tap') }));
      setSent(label); return;
    }
    reportSymptom(c.cat, label, 'tap');
    setSent(label);
  };
  return (
    <div className="qc" role="group" aria-label={t('qc.title', lang)}>
      <span className="qc-h small">{t('qc.title', lang)}</span>
      <div className="qc-chips">
        {CHIPS.map((c) => <button key={c.k} className={`qc-chip ${c.k === 'ok' ? 'ok' : c.k === 'chest' || c.k === 'bad' ? 'hi' : ''}`} onClick={() => tap(c)}>{t(`qc.${c.k}`, lang)}</button>)}
      </div>
      {sent && <div className="qc-sent small" role="status">✓ “{sent}” · {t(sent === t('qc.ok', lang) ? 'qc.cleared' : 'qc.sent', lang)}</div>}
    </div>
  );
}

/* ---------- 4) Mürettebat sağlık kaydı: Profil · Kişisel program · Geçmiş ---------- */
export function RecordButton() {
  const lang = useApp((s) => s.lang);
  const show = useRecord((s) => s.show);
  const name = useRecord((s) => s.rec.name);
  return <button className="rec-btn" onClick={() => show(true)} title={t('rec.title', lang)}>🩺 {name ? name.split(' ')[0] : t('rec.short', lang)}</button>;
}

const FIELDS: { k: keyof CrewRecord; type?: string; wide?: boolean }[] = [
  { k: 'name', wide: true }, { k: 'role' }, { k: 'country' },
  { k: 'age', type: 'number' }, { k: 'sex' }, { k: 'heightCm', type: 'number' }, { k: 'massKg', type: 'number' },
  { k: 'blood' }, { k: 'restingHr', type: 'number' }, { k: 'allergies', wide: true }, { k: 'meds', wide: true },
];
const CDC_BMI = 'https://www.cdc.gov/bmi/adult-calculator/bmi-categories.html';
const AHA_THR = 'https://www.heart.org/en/healthy-living/fitness/fitness-basics/target-heart-rates';

function Profile() {
  const lang = useApp((s) => s.lang);
  const { rec, save, reset } = useRecord();
  const [f, setF] = useState(rec);
  const [saved, setSaved] = useState(false);
  useEffect(() => setF(rec), [rec]);
  const set = (k: keyof CrewRecord, v: string) => { setSaved(false); setF((x) => ({ ...x, [k]: v })); };
  const b = bmiOf(f);
  return (
    <form onSubmit={(e) => { e.preventDefault(); save(f); setSaved(true); }} className="rec-form">
      <div className="rec-grid">
        {FIELDS.map(({ k, type, wide }) => (
          <label key={k} className={wide ? 'wide' : ''}><span className="small">{t(`rec.${k}`, lang)}</span>
            {k === 'sex' ? (
              <select value={f.sex} onChange={(e) => set('sex', e.target.value)}><option value="">—</option><option value="F">{t('rec.F', lang)}</option><option value="M">{t('rec.M', lang)}</option></select>
            ) : k === 'blood' ? (
              <select value={f.blood} onChange={(e) => set('blood', e.target.value)}><option value="">—</option>{['0+', '0−', 'A+', 'A−', 'B+', 'B−', 'AB+', 'AB−'].map((x) => <option key={x}>{x}</option>)}</select>
            ) : (
              <input type={type ?? 'text'} inputMode={type === 'number' ? 'numeric' : undefined} value={f[k]} onChange={(e) => set(k, e.target.value)} placeholder={k === 'allergies' ? t('rec.allergiesPh', lang) : k === 'meds' ? t('rec.medsPh', lang) : ''} />
            )}
          </label>
        ))}
        <div className="wide rec-bmi"><span className="small">BMI</span> <b className="num">{b ? b.value : '—'}</b>{b && <> <span className="small">kg/m² · {t(`bmi.${b.cat}`, lang)}</span> <a className="small" href={CDC_BMI} target="_blank" rel="noreferrer">CDC ↗</a></>}</div>
      </div>
      <p className="small muted">{t('rec.note', lang)}</p>
      <div className="rec-actions">
        <button type="button" onClick={reset}>{t('rec.reset', lang)}</button>
        <button type="submit" className="primary">{saved ? '✓ ' : ''}{t('rec.save', lang)}</button>
      </div>
    </form>
  );
}

/** Kayıttaki yaş/boy/kütleye göre kişisel egzersiz programı: yalnız kaynaklı hesap; yük/set/tekrar YOK (ASCR belirler) */
const NONE: string[] = [];
function Program() {
  const lang = useApp((s) => s.lang);
  const env = useApp((s) => s.env);
  const rec = useRecord((s) => s.rec);
  const doneRaw = useCheckin((s) => s.exMoves[dayKey()]);
  const done = doneRaw ?? NONE;
  const b = bmiOf(rec), h = hrPlan(rec), eq = exEquipment(env);
  const bl = hrBaseline();
  const src = (u: string, l: string) => <a href={u} target="_blank" rel="noreferrer" className="ex-src">{l} ↗</a>;
  const TB = 'https://www.nasa.gov/wp-content/uploads/2023/12/ochmo-tb-031-exercise-overview.pdf';
  const MTB = 'https://www.nasa.gov/wp-content/uploads/2023/12/ochmo-tb-030-bone-loss.pdf';
  const res = EX_ANIM.filter((a) => ['squat', 'deadlift', 'heelraise', 'bench'].includes(a.id));
  return (
    <div className="prog">
      <div className="prog-cards">
        <div className="prog-c"><span className="small muted">BMI</span><b className="num">{b ? b.value : '—'}</b><span className="small">{b ? t(`bmi.${b.cat}`, lang) : t('prog.needHW', lang)}</span>{src(CDC_BMI, 'CDC')}</div>
        <div className="prog-c"><span className="small muted">{t('prog.hrMax', lang)}</span><b className="num">{h ? `≈${h.max}` : '—'} <small>bpm</small></b><span className="small">{h ? `220 − ${rec.age}` : t('prog.needAge', lang)}</span>{src(AHA_THR, 'AHA')}</div>
        <div className="prog-c hi"><span className="small muted">{t('prog.t2', lang)}</span><b className="num">{h ? `${h.t2Lo}–${h.t2Hi}` : '—'} <small>bpm</small></b><span className="small">%70–100 HRmax</span>{src(TB, 'TB-031 s. 11')}</div>
        <div className="prog-c"><span className="small muted">{t('prog.rest', lang)}</span><b className="num">{rec.restingHr || '—'}{bl ? <small> / {t('base.short', lang)} {bl.median}</small> : null}</b><span className="small">{t('prog.restNote', lang)}</span></div>
      </div>
      <ol className="prog-day small">
        <li><b>{t('prog.aero', lang)}</b> ~30 dk · {t('prog.aeroHow', lang)} {h && <b className="num">{h.t2Lo}–{h.t2Hi} bpm</b>} · {t('prog.cevis', lang)} {src(TB, 'TB-031 s. 10–11')}</li>
        <li><b>{t('prog.resist', lang)}</b> 30–60 dk · {res.map((a) => <span key={a.id} className={`prog-mv ${done.includes(a.id) ? 'on' : ''}`}>{done.includes(a.id) ? '✓ ' : ''}{a.name[lang]}</span>)} {src(TB, 'TB-031 s. 16')}</li>
        <li><b>{t('prog.freq', lang)}</b> {t('prog.freqTxt', lang)} {src(MTB, 'MTB-013 s. 14')}</li>
        <li><b>{t('ex.equipment', lang)}:</b> {eq.text[lang]}</li>
      </ol>
      <div className="small">{t('prog.today', lang)}: <b className="num">{done.length}</b> · <button className="ex-open" onClick={() => { useRecord.getState().show(false); useExModal.getState().show('moves'); }}>▶ {t('ex.mode', lang)}</button></div>
      <p className="small muted">{EX_NOTE[lang]} {t('prog.massNote', lang)}</p>
    </div>
  );
}

function History() {
  const lang = useApp((s) => s.lang);
  const [range, setRange] = useState<number | null>(15);
  const [avg, setAvg] = useState(false);
  const [, force] = useState(0);
  useEffect(() => { const h = setInterval(() => force((x) => x + 1), 2000); return () => clearInterval(h); }, []);
  const rows = histView(range, avg);
  const id = useRecord.getState().id;
  const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');
  const all = () => JSON.stringify({ crewId: id, record: useRecord.getState().rec, exportedAt: new Date().toISOString(), provenance: 'vitals SIMULATED unless noted; fictional crew', readings: HIST, symptoms: useSymptoms.getState().list, checkin: { exMoves: useCheckin.getState().exMoves, days: useCheckin.getState().days } }, null, 1);
  const W = 600, H = 40;
  const hr = rows.map((r) => r.hr);
  const lo = Math.min(...hr, 50), hi = Math.max(...hr, 120);
  const path = hr.map((v, i) => `${i ? 'L' : 'M'}${((i / Math.max(1, hr.length - 1)) * W).toFixed(1)},${(H - ((v - lo) / (hi - lo)) * H).toFixed(1)}`).join('');
  return (
    <div className="hist">
      <div className="hist-ctl">
        <div className="seg small">{([[15, '15 dk'], [60, '1 sa'], [360, '6 sa'], [null, t('hist.all', lang)]] as const).map(([v, l]) => <button key={String(v)} className={range === v ? 'on' : ''} onClick={() => setRange(v)}>{l}</button>)}</div>
        <div className="seg small"><button className={!avg ? 'on' : ''} onClick={() => setAvg(false)}>{t('hist.each', lang)}</button><button className={avg ? 'on' : ''} onClick={() => setAvg(true)}>{t('hist.avg', lang)}</button></div>
        <div className="hist-exp small">
          <button onClick={() => download(`${id}-readings-${stamp}.csv`, toCsv(rows), 'text/csv')}>⬇ CSV</button>
          <button onClick={() => download(`${id}-all-${stamp}.json`, all(), 'application/json')}>⬇ JSON</button>
        </div>
      </div>
      <div className="small muted">{t('hist.hr', lang)} · <b className="num">{rows.length}</b> {t('hist.rows', lang)} <ProvTag p="SIMULATED" /></div>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="hist-spark" aria-hidden><path d={path} fill="none" stroke="#5ad1e6" strokeWidth={1.4} vectorEffect="non-scaling-stroke" /></svg>
      <div className="hist-tbl">
        <table className="small num">
          <thead><tr><th>UTC</th><th>{t('ind.heartRate', lang)}</th><th>SpO₂</th><th>{t('ind.respRate', lang)}</th><th>KB</th><th>°C</th><th>{t('ui.activity', lang)}</th><th>{t('hist.alarm', lang)}</th><th>{t('hist.link', lang)}</th></tr></thead>
          <tbody>{rows.slice(-200).reverse().map((r) => (
            <tr key={r.t} className={r.alarm ? 'al' : ''}><td>{new Date(r.t).toISOString().slice(11, 19)}</td><td>{r.hr}</td><td>{r.spo2}</td><td>{r.rr}</td><td>{r.sys}/{r.dia}</td><td>{r.temp}</td><td>{t(`act.${r.activity}`, lang)}</td><td>{r.alarm ? r.alarm.split(' ').map((x) => t(`ind.${x}`, lang)).join(', ') : '·'}</td><td>{r.link}</td></tr>
          ))}</tbody>
        </table>
        {rows.length === 0 && <p className="small muted">{t('hist.empty', lang)}</p>}
      </div>
    </div>
  );
}

export function RecordModal() {
  const lang = useApp((s) => s.lang);
  const { open, tab, show, rec, id } = useRecord();
  if (!open) return null;
  const b = bmiOf(rec);
  return createPortal(
    <div className="gate soft" role="dialog" aria-modal="true" aria-label={t('rec.title', lang)} onClick={() => show(false)}>
      <div className="rem-box rec-box" onClick={(e) => e.stopPropagation()}>
        <header className="panel-h"><span>{t('rec.title', lang)} · {id}{rec.name ? ` · ${rec.name}` : ''}{b ? ` · BMI ${b.value}` : ''}</span><button type="button" className="x" aria-label="close" onClick={() => show(false)}>×</button></header>
        <div className="small muted">{t('rec.fictional', lang)}</div>
        <div className="seg small ex-tabs" role="tablist">
          {(['profile', 'program', 'history'] as const).map((k) => <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? 'on' : ''} onClick={() => show(true, k)}>{t(`rec.tab.${k}`, lang)}</button>)}
        </div>
        {tab === 'profile' ? <Profile /> : tab === 'program' ? <Program /> : <History />}
      </div>
    </div>, document.body);
}

/* ---------- 2) LOS düğmesi (astronot cihazı; demo) ---------- */
export function LinkToggle() {
  const lang = useApp((s) => s.lang);
  const { down, since, toggle } = useLink();
  const [, force] = useState(0);
  useEffect(() => { if (!down) return; const h = setInterval(() => force((x) => x + 1), 1000); return () => clearInterval(h); }, [down]);
  const sec = since ? Math.floor((Date.now() - since) / 1000) : 0;
  return (
    <button className={`los-btn ${down ? 'on' : ''}`} aria-pressed={down} onClick={toggle} title={t('los.help', lang)}>
      📡 {down ? `${t('los.on', lang)} ${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}` : t('los.off', lang)}
    </button>
  );
}
export function LosBanner() {
  const lang = useApp((s) => s.lang);
  const down = useLink((s) => s.down);
  if (!down) return null;
  return <div className="los-banner small" role="status">📡 <b>{t('los.title', lang)}</b> · {t('los.astro', lang)}</div>;
}

/* ---------- 5) NASA DONKI uzay havası (canlı) ---------- */
interface Wx { start: string; end: string; events: { type: string; time: string | null; detail: string | null; link: string | null }[]; fetchedAt: number; stale: boolean; failed?: string[] }
export function SpaceWeather() {
  const lang = useApp((s) => s.lang);
  const [wx, setWx] = useState<Wx | null>(null);
  const [err, setErr] = useState(false);
  const off = useLink((s) => s.down);
  useEffect(() => {
    if (off) return;
    let dead = false;
    const go = () => fetch(`${API}/api/spaceweather`).then((r) => (r.ok ? r.json() : Promise.reject(r.status))).then((j) => { if (!dead) { setWx(j); setErr(false); } }).catch(() => { if (!dead) setErr(true); });
    void go(); const h = setInterval(go, 30 * 60_000);
    return () => { dead = true; clearInterval(h); };
  }, [off]);
  const fmtT = (s: string | null) => (s ? s.replace('T', ' ').replace('Z', '').slice(0, 16) + ' UTC' : '—');
  const counts = (['FLR', 'SEP', 'CME', 'GST'] as const).map((k) => [k, wx?.events.filter((e) => e.type === k).length ?? 0] as const);
  return (
    <div className="wx">
      <div className="wx-h small"><b>{t('wx.title', lang)}</b> <ProvTag p="NASA_MEASUREMENT" /></div>
      {off && <p className="small muted">{t('wx.los', lang)}</p>}
      {err && !wx && <p className="small muted">{t('wx.err', lang)}</p>}
      {wx && <>
        <div className="small muted">{t('wx.window', lang)} {wx.start} → {wx.end} · {t('wx.fetched', lang)} {new Date(wx.fetchedAt * 1000).toISOString().slice(11, 16)} UTC{wx.stale ? ` · ${t('wx.stale', lang)}` : ''}</div>
        <div className="wx-counts">{counts.map(([k, n]) => <span key={k} className="wx-c"><b className="num">{wx.failed?.includes(k) ? '—' : n}</b> {t(`wx.${k}`, lang)} <span className="muted">({k}{wx.failed?.includes(k) ? `, ${t('wx.failed', lang)}` : ''})</span></span>)}</div>
        {wx.events.length === 0 ? <p className="small muted">{t('wx.none', lang)}</p> : (
          <ul className="wx-list small">{wx.events.slice(0, 8).map((e, i) => (
            <li key={i}><b>{e.type}</b>{e.detail ? ` ${e.detail}` : ''} · <span className="num">{fmtT(e.time)}</span>{e.link && <> · <a href={e.link} target="_blank" rel="noreferrer">DONKI ↗</a></>}</li>
          ))}</ul>
        )}
      </>}
      <p className="small muted">{t('wx.note', lang)} <a href="https://kauai.ccmc.gsfc.nasa.gov/DONKI/" target="_blank" rel="noreferrer">NASA CCMC DONKI ↗</a></p>
    </div>
  );
}
