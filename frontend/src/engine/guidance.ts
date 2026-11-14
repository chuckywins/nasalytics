// Deterministik rehberlik ve eskalasyon kuralları (LLM yok).
// Yarışma sorusu: "Bir sonuç ne zaman mürettebatın veya yerdeki uçuş cerrahının dikkatini gerektirir? Kritik durumu önlemek için ne yapılabilir?"
// Eskalasyon: self = astronot kendisi · crew = mürettebat tıbbi görevlisi (CMO) · ground = uçuş cerrahı (iletişim gecikmesiyle).
// AI notu: Claude (Anthropic) yardımıyla yazılmıştır. Klinik öneriler kaynaklıdır; prototiptir, tıbbi tavsiye değildir.
import type { Escalation, IndicatorId, SourceRef, Status } from './types';

type L = { tr: string; en: string };
export interface Advice { action: L; escalate: Escalation; sources: SourceRef[]; }

const SRC = {
  adaHypo: { label: 'ADA: Hypoglycemia (15-15 rule)', url: 'https://diabetes.org/living-with-diabetes/treatment-care/hypoglycemia' },
  co2: { label: 'OCHMO-TB-004 CO₂', url: 'https://nasa.gov/wp-content/uploads/2023/03/co2-technical-brief-ochmo.pdf' },
  hyp: { label: 'NASA HRP: Hypoxia risk', url: 'https://www.nasa.gov/reference/risk-of-hypoxia/' },
  dcs: { label: 'NASA HRP: Decompression sickness', url: 'https://www.nasa.gov/reference/risk-of-decompression-sickness/' },
  cardio: { label: 'NASA HRP: Cardiovascular adaptations', url: 'https://www.nasa.gov/reference/risk-of-cardiovascular-adaptations/' },
  sleep: { label: 'NASA HRP: Sleep risk', url: 'https://www.nasa.gov/reference/risk-from-inadequate-sleep-and-irregular-schedules/' },
  body: { label: 'NASA: The Human Body in Space', url: 'https://www.nasa.gov/humans-in-space/the-human-body-in-space/' },
  beh: { label: 'NASA HRP: Behavioral conditions risk', url: 'https://www.nasa.gov/reference/risk-of-behavioral-conditions-and-psychiatric-disorders/' },
  imm: { label: 'NASA HRP: Immune system risk', url: 'https://www.nasa.gov/reference/risk-of-altered-immune-system-responses/' },
  aha: { label: 'AHA: Blood pressure readings', url: 'https://www.heart.org/en/health-topics/high-blood-pressure/understanding-blood-pressure-readings' },
};

