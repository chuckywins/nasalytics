// Mürettebat: KURGUSAL 3 kişilik örnek ekip (gerçek kişiler değildir) + her üyenin sağlık kaydı (cihazda, üye başına saklanır).
// Kayıt anlık duruma (snapshot) girer → CMO ekranı ve AI görür. Alerji kontrolü: kayıttaki alerji ile önerilen ilacın/kit
// kaleminin adı (veya eş adı) eşleşirse ekranda engel uyarısı. Ad eşleştirmedir, klinik karar değildir.
// Kişisel program: yalnız kaynaklı hesaplar (BMI: CDC; maks. nabız ≈ 220−yaş: AHA; T2 bandı %70–100 HRmax: NASA TB-031).
// AI notu: Claude (Anthropic) yardımıyla yazılmıştır.
import { create } from 'zustand';

export interface CrewRecord {
  name: string; role: string; country: string;
  age: string; sex: '' | 'F' | 'M'; heightCm: string; massKg: string; blood: string;
  allergies: string; meds: string; restingHr: string;
}
const EMPTY: CrewRecord = { name: '', role: '', country: '', age: '', sex: '', heightCm: '', massKg: '', blood: '', allergies: '', meds: '', restingHr: '' };

/** Kurgusal örnek mürettebat (demo verisi) */
export const ROSTER: { id: string; rec: CrewRecord }[] = [
  { id: 'C-01', rec: { name: 'Elif Arslan', role: 'Uçuş mühendisi / Flight engineer', country: 'TR', age: '34', sex: 'F', heightCm: '165', massKg: '58', blood: '0+', allergies: '', meds: '', restingHr: '62' } },
  { id: 'C-02', rec: { name: 'Mateo Ruiz', role: 'Komutan / Commander', country: 'ES', age: '46', sex: 'M', heightCm: '181', massKg: '84', blood: 'A+', allergies: 'penisilin', meds: '', restingHr: '58' } },
  { id: 'C-03', rec: { name: 'Hana Sato', role: 'Sağlık görevlisi (CMO) / Crew medical officer', country: 'JP', age: '39', sex: 'F', heightCm: '160', massKg: '53', blood: 'B+', allergies: 'aspirin', meds: '', restingHr: '66' } },
];
export const ROSTER_IDS = ROSTER.map((r) => r.id);
export const rosterName = (id: string) => ROSTER.find((r) => r.id === id)?.rec.name ?? '';

const LS = (id: string) => `ahm.record.${id}`;
const load = (id: string): CrewRecord => {
  const base = ROSTER.find((r) => r.id === id)?.rec ?? EMPTY;
  try { return { ...base, ...JSON.parse(localStorage.getItem(LS(id)) ?? '{}') }; } catch { return base; }
};

export type RecTab = 'profile' | 'program' | 'history';
interface RecState { id: string; rec: CrewRecord; open: boolean; tab: RecTab; save: (r: CrewRecord) => void; show: (b: boolean, tab?: RecTab) => void; setCrew: (id: string) => void; reset: () => void }
export const useRecord = create<RecState>((set, get) => ({
  id: 'C-01', rec: load('C-01'), open: false, tab: 'profile',
  save: (rec) => { try { localStorage.setItem(LS(get().id), JSON.stringify(rec)); } catch { /* yok */ } set({ rec }); },
  show: (open, tab) => set(tab ? { open, tab } : { open }),
  setCrew: (id) => set({ id, rec: load(id) }),
  reset: () => { try { localStorage.removeItem(LS(get().id)); } catch { /* yok */ } set({ rec: load(get().id) }); },
}));

