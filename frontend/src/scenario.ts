// Senaryo motoru: tek tıkla başlayan, adım adım ilerleyen demo akışları.
// Kurallar (advisor): senaryolar addReading KULLANMAZ (USER_INPUT olur, sahte check-in puanı verir) → akış göstergeleri
// yalnızca simülatör hedefiyle (target) sürülür. Adımlar zamanlayıcıyla değil KOŞULLA ilerler. Durdur = eski hâle dön.
// Gerçek veri tekrarları (fırtınalar) storms.json'dan gelir; eşik çarpanları VARSAYIMDIR ve öyle etiketlenir.
// AI notu: Claude (Anthropic) yardımıyla yazılmıştır.
import { create } from 'zustand';
import storms from './data/storms.json';
import { useApp } from './store';
import { ENVS, type EnvId } from './engine/environment';
import { INDICATORS } from './engine/indicators';
import type { Activity, Escalation, IndicatorId, Provenance, SourceRef, Status } from './engine/types';
import { speakSentence } from './audio';
import { reportSymptom, useSymptoms, type SymptomCategory } from './symptoms';
import type { GlucoseCtx } from './engine/types';

export type ScenarioId = 'tachy' | 'iss2017' | 'mars2024' | 'evaCO2' | 'evaDCS' | 'allergy' | 'hypo' | 'htn' | 'cabinLeak' | 'sas';
export const SCENARIOS: ScenarioId[] = ['tachy', 'iss2017', 'mars2024', 'evaCO2', 'evaDCS', 'allergy', 'hypo', 'htn', 'cabinLeak', 'sas'];
export type L = { tr: string; en: string };

export interface ExtraAlert {
  id: 'radiation' | 'suitCO2' | 'dcs' | 'cabin';
  status: Status; title: L; value: string; label: L; steps: L[]; sources: SourceRef[]; escalate: Escalation; prov: Provenance; note?: L;
}
export interface ReplayPoint { t: string; v: number; hl: boolean | null }
export interface Replay {
  label: L; series: ReplayPoint[]; idx: number; baseline: number; baselineNote: L; unit: 'µGy/h';
  compression: number; doseSoFar: number; doseUnit: L; limit?: L; source: SourceRef[]; events: { t: string; text: L }[];
}
export interface Suit { pressurePsia: number; ppO2mmHg: number; ppCO2mmHg: number }

const SRC = {
  tepc: { label: 'ISS TEPC (data.nasa.gov)', url: 'https://data.nasa.gov/dataset/iss-tissue-equivalent-proportional-counter-tepc-dose-analyzer-10-s-data-61b24' },
  radlab: { label: 'NASA OSDR RadLab (MSL-RAD)', url: 'https://visualization.osdr.nasa.gov/radlab/' },
  donki: { label: 'NASA CCMC DONKI', url: 'https://ccmc.gsfc.nasa.gov/DONKI/' },
  tb020: { label: 'OCHMO-TB-020 Radiation (SPE & EVA)', url: 'https://www.nasa.gov/wp-content/uploads/2023/03/radiation-protection-technical-brief-ochmo.pdf' },
  std3001v2: { label: 'NASA-STD-3001 Vol 2 Rev B [V2 11039] Table 23', url: 'https://standards.nasa.gov/sites/default/files/standards/NASA/C/Historical/nasa-std-3001_vol_2_rev_b.pdf' },
  tb004: { label: 'OCHMO-TB-004 CO₂ · V2 [11035][11036]', url: 'https://nasa.gov/wp-content/uploads/2023/03/co2-technical-brief-ochmo.pdf' },
  tb037: { label: 'OCHMO-TB-037 DCS', url: 'https://www.nasa.gov/wp-content/uploads/2023/12/ochmo-tb-037-decompression-sickness.pdf' },
  aha: { label: 'AHA: Target heart rates', url: 'https://www.heart.org/en/healthy-living/fitness/fitness-basics/target-heart-rates' },
  tb033: { label: 'OCHMO-TB-033 Spaceflight medical care (SAS 50–70%)', url: 'https://www.nasa.gov/wp-content/uploads/2023/07/ochmo-tb-033-spaceflight-experience-medical-care-rev-c.pdf' },
};

export const SCEN_META: Record<ScenarioId, { title: L; desc: L; prov: Provenance }> = {
  tachy: { title: { tr: 'Taşikardi: dinlenme ve egzersiz', en: 'Tachycardia: rest vs exercise' }, desc: { tr: 'Aynı nabız, farklı bağlam: dinlenmede kritik alarm, egzersizde beklenen.', en: 'Same heart rate, different context: critical at rest, expected during exercise.' }, prov: 'SIMULATED' },
  iss2017: { title: { tr: 'Güneş fırtınası: ISS, Eylül 2017', en: 'Solar storm: ISS, Sep 2017' }, desc: { tr: 'Gerçek TEPC dozimetre verisi + DONKI olayları, hızlandırılmış tekrar.', en: 'Real TEPC dosimeter data + DONKI events, accelerated replay.' }, prov: 'NASA_MEASUREMENT' },
  mars2024: { title: { tr: 'Güneş fırtınası: Mars, Mayıs 2024', en: 'Solar storm: Mars, May 2024' }, desc: { tr: 'Curiosity RAD gerçek doz verisi; Dünya ile iletişim gecikmesi.', en: 'Real Curiosity RAD dose data; Earth communication delay.' }, prov: 'NASA_MEASUREMENT' },
  evaCO2: { title: { tr: 'Uzay yürüyüşü: kıyafette CO₂ birikimi', en: 'EVA: suit CO₂ build-up' }, desc: { tr: 'Kıyafet CO₂ yükselir; NASA-STD-3001 Tablo 23 süre limitleri; ekip kararıyla yürüyüş sonlandırılır.', en: 'Suit CO₂ rises; NASA-STD-3001 Table 23 duration limits; EVA terminated on crew decision.' }, prov: 'SIMULATED' },
  evaDCS: { title: { tr: 'Uzay yürüyüşü: vurgun (DCS) belirtisi', en: 'EVA: decompression sickness symptom' }, desc: { tr: 'Belirti bildirimiyle tetiklenir (nabızla değil); yürüyüş sonlandırılır.', en: 'Triggered by a symptom report (not a vital sign); EVA is terminated.' }, prov: 'SIMULATED' },
  allergy: { title: { tr: 'Ağır alerjik reaksiyon', en: 'Severe allergic reaction' }, desc: { tr: 'Yemek sonrası kaşıntı ve dudak şişliği VEGA ile bildirilir; tansiyon düşer, nabız ve solunum artar. ISS 1.101 EpiPen kartı.', en: 'Itching and lip swelling after a meal reported via VEGA; BP falls, pulse and breathing rise. ISS 1.101 EpiPen card.' }, prov: 'SIMULATED' },
  hypo: { title: { tr: 'Düşük kan şekeri', en: 'Low blood glucose' }, desc: { tr: 'Uzun egzersiz, atlanan öğün: kan şekeri 54 altına iner; titreme/terleme bildirimi; ADA/AHA adımları ve yeniden ölçüm.', en: 'Long exercise, skipped meal: glucose drops below 54; shaking/sweating report; ADA/AHA steps and recheck.' }, prov: 'SIMULATED' },
  htn: { title: { tr: 'Çok yüksek tansiyon + belirti', en: 'Very high BP + symptoms' }, desc: { tr: 'Şiddetli baş ağrısı ve bulanık görme bildirimi; iki ölçümde >180/120 → hipertansif acil durum (AHA).', en: 'Severe headache and blurred vision reported; >180/120 on two readings → hypertensive emergency (AHA).' }, prov: 'SIMULATED' },
  cabinLeak: { title: { tr: 'Kabin basıncı düşüşü', en: 'Cabin pressure drop' }, desc: { tr: 'Varsayımsal yavaş kaçak: basınç ≈8000 ft eşdeğerinin altına iner, SpO₂ düşer; baş ağrısı/bulantı bildirimi; irtifa hastalığı kartı.', en: 'Hypothetical slow leak: pressure falls below ≈8000 ft equivalent, SpO₂ drops; headache/nausea report; altitude sickness card.' }, prov: 'SIMULATED' },
  sas: { title: { tr: 'Uzay adaptasyon sendromu (2. gün)', en: 'Space adaptation syndrome (day 2)' }, desc: { tr: 'Yaşamsal değerler neredeyse normal; uyarıyı astronotun "midem bulanıyor" bildirimi başlatır. Mürettebatın %50–70\'i (TB-033).', en: 'Vitals near normal; the alert starts from the astronaut\'s "I feel nauseous" report. Affects 50–70% of crew (TB-033).' }, prov: 'SIMULATED' },
};

