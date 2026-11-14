// Kameradan yorgunluk ipuçları: tamamen cihazda (MediaPipe Face Landmarker, Apache-2.0). Görüntü hiçbir yere gönderilmez.
// Ölçüler (yüz "ifade katsayıları" / blendshapes):
//  - Göz kırpma hızı (dakikada)   - PERCLOS: gözlerin ≥%80 kapalı kaldığı zaman oranı (60 sn kayan pencere)
//  - Uzun göz kapanması (≥1,5 sn, mikro-uyku ipucu)   - Esneme (çene açık ≥1,2 sn)   - Görünen ifade (DUYGU DEĞİL)
// Kaynak: FHWA Tech Brief FHWA-MCRT-98-006 (1998): PERCLOS, PVT ile doğrulanmış en güvenilir uyanıklık ölçüsü bulundu.
// Eşikler (izle ≥%8, uyarı ≥%15) VARSAYIMDIR. Blendshape ile göz kapanma tahmini yaklaşıktır. Alarm DEĞİL, ipucu üretir.
// AI notu: Claude (Anthropic) yardımıyla yazılmıştır.
import { create } from 'zustand';
import type { Status } from './engine/types';

export type Expression = 'neutral' | 'smile' | 'browFurrow' | 'frown' | 'none';
export interface FatigueState {
  enabled: boolean;
  phase: 'off' | 'loading' | 'calibrating' | 'running' | 'nocam' | 'error';
  face: boolean;
  blinkPerMin: number | null;
  perclos: number | null;      // 0..1
  yawns: number;
  lastLongClosureAt: number | null;
  eyesClosed: boolean;
  expression: Expression;
  status: Status;
  raw?: { eye: number; jaw: number };
  setEnabled: (b: boolean) => void;
}

export const useFatigue = create<FatigueState>((set) => ({
  enabled: (() => { try { return localStorage.getItem('ahm.cam') !== 'off'; } catch { return true; } })(),
  phase: 'off', face: false, blinkPerMin: null, perclos: null, yawns: 0, lastLongClosureAt: null, eyesClosed: false, expression: 'none', status: 'unknown',
  setEnabled: (enabled) => { try { localStorage.setItem('ahm.cam', enabled ? 'on' : 'off'); } catch { /* yok */ } set({ enabled, phase: enabled ? 'loading' : 'off' }); },
}));

type BS = Record<string, number>;
const WINDOW_MS = 60_000, CLOSED = 0.55, PERCLOS_CLOSED = 0.75, MIN_DATA_MS = 20_000;
// Esneme eşikleri: ilk sürüm (0,55 / 1,2 sn) gerçek esnemeleri kaçırdı → kullanıcı testine göre gevşetildi
const YAWN_ON = 0.35, YAWN_OFF = 0.2, YAWN_MS = 800;

/** Kare kare blendshape işleyen durum makinesi; store'u saniyede ~2 kez günceller */
export class FatigueAnalyzer {
  private frames: { t: number; closed80: boolean }[] = [];
  private blinks: number[] = [];
  private closedSince: number | null = null;
  private jawSince: number | null = null;
  private yawnCounted = false;
  private yawns = 0;
  private lastLong: number | null = null;
  private lastPush = 0;
  private started = 0;
  rawEye = 0;
  rawJaw = 0;

  push(t: number, bs: BS | null) {
    if (!this.started) this.started = t;
    const st = useFatigue.getState();
    if (!bs) { if (t - this.lastPush > 500) { this.lastPush = t; useFatigue.setState({ face: false }); } return; }
    const eye = ((bs.eyeBlinkLeft ?? 0) + (bs.eyeBlinkRight ?? 0)) / 2;
    const jaw = bs.jawOpen ?? 0;
    // Göz kırpma / uzun kapanma
    if (eye > CLOSED) { if (this.closedSince == null) this.closedSince = t; if (t - this.closedSince >= 1500 && this.lastLong !== this.closedSince) this.lastLong = this.closedSince; }
    else if (this.closedSince != null) { const d = t - this.closedSince; if (d >= 60 && d < 500) this.blinks.push(t); this.closedSince = null; }
    // Esneme
    // Esneme: çene açıklığı > YAWN_ON en az YAWN_MS sürerse; < YAWN_OFF olunca biter (histerezis, titreme sayılmaz)
    if (jaw > YAWN_ON || (this.jawSince != null && jaw > YAWN_OFF)) {
      if (this.jawSince == null) this.jawSince = t;
      if (!this.yawnCounted && t - this.jawSince >= YAWN_MS) { this.yawns++; this.yawnCounted = true; }
    } else { this.jawSince = null; this.yawnCounted = false; }
    this.rawEye = eye; this.rawJaw = jaw;
    // PERCLOS penceresi
    this.frames.push({ t, closed80: eye > PERCLOS_CLOSED });
    while (this.frames.length && t - this.frames[0].t > WINDOW_MS) this.frames.shift();
    while (this.blinks.length && t - this.blinks[0] > WINDOW_MS) this.blinks.shift();

    if (t - this.lastPush < 500) return;
    this.lastPush = t;
    const span = Math.min(WINDOW_MS, t - this.started);
    const enough = t - this.started >= MIN_DATA_MS;
    const perclos = this.frames.length ? this.frames.filter((f) => f.closed80).length / this.frames.length : 0;
    const blinkPerMin = span > 5000 ? (this.blinks.length / span) * 60000 : null;
    const avg = (a: string, b: string) => ((bs[a] ?? 0) + (bs[b] ?? 0)) / 2;
    const expression: Expression = avg('mouthSmileLeft', 'mouthSmileRight') > 0.4 ? 'smile'
      : avg('browDownLeft', 'browDownRight') > 0.4 ? 'browFurrow' : avg('mouthFrownLeft', 'mouthFrownRight') > 0.3 ? 'frown' : 'neutral';
    const recentLong = this.lastLong != null && t - this.lastLong < 120_000;
    const status: Status = !enough ? 'unknown' : perclos >= 0.15 || recentLong ? 'warn' : perclos >= 0.08 ? 'watch' : 'ok';
    useFatigue.setState({
      face: true, phase: enough ? 'running' : 'calibrating', perclos: enough ? perclos : null, blinkPerMin,
      yawns: this.yawns, lastLongClosureAt: this.lastLong ? Date.now() - (t - this.lastLong) : null,
      eyesClosed: eye > CLOSED, expression, status: st.enabled ? status : 'unknown', raw: { eye, jaw },
    });
  }
}
