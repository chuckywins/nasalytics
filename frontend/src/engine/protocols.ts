// Müdahale protokol kütüphanesi (DETERMİNİSTİK, KAYNAKLI). Yapay zekâ yalnızca bu kartların KİMLİKLERİNİ seçer/sıralar;
// doz ve ilaç satırları hiçbir zaman modelden geçmez. İlaç/doz satırları kaynağından BİREBİR (İngilizce) alıntıdır.
//
// NASA kaynağı: Space Shuttle "Medical Checklist" JSC-48031, Generic Rev K PCN-4 (2008) — kamuya açık kopya. Güncel ISS tıbbi
// kontrol listesi kamuya açık DEĞİLDİR. Dozlar 2008 Shuttle ilaç kiti birimleridir ("1 tab", "2 puffs"), taşınabilir doz değildir.
// Belgede "*" = "Contact Surgeon before giving any medication marked w/asterisk. In emergency or when orbiter LOS, begin appropriate
// treatment; call Surgeon as soon as possible" (s. 6-2) → kilitli: uçuş cerrahı onayı; acil durum / iletişim kopukluğunda tedaviye başlanır.
// AI ilaç ÖNERİR ama yalnızca KİMLİKLE (ör. 'chestPain.aspirin'); ekrandaki ad/doz/sayfa buradan gelir (sayı modelden geçmez).
// Sayfa ve satırlar pdftotext -layout ile tek tek kontrol edildi (2026-11-14). AI notu: Claude (Anthropic) yardımıyla yazılmıştır.
import type { Escalation, SourceRef } from './types';

export type ProtocolId = 'chestPain' | 'shock' | 'breathing' | 'dcs' | 'hypoglycemia' | 'htnCrisis' | 'allergy' | 'seizure' | 'insomnia' | 'altitude' | 'nausea' | 'pain';
type L = { tr: string; en: string };
export interface Drug { id: string; verbatim: string; dose?: string; locked: boolean; warning?: string }
export interface PStep { text: L; drug?: Drug; medical?: boolean /* koşullu adım: koşul metniyle gösterilir */; cond?: L; gravity?: 'zeroG' | 'partialG' }
export interface Protocol {
  id: ProtocolId; title: L; source: SourceRef & { page: string }; kind: 'NASA_CHECKLIST' | 'CLINICAL_GUIDELINE';
  /** Kontrol listesinin kendi belirti/bulgu listesi: CMO işaretler; işaretlenmeden ilaç adımları görünmez */
  confirm: L[]; steps: PStep[]; escalate: Escalation; note?: L;
}

const CL = (page: string) => ({ label: `NASA JSC-48031 Medical Checklist Rev K (Shuttle, 2008) · ${page}`, url: 'https://ibiblio.org/apollo/Shuttle/Medical%20Checklist/Medical%20Checklist%20Rev%20K%20PCN-4.pdf', page });
const CPR_BOX: PStep = { text: { tr: 'Nabız veya solunum yoksa: hasta/kurtarıcı bağlarıyla CPR. Bilinci açıksa: QDM maskesiyle ek oksijen.', en: 'If no pulse or respiration: CPR using patient/rescuer restraints. If conscious: supplemental O₂ with QDM.' } };
const VITALS: PStep = { text: { tr: 'Tansiyon aleti, steteskop, termometre çıkar; vital bulguları kaydet (tansiyon, nabız, solunum, ısı).', en: 'Unstow BP cuff, stethoscope, thermometer; record vital signs (BP, pulse, respiration, temperature).' } };
const ECG: PStep = { text: { tr: 'EKG elektrotlarını bağla (kardiyak izleme).', en: 'Attach ECG leads (cardiac monitoring).' } };
const SURGEON: PStep = { text: { tr: 'Uçuş cerrahıyla iletişime geç.', en: 'Contact Surgeon.' } };

