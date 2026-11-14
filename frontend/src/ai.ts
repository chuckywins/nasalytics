// AI istemci katmanı: anlık durum özeti (snapshot), AI değerlendirme tetikleyicisi, VEGA akışı.
// Kural: AI uyarıyı YÜKSELTEBİLİR, asla kapatamaz (eskalasyon = max(kural, AI)). Proxy yoksa kural kartları kalır.
// AI notu: Claude (Anthropic) yardımıyla yazılmıştır.
import { useEffect, useRef } from 'react';
import { INDICATORS, INDICATOR_ORDER } from './engine/indicators';
import { ENVS, ENV_LABEL, equivUSvH, cumulativeMSv, boneLossPct } from './engine/environment';
import type { Escalation } from './engine/types';
import { useApp, evalLatest, stableStatus, type AiAssessment } from './store';
import { t } from './i18n';
import { useCheckin, doneToday, dayKey } from './checkin';
import { useFatigue } from './fatigue';
import { useScenario } from './scenario';

const API = import.meta.env.VITE_API_BASE ?? '';

/** Model için kompakt, kökenli anlık durum. Kişisel veri yok. */
export function buildSnapshot() {
  const s = useApp.getState();
  const e = ENVS[s.env];
  const now = Date.now();
  return {
    environment: ENV_LABEL[s.env].en, gravity_g: e.gravity_g, missionDay: s.missionDay, activity: s.activity,
    commDelayOneWaySec: e.commDelayOneWaySec,
    radiation: { absorbedUGyH: e.absorbedUGyH, equivalentUSvH: equivUSvH(e).value, cumulativeMSvEstimate: cumulativeMSv(e, s.missionDay), careerLimitMSv: 600 },
    boneLossPctEstimate: boneLossPct(e, s.missionDay),
    checkin: (() => {
      const c = useCheckin.getState();
      const rt = c.reaction[c.reaction.length - 1];
      const vl = c.voice[c.voice.length - 1];
      return {
        tasksDoneToday: doneToday(),
        lastReactionTest: rt ? { today: dayKey(rt.at) === dayKey(), medianMs: rt.medianMs, lapses: rt.lapses, falseStarts: rt.falseStarts } : null,
        lastVoiceLog: vl ? { today: dayKey(vl.at) === dayKey(), metrics: vl.metrics, cues: vl.cues.filter((x) => x.level !== 'none').map((x) => `${x.domain}:${x.level}`) } : null,
      };
    })(),
    fatigueCamera: (() => {
      const f = useFatigue.getState();
      return f.enabled && f.phase === 'running' ? { onDevice: true, perclos: f.perclos, blinkPerMin: f.blinkPerMin, yawns: f.yawns, visibleExpression: f.face ? f.expression : 'no face', longEyeClosureLast2min: !!(f.lastLongClosureAt && Date.now() - f.lastLongClosureAt < 120000), cueStatus: f.status, note: 'PERCLOS thresholds are assumptions; cue not diagnosis' } : null;
    })(),
    cabin: { o2Pct: +s.cabin.o2Pct.toFixed(1), pressurePsia: +s.cabin.pressurePsia.toFixed(2) },
    scenario: (() => {
      const sc = useScenario.getState();
      if (!sc.id) return null;
      const p = sc.replay?.series[sc.replay.idx];
      return {
        name: sc.id, note: 'Demo scenario: vitals are SIMULATED; radiation replays are real NASA measurements (time-compressed).',
        replay: p && sc.replay ? { utc: p.t, absorbedUGyH: p.v, baselineUGyH: +sc.replay.baseline.toFixed(2), multiple: +(p.v / sc.replay.baseline).toFixed(1), highLatitudeBin: p.hl, cumulative: `${sc.replay.doseSoFar.toFixed(3)} ${sc.replay.doseUnit.en}` } : null,
        suit: sc.suit, extraAlerts: sc.extra.map((x) => ({ id: x.id, status: x.status, value: x.value, label: x.label.en, actions: x.steps.map((st) => st.en), note: x.note?.en })),
      };
    })(),
    indicators: INDICATOR_ORDER.map((id) => {
      const ev = evalLatest(s.readings, id);
      const d = INDICATORS[id];
      const hist = s.readings[id].slice(-60).map((r) => r.value);
      return {
        id, value: +ev.reading.value.toFixed(d.decimals), unit: d.unit, status: ev.status, label: t(ev.labelKey, 'en'),
        provenance: ev.reading.provenance, minutesAgo: Math.round((now - ev.reading.t) / 60000), glucoseContext: ev.reading.ctx,
        recentMin: +Math.min(...hist).toFixed(d.decimals), recentMax: +Math.max(...hist).toFixed(d.decimals),
      };
    }),
  };
}

