// Uygulama durumu (zustand).
// stream göstergeler (nabız, SpO₂, solunum, kabin CO₂) giyilebilir sensör/kabin akışı olarak simüle edilir.
// spot göstergeler (KB, şeker, ısı, uyku, ruh hâli) astronotun ölçümüdür: KALICIDIR, simülatör üzerine yazmaz.
// AI notu: Claude (Anthropic) yardımıyla yazılmıştır.
import { create } from 'zustand';
import type { Activity, Escalation, GlucoseCtx, IndicatorId, Reading, Region, Status } from './engine/types';
import { INDICATORS, INDICATOR_ORDER, worst, statusRank } from './engine/indicators';
import type { EnvId } from './engine/environment';
import type { Lang } from './i18n';

const HISTORY = 300;
export interface AiAssessment { headline: string; assessment: string; actions: string[]; escalate?: Escalation; cues?: string[]; confidence?: string; }
export interface AiState { status: 'idle' | 'loading' | 'ok' | 'error'; data?: AiAssessment; at?: number; latencyMs?: number; model?: string; error?: string; signature?: string; }
export type Layer = 'organs' | 'skeleton' | 'muscle';

interface State {
  lang: Lang;
  env: EnvId;
  missionDay: number;
  layers: Record<Layer, boolean>;
  readings: Record<IndicatorId, Reading[]>;
  /** stream göstergeler için simülatör hedefi (senaryolar bunu değiştirir) */
  target: Partial<Record<IndicatorId, number>>;
  cabin: { o2Pct: number; pressurePsia: number };
  selectedRegion: Region | null;
  selectedIndicator: IndicatorId;
  activity: Activity;
  /** Ses/konuşma izni için kullanıcı etkileşimi gerekir (tarayıcı otomatik ses çalmayı engeller) */
  sessionStarted: boolean;
  /** Onaylanmış kritik uyarılar (gösterge kimliği); yeni kritik giriş alarmı yeniden çalar */
  acked: IndicatorId[];
  ai: AiState;
  setAi: (a: Partial<AiState>) => void;
  setActivity: (a: Activity) => void;
  startSession: () => void;
  ack: (ids: IndicatorId[]) => void;
  setLang: (l: Lang) => void;
  setEnv: (e: EnvId) => void;
  setMissionDay: (d: number) => void;
  toggleLayer: (l: Layer) => void;
  selectRegion: (r: Region | null) => void;
  selectIndicator: (i: IndicatorId) => void;
  addReading: (id: IndicatorId, value: number, ctx?: GlucoseCtx, prov?: 'USER_INPUT' | 'CAMERA') => void;
  tick: () => void;
}

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

function init() {
  const now = Date.now();
  const r = {} as Record<IndicatorId, Reading[]>;
  for (const id of INDICATOR_ORDER) {
    const d = INDICATORS[id];
    if (d.mode === 'stream') {
      r[id] = Array.from({ length: 90 }, (_, i) => ({ t: now - (90 - i) * 2000, value: d.sim.base + (Math.random() - 0.5) * d.sim.noise, provenance: 'SIMULATED' as const }));
    } else {
      // Başlangıç: sabah rutini ölçümü gibi, birkaç saat önce alınmış tek simüle değer
      const ctx: GlucoseCtx | undefined = id === 'glucose' ? 'fasting' : undefined;
      r[id] = [{ t: now - 3 * 3600_000, value: d.sim.base, provenance: 'SIMULATED' as const, ctx }];
    }
  }
  return r;
}

