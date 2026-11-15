// Üç görünüm için telemetri: astronot cihazı anlık durumu her 2 sn'de yayınlar; mürettebat sağlık görevlisi (CMO) ve
// yer kontrol ekranları dinler. Yer kontrol, her paketi gönderim zamanından "tek yön gecikme" kadar SONRA gösterir
// (gecikme environments.json'daki ortam değerinden; sıkıştırma kullanılırsa ekranda yazılır).
// Tek cihazda da çalışır: yerel astronot paketleri yerel tampona da yazılır ("bu cihaz").
// AI notu: Claude (Anthropic) yardımıyla yazılmıştır.
import { create } from 'zustand';
import { WS_BASE } from './base';
import { buildSnapshot } from './ai';
import { useApp, activeAlerts, evalLatest } from './store';
import { INDICATOR_ORDER, INDICATORS } from './engine/indicators';
import { useScenario, SCEN_META, type L } from './scenario';
import type { Escalation, Status } from './engine/types';
import { setSymptomHook, type SymptomReport } from './symptoms';
import { useLink } from './link';
import { sampleBaseline } from './baseline';
import { validPacket, validNotice } from './validate';
import { sampleHistory } from './history';
import { ROSTER_IDS, useRecord } from './crew';

export type Role = 'astronaut' | 'cmo' | 'ground';
export interface UiExtra {
  labels: Record<string, string>; decimals: Record<string, number>;
  alarm: string[]; ai: { headline: string; escalate?: Escalation; lang: string } | null;
  scenario: { title: L; caption: L | null } | null;
  extra: { id: string; title: L; value: string; label: L; status: Status; escalate: Escalation }[];
  bp: string;
  linkDown?: boolean;
}
export interface Packet { crewId: string; t: number; snap: ReturnType<typeof buildSnapshot>; ui: UiExtra; local?: boolean }

const ls = (k: string, d: string) => { try { return localStorage.getItem(k) ?? d; } catch { return d; } };
const q = typeof location !== 'undefined' ? new URLSearchParams(location.search) : new URLSearchParams();
/** Her cihaz ilk açılışta kendi kimliğini alır (jüri telefonları aynı "C-01"i paylaşıp birbirinin üzerine yazmasın) */
function deviceCrewId() {
  const saved = ls('ahm.crew', '');
  if (ROSTER_IDS.includes(saved)) return saved;
  // Kurgusal 3 kişilik ekipten biri (eski rastgele C-xx kimlikleri artık kullanılmaz)
  const id = ROSTER_IDS[Math.floor(Math.random() * ROSTER_IDS.length)];
  try { localStorage.setItem('ahm.crew', id); } catch { /* yok */ }
  return id;
}
interface TelState {
  role: Role; crewId: string; connected: boolean; compress: boolean; buf: Record<string, Packet[]>;
  /** Yer kontrol: LOS süresince gemide bekleyen paket sayısı (anahtar → adet) */
  held: Record<string, number>;
  setRole: (r: Role) => void; setCrewId: (c: string) => void; setCompress: (b: boolean) => void;
}
export const useTelemetry = create<TelState>((set) => ({
  role: (q.get('role') as Role) || (ls('ahm.role', 'astronaut') as Role),
  crewId: q.get('crew') || deviceCrewId(),
  connected: false, compress: false, buf: {}, held: {},
  setRole: (role) => { try { localStorage.setItem('ahm.role', role); } catch { /* yok */ } set({ role }); },
  setCrewId: (crewId) => { try { localStorage.setItem('ahm.crew', crewId); } catch { /* yok */ } useRecord.getState().setCrew(crewId); set({ crewId }); },
  setCompress: (compress) => set({ compress }),
}));

const KEEP_MS = 25 * 60_000;
function push(key: string, p: Packet) {
  useTelemetry.setState((s) => {
    const arr = [...(s.buf[key] ?? []), p].filter((x) => p.t - x.t < KEEP_MS);
    return { buf: { ...s.buf, [key]: arr } };
  });
}

/** LOS: yer kontrol ekranı yeni paketi göstermez, gemide tutulmuş gibi saklar; bağlantı dönünce hepsi sırayla aktarılır.
 * CMO (gemi içi) etkilenmez. */
