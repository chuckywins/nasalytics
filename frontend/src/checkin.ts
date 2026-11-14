// Günlük check-in: rutin görevler + oyunlaştırma (puan, seri, rozet) + reaksiyon testi + sesli günlük sonuçları.
// Yarışma metni (Potential Considerations): "prompt astronauts to take measurements or complete specific actions from time to time"
// ve "a gamification system to help astronauts engage with tasks that support their health".
// Kural: yalnızca GERÇEK tamamlamalar sayılır; sahte geçmiş/seri yoktur. localStorage'da tutulur (cihaz başına).
// AI notu: Claude (Anthropic) yardımıyla yazılmıştır.
import { create } from 'zustand';
import { useApp } from './store';

export type TaskId = 'bp' | 'glucose' | 'sleep' | 'mood' | 'reaction' | 'voice' | 'exercise';
export const TASKS: TaskId[] = ['bp', 'glucose', 'sleep', 'mood', 'reaction', 'voice', 'exercise'];
export const XP_TASK = 10, XP_FULL_DAY = 30;

export interface ReactionResult { at: number; medianMs: number; meanMs: number; lapses: number; falseStarts: number; trials: number; rts: number[]; }
export interface VoiceCue { domain: 'stress' | 'fatigue' | 'low_mood' | 'isolation'; level: 'none' | 'low' | 'moderate' | 'high'; evidence: string; }
export interface VoiceResult { at: number; transcript: string; metrics: { durationSec: number; words: number; wordsPerMin: number; pauseRatio: number | null }; summary: string; cues: VoiceCue[]; followUp: string; }

interface DayRec { done: TaskId[]; xp: number; }
interface CheckinState {
  days: Record<string, DayRec>;
  manual: Partial<Record<TaskId, number>>; // elle işaretlenen (egzersiz) – zaman damgası
  reaction: ReactionResult[];
  voice: VoiceResult[];
  addReaction: (r: ReactionResult) => void;
  addVoice: (v: VoiceResult) => void;
  toggleManual: (t: TaskId) => void;
  modal: 'reaction' | 'voice' | null;
  setModal: (m: 'reaction' | 'voice' | null) => void;
}

export const dayKey = (t = Date.now()) => new Date(t).toISOString().slice(0, 10);
const LS = 'ahm.checkin.v1';
const load = (): Pick<CheckinState, 'days' | 'reaction' | 'voice' | 'manual'> => {
  try { const j = JSON.parse(localStorage.getItem(LS) ?? ''); return { days: j.days ?? {}, reaction: j.reaction ?? [], voice: j.voice ?? [], manual: j.manual ?? {} }; }
  catch { return { days: {}, reaction: [], voice: [], manual: {} }; }
};

export const useCheckin = create<CheckinState>((set) => ({
  ...load(),
  addReaction: (r) => set((s) => ({ reaction: [...s.reaction, r].slice(-30) })),
  addVoice: (v) => set((s) => ({ voice: [...s.voice, v].slice(-14) })),
  modal: typeof location !== 'undefined' && location.search.includes('rtSelfTest') ? 'reaction' : null,
  setModal: (modal) => set({ modal }),
  toggleManual: (t) => set((s) => {
    const m = { ...s.manual };
    if (m[t] && dayKey(m[t]) === dayKey()) delete m[t]; else m[t] = Date.now();
    return { manual: m };
  }),
}));
useCheckin.subscribe((s) => { try { localStorage.setItem(LS, JSON.stringify({ days: s.days, reaction: s.reaction, voice: s.voice, manual: s.manual })); } catch { /* özel mod */ } });

/** Bugün tamamlanan görevler: ölçümler ana store'dan, test/kayıtlar check-in store'dan türetilir */
export function doneToday(): TaskId[] {
  const today = dayKey();
  const { readings } = useApp.getState();
  const c = useCheckin.getState();
  const measured = (id: keyof typeof readings, pred: (ctx?: string) => boolean = () => true) =>
    readings[id].some((r) => (r.provenance === 'USER_INPUT' || r.provenance === 'CAMERA') && dayKey(r.t) === today && pred(r.ctx));
  const out: TaskId[] = [];
  if (measured('systolic')) out.push('bp');
  if (measured('glucose', (ctx) => ctx === 'fasting')) out.push('glucose');
  if (measured('sleepHours')) out.push('sleep');
  if (measured('mood')) out.push('mood');
  if (c.reaction.some((r) => dayKey(r.at) === today)) out.push('reaction');
  if (c.voice.some((v) => dayKey(v.at) === today)) out.push('voice');
  if (c.manual.exercise && dayKey(c.manual.exercise) === today) out.push('exercise');
  return out;
}

/** Bugünü kaydet (puan) ve seri/rozetleri hesapla */
export function syncToday() {
  const done = doneToday();
  const xp = done.length * XP_TASK + (done.length === TASKS.length ? XP_FULL_DAY : 0);
  const k = dayKey();
  const prev = useCheckin.getState().days[k];
  if (!prev || prev.xp !== xp || prev.done.length !== done.length) useCheckin.setState((s) => ({ days: { ...s.days, [k]: { done, xp } } }));
  return { done, xp };
}

/** Seri: bugünden (bugün tamsa) veya dünden geriye kesintisiz TAM gün sayısı */
export function streak(days: Record<string, DayRec>) {
  let n = 0;
  const d = new Date();
  if (!(days[dayKey(d.getTime())]?.done.length === TASKS.length)) d.setDate(d.getDate() - 1);
  for (;;) { const r = days[dayKey(d.getTime())]; if (r && r.done.length === TASKS.length) { n++; d.setDate(d.getDate() - 1); } else break; }
  return n;
}

export const totalXp = (days: Record<string, DayRec>) => Object.values(days).reduce((a, r) => a + r.xp, 0);

export interface Badge { id: string; earned: boolean; }
export function badges(s: CheckinState): Badge[] {
  const days = Object.values(s.days);
  return [
    { id: 'first', earned: days.some((d) => d.done.length > 0) },
    { id: 'fullDay', earned: days.some((d) => d.done.length === TASKS.length) },
    { id: 'streak3', earned: streak(s.days) >= 3 },
    { id: 'vigilant', earned: s.reaction.some((r) => r.lapses === 0 && r.falseStarts === 0) },
    { id: 'voice', earned: s.voice.length > 0 },
  ];
}