/* ---------- Kaynaklı hesaplar ---------- */
export const num = (s: string) => { const v = parseFloat(String(s).replace(',', '.')); return Number.isFinite(v) && v > 0 ? v : null; };
/** BMI = kg / m² ; sınıflar CDC yetişkin BMI kategorileri */
export function bmiOf(r: CrewRecord) {
  const h = num(r.heightCm), m = num(r.massKg);
  if (!h || !m) return null;
  const v = m / (h / 100) ** 2;
  const cat = v < 18.5 ? 'under' : v < 25 ? 'healthy' : v < 30 ? 'over' : 'obese';
  return { value: Math.round(v * 10) / 10, cat };
}
/** Yaşa göre tahmini maks. nabız ≈ 220 − yaş (AHA) ve NASA T2 koşu bandı hedefi %70–100 HRmax (TB-031 s. 11) */
export function hrPlan(r: CrewRecord) {
  const a = num(r.age);
  if (!a) return null;
  const max = Math.round(220 - a);
  return { max, t2Lo: Math.round(max * 0.7), t2Hi: max };
}

/** Snapshot için: yalnız doldurulmuş alanlar + kaynaklı hesaplar */
export function recordForSnapshot() {
  const { rec: r, id } = useRecord.getState();
  const o: Record<string, string | number> = {};
  for (const [k, v] of Object.entries(r)) if (String(v).trim()) o[k] = /^(age|heightCm|massKg|restingHr)$/.test(k) ? Number(v) : String(v).trim().slice(0, 160);
  if (!Object.keys(o).length) return null;
  const b = bmiOf(r), h = hrPlan(r);
  return { ...o, crewId: id, bmi: b?.value, bmiCategoryCDC: b?.cat, hrMaxEstimate220MinusAge: h?.max, t2TargetBpm: h ? `${h.t2Lo}-${h.t2Hi}` : undefined, note: 'fictional demo crew member; record self-entered' } as Record<string, string | number | undefined> & { allergies?: string; blood?: string; name?: string };
}

// Alerji terimi → ilaç adlarında aranacak kalıplar (ISS/STS kitindeki adlar dahil)
const SYN: [RegExp, string[]][] = [
  [/aspirin|asetilsalisil|acetylsalicyl|\basa\b/, ['aspirin', 'acetylsalicyl']],
  [/parasetamol|paracetamol|asetaminofen|acetaminophen|tylenol/, ['tylenol', 'acetaminophen', 'paracetamol']],
  [/ibuprofen|motrin|advil/, ['motrin', 'ibuprofen', 'advil']],
  [/nsaid|nsai|steroid olmayan/, ['aspirin', 'motrin', 'ibuprofen', 'naproxen', 'ketorolac', 'toradol']],
  [/penisilin|penicillin|amoksisilin|amoxicillin/, ['penicillin', 'amoxicillin', 'augmentin', 'ampicillin']],
  [/sulfa|sulfonamid/, ['sulfamethoxazole', 'bactrim', 'sulfa']],
  [/epinefrin|epinephrine|adrenalin/, ['epinephrine', 'epipen', 'adrenalin']],
  [/prometazin|promethazine|phenergan/, ['phenergan', 'promethazine']],
  [/diazepam|valium|benzodiazepin/, ['diazepam', 'valium', 'restoril', 'temazepam', 'lorazepam', 'ativan']],
  [/fenitoin|phenytoin|dilantin/, ['phenytoin', 'dilantin']],
  [/albuterol|salbutamol/, ['albuterol', 'proventil', 'salbutamol']],
];
const fold = (s: string) => s.toLocaleLowerCase('tr').replace(/ı/g, 'i').replace(/ş/g, 's').replace(/ç/g, 'c').replace(/ğ/g, 'g').replace(/ö/g, 'o').replace(/ü/g, 'u');

/** Kayıttaki alerjilerden ilaç adıyla eşleşen ilk terimi döndürür (yoksa null) */
export function allergyHit(drugName: string, allergies: string | undefined | null): string | null {
  if (!allergies?.trim() || !drugName) return null;
  const name = fold(drugName);
  for (const raw of allergies.split(/[,;\n/]+/)) {
    const term = fold(raw.trim());
    if (term.length < 3) continue;
    if (term.length >= 4 && name.includes(term)) return raw.trim();
    for (const [re, pats] of SYN) if (re.test(term) && pats.some((p) => name.includes(p))) return raw.trim();
  }
  return null;
}
