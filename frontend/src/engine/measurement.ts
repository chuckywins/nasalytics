// "Bu değer nereden geliyor?" bilgi kartları (info ikonu).
// Her kart üç satır: (1) uzayda nasıl ölçülür (yalnızca doğrulanmış kaynaktan), (2) bu prototip değeri nasıl alır, (3) neden önemli.
// Doğrulanamayan iddia YAZILMAZ: ör. Bio-Monitor çekirdek değil DERİ ısısı ölçer; Bio-Analyzer sayfasında glukoz geçmez.
// AI notu: Claude (Anthropic) yardımıyla yazılmıştır. Kaynak denetimi: 2026-11-14.
import type { SourceRef } from './types';

type L = { tr: string; en: string };
export interface MeasureInfo { inSpace: L; here: L; why: L; sources: SourceRef[]; }

const S = {
  bioMon: { label: 'CSA Bio-Monitor', url: 'https://www.asc-csa.gc.ca/eng/sciences/bio-monitor.asp' },
  bioAn: { label: 'CSA Bio-Analyzer', url: 'https://www.asc-csa.gc.ca/eng/iss/bio-analyzer.asp' },
  archer: { label: 'NASA ARCHeR (Artemis II)', url: 'https://www.nasa.gov/reference/archer/' },
  stdm: { label: 'NASA Standard Measures', url: 'https://www.nasa.gov/reference/standard-measures/' },
  beh: { label: 'NASA HRP: Behavioral risk', url: 'https://www.nasa.gov/reference/risk-of-behavioral-conditions-and-psychiatric-disorders/' },
  iso: { label: 'NASA HRP: Isolation & confinement', url: 'https://www.nasa.gov/hrp/hazard-isolation-and-confinement/' },
  co2: { label: 'NASA OCHMO-TB-004 CO₂', url: 'https://nasa.gov/wp-content/uploads/2023/03/co2-technical-brief-ochmo.pdf' },
  atm: { label: 'NASA OCHMO-TB-003 Atmosphere', url: 'https://www.nasa.gov/wp-content/uploads/2023/12/ochmo-tb-003-habitable-atmosphere.pdf' },
  srag: { label: 'NASA SRAG radiation monitoring', url: 'https://www.nasa.gov/directorates/esdmd/hhp/space-radiation/' },
  tepc: { label: 'ISS TEPC (data.nasa.gov)', url: 'https://data.nasa.gov/dataset/iss-tissue-equivalent-proportional-counter-tepc-dose-analyzer-10-s-data-61b24' },
  radlab: { label: 'NASA OSDR RadLab', url: 'https://visualization.osdr.nasa.gov/radlab/' },
  ochRad: { label: 'NASA-STD-3001 V1 [4030] (OCHMO-TB-020)', url: 'https://www.nasa.gov/wp-content/uploads/2023/03/radiation-protection-technical-brief-ochmo.pdf' },
  bone: { label: 'NASA HRP: Bone changes', url: 'https://www.nasa.gov/reference/risk-of-spaceflight-induced-bone-changes/' },
  i4: { label: 'NASA OSDR OSD-575 (Inspiration4)', url: 'https://osdr.nasa.gov/bio/repo/data/studies/OSD-575' },
  cardio: { label: 'NASA HRP: Cardiovascular', url: 'https://www.nasa.gov/reference/risk-of-cardiovascular-adaptations/' },
};

const BIOMON_TR = 'ISS\'te CSA Bio-Monitor akıllı tişörtü (2018\'den beri) ciltteki sensörlerle sürekli ölçer: kalbin elektriksel aktivitesi, kan basıncı, solunum hızı/hacmi, deri ısısı, SpO₂ ve aktivite. Veri Dünya\'ya indirilir.';
const BIOMON_EN = 'On the ISS, the CSA Bio-Monitor smart shirt (since 2018) measures continuously through skin sensors: heart electrical activity, blood pressure, breathing rate/volume, skin temperature, SpO₂ and activity. Data is downlinked to Earth.';

