// Kemik ve kas kaybına karşı NASA egzersiz özeti (organ paneli ve günlük rutin). Yük/set/tekrar YOK; her satır kaynaklı.
// AI notu: Claude (Anthropic) yardımıyla yazılmıştır.
import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useApp } from '../store';
import { t } from '../i18n';
import { EX_TARGETS, EX_SESSION, EX_MOVES, EX_NOTE, exEquipment } from '../engine/exercise';
import { ProvTag } from './Hud';

export function ExercisePlan({ compact = false }: { compact?: boolean }) {
  const lang = useApp((s) => s.lang);
  const env = useApp((s) => s.env);
  const eq = exEquipment(env);
  const link = (s: { label: string; url: string }) => <a href={s.url} target="_blank" rel="noreferrer" className="ex-src">{(s.label.match(/M?TB-0\d\d/)?.[0] ?? 'NASA')} {s.label.split('·')[1]?.trim() ?? ''} ↗</a>;
  return (
    <div className={`ex-plan ${compact ? 'compact' : ''}`}>
      <div className="ex-h"><b>{t('ex.title', lang)}</b> <ProvTag p="PUBLISHED" /></div>
      <div className="ex-sec"><b className="small">{t('ex.targets', lang)}</b>
        <ul className="small">{EX_TARGETS.map((x) => <li key={x.code}>{x.text[lang]} <span className="muted">[{x.code}]</span></li>)}</ul></div>
      <div className="ex-sec"><b className="small">{t('ex.session', lang)}</b>
        <ul className="small">{EX_SESSION.map((x, i) => <li key={i}>{x.text[lang]} {link(x.src)}</li>)}</ul></div>
      <div className="ex-sec"><b className="small">{t('ex.moves', lang)}</b>
        <ul className="small">{EX_MOVES.map((x, i) => <li key={i}><b>{x.name[lang]}</b> → {x.site[lang]} {link(x.src)}{x.note && <div className="muted">{x.note[lang]}</div>}</li>)}</ul></div>
      <div className="ex-sec small"><b>{t('ex.equipment', lang)}:</b> {eq.text[lang]} {eq.src && link(eq.src)}</div>
      <p className="small muted">{EX_NOTE[lang]}</p>
      <p className="small muted">{t('ex.docs', lang)}: NASA OCHMO-TB-031 (2023), OCHMO-MTB-013 Rev D (2026).</p>
    </div>
  );
}

/** Günlük rutindeki egzersiz görevinin yanındaki "NASA planı" düğmesi → pencere */
export function ExercisePlanButton() {
  const lang = useApp((s) => s.lang);
  const [open, setOpen] = useState(false);
  return (
    <>
      {/* görev düğmesinin içinde: iç içe <button> olmasın diye role=button */}
      <span role="button" tabIndex={0} className="ex-btn small" onClick={(e) => { e.stopPropagation(); setOpen(true); }}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); setOpen(true); } }}>ⓘ {t('ex.button', lang)}</span>
      {open && createPortal(
        <div className="gate soft" role="dialog" aria-modal="true" onClick={() => setOpen(false)} onKeyDown={(e) => e.key === 'Escape' && setOpen(false)}>
          <div className="rem-box ex-box" onClick={(e) => e.stopPropagation()}>
            <header className="panel-h"><span>{t('ex.title', lang)}</span><button className="x" aria-label="close" onClick={() => setOpen(false)} autoFocus>×</button></header>
            <ExercisePlan />
          </div>
        </div>, document.body)}
    </>
  );
}
