// Müdahale protokol kütüphanesi (DETERMİNİSTİK, KAYNAKLI). Yapay zekâ yalnızca bu kartların KİMLİKLERİNİ seçer/sıralar;
// doz ve ilaç satırları hiçbir zaman modelden geçmez. İlaç/doz satırları kaynağından BİREBİR (İngilizce) alıntıdır.
//
// NASA kaynakları: (1) ISS Emergency Medical Procedures (MED CL, prosedürler 2015, FOIA 16-JSC-F-00174 ile 2016'da kısmi yayın) —
// alerji 1.101, CPR 1.102, ALS 1.103, nöbet 1.107, solunum 1.108 ve ilaç kiti 3.001; (2) yayımlanmayan konular için
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
  id: ProtocolId; title: L; source: SourceRef & { page: string }; kind: 'NASA_ISS' | 'NASA_CHECKLIST' | 'CLINICAL_GUIDELINE';
  /** Kontrol listesinin kendi belirti/bulgu listesi: CMO işaretler; işaretlenmeden ilaç adımları görünmez */
  confirm: L[]; steps: PStep[]; escalate: Escalation; note?: L;
}

const CL = (page: string) => ({ label: `NASA JSC-48031 Medical Checklist Rev K (Shuttle, 2008) · ${page}`, url: 'https://ibiblio.org/apollo/Shuttle/Medical%20Checklist/Medical%20Checklist%20Rev%20K%20PCN-4.pdf', page });
const ISS = (page: string) => ({ label: `NASA ISS Emergency Medical Procedures (MED CL, 2015; FOIA 2016) · ${page}`, url: 'https://www.governmentattic.org/19docs/NASA-ISSmedicalEmergManual_2016.pdf', page });
const CPR_BOX: PStep = { text: { tr: 'Nabız veya solunum yoksa: hasta/kurtarıcı bağlarıyla CPR. Bilinci açıksa: QDM maskesiyle ek oksijen.', en: 'If no pulse or respiration: CPR using patient/rescuer restraints. If conscious: supplemental O₂ with QDM.' } };
const VITALS: PStep = { text: { tr: 'Tansiyon aleti, steteskop, termometre çıkar; vital bulguları kaydet (tansiyon, nabız, solunum, ısı).', en: 'Unstow BP cuff, stethoscope, thermometer; record vital signs (BP, pulse, respiration, temperature).' } };
const ECG: PStep = { text: { tr: 'EKG elektrotlarını bağla (kardiyak izleme).', en: 'Attach ECG leads (cardiac monitoring).' } };
const SURGEON: PStep = { text: { tr: 'Uçuş cerrahıyla iletişime geç.', en: 'Contact Surgeon.' } };