export const MEASURE: Record<string, MeasureInfo> = {
  heartRate: {
    inSpace: { tr: BIOMON_TR, en: BIOMON_EN },
    here: { tr: 'Bu prototipte giyilebilir sensör akışı SİMÜLE edilir (saniyede bir). Elle girilen değer simülatörün hedefi olur.', en: 'In this prototype the wearable stream is SIMULATED (once per second). A manually entered value becomes the simulator target.' },
    why: { tr: 'Ağırlıksızlık kalp ve damarları değiştirir; aritmi ve inişte bayılma riski artar. Eşik aktiviteye göre değişir (dinlenme 60–100, eforda daha yüksek).', en: 'Weightlessness changes the heart and vessels; arrhythmia and fainting-at-landing risks rise. Thresholds depend on activity (rest 60–100, higher during exertion).' },
    sources: [S.bioMon, S.cardio],
  },
  bp: {
    inSpace: { tr: BIOMON_TR, en: BIOMON_EN },
    here: { tr: 'Aralıklı ölçüm (sabah rutini gibi). Girdiğiniz değer kalıcıdır ve ne zaman ölçüldüğü gösterilir.', en: 'Spot measurement (like a morning routine). Your entry persists and shows when it was taken.' },
    why: { tr: 'Damarlar uzayda sertleşip hızlı yaşlanır; inişte düşük tansiyon bayılmaya yol açabilir.', en: 'Vessels stiffen and age faster in space; low blood pressure at landing can cause fainting.' },
    sources: [S.bioMon, S.cardio],
  },
  spo2: {
    inSpace: { tr: BIOMON_TR, en: BIOMON_EN },
    here: { tr: 'Giyilebilir sensör akışı SİMÜLE edilir.', en: 'Wearable sensor stream is SIMULATED.' },
    why: { tr: 'Düşük basınçlı habitatlar ve EVA hazırlığı hafif hipoksi riski taşır: konfüzyon, baş ağrısı, görme bozukluğu.', en: 'Reduced-pressure habitats and EVA prep carry a mild hypoxia risk: confusion, headache, vision problems.' },
    sources: [S.bioMon, S.atm],
  },
  respRate: {
    inSpace: { tr: BIOMON_TR, en: BIOMON_EN },
    here: { tr: 'Giyilebilir sensör akışı SİMÜLE edilir.', en: 'Wearable sensor stream is SIMULATED.' },
    why: { tr: 'Hızlı solunum yüksek kabin CO₂\'si veya düşük oksijenle birlikte değerlendirilir.', en: 'Rapid breathing is assessed together with cabin CO₂ and oxygen.' },
    sources: [S.bioMon, S.co2],
  },
  bodyTemp: {
    inSpace: { tr: 'Bio-Monitor DERİ ısısını ölçer, çekirdek vücut ısısını değil. Uzayda çekirdek ısı ölçümü için elimizde doğrulanmış kaynak yok.', en: 'The Bio-Monitor measures SKIN temperature, not core body temperature. We have no verified source for core temperature measurement in space.' },
    here: { tr: 'Aralıklı ölçüm olarak elle girilir (termometre).', en: 'Entered manually as a spot reading (thermometer).' },
    why: { tr: 'Uzayda bağışıklık değişir ve gizli virüsler yeniden aktifleşebilir; ateş erken işarettir.', en: 'Immunity changes in space and latent viruses can reactivate; fever is an early sign.' },
    sources: [S.bioMon],
  },
  glucose: {
    inSpace: { tr: 'CSA Bio-Analyzer (ISS, 2019) birkaç damla parmak ucu kanından biyobelirteç ve hücre sayımı yapar, sonuç 2–3 saatte. Kaynak sayfası glukozu ayrıca listelemez.', en: 'The CSA Bio-Analyzer (ISS, 2019) runs biomarker tests and cell counts from a few drops of finger-prick blood, results in 2–3 hours. Its page does not list glucose specifically.' },
    here: { tr: 'Glukometre değeri elle veya kamerayla girilir; açlık/tokluk seçilir (eşikler farklıdır). Referans: Inspiration4 mürettebatının laboratuvar aralığı 65–99 mg/dL.', en: 'Glucometer value entered manually or by camera; choose fasting/after-meal (different thresholds). Reference: Inspiration4 crew lab range 65–99 mg/dL.' },
    why: { tr: 'Uzayda insülin direnci gelişebilir ve Tip 2 diyabet riskini artırabilir (CSA).', en: 'Insulin resistance can develop in space, raising Type 2 diabetes risk (CSA).' },
    sources: [S.bioAn, S.i4],
  },
  sleepHours: {
    inSpace: { tr: 'NASA ARCHeR (Artemis II): bilek aktigrafisi uyku düzenini, aktiviteyi ve ışık maruziyetini izler. Standard Measures uyku raporları da toplar.', en: 'NASA ARCHeR (Artemis II): wrist actigraphy tracks sleep patterns, activity and light exposure. Standard Measures also collects sleep reports.' },
    here: { tr: 'Günlük olarak elle girilir (ileride sesli günlükten).', en: 'Entered daily by hand (later from the voice log).' },
    why: { tr: 'ISS\'te günde 16 gün doğumu, iş yükü ve stres uykuyu bozar; uyku kaybı kritik görevlerde hata riskini artırır.', en: '16 sunrises a day on the ISS, workload and stress disrupt sleep; sleep loss raises error risk in critical tasks.' },
    sources: [S.archer, S.stdm],
  },
  mood: {
    inSpace: { tr: 'NASA davranış performansı anketleri (ARCHeR) ve günlük tutma ile izlenir; izolasyon anksiyete ve depresyon riskini artırır.', en: 'Tracked with NASA behavioral performance surveys (ARCHeR) and journaling; isolation raises anxiety and depression risk.' },
    here: { tr: '1–5 öz değerlendirme, günlük girilir. Eşik bir VARSAYIMDIR (klinik ölçek değildir).', en: '1–5 self-rating, entered daily. The threshold is an ASSUMPTION (not a clinical scale).' },
    why: { tr: 'Mars görevinde iletişim gecikmesi ve izolasyon davranışsal sağlığı zorlar; erken fark etmek önemlidir.', en: 'On a Mars mission, comm delay and isolation strain behavioral health; early detection matters.' },
    sources: [S.archer, S.beh, S.iso],
  },
  cabinCO2: {
    inSpace: { tr: 'ISS\'te CO₂ sabit sensörlerle izlenir ve CDRA sistemi tarafından sürekli temizlenir. Sabit sensörler yerel CO₂ ceplerini kaçırabilir.', en: 'On the ISS, CO₂ is monitored by fixed sensors and removed continuously by the CDRA. Fixed sensors can miss local CO₂ pockets.' },
    here: { tr: 'Kabin akışı SİMÜLE edilir; sınır NASA standardından.', en: 'Cabin stream is SIMULATED; the limit comes from the NASA standard.' },
    why: { tr: 'NASA sınırı 1 saatlik ortalama ≤3 mmHg. 2,8–4,5 mmHg baş ağrısı; >4,5 mmHg yorgunluk ve bulantı. ISS astronotlarının %38,7\'si baş ağrısı bildirdi.', en: 'NASA limit: 1-hour average ≤3 mmHg. 2.8–4.5 mmHg headaches; >4.5 mmHg fatigue and nausea. 38.7% of ISS astronauts reported headaches.' },
    sources: [S.co2],
  },
  o2: {
    inSpace: { tr: 'ISS kabini deniz seviyesine eşdeğer tutulur: 14,7 psia ve %21 O₂.', en: 'The ISS cabin is kept at sea-level equivalent: 14.7 psia and 21% O₂.' },
    here: { tr: 'SİMÜLE edilir.', en: 'SIMULATED.' },
    why: { tr: 'Düşük oksijen bilişsel performansı düşürür; yüksek oksijen yangın riski taşır.', en: 'Low oxygen impairs cognition; high oxygen is a fire risk.' },
    sources: [S.atm],
  },
  pressure: {
    inSpace: { tr: 'NASA-STD-3001 V2 [6006]: süresiz maruziyet için 5,0–15,0 psia. EVA kıyafeti tarihsel olarak 4,3 psia, %100 O₂.', en: 'NASA-STD-3001 V2 [6006]: 5.0–15.0 psia for indefinite exposure. EVA suits historically 4.3 psia, 100% O₂.' },
    here: { tr: 'SİMÜLE edilir.', en: 'SIMULATED.' },
    why: { tr: 'Basınç düşüşü dekompresyon hastalığı ve hipoksi riskini artırır.', en: 'Pressure drops raise decompression sickness and hypoxia risk.' },
    sources: [S.atm],
  },
  doseRate: {
    inSpace: { tr: 'NASA SRAG 7/24 izler: aktif aletler (TEPC, CPDS, RAM) ve astronotların taşıdığı pasif dozimetreler (TLD, OSLD, PNTD).', en: 'NASA SRAG monitors 24/7: active instruments (TEPC, CPDS, RAM) and passive dosimeters worn by crew (TLD, OSLD, PNTD).' },
    here: { tr: 'GERÇEK NASA ÖLÇÜMÜ: ISS için TEPC (Eylül 2017), Ay yolu için Artemis I, Mars için Curiosity RAD ve ExoMars medyanları.', en: 'REAL NASA MEASUREMENT: TEPC for ISS (Sep 2017), Artemis I for lunar transit, Curiosity RAD and ExoMars medians for Mars.' },
    why: { tr: 'Radyasyon kanser, merkezi sinir sistemi ve kalp-damar riskini artırır; Ay ve Mars görevleri manyetosferin dışına çıkar.', en: 'Radiation raises cancer, CNS and cardiovascular risk; Moon and Mars missions leave the magnetosphere.' },
    sources: [S.srag, S.tepc, S.radlab],
  },
  cumDose: {
    inSpace: { tr: 'NASA-STD-3001 V1 [4030]: kariyer boyu efektif doz < 600 mSv; güneş olayı başına < 250 mSv [4031].', en: 'NASA-STD-3001 V1 [4030]: career effective dose < 600 mSv; < 250 mSv per solar particle event [4031].' },
    here: { tr: 'TAHMİN: doz hızı × görev günü. ISS\'te ölçülmüş Q=2,2 (TEPC) kullanılır; Mars için yayımlanmış Q. Dedektör vekil değeridir, efektif doz değildir.', en: 'PROJECTION: dose rate × mission day. Uses measured Q=2.2 on ISS (TEPC); published Q for Mars. A detector proxy, not effective dose.' },
    why: { tr: 'Kariyer bütçesini görev planlamasında görmek, EVA ve sığınak kararlarını destekler.', en: 'Seeing the career budget supports EVA and shelter decisions in mission planning.' },
    sources: [S.ochRad, S.tepc],
  },
  boneLoss: {
    inSpace: { tr: 'Kemik yoğunluğu uçuş öncesi ve sonrası taramalarla izlenir. NASA: yük taşıyan kemiklerde ayda ortalama %1–1,5 kayıp.', en: 'Bone density is tracked by pre- and post-flight scans. NASA: weight-bearing bones lose 1–1.5% per month on average.' },
    here: { tr: 'TAHMİN: görev günü × NASA oranı, yalnızca mikrogravitede. Kısmi yerçekimi (Ay, Mars) için veri yok.', en: 'PROJECTION: mission day × NASA rate, microgravity only. No data for partial gravity (Moon, Mars).' },
    why: { tr: 'Kırık ve erken osteoporoz riski; karşı önlem direnç egzersizi ve beslenme.', en: 'Fracture and early osteoporosis risk; countermeasures are resistive exercise and nutrition.' },
    sources: [S.bone],
  },
  routine: {
    inSpace: { tr: "NASA Standard Measures görev öncesi, sırası ve sonrasında düzenli ölçüm toplar (uyku raporu, bilişsel testler, kuvvet testi). ISS'te egzersiz haftada 6–7 gün, günde 1,5 saattir.", en: 'NASA Standard Measures collects regular measurements before, during and after missions (sleep reports, cognition tests, strength test). On the ISS crews exercise 6–7 days a week, 1.5 h a day.' },
    here: { tr: 'Görevler ölçüm girildikçe kendiliğinden tamamlanır. Puan, seri ve rozetler yalnızca gerçek tamamlamalardan hesaplanır ve bu cihazda saklanır.', en: 'Tasks complete automatically as measurements are logged. Points, streaks and badges come only from real completions, stored on this device.' },
    why: { tr: 'Uzun görevlerde değişimleri fark etme sorumluluğu büyük ölçüde astronottadır; düzenli ölçüm erken uyarı sağlar.', en: 'On long missions astronauts carry much of the responsibility for spotting changes; regular measurement gives early warning.' },
    sources: [S.stdm, { label: 'NASA HRP: Fitness risk', url: 'https://www.nasa.gov/reference/risk-of-reduced-cardiorespiratory-and-musculoskeletal-fitness/' }],
  },
  reaction: {
    inSpace: { tr: 'NASA, astronotların uyku kaybı ve yorgunluğu fark etmesi için 10 dakikalık bir uyanıklık öz testi kullanır.', en: 'NASA uses a 10-minute vigilance self-test so astronauts can detect sleep loss and fatigue.' },
    here: { tr: '8 denemelik kısaltılmış sürüm: medyan tepki süresi, >500 ms gecikmeler ve erken tepkiler; kişisel baz çizgiyle kıyas. Eşikler VARSAYIMDIR.', en: 'A shortened 8-trial version: median reaction time, >500 ms lapses and false starts, compared with your personal baseline. Thresholds are ASSUMPTIONS.' },
    why: { tr: 'Uyku kaybı kritik görevlerde (EVA, robot kol) hata riskini artırır.', en: 'Sleep loss raises error risk in critical tasks (EVA, robotic arm).' },
    sources: [{ label: 'NASA: The Human Body in Space', url: 'https://www.nasa.gov/humans-in-space/the-human-body-in-space/' }, S.archer],
  },
  voice: {
    inSpace: { tr: 'NASA davranış bilimcileri uzun süreli izolasyonda zihinsel ve duygusal durumu değerlendirmek için günlük tutmayı kullanır.', en: 'NASA behavioral scientists use journaling to assess mental and emotional state during long-term isolation.' },
    here: { tr: 'Konuşma cihazda yazıya çevrilir; süre, kelime hızı ve duraklama oranı hesaplanır. Claude transkriptten alıntıyla stres, yorgunluk ve izolasyon İPUÇLARI çıkarır.', en: 'Speech is transcribed on device; duration, speech rate and pause ratio are computed. Claude extracts stress, fatigue and isolation CUES quoting the transcript.' },
    why: { tr: 'Mars görevinde gecikme ve izolasyon davranışsal sağlığı zorlar; erken fark etmek önemlidir.', en: 'On a Mars mission, delay and isolation strain behavioral health; early detection matters.' },
    sources: [S.iso, S.beh],
  },
  ecg: {
    inSpace: { tr: BIOMON_TR, en: BIOMON_EN },
    here: { tr: 'Dalga formu nabza bağlı SENTETİK bir PQRST şablonudur; tanısal değildir.', en: 'The waveform is a SYNTHETIC PQRST template driven by heart rate; not diagnostic.' },
    why: { tr: 'Ritim bozukluğu NASA\'nın kalp-damar risk listesinde; ileride senaryolarda ritim değişimi gösterilecek.', en: 'Arrhythmia is on NASA\'s cardiovascular risk list; scenarios will show rhythm changes.' },
    sources: [S.bioMon, S.cardio],
  },
};
