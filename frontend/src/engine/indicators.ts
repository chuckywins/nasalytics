// Gösterge tanımları ve deterministik eşik motoru.
// Kural: LLM burada hiçbir karar vermez; tüm durum renkleri bu dosyadaki kaynaklı eşiklerden gelir.
// AI notu: Claude (Anthropic) yardımıyla yazılmıştır. Eşik kaynakları SOURCES.md'de listelidir.
import type { IndicatorDef, IndicatorId, Status, EvalOpts } from './types';

const S = {
  ahaBP: { label: 'AHA: Understanding Blood Pressure Readings', url: 'https://www.heart.org/en/health-topics/high-blood-pressure/understanding-blood-pressure-readings' },
  ahaTarget: { label: 'AHA: Target heart rates (50–85% of max ≈ 220−age)', url: 'https://www.heart.org/en/healthy-living/fitness/fitness-basics/target-heart-rates' },
  ahaHR: { label: 'AHA: All About Heart Rate', url: 'https://www.heart.org/en/health-topics/high-blood-pressure/the-facts-about-high-blood-pressure/all-about-heart-rate-pulse' },
  adaGlu: { label: 'ADA: Diagnosis (fasting glucose)', url: 'https://diabetes.org/about-diabetes/diagnosis' },
  adaHypo: { label: 'ADA: Hypoglycemia', url: 'https://diabetes.org/living-with-diabetes/treatment-care/hypoglycemia' },
  cdcFever: { label: 'CDC: Fever definition (100.4°F / 38.0°C)', url: 'https://www.cdc.gov/quarantine/maritime/definitions-signs-symptoms-conditions-ill-travelers.html' },
  aasm: { label: 'AASM/SRS: Recommended sleep for adults (≥7 h)', url: 'https://aasm.org/resources/pdf/pressroom/adult-sleep-duration-consensus.pdf' },
  nasaCO2: { label: 'NASA-STD-3001 V2 [6004], OCHMO-TB-004 CO₂', url: 'https://nasa.gov/wp-content/uploads/2023/03/co2-technical-brief-ochmo.pdf' },
  nasaRisksBeh: { label: 'NASA HRP: Behavioral conditions risk', url: 'https://www.nasa.gov/reference/risk-of-behavioral-conditions-and-psychiatric-disorders/' },
  nasaSleep: { label: 'NASA HRP: Sleep & irregular schedules risk', url: 'https://www.nasa.gov/reference/risk-from-inadequate-sleep-and-irregular-schedules/' },
  nasaCardio: { label: 'NASA HRP: Cardiovascular adaptations risk', url: 'https://www.nasa.gov/reference/risk-of-cardiovascular-adaptations/' },
  nasaHypoxia: { label: 'NASA HRP: Hypoxia risk / OCHMO-TB-003', url: 'https://www.nasa.gov/reference/risk-of-hypoxia/' },
  i4: { label: 'NASA OSDR OSD-575 (Inspiration4 CMP reference range 65–99 mg/dL)', url: 'https://osdr.nasa.gov/bio/repo/data/studies/OSD-575' },
};

/** Bant yardımcı: [üstSınır, durum, etiket] listesi; değer < üstSınır ilk eşleşen */
const bands = (list: [number, Status, string][]) => (v: number) => {
  for (const [max, status, labelKey] of list) if (v < max) return { status, labelKey };
  return { status: list[list.length - 1][1], labelKey: list[list.length - 1][2] };
};

