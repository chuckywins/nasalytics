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

export type ScenarioId = 'tachy' | 'iss2017' | 'mars2024' | 'evaCO2' | 'evaDCS';
export const SCENARIOS: ScenarioId[] = ['tachy', 'iss2017', 'mars2024', 'evaCO2', 'evaDCS'];
export type L = { tr: string; en: string };

export interface ExtraAlert {
  id: 'radiation' | 'suitCO2' | 'dcs';
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
  tb004: { label: 'OCHMO-TB-004 CO₂ · V2 [11035][11036]', url: 'https://nasa.gov/wp-content/uploads/2023/03/co2-technical-brief-ochmo.pdf' },
  tb037: { label: 'OCHMO-TB-037 DCS', url: 'https://www.nasa.gov/wp-content/uploads/2023/12/ochmo-tb-037-decompression-sickness.pdf' },
  aha: { label: 'AHA: Target heart rates', url: 'https://www.heart.org/en/healthy-living/fitness/fitness-basics/target-heart-rates' },
};

export const SCEN_META: Record<ScenarioId, { title: L; desc: L; prov: Provenance }> = {
  tachy: { title: { tr: 'Taşikardi: dinlenme ve egzersiz', en: 'Tachycardia: rest vs exercise' }, desc: { tr: 'Aynı nabız, farklı bağlam: dinlenmede kritik alarm, egzersizde beklenen.', en: 'Same heart rate, different context: critical at rest, expected during exercise.' }, prov: 'SIMULATED' },
  iss2017: { title: { tr: 'Güneş fırtınası: ISS, Eylül 2017', en: 'Solar storm: ISS, Sep 2017' }, desc: { tr: 'Gerçek TEPC dozimetre verisi + DONKI olayları, hızlandırılmış tekrar.', en: 'Real TEPC dosimeter data + DONKI events, accelerated replay.' }, prov: 'NASA_MEASUREMENT' },
  mars2024: { title: { tr: 'Güneş fırtınası: Mars, Mayıs 2024', en: 'Solar storm: Mars, May 2024' }, desc: { tr: 'Curiosity RAD gerçek doz verisi; Dünya ile iletişim gecikmesi.', en: 'Real Curiosity RAD dose data; Earth communication delay.' }, prov: 'NASA_MEASUREMENT' },
  evaCO2: { title: { tr: 'Uzay yürüyüşü: kıyafette CO₂ birikimi', en: 'EVA: suit CO₂ build-up' }, desc: { tr: 'Kıyafet ppCO₂ yükselir; ekip kararıyla yürüyüş sonlandırılır.', en: 'Suit ppCO₂ rises; EVA is terminated on crew decision.' }, prov: 'SIMULATED' },
  evaDCS: { title: { tr: 'Uzay yürüyüşü: vurgun (DCS) belirtisi', en: 'EVA: decompression sickness symptom' }, desc: { tr: 'Belirti bildirimiyle tetiklenir (nabızla değil); yürüyüş sonlandırılır.', en: 'Triggered by a symptom report (not a vital sign); EVA is terminated.' }, prov: 'SIMULATED' },
};

interface Saved { activity: Activity; env: EnvId; target: Partial<Record<IndicatorId, number>>; acked: IndicatorId[] }
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
const setExtra = (a: ExtraAlert | null, id: ExtraAlert['id']) => useScenario.setState((s) => ({ extra: [...s.extra.filter((x) => x.id !== id), ...(a ? [a] : [])] }));

export function stopScenario() {
  token++;
  const s = useScenario.getState();
  if (s.saved) useApp.setState({ activity: s.saved.activity, env: s.saved.env, target: s.saved.target, acked: s.saved.acked });
  useScenario.setState({ id: null, caption: null, stepNo: 0, replay: null, suit: null, extra: [], saved: null, done: false, ackedExtra: [] });
}