const SPOT_SAVE: IndicatorId[] = ['systolic', 'diastolic', 'glucose', 'bodyTemp'];
interface Saved { activity: Activity; env: EnvId; target: Partial<Record<IndicatorId, number>>; acked: IndicatorId[]; missionDay: number; spot: Partial<Record<IndicatorId, { value: number; ctx?: GlucoseCtx }>> }
interface ScenState {
  id: ScenarioId | null; caption: L | null; stepNo: number; replay: Replay | null; suit: Suit | null; extra: ExtraAlert[]; saved: Saved | null; done: boolean; ackedExtra: string[];
}
export const useScenario = create<ScenState>(() => ({ id: null, caption: null, stepNo: 0, replay: null, suit: null, extra: [], saved: null, done: false, ackedExtra: [] }));

/* ---------------- çalışma altyapısı ---------------- */
let token = 0;
class Cancelled extends Error {}
const alive = (my: number) => { if (my !== token) throw new Cancelled(); };
const wait = async (ms: number, my: number) => { const end = Date.now() + ms; while (Date.now() < end) { alive(my); await new Promise((r) => setTimeout(r, Math.min(150, end - Date.now()))); } alive(my); };
const until = async (pred: () => boolean, maxMs: number, my: number) => { const end = Date.now() + maxMs; while (!pred() && Date.now() < end) { alive(my); await new Promise((r) => setTimeout(r, 200)); } alive(my); };
/** Anlatım: altyazıyı gösterir ve seslendirir. Döndürdüğü söz, ses bitince (sessizde okuma süresi kadar sonra) çözülür. */
function say(c: L): Promise<void> {
  const lang = useApp.getState().lang;
  useScenario.setState((s) => ({ caption: c, stepNo: s.stepNo + 1 }));
  const readMs = Math.min(6000, 1200 + c[lang].length * 45);
  if (useApp.getState().sessionStarted && !location.search.includes('test')) {
    // Ses en fazla okuma süresinin 3 katı beklenir (ağ sorunu senaryoyu kilitlemesin)
    return Promise.race([speakSentence(c[lang], lang), new Promise<void>((r) => setTimeout(r, readMs * 3))]);
  }
  return new Promise((r) => setTimeout(r, readMs));
}
/** Anlatımı bekle; iptal edilmişse dur */
const sayWait = async (c: L, my: number) => { await say(c); alive(my); };
const setTarget = (t: Partial<Record<IndicatorId, number>>) => useApp.setState((s) => ({ target: { ...s.target, ...t } }));
const latestVal = (id: IndicatorId) => { const r = useApp.getState().readings[id]; return r[r.length - 1].value; };
const statusOf = (id: IndicatorId) => { const s = useApp.getState(); const r = s.readings[id][s.readings[id].length - 1]; return INDICATORS[id].evaluate(r.value, { glucose: r.ctx, activity: s.activity }).status; };
/** Nokta ölçüm (tansiyon, kan şekeri): simülatör hedefi bunlara etki etmez → SIMULATED okuma eklenir (USER_INPUT DEĞİL) */
const spot = (id: IndicatorId, value: number, ctx?: GlucoseCtx) => useApp.setState((s) => ({ readings: { ...s.readings, [id]: [...s.readings[id], { t: Date.now(), value, provenance: 'SIMULATED' as const, ctx }].slice(-200) } }));
/** Senaryo belirti bildirimi: VEGA ile AYNI kanal (CMO + mürettebat bildirimi, AI ve kart eşleme) */
const symptom = (category: SymptomCategory, quote: L) => reportSymptom(category, quote[useApp.getState().lang], 'scenario');
const setExtra = (a: ExtraAlert | null, id: ExtraAlert['id']) => useScenario.setState((s) => ({ extra: [...s.extra.filter((x) => x.id !== id), ...(a ? [a] : [])] }));

export function stopScenario() {
  token++;
  const s = useScenario.getState();
  if (s.saved) {
    useApp.setState({ activity: s.saved.activity, env: s.saved.env, target: s.saved.target, acked: s.saved.acked, missionDay: s.saved.missionDay, cabinTarget: {} });
    for (const [id, v] of Object.entries(s.saved.spot)) if (v) spot(id as IndicatorId, v.value, v.ctx); // nokta ölçümler eski hâline
  }
  useSymptoms.setState((st) => ({ list: st.list.filter((x) => x.source !== 'scenario') })); // senaryo bildirimleri temizlenir (VEGA'nınkiler kalır)
  useScenario.setState({ id: null, caption: null, stepNo: 0, replay: null, suit: null, extra: [], saved: null, done: false, ackedExtra: [] });
}

