// Görev ortamları: gerçek NASA doz ölçümleri (environments.json) + türetilmiş tahminler.
// Kural: veri yoksa sayı uydurulmaz, "veri yok" gösterilir.
// AI notu: Claude (Anthropic) yardımıyla yazılmıştır.
import envData from '../data/environments.json';

export type EnvId = 'iss' | 'lunar_transit' | 'lunar_surface' | 'mars_transit' | 'mars_surface' | 'deep_space_1au';
export interface Env {
  label: string; gravity_g: number; commDelayOneWaySec: number[];
  absorbedUGyH: number | null; equivalentUSvH?: number; qualityFactor: number | null;
  qProvenance?: string; qSource?: string; doseNote?: string;
  doseSource?: { name: string; url: string; instrument?: string };
}
export const ENVS = envData.environments as unknown as Record<EnvId, Env>;
export const ENV_ORDER: EnvId[] = ['iss', 'lunar_transit', 'lunar_surface', 'mars_transit', 'mars_surface'];
export const ENV_LABEL: Record<EnvId, { tr: string; en: string }> = {
  iss: { tr: 'ISS (alçak yörünge)', en: 'ISS (LEO)' },
  lunar_transit: { tr: 'Orion / Ay transferi', en: 'Orion / lunar transit' },
  lunar_surface: { tr: 'Ay üssü', en: 'Lunar base' },
  mars_transit: { tr: 'Mars transferi', en: 'Mars transit' },
  mars_surface: { tr: 'Mars üssü', en: 'Mars base' },
  deep_space_1au: { tr: 'Gezegenler arası', en: 'Interplanetary' },
};

/** Saatlik doz eşdeğeri (μSv/sa): ölçülmüş H varsa onu, yoksa D × yayımlanmış Q; Q yoksa null */
export function equivUSvH(e: Env): { value: number | null; basis: 'measured' | 'derived' | 'none' } {
  if (e.equivalentUSvH) return { value: e.equivalentUSvH, basis: 'measured' };
  if (e.absorbedUGyH != null && e.qualityFactor != null) return { value: e.absorbedUGyH * e.qualityFactor, basis: 'derived' };
  return { value: null, basis: 'none' };
}

/** Kümülatif doz tahmini (mSv). Dedektör vekil değeridir; efektif doz değildir (etiketle gösterilir). */
export const cumulativeMSv = (e: Env, day: number) => {
  const h = equivUSvH(e).value;
  return h == null ? null : (h * 24 * day) / 1000;
};

/** Kemik mineral yoğunluğu kaybı tahmini: NASA ayda %1–1,5 (yalnızca mikrogravite için; kısmi yerçekiminde veri yok) */
export function boneLossPct(e: Env, day: number): { lo: number; hi: number } | null {
  if (e.gravity_g > 0.05) return null;
  const months = day / 30.44;
  return { lo: months * 1.0, hi: months * 1.5 };
}

/** Tipik görev uzunluğu (gün), zaman çizelgesi için */
export const MISSION_DAYS: Record<EnvId, number> = {
  iss: 180, lunar_transit: 10, lunar_surface: 30, mars_transit: 210, mars_surface: 500, deep_space_1au: 210,
};