export function startScenario(id: ScenarioId) {
  stopScenario();
  const my = ++token;
  const a = useApp.getState();
  useScenario.setState({ id, saved: { activity: a.activity, env: a.env, target: { ...a.target }, acked: [...a.acked] }, stepNo: 0, done: false });
  const run = { tachy, iss2017, mars2024, evaCO2, evaDCS }[id];
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
    s3: { tr: 'Kıyafet karbondioksiti baş ağrısı aralığına girdi. Solunum hızı artıyor.', en: 'Suit carbon dioxide entered the headache range. Breathing rate is rising.' },
    s4: { tr: 'Karbondioksit yorgunluk ve bulantı aralığında. Durumu ekibe bildir. Ekip kararıyla yürüyüşü sonlandır ve hava kilidine dön.', en: 'Carbon dioxide is in the fatigue and nausea range. Report to the crew. On crew decision, terminate the spacewalk and return to the airlock.' },
    s5: { tr: 'Hava kilidine dönüldü. Kabin atmosferinde değerler normale iniyor.', en: 'Back in the airlock. Values are returning to normal in cabin air.' },
  },
  evaDCS: {
    s1: { tr: 'Uzay yürüyüşü, üçüncü saat. Yaşamsal değerler normal.', en: 'Spacewalk, third hour. Vital signs are normal.' },
    s2: { tr: 'Astronot dirseğinde eklem ağrısı bildiriyor.', en: 'The astronaut reports joint pain in the elbow.' },
    s3: { tr: 'Vurgun belirtilerle tanınır; nabız normal olsa da uyarı verilir. Yürüyüşü güvenle ve hızla sonlandır, basınçlı ortama dön.', en: 'Decompression sickness is recognised by symptoms; the alert is raised even with a normal heart rate. Terminate the spacewalk safely and quickly, return to a pressurised environment.' },
    s4: { tr: 'Basınçlı ortama dönüldü. Uçuş cerrahı değerlendirmesi sürüyor.', en: 'Back in a pressurised environment. The flight surgeon is evaluating.' },
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
// Sınıflama: OCHMO-TB-004 BELİRTİ aralıkları (2,8–4,5 mmHg baş ağrısı; >4,5 yorgunluk/bulantı). Bu bir kıyafet limiti DEĞİL:
// kıyafet PICO₂ limitleri V2 [11039] Tablo 35'tedir ve bu prototipte okunmadı.
// Kabin göstergesiyle AYNI bantlar (tutarlılık): 2,5–3 izle, 3–4,5 baş ağrısı (uyarı), >4,5 yorgunluk/bulantı (kritik; kritik kademe VARSAYIM)
export function suitCO2Status(v: number): Status { return INDICATORS.cabinCO2.evaluate(v).status; }
function suitAlert(v: number): ExtraAlert {
  const s = suitCO2Status(v);
  return {
    id: 'suitCO2', status: s, value: `ppCO₂ ${v.toFixed(1)} mmHg`, prov: 'SIMULATED', escalate: s === 'critical' ? 'crew' : 'self',
    title: { tr: 'Kıyafet CO₂ (EVA)', en: 'Suit CO₂ (EVA)' },
    label: s === 'critical' ? { tr: 'Yorgunluk/bulantı aralığı', en: 'Fatigue/nausea range' } : s === 'warn' ? { tr: 'Baş ağrısı aralığı', en: 'Headache range' } : { tr: 'NASA sınırına yakın', en: 'Near NASA limit' },
    steps: s === 'critical'
      ? [{ tr: 'Durumu IV ekibe / yer kontrolüne bildir', en: 'Report to the IV crew / ground' }, { tr: 'Ekip kararıyla EVA\'yı sonlandır', en: 'On crew decision, terminate the EVA' }, { tr: 'Hava kilidine dön', en: 'Return to the airlock' }]
      : [{ tr: 'Efor temposunu düşür', en: 'Reduce workload' }, { tr: 'Baş ağrısı / görme değişimi varsa bildir', en: 'Report headache / vision change' }, { tr: 'Kıyafet ppCO₂ eğilimini izle', en: 'Watch suit ppCO₂ trend' }],
    sources: [SRC.tb004],
    note: { tr: 'Kabin ile aynı belirti aralıkları (TB-004); kıyafet limiti değil (V2 [11039] Tablo 35 okunmadı); kritik kademe VARSAYIM', en: 'Same symptom bands as cabin (TB-004); not a suit limit (V2 [11039] Table 35 not read); critical tier is an ASSUMPTION' },
  };
}
async function evaCO2(my: number) {
  useApp.setState({ activity: 'eva', env: 'iss' }); setTarget({ heartRate: 112, respRate: 18 });
  let co2 = 1.5;
  useScenario.setState({ suit: { pressurePsia: 4.3, ppO2mmHg: 222, ppCO2mmHg: co2 } });
  await sayWait(CAP.evaCO2.s1, my); await wait(1500, my);
  say(CAP.evaCO2.s2);
  let saidWatch = false, saidWarn = false;
  while (co2 < 6.2) {
    co2 += 0.12;
    useScenario.setState((s) => ({ suit: s.suit && { ...s.suit, ppCO2mmHg: co2 } }));
    setTarget({ respRate: Math.round(18 + (co2 - 1.5) * 1.8), heartRate: Math.round(112 + (co2 - 1.5) * 3) });
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