export function startScenario(id: ScenarioId) {
  stopScenario();
  const my = ++token;
  const a = useApp.getState();
  const spotSaved: Saved['spot'] = {};
  for (const sid of SPOT_SAVE) { const r = a.readings[sid][a.readings[sid].length - 1]; spotSaved[sid] = { value: r.value, ctx: r.ctx }; }
  useScenario.setState({ id, saved: { activity: a.activity, env: a.env, target: { ...a.target }, acked: [...a.acked], missionDay: a.missionDay, spot: spotSaved }, stepNo: 0, done: false });
  const run = { tachy, iss2017, mars2024, evaCO2, evaDCS, allergy, hypo, htn, cabinLeak, sas }[id];
  run(my).then(() => { if (my === token) useScenario.setState({ done: true }); }).catch((e) => { if (!(e instanceof Cancelled)) console.error(e); });
}

/** Seslendirilecek sabit anlatım satırları (önceden üretim için) */
export function allCaptions(lang: 'tr' | 'en'): string[] { return Object.values(CAP).flatMap((g) => Object.values(g)).map((c) => c[lang]); }

/* ---------------- anlatım metinleri (sabit, önbelleklenebilir) ---------------- */
const CAP = {
  tachy: {
    s1: { tr: 'Taşikardi senaryosu. Astronot dinleniyor, nabız normal aralıkta.', en: 'Tachycardia scenario. The astronaut is at rest; heart rate is in the normal range.' },
    s2: { tr: 'Nabız dinlenme hâlinde hızla yükseliyor.', en: 'Heart rate is rising quickly while at rest.' },
    s3: { tr: 'Kural motoru alarmı anında verdi. Yapay zekâ değerlendirmesi bağlamı ekliyor.', en: 'The rule engine raised the alarm instantly. The AI assessment adds context.' },
    s4: { tr: 'Şimdi aynı nabız egzersiz sırasında. Kırk yaş varsayımıyla hedef bölgenin üst sınırı yüz elli üç; bu yüzden alarm yok.', en: 'Now the same heart rate during exercise. Assuming age forty, the top of the target zone is one hundred fifty three, so there is no alarm.' },
    s5: { tr: 'Egzersiz bitti. Nabız dinlenme değerine dönüyor.', en: 'Exercise is over. Heart rate is returning to resting level.' },
    s6: { tr: 'Senaryo tamamlandı. Aynı sayı, farklı bağlamda farklı anlam taşır.', en: 'Scenario complete. The same number means different things in different contexts.' },
  },
  iss2017: {
    s1: { tr: 'Gerçek veri tekrarı. Uluslararası Uzay İstasyonu, Eylül 2017. Dozimetre verisi hızlandırılmış oynatılıyor.', en: 'Real data replay. International Space Station, September 2017. Dosimeter data is played back accelerated.' },
    saa: { tr: 'Bu tepeler Güney Atlantik Anomalisi geçişleri. Her gün görülür, alarm değildir.', en: 'These peaks are South Atlantic Anomaly passes. They happen every day and are not an alarm.' },
    flr: { tr: 'DONKI kaydı: X8.2 sınıfı güneş patlaması.', en: 'DONKI record: an X8.2 class solar flare.' },
    sep: { tr: 'DONKI kaydı: GOES uydusu yüz megaelektronvolt üstü proton artışı ölçtü.', en: 'DONKI record: GOES measured a rise in protons above one hundred mega electron volts.' },
    det: { tr: 'Yüksek enlem dozu taban değerin çok üstüne çıktı: güneş parçacık olayı imzası. Yüksek enlem geçişlerinde korunaklı bölümde kal; uzay yürüyüşü varsa sonlandır.', en: 'High latitude dose rose far above baseline: a solar particle event signature. Stay in the shielded section during high latitude passes; terminate any spacewalk.' },
    end: { tr: 'Tekrar bitti. Olay penceresindeki doz, olay başına iki yüz elli milisievert limitinin çok altında kaldı.', en: 'Replay finished. The dose in the event window stayed far below the two hundred fifty millisievert per event limit.' },
  },
  mars2024: {
    s1: { tr: 'Gerçek veri tekrarı. Mars yüzeyi, Mayıs 2024. Curiosity gezgininin radyasyon dedektörü verisi.', en: 'Real data replay. Mars surface, May 2024. Radiation detector data from the Curiosity rover.' },
    cme: { tr: 'DONKI kaydı: hızlı halo koronal kütle atımı. Kaynağı Güneşin Dünyadan görünmeyen yüzü olarak değerlendirildi.', en: 'DONKI record: a fast halo coronal mass ejection. Its source was assessed to be on the far side of the Sun.' },
    det: { tr: 'Doz hızı taban değerin on katını aştı. Sığınağa geç ve yüzey aktivitesini durdur.', en: 'Dose rate exceeded ten times baseline. Go to the shelter and stop surface activity.' },
    delay: { tr: 'Dünya bu alarmı ancak dakikalar sonra görebilir. İlk kararı mürettebat ve yerleşik sistem verir.', en: 'Earth can only see this alarm minutes later. The crew and the onboard system make the first decision.' },
    end: { tr: 'Tekrar bitti. Doz hızı saatler içinde taban değere doğru iniyor.', en: 'Replay finished. The dose rate falls back toward baseline over hours.' },
  },
  evaCO2: {
    s1: { tr: 'Uzay yürüyüşü senaryosu. Kıyafet basıncı dört virgül üç psia, yüzde yüz oksijen.', en: 'Spacewalk scenario. Suit pressure four point three psia, one hundred percent oxygen.' },
    s2: { tr: 'Kıyafetteki karbondioksit temizleme verimi düşüyor. Bu bir simülasyon.', en: 'Carbon dioxide removal in the suit is degrading. This is a simulation.' },
    s3: { tr: 'Kıyafet karbondioksiti yedi milimetreyi aştı. NASA standardına göre bu bantta günde en fazla iki buçuk saat kalınabilir. Solunum hızı artıyor.', en: 'Suit carbon dioxide passed seven millimetres. By the NASA standard, at most two and a half hours a day are allowed in this band. Breathing rate is rising.' },
    s4: { tr: 'Karbondioksit on iki buçuğu aştı: günde en fazla yarım saat, on beş asla aşılmaz. Durumu ekibe bildir; ekip kararıyla yürüyüşü sonlandır ve hava kilidine dön.', en: 'Carbon dioxide passed twelve point five: at most half an hour a day, and fifteen must never be exceeded. Report to the crew; on crew decision terminate the spacewalk and return to the airlock.' },
    s5: { tr: 'Hava kilidine dönüldü. Kabin atmosferinde değerler normale iniyor.', en: 'Back in the airlock. Values are returning to normal in cabin air.' },
  },
  evaDCS: {
    s1: { tr: 'Uzay yürüyüşü, üçüncü saat. Yaşamsal değerler normal.', en: 'Spacewalk, third hour. Vital signs are normal.' },
    s2: { tr: 'Astronot dirseğinde eklem ağrısı bildiriyor.', en: 'The astronaut reports joint pain in the elbow.' },
    s3: { tr: 'Vurgun belirtilerle tanınır; nabız normal olsa da uyarı verilir. Yürüyüşü güvenle ve hızla sonlandır, basınçlı ortama dön.', en: 'Decompression sickness is recognised by symptoms; the alert is raised even with a normal heart rate. Terminate the spacewalk safely and quickly, return to a pressurised environment.' },
    s4: { tr: 'Basınçlı ortama dönüldü. Uçuş cerrahı değerlendirmesi sürüyor.', en: 'Back in a pressurised environment. The flight surgeon is evaluating.' },
  },
  allergy: {
    s1: { tr: 'Alerji senaryosu, simülasyon. Astronot yemeğini yeni bitirdi; değerler normal.', en: 'Allergy scenario, simulation. The astronaut has just finished a meal; values are normal.' },
    s2: { tr: 'Astronot VEGA\'ya kaşıntı ve dudaklarında şişlik bildirdi. Bildirim mürettebat sağlık görevlisine ve ekibe gitti.', en: 'The astronaut told VEGA about itching and swollen lips. The report went to the crew medical officer and the crew.' },
    s3: { tr: 'Tansiyon düşüyor, nabız ve solunum hızlanıyor. Müdahale panelinde ISS ağır alerji prosedürü: EpiPen, uyluk dışına.', en: 'Blood pressure is falling, pulse and breathing are speeding up. The intervention panel shows the ISS severe allergy procedure: EpiPen to the outer thigh.' },
    s4: { tr: 'Simülasyon: değerler toparlanıyor. ISS prosedürüne göre belirtiler dönerse EpiPen yirmi dakikada bir tekrarlanabilir; ardından yer kontrolü aranır.', en: 'Simulation: values are recovering. Per the ISS procedure, if symptoms recur the EpiPen may be repeated every twenty minutes; then mission control is called.' },
  },
  hypo: {
    s1: { tr: 'Düşük kan şekeri senaryosu, simülasyon. Uzun egzersiz seansı; astronot öğününü atladı.', en: 'Low blood sugar scenario, simulation. A long exercise session; the astronaut skipped a meal.' },
    s2: { tr: 'Astronot ellerinin titrediğini ve terlediğini bildirdi. Parmak ucu ölçümü kan şekerinin düştüğünü gösteriyor.', en: 'The astronaut reported shaky hands and sweating. A finger-stick measurement shows blood sugar falling.' },
    s3: { tr: 'Kan şekeri elli dördün altında. Bilinci açık ve yutabiliyorsa hızlı etkili karbonhidrat: ADA on beş gram, AHA en az yirmi gram. Yutamıyorsa ağızdan hiçbir şey verilmez.', en: 'Blood sugar is below fifty four. If awake and able to swallow, fast-acting carbohydrate: fifteen grams per ADA, at least twenty grams per AHA. If unable to swallow, nothing by mouth.' },
    s4: { tr: 'Simülasyon: on beş dakika sonraki yeniden ölçüm yetmişin üstünde. Öğün yoksa protein ve karbonhidrat atıştırmalığı.', en: 'Simulation: the recheck fifteen minutes later is above seventy. If no meal is coming, a protein and carbohydrate snack.' },
  },
  htn: {
    s1: { tr: 'Yüksek tansiyon senaryosu, simülasyon. Astronot VEGA\'ya şiddetli baş ağrısı ve bulanık görme bildirdi.', en: 'High blood pressure scenario, simulation. The astronaut told VEGA about a severe headache and blurred vision.' },
    s2: { tr: 'Tansiyon ölçüldü: yüz seksenin üzerinde. Amerikan Kalp Derneği: en az bir dakika bekle, yeniden ölç.', en: 'Blood pressure measured: above one hundred eighty. American Heart Association: wait at least one minute and measure again.' },
    s3: { tr: 'İkinci ölçüm de yüksek ve belirti var: hipertansif acil durum. Tansiyonun kendiliğinden düşmesi beklenmez; uçuş cerrahı hemen aranır, ilaç kararı onundur.', en: 'The second reading is also high and there are symptoms: a hypertensive emergency. Do not wait for it to come down; call the flight surgeon now, medication is their decision.' },
    s4: { tr: 'Simülasyon: uçuş cerrahı yönlendirmesiyle tansiyon izleniyor.', en: 'Simulation: blood pressure is being monitored under flight surgeon direction.' },
  },
  cabinLeak: {
    s1: { tr: 'Kabin basıncı senaryosu. Varsayımsal yavaş bir kaçak; simülasyon.', en: 'Cabin pressure scenario. A hypothetical slow leak; simulation.' },
    s2: { tr: 'Kabin basıncı on virgül dokuz psia altına indi: yaklaşık sekiz bin feet eşdeğeri. Kandaki oksijen düşüyor.', en: 'Cabin pressure fell below ten point nine psia: about eight thousand feet equivalent. Blood oxygen is falling.' },
    s3: { tr: 'Astronot baş ağrısı ve bulantı bildirdi. Bunlar irtifa hastalığı belirtileri olabilir; müdahale panelinde ilgili kart açıldı.', en: 'The astronaut reported a headache and nausea. These can be altitude sickness symptoms; the related card is open in the intervention panel.' },
    s4: { tr: 'Simülasyon: kaçak izole edildi, basınç ve oksijen normale dönüyor.', en: 'Simulation: the leak is isolated, pressure and oxygen are returning to normal.' },
  },
  sas: {
    s1: { tr: 'Görevin ikinci günü. NASA verisine göre mürettebatın yüzde elli ile yetmişi ilk günlerde uzay adaptasyon sendromu yaşar.', en: 'Mission day two. According to NASA, fifty to seventy percent of crew experience space adaptation syndrome in the first days.' },
    s2: { tr: 'Astronot VEGA\'ya midesinin bulandığını ve başının döndüğünü söyledi. Yaşamsal değerler neredeyse normal; uyarıyı belirti bildirimi başlattı.', en: 'The astronaut told VEGA they feel nauseous and dizzy. Vital signs are almost normal; the symptom report started the alert.' },
    s3: { tr: 'NASA seçenekleri: hareketsiz kalmak, baş hareketlerini sınırlamak ve uçuş cerrahı onayıyla bulantı ilacı. Bulantı kartı CMO ekranında.', en: 'NASA options: stay still, limit head movement, and anti-nausea medication with flight surgeon approval. The nausea card is on the CMO screen.' },
    s4: { tr: 'Simülasyon: dinlenmeyle belirtiler azalıyor. Uyum genellikle ilk günlerde tamamlanır.', en: 'Simulation: symptoms ease with rest. Adaptation usually completes within the first days.' },
  },
} as const;

