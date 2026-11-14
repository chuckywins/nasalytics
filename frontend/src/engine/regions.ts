// Tıklanabilir vücut bölgeleri: işlev, uzay etkisi, ilgili tehlike (RIDGE) ve kaynaklar.
// İçerik yalnızca docs/research_notes.md'deki kaynaklı bilgilerden alınmıştır.
// AI notu: Claude (Anthropic) yardımıyla yazılmıştır.
import type { Region, SourceRef, IndicatorId } from './types';

type L = { tr: string; en: string };
export interface RegionInfo {
  name: L; func: L; spaceEffect: L; hazards: ('R' | 'I' | 'D' | 'G' | 'E')[];
  indicators: IndicatorId[]; sources: SourceRef[];
}

const N = {
  cardio: { label: 'NASA HRP: Risk of Cardiovascular Adaptations', url: 'https://www.nasa.gov/reference/risk-of-cardiovascular-adaptations/' },
  bone: { label: 'NASA HRP: Spaceflight-Induced Bone Changes', url: 'https://www.nasa.gov/reference/risk-of-spaceflight-induced-bone-changes/' },
  gravity: { label: 'NASA HRP: Hazard - Gravity Fields', url: 'https://www.nasa.gov/hrp/hazard-gravity-fields/' },
  sans: { label: 'NASA HRP: SANS risk', url: 'https://www.nasa.gov/reference/risk-of-spaceflight-associated-neuro-ocular-syndrome-sans/' },
  vest: { label: 'NASA HRP: Sensorimotor & vestibular risk', url: 'https://www.nasa.gov/reference/risk-of-altered-sensorimotor-and-vestibular-function/' },
  beh: { label: 'NASA HRP: Behavioral conditions risk', url: 'https://www.nasa.gov/reference/risk-of-behavioral-conditions-and-psychiatric-disorders/' },
  sleep: { label: 'NASA HRP: Sleep risk', url: 'https://www.nasa.gov/reference/risk-from-inadequate-sleep-and-irregular-schedules/' },
  fit: { label: 'NASA HRP: Cardiorespiratory & musculoskeletal fitness', url: 'https://www.nasa.gov/reference/risk-of-reduced-cardiorespiratory-and-musculoskeletal-fitness/' },
  co2: { label: 'OCHMO-TB-004 Carbon Dioxide', url: 'https://nasa.gov/wp-content/uploads/2023/03/co2-technical-brief-ochmo.pdf' },
  hyp: { label: 'NASA HRP: Risk of Hypoxia', url: 'https://www.nasa.gov/reference/risk-of-hypoxia/' },
  csa: { label: 'CSA: How does space affect the human body?', url: 'https://www.asc-csa.gc.ca/eng/multimedia/search/image/8056' },
  body: { label: 'NASA: The Human Body in Space', url: 'https://www.nasa.gov/humans-in-space/the-human-body-in-space/' },
  nutr: { label: 'NASA HRP: Food & nutrition risk', url: 'https://www.nasa.gov/reference/risk-of-inadequate-food-and-nutrition/' },
  rad: { label: 'NASA HRP: Radiation-induced cancers', url: 'https://www.nasa.gov/reference/risk-of-radiation-induced-cancers/' },
};

