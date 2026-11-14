// Çekirdek tipler. AI notu: Claude (Anthropic) yardımıyla yazılmıştır.

/** Ekrandaki her sayının kökeni (jüri: "bu sayı nereden geliyor?") */
export type Provenance =
  | 'NASA_MEASUREMENT'   // NASA'nın ölçtüğü gerçek veri (TEPC, RadLab, I4)
  | 'NASA_STANDARD'      // NASA-STD-3001 eşiği
  | 'CLINICAL_GUIDELINE' // AHA / ADA / CDC / AASM gibi klinik kılavuz
  | 'PUBLISHED'          // hakemli yayın
  | 'SIMULATED'          // simülasyon değeri
  | 'USER_INPUT'         // astronotun girdiği ölçüm
  | 'CAMERA'             // kamerayla okunup (Claude vision) astronotun onayladığı ölçüm
  | 'PROJECTION'         // NASA oranlarından hesaplanan tahmin
  | 'ASSUMPTION';        // açıkça belirtilen varsayım

export type Status = 'ok' | 'watch' | 'warn' | 'critical' | 'unknown';

export type Region =
  | 'heart' | 'lungs' | 'brain' | 'eyes' | 'inner_ear' | 'kidneys'
  | 'metabolic' | 'bone' | 'bone_load' | 'muscle';

export interface SourceRef { label: string; url: string; }

/** Kan şekeri bağlamı: açlık veya tokluk (yemekten ~2 saat sonra) eşikleri farklıdır */
export type GlucoseCtx = 'fasting' | 'postprandial';
/** Aktivite: nabız ve solunum eşiklerini kaydırır (egzersiz/EVA'da yüksek nabız beklenir) */
export type Activity = 'rest' | 'exercise' | 'eva';
export interface EvalOpts { glucose?: GlucoseCtx; activity?: Activity; }

export interface IndicatorDef {
  id: IndicatorId;
  unit: string;
  /** stream = giyilebilir sensörden sürekli akış (simüle); spot = astronotun aralıklı ölçümü (kalıcı) */
  mode: 'stream' | 'spot';
  regions: Region[];
  evaluate: (v: number, opts?: EvalOpts) => { status: Status; labelKey: string };
  thresholdProvenance: Provenance;
  sources: SourceRef[];
  decimals: number;
  /** Simülatörün varsayılan (normal) değeri, gürültüsü ve giriş için geçerli aralık */
  sim: { base: number; noise: number; min: number; max: number };
}

export type IndicatorId =
  | 'heartRate' | 'systolic' | 'diastolic' | 'spo2' | 'respRate' | 'bodyTemp'
  | 'glucose' | 'sleepHours' | 'mood' | 'cabinCO2';

export interface Reading { t: number; value: number; provenance: Provenance; ctx?: GlucoseCtx; }

export type Escalation = 'self' | 'crew' | 'ground';
