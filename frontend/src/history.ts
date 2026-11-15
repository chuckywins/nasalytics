// Oturum okuma geçmişi: 2 sn'de bir satır (24 saate kadar, cihaz belleğinde). Kayıt penceresindeki tablo ve dışa aktarım için.
// Değerler göstergelerin o anki değeridir (çoğu SİMÜLE); dışa aktarılan dosyada da kaynak etiketi yazılır.
// AI notu: Claude (Anthropic) yardımıyla yazılmıştır.
import { useApp, evalLatest, activeAlerts } from './store';
import { useScenario } from './scenario';
import { useLink } from './link';

export interface HistRow { t: number; hr: number; spo2: number; rr: number; sys: number; dia: number; temp: number; activity: string; alarm: string; scenario: string; link: string }
const MAX = 43_200; // 24 sa × 1800 satır/sa
export const HIST: HistRow[] = [];

export function sampleHistory() {
  const a = useApp.getState();
  if (!a.sessionStarted) return;
  const v = (id: Parameters<typeof evalLatest>[1]) => evalLatest(a.readings, id).reading.value;
  HIST.push({
    t: Date.now(), hr: Math.round(v('heartRate')), spo2: Math.round(v('spo2')), rr: Math.round(v('respRate')), sys: Math.round(v('systolic')), dia: Math.round(v('diastolic')), temp: +v('bodyTemp').toFixed(1),
    activity: a.activity, alarm: activeAlerts(a.readings).filter((x) => x.status === 'critical').map((x) => x.id).join(' '),
    scenario: useScenario.getState().id ?? '', link: useLink.getState().down ? 'LOS' : 'ok',
  });
  if (HIST.length > MAX) HIST.splice(0, HIST.length - MAX);
}

/** Aralık + toplama (her satır / 1 dk ortalama) */
export function histView(rangeMin: number | null, avg: boolean): HistRow[] {
  const from = rangeMin ? Date.now() - rangeMin * 60_000 : 0;
  const rows = HIST.filter((r) => r.t >= from);
  if (!avg) return rows;
  const out: HistRow[] = [];
  const groups = new Map<number, HistRow[]>();
  for (const r of rows) { const k = Math.floor(r.t / 60_000); groups.set(k, [...(groups.get(k) ?? []), r]); }
  for (const [k, g] of groups) {
    const m = (f: (r: HistRow) => number, d = 0) => +(g.reduce((s, r) => s + f(r), 0) / g.length).toFixed(d);
    out.push({ t: k * 60_000, hr: m((r) => r.hr), spo2: m((r) => r.spo2), rr: m((r) => r.rr), sys: m((r) => r.sys), dia: m((r) => r.dia), temp: m((r) => r.temp, 1), activity: g[g.length - 1].activity, alarm: [...new Set(g.flatMap((r) => r.alarm.split(' ').filter(Boolean)))].join(' '), scenario: g[g.length - 1].scenario, link: g.some((r) => r.link === 'LOS') ? 'LOS' : 'ok' });
  }
  return out;
}

export function download(name: string, text: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a'); a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
export function toCsv(rows: HistRow[]) {
  const head = 'time_utc,heart_rate_bpm,spo2_pct,resp_rate_per_min,systolic_mmHg,diastolic_mmHg,body_temp_C,activity,critical_alarms,scenario,ground_link,provenance';
  return [head, ...rows.map((r) => [new Date(r.t).toISOString(), r.hr, r.spo2, r.rr, r.sys, r.dia, r.temp, r.activity, r.alarm, r.scenario, r.link, 'SIMULATED'].join(','))].join('\n');
}