export const REGIONS: Record<Region, RegionInfo> = {
  heart: {
    name: { tr: 'Kalp ve damarlar', en: 'Heart & vessels' },
    func: { tr: 'Kanı vücuda pompalar; oksijen ve besinleri dokulara taşır.', en: 'Pumps blood through the body, delivering oxygen and nutrients to tissues.' },
    spaceEffect: { tr: 'Ağırlıksızlıkta kalp daha küresel bir şekil alabilir; damarlar sertleşip hızlı yaşlanır. Aritmi, pıhtı ve inişte düşük tansiyon/bayılma riski artar (CSA, NASA).', en: 'In weightlessness the heart can become more spherical; vessels stiffen and age faster. Risks of arrhythmia, clots and low blood pressure/fainting at landing increase (CSA, NASA).' },
    hazards: ['G', 'R'], indicators: ['heartRate', 'systolic', 'diastolic'], sources: [N.cardio, N.csa],
  },
  lungs: {
    name: { tr: 'Akciğerler', en: 'Lungs' },
    func: { tr: 'Kana oksijen alır, karbondioksiti atar.', en: 'Take oxygen into the blood and remove carbon dioxide.' },
    spaceEffect: { tr: 'Kapalı ortamda CO₂ birikebilir: 2,8–4,5 mmHg baş ağrısı yapar; NASA sınırı 1 saatlik ortalama ≤3 mmHg. Düşük basınçlı habitatlarda hafif hipoksi riski vardır.', en: 'CO₂ can build up in a closed cabin: 2.8–4.5 mmHg causes headaches; NASA limit is a 1-hour average ≤3 mmHg. Reduced-pressure habitats add a mild hypoxia risk.' },
    hazards: ['E'], indicators: ['spo2', 'respRate', 'cabinCO2'], sources: [N.co2, N.hyp],
  },
  brain: {
    name: { tr: 'Beyin', en: 'Brain' },
    func: { tr: 'Düşünme, uyku-uyanıklık, ruh hâli, denge ve ısı kontrolü.', en: 'Thinking, sleep–wake cycle, mood, balance and temperature control.' },
    spaceEffect: { tr: 'İzolasyon, iş yükü ve ISS\'teki günde 16 gün doğumu uyku ve sirkadiyen ritmi bozar; anksiyete ve depresyon riski artar. Radyasyon bilişsel işlevi etkileyebilir.', en: 'Isolation, workload and 16 sunrises a day on the ISS disrupt sleep and circadian rhythm; anxiety and depression risk rises. Radiation may affect cognition.' },
    hazards: ['I', 'R', 'D'], indicators: ['sleepHours', 'mood', 'bodyTemp', 'cabinCO2'], sources: [N.beh, N.sleep, N.rad],
  },
  eyes: {
    name: { tr: 'Gözler (SANS)', en: 'Eyes (SANS)' },
    func: { tr: 'Görme; optik sinir aracılığıyla beyne görüntü iletir.', en: 'Vision; sends images to the brain via the optic nerve.' },
    spaceEffect: { tr: 'Sıvının başa kayması optik sinir şişmesi ve retina katlanmasına yol açar. ISS astronotlarının ~%70\'inde göz arkasında ödem görülür; NASA\'nın 1 numaralı uzay sağlığı riski.', en: 'Headward fluid shift causes optic nerve swelling and retinal folds. ~70% of ISS astronauts show swelling at the back of the eye; NASA\'s leading spaceflight health risk.' },
    hazards: ['G'], indicators: [], sources: [N.sans],
  },
  inner_ear: {
    name: { tr: 'İç kulak (denge)', en: 'Inner ear (balance)' },
    func: { tr: 'Denge ve yön algısı (vestibüler sistem).', en: 'Balance and spatial orientation (vestibular system).' },
    spaceEffect: { tr: 'Yerçekimi geçişlerinde astronotların çoğu hareket hastalığı ve yön kaybı yaşar; yürüme ve araç kullanma etkilenir.', en: 'Most astronauts experience motion sickness and disorientation during gravity transitions; walking and piloting are affected.' },
    hazards: ['G'], indicators: [], sources: [N.vest],
  },
  kidneys: {
    name: { tr: 'Böbrekler', en: 'Kidneys' },
    func: { tr: 'Kanı süzer, sıvı ve elektrolit dengesini korur.', en: 'Filter blood and keep fluid and electrolyte balance.' },
    spaceEffect: { tr: 'Dehidrasyon ve kemiklerden artan kalsiyum atılımı böbrek taşı riskini yükseltir.', en: 'Dehydration and increased calcium release from bone raise kidney-stone risk.' },
    hazards: ['G'], indicators: [], sources: [N.gravity, N.body],
  },
  metabolic: {
    name: { tr: 'Metabolizma (pankreas, karaciğer)', en: 'Metabolism (pancreas, liver)' },
    func: { tr: 'Kan şekerini düzenler (insülin), besinleri işler.', en: 'Regulates blood sugar (insulin) and processes nutrients.' },
    spaceEffect: { tr: 'Uzayda insülin direnci gelişebilir ve Tip 2 diyabet riskini artırabilir (CSA). Yetersiz beslenme performansı düşürür.', en: 'Insulin resistance can develop in space, raising Type 2 diabetes risk (CSA). Inadequate nutrition degrades performance.' },
    hazards: ['G', 'D'], indicators: ['glucose'], sources: [N.csa, N.nutr],
  },
  bone: {
    name: { tr: 'İskelet', en: 'Skeleton' },
    func: { tr: 'Vücudu taşır, organları korur, kan hücresi üretir (kemik iliği).', en: 'Supports the body, protects organs, produces blood cells (marrow).' },
    spaceEffect: { tr: 'Kemik iliği daha az kan hücresi üretir (anemi, enfeksiyon riski). Boy %3\'e kadar uzayabilir.', en: 'Marrow produces fewer blood cells (anemia, infection risk). Height can increase up to 3%.' },
    hazards: ['G', 'R'], indicators: [], sources: [N.csa, N.bone],
  },
  bone_load: {
    name: { tr: 'Yük taşıyan kemikler (kalça, omurga, femur)', en: 'Weight-bearing bones (hip, spine, femur)' },
    func: { tr: 'Vücut ağırlığını taşır; yerçekimi yüküyle güçlü kalır.', en: 'Carry body weight; stay strong under gravitational load.' },
    spaceEffect: { tr: 'Ağırlıksızlıkta ayda ortalama %1–1,5 kemik mineral yoğunluğu kaybı (Dünya\'da 50 yaş üstü yılda ~%1). NASA hedefi: kalça/omurgada görev öncesinin ≥%95\'i.', en: 'Weightlessness causes 1–1.5% bone mineral density loss per month (vs ~1%/year after age 50 on Earth). NASA target: ≥95% of pre-mission at hip/spine.' },
    hazards: ['G'], indicators: [], sources: [N.bone, N.csa],
  },
  muscle: {
    name: { tr: 'Yerçekimine karşı kaslar', en: 'Antigravity muscles' },
    func: { tr: 'Ayakta durma ve yürüme; vücudu yerçekimine karşı taşır.', en: 'Standing and walking; hold the body up against gravity.' },
    spaceEffect: { tr: 'Kas kütlesi ve kuvvet azalır; ortalama %10–12 fitness kaybı, ekibin %12–38\'inde >%20. Karşı önlem: günde 1,5 saat, haftada 6–7 gün egzersiz.', en: 'Muscle mass and strength decline; average 10–12% fitness loss, >20% in 12–38% of crew. Countermeasure: 1.5 h/day exercise, 6–7 days/week.' },
    hazards: ['G'], indicators: [], sources: [N.fit, N.csa],
  },
};
