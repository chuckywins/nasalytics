// Kemik ve kas kaybına karşı NASA egzersiz özeti (organ paneli ve günlük rutin). Yük/set/tekrar YOK; her satır kaynaklı.
// AI notu: Claude (Anthropic) yardımıyla yazılmıştır.
import { create } from 'zustand';
import { asset } from '../base';
import { createPortal } from 'react-dom';
import { useApp } from '../store';
import { t } from '../i18n';
import { EX_TARGETS, EX_SESSION, EX_MOVES, EX_NOTE, EX_ANIM, EX_TEXT_ONLY, EX_ANIM_CREDIT, exEquipment, type ExAnim } from '../engine/exercise';
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

/** Egzersiz modu penceresi: tek yerden açılır (rutin düğmesi, organ paneli, üst çubukta "Egzersiz" seçimi) */
export const useExModal = create<{ open: boolean; tab: 'moves' | 'plan'; show: (tab?: 'moves' | 'plan') => void; hide: () => void }>((set) => ({
  open: false, tab: 'moves', show: (tab = 'moves') => set({ open: true, tab }), hide: () => set({ open: false }),
}));

function MoveCard({ a, lang }: { a: ExAnim; lang: 'tr' | 'en' }) {
  return (
    <figure className="ex-card">
      <img src={asset(a.file)} alt={a.name[lang]} loading="lazy" width={200} height={200} />
      <figcaption>
        <b>{a.name[lang]}</b>
        <span className="small">→ {a.site[lang]}</span>
        <span className="small muted">{a.iss[lang]} · {a.srcs.map((x, i) => <a key={i} href={x.url} target="_blank" rel="noreferrer" className="ex-src">{(x.label.match(/M?TB-0\d\d/)?.[0] ?? 'NASA')} {x.label.split('·')[1]?.trim()} </a>)}</span>
        {a.note && <span className="small muted">{a.note[lang]}</span>}
      </figcaption>
    </figure>
  );
}

export function ExerciseModal() {
  const lang = useApp((s) => s.lang);
  const { open, tab, show, hide } = useExModal();
  if (!open) return null;
  return createPortal(
    <div className="gate soft" role="dialog" aria-modal="true" aria-label={t('ex.mode', lang)} onClick={hide} onKeyDown={(e) => e.key === 'Escape' && hide()}>
      <div className="rem-box ex-box" onClick={(e) => e.stopPropagation()}>
        <header className="panel-h"><span>{t('ex.mode', lang)}</span><button className="x" aria-label="close" onClick={hide} autoFocus>×</button></header>
        <div className="seg small ex-tabs" role="tablist">
          <button role="tab" aria-selected={tab === 'moves'} className={tab === 'moves' ? 'on' : ''} onClick={() => show('moves')}>{t('ex.tabMoves', lang)}</button>
          <button role="tab" aria-selected={tab === 'plan'} className={tab === 'plan' ? 'on' : ''} onClick={() => show('plan')}>{t('ex.tabPlan', lang)}</button>
        </div>
        {tab === 'moves' ? (
          <>
            <p className="small ex-earth">{t('ex.earthNote', lang)}</p>
            <div className="ex-grid">{EX_ANIM.map((a) => <MoveCard key={a.id} a={a} lang={lang} />)}</div>
            <div className="small"><b>{t('ex.textOnly', lang)}:</b> {EX_TEXT_ONLY.map((x) => x[lang]).join(' · ')}</div>
            <p className="small muted">{EX_NOTE[lang]}</p>
            <p className="small muted"><a href={EX_ANIM_CREDIT.url} target="_blank" rel="noreferrer">{EX_ANIM_CREDIT.label}</a> · {t('ex.docs', lang)}: NASA OCHMO-TB-031 (2023), OCHMO-MTB-013 Rev D (2026)</p>
          </>
        ) : <ExercisePlan />}
      </div>
    </div>, document.body);
}

/** Günlük rutindeki egzersiz görevinin yanındaki düğme → egzersiz modu penceresi */
export function ExercisePlanButton() {
  const lang = useApp((s) => s.lang);
  const show = useExModal((s) => s.show);
  return (
    // görev düğmesinin içinde: iç içe <button> olmasın diye role=button
    <span role="button" tabIndex={0} className="ex-btn small" onClick={(e) => { e.stopPropagation(); show('moves'); }}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); show('moves'); } }}>▶ {t('ex.button', lang)}</span>
  );
}