const RANK: Record<Escalation, number> = { self: 0, crew: 1, ground: 2 };
export const maxEsc = (a?: Escalation, b?: Escalation): Escalation => (RANK[a ?? 'self'] >= RANK[b ?? 'self'] ? a ?? 'self' : b ?? 'self');

/** Uyarı imzası değiştiğinde (gösterge+durum kümesi) AI değerlendirmesi ister; 1,5 sn debounce, uçuşta istek iptali. */
export function useAiAssessment() {
  const readings = useApp((s) => s.readings);
  const lang = useApp((s) => s.lang);
  const activity = useApp((s) => s.activity);
  const env = useApp((s) => s.env);
  const extraSig = useScenario((s) => s.extra.map((x) => `${x.id}:${x.status}`).join('|'));
  const sig = extraSig + '#' + INDICATOR_ORDER.map((id) => [id, stableStatus(readings, id)] as const).filter(([, s]) => s !== 'ok' && s !== 'unknown').map(([id, s]) => `${id}:${s}`).join('|') + `#${lang}#${activity}#${env}`;
  const ctrl = useRef<AbortController | null>(null);
  useEffect(() => {
    const st = useApp.getState();
    if (st.ai.signature === sig) return;
    const h = setTimeout(async () => {
      ctrl.current?.abort();
      const c = new AbortController(); ctrl.current = c;
      st.setAi({ status: 'loading', signature: sig });
      try {
        const r = await fetch(`${API}/api/assess`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ lang, snapshot: buildSnapshot() }), signal: c.signal });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const j = await r.json();
        useApp.getState().setAi({ status: 'ok', data: j.assessment as AiAssessment, at: Date.now(), latencyMs: j.latencyMs, model: j.model });
      } catch (e) {
        if ((e as Error).name !== 'AbortError') useApp.getState().setAi({ status: 'error', error: String(e) });
      }
    }, 1500);
    return () => clearTimeout(h);
  }, [sig, lang]);
}

/** VEGA: SSE akışı; her cümle tamamlandıkça onSentence çağrılır (hemen seslendirme için). */
export interface VegaAction { indicator: string; value: number; glucose_context?: 'fasting' | 'postprandial'; }
export async function askVega(text: string, history: { role: 'user' | 'assistant'; content: string }[], onDelta: (full: string) => void, onSentence: (s: string) => void, signal?: AbortSignal, image?: string | null, onAction?: (a: VegaAction) => void) {
  const { lang } = useApp.getState();
  const r = await fetch(`${API}/api/vega`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ lang, text, history, snapshot: buildSnapshot(), image: image ?? undefined }), signal });
  if (!r.ok || !r.body) throw new Error(`HTTP ${r.status}`);
  const reader = r.body.getReader();
  const dec = new TextDecoder();
  let buf = '', full = '', pending = '';
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let i;
    while ((i = buf.indexOf('\n\n')) >= 0) {
      const line = buf.slice(0, i).trim(); buf = buf.slice(i + 2);
      if (!line.startsWith('data: ')) continue;
      const data = line.slice(6);
      if (data === '[DONE]') continue;
      const d = JSON.parse(data);
      if (d.error) throw new Error(d.error);
      if (d.action) { onAction?.(d.action as VegaAction); continue; }
      full += d.t; pending += d.t; onDelta(full);
      // Cümle sınırı: . ! ? ; ve ardından boşluk
      const m = pending.match(/^([\s\S]*?[.!?;])\s+/);
      if (m) { onSentence(m[1].trim()); pending = pending.slice(m[0].length); }
    }
  }
  if (pending.trim()) onSentence(pending.trim());
  return full;
}