export const PROTOCOLS: Record<ProtocolId, Protocol> = {
  chestPain: {
    id: 'chestPain', kind: 'NASA_CHECKLIST', escalate: 'ground', source: CL('Emergency 1-36/1-37'),
    title: { tr: 'Göğüs ağrısı', en: 'Chest pain' },
    confirm: [{ tr: 'Göğüs ağrısı / baskı hissi', en: 'Chest pain / pressure' }, { tr: 'Nefes darlığı', en: 'Shortness of breath' }, { tr: 'Cilt rengi: morumsu, gri, soluk', en: 'Skin colour: bluish, grayish, pale' }],
    steps: [CPR_BOX, VITALS,
      { text: { tr: 'Göğüs muayenesi: kalp sesleri (düzenli/düzensiz), solunum sesleri, göğüs hareketi, cilt rengi.', en: 'Chest exam: heart sounds (regular/irregular), breath sounds, chest wall motion, skin colour.' } },
      ECG,
      { medical: true, text: { tr: 'Aspirin (kitteki birimle):', en: 'Aspirin (kit unit):' }, cond: { tr: 'Göğüs ağrısı doğrulanırsa', en: 'If chest pain is confirmed' }, drug: { id: 'chestPain.aspirin', verbatim: 'Aspirin (Drug Subpack-Spine)', dose: 'Dose: 1 tab', locked: false, warning: 'WARNING 6-3: Do not use Aspirin in patients w/asthma, history of aspirin allergy, or GI or other bleeding problems' } },
      SURGEON],
  },
  shock: {
    id: 'shock', kind: 'NASA_CHECKLIST', escalate: 'ground', source: CL('Emergency 1-44/1-45'),
    title: { tr: 'Şok', en: 'Shock' },
    note: { tr: 'En kritik adım altta yatan nedeni bulup tedavi etmektir (kalp hasarı; kan/sıvı kaybı; kan göllenmesi: alerji, ağrı, ilaç, sıcak çarpması, enfeksiyon).', en: 'Most critical step is identifying/treating the underlying cause (heart damage; loss of volume; blood pooling: allergy, pain, drugs, heat stroke, infection).' },
    confirm: [{ tr: 'Nabız hızlı, zayıf', en: 'Pulse rapid, weak, thready' }, { tr: 'Solunum yüzeysel, düzensiz', en: 'Respiration shallow, irregular' }, { tr: 'Zihin bulanık, uyuşuk, kaygılı', en: 'Mental state confused, sluggish, anxious' }, { tr: 'Cilt soğuk, nemli, terli', en: 'Skin cold, clammy, sweating' }],
    steps: [CPR_BOX, VITALS,
      { text: { tr: 'Kanama varsa gazlı bezle bastır.', en: 'If bleeding: apply pressure w/gauze pads.' } },
      { text: { tr: 'Vücut ısısı kaybını önle.', en: 'Prevent loss of body heat.' } },
      { medical: true, text: { tr: 'Damar yolu aç ve serum başlat:', en: 'Start I.V. and begin infusion:' }, cond: { tr: 'Şok bulguları doğrulanırsa', en: 'If signs of shock are confirmed' }, drug: { id: 'shock.saline', verbatim: '5. Start I.V. (see INJECTIONS, INTRAVENOUS (I.V.), 4-11). Begin infusing 1 L of normal Saline (IV Admin-1, Saline Supply Bag, EENT Subpack-1)', locked: false } },
      ECG, SURGEON,
      { gravity: 'zeroG', text: { tr: 'Mikro-yerçekimi: kontrol listesi hastayı bağlarla sabitlemeyi söyler; bacak kaldırma yerçekimi olmadan etki etmez (VARSAYIM).', en: 'Microgravity: the checklist uses patient restraints; leg elevation has no effect without gravity (ASSUMPTION).' } },
      { gravity: 'partialG', text: { tr: 'Kısmi yerçekimi (Ay/Mars): bilinci açık ve nefes alıyorsa sırtüstü yatır (AHA ilk yardım, Sınıf 2a). Travma yoksa ayakları ~15–30 cm kaldırmak düşünülebilir (Sınıf 2b); ağrı yaparsa kaldırma (Sınıf 3: zarar). Dünya kılavuzunun kısmi yerçekimine uygulanması VARSAYIMDIR.', en: 'Partial gravity (Moon/Mars): if responsive and breathing, place supine (AHA first aid, Class 2a). Without trauma, raising the feet ~6–12 in may be considered (Class 2b); do not if it causes pain (Class 3: harm). Applying Earth guidance to partial gravity is an ASSUMPTION.' } }],
  },
  breathing: {
    id: 'breathing', kind: 'NASA_CHECKLIST', escalate: 'crew', source: CL('Emergency 1-3'),
    title: { tr: 'Solunum güçlüğü', en: 'Breathing difficulty' },
    confirm: [{ tr: 'Toz/kimyasal maruziyeti sonrası başladı', en: 'Began after dust/chemical exposure' }, { tr: 'Hırıltı / nefes darlığı', en: 'Wheezing / shortness of breath' }, { tr: 'Steteskopla hırıltı, çıtırtı veya azalmış ses', en: 'Stethoscope: wheezes, crackles or decreased sounds' }],
    steps: [
      { text: { tr: 'Kimyasal/tahriş ediciden uzaklaştır; diğerlerini maruziyetten koru.', en: 'Remove from exposure to chemical/irritant; protect others from exposure.' } },
      SURGEON,
      { text: { tr: 'Steteskopla solunum seslerini dinle (hırıltı, çıtırtı, azalmış ses).', en: 'Using stethoscope, listen for wheezing, crackles, or decreased breath sounds.' } },
      { medical: true, text: { tr: 'Hırıltı/çıtırtı/azalmış ses varsa:', en: 'If wheezing, crackles, or decreased breath sounds present:' }, drug: { id: 'breathing.proventil', verbatim: '*Proventil Inhaler (Drug Subpack-11)', dose: 'Dose: 2 puffs initially. May repeat in 1-2 hr if necessary, then 2 puffs every 4 to 6 hr as needed for continued wheezing', locked: true } },
      { text: { tr: 'Uçuş cerrahı aksini söyleyene kadar QDM ile %100 O₂.', en: 'Don QDM for 100% O₂ until MCC Surgeon advises otherwise.' } }],
  },
  dcs: {
    id: 'dcs', kind: 'NASA_CHECKLIST', escalate: 'ground', source: CL('DCS 3-8 (aftercare, late DCS)'),
    title: { tr: 'Vurgun (DCS) · kıyafet çıkarıldıktan sonra bakım', en: 'Decompression sickness · aftercare' },
    note: { tr: 'Nefes darlığı, göğüs rahatsızlığı veya sıkıntı varsa CPR prosedürüne geç. Tip II (nörolojik, kardiyopulmoner) daha ciddidir (OCHMO-TB-037).', en: 'If difficulty breathing, chest discomfort or distress: go to CPR. Type II (neurological, cardiopulmonary) is more serious (OCHMO-TB-037).' },
    confirm: [{ tr: 'Eklem/kas ağrısı (Tip I)', en: 'Joint/muscle pain (Type I)' }, { tr: 'Kaşıntı / hafif döküntü (Tip I)', en: 'Itching / mild rash (Type I)' }, { tr: 'Uyuşma, güçsüzlük, bilişsel sorun (Tip II)', en: 'Numbness, weakness, cognitive issues (Type II)' }],
    steps: [
      { text: { tr: 'QDM maskesiyle toplam 2 saat oksijen ver.', en: 'Apply QDM and deliver oxygen for a total of 2 hours.' } },
      { text: { tr: 'Fiziksel aktiviteyi en aza indir.', en: 'Minimize physical activity.' } },
      { medical: true, text: { tr: 'Sıvı:', en: 'Hydration:' }, cond: { tr: 'DCS belirtisi varsa', en: 'If DCS symptoms present' }, drug: { id: 'dcs.hydrate', verbatim: '5. Hydrate w/ 1 liter/hour for 2 hours orally or by Saline I.V. if unable to drink. (Breaking QDM seal to hydrate is allowed)', locked: false } },
      { text: { tr: 'Uçuş cerrahıyla iletişime geç (ilaçları değerlendirir).', en: 'Contact Surgeon (consider medications).' } },
      { text: { tr: 'Belirtiler 20 dk tedaviye rağmen kötüleşir/düzelmezse: Shuttle listesi kabini 14,7 psi\'ye çıkarmayı söyler (EVA öncesi kabin 10,2 psi\'ye düşürüldüğü için; Shuttle\'a özgü). ISS kabini zaten ~14,7 psi: TB-037\'ye göre ≥16,4 psia belirtileri hafifletebilir, protokol senaryoya bağlıdır → uçuş cerrahı karar verir.', en: 'If symptoms worsen/do not improve after 20 min: the Shuttle checklist raises cabin pressure to 14.7 psi (the cabin was lowered to 10.2 psi before EVA; Shuttle-specific). The ISS cabin is already ~14.7 psi: per TB-037 ≥16.4 psia may alleviate symptoms, protocol is scenario dependent → flight surgeon decides.' } }],
  },
  hypoglycemia: {
    id: 'hypoglycemia', kind: 'CLINICAL_GUIDELINE', escalate: 'crew',
    source: { label: 'ADA: Hypoglycemia (15-15 rule) · CDC', url: 'https://professional.diabetes.org/sites/dpro/files/2023-12/hypoglycemia_in_diabetes.pdf', page: 'ADA 2023' },
    title: { tr: 'Düşük kan şekeri (≤70 mg/dL)', en: 'Low blood glucose (≤70 mg/dL)' },
    note: { tr: 'ADA kılavuzu diyabetli kişiler için yazılmıştır; astronotlara uygulanması VARSAYIMDIR. 15-15 kuralı yalnızca bilinci açık kişi içindir. CDC: <55 mg/dL ciddi düşüklüktür, 15-15 kuralıyla tedavi edilemeyebilir.', en: 'ADA guidance is written for people with diabetes; applying it to astronauts is an ASSUMPTION. The 15-15 rule is only for conscious people. CDC: <55 mg/dL is severely low and may not be treatable with the 15-15 rule.' },
    confirm: [{ tr: 'Bilinci açık, yutabiliyor', en: 'Conscious, able to swallow' }],
    steps: [
      { medical: true, text: { tr: '15 g hızlı etkili karbonhidrat al.', en: 'Have 15 g of fast-acting carbohydrate.' } },
      { text: { tr: '15 dakika sonra kan şekerini yeniden ölç; hâlâ ≤70 ise tekrarla.', en: 'Recheck glucose in 15 minutes; repeat if still ≤70.' } },
      { text: { tr: '70 üstüne çıkınca ve yakında öğün yoksa protein + karbonhidrat atıştırmalığı al.', en: 'Once above 70, have a protein + carbohydrate snack if no meal is coming soon.' } },
      SURGEON],
  },
  htnCrisis: {
    id: 'htnCrisis', kind: 'CLINICAL_GUIDELINE', escalate: 'ground',
    source: { label: 'AHA: Hypertensive crisis (>180/120)', url: 'https://www.heart.org/en/health-topics/high-blood-pressure/understanding-blood-pressure-readings/hypertensive-crisis-when-you-should-call-911-for-high-blood-pressure', page: 'heart.org' },
    title: { tr: 'Hipertansif kriz (>180/120)', en: 'Hypertensive crisis (>180/120)' },
    note: { tr: 'Belirti yoksa "hipertansif aciliyet": ilaç kararı klinisyenindir. Belirti varsa "hipertansif acil durum": beklemeden en üst sağlık desteği (Dünya\'da 911; uzayda uçuş cerrahı).', en: 'No symptoms = hypertensive urgency: medication decisions are the clinician\'s. Symptoms = hypertensive emergency: do not wait (911 on Earth; flight surgeon in space).' },
    confirm: [{ tr: 'Göğüs ağrısı', en: 'Chest pain' }, { tr: 'Nefes darlığı', en: 'Shortness of breath' }, { tr: 'Sırt ağrısı', en: 'Back pain' }, { tr: 'Uyuşma / güçsüzlük', en: 'Numbness / weakness' }, { tr: 'Görme değişikliği', en: 'Change in vision' }, { tr: 'Konuşma güçlüğü', en: 'Difficulty speaking' }],
    steps: [
      { text: { tr: 'Kısa bir bekleme sonrası tansiyonu yeniden ölç.', en: 'Wait briefly and measure blood pressure again.' } },
      { text: { tr: 'Hâlâ >180/120 ve belirti yoksa: uçuş cerrahına bildir (ilaç kararı onundur).', en: 'Still >180/120 with no symptoms: inform the flight surgeon (medication is their decision).' } },
      { text: { tr: 'Belirti varsa: beklemeden uçuş cerrahına acil çağrı.', en: 'With symptoms: call the flight surgeon immediately, do not wait.' } }],
  },
  allergy: {
    id: 'allergy', kind: 'NASA_CHECKLIST', escalate: 'ground', source: CL('Emergency 1-29/1-30 (Allergic reaction, severe)'),
    title: { tr: 'Ağır alerjik reaksiyon', en: 'Severe allergic reaction' },
    note: { tr: 'Daha önce reaksiyon olmayan maddeye de gelişebilir; şoka ilerleyebilir (Şok kartı).', en: 'May follow exposure to substances with no previous reaction; shock possible (see Shock card).' },
    confirm: [{ tr: 'Solunum güçlüğü / hırıltı', en: 'Difficulty breathing / wheezing' }, { tr: 'Solukluk, terleme', en: 'Pallor, sweating' }, { tr: 'Düşük tansiyon, hızlı nabız', en: 'Low BP, rapid pulse' }],
    steps: [
      { text: { tr: 'Ek oksijen ver.', en: 'Provide supplemental O₂.' } },
      { medical: true, cond: { tr: 'Ağır reaksiyon bulguları varsa', en: 'If signs of severe reaction' }, text: { tr: 'Epi Pen: siyah ucu uyluk dışına yerleştir, hızlıca bastır ve 10 sn tut (giysi üzerinden kullanılamaz).', en: 'Epi Pen: place black tip on outer thigh, press firmly and hold 10 sec (not through clothing).' }, drug: { id: 'allergy.epipen', verbatim: 'Epi Pen Injector (Drug Subpack-9)', locked: false } },
      { text: { tr: 'Nabız, solunum, tansiyonu izle; uçuş cerrahıyla iletişime geç.', en: 'Monitor pulse, respiration, BP; Contact Surgeon.' } },
      { medical: true, cond: { tr: 'İlk enjeksiyondan 5 dk sonra solunum/tansiyon düzelmezse', en: 'If no improvement in breathing or BP within 5 min of first injection' }, text: { tr: 'Ek epinefrin:', en: 'Additional epinephrine:' }, drug: { id: 'allergy.epinephrine', verbatim: '*Epinephrine (Drug Subpack-5)', dose: 'Dose: Inject 0.3 to 0.5-mL subcutaneously', locked: true } },
      { medical: true, cond: { tr: 'Ardından', en: 'Then' }, text: { tr: 'Antihistaminik:', en: 'Antihistamine:' }, drug: { id: 'allergy.benadryl', verbatim: '*Benadryl (Injectable) (Drug Subpack-13)', dose: 'Dose: Inject 1 ampule intramuscularly', locked: true, warning: 'General WARNING 6-2: Following drugs should not be used together as they may cause excessive drowsiness in combination: Ambien, Benadryl, Claritin, Demerol, Duragesic Patch (Fentanyl), Morphine Sulfate, Phenergan, Restoril, Valium, Vicodin' } }],
  },
  seizure: {
    id: 'seizure', kind: 'NASA_CHECKLIST', escalate: 'ground', source: CL('Emergency 1-42/1-43 (Seizures)'),
    title: { tr: 'Nöbet', en: 'Seizure' },
    confirm: [{ tr: 'Nöbet geçiriyor', en: 'Seizure in progress' }],
    steps: [
      { medical: true, cond: { tr: 'Nöbet varsa, hemen', en: 'If seizing, ASAP' }, text: { tr: 'Kas içi Valium (uyluk dış orta kısım tercih edilir):', en: 'Intramuscular Valium (outer middle thigh preferred):' }, drug: { id: 'seizure.valiumIM', verbatim: '*Valium Injection (Drug Subpack-22)', dose: 'Dose: 2-mL intramuscularly ASAP', locked: true, warning: 'General WARNING 6-2: Following drugs should not be used together as they may cause excessive drowsiness in combination: Ambien, Benadryl, Claritin, Demerol, Duragesic Patch (Fentanyl), Morphine Sulfate, Phenergan, Restoril, Valium, Vicodin' } },
      { text: { tr: 'Bilinci açıksa ek oksijen ver.', en: 'If conscious, provide supplemental O₂.' } },
      { medical: true, cond: { tr: 'İlk enjeksiyondan 5 dk sonra nöbet sürüyorsa', en: 'If seizure continues 5 min after first injection' }, text: { tr: 'Damar içi Valium:', en: 'Intravenous Valium:' }, drug: { id: 'seizure.valiumIV', verbatim: '*Valium (Injectable) (Drug Subpack-22)', dose: 'Dose: SLOWLY 2 mL intravenously (over 1-2 min)', locked: true } },
      { text: { tr: 'Hastayı bağlarla sabitle, damar yolu aç, uçuş cerrahını ara, EKG bağla. Nöbet tekrarlayabilir; Valium hazır beklesin.', en: 'Restrain patient, start I.V., Contact Surgeon, attach ECG. Seizure can recur; keep Valium ready.' } }],
  },
  insomnia: {
    id: 'insomnia', kind: 'NASA_CHECKLIST', escalate: 'self', source: CL('5-13 (Sleeping problems)'),
    title: { tr: 'Uyku sorunu (uykusuzluk)', en: 'Sleeping problems (insomnia)' },
    note: { tr: 'Uçuşta en sık akut ilaç kullanımı uyku ilaçlarıdır (~%71; OCHMO-TB-033). İki CMO (veya pilot ve komutan) aynı anda sedatif kullanamaz. İlaçtan sonra çalışmaya devam edilmez.', en: 'Sleep aids are the leading acute in-mission medication (~71%; OCHMO-TB-033). Both CMOs (or PLT and CDR) may not use sedatives simultaneously. Do not continue work after taking.' },
    confirm: [{ tr: 'Uykuya dalamama / sık uyanma', en: 'Cannot fall/stay asleep' }],
    steps: [
      { text: { tr: 'Önce uyku ortamı: ışık, gürültü, sıcaklık; uyku öncesi ekran ve yoğun iş yok.', en: 'First the sleep environment: light, noise, temperature; no screens or heavy work before sleep.' } },
      { medical: true, cond: { tr: 'Uykusuzluk sürerse, yatmaya hazırken', en: 'If insomnia persists, when ready for bed' }, text: { tr: 'Uyku ilacı (biri):', en: 'Sleep aid (one of):' }, drug: { id: 'insomnia.ambien', verbatim: '*Ambien (Drug Subpack-Spine)', dose: 'Dose: 1 tab 30 min prior to sleep period', locked: true, warning: 'General WARNING 6-2: Following drugs should not be used together as they may cause excessive drowsiness in combination: Ambien, Benadryl, Claritin, Demerol, Duragesic Patch (Fentanyl), Morphine Sulfate, Phenergan, Restoril, Valium, Vicodin' } },
      { medical: true, cond: { tr: '-VEYA-', en: '-OR-' }, text: { tr: 'Alternatif:', en: 'Alternative:' }, drug: { id: 'insomnia.restoril', verbatim: '*Restoril (Drug Subpack-Spine)', dose: 'Dose: 1 or 2 caps 30 min prior to sleep period', locked: true } }],
  },
  altitude: {
    id: 'altitude', kind: 'NASA_CHECKLIST', escalate: 'crew', source: CL('2-4 (Altitude sickness)'),
    title: { tr: 'İrtifa hastalığı (kabin basıncı/ppO₂ düşüşü)', en: 'Altitude sickness (cabin pressure/ppO₂ drop)' },
    note: { tr: 'Planlı/plansız basınç düşüşü veya ppO₂ azalmasıyla ≥8000 ft eşdeğer irtifada görülebilir (8000 ft ≈ 10,9 psia, standart atmosfer).', en: 'Can follow planned/unplanned depressurization or ppO₂ reduction to ≥8000 ft equivalent (8000 ft ≈ 10.9 psia, standard atmosphere).' },
    confirm: [{ tr: 'Baş ağrısı, bulantı, kusma', en: 'Headache, nausea, vomiting' }, { tr: 'Nefes darlığı, öksürük', en: 'Shortness of breath, cough' }, { tr: 'Uyku güçlüğü, uyuşukluk, halsizlik', en: 'Difficulty sleeping, lethargy, weakness' }],
    steps: [
      { medical: true, cond: { tr: 'Belirtiler varsa', en: 'If symptoms' }, text: { tr: 'İlaç:', en: 'Medication:' }, drug: { id: 'altitude.diamox', verbatim: '*Diamox (Drug Subpack-43)', dose: 'Dose: 1/2-1 tab every 24 hr for total of 3 doses', locked: true } },
      SURGEON],
  },
  nausea: {
    id: 'nausea', kind: 'NASA_CHECKLIST', escalate: 'self', source: CL('4-39 (Nausea/vomiting)'),
    title: { tr: 'Bulantı / kusma', en: 'Nausea / vomiting' },
    confirm: [{ tr: 'Bulantı veya kusma', en: 'Nausea or vomiting' }],
    steps: [
      { medical: true, cond: { tr: 'Bulantı/kusma varsa', en: 'If nausea/vomiting' }, text: { tr: 'Bulantı ilacı (ağızdan):', en: 'Antinausea (oral):' }, drug: { id: 'nausea.phenerganOral', verbatim: '*Phenergan (oral) (Drug Subpack-15)', dose: 'Dose: 1-2 tabs every 4-6 hr as needed', locked: true, warning: 'General WARNING 6-2: Following drugs should not be used together as they may cause excessive drowsiness in combination: Ambien, Benadryl, Claritin, Demerol, Duragesic Patch (Fentanyl), Morphine Sulfate, Phenergan, Restoril, Valium, Vicodin' } },
      { text: { tr: 'Kusma sürerse sıvı kaybını izle; uçuş cerrahına bildir.', en: 'If vomiting persists, watch fluid loss; inform the flight surgeon.' } }],
  },
  pain: {
    id: 'pain', kind: 'NASA_CHECKLIST', escalate: 'self', source: CL('5-3 (Pain relief, increasing order of strength)'),
    title: { tr: 'Ağrı / baş ağrısı', en: 'Pain / headache' },
    note: { tr: 'Uçuşta baş ağrısı sıktır; CO₂ artışı, sıvı kayması ve basınç değişimi katkıda bulunur (OCHMO-TB-033). CO₂ yüksekse önce havalandır.', en: 'Headaches are common in flight; elevated CO₂, fluid shifts and pressure changes contribute (OCHMO-TB-033). If CO₂ is high, ventilate first.' },
    confirm: [{ tr: 'Baş ağrısı / ağrı', en: 'Headache / pain' }],
    steps: [
      { medical: true, cond: { tr: 'Ağrı varsa (birini seç)', en: 'If pain (choose one)' }, text: { tr: 'Aspirin:', en: 'Aspirin:' }, drug: { id: 'pain.aspirin', verbatim: 'Aspirin (Drug Subpack-Spine)', dose: 'Dose: 1-2 tabs every 4-6 hr as needed', locked: false, warning: 'WARNING 6-3: Do not use Aspirin in patients w/asthma, history of aspirin allergy, or GI or other bleeding problems' } },
      { medical: true, cond: { tr: '-VEYA-', en: '-OR-' }, text: { tr: 'Tylenol:', en: 'Tylenol:' }, drug: { id: 'pain.tylenol', verbatim: 'Tylenol (Drug Subpack-Spine)', dose: 'Dose: 1-2 tabs every 4-6 hr as needed', locked: false } },
      { medical: true, cond: { tr: '-VEYA-', en: '-OR-' }, text: { tr: 'Motrin (yemekle):', en: 'Motrin (with food):' }, drug: { id: 'pain.motrin', verbatim: 'Motrin (Drug Subpack-Spine)', dose: 'Dose: 1 tab every 4-6 hr as needed w/food and drink', locked: false } },
      { text: { tr: 'Daha güçlü ilaçlar (Vicodin, Demerol, Morfin) "*": uçuş cerrahı.', en: 'Stronger options (Vicodin, Demerol, Morphine) are "*": flight surgeon.' } }],
  },
};