export const PROTOCOLS: Record<ProtocolId, Protocol> = {
  chestPain: {
    id: 'chestPain', kind: 'NASA_CHECKLIST', escalate: 'ground', source: CL('Emergency 1-36/1-37'),
    title: { tr: 'Göğüs ağrısı', en: 'Chest pain' },
    note: { tr: 'ISS göğüs ağrısı prosedürü yayımlanmadı; adımlar Shuttle listesinden. ISS kitinde Aspirin 325 mg ("yemekle al") ve Nitroglycerin (Nitrostat) 0,4 mg bulunur (3.001; nitrogliserin kullanımı uçuş cerrahı kararı). AHA 2024 §6.4: travmasız göğüs ağrısında, alerji ya da sağlık profesyonelinin yasağı yoksa 162–325 mg aspirin çiğneyip yutmak teşvik edilebilir (2b); emin değilsen verme (2b).', en: 'The ISS chest-pain procedure was not released; steps come from the Shuttle checklist. The ISS kit carries Aspirin 325 mg ("take with food") and Nitroglycerin (Nitrostat) 0.4 mg (3.001; nitroglycerin use is the flight surgeon\'s decision). AHA 2024 §6.4: for nontraumatic chest pain, chewing and swallowing 162–325 mg aspirin may be encouraged unless allergic or advised not to (2b); if uncertain, wait (2b).' },
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
      { gravity: 'partialG', text: { tr: 'Kısmi yerçekimi (Ay/Mars), AHA/Kızılhaç 2024 §5.2: bilinci normal ise sırtüstü yatır (2a). Bilinç azalmış, kusuyor ya da sürekli izlenemiyorsa yan yatış (derlenme) pozisyonu (2a). Travma yoksa ayakları ~15–30 cm (≈30°–45°) kaldırmak makul olabilir (2b); ağrı, rahatsızlık veya belirtilerde kötüleşme olursa sırtüstüne geri al (2b). Dünya kılavuzunun kısmi yerçekimine uygulanması VARSAYIMDIR.', en: 'Partial gravity (Moon/Mars), AHA/Red Cross 2024 §5.2: if normally alert, place supine (2a). If decreased alertness, vomiting, or cannot be watched: recovery position (2a). Without trauma, raising the feet ~6–12 in (≈30°–45°) may be reasonable (2b); if it causes pain, discomfort or worse symptoms, return to supine (2b). Applying Earth guidance to partial gravity is an ASSUMPTION.' } }],
  },
  breathing: {
    id: 'breathing', kind: 'NASA_ISS', escalate: 'crew', source: ISS('1.108 Difficulty breathing (PDF p. 22–24) + 1.103 block 14'),
    title: { tr: 'Solunum güçlüğü', en: 'Difficulty breathing' },
    note: { tr: 'ISS 1.103 blok 14: dudak/yüz/el morumsu-gri, solunum <12 veya >30/dk ya da horlama/nefes almada güçlük varsa AMBU ile solunum desteği (5 sn\'de bir nefes) + oksijen. Kimyasal maruziyet varsa önce ISS 1.106 Toxic Exposure (kurtarıcı güvenliği, dekontaminasyon).', en: 'ISS 1.103 block 14: if lips/face/hands blue-gray, breathing rate <12 or >30, or snoring/difficulty inhaling → assist breathing with AMBU bag (one breath every 5 s) + oxygen. If chemical exposure, first ISS 1.106 Toxic Exposure (rescuer safety, decontamination).' },
    confirm: [{ tr: 'Hırıltı / nefes darlığı', en: 'Wheezing / shortness of breath' }, { tr: 'Artmış solunum işi', en: 'Increased work of breathing' }, { tr: 'Steteskopla anormal akciğer sesi', en: 'Abnormal lung sounds on stethoscope' }],
    steps: [
      { text: { tr: 'Nabız ve solunum sayısını 15 sn say, 4 ile çarp; kaydet.', en: 'Count pulse and respiratory rate for 15 s and multiply by four; record.' } },
      { text: { tr: 'Oksijen: Low Flow Non-Rebreather maske (Respiratory Support Pack, 3.201 kartı).', en: 'Oxygen via Low Flow Non-Rebreather Mask (Respiratory Support Pack, 3.201 cue card).' } },
      { medical: true, cond: { tr: 'Solunum güçlüğü varsa', en: 'If difficulty breathing' }, text: { tr: 'Albuterol inhaler (ISS prosedüründe kilit yok; tedavi edilir, sonra MCC-H aranır):', en: 'Albuterol inhaler (no lock in ISS procedure; treat, then call MCC-H):' }, drug: { id: 'breathing.albuterol', verbatim: 'Albuterol (Proventil HFA) [Topical & Injectable Medication Pack (Brown)] · kit 3.001: 90 mcg, 6.7 gm, Inhaler', dose: '1.3 Have patient fully exhale, inhale slowly and activate the inhaler, hold breath for 8 to 10 seconds before exhaling. Deliver a second dose.', locked: false } },
      { text: { tr: 'Oksimetre (SpO₂), havayolu muayenesi, iki taraflı akciğer dinleme, tansiyon; kaydet.', en: 'Blood oximeter (SpO₂), airway exam, listen to both lungs front and back, blood pressure; record.' } },
      { text: { tr: 'Öykü: belirtilerin başlangıcı, ilaçlar, ateş/öksürük. MCC-H\'yi ara, özel tıbbi görüşme (PMC) iste.', en: 'History: onset, medications, fever/cough. Call MCC-H to request PMC.' } },
      { gravity: 'partialG', text: { tr: 'Kısmi yerçekimi: bilinci açık hasta nefes almak için en rahat pozisyonu seçsin, çoğunlukla oturur (AHA 2024 §5.1, Sınıf 1). Dünya kılavuzu, VARSAYIM.', en: 'Partial gravity: an alert patient assumes the position most comfortable for breathing, usually sitting up (AHA 2024 §5.1, Class 1). Earth guidance, ASSUMPTION.' } }],
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
    source: { label: 'ADA 15-15 rule (2023) · AHA/Red Cross First Aid 2024 §6.7', url: 'https://doi.org/10.1161/CIR.0000000000001281', page: 'ADA 2023 · AHA 2024 §6.7' },
    title: { tr: 'Düşük kan şekeri (≤70 mg/dL)', en: 'Low blood glucose (≤70 mg/dL)' },
    note: { tr: 'İki kaynak miktarda farklıdır: ADA 15 g / 15 dk; AHA 2024 ≥20 g ağızdan glukoz (tablet tercih, 2a). Kılavuzlar Dünya içindir; astronotlara uygulanması VARSAYIMDIR. ISS kit listesinde (3.001) glukoz kalemi yoktur.', en: 'The two sources differ in amount: ADA 15 g / 15 min; AHA 2024 ≥20 g oral glucose (tablets preferred, 2a). Earth guidance; applying it to astronauts is an ASSUMPTION. No glucose item is listed in the ISS kit (3.001).' },
    confirm: [{ tr: 'Bilinci açık, yutabiliyor', en: 'Awake, able to swallow' }],
    steps: [
      { cond: { tr: 'Bilinci kapalı veya yutamıyorsa', en: 'If not awake or unable to swallow' }, text: { tr: 'Ağızdan HİÇBİR ŞEY verme (AHA 2024, 3: Zarar); hemen uçuş cerrahı (damar yolu glukoz gerekebilir).', en: 'Give NOTHING by mouth (AHA 2024, 3: Harm); call the flight surgeon immediately (IV dextrose may be needed).' } },
      { medical: true, cond: { tr: 'Bilinci açık ve yutabiliyorsa', en: 'If awake and able to swallow' }, text: { tr: 'Hızlı etkili karbonhidrat: ADA 15 g · AHA 2024 ≥20 g glukoz (tablet tercih).', en: 'Fast-acting carbohydrate: ADA 15 g · AHA 2024 ≥20 g glucose (tablets preferred).' } },
      { text: { tr: '15 dk sonra yeniden ölç; hâlâ ≤70 ise tekrarla (ADA). 10 dk içinde düzelme yoksa veya nöbet olursa üst düzeye çık (AHA 2024, Sınıf 1).', en: 'Recheck in 15 min; repeat if still ≤70 (ADA). No improvement within 10 min, or a seizure → escalate (AHA 2024, Class 1).' } },
      { text: { tr: '70 üstüne çıkınca ve yakında öğün yoksa protein + karbonhidrat atıştırmalığı.', en: 'Once above 70, protein + carbohydrate snack if no meal is coming soon.' } },
      SURGEON],
  },
  htnCrisis: {
    id: 'htnCrisis', kind: 'CLINICAL_GUIDELINE', escalate: 'ground',
    source: { label: 'AHA: When to call 911 for high blood pressure (son gözden geçirme 14 Ağu 2025)', url: 'https://www.heart.org/en/health-topics/high-blood-pressure/understanding-blood-pressure-readings/when-to-call-911-for-high-blood-pressure', page: 'heart.org, 2025' },
    title: { tr: 'Çok yüksek tansiyon (>180/120)', en: 'Very high blood pressure (>180/120)' },
    note: { tr: 'AHA iki durum ayırır: "şiddetli hipertansiyon" (en az 1 dk arayla 2 ölçümde >180/120, belirti yok: genellikle hastane gerekmez, en kısa sürede klinisyenle ilaç ayarı) ve "hipertansif acil durum" (belirti var: beklenmez). ISS kitinde Lisinopril ve Metoprolol XL bulunur (3.001); ilaç kararı uçuş cerrahınındır. Not: içerik heart.org sayfasından, kullanıcının sağladığı Türkçe özet üzerinden alınmıştır.', en: 'AHA distinguishes "severe hypertension" (>180/120 on 2 readings ≥1 min apart, no symptoms: usually no hospital, contact a clinician soon for medication adjustment) and "hypertensive emergency" (symptoms: do not wait). The ISS kit carries Lisinopril and Metoprolol XL (3.001); medication is the flight surgeon\'s decision. Note: content taken from heart.org via a user-provided Turkish summary.' },
    confirm: [{ tr: 'Göğüs ağrısı', en: 'Chest pain' }, { tr: 'Nefes darlığı', en: 'Shortness of breath' }, { tr: 'Sırt ağrısı', en: 'Back pain' }, { tr: 'Uyuşma / güçsüzlük', en: 'Numbness / weakness' }, { tr: 'Görme değişikliği', en: 'Change in vision' }, { tr: 'Konuşma güçlüğü', en: 'Difficulty speaking' }],
    steps: [
      { text: { tr: 'En az 1 dakika bekle, tansiyonu yeniden ölç.', en: 'Wait at least 1 minute and measure blood pressure again.' } },
      { cond: { tr: 'Hâlâ >180/120, belirti yok', en: 'Still >180/120, no symptoms' }, text: { tr: 'Şiddetli hipertansiyon: uçuş cerrahına en kısa sürede bildir (ilaç ayarı onun kararı).', en: 'Severe hypertension: inform the flight surgeon as soon as possible (medication adjustment is their decision).' } },
      { cond: { tr: 'Belirti varsa', en: 'With symptoms' }, text: { tr: 'Hipertansif acil durum: tansiyonun kendiliğinden düşmesini bekleme; hemen uçuş cerrahı.', en: 'Hypertensive emergency: do not wait for BP to come down on its own; call the flight surgeon immediately.' } }],
  },
  allergy: {
    id: 'allergy', kind: 'NASA_ISS', escalate: 'ground', source: ISS('1.101 Severe allergic reaction (PDF p. 4–5)'),
    title: { tr: 'Ağır alerjik reaksiyon', en: 'Severe allergic reaction' },
    note: { tr: 'Anafilaksi ≥2 sistemi tutar (solunum, deri, dolaşım, sindirim; AHA). Sonraki ISS adımı "2.0.403 Allergic Reaction" kamuya yayımlanmadı → uçuş cerrahı. Şok bulguları için Şok kartı. ISS kitinde Diphenhydramine (Benadryl) oral/IM bulunur (3.001).', en: 'Anaphylaxis involves ≥2 body systems (respiratory, skin, circulation, GI; AHA). The next ISS step "2.0.403 Allergic Reaction" was not released → flight surgeon. For shock signs see Shock card. The ISS kit carries Diphenhydramine (Benadryl) oral/IM (3.001).' },
    confirm: [{ tr: 'Solunum güçlüğü / hırıltı', en: 'Difficulty breathing / wheezing' }, { tr: 'Kurdeşen, dudak/göz şişmesi', en: 'Hives, lip/eye swelling' }, { tr: 'Düşük tansiyon / şok', en: 'Low BP / shock' }, { tr: 'Karın krampı, ishal', en: 'Abdominal cramps, diarrhea' }],
    steps: [
      { medical: true, cond: { tr: 'Ağır reaksiyon bulguları varsa', en: 'If signs of severe reaction' }, text: { tr: 'EpiPen: koruyucu tüpten çıkar, başparmak emniyet kapağına yakın yumruk yap, kapağı çek; iğne ucunu uyluk dışına dik ve sertçe bastır, klik sesinden sonra 10 sn tut. Giysi üzerinden yapma, parmağı iğne ucuna koyma.', en: 'EpiPen: remove from tube, fist with thumb toward safety cap, pull cap; jab needle end perpendicular and firmly against outer thigh until click, hold 10 s. Not through clothing; no fingers over needle end.' }, drug: { id: 'allergy.epipen', verbatim: 'Epinephrine (EpiPen) [Emergency Medical Treatment Pack (Red)] · kit 3.001: 1:1000, 0.3 mL, Intramuscular', dose: '1.6 Epinephrine (EpiPen) may be repeated every 20 minutes if symptoms recur or progress.', locked: false } },
      { text: { tr: 'Kullanılmış EpiPen\'i tüpüne koy, gri bantla kapat. MCC-H\'yi ara, özel tıbbi görüşme (PMC) iste.', en: 'Discard used EpiPen in its tube, secure with Gray Tape. Call MCC-H to request PMC.' } },
      { text: { tr: 'Nabız, solunum, tansiyonu izle; ISS 2.0.403 Allergic Reaction prosedürüne geç (yayımlanmadı → uçuş cerrahı).', en: 'Monitor pulse, respiration, BP; go to ISS 2.0.403 Allergic Reaction (not released → flight surgeon).' } }],
  },
  seizure: {
    id: 'seizure', kind: 'NASA_ISS', escalate: 'ground', source: ISS('1.107 Seizure (PDF p. 19–21)'),
    title: { tr: 'Nöbet', en: 'Seizure' },
    note: { tr: 'Nöbetler genelde 1 dakikadan kısa sürer; sonrasında hasta birkaç dakika konfüzdür. Ağzı zorla açma, ağza bir şey koyma (ISS NOT; AHA 2024 3: Zarar). Hastayı kısıtlama (AHA 2024).', en: 'Seizures typically last under a minute; afterwards the patient is confused for several minutes. Never pry the mouth or put anything in it (ISS NOTE; AHA 2024 3: Harm). Do not restrain the patient (AHA 2024).' },
    confirm: [{ tr: 'Nöbet geçiriyor', en: 'Seizure in progress' }],
    steps: [
      { text: { tr: 'Yaralanmayı önle: hastayı modülün ortasına, sert yapılardan uzağa al.', en: 'Protect from injury: locate the patient in the centre of a module, away from hard structures.' } },
      { medical: true, cond: { tr: 'Nöbet varsa', en: 'If seizing' }, text: { tr: 'Kas içi Diazepam (ISS prosedüründe kilit yok; MCC-H sonra aranır):', en: 'Intramuscular Diazepam (no lock in ISS procedure; MCC-H called afterwards):' }, drug: { id: 'seizure.diazepamIM', verbatim: 'Diazepam (Valium) [Topical & Injectable Medication Pack (Brown)] · kit 3.001: 5 mg/mL, 2 mL, Intramuscular', dose: '2.1 Prepare 2 mL Diazepam (Valium) 5 mg/mL for a total of 10 mg. 2.2 Give 2 mL intramuscular shot. If seizure continues for > 5 minutes or for repeated seizures, repeat medication administration in 10 minutes.', locked: false } },
      { text: { tr: 'Oksimetre (SpO₂), Non-Rebreather maskeyle oksijen, damar yolu.', en: 'Blood oximeter (SpO₂), oxygen via Non-Rebreather Mask, IV access.' } },
      { text: { tr: 'Baş, kollar-bacaklar, dişler ve dili yaralanma için muayene et; fotoğrafla. MCC-H\'yi ara (PMC).', en: 'Examine head, extremities, teeth and tongue for injuries; photo document. Call MCC-H to request PMC.' } },
      { medical: true, cond: { tr: 'Uyanık, bilinci yerinde ve yutabiliyorsa', en: 'When awake, coherent and able to swallow' }, text: { tr: 'Nöbet önleyici (uçuş cerrahının yönlendirmesiyle):', en: 'Antiseizure (as directed by Surgeon):' }, drug: { id: 'seizure.phenytoin', verbatim: 'Phenytoin (Dilantin ER) [Oral Medication Pack (Purple)] · kit 3.001: 300 mg, Oral, capsule — Swallow whole; do not crush or chew.', dose: '7.2 Give one capsule of Phenytoin (Dilantin ER) by mouth, as directed by Surgeon. 7.3 After two hours, give a second dose, or as directed by Surgeon.', locked: true } }],
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

/** ISS ilaç kiti (MED CL 3.001, 09 APR 15; FOIA 2016). "strength" kitteki birimdir, DOZ DEĞİLDİR; kullanım/miktar uçuş cerrahına göredir.
 *  Satırlar PDF sayfa metninden kontrol edildi (pdftotext -layout kit tablosu sütunlarını karıştırdığı için ona güvenilmedi). */
export interface KitItem { id: string; name: string; strength: string; route: string; pack: string; comment?: string }
export const ISS_KIT: KitItem[] = [
  { id: 'kit.aspirin', name: 'Aspirin', strength: '325 mg', route: 'Oral', pack: 'Convenience (White) T1', comment: 'Take with food.' },
  { id: 'kit.tylenol', name: 'Acetaminophen (Tylenol)', strength: '325 mg', route: 'Oral', pack: 'Convenience (White) T1', comment: 'No more than 12 tablets every 24 hours.' },
  { id: 'kit.motrin', name: 'Ibuprofen (Motrin)', strength: '400 mg', route: 'Oral', pack: 'Convenience (White) T1', comment: 'No more than 8 tablets every 24 hours. Take with food.' },
  { id: 'kit.loperamide', name: 'Loperamide (Imodium)', strength: '2 mg', route: 'Oral', pack: 'Convenience (White) T1', comment: 'Use for nonbloody diarrhea. No more than 8 tablets every 24 hours.' },
  { id: 'kit.loratadine', name: 'Loratadine (Claritin)', strength: '10 mg', route: 'Oral', pack: 'Convenience (White) T1' },
  { id: 'kit.melatonin', name: 'Melatonin', strength: '3 mg', route: 'Oral', pack: 'Convenience (White) T1', comment: 'Do not use with other sleep meds.' },
  { id: 'kit.zolpidem', name: 'Zolpidem (Ambien)', strength: '10 mg', route: 'Oral', pack: 'Convenience (White) T1', comment: 'Do not use with other sleep meds.' },
  { id: 'kit.zaleplon', name: 'Zaleplon (Sonata)', strength: '10 mg', route: 'Oral', pack: 'Convenience (White) T1', comment: 'Do not take with a high fat meal. Do not use with other sleep meds.' },
  { id: 'kit.epipen', name: 'Epinephrine (EpiPen)', strength: '1:1000, 0.3 mL', route: 'Intramuscular', pack: 'Emergency (Red) T2' },
  { id: 'kit.acetazolamide', name: 'Acetazolamide (Diamox)', strength: '250 mg', route: 'Oral', pack: 'Oral Medication (Purple) T8' },
  { id: 'kit.diphenhydramineOral', name: 'Diphenhydramine (Benadryl)', strength: '25 mg', route: 'Oral', pack: 'Oral Medication (Purple) T8', comment: 'May cause sedation and impair performance. Do not use with sleep meds.' },
  { id: 'kit.phenytoin', name: 'Phenytoin (Dilantin ER)', strength: '300 mg', route: 'Oral', pack: 'Oral Medication (Purple) T8', comment: 'Swallow whole; do not crush or chew.' },
  { id: 'kit.lorazepam', name: 'Lorazepam (Ativan)', strength: '1 mg', route: 'Oral', pack: 'Oral Medication (Purple) T8' },
  { id: 'kit.lisinopril', name: 'Lisinopril (Zestril)', strength: '10 mg', route: 'Oral', pack: 'Oral Medication (Purple) T8' },
  { id: 'kit.metoprolol', name: 'Metoprolol XL (Toprol XL)', strength: '50 mg', route: 'Oral', pack: 'Oral Medication (Purple) T8', comment: 'Swallow whole; do not crush or chew.' },
  { id: 'kit.nitroglycerin', name: 'Nitroglycerin (Nitrostat)', strength: '0.4 mg', route: 'Oral', pack: 'Oral Medication (Purple) T8' },
  { id: 'kit.meclizine', name: 'Meclizine (Antivert)', strength: '25 mg', route: 'Oral', pack: 'Oral Medication (Purple) T8', comment: 'May cause sedation and impair performance. Do not use with sleep meds.' },
  { id: 'kit.ondansetron', name: 'Ondansetron (Zofran ODT)', strength: '8 mg', route: 'Oral', pack: 'Oral Medication (Purple) T8' },
  { id: 'kit.promethazineOral', name: 'Promethazine (Phenergan)', strength: '25 mg', route: 'Oral', pack: 'Oral Medication (Purple) T8', comment: 'May cause sedation and impair performance. Do not use with sleep meds.' },
  { id: 'kit.prednisone', name: 'Prednisone (Deltasone)', strength: '20 mg', route: 'Oral', pack: 'Oral Medication (Purple) T8', comment: 'Take with food.' },
  { id: 'kit.diphenhydramineIM', name: 'Diphenhydramine (Benadryl)', strength: '50 mg/mL, 1 mL', route: 'Intramuscular', pack: 'Topical & Injectable (Brown) T10', comment: 'May cause sedation and impair performance. Do not take with sleep meds.' },
  { id: 'kit.diazepam', name: 'Diazepam (Valium)', strength: '5 mg/mL, 2 mL', route: 'Intramuscular', pack: 'Topical & Injectable (Brown) T10' },
  { id: 'kit.albuterol', name: 'Albuterol (Proventil HFA)', strength: '90 mcg, 6.7 gm', route: 'Inhaler', pack: 'Topical & Injectable (Brown) T10' },
  { id: 'kit.fluticasone', name: 'Fluticasone (Flovent HFA)', strength: '220 mcg, 12 gm', route: 'Inhaler', pack: 'Topical & Injectable (Brown) T10' },
  { id: 'kit.ketorolac', name: 'Ketorolac (Toradol)', strength: '30 mg/mL, 2 mL', route: 'Intramuscular', pack: 'Topical & Injectable (Brown) T10' },
  { id: 'kit.promethazineIM', name: 'Promethazine (Phenergan)', strength: '25 mg/mL, 1 mL', route: 'Intramuscular', pack: 'Topical & Injectable (Brown) T10', comment: 'May cause sedation and impair performance.' },
  { id: 'kit.dexamethasone', name: 'Dexamethasone (Decadron)', strength: '10 mg/mL, 1 mL', route: 'Intramuscular', pack: 'Topical & Injectable (Brown) T10' },
];
export const KIT_BY_ID: Record<string, KitItem> = Object.fromEntries(ISS_KIT.map((k) => [k.id, k]));

/** İlaç adı listesi: AI serbest metninde geçerse metin reddedilir (doz modelden geçmez) */
export const DRUG_WORDS = ['epinefrin', 'nitrogliserin', 'salbutamol', 'parasetamol', 'aspirin', 'proventil', 'albuterol', 'saline', 'serum', 'epinephrine', 'epi pen', 'benadryl', 'valium', 'diazepam', 'ambien', 'restoril', 'diamox', 'glucagon', 'glukagon', 'insulin', 'insülin', 'nitroglycerin', 'atropine'];

/** Kütüphanedeki tüm ilaçlar: kimlik → (ilaç, protokol). AI reçeteyi YALNIZCA bu kimliklerle önerir. */
export function allDrugs(): Record<string, { drug: Drug; protocol: ProtocolId; cond?: L }> {
  const out: Record<string, { drug: Drug; protocol: ProtocolId; cond?: L }> = {};
  for (const p of Object.values(PROTOCOLS)) for (const st of p.steps) if (st.drug) out[st.drug.id] = { drug: st.drug, protocol: p.id, cond: st.cond };
  return out;
}

/** Deterministik eşleştirici: gösterilen anlık durumdan ADAY kartlar (CMO belirtileri doğrular). Çevrimdışı çalışır. */
export interface SnapLite { activity: string; gravity_g: number; cabinPsia?: number; indicators: { id: string; value: number; status: string }[]; extra: { id: string; status: string }[]; symptoms?: { category: string; quote: string }[] }
/** Astronot bildirimi kategorisi → aday kart (tanı değil; CMO doğrular) */
const SYMPTOM_CARD: Record<string, ProtocolId> = { chestPain: 'chestPain', breathing: 'breathing', nausea: 'nausea', pain: 'pain', allergy: 'allergy' };
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
  for (const x of s.symptoms ?? []) {
    const id = SYMPTOM_CARD[x.category];
    if (id && !out.some((o) => o.id === id)) out.push({ id, reason: { tr: `Astronot bildirimi (VEGA): “${x.quote}”`, en: `Astronaut report (VEGA): “${x.quote}”` } });
  }
  if (s.cabinPsia != null && s.cabinPsia < 10.9) out.push({ id: 'altitude', reason: { tr: `Kabin ${s.cabinPsia} psia < 10,9 (≈8000 ft)`, en: `Cabin ${s.cabinPsia} psia < 10.9 (≈8000 ft)` } });
  return out;
}
