// Üç görünüm için telemetri: astronot cihazı anlık durumu her 2 sn'de yayınlar; mürettebat sağlık görevlisi (CMO) ve
// yer kontrol ekranları dinler. Yer kontrol, her paketi gönderim zamanından "tek yön gecikme" kadar SONRA gösterir
// (gecikme environments.json'daki ortam değerinden; sıkıştırma kullanılırsa ekranda yazılır).
// Tek cihazda da çalışır: yerel astronot paketleri yerel tampona da yazılır ("bu cihaz").
// AI notu: Claude (Anthropic) yardımıyla yazılmıştır.
import { create } from 'zustand';
import { buildSnapshot } from './ai';
import { useApp, activeAlerts, evalLatest } from './store';
import { INDICATOR_ORDER, INDICATORS } from './engine/indicators';
import { useScenario, SCEN_META, type L } from './scenario';
import type { Escalation, Status } from './engine/types';

export type Role = 'astronaut' | 'cmo' | 'ground';
export interface UiExtra {
  labels: Record<string, string>; decimals: Record<string, number>;
  alarm: string[]; ai: { headline: string; escalate?: Escalation; lang: string } | null;
  scenario: { title: L; caption: L | null } | null;
  extra: { title: L; value: string; label: L; status: Status; escalate: Escalation }[];
  bp: string;
}
export interface Packet { crewId: string; t: number; snap: ReturnType<typeof buildSnapshot>; ui: UiExtra; local?: boolean }

const ls = (k: string, d: string) => { try { return localStorage.getItem(k) ?? d; } catch { return d; } };
const q = typeof location !== 'undefined' ? new URLSearchParams(location.search) : new URLSearchParams();
interface TelState {
  role: Role; crewId: string; connected: boolean; compress: boolean; buf: Record<string, Packet[]>;
  setRole: (r: Role) => void; setCrewId: (c: string) => void; setCompress: (b: boolean) => void;
}
export const useTelemetry = create<TelState>((set) => ({
  role: (q.get('role') as Role) || (ls('ahm.role', 'astronaut') as Role),
  crewId: q.get('crew') || ls('ahm.crew', 'C-01'),
  connected: false, compress: false, buf: {},
  setRole: (role) => { try { localStorage.setItem('ahm.role', role); } catch { /* yok */ } set({ role }); },
  setCrewId: (crewId) => { try { localStorage.setItem('ahm.crew', crewId); } catch { /* yok */ } set({ crewId }); },
  setCompress: (compress) => set({ compress }),
}));

const KEEP_MS = 25 * 60_000;
function push(key: string, p: Packet) {
  useTelemetry.setState((s) => {
    const arr = [...(s.buf[key] ?? []), p].filter((x) => p.t - x.t < KEEP_MS);
    return { buf: { ...s.buf, [key]: arr } };
  });
}

function makePacket(): Packet {
  const a = useApp.getState();
  const sc = useScenario.getState();
  const labels: Record<string, string> = {}, decimals: Record<string, number> = {};
  for (const id of INDICATOR_ORDER) { labels[id] = evalLatest(a.readings, id).labelKey; decimals[id] = INDICATORS[id].decimals; }
  const crit = activeAlerts(a.readings).filter((x) => x.status === 'critical' && !a.acked.includes(x.id)).map((x) => x.id as string);
  return {
    crewId: useTelemetry.getState().crewId, t: Date.now(), snap: buildSnapshot(),
    ui: {
      labels, decimals, alarm: [...crit, ...sc.extra.filter((x) => x.status === 'critical' && !sc.ackedExtra.includes(x.id)).map((x) => x.id)],
      ai: a.ai.data ? { headline: a.ai.data.headline, escalate: a.ai.data.escalate, lang: a.lang } : null,
      scenario: sc.id ? { title: SCEN_META[sc.id].title, caption: sc.caption } : null,
      extra: sc.extra.map((x) => ({ title: x.title, value: x.value, label: x.label, status: x.status, escalate: x.escalate })),
      bp: `${evalLatest(a.readings, 'systolic').reading.value.toFixed(0)}/${evalLatest(a.readings, 'diastolic').reading.value.toFixed(0)}`,
    },
  };
}

let ws: WebSocket | null = null;
let wsRole = '';
function connect() {
  const { role } = useTelemetry.getState();
  const want = role === 'astronaut' ? 'astronaut' : 'viewer';
  if (ws && wsRole === want && ws.readyState <= 1) return;
  try { ws?.close(); } catch { /* yok */ }
  wsRole = want;
  const url = `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}${import.meta.env.VITE_WS_BASE ?? ''}/ws/telemetry?role=${want}`;
  const s = new WebSocket(url);
  ws = s;
  s.onopen = () => useTelemetry.setState({ connected: true });
  s.onclose = () => { if (ws === s) { useTelemetry.setState({ connected: false }); ws = null; } };
  s.onerror = () => { /* yerel modda sürer */ };
  // Varışta yeniden damgala: laptoplar arası saat farkı gecikme hesabını bozmasın (ağ gecikmesi ~ms, ihmal)
  s.onmessage = (ev) => { try { const p = JSON.parse(ev.data) as Packet; if (p?.crewId && p.snap) push(p.crewId, { ...p, t: Date.now() }); } catch { /* yok */ } };
}

/** Uygulama boyunca bir kez: 2 sn'de bir yayın + bağlantı bakımı */
export function startTelemetry() {
  setInterval(() => {
    connect();
    const p = makePacket();
    push(`local:${p.crewId}`, { ...p, local: true });
    if (useTelemetry.getState().role === 'astronaut' && ws?.readyState === 1) ws.send(JSON.stringify(p));
  }, 2000);
}

/** Gösterilecek paket: CMO gecikmesiz; yer kontrol = şimdi − tek yön gecikme (sıkıştırma ÷60 isteğe bağlı, etiketli) */
export function delayMsFor(p: Packet | undefined, role: Role, compress: boolean) {
  if (!p || role !== 'ground') return 0;
  const [lo] = p.snap.commDelayOneWaySec;
  return (lo * 1000) / (compress ? 60 : 1);
}
