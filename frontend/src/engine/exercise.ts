// Kemik ve kas kaybına karşı egzersiz: yalnızca NASA belgelerindeki ifadeler (yük/set/tekrar YOK — reçete kişiye özeldir).
// Kaynaklar: OCHMO-TB-031 Exercise Overview (10/02/2023) ve OCHMO-MTB-013 Bone Loss Rev D (11-Feb-26); sayfa numaraları PDF sayfasıdır.
// AI notu: Claude (Anthropic) yardımıyla yazılmıştır.
import type { EnvId } from './environment';
import type { SourceRef } from './types';

type L = { tr: string; en: string };
const TB031 = (p: number): SourceRef => ({ label: `NASA OCHMO-TB-031 Exercise Overview (2023) · s. ${p}`, url: 'https://www.nasa.gov/wp-content/uploads/2023/12/ochmo-tb-031-exercise-overview.pdf' });
const MTB013 = (p: number): SourceRef => ({ label: `NASA OCHMO-MTB-013 Bone Loss Rev D (2026) · s. ${p}`, url: 'https://www.nasa.gov/wp-content/uploads/2023/12/ochmo-tb-030-bone-loss.pdf' });

/** 1) NASA hedefleri (NASA-STD-3001 Cilt 1; TB-031 s. 2) */
export const EX_TARGETS: { code: string; text: L }[] = [
  { code: 'V1 4003', text: { tr: 'Görev içi aerobik kapasite, görev öncesinin en az %80\'i', en: 'In-mission aerobic capacity at or above 80% of pre-mission' } },
  { code: 'V1 4024', text: { tr: 'Görev içi kas kuvveti, başlangıç değerinin en az %80\'i', en: 'In-mission muscle strength at or above 80% of baseline' } },
  { code: 'V1 4027', text: { tr: 'Kemik mineral yoğunluğu: kalça ve omurga en az %95, femur boynu en az %90', en: 'Bone mineral density: hip and spine ≥95%, femoral neck ≥90% of pre-mission' } },
];

/** 2) Seans yapısı (uzun süreli ISS görevi, ~180 gün) */
export const EX_SESSION: { text: L; src: SourceRef }[] = [
  { text: { tr: 'Aerobik (metabolik): yaklaşık 30 dk, aralıklı ya da sabit tempo', en: 'Aerobic (metabolic): about 30 min, interval or steady state' }, src: TB031(10) },
  { text: { tr: 'Direnç/kuvvet: 30–60 dk yük bindiren antrenman', en: 'Resistive/strength: 30–60 min load-bearing training' }, src: TB031(10) },
  { text: { tr: 'Yoğunluk: bisiklette (CEVIS) %70–100 VO₂peak, koşu bandında (T2) %70–100 maksimum nabız', en: 'Intensity: cycle (CEVIS) 70–100% VO₂peak, treadmill (T2) 70–100% HRmax' }, src: TB031(11) },
  { text: { tr: 'Sıklık: yatak istirahati ve uçuşta haftada 6–7 seans kemiği korumada etkili bulundu; ISS\'te ortalama ~600 dk/hafta', en: 'Frequency: 6–7 sessions/week maintained bone in bed rest and flight; ISS average ~600 min/week' }, src: MTB013(14) },
  { text: { tr: 'Önceki gereklilik: iş günü başına 2 saat (süreyi görev tıbbi ekibi belirler)', en: 'Previous requirement: 2 hours per workday (set by the mission medical team)' }, src: MTB013(14) },
];