/** Gösterge + durum → öneri. Eşleşme yoksa genel "yeniden ölç" önerisi kullanılır. */
const RULES: Partial<Record<IndicatorId, Partial<Record<Status, Advice>>>> = {
  spo2: {
    watch: { action: { tr: 'Dinlen ve 5 dk sonra yeniden ölç. Parmak probunun yerini kontrol et.', en: 'Rest and re-measure in 5 min. Check the finger probe placement.' }, escalate: 'self', sources: [SRC.hyp] },
    warn: { action: { tr: 'Aktiviteyi durdur, kabin O₂ ve basıncını kontrol et. Düzelmezse CMO\'yu çağır.', en: 'Stop activity, check cabin O₂ and pressure. Call the CMO if it does not recover.' }, escalate: 'crew', sources: [SRC.hyp] },
    critical: { action: { tr: 'Hemen oksijen maskesi tak. EVA\'daysan EVA\'yı güvenle sonlandır. CMO\'yu çağır, uçuş cerrahını bilgilendir.', en: 'Put on an oxygen mask now. If on EVA, terminate it safely. Call the CMO and notify the flight surgeon.' }, escalate: 'ground', sources: [SRC.hyp, SRC.dcs] },
  },
  heartRate: {
    watch: { action: { tr: 'Efor yoksa otur ve 5 dk dinlen, sonra yeniden ölç.', en: 'If not exercising, sit and rest 5 min, then re-measure.' }, escalate: 'self', sources: [SRC.cardio] },
    warn: { action: { tr: 'Aktiviteyi durdur. EKG ritmini kontrol et; çarpıntı, göğüs ağrısı veya baş dönmesi varsa CMO\'yu çağır.', en: 'Stop activity. Check the ECG rhythm; call the CMO if palpitations, chest pain or dizziness.' }, escalate: 'crew', sources: [SRC.cardio] },
    critical: { action: { tr: 'Aktiviteyi derhal durdur, uzan. CMO acil değerlendirme yapsın; uçuş cerrahına EKG kaydını gönder.', en: 'Stop all activity, lie down. CMO performs urgent assessment; send the ECG record to the flight surgeon.' }, escalate: 'ground', sources: [SRC.cardio] },
  },
  systolic: {
    watch: { action: { tr: 'Tuz ve kafeini sınırla, 30 dk sonra oturur pozisyonda yeniden ölç.', en: 'Limit salt and caffeine; re-measure seated in 30 min.' }, escalate: 'self', sources: [SRC.aha] },
    warn: { action: { tr: 'Düşük tansiyon: sıvı al, ani ayağa kalkma (inişte bayılma riski). Yüksek tansiyon: dinlen ve yeniden ölç, CMO\'ya bildir.', en: 'Low BP: drink fluids, avoid standing quickly (fainting risk at landing). High BP: rest, re-measure, inform the CMO.' }, escalate: 'crew', sources: [SRC.cardio, SRC.aha] },
    critical: { action: { tr: 'Yeniden ölç. Doğrulanırsa CMO acil değerlendirme yapsın, uçuş cerrahına danışın.', en: 'Re-measure. If confirmed, CMO urgent assessment and consult the flight surgeon.' }, escalate: 'ground', sources: [SRC.aha] },
  },
  bodyTemp: {
    watch: { action: { tr: 'Sıvı al, 1 saat sonra yeniden ölç.', en: 'Hydrate and re-measure in 1 hour.' }, escalate: 'self', sources: [SRC.imm] },
    warn: { action: { tr: 'Ateş: dinlen, sıvı al, belirtileri kaydet. Uzayda gizli virüsler yeniden aktifleşebilir; CMO\'ya bildir.', en: 'Fever: rest, hydrate, log symptoms. Latent viruses can reactivate in space; inform the CMO.' }, escalate: 'crew', sources: [SRC.imm] },
    critical: { action: { tr: 'Yüksek ateş: CMO değerlendirmesi ve uçuş cerrahı danışması. Diğer mürettebatla teması azalt.', en: 'High fever: CMO assessment and flight surgeon consult. Reduce contact with other crew.' }, escalate: 'ground', sources: [SRC.imm, SRC.body] },
  },
  glucose: {
    watch: { action: { tr: 'Ölçümün açlık mı tokluk mu olduğunu doğrula; yarın sabah açlıkta tekrarla.', en: 'Confirm fasting vs after-meal; repeat fasting tomorrow morning.' }, escalate: 'self', sources: [] },
    warn: { action: { tr: 'Düşükse: 15 g hızlı karbonhidrat al, 15 dk sonra yeniden ölç (15-15 kuralı). Yüksekse: yeniden ölç ve CMO\'ya bildir.', en: 'If low: take 15 g fast carbohydrate, re-measure in 15 min (15-15 rule). If high: re-measure and inform the CMO.' }, escalate: 'crew', sources: [SRC.adaHypo] },
    critical: { action: { tr: 'Ciddi değer: düşükse hemen 15 g karbonhidrat, bilinç bulanıksa CMO müdahalesi. Uçuş cerrahına bildir.', en: 'Severe value: if low, 15 g carbs now; CMO intervention if confused. Notify the flight surgeon.' }, escalate: 'ground', sources: [SRC.adaHypo] },
  },
  sleepHours: {
    watch: { action: { tr: 'Bu gece uyku programına ve ışık planına uy; kafeini öğleden sonra kes.', en: 'Follow the sleep schedule and lighting plan tonight; no caffeine after noon.' }, escalate: 'self', sources: [SRC.sleep] },
    warn: { action: { tr: 'Uyku yoksunluğu: kritik görevleri (EVA, robotik kol) yeniden planla, 10 dk uyanıklık testi yap.', en: 'Sleep deprived: reschedule critical tasks (EVA, robotic arm) and take the 10-min vigilance test.' }, escalate: 'crew', sources: [SRC.sleep, SRC.body] },
  },
  mood: {
    watch: { action: { tr: 'Kısa bir mola ver, günlüğüne yaz, Dünya fotoğraflarına bak.', en: 'Take a short break, write in your journal, look at Earth photos.' }, escalate: 'self', sources: [SRC.beh] },
    warn: { action: { tr: 'Özel aile görüşmesi planla ve davranışsal sağlık ekibiyle konuş.', en: 'Schedule a private family call and talk to the behavioral health team.' }, escalate: 'ground', sources: [SRC.beh] },
  },
  cabinCO2: {
    watch: { action: { tr: 'CO₂ NASA sınırına yakın: havalandırmanın çalıştığını kontrol et.', en: 'CO₂ near the NASA limit: check that ventilation is running.' }, escalate: 'self', sources: [SRC.co2] },
    warn: { action: { tr: 'Baş ağrısı aralığı: iyi havalanan modüle geç, CO₂ temizleyicinin durumunu kontrol et, mürettebatı uyar.', en: 'Headache range: move to a well-ventilated module, check the CO₂ scrubber, alert the crew.' }, escalate: 'crew', sources: [SRC.co2] },
    critical: { action: { tr: 'Yüksek CO₂: modülü terk et. EVA\'daysan kıyafet CO₂ arızası şüphesi; EVA\'yı sonlandır.', en: 'High CO₂: leave the module. On EVA, suspect a suit CO₂ fault; terminate the EVA.' }, escalate: 'ground', sources: [SRC.co2, SRC.dcs] },
  },
  respRate: {
    watch: { action: { tr: 'Dinlen ve yeniden kontrol et; kabin CO₂ değerine bak.', en: 'Rest and re-check; look at cabin CO₂.' }, escalate: 'self', sources: [SRC.co2] },
    warn: { action: { tr: 'Hızlı solunum: CO₂ ve SpO₂ ile birlikte değerlendir, CMO\'ya bildir.', en: 'Rapid breathing: assess with CO₂ and SpO₂, inform the CMO.' }, escalate: 'crew', sources: [SRC.co2, SRC.hyp] },
    critical: { action: { tr: 'Solunum yetersiz: CMO acil müdahale.', en: 'Inadequate breathing: CMO emergency response.' }, escalate: 'ground', sources: [] },
  },
};
RULES.diastolic = RULES.systolic;

const FALLBACK: Advice = { action: { tr: 'Yeniden ölç ve trendi izle.', en: 'Re-measure and watch the trend.' }, escalate: 'self', sources: [] };
export const adviceFor = (id: IndicatorId, st: Status): Advice => RULES[id]?.[st] ?? FALLBACK;