/* ---------------- 1. Taşikardi ---------------- */
async function tachy(my: number) {
  useApp.setState({ activity: 'rest' }); setTarget({ heartRate: 72 });
  await sayWait(CAP.tachy.s1, my); await wait(2000, my);
  say(CAP.tachy.s2); setTarget({ heartRate: 151 });
  await until(() => statusOf('heartRate') === 'critical', 30000, my);
  await wait(2500, my);
  await sayWait(CAP.tachy.s3, my); await wait(9000, my);
  useApp.setState({ activity: 'exercise' });
  await sayWait(CAP.tachy.s4, my); await wait(9000, my);
  // Toparlanma: önce nabız düşer (efor bandında), sonra dinlenmeye geçilir → egzersiz nabzı dinlenme eşiğiyle yanlış alarm vermez
  setTarget({ heartRate: 74 });
  say(CAP.tachy.s5); await until(() => latestVal('heartRate') < 100, 40000, my);
  useApp.setState({ activity: 'rest' });
  await until(() => latestVal('heartRate') < 90, 30000, my);
  say(CAP.tachy.s6);
}

/* ---------------- 2a. ISS Eylül 2017 (TEPC, 10 dk kutular) ---------------- */
type IssRow = [string, number, number, number];
const BIN_MS_ISS = 120;  // 10 dk veri = 120 ms ekran → ×5000 (duvar saatiyle; anlatımda duraklar)
const BIN_MS_MARS = 400; // 1 sa veri = 400 ms ekran → ×9000