/** İlaç adı listesi: AI serbest metninde geçerse metin reddedilir (doz modelden geçmez) */
export const DRUG_WORDS = ['epinefrin', 'nitrogliserin', 'salbutamol', 'parasetamol', 'aspirin', 'proventil', 'albuterol', 'saline', 'serum', 'epinephrine', 'epi pen', 'benadryl', 'valium', 'diazepam', 'ambien', 'restoril', 'diamox', 'glucagon', 'glukagon', 'insulin', 'insülin', 'nitroglycerin', 'atropine'];

/** Kütüphanedeki tüm ilaçlar: kimlik → (ilaç, protokol). AI reçeteyi YALNIZCA bu kimliklerle önerir. */
export function allDrugs(): Record<string, { drug: Drug; protocol: ProtocolId; cond?: L }> {
  const out: Record<string, { drug: Drug; protocol: ProtocolId; cond?: L }> = {};
  for (const p of Object.values(PROTOCOLS)) for (const st of p.steps) if (st.drug) out[st.drug.id] = { drug: st.drug, protocol: p.id, cond: st.cond };
  return out;
}

/** Deterministik eşleştirici: gösterilen anlık durumdan ADAY kartlar (CMO belirtileri doğrular). Çevrimdışı çalışır. */
export interface SnapLite { activity: string; gravity_g: number; cabinPsia?: number; indicators: { id: string; value: number; status: string }[]; extra: { id: string; status: string }[] }
export function matchProtocols(s: SnapLite): { id: ProtocolId; reason: L }[] {
  const v = (id: string) => s.indicators.find((x) => x.id === id);
  const st = (id: string) => v(id)?.status ?? 'ok';
  const out: { id: ProtocolId; reason: L }[] = [];
  const hr = v('heartRate'), sys = v('systolic'), dia = v('diastolic'), spo2 = v('spo2'), glu = v('glucose');
  if ((sys && sys.value > 180) || (dia && dia.value > 120)) out.push({ id: 'htnCrisis', reason: { tr: `Tansiyon ${sys?.value}/${dia?.value} > 180/120`, en: `BP ${sys?.value}/${dia?.value} > 180/120` } });
  if (sys && (sys.value < 80 || (sys.value < 90 && (hr?.value ?? 0) > 100))) out.push({ id: 'shock', reason: { tr: `Düşük tansiyon (${sys.value}) ${hr && hr.value > 100 ? '+ hızlı nabız' : ''}`, en: `Low BP (${sys.value}) ${hr && hr.value > 100 ? '+ rapid pulse' : ''}` } });
  if (st('heartRate') === 'critical' || (hr && hr.value > 100 && (st('spo2') === 'warn' || st('spo2') === 'critical'))) out.push({ id: 'chestPain', reason: { tr: `Nabız ${hr?.value} (${st('heartRate')}): göğüs ağrısı var mı? CMO doğrular`, en: `HR ${hr?.value} (${st('heartRate')}): chest pain? CMO confirms` } });
  if (spo2 && (st('spo2') === 'warn' || st('spo2') === 'critical' || st('respRate') === 'warn')) out.push({ id: 'breathing', reason: { tr: `SpO₂ ${spo2.value}% / solunum ${v('respRate')?.value}`, en: `SpO₂ ${spo2.value}% / resp ${v('respRate')?.value}` } });
  if (glu && glu.value <= 70) out.push({ id: 'hypoglycemia', reason: { tr: `Kan şekeri ${glu.value} mg/dL`, en: `Glucose ${glu.value} mg/dL` } });
  if (s.extra.some((x) => x.id === 'dcs')) out.push({ id: 'dcs', reason: { tr: 'DCS belirti bildirimi', en: 'DCS symptom report' } });
  if (st('sleepHours') === 'warn') out.push({ id: 'insomnia', reason: { tr: `Uyku ${v('sleepHours')?.value} sa`, en: `Sleep ${v('sleepHours')?.value} h` } });
  if (st('cabinCO2') === 'warn' || st('cabinCO2') === 'critical') out.push({ id: 'pain', reason: { tr: `Kabin CO₂ ${v('cabinCO2')?.value} mmHg (baş ağrısı aralığı)`, en: `Cabin CO₂ ${v('cabinCO2')?.value} mmHg (headache range)` } });
  if (s.cabinPsia != null && s.cabinPsia < 10.9) out.push({ id: 'altitude', reason: { tr: `Kabin ${s.cabinPsia} psia < 10,9 (≈8000 ft)`, en: `Cabin ${s.cabinPsia} psia < 10.9 (≈8000 ft)` } });
  return out;
}