export const INDICATORS: Record<IndicatorId, IndicatorDef> = {
  heartRate: {
    id: 'heartRate', mode: 'stream', unit: 'bpm', regions: ['heart'], decimals: 0,
    // Dinlenme: AHA 60–100. Egzersiz/EVA: AHA hedef nabız %50–85 × maks. (≈220−yaş; 40 yaş ≈ 180) → ~170'e kadar beklenen.
    evaluate: (v: number, o?: EvalOpts) => (o?.activity && o.activity !== 'rest'
      ? bands([[40, 'critical', 'band.bradySevere'], [50, 'warn', 'band.brady'], [170, 'ok', 'band.exerciseOk'],
          [185, 'watch', 'band.exerciseHigh'], [200, 'warn', 'band.tachyHigh'], [Infinity, 'critical', 'band.tachySevere']])(v)
      : bands([[40, 'critical', 'band.bradySevere'], [50, 'warn', 'band.brady'], [60, 'watch', 'band.lowNormal'],
          [100, 'ok', 'band.normal'], [130, 'watch', 'band.tachy'], [150, 'warn', 'band.tachyHigh'], [Infinity, 'critical', 'band.tachySevere']])(v)),
    thresholdProvenance: 'CLINICAL_GUIDELINE', sources: [S.ahaHR, S.ahaTarget, S.nasaCardio],
    sim: { base: 68, noise: 3, min: 30, max: 220 },
  },
  systolic: {
    id: 'systolic', mode: 'spot', unit: 'mmHg', regions: ['heart'], decimals: 0,
    evaluate: bands([[80, 'critical', 'band.hypotension'], [90, 'warn', 'band.lowBP'], [120, 'ok', 'band.normal'],
      [130, 'watch', 'band.elevated'], [140, 'warn', 'band.stage1'], [180, 'warn', 'band.stage2'], [Infinity, 'critical', 'band.crisis']]),
    thresholdProvenance: 'CLINICAL_GUIDELINE', sources: [S.ahaBP, S.nasaCardio],
    sim: { base: 116, noise: 3, min: 50, max: 230 },
  },
  diastolic: {
    id: 'diastolic', mode: 'spot', unit: 'mmHg', regions: ['heart'], decimals: 0,
    evaluate: bands([[50, 'warn', 'band.lowBP'], [80, 'ok', 'band.normal'], [90, 'warn', 'band.stage1'],
      [120, 'warn', 'band.stage2'], [Infinity, 'critical', 'band.crisis']]),
    thresholdProvenance: 'CLINICAL_GUIDELINE', sources: [S.ahaBP],
    sim: { base: 74, noise: 2, min: 30, max: 140 },
  },
  spo2: {
    id: 'spo2', mode: 'stream', unit: '%', regions: ['lungs'], decimals: 0,
    evaluate: bands([[88, 'critical', 'band.hypoxemiaSevere'], [92, 'warn', 'band.hypoxemia'], [95, 'watch', 'band.lowNormal'], [Infinity, 'ok', 'band.normal']]),
    thresholdProvenance: 'CLINICAL_GUIDELINE', sources: [S.nasaHypoxia],
    sim: { base: 98, noise: 0.6, min: 70, max: 100 },
  },
  respRate: {
    id: 'respRate', mode: 'stream', unit: '/min', regions: ['lungs'], decimals: 0,
    evaluate: (v: number, o?: EvalOpts) => (o?.activity && o.activity !== 'rest'
      ? bands([[8, 'critical', 'band.bradypnea'], [40, 'ok', 'band.exerciseOk'], [50, 'watch', 'band.tachypnea'], [Infinity, 'warn', 'band.tachypneaHigh']])(v)
      : bands([[8, 'critical', 'band.bradypnea'], [12, 'watch', 'band.lowNormal'], [21, 'ok', 'band.normal'], [25, 'watch', 'band.tachypnea'], [Infinity, 'warn', 'band.tachypneaHigh']])(v)),
    thresholdProvenance: 'CLINICAL_GUIDELINE', sources: [],
    sim: { base: 14, noise: 1, min: 4, max: 60 },
  },
  bodyTemp: {
    id: 'bodyTemp', mode: 'spot', unit: '°C', regions: [], decimals: 1,
    evaluate: bands([[35, 'critical', 'band.hypothermia'], [36, 'watch', 'band.lowNormal'], [37.5, 'ok', 'band.normal'],
      [38, 'watch', 'band.subfebrile'], [39.5, 'warn', 'band.fever'], [Infinity, 'critical', 'band.feverHigh']]),
    thresholdProvenance: 'CLINICAL_GUIDELINE', sources: [S.cdcFever],
    sim: { base: 36.8, noise: 0.1, min: 33, max: 42 },
  },
  glucose: {
    id: 'glucose', mode: 'spot', unit: 'mg/dL', regions: ['metabolic'], decimals: 0,
    // Açlık: ADA 70–99 normal, 100–125 prediyabet, ≥126 diyabet aralığı. Tokluk (2 sa): <140 normal, 140–199 yüksek, ≥200 diyabet aralığı.
    // Hipoglisemi her iki bağlamda: <70 seviye 1, <54 seviye 2 (ADA).
    evaluate: (v: number, o?: EvalOpts) => (o?.glucose === 'postprandial'
      ? bands([[54, 'critical', 'band.hypoSevere'], [70, 'warn', 'band.hypo'], [140, 'ok', 'band.normalPost'],
          [200, 'watch', 'band.highPost'], [250, 'warn', 'band.hyper'], [Infinity, 'critical', 'band.hyperSevere']])(v)
      : bands([[54, 'critical', 'band.hypoSevere'], [70, 'warn', 'band.hypo'], [100, 'ok', 'band.normalFasting'],
          [126, 'watch', 'band.preDiabetic'], [250, 'warn', 'band.hyperFasting'], [Infinity, 'critical', 'band.hyperSevere']])(v)),
    thresholdProvenance: 'CLINICAL_GUIDELINE', sources: [S.adaGlu, S.adaHypo, S.i4],
    sim: { base: 88, noise: 4, min: 30, max: 450 },
  },
  sleepHours: {
    id: 'sleepHours', mode: 'spot', unit: 'h', regions: ['brain'], decimals: 1,
    evaluate: bands([[5, 'warn', 'band.sleepDeprived'], [7, 'watch', 'band.sleepShort'], [Infinity, 'ok', 'band.sleepOk']]),
    thresholdProvenance: 'CLINICAL_GUIDELINE', sources: [S.aasm, S.nasaSleep],
    sim: { base: 7.2, noise: 0.4, min: 0, max: 14 },
  },
  mood: {
    id: 'mood', mode: 'spot', unit: '/5', regions: ['brain'], decimals: 0,
    evaluate: bands([[2, 'warn', 'band.moodLow'], [3, 'watch', 'band.moodDown'], [Infinity, 'ok', 'band.moodOk']]),
    thresholdProvenance: 'ASSUMPTION', sources: [S.nasaRisksBeh],
    sim: { base: 4, noise: 0.3, min: 1, max: 5 },
  },
  cabinCO2: {
    id: 'cabinCO2', mode: 'stream', unit: 'mmHg', regions: ['lungs', 'brain'], decimals: 1,
    evaluate: bands([[2.5, 'ok', 'band.co2Ok'], [3.0, 'watch', 'band.co2Near'], [4.5, 'warn', 'band.co2Headache'], [Infinity, 'critical', 'band.co2High']]),
    thresholdProvenance: 'NASA_STANDARD', sources: [S.nasaCO2],
    sim: { base: 2.2, noise: 0.1, min: 0.3, max: 15 },
  },
};

export const INDICATOR_ORDER: IndicatorId[] = ['heartRate', 'systolic', 'diastolic', 'spo2', 'respRate', 'bodyTemp', 'glucose', 'sleepHours', 'mood', 'cabinCO2'];
/** Jürinin 6 göstergesi önce; KB tek satırda birleşik gösterilir */
export const VITAL_ROWS = ['bp', 'heartRate', 'glucose', 'bodyTemp', 'sleepHours', 'mood', 'spo2', 'respRate'] as const;
export type VitalRow = typeof VITAL_ROWS[number];

const RANK: Record<Status, number> = { unknown: 0, ok: 1, watch: 2, warn: 3, critical: 4 };
export const worst = (a: Status, b: Status): Status => (RANK[a] >= RANK[b] ? a : b);
export const statusRank = (s: Status) => RANK[s];