/** Duvar saatiyle kutu ilerletici: geride kalırsa kutu atlar ama dozu ve olayları HER kutu için işler */
async function playBins(n: number, binMs: number, my: number, onBin: (i: number) => Promise<void> | void) {
  let i = 0, t0 = Date.now();
  while (i < n) {
    alive(my);
    const target = Math.min(n - 1, Math.floor((Date.now() - t0) / binMs));
    while (i <= target) {
      const before = Date.now();
      await onBin(i);
      t0 += Date.now() - before; // anlatım için bekleme süresi tekrar saatine sayılmaz
      i++;
    }
    await new Promise((r) => setTimeout(r, 40));
  }
}

async function iss2017(my: number) {
  const raw = (storms as unknown as { iss_sep2017: { series: IssRow[] } }).iss_sep2017.series;
  // Taban: olay ÖNCESİ (DONKI SEP 2017-09-10T16:25Z) yalnızca tam yüksek enlem kutuları (highLatFraction = 1)
  const pre = raw.filter((r) => r[3] === 1 && r[0] < '2017-09-10T16:25').map((r) => r[1]);
  const baseline = pre.reduce((x, y) => x + y, 0) / pre.length;
  const win = raw.filter((r) => r[0] >= '2017-09-10T12:00' && r[0] <= '2017-09-12T12:00');
  const series: ReplayPoint[] = win.map((r) => ({ t: r[0], v: r[1], hl: r[3] === 1 ? true : r[3] === 0 ? false : null }));
  useApp.setState({ env: 'iss' });
  useScenario.setState({ replay: {
    label: { tr: 'ISS TEPC · emilen doz hızı', en: 'ISS TEPC · absorbed dose rate' }, series, idx: 0, baseline, unit: 'µGy/h', compression: 600_000 / BIN_MS_ISS,
    baselineNote: { tr: 'taban: olay öncesi yüksek enlem ortalaması', en: 'baseline: pre-event high-latitude mean' },
    doseSoFar: 0, doseUnit: { tr: 'mSv (TEPC doz eşdeğeri, vekil)', en: 'mSv (TEPC dose equivalent, proxy)' }, limit: { tr: 'SPE limiti 250 mSv · V1 [4031]', en: 'SPE limit 250 mSv · V1 [4031]' },
    source: [SRC.tepc, SRC.donki], events: [
      { t: '2017-09-10T15:35', text: { tr: 'X8.2 patlama', en: 'X8.2 flare' } },
      { t: '2017-09-10T16:25', text: { tr: 'SEP (GOES >100 MeV)', en: 'SEP (GOES >100 MeV)' } }],
  } });
  await sayWait(CAP.iss2017.s1, my);
  let dose = 0, saaSaid = false, flr = false, sep = false, det = false, peak = 0, lastHl = baseline;
  await playBins(win.length, BIN_MS_ISS, my, async (i) => {
    const r = win[i];
    dose += r[2] / 6 / 1000; // μSv/sa × 10 dk → mSv
    if (r[3] === 1) lastHl = r[1];
    useScenario.setState((s) => ({ replay: s.replay && { ...s.replay, idx: i, doseSoFar: dose } }));
    if (!saaSaid && r[3] === 0 && r[1] > 100) { saaSaid = true; await sayWait(CAP.iss2017.saa, my); }
    if (!flr && r[0] >= '2017-09-10T15:30') { flr = true; await sayWait(CAP.iss2017.flr, my); }
    if (!sep && r[0] >= '2017-09-10T16:20') { sep = true; await sayWait(CAP.iss2017.sep, my); }
    const mult = r[3] === 1 ? r[1] / baseline : 0;
    if (mult > peak) peak = mult;
    if (peak >= 3) {
      // ISS (manyetosfer + istasyon kalkanı): SPE'lerin çoğu yalnızca ALARA gerektirir (TB-020) → en fazla UYARI, kritik alarm yok
      setExtra(radAlert('warn', `${lastHl.toFixed(0)} µGy/h · ${PEAK[useApp.getState().lang]} ×${peak.toFixed(0)}`, 'iss'), 'radiation');
      if (!det) { det = true; await sayWait(CAP.iss2017.det, my); }
    }
  });
  await sayWait(CAP.iss2017.end, my);
}

