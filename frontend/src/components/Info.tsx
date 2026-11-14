// Info (i) ikonu + "bu değer nereden geliyor" kutusu, ve link yerine kompakt kaynak etiketleri.
// Kutu body'ye portal ile çizilir (panellerin overflow:hidden'ı kesmesin). Fare, klavye odağı veya tıklama ile açılır.
// AI notu: Claude (Anthropic) yardımıyla yazılmıştır.
import { useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { MEASURE } from '../engine/measurement';
import type { SourceRef } from '../engine/types';
import { useApp } from '../store';
import { t } from '../i18n';

export function InfoTip({ k }: { k: keyof typeof MEASURE | string }) {
  const lang = useApp((s) => s.lang);
  const info = MEASURE[k];
  const ref = useRef<HTMLButtonElement>(null);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const [pinned, setPinned] = useState(false);
  const id = useId();
  if (!info) return null;
  const open = () => {
    const r = ref.current!.getBoundingClientRect();
    const W = 340, H = 260;
    const x = Math.min(window.innerWidth - W - 8, Math.max(8, r.left));
    const y = r.bottom + H + 8 > window.innerHeight ? Math.max(8, r.top - H - 6) : r.bottom + 6;
    setPos({ x, y });
  };
  const close = () => { if (!pinned) setPos(null); };
  return (
    <>
      <button ref={ref} type="button" className="info" aria-label={t('info.label', lang)} aria-describedby={pos ? id : undefined}
        onMouseEnter={open} onMouseLeave={close} onFocus={open} onBlur={() => { setPinned(false); setPos(null); }}
        onClick={(e) => { e.stopPropagation(); if (pinned) { setPinned(false); setPos(null); } else { setPinned(true); open(); } }}>i</button>
      {pos && createPortal(
        <div id={id} role="tooltip" className="infobox" style={{ left: pos.x, top: pos.y }}>
          <p><b>{t('info.inSpace', lang)}</b> {info.inSpace[lang]}</p>
          <p><b>{t('info.here', lang)}</b> {info.here[lang]}</p>
          <p><b>{t('info.why', lang)}</b> {info.why[lang]}</p>
          <SourceTags sources={info.sources} />
        </div>, document.body)}
    </>
  );
}

/** Link yerine kompakt kaynak etiketi: kısa ad + ↗. Okumak zorunlu değil, ek kaynak. */
export function SourceTags({ sources, max = 3 }: { sources: SourceRef[]; max?: number }) {
  const lang = useApp((s) => s.lang);
  if (!sources.length) return null;
  return (
    <div className="srctags"><span className="muted">{t('ui.source', lang)}:</span>
      {sources.slice(0, max).map((s) => (
        <a key={s.url} className="srctag" href={s.url} target="_blank" rel="noreferrer" title={s.label} onClick={(e) => e.stopPropagation()}>{s.label} ↗</a>
      ))}
    </div>
  );
}

/** Öneri metnini ≤3 emir kipli adıma böler (cümle sınırı). */
export const toSteps = (text: string) => text.split(/(?<=[.!])\s+/).map((s) => s.trim().replace(/\.$/, '')).filter(Boolean).slice(0, 3);
