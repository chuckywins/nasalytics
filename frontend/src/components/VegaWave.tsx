// VEGA ses dalgası: dinlerken astronotun sesi (cyan), VEGA konuşurken onun sesi (mor). Görsel amaçlı; ölçüm değildir.
// Masaüstünde gerçek mikrofon seviyesi; telefonda konuşma tanıma sonuçlarının akışı (mikrofonu ikinci kez açmak tanımayı bozabiliyor).
// AI notu: Claude (Anthropic) yardımıyla yazılmıştır.
import { useEffect, useRef } from 'react';
import { micLevel, outputLevel } from '../audio';

/** Telefonda konuşma tanıma her ara sonuç verdiğinde çağrılır → dalga kabarır */
let bumpAt = 0;
export function waveBump() { bumpAt = performance.now(); }

export function VegaWave({ listening }: { listening: boolean }) {
  const cv = useRef<HTMLCanvasElement>(null);
  const lv = useRef(0);
  const live = useRef(listening);
  live.current = listening;
  useEffect(() => {
    const c = cv.current; if (!c) return;
    const g = c.getContext('2d'); if (!g) return;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    let raf = 0, ph = 0;
    const draw = () => {
      const w = c.clientWidth, h = c.clientHeight, dpr = Math.min(2, devicePixelRatio || 1);
      if (c.width !== Math.round(w * dpr) || c.height !== Math.round(h * dpr)) { c.width = Math.round(w * dpr); c.height = Math.round(h * dpr); }
      g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, w, h);
      const out = outputLevel();
      const speaking = out > 0.01;
      const bump = Math.max(0, 1 - (performance.now() - bumpAt) / 500) * 0.55;
      const target = live.current ? Math.max(micLevel() * 3.5, bump, 0.14) : speaking ? out * 3.5 : 0.015;
      lv.current += (Math.min(1, target) - lv.current) * 0.25;
      ph += reduced ? 0 : 0.09 + lv.current * 0.25;
      const color = live.current ? '90,209,230' : speaking ? '167,139,250' : '90,209,230';
      const mid = h / 2;
      for (let k = 0; k < 3; k++) {
        const amp = lv.current * h * (0.48 - k * 0.12) + 1;
        const freq = 0.018 + k * 0.009;
        g.beginPath();
        for (let x = 0; x <= w; x += 3) {
          const env = Math.sin((Math.PI * x) / w); // kenarlarda sönümlenir
          const y = mid + Math.sin(x * freq + ph * (1 + k * 0.4)) * amp * env;
          if (x === 0) g.moveTo(x, y); else g.lineTo(x, y);
        }
        g.strokeStyle = `rgba(${color},${0.55 - k * 0.15})`; g.lineWidth = 2.4 - k * 0.6; g.stroke();
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, []);
  return <canvas ref={cv} className="vega-wave" aria-hidden />;
}