/* ---------------- 2b. Mars Mayıs 2024 (MSL-RAD, saatlik) ---------------- */
async function mars2024(my: number) {
  const raw = (storms as unknown as { mars_may2024: { series: [string, number][] } }).mars_may2024.series;
  const preVals = raw.filter((r) => r[0] < '2024-05-20T00:00').map((r) => r[1]).sort((x, y) => x - y);
  const baseline = preVals[Math.floor(preVals.length / 2)]; // medyan
  const win = raw.filter((r) => r[0] >= '2024-05-19T12:00' && r[0] <= '2024-05-22T12:00');
  useApp.setState({ env: 'mars_surface' });
  useScenario.setState({ replay: {
    label: { tr: 'Mars yüzeyi MSL-RAD · emilen doz hızı', en: 'Mars surface MSL-RAD · absorbed dose rate' }, series: win.map((r) => ({ t: r[0], v: r[1], hl: null })), idx: 0, baseline, unit: 'µGy/h',
    compression: 3_600_000 / BIN_MS_MARS, baselineNote: { tr: '15–19 Mayıs medyanı', en: '15–19 May median' },
    doseSoFar: 0, doseUnit: { tr: 'mGy (emilen doz; mSv için Q gerekir)', en: 'mGy (absorbed; mSv needs Q)' },
    source: [SRC.radlab, SRC.donki], events: [{ t: '2024-05-20T05:00', text: { tr: 'DONKI: hızlı halo CME 05:36Z', en: 'DONKI: fast halo CME 05:36Z' } }],
  } });
  await sayWait(CAP.mars2024.s1, my);
  let dose = 0, cme = false, det = false, peak = 0;
  const [d0, d1] = ENVS.mars_surface.commDelayOneWaySec;
  await playBins(win.length, BIN_MS_MARS, my, async (i) => {
    const r = win[i];
    dose += r[1] / 1000; // μGy/sa × 1 sa → mGy
    useScenario.setState((s) => ({ replay: s.replay && { ...s.replay, idx: i, doseSoFar: dose } }));
    if (!cme && r[0] >= '2024-05-20T05:00') { cme = true; await sayWait(CAP.mars2024.cme, my); }
    const mult = r[1] / baseline;
    if (mult > peak) peak = mult;
    if (peak >= 3) {
      // Olay BAŞLANGICINDA nihai büyüklük bilinmez → önlem olarak sığınak (TB-020: erken uyarı sığınak kurmaya imkân verir)
      const status: Status = peak >= 10 ? 'critical' : 'warn';
      setExtra(radAlert(status, `${r[1].toFixed(0)} µGy/h · ${PEAK[useApp.getState().lang]} ×${peak.toFixed(0)} · ${DELAY[useApp.getState().lang]} ${Math.round(d0 / 60)}–${Math.round(d1 / 60)} min`, 'mars'), 'radiation');
      if (!det && status === 'critical') { det = true; await sayWait(CAP.mars2024.det, my); await sayWait(CAP.mars2024.delay, my); }
    }
  });
  await sayWait(CAP.mars2024.end, my);
}

const PEAK = { tr: 'zirve', en: 'peak' };
const DELAY = { tr: 'Dünya gecikmesi', en: 'Earth delay' };
function radAlert(status: Status, value: string, where: 'iss' | 'mars'): ExtraAlert {
  return {
    id: 'radiation', status, value, prov: 'NASA_MEASUREMENT', escalate: where === 'mars' ? 'crew' : 'ground',
    title: { tr: 'Radyasyon · güneş parçacık olayı', en: 'Radiation · solar particle event' },
    label: where === 'iss' ? { tr: 'Taban ×3 üstü · ALARA', en: 'Above ×3 baseline · ALARA' } : { tr: status === 'critical' ? 'Taban ×10 üstü' : 'Taban ×3 üstü', en: status === 'critical' ? 'Above ×10 baseline' : 'Above ×3 baseline' },
    steps: where === 'mars'
      ? [{ tr: 'Sığınağa / en kalın kalkanlı bölüme geç', en: 'Go to the shelter / most shielded area' }, { tr: 'Yüzey aktivitesini ve EVA\'yı durdur', en: 'Stop surface activity and EVA' }, { tr: 'Yer kontrolü dakikalar sonra görür: karar mürettebatta', en: 'Ground sees this minutes later: crew decides' }]
      : [{ tr: 'Yüksek enlem geçişlerinde korunaklı bölümde kal (ALARA)', en: 'Stay in the shielded section during high-latitude passes (ALARA)' }, { tr: 'EVA varsa sonlandır (≤2 saat)', en: 'Terminate any EVA (≤2 h)' }, { tr: 'Doz izlemeyi sürdür, yer ekibine bildir', en: 'Keep monitoring dose, inform ground' }],
    sources: [SRC.tb020, where === 'mars' ? SRC.radlab : SRC.tepc, SRC.donki],
    note: where === 'mars'
      ? { tr: 'Olay başlangıcında nihai büyüklük bilinmez: sığınak önlemdir. Eşik çarpanları (×3, ×10) VARSAYIM; eylemler OCHMO-TB-020', en: 'At onset the final size is unknown: sheltering is a precaution. Multipliers (×3, ×10) are ASSUMPTIONS; actions from OCHMO-TB-020' }
      : { tr: "LEO'da SPE'lerin çoğu yalnızca ALARA gerektirir (TB-020); ×3 eşiği VARSAYIM", en: 'In LEO most SPEs need only ALARA (TB-020); ×3 threshold is an ASSUMPTION' },
  };
}