const heldQ: Record<string, Packet[]> = {};
function ingest(key: string, p: Packet) {
  if (useTelemetry.getState().role === 'ground') {
    if (p.ui.linkDown) {
      const q = (heldQ[key] = [...(heldQ[key] ?? []), p].filter((x) => p.t - x.t < KEEP_MS));
      useTelemetry.setState((s) => ({ held: { ...s.held, [key]: q.length } }));
      return;
    }
    const q = heldQ[key];
    if (q?.length) {
      heldQ[key] = [];
      useTelemetry.setState((s) => {
        const arr = [...(s.buf[key] ?? []), ...q].filter((x) => p.t - x.t < KEEP_MS);
        return { buf: { ...s.buf, [key]: arr }, held: { ...s.held, [key]: 0 } };
      });
    }
  }
  push(key, p);
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
      extra: sc.extra.map((x) => ({ id: x.id, title: x.title, value: x.value, label: x.label, status: x.status, escalate: x.escalate })),
      bp: `${evalLatest(a.readings, 'systolic').reading.value.toFixed(0)}/${evalLatest(a.readings, 'diastolic').reading.value.toFixed(0)}`,
      linkDown: useLink.getState().down,
    },
  };
}

/** Mürettebat bildirimi: bir astronot belirti bildirdiğinde DİĞER astronot cihazlarına kısa uyarı (CMO paketten görür) */
export interface Notice { id: string; crewId: string; t: number; category: SymptomReport['category']; quote: string }
export const useNotices = create<{ list: Notice[]; dismiss: (id: string) => void }>((set) => ({
  list: [], dismiss: (id) => set((s) => ({ list: s.list.filter((x) => x.id !== id) })),
}));
setSymptomHook((r) => {
  const n: Notice = { id: r.id, crewId: useTelemetry.getState().crewId, t: r.t, category: r.category, quote: r.quote };
  if (ws?.readyState === 1) ws.send(JSON.stringify({ type: 'notice', notice: n }));
});

let ws: WebSocket | null = null;
let wsRole = '';
function connect() {
  const { role } = useTelemetry.getState();
  const want = role === 'astronaut' ? 'astronaut' : 'viewer';
  if (ws && wsRole === want && ws.readyState <= 1) return;
  try { ws?.close(); } catch { /* yok */ }
  wsRole = want;
  const url = `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}${WS_BASE}/ws/telemetry?role=${want}`;
  const s = new WebSocket(url);
  ws = s;
  s.onopen = () => useTelemetry.setState({ connected: true });
  s.onclose = () => { if (ws === s) { useTelemetry.setState({ connected: false }); ws = null; } };
  s.onerror = () => { /* yerel modda sürer */ };
  // Varışta yeniden damgala: laptoplar arası saat farkı gecikme hesabını bozmasın (ağ gecikmesi ~ms, ihmal)
  s.onmessage = (ev) => {
    try {
      const d = JSON.parse(ev.data);
      if (d?.type === 'notice') { // diğer mürettebat cihazı: kısa bildirim (kendi gönderdiğimiz gelmez)
        if (!validNotice(d.notice)) return;
        const n = d.notice as Notice;
        if (n.crewId !== useTelemetry.getState().crewId) useNotices.setState((st) => ({ list: [...st.list.filter((x) => x.id !== n.id), { ...n, t: Date.now() }].slice(-3) }));
        return;
      }
      if (!validPacket(d)) return; // biçimsiz ya da kötü niyetli paket ekranı çökertemez
      const p = d as Packet; ingest(p.crewId, { ...p, t: Date.now() });
    } catch { /* yok */ }
  };
}

/** Uygulama boyunca bir kez: 2 sn'de bir yayın + bağlantı bakımı */
export function startTelemetry() {
  setInterval(() => {
    connect();
    sampleBaseline();
    sampleHistory();
    const p = makePacket();
    ingest(`local:${p.crewId}`, { ...p, local: true });
    if (useTelemetry.getState().role === 'astronaut' && ws?.readyState === 1) ws.send(JSON.stringify(p));
  }, 2000);
}

/** Gösterilecek paket: CMO gecikmesiz; yer kontrol = şimdi − tek yön gecikme (sıkıştırma ÷60 isteğe bağlı, etiketli) */
export function delayMsFor(p: Packet | undefined, role: Role, compress: boolean) {
  if (!p || role !== 'ground') return 0;
  const [lo] = p.snap.commDelayOneWaySec;
  return (lo * 1000) / (compress ? 60 : 1);
}

useRecord.getState().setCrew(useTelemetry.getState().crewId); // açılışta seçili üyenin kaydı
