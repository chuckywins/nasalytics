// Kişisel taban: bu oturumda, dinlenme etkinliğinde ve senaryo dışında ölçülen nabzın medyanı.
// YALNIZ BAĞLAM: alarm/eşik mantığı değişmez (eşikler sabit, kaynaklı). En az 6 örnek (~1 dk) olmadan gösterilmez.
// AI notu: Claude (Anthropic) yardımıyla yazılmıştır.
import { create } from 'zustand';
import { useApp, evalLatest } from './store';
import { useScenario } from './scenario';

const MAX = 180; // 10 sn'de bir → son 30 dk
export const useBaseline = create<{ hr: number[] }>(() => ({ hr: [] }));
let lastAt = 0;

/** Telemetri döngüsünden çağrılır (2 sn); 10 sn'de bir örnek alır */
export function sampleBaseline() {
  const now = Date.now();
  if (now - lastAt < 10_000) return;
  const a = useApp.getState();
  if (a.activity !== 'rest' || useScenario.getState().id || !a.sessionStarted) return;
  const v = evalLatest(a.readings, 'heartRate').reading.value;
  if (!Number.isFinite(v)) return;
  lastAt = now;
  useBaseline.setState((s) => ({ hr: [...s.hr, v].slice(-MAX) }));
}

const median = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };

/** { median, n, delta } ya da yeterli örnek yoksa null */
export function hrBaseline(current?: number) {
  const hr = useBaseline.getState().hr;
  if (hr.length < 6) return null;
  const med = Math.round(median(hr));
  const cur = current ?? evalLatest(useApp.getState().readings, 'heartRate').reading.value;
  return { median: med, n: hr.length, minutes: Math.round(hr.length / 6), delta: Math.round(cur - med) };
}