export const useApp = create<State>((set) => ({
  lang: 'tr',
  env: 'iss',
  missionDay: 42,
  layers: { organs: true, skeleton: true, muscle: true },
  readings: init(),
  target: {},
  cabin: { o2Pct: 21.0, pressurePsia: 14.7 },
  selectedRegion: null,
  selectedIndicator: 'heartRate',
  activity: 'rest',
  sessionStarted: false,
  acked: [],
  ai: { status: 'idle' },
  setAi: (a) => set((s) => ({ ai: { ...s.ai, ...a } })),
  setActivity: (activity) => set({ activity }),
  startSession: () => set({ sessionStarted: true }),
  ack: (ids) => set((s) => ({ acked: Array.from(new Set([...s.acked, ...ids])) })),
  setLang: (lang) => set({ lang }),
  setEnv: (env) => set({ env }),
  setMissionDay: (missionDay) => set({ missionDay }),
  toggleLayer: (l) => set((s) => ({ layers: { ...s.layers, [l]: !s.layers[l] } })),
  selectRegion: (selectedRegion) => set({ selectedRegion }),
  selectIndicator: (selectedIndicator) => set({ selectedIndicator }),
  addReading: (id, value, ctx, prov = 'USER_INPUT') => set((st) => {
    const d = INDICATORS[id];
    const next = { ...st.readings, [id]: [...st.readings[id], { t: Date.now(), value, provenance: prov, ctx }].slice(-HISTORY) };
    // stream göstergeye elle değer girilirse simülatör bu değeri yeni hedef alır (ör. manuel nabız ölçümü)
    const target = d.mode === 'stream' ? { ...st.target, [id]: value } : st.target;
    return { readings: next, target };
  }),
  tick: () => set((st) => {
    const now = Date.now();
    const next = { ...st.readings };
    for (const id of INDICATOR_ORDER) {
      const d = INDICATORS[id];
      if (d.mode !== 'stream') continue;
      const s = d.sim;
      const goal = st.target[id] ?? s.base;
      const last = st.readings[id][st.readings[id].length - 1];
      const drift = (goal - last.value) * 0.15 + (Math.random() - 0.5) * s.noise;
      next[id] = [...st.readings[id], { t: now, value: clamp(last.value + drift, s.min, s.max), provenance: 'SIMULATED' as const }].slice(-HISTORY);
    }
    const cabin = { o2Pct: clamp(st.cabin.o2Pct + (21 - st.cabin.o2Pct) * 0.1 + (Math.random() - 0.5) * 0.05, 15, 30), pressurePsia: clamp(st.cabin.pressurePsia + (14.7 - st.cabin.pressurePsia) * 0.1 + (Math.random() - 0.5) * 0.02, 4, 15.2) };
    return { readings: next, cabin };
  }),
}));

export const latest = (r: Reading[]) => r[r.length - 1];

/** Aktivite son değişim zamanı (kararlı durum penceresi bunu başlangıç alır) */
let activityChangedAt = 0;
useApp.subscribe((s, prev) => { if (s.activity !== prev.activity) activityChangedAt = Date.now(); });

export function evalLatest(readings: Record<IndicatorId, Reading[]>, id: IndicatorId) {
  const r = latest(readings[id]);
  return { reading: r, ...INDICATORS[id].evaluate(r.value, { glucose: r.ctx, activity: useApp.getState().activity }) };
}

/** Bölge durumu = o bölgeye bağlı göstergelerin en kötüsü */
export function regionStatuses(readings: Record<IndicatorId, Reading[]>): Partial<Record<Region, Status>> {
  const out: Partial<Record<Region, Status>> = {};
  for (const id of INDICATOR_ORDER) {
    const st = evalLatest(readings, id).status;
    for (const reg of INDICATORS[id].regions) out[reg] = worst(out[reg] ?? 'ok', st);
  }
  return out;
}

/** Kararlı durum: akış göstergelerinde son 30 sn'nin EN KÖTÜ durumu (eşik çevresindeki gürültü titremesini önler).
 *  AI değerlendirme tetikleyicisi bunu kullanır → eşikte salınan değer her birkaç saniyede yeni AI isteği doğurmaz. */
export function stableStatus(readings: Record<IndicatorId, Reading[]>, id: IndicatorId): Status {
  const d = INDICATORS[id];
  if (d.mode !== 'stream') return evalLatest(readings, id).status;
  // Yalnızca SON aktivite değişiminden sonraki okumalar: egzersizde alınan 150, dinlenmeye dönünce "kritik" sayılmaz
  const since = Math.max(Date.now() - 30_000, activityChangedAt), act = useApp.getState().activity;
  return readings[id].filter((r) => r.t >= since).reduce<Status>((w, r) => worst(w, d.evaluate(r.value, { glucose: r.ctx, activity: act }).status), evalLatest(readings, id).status);
}

/** Aktif uyarılar, en ciddiden en hafife (diastolik, sistolikle aynı KB kartında gösterilir) */
export function activeAlerts(readings: Record<IndicatorId, Reading[]>) {
  return INDICATOR_ORDER
    .map((id) => ({ id, ...evalLatest(readings, id) }))
    .filter((a) => a.status !== 'ok' && a.status !== 'unknown')
    .sort((a, b) => statusRank(b.status) - statusRank(a.status));
}
