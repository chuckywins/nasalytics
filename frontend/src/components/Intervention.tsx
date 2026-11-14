// Müdahale paneli (CMO ve yer kontrol). Kartlar deterministik kütüphaneden gelir; AI yalnızca sıralar ve gerekçe yazar.
// Kural: belirtiler CMO tarafından işaretlenmeden ilaç adımları görünmez; "*" (kilitli) ilaçlar uçuş cerrahı onayı ister.
// Yer kontrol onaycıdır: onay gidiş-dönüş (2 × tek yön gecikme) sonra ulaşır. Onay bu prototipte YEREL durumdur (aktarılmaz).
// AI notu: Claude (Anthropic) yardımıyla yazılmıştır.
import { useEffect, useMemo, useRef, useState } from 'react';
import { useApp } from '../store';
import { t } from '../i18n';
import { PROTOCOLS, matchProtocols, type ProtocolId, type SnapLite } from '../engine/protocols';
import type { Packet, Role } from '../telemetry';
import { ProvTag } from './Hud';
import { SourceTags } from './Info';

const API = import.meta.env.VITE_API_BASE ?? '';
const fmt = (s: number) => (s < 60 ? `${Math.round(s)} s` : `${Math.floor(s / 60)} min ${String(Math.round(s % 60)).padStart(2, '0')} s`);

interface AiRank { ranked: { id: ProtocolId; why: string }[]; summary: string; escalate?: string; lang: string; at: number; ms?: number }

export function snapLite(p: Packet): SnapLite {
  const s = p.snap;
  return { activity: s.activity, gravity_g: s.gravity_g, indicators: s.indicators.map((x) => ({ id: x.id, value: x.value, status: x.status })), extra: (s.scenario?.extraAlerts ?? []).map((x) => ({ id: x.id, status: x.status })) };
}

