// Mürettebat sağlık kaydı (astronotun kendi girdiği; cihazda saklanır). Anlık duruma (snapshot) girer → CMO ekranı ve AI görür.
// Alerji kontrolü: kayıttaki alerji ile önerilen ilacın/kit kaleminin adı eşleşirse ekranda engel uyarısı.
// Eşleştirme basit ad/eş-ad listesidir (tanı/klinik karar değildir; son karar CMO ve uçuş cerrahında).
// AI notu: Claude (Anthropic) yardımıyla yazılmıştır.
import { create } from 'zustand';

export interface CrewRecord {
  age: string; sex: '' | 'F' | 'M'; heightCm: string; massKg: string; blood: string;
  allergies: string; meds: string; restingHr: string;
}
const EMPTY: CrewRecord = { age: '', sex: '', heightCm: '', massKg: '', blood: '', allergies: '', meds: '', restingHr: '' };
const LS = 'ahm.record';
const load = (): CrewRecord => { try { return { ...EMPTY, ...JSON.parse(localStorage.getItem(LS) ?? '{}') }; } catch { return EMPTY; } };

export const useRecord = create<{ rec: CrewRecord; open: boolean; save: (r: CrewRecord) => void; show: (b: boolean) => void }>((set) => ({
  rec: load(), open: false,
  save: (rec) => { try { localStorage.setItem(LS, JSON.stringify(rec)); } catch { /* yok */ } set({ rec, open: false }); },
  show: (open) => set({ open }),
}));

/** Snapshot için: yalnız doldurulmuş alanlar */
export function recordForSnapshot() {
  const r = useRecord.getState().rec;
  const o: Record<string, string | number> = {};
  for (const [k, v] of Object.entries(r)) if (String(v).trim()) o[k] = /^(age|heightCm|massKg|restingHr)$/.test(k) ? Number(v) : String(v).trim().slice(0, 160);
  return Object.keys(o).length ? ({ ...o, note: 'self-entered by crew member' } as Record<string, string | number> & { allergies?: string; blood?: string }) : null;
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
