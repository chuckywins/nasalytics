// Inspiration4 gerçek klinik laboratuvar verisi (NASA OSDR OSD-569 CBC, OSD-575 CMP).
// Kurallar (advisor): canlı değerlendirici ve durum renkleri KULLANILMAZ; yalnızca veri setinin referans aralığı gösterilir.
// "Kişisel taban" DEĞİL: "I4 mürettebatı uçuş öncesi ortalaması (n=4)". Uçuş içi örnek yoktur (L = fırlatma öncesi, R = dönüş sonrası gün).
// AI notu: Claude (Anthropic) yardımıyla yazılmıştır.
import { useState } from 'react';
import i4 from '../data/i4_clinical.json';
import { useApp } from '../store';
import { ProvTag } from './Hud';
import { SourceTags } from './Info';

interface Analyte { label: string; unit: string; refLow: number; refHigh: number; crew: Record<string, number[]>; crewRef: Record<string, ([number, number] | null)[]>; rangeVaries: boolean; preflightMean: number; r1Mean: number }
const DATA = i4 as unknown as { timepoints: string[]; analytes: Record<string, Analyte> };
const TR: Record<string, string> = {
  glucose: 'Glukoz', sodium: 'Sodyum', potassium: 'Potasyum', calcium: 'Kalsiyum', creatinine: 'Kreatinin', urea_nitrogen_bun: 'BUN (üre azotu)',
  albumin: 'Albümin', hemoglobin: 'Hemoglobin', hematocrit: 'Hematokrit', absolute_lymphocytes: 'Lenfosit', absolute_neutrophils: 'Nötrofil',
  white_blood_cell_count: 'Lökosit (WBC)', platelet_count: 'Trombosit',
};
const SRC = [
  { label: 'NASA OSDR OSD-569 (CBC)', url: 'https://osdr.nasa.gov/bio/repo/data/studies/OSD-569' },
  { label: 'NASA OSDR OSD-575 (CMP)', url: 'https://osdr.nasa.gov/bio/repo/data/studies/OSD-575' },
];
const CREW_STROKE = ['#e9eef4', '#9fb3c8', '#5ad1e6', '#7d8fa3']; // kimlik renkleri (durum rengi değil)

function Spark({ a }: { a: Analyte }) {
  const W = 150, H = 44, P = 3, n = DATA.timepoints.length;
  const all = Object.values(a.crew).flat();
  const lo = Math.min(a.refLow, ...all), hi = Math.max(a.refHigh, ...all);
  const x = (i: number) => P + (i / (n - 1)) * (W - 2 * P);
  const y = (v: number) => H - P - ((v - lo) / (hi - lo || 1)) * (H - 2 * P);
  const flightX = (x(2) + x(3)) / 2; // L-3 ile R+1 arası = uçuş (örnek yok)
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="lab-spark" aria-hidden>
      <rect x={0} width={W} y={y(a.refHigh)} height={Math.max(0, y(a.refLow) - y(a.refHigh))} fill="#5ad1e6" opacity={0.08} />
      <line x1={flightX} x2={flightX} y1={0} y2={H} stroke="#5b6b7c" strokeDasharray="2 2" vectorEffect="non-scaling-stroke" />
      {Object.entries(a.crew).map(([cid, vals], ci) => (
        <g key={ci}>
          <polyline points={vals.map((v, i) => `${x(i)},${y(v)}`).join(' ')} fill="none" stroke={CREW_STROKE[ci]} strokeWidth={1.2} vectorEffect="non-scaling-stroke" opacity={0.85} />
          {/* Halka: örneğin KENDİ referans aralığının dışında (aralıklar kişiye/cinsiyete ve örneğe göre değişebilir) */}
          {vals.map((v, i) => { const r = a.crewRef[cid]?.[i]; return r && (v < r[0] || v > r[1]) && <circle key={i} cx={x(i)} cy={y(v)} r={2.4} fill="none" stroke="#e9eef4" strokeWidth={1} vectorEffect="non-scaling-stroke" />; })}
        </g>
      ))}
    </svg>
  );
}

