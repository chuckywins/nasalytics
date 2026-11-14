// Telefon algılama: dar ekran (≤760 px) veya kısa yatay ekran (≤500 px yükseklik, dokunmatik). Masaüstü düzenine dokunulmaz.
// AI notu: Claude (Anthropic) yardımıyla yazılmıştır.
import { useEffect, useState } from 'react';

const Q = '(max-width: 760px), (max-height: 500px) and (pointer: coarse)';
export const isMobileNow = () => typeof window !== 'undefined' && window.matchMedia(Q).matches;
export function useIsMobile() {
  const [m, setM] = useState(isMobileNow);
  useEffect(() => {
    const mq = window.matchMedia(Q);
    const on = () => setM(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return m;
}
