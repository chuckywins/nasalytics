// Astronotun kendi bildirdiği belirtiler (VEGA ile sesli/yazılı ya da demo senaryosu). Anlık duruma (snapshot) girer:
// telemetri paketiyle CMO ekranına anında, yer kontrolüne tek yön gecikmeyle ulaşır; AI değerlendirme ve müdahale paneli
// bunu "astronot bildirimi" olarak kullanır. Diğer mürettebat cihazlarına ayrıca kısa bir bildirim (notice) gider.
// Belirti tanı değildir; kart eşleme yalnızca CMO'nun bakacağı ADAY kartı önerir.
// AI notu: Claude (Anthropic) yardımıyla yazılmıştır.
import { create } from 'zustand';

export type SymptomCategory = 'chestPain' | 'breathing' | 'nausea' | 'pain' | 'allergy' | 'dizzy' | 'unwell' | 'other';
export const SYMPTOM_CATEGORIES: SymptomCategory[] = ['chestPain', 'breathing', 'nausea', 'pain', 'allergy', 'dizzy', 'unwell', 'other'];
export interface SymptomReport { id: string; t: number; category: SymptomCategory; quote: string; source: 'vega' | 'scenario' | 'tap' | 'system' }

const KEEP_MS = 30 * 60_000;
interface SymState { list: SymptomReport[] }
export const useSymptoms = create<SymState>(() => ({ list: [] }));

/** Yeni bildirim ekle (en fazla 5, 30 dk). Notice gönderimi telemetry.ts'de (döngüsel içe aktarmayı önlemek için kancayla). */
let onReport: ((r: SymptomReport) => void) | null = null;
export function setSymptomHook(fn: (r: SymptomReport) => void) { onReport = fn; }
export function reportSymptom(category: SymptomCategory, quote: string, source: SymptomReport['source'] = 'vega'): SymptomReport {
  const r: SymptomReport = { id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, t: Date.now(), category: SYMPTOM_CATEGORIES.includes(category) ? category : 'other', quote: quote.slice(0, 200), source };
  useSymptoms.setState((s) => ({ list: [...s.list.filter((x) => r.t - x.t < KEEP_MS), r].slice(-5) }));
  onReport?.(r);
  return r;
}
export function clearSymptoms() { useSymptoms.setState({ list: [] }); }
/** Snapshot için: son 30 dk */
export function recentSymptoms() { const now = Date.now(); return useSymptoms.getState().list.filter((x) => now - x.t < KEEP_MS).map((x) => ({ id: x.id, category: x.category, quote: x.quote, minutesAgo: Math.round((now - x.t) / 60000), source: x.source })); }