/* ---------------- 3a. EVA: kıyafet CO₂ ---------------- */
// NASA-STD-3001 Vol 2 Rev B (2019) [V2 11039] Tablo 23: kıyafet solunan CO₂ (PICO₂) için GÜNLÜK KÜMÜLATİF izin süresi.
// ≤4 mmHg 14 sa · 4–7 → 7 sa · 7–10 → 2,5 sa · 10–12,5 → 1 sa · 12,5–15 → 0,5 sa · >15 "Do Not Exceed".
// Durum eşlemesi (bizim seçimimiz, VARSAYIM): ≤4 normal, 4–7 izle, 7–12,5 uyarı, >12,5 kritik.
// Not: tablodaki değer PICO₂'dir; simüle değer PICO₂ kabul edilir.
const PICO2_TABLE: [number, number][] = [[4, 14], [7, 7], [10, 2.5], [12.5, 1], [15, 0.5]];
export const pico2AllowedH = (v: number) => (PICO2_TABLE.find(([lim]) => v <= lim)?.[1] ?? 0);
export function suitCO2Status(v: number): Status { return v > 12.5 ? 'critical' : v > 7 ? 'warn' : v > 4 ? 'watch' : 'ok'; }
function suitAlert(v: number): ExtraAlert {
  const s = suitCO2Status(v);
  const h = pico2AllowedH(v);
  const allow = h > 0 ? { tr: `günde en fazla ${String(h).replace('.', ',')} sa`, en: `max ${h} h/day` } : { tr: 'ASLA AŞILMAZ', en: 'DO NOT EXCEED' };
  return {
    id: 'suitCO2', status: s, value: `PICO₂ ${v.toFixed(1)} mmHg · ${allow.tr}`, prov: 'SIMULATED', escalate: s === 'critical' ? 'crew' : 'self',
    title: { tr: 'Kıyafet CO₂ (EVA)', en: 'Suit CO₂ (EVA)' },
    label: { tr: `NASA izin süresi: ${allow.tr}`, en: `NASA allowance: ${allow.en}` },
    steps: s === 'critical'
      ? [{ tr: 'Durumu IV ekibe / yer kontrolüne bildir', en: 'Report to the IV crew / ground' }, { tr: 'Ekip kararıyla EVA\'yı sonlandır, hava kilidine dön', en: 'On crew decision, terminate the EVA and return to the airlock' }, { tr: 'Baş ağrısı, görme değişikliği, nefes darlığı belirtilerini izle', en: 'Watch for headache, vision change, shortness of breath' }]
      : [{ tr: 'Efor temposunu düşür (metabolik hız CO₂ birikimini artırır)', en: 'Reduce workload (metabolic rate drives CO₂ build-up)' }, { tr: 'Bu bantta geçen kümülatif süreyi izle', en: 'Track cumulative time in this band' }, { tr: 'Baş ağrısı / görme değişimi varsa bildir', en: 'Report headache / vision change' }],
    sources: [SRC.std3001v2, SRC.tb004],
    note: { tr: 'Eşikler NASA-STD-3001 V2 Tablo 23 (günlük kümülatif süre). Durum renkleri bizim eşlememiz (VARSAYIM).', en: 'Limits from NASA-STD-3001 V2 Table 23 (daily cumulative duration). Status colours are our mapping (ASSUMPTION).' },
  };
}
async function evaCO2(my: number) {
  useApp.setState({ activity: 'eva', env: 'iss' }); setTarget({ heartRate: 112, respRate: 18 });
  let co2 = 1.5;
  useScenario.setState({ suit: { pressurePsia: 4.3, ppO2mmHg: 222, ppCO2mmHg: co2 } });
  await sayWait(CAP.evaCO2.s1, my); await wait(1500, my);
  say(CAP.evaCO2.s2);
  let saidWatch = false, saidWarn = false;
  while (co2 < 15.6) {
    co2 += 0.3;
    useScenario.setState((s) => ({ suit: s.suit && { ...s.suit, ppCO2mmHg: co2 } }));
    setTarget({ respRate: Math.round(18 + (co2 - 1.5) * 0.7), heartRate: Math.round(112 + (co2 - 1.5) * 1.2) });
    const st = suitCO2Status(co2);
    if (st !== 'ok') setExtra(suitAlert(co2), 'suitCO2');
    if (st === 'warn' && !saidWatch) { saidWatch = true; say(CAP.evaCO2.s3); }
    if (st === 'critical' && !saidWarn) { saidWarn = true; say(CAP.evaCO2.s4); }
    await wait(700, my);
  }
  await wait(9000, my);
  useApp.setState({ activity: 'rest' }); setTarget({ heartRate: 76, respRate: 14 });
  useScenario.setState({ suit: null }); setExtra(null, 'suitCO2');
  say(CAP.evaCO2.s5);
}

/* ---------------- 3b. EVA: vurgun (DCS) ---------------- */
async function evaDCS(my: number) {
  useApp.setState({ activity: 'eva', env: 'iss' }); setTarget({ heartRate: 104, respRate: 17 });
  useScenario.setState({ suit: { pressurePsia: 4.3, ppO2mmHg: 222, ppCO2mmHg: 1.8 } });
  await sayWait(CAP.evaDCS.s1, my); await wait(3000, my);
  await sayWait(CAP.evaDCS.s2, my);
  setExtra({
    id: 'dcs', status: 'warn', value: { tr: 'öz bildirim: dirsek eklem ağrısı', en: 'self-report: elbow joint pain' }[useApp.getState().lang], prov: 'SIMULATED', escalate: 'ground',
    title: { tr: 'Olası vurgun (DCS) · Tip I belirtisi', en: 'Possible DCS · Type I symptom' },
    label: { tr: 'Belirtiye dayalı', en: 'Symptom-based' },
    steps: [{ tr: 'EVA\'yı güvenle ve hızla sonlandır', en: 'Terminate the EVA safely and quickly' }, { tr: 'Basınçlı ortama dön', en: 'Return to a pressurised environment' }, { tr: 'Uçuş cerrahına bildir; ≥16,4 psia belirtileri hafifletebilir (protokol duruma bağlı)', en: 'Inform the flight surgeon; ≥16.4 psia may relieve symptoms (protocol is scenario dependent)' }],
    sources: [SRC.tb037],
    note: { tr: 'Tip II (nörolojik, kardiyopulmoner) belirtiler daha ciddidir', en: 'Type II (neurological, cardiopulmonary) symptoms are more serious' },
  }, 'dcs');
  await sayWait(CAP.evaDCS.s3, my); await wait(8000, my);
  useApp.setState({ activity: 'rest' }); setTarget({ heartRate: 80, respRate: 15 });
  useScenario.setState({ suit: null });
  say(CAP.evaDCS.s4);
}