/** 3) Hareket → yüklenen kemik bölgesi */
export const EX_MOVES: { name: L; site: L; src: SourceRef; note?: L }[] = [
  { name: { tr: 'Squat (sırt, tek bacak, sumo)', en: 'Squat (back, single-leg, sumo)' }, site: { tr: 'Femur boynunun alt kısmı; tek bacak squat büyük trokanteri yükler. Sığ squat tam squattan daha büyük yük üretir.', en: 'Inferior femoral neck; single-leg squats load the greater trochanter. Shallow squats generate greater loads than full squats.' }, src: MTB013(14) },
  { name: { tr: 'Tek bacak, derin ve kısa açılı squat (yüksek, sürekli eksantrik yük)', en: 'Single-leg deep short-arc squat (high sustained eccentric overload)' }, site: { tr: 'Femur boynunun üst-yan kısmı', en: 'Superior lateral femoral neck' }, src: MTB013(14) },
  { name: { tr: 'Deadlift (klasik, Romanian, sumo)', en: 'Deadlift (conventional, Romanian, sumo)' }, site: { tr: 'Bel omurgası; yükü kavrama kuvveti sınırlayabilir', en: 'Lumbar spine; load may be limited by grip strength' }, src: MTB013(14), note: { tr: 'Kaynak cümlede noktalama eksik; anlam bu şekilde okundu.', en: 'Source sentence lacks punctuation; read as stated.' } },
  { name: { tr: 'Barbell good morning', en: 'Barbell good morning' }, site: { tr: 'Bel omurgası', en: 'Lumbar spine' }, src: MTB013(14) },
  { name: { tr: 'Topuk kaldırma (tek bacak dahil)', en: 'Heel raise (incl. single-leg)' }, site: { tr: 'Baldır (gastro-soleus); tek bacak duruşunda topuk kemiği yoğunluğu arttı (17 haftalık yatak istirahati)', en: 'Calf (gastro-soleus); single-leg stance increased calcaneus BMD (17-week bed rest)' }, src: MTB013(14) },
  { name: { tr: 'Kalça abdüktörleri, tek bacak duruşu', en: 'Hip abductors, single-leg stance' }, site: { tr: 'Büyük trokanter (17 haftalık yatak istirahatinde yoğunluk arttı)', en: 'Greater trochanter (BMD increased in 17-week bed rest)' }, src: MTB013(14) },
  { name: { tr: 'Bench press', en: 'Bench press' }, site: { tr: 'Üst vücut kuvveti (ISS ARED egzersiz kategorisi)', en: 'Upper-body strength (ISS ARED category)' }, src: TB031(16) },
  { name: { tr: 'Parmak şınavı', en: 'Finger push-ups' }, site: { tr: 'Ön kol kemiklerinin bilek ucu (radius, ulna); önce duvara/masaya yaslanarak başlanabilir', en: 'Distal radius and ulna; may start leaning against a wall or table' }, src: MTB013(14) },
  { name: { tr: 'Sprint ve sıçrama', en: 'Sprinting and jumping' }, site: { tr: 'Femur boynunun alt kısmı', en: 'Inferior femoral neck' }, src: MTB013(14), note: { tr: 'Yerçekimli ortam bulgusu; mikrogravitede uygulanabilirliği belgede yok.', en: 'Gravity-environment finding; microgravity applicability not stated.' } },
];

/** Ortama göre cihaz (yalnızca belgelenenler) */
export function exEquipment(env: EnvId): { text: L; src?: SourceRef } {
  if (env === 'iss') return { text: { tr: 'ISS: ARED (600 lbf\'e kadar direnç ≈ vücut ağırlığının 2–3 katı), T2/COLBERT koşu bandı (vücudu bantla yükleyen kemer), CEVIS bisiklet', en: 'ISS: ARED (up to 600 lbf ≈ 2–3× body weight), T2/COLBERT treadmill (harness loading), CEVIS cycle' }, src: MTB013(12) };
  if (env === 'lunar_transit') return { text: { tr: 'Orion/Artemis: kısıtlı alan nedeniyle tek cihaz: volanlı egzersiz cihazı (FWED), direnç + aerobik. 10 günlük görevde kemik kaybı ana kaygı değildir.', en: 'Orion/Artemis: single flywheel exercise device (FWED) for resistive + aerobic work; bone is not a main concern on a 10-day mission.' }, src: MTB013(14) };
  return { text: { tr: 'Bu ortam (Ay/Mars yüzeyi, uzun transit) için yayımlanmış bir NASA egzersiz cihazı veya protokolü bu belgelerde yok.', en: 'No published NASA exercise device or protocol for this environment (lunar/Mars surface, long transit) in these documents.' } };
}

export const EX_NOTE: L = {
  tr: 'Reçete kişiye özeldir: her astronotun güç ve kondisyon uzmanı (ASCR) uçuş öncesi, sırası ve sonrası programı belirler ve cihaz verisiyle ayarlar. Bu yüzden burada yük, set veya tekrar verilmez.',
  en: 'Prescriptions are individual: each astronaut\'s strength and conditioning specialist (ASCR) sets and adjusts the program from device data. No loads, sets or reps are given here.',
};
export const EX_SOURCES: SourceRef[] = [TB031(10), MTB013(14)];

/** Egzersiz modu: animasyonlu kartlar. YALNIZCA NASA belgesinde adı geçen hareketler; animasyon forge-motion (CC0), Dünya gösterimi.
 *  Benzer ama aynı olmayan hareket (ör. bölünmüş squat ≠ tek bacak squat, şınav ≠ parmak şınavı) bilerek eklenmedi. */