export function InterventionPanel({ p, role }: { p: Packet; role: Role }) {
  const lang = useApp((s) => s.lang);
  const lite = useMemo(() => snapLite(p), [p]);
  const matched = matchProtocols(lite);
  const sig = `${p.crewId}|${matched.map((m) => m.id).join(',')}|${lite.indicators.filter((x) => x.status !== 'ok').map((x) => `${x.id}:${x.status}`).join(',')}|${lang}`;
  const [ai, setAi] = useState<AiRank | null>(null);
  const [aiErr, setAiErr] = useState('');
  const [confirmed, setConfirmed] = useState<Record<string, boolean[]>>({});
  const [approved, setApproved] = useState<Record<string, number>>({});
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const h = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(h); }, []);
  const ctrl = useRef<AbortController | null>(null);

  // AI sıralaması: durum imzası değişince (2 sn'lik her pakette değil), 2 sn debounce
  useEffect(() => {
    if (!matched.length) { setAi(null); return; }
    const h = setTimeout(async () => {
      ctrl.current?.abort(); const c = new AbortController(); ctrl.current = c;
      try {
        const r = await fetch(`${API}/api/interventions`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: c.signal,
          body: JSON.stringify({ lang, role, snapshot: p.snap, candidates: matched.map((m) => m.id), library: Object.values(PROTOCOLS).map((x) => ({ id: x.id, title: x.title.en, escalate: x.escalate })) }) });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const j = await r.json();
        setAi({ ...j.result, lang, at: Date.now(), ms: j.latencyMs }); setAiErr('');
      } catch (e) { if ((e as Error).name !== 'AbortError') setAiErr(String(e)); }
    }, 2000);
    return () => clearTimeout(h);
  }, [sig]); // eslint-disable-line react-hooks/exhaustive-deps

  // Kart sırası: AI sıraladıysa onun sırası (yalnız geçerli kimlikler; deterministik adaylar ASLA düşmez), yoksa eşleştirici sırası
  const order: ProtocolId[] = [];
  for (const r of ai?.ranked ?? []) if (PROTOCOLS[r.id] && !order.includes(r.id)) order.push(r.id);
  for (const m of matched) if (!order.includes(m.id)) order.push(m.id);
  const oneWay = (p.snap.commDelayOneWaySec?.[0] ?? 0);
  const roundTrip = 2 * oneWay;

  return (
    <div className="intv">
      <div className="intv-h">
        <b>{t('iv.title', lang)} · {p.crewId}</b>
        <span className="muted small">{role === 'ground' ? t('iv.groundRole', lang) : t('iv.cmoRole', lang)}</span>
      </div>
      {order.length === 0 ? <p className="muted">{t('iv.none', lang)}</p> : (<>
        {ai && <div className="intv-ai small"><span className="ai-tag">✦ AI</span> {ai.summary} <span className="muted">· {t('iv.aiRole', lang)}</span></div>}
        {aiErr && <div className="muted small">{t('iv.aiOffline', lang)}</div>}
        {order.map((id) => {
          const pr = PROTOCOLS[id];
          const why = ai?.ranked.find((r) => r.id === id)?.why;
          const reason = matched.find((m) => m.id === id)?.reason[lang];
          const conf = confirmed[`${p.crewId}:${id}`] ?? pr.confirm.map(() => false);
          const anyConf = conf.some(Boolean);
          const apprAt = approved[`${p.crewId}:${id}`];
          const apprArrives = apprAt ? apprAt + roundTrip * 1000 : 0;
          const apprOk = apprAt && now >= apprArrives;
          const zeroG = p.snap.gravity_g < 0.05;
          return (
            <div key={id} className="intv-card">
              <div className="intv-ch">
                <b>{pr.title[lang]}</b>
                <span className={`esc esc-${pr.escalate}`}>{t(`esc.${pr.escalate}`, lang)}</span>
              </div>
              <div className="muted small">{t('iv.candidate', lang)}{reason ? ` · ${reason}` : ''}</div>
              {why && <div className="small"><span className="ai-tag">✦ AI</span> {why}</div>}
              {pr.note && <p className="small muted">{pr.note[lang]}</p>}
              <div className="intv-conf">
                <span className="small">{t('iv.confirm', lang)}:</span>
                {pr.confirm.map((c, i) => (
                  <label key={i} className="small"><input type="checkbox" checked={conf[i]} onChange={(e) => setConfirmed((s) => ({ ...s, [`${p.crewId}:${id}`]: conf.map((v, j) => (j === i ? e.target.checked : v)) }))} /> {c[lang]}</label>
                ))}
              </div>
              <ol className="steps">
                {pr.steps.filter((st) => !st.gravity || (st.gravity === 'zeroG') === zeroG).map((st, i) => {
                  if (st.medical && !anyConf) return <li key={i} className="muted small">{t('iv.hiddenUntil', lang)}</li>;
                  return (
                    <li key={i}>{st.text[lang]}
                      {st.drug && (
                        <div className={`intv-drug ${st.drug.locked ? 'locked' : ''}`}>
                          <code>{st.drug.verbatim}</code> <code>{st.drug.dose}</code>
                          <span className="muted small"> · {t('iv.verbatim', lang)}</span>
                          {st.drug.locked && <div className="intv-lock">🔒 {t('iv.locked', lang)}{apprOk ? ` · ✓ ${t('iv.approved', lang)}` : apprAt ? ` · ${t('iv.approvalInTransit', lang)} ${fmt((apprArrives - now) / 1000)}` : ''}</div>}
                          {st.drug.warning && <div className="intv-warn small">⚠ {st.drug.warning}</div>}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ol>
              {role === 'ground' && pr.steps.some((s) => s.drug?.locked) && (
                <div className="intv-appr">
                  <button disabled={!!apprAt} onClick={() => setApproved((s) => ({ ...s, [`${p.crewId}:${id}`]: Date.now() }))}>{t('iv.approve', lang)}</button>
                  <span className="muted small">{t('iv.roundTrip', lang)}: {fmt(roundTrip)} · {t('iv.localOnly', lang)}</span>
                </div>
              )}
              <div className="intv-src"><ProvTag p={pr.kind === 'NASA_CHECKLIST' ? 'PUBLISHED' : 'CLINICAL_GUIDELINE'} /><SourceTags sources={[pr.source]} max={1} /></div>
              {pr.kind === 'NASA_CHECKLIST' && <div className="muted small">{t('iv.shuttleNote', lang)}</div>}
            </div>
          );
        })}
      </>)}
    </div>
  );
}