function LabBody({ big }: { big?: boolean }) {
  const lang = useApp((s) => s.lang);
  return (<>
    <div className={`lab-grid ${big ? 'big' : ''}`}>
      {Object.entries(DATA.analytes).map(([id, a]) => {
        const d = ((a.r1Mean - a.preflightMean) / a.preflightMean) * 100;
        return (
          <div key={id} className="lab-card">
            <div className="lab-h"><b>{lang === 'tr' ? TR[id] ?? a.label : a.label}</b><span className="muted">{a.unit}</span></div>
            <Spark a={a} />
            <div className="lab-f num">
              <span title={lang === 'tr' ? 'Uçuş öncesi mürettebat ortalaması → dönüşün 1. günü' : 'Pre-flight crew mean → return day 1'}>{a.preflightMean.toFixed(a.preflightMean < 20 ? 1 : 0)} → {a.r1Mean.toFixed(a.r1Mean < 20 ? 1 : 0)} <small>R+1 {d >= 0 ? '+' : ''}{d.toFixed(0)}%</small></span>
              <span className="muted" title={a.rangeVaries ? (lang === 'tr' ? 'Aralık kişiye/örneğe göre değişir; halka kişinin kendi aralığına göredir' : 'Range varies by person/sample; rings use each sample’s own range') : undefined}>{a.refLow}–{a.refHigh}{a.rangeVaries ? '*' : ''}</span>
            </div>
            {id === 'glucose' && <p className="muted small">{lang === 'tr' ? 'R+45: 3 kişide <65; veri seti açıklamıyor, yorumlanmadı.' : 'R+45: 3 crew <65; unexplained in the dataset, not interpreted.'}</p>}
          </div>
        );
      })}
    </div>
    <div className="lab-legend muted small">{DATA.timepoints.join(' · ')} {lang === 'tr' ? '· kesik çizgi = uçuş · taralı = örnek referans aralığı · halka = kişinin kendi aralığı dışında · * aralık kişiye göre değişir' : '· dashed = flight · shaded = example reference range · ring = outside that person’s own range · * range varies by person'}</div>
    <SourceTags sources={SRC} />
  </>);
}

const NOTE = {
  tr: 'Inspiration4 (Eylül 2021, 3 gün alçak yörünge, 4 sivil mürettebat) gerçek kan değerleri. Uçuş içi örnek yok: L = fırlatmadan önce, R = dönüşten sonra gün. Ortalamalar mürettebat ortalamasıdır (n=4), kişisel taban değildir.',
  en: 'Real Inspiration4 blood values (Sep 2021, 3-day LEO, 4 civilian crew). No in-flight samples: L = days before launch, R = days after return. Means are crew means (n=4), not a personal baseline.',
};

export function LabPanel() {
  const lang = useApp((s) => s.lang);
  const [open, setOpen] = useState(false);
  return (
    <div className="lab">
      <div className="lab-top"><span className="muted small" title={NOTE[lang]}>{lang === 'tr' ? 'Gerçek veri · uçuş içi örnek yok · n=4' : 'Real data · no in-flight samples · n=4'}</span> <ProvTag p="NASA_MEASUREMENT" /><button className="lab-exp" onClick={() => setOpen(true)}>⤢ {lang === 'tr' ? 'Büyüt' : 'Expand'}</button></div>
      <LabBody />
      {open && (
        <div className="gate soft" role="dialog" aria-modal="true" onClick={() => setOpen(false)} onKeyDown={(e) => e.key === 'Escape' && setOpen(false)}>
          <div className="cam-box lab-modal" onClick={(e) => e.stopPropagation()}>
            <header className="panel-h"><span>Inspiration4 · {lang === 'tr' ? 'kan değerleri' : 'blood panel'}</span><button className="x" onClick={() => setOpen(false)} aria-label="close">×</button></header>
            <p className="muted small">{NOTE[lang]}</p>
            <LabBody big />
          </div>
        </div>
      )}
    </div>
  );
}
