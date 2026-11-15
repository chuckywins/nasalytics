// Hızlı bildirim çipleri, mürettebat sağlık kaydı penceresi, NASA DONKI uzay havası kartı, LOS düğmesi.
// AI notu: Claude (Anthropic) yardımıyla yazılmıştır.
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useApp } from '../store';
import { t } from '../i18n';
import { API } from '../base';
import { reportSymptom, useSymptoms, type SymptomCategory } from '../symptoms';
import { useRecord, type CrewRecord } from '../crew';
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

/* ---------- 4) Mürettebat sağlık kaydı ---------- */
export function RecordButton() {
  const lang = useApp((s) => s.lang);
  const show = useRecord((s) => s.show);
  const has = useRecord((s) => !!s.rec.allergies.trim() || !!s.rec.age);
  return <button className="rec-btn" onClick={() => show(true)} title={t('rec.title', lang)}>🩺 {t('rec.short', lang)}{has ? ' ✓' : ''}</button>;
}

const FIELDS: { k: keyof CrewRecord; type?: string; wide?: boolean }[] = [
  { k: 'age', type: 'number' }, { k: 'sex' }, { k: 'heightCm', type: 'number' }, { k: 'massKg', type: 'number' },
  { k: 'blood' }, { k: 'restingHr', type: 'number' }, { k: 'allergies', wide: true }, { k: 'meds', wide: true },
];
export function RecordModal() {
  const lang = useApp((s) => s.lang);
  const { rec, open, save, show } = useRecord();
  const [f, setF] = useState(rec);
  useEffect(() => { if (open) setF(rec); }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!open) return null;
  const set = (k: keyof CrewRecord, v: string) => setF((x) => ({ ...x, [k]: v }));
  return createPortal(
    <div className="gate soft" role="dialog" aria-modal="true" aria-label={t('rec.title', lang)} onClick={() => show(false)}>
      <form className="rem-box rec-box" onClick={(e) => e.stopPropagation()} onSubmit={(e) => { e.preventDefault(); save(f); }}>
        <header className="panel-h"><span>{t('rec.title', lang)}</span><button type="button" className="x" aria-label="close" onClick={() => show(false)}>×</button></header>
        <div className="rec-grid">
          {FIELDS.map(({ k, type, wide }) => (
            <label key={k} className={wide ? 'wide' : ''}><span className="small">{t(`rec.${k}`, lang)}</span>
              {k === 'sex' ? (
                <select value={f.sex} onChange={(e) => set('sex', e.target.value)}><option value="">—</option><option value="F">{t('rec.F', lang)}</option><option value="M">{t('rec.M', lang)}</option></select>
              ) : k === 'blood' ? (
                <select value={f.blood} onChange={(e) => set('blood', e.target.value)}><option value="">—</option>{['0+', '0−', 'A+', 'A−', 'B+', 'B−', 'AB+', 'AB−'].map((b) => <option key={b}>{b}</option>)}</select>
              ) : (
                <input type={type ?? 'text'} inputMode={type === 'number' ? 'numeric' : undefined} value={f[k]} onChange={(e) => set(k, e.target.value)} placeholder={k === 'allergies' ? t('rec.allergiesPh', lang) : k === 'meds' ? t('rec.medsPh', lang) : ''} />
              )}
            </label>
          ))}
        </div>
        <p className="small muted">{t('rec.note', lang)}</p>
        <button type="submit" className="primary">{t('rec.save', lang)}</button>
      </form>
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