export interface ExAnim { id: string; file: string; name: L; site: L; iss: L; src: SourceRef; note?: L }
export const EX_ANIM: ExAnim[] = [
  { id: 'squat', file: 'exercise/squat_bb.webp', name: { tr: 'Squat (sırt)', en: 'Back squat' }, site: { tr: 'Femur boynunun alt kısmı', en: 'Inferior femoral neck' }, iss: { tr: 'ISS: ARED', en: 'ISS: ARED' }, src: MTB013(14) },
  { id: 'deadlift', file: 'exercise/deadlift_bb.webp', name: { tr: 'Deadlift', en: 'Deadlift' }, site: { tr: 'Bel omurgası', en: 'Lumbar spine' }, iss: { tr: 'ISS: ARED', en: 'ISS: ARED' }, src: MTB013(14) },
  { id: 'rdl', file: 'exercise/rdl_bb.webp', name: { tr: 'Romanian deadlift', en: 'Romanian deadlift' }, site: { tr: 'Bel omurgası (ARED deadlift kategorisi)', en: 'Lumbar spine (ARED deadlift category)' }, iss: { tr: 'ISS: ARED', en: 'ISS: ARED' }, src: TB031(16) },
  { id: 'goodmorning', file: 'exercise/good_morning.webp', name: { tr: 'Barbell good morning', en: 'Barbell good morning' }, site: { tr: 'Bel omurgası', en: 'Lumbar spine' }, iss: { tr: 'ISS: ARED', en: 'ISS: ARED' }, src: MTB013(14) },
  { id: 'heelraise', file: 'exercise/calf_raise.webp', name: { tr: 'Topuk kaldırma', en: 'Heel raise' }, site: { tr: 'Baldır; tek bacak duruşunda topuk kemiği', en: 'Calf; calcaneus in single-leg stance' }, iss: { tr: 'ISS: ARED', en: 'ISS: ARED' }, src: MTB013(14) },
  { id: 'hipabd', file: 'exercise/side_leg_raise.webp', name: { tr: 'Kalça abdüktörleri (tek bacak duruşu)', en: 'Hip abductors (single-leg stance)' }, site: { tr: 'Büyük trokanter', en: 'Greater trochanter' }, iss: { tr: 'Belgede cihaz belirtilmemiş', en: 'Device not stated' }, src: MTB013(14) },
  { id: 'bench', file: 'exercise/bench_bb.webp', name: { tr: 'Bench press', en: 'Bench press' }, site: { tr: 'Üst vücut kuvveti', en: 'Upper-body strength' }, iss: { tr: 'ISS: ARED', en: 'ISS: ARED' }, src: TB031(16) },
  { id: 'treadmill', file: 'exercise/run.webp', name: { tr: 'Koşu (aerobik)', en: 'Running (aerobic)' }, site: { tr: 'Aerobik kapasite; %70–100 maksimum nabız', en: 'Aerobic capacity; 70–100% HRmax' }, iss: { tr: 'ISS: T2/COLBERT koşu bandı, kemerle yüklenir', en: 'ISS: T2/COLBERT treadmill with harness' }, src: TB031(11) },
  { id: 'cycle', file: 'exercise/bike.webp', name: { tr: 'Bisiklet (aerobik)', en: 'Cycling (aerobic)' }, site: { tr: 'Aerobik kapasite; %70–100 VO₂peak', en: 'Aerobic capacity; 70–100% VO₂peak' }, iss: { tr: 'ISS: CEVIS bisiklet', en: 'ISS: CEVIS cycle' }, src: TB031(11) },
  { id: 'jump', file: 'exercise/jump_squat.webp', name: { tr: 'Sıçrama', en: 'Jumping' }, site: { tr: 'Femur boynunun alt kısmı', en: 'Inferior femoral neck' }, iss: { tr: 'Yerçekimli ortam bulgusu', en: 'Gravity-environment finding' }, src: MTB013(14), note: { tr: 'Mikrogravitede uygulanabilirliği belgede yok.', en: 'Microgravity applicability not stated.' } },
];
/** NASA'nın adını verdiği ama doğru animasyonu olmayan hareketler (yalnız yazı) */
export const EX_TEXT_ONLY: L[] = [
  { tr: 'Tek bacak squat (büyük trokanter)', en: 'Single-leg squat (greater trochanter)' },
  { tr: 'Sumo squat, sumo deadlift', en: 'Sumo squat, sumo deadlift' },
  { tr: 'Tek bacak, derin ve kısa açılı squat (femur boynu üst-yan)', en: 'Single-leg deep short-arc squat (superior lateral femoral neck)' },
  { tr: 'Tek bacak topuk kaldırma', en: 'Single-leg heel raise' },
  { tr: 'Parmak şınavı (ön kol kemikleri)', en: 'Finger push-ups (distal radius/ulna)' },
  { tr: 'Sprint', en: 'Sprinting' },
];
export const EX_ANIM_CREDIT = { label: 'Animasyon: forge-motion (CC0)', url: 'https://github.com/Dante3750/forge-motion' };