/* ---------------- 4. Ağır alerjik reaksiyon (ISS 1.101) ---------------- */
async function allergy(my: number) {
  useApp.setState({ activity: 'rest', env: 'iss' }); setTarget({ heartRate: 76, spo2: 98, respRate: 14 }); spot('systolic', 118); spot('diastolic', 76);
  await sayWait(CAP.allergy.s1, my); await wait(2000, my);
  symptom('allergy', { tr: 'Ellerim kaşınıyor, dudaklarım şişti, nefesim hırıltılı', en: 'My hands are itching, my lips are swollen, my breathing is wheezy' });
  await sayWait(CAP.allergy.s2, my);
  setTarget({ heartRate: 124, respRate: 25, spo2: 90.5 });
  for (const [sy, di] of [[108, 70], [98, 62], [86, 54]]) { await wait(2500, my); spot('systolic', sy); spot('diastolic', di); }
  await until(() => latestVal('heartRate') > 105, 20000, my);
  await sayWait(CAP.allergy.s3, my); await wait(12000, my);
  setTarget({ heartRate: 90, respRate: 16, spo2: 97 });
  for (const [sy, di] of [[98, 62], [108, 70]]) { await wait(3000, my); spot('systolic', sy); spot('diastolic', di); }
  say(CAP.allergy.s4);
}

/* ---------------- 5. Düşük kan şekeri (ADA 15-15 + AHA 2024) ---------------- */
async function hypo(my: number) {
  useApp.setState({ activity: 'exercise', env: 'iss' }); setTarget({ heartRate: 128, respRate: 22 }); spot('glucose', 96, 'fasting');
  await sayWait(CAP.hypo.s1, my); await wait(2000, my);
  spot('glucose', 74, 'fasting'); await wait(2500, my);
  useApp.setState({ activity: 'rest' }); setTarget({ heartRate: 102, respRate: 18 });
  symptom('unwell', { tr: 'Ellerim titriyor, çok terledim, başım dönüyor', en: 'My hands are shaking, I am sweating a lot, I feel dizzy' });
  await sayWait(CAP.hypo.s2, my);
  spot('glucose', 63, 'fasting'); await wait(3000, my);
  spot('glucose', 51, 'fasting');
  await sayWait(CAP.hypo.s3, my); await wait(10000, my);
  spot('glucose', 84, 'fasting'); setTarget({ heartRate: 84, respRate: 15 });
  say(CAP.hypo.s4);
}

/* ---------------- 6. Çok yüksek tansiyon + belirti (AHA 2025) ---------------- */
async function htn(my: number) {
  useApp.setState({ activity: 'rest', env: 'iss' }); setTarget({ heartRate: 88 }); spot('systolic', 128); spot('diastolic', 82);
  symptom('pain', { tr: 'Başım çok şiddetli ağrıyor, gözlerim bulanık görüyor', en: 'I have a very severe headache and my vision is blurry' });
  await sayWait(CAP.htn.s1, my); await wait(1500, my);
  spot('systolic', 188); spot('diastolic', 122);
  await sayWait(CAP.htn.s2, my); await wait(6000, my); // hızlandırılmış: gerçekte en az 1 dakika
  spot('systolic', 186); spot('diastolic', 124);
  await sayWait(CAP.htn.s3, my); await wait(12000, my);
  spot('systolic', 168); spot('diastolic', 104);
  say(CAP.htn.s4);
}

/* ---------------- 7. Kabin basıncı düşüşü (irtifa hastalığı kartı) ---------------- */
function cabinAlert(psia: number): ExtraAlert {
  const below = psia < 10.9;
  return {
    id: 'cabin', status: below ? 'warn' : 'watch', prov: 'SIMULATED', escalate: below ? 'crew' : 'self',
    value: `${psia.toFixed(1)} psia`,
    title: { tr: 'Kabin basıncı', en: 'Cabin pressure' },
    label: below ? { tr: '≈8000 ft eşdeğerinin altında (standart atmosfer)', en: 'below ≈8000 ft equivalent (standard atmosphere)' } : { tr: 'düşüyor', en: 'falling' },
    steps: [{ tr: 'Ekibe bildir; kaçak prosedürünü uygula', en: 'Alert the crew; run the leak procedure' }, { tr: 'SpO₂ ve baş ağrısı/bulantı belirtilerini izle', en: 'Watch SpO₂ and headache/nausea symptoms' }, { tr: 'Belirti varsa irtifa hastalığı kartı (CMO)', en: 'If symptoms: altitude sickness card (CMO)' }],
    sources: [],
    note: { tr: 'Senaryo varsayımsaldır; ISS kaçak/basınç kaybı prosedürü kamuya açık değildir.', en: 'Hypothetical scenario; the ISS leak/depress procedure is not public.' },
  };
}
async function cabinLeak(my: number) {
  useApp.setState({ activity: 'rest', env: 'iss', cabinTarget: { pressurePsia: 14.7 } }); setTarget({ heartRate: 74, spo2: 98, respRate: 14 });
  await sayWait(CAP.cabinLeak.s1, my);
  useApp.setState({ cabinTarget: { pressurePsia: 10.2 } });
  const t0 = Date.now();
  while (Date.now() - t0 < 45000) {
    const p = useApp.getState().cabin.pressurePsia;
    if (p < 14.2) setExtra(cabinAlert(p), 'cabin');
    if (p < 10.9) break;
    await wait(800, my);
  }
  setTarget({ heartRate: 96, spo2: 90.5, respRate: 19 });
  await sayWait(CAP.cabinLeak.s2, my);
  symptom('pain', { tr: 'Başım ağrıyor, midem bulanıyor', en: 'I have a headache and feel nauseous' });
  await sayWait(CAP.cabinLeak.s3, my);
  for (let i = 0; i < 15; i++) { setExtra(cabinAlert(useApp.getState().cabin.pressurePsia), 'cabin'); await wait(800, my); }
  useApp.setState({ cabinTarget: {} }); setTarget({ heartRate: 76, spo2: 97, respRate: 15 });
  say(CAP.cabinLeak.s4);
  for (let i = 0; i < 25; i++) {
    const p = useApp.getState().cabin.pressurePsia;
    setExtra(p < 14.2 ? cabinAlert(p) : null, 'cabin');
    if (p >= 14.2) break;
    await wait(800, my);
  }
}

/* ---------------- 8. Uzay adaptasyon sendromu (OCHMO-TB-033) ---------------- */
async function sas(my: number) {
  useApp.setState({ activity: 'rest', env: 'iss', missionDay: 2 }); setTarget({ heartRate: 82, respRate: 15, spo2: 98 });
  await sayWait(CAP.sas.s1, my); await wait(1500, my);
  symptom('nausea', { tr: 'Midem bulanıyor, başım dönüyor', en: 'I feel nauseous and dizzy' });
  setTarget({ heartRate: 92 });
  await sayWait(CAP.sas.s2, my);
  await sayWait(CAP.sas.s3, my); await wait(9000, my);
  setTarget({ heartRate: 78 });
  say(CAP.sas.s4);
}
