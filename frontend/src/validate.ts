// Ağdan gelen telemetri paketlerinin biçim denetimi. Paketler kimlik doğrulaması olmayan bir aktarımdan gelir;
// bozuk ya da kötü niyetli bir paket izleyici ekranını (CMO / yer kontrol) çökertmemeli ve sahte biçimde alan taşımamalı.
// Geçmeyen paket sessizce atılır. Metin alanları zaten React tarafından kaçışlanır (HTML olarak işlenmez).
// AI notu: Claude (Anthropic) yardımıyla yazılmıştır.

const STATUS = new Set(['ok', 'watch', 'warn', 'critical', 'unknown']);
const ESC = new Set(['self', 'crew', 'ground']);
const ACT = new Set(['rest', 'exercise', 'eva']);
const CATS = new Set(['chestPain', 'breathing', 'nausea', 'pain', 'allergy', 'dizzy', 'unwell', 'other']);
const SRC = new Set(['vega', 'scenario', 'tap', 'system']);

type O = Record<string, unknown>;
const obj = (v: unknown): v is O => typeof v === 'object' && v !== null && !Array.isArray(v);
const str = (v: unknown, max = 400): v is string => typeof v === 'string' && v.length <= max;
const num = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const arr = (v: unknown, max: number): v is unknown[] => Array.isArray(v) && v.length <= max;
const L = (v: unknown) => obj(v) && str(v.tr) && str(v.en);
const optNull = (v: unknown, ok: (x: unknown) => boolean) => v === undefined || v === null || ok(v);
const strMap = (v: unknown) => obj(v) && Object.keys(v).length <= 40 && Object.values(v).every((x) => str(x, 80));
const numMap = (v: unknown) => obj(v) && Object.keys(v).length <= 40 && Object.values(v).every(num);

/** Telemetri paketi geçerli mi? (kullanılan her alan denetlenir) */
export function validPacket(p: unknown): boolean {
  if (!obj(p) || !str(p.crewId, 12) || !/^[A-Za-z0-9-]{1,12}$/.test(p.crewId as string)) return false;
  const s = p.snap, u = p.ui;
  if (!obj(s) || !obj(u)) return false;
  if (!str(s.environment, 60) || !str(s.activity, 12) || !ACT.has(s.activity as string) || !num(s.gravity_g) || !num(s.missionDay)) return false;
  const d = s.commDelayOneWaySec;
  if (!arr(d, 2) || d.length !== 2 || !d.every((x) => num(x) && x >= 0 && x <= 3600)) return false; // sahte dev gecikme kartı sonsuza dek "yolda" bırakamaz
  if (!arr(s.indicators, 20) || !s.indicators.every((x) => obj(x) && str(x.id, 20) && num(x.value) && str(x.unit, 12) && str(x.status, 10) && STATUS.has(x.status as string))) return false;
  if (!optNull(s.reportedSymptoms, (v) => arr(v, 8) && v.every((x) => obj(x) && str(x.id, 30) && str(x.category, 12) && CATS.has(x.category as string) && str(x.quote, 240) && num(x.minutesAgo) && str(x.source, 10) && SRC.has(x.source as string)))) return false;
  if (!optNull(s.cabin, (v) => obj(v) && optNull(v.pressurePsia, num) && optNull(v.o2Pct, num))) return false;
  if (!optNull(s.scenario, (v) => obj(v) && optNull(v.extraAlerts, (a) => arr(a, 8) && a.every((x) => obj(x) && str(x.id, 30) && str(x.status, 10))))) return false;
  if (!optNull(s.crewRecord, (v) => obj(v) && Object.keys(v).length <= 24 && Object.values(v).every((x) => x === undefined || x === null || str(x, 200) || num(x)))) return false;
  if (!optNull(s.personalBaseline, (v) => obj(v) && num(v.restingHrMedian) && num(v.deltaNow))) return false;
  if (!strMap(u.labels) || !numMap(u.decimals) || !str(u.bp, 12)) return false;
  if (!arr(u.alarm, 20) || !u.alarm.every((x) => str(x, 30))) return false;
  if (!optNull(u.ai, (v) => obj(v) && str(v.headline, 300) && optNull(v.escalate, (e) => str(e, 8) && ESC.has(e as string)))) return false;
  if (!optNull(u.scenario, (v) => obj(v) && L(v.title) && optNull(v.caption, L))) return false;
  if (!arr(u.extra, 8) || !u.extra.every((x) => obj(x) && str(x.id, 30) && L(x.title) && str(x.value, 40) && L(x.label) && str(x.status, 10) && STATUS.has(x.status as string) && str(x.escalate, 8) && ESC.has(x.escalate as string))) return false;
  if (!optNull(u.linkDown, (v) => typeof v === 'boolean')) return false;
  return true;
}

/** Mürettebat bildirimi geçerli mi? */
export function validNotice(n: unknown): boolean {
  return obj(n) && str(n.id, 30) && n.id !== '' && str(n.crewId, 12) && str(n.category, 12) && CATS.has(n.category as string) && str(n.quote, 240);
}
