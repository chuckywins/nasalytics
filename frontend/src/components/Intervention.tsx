// Müdahale paneli (CMO ve yer kontrol). Kartlar deterministik, kaynaklı kütüphaneden gelir.
// AI REÇETE ÖNERİR ama yalnızca kütüphane KİMLİĞİYLE: ekrandaki ilaç adı, doz ve sayfa kaynaktan (sayı modelden geçmez).
// Kütüphane dışı öneri: yalnızca ilaç/sınıf adı, "miktar uçuş cerrahına göre", ayrı ve "kaynaksız" etiketli blok.
// Yer kontrol onaycıdır: onay astronota tek yön gecikmeyle ulaşır (yerel durum, CMO ekranına aktarılmaz).
// AI notu: Claude (Anthropic) yardımıyla yazılmıştır.
import { useEffect, useMemo, useRef, useState } from 'react';
import { API } from '../base';
import { useApp } from '../store';
import { t } from '../i18n';
import { PROTOCOLS, allDrugs, matchProtocols, ISS_KIT, KIT_BY_ID, type ProtocolId, type SnapLite } from '../engine/protocols';
import type { Packet, Role } from '../telemetry';
import { ProvTag } from './Hud';
import { SourceTags } from './Info';

const fmt = (s: number) => (s < 60 ? `${Math.round(s)} s` : `${Math.floor(s / 60)} min ${String(Math.round(s % 60)).padStart(2, '0')} s`);
const DRUGS = allDrugs();

interface AiPlanItem { drugId?: string; protocol?: ProtocolId; why: string }
interface AiRank { ranked: { id: ProtocolId; why: string }[]; plan: AiPlanItem[]; offFormulary: { name: string; why: string; kitId?: string | null }[]; summary: string; at: number }

export function snapLite(p: Packet): SnapLite {
  const s = p.snap;
  return { activity: s.activity, gravity_g: s.gravity_g, cabinPsia: s.cabin?.pressurePsia, indicators: s.indicators.map((x) => ({ id: x.id, value: x.value, status: x.status })), extra: (s.scenario?.extraAlerts ?? []).map((x) => ({ id: x.id, status: x.status })), symptoms: (s.reportedSymptoms ?? []).map((x) => ({ category: x.category, quote: x.quote })) };
}

function libraryForAi() {
  return Object.values(PROTOCOLS).map((p) => ({
    id: p.id, title: p.title.en, escalate: p.escalate, signs: p.confirm.map((c) => c.en),
    drugs: p.steps.filter((s) => s.drug).map((s) => ({ id: s.drug!.id, name: s.drug!.verbatim, dose: s.drug!.dose ?? '', locked: s.drug!.locked, condition: s.cond?.en ?? '' })),
  }));
}

function DrugLine({ id, lang }: { id: string; lang: 'tr' | 'en' }) {
  const d = DRUGS[id];
  if (!d) return null;
  const pr = PROTOCOLS[d.protocol];
  return (
    <div className={`intv-drug ${d.drug.locked ? 'locked' : ''}`}>
      <code>{d.drug.verbatim}</code>{d.drug.dose && <> <code>{d.drug.dose}</code></>}
      <span className="muted small"> · {pr.source.page}</span>
      {d.drug.locked && <div className="intv-lock">🔒 {t(pr.kind === 'NASA_ISS' ? 'iv.lockedIss' : 'iv.locked', lang)}</div>}
      {d.drug.warning && <div className="intv-warn small">⚠ {d.drug.warning}</div>}
    </div>
  );
}

export function InterventionPanel({ p, role, compress }: { p: Packet; role: Role; compress: boolean }) {
  const lang = useApp((s) => s.lang);
  const lite = useMemo(() => snapLite(p), [p]);
  const fresh = matchProtocols(lite);
  // Sabitleme: eşikte salınan değer kartı aç-kapa yapmasın → eşleşen kart 60 sn ekranda kalır
  const latch = useRef<Record<string, { at: number; m: (typeof fresh)[number] }>>({});
  const nowMs = Date.now();
  const scenKey = p.ui.scenario?.title.en ?? '';
  const lastScen = useRef<Record<string, string>>({});
  if (lastScen.current[p.crewId] !== undefined && lastScen.current[p.crewId] !== scenKey) for (const k of Object.keys(latch.current)) if (k.startsWith(`${p.crewId}:`)) delete latch.current[k];
  lastScen.current[p.crewId] = scenKey;
  for (const m of fresh) latch.current[`${p.crewId}:${m.id}`] = { at: nowMs, m };
  const matched = Object.entries(latch.current).filter(([k, v]) => k.startsWith(`${p.crewId}:`) && nowMs - v.at < 60_000).map(([, v]) => v.m);
  const [symptoms, setSymptoms] = useState('');
  const [sentSymptoms, setSentSymptoms] = useState('');
  const [confirmed, setConfirmed] = useState<Record<string, boolean[]>>({});
  const ticked = Object.entries(confirmed).filter(([k]) => k.startsWith(`${p.crewId}:`)).flatMap(([k, arr]) => { const pid = k.split(':')[1] as ProtocolId; return arr.map((b, i) => (b ? PROTOCOLS[pid].confirm[i].en : '')).filter(Boolean); });
  const reported = p.snap.reportedSymptoms ?? [];
  const sig = `${p.crewId}|${matched.map((m) => m.id).sort().join(',')}|${sentSymptoms}|${ticked.join(',')}|${reported.map((x) => x.id).join(',')}|${lang}`;
  const [ai, setAi] = useState<AiRank | null>(null);
  const [aiErr, setAiErr] = useState('');
  const [approved, setApproved] = useState<Record<string, number>>({});
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const h = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(h); }, []);
  const ctrl = useRef<AbortController | null>(null);

  // AI: durum imzası değişince (kart kümesi, belirtiler), 2 sn debounce
  useEffect(() => {
    if (!matched.length && !sentSymptoms && !ticked.length && !reported.length) { setAi(null); return; }
    const h = setTimeout(async () => {
      ctrl.current?.abort(); const c = new AbortController(); ctrl.current = c;
      try {
        const r = await fetch(`${API}/api/interventions`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: c.signal,
          body: JSON.stringify({ lang, role, snapshot: p.snap, candidates: matched.map((m) => m.id), symptoms: sentSymptoms, reported: reported.map((x) => ({ category: x.category, quote: x.quote, minutesAgo: x.minutesAgo })), confirmedSigns: ticked, library: libraryForAi(), kit: ISS_KIT.map((k) => ({ id: k.id, name: k.name, route: k.route })) }) });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const j = await r.json();
        setAi({ ...j.result, at: Date.now() }); setAiErr('');
      } catch (e) { if ((e as Error).name !== 'AbortError') setAiErr(String(e)); }
    }, 2000);
    return () => clearTimeout(h);
  }, [sig]); // eslint-disable-line react-hooks/exhaustive-deps

  // Kart sırası: AI'nin eklediği/sıraladığı geçerli kimlikler; deterministik adaylar asla düşmez
  const order: ProtocolId[] = [];
  for (const r of ai?.ranked ?? []) if (PROTOCOLS[r.id] && !order.includes(r.id)) order.push(r.id);
  for (const m of matched) if (!order.includes(m.id)) order.push(m.id);
  // Yer ekranı zaten gecikmeli veriyi görür → onayın astronota ulaşması TEK YÖN gecikme (÷60 seçiliyse o da)
  const oneWay = (p.snap.commDelayOneWaySec?.[0] ?? 0) / (compress ? 60 : 1);
  const ground = role === 'ground';
  const zeroG = p.snap.gravity_g < 0.05;

  return (
    <div className="intv">
      <div className="intv-h">
        <b>{t('iv.title', lang)} · {p.crewId}</b>
        <span className="muted small">{ground ? t('iv.groundRole', lang) : t('iv.cmoRole', lang)}</span>
      </div>
      {!ground && (
        <form className="intv-sym" onSubmit={(e) => { e.preventDefault(); setSentSymptoms(symptoms.trim()); }}>
          <input value={symptoms} onChange={(e) => setSymptoms(e.target.value)} placeholder={t('iv.symptomsPh', lang)} aria-label={t('iv.symptomsPh', lang)} />
          <button type="submit">{t('iv.analyze', lang)}</button>
        </form>
      )}
      {reported.length > 0 && <div className="intv-reported"><b>🔔 {t('iv.reported', lang)}</b>{reported.slice().reverse().map((x) => <div key={x.id} className="small">“{x.quote}” <span className="muted">· {t(`sym.${x.category}`, lang)} · {x.minutesAgo} {t('iv.minAgo', lang)}{x.source === 'scenario' ? ` · ${t('scen.tag', lang)}` : ''}</span></div>)}</div>}
      {(p.snap.commDelayOneWaySec?.[0] ?? 0) >= 60 && <div className="intv-auto small">⏱ {t('iv.autonomy', lang)} <a href="https://www.nasa.gov/wp-content/uploads/2023/07/ochmo-tb-033-spaceflight-experience-medical-care-rev-c.pdf" target="_blank" rel="noreferrer">OCHMO-TB-033 ↗</a></div>}
      {aiErr && <div className="muted small">{t('iv.aiOffline', lang)}</div>}
      {ai && (ai.summary || ai.plan.length > 0) && (
        <div className="intv-rx">
          <div className="intv-rx-h"><span className="ai-tag">✦ AI</span> <b>{t('iv.rxTitle', lang)}</b></div>
          {ai.summary && <p className="small">{ai.summary}</p>}
          <ol className="steps">
            {ai.plan.map((it, i) => (
              <li key={i}>
                {it.drugId && DRUGS[it.drugId] ? <><b>{DRUGS[it.drugId].cond ? `${DRUGS[it.drugId].cond![lang]}: ` : ''}</b><DrugLine id={it.drugId} lang={lang} /></> : it.protocol && PROTOCOLS[it.protocol] ? <b>{PROTOCOLS[it.protocol].title[lang]}</b> : null}
                {it.why && <div className="small muted">{it.why}</div>}
              </li>
            ))}
          </ol>
          {ai.offFormulary.length > 0 && (
            <div className="intv-off">
              <div className="small"><b>{t('iv.offTitle', lang)}</b></div>
              <ul className="small">{ai.offFormulary.map((o, i) => { const k = o.kitId ? KIT_BY_ID[o.kitId] : undefined; return (
                <li key={i}>{k ? <><b>{k.name}</b> <span className="tag-kit">{t('iv.kitTag', lang)}</span> <span className="muted">· {k.strength} {k.route} ({t('iv.kitStrength', lang)}) · {k.pack}{k.comment ? ` · “${k.comment}”` : ''}</span></> : <><b>{o.name}</b> <span className="tag-unverified">{t('iv.offTag', lang)}</span></>} · {t('iv.amountBySurgeon', lang)}{o.why ? ` — ${o.why}` : ''}</li>); })}</ul>
            </div>
          )}
          <div className="muted small">{t('iv.rxNote', lang)}</div>
        </div>
      )}
      {order.length === 0 && !ai ? <p className="muted">{t('iv.none', lang)}</p> : order.map((id) => {
        const pr = PROTOCOLS[id];
        const why = ai?.ranked.find((r) => r.id === id)?.why;
        const reason = matched.find((m) => m.id === id)?.reason[lang];
        const conf = confirmed[`${p.crewId}:${id}`] ?? pr.confirm.map(() => false);
        const apprAt = approved[`${p.crewId}:${id}`];
        const apprArrives = apprAt ? apprAt + oneWay * 1000 : 0;
        const apprOk = apprAt && now >= apprArrives;
        return (
          <div key={id} className="intv-card">
            <div className="intv-ch">
              <b>{pr.title[lang]}</b>
              <span className={`esc esc-${pr.escalate}`}>{t(`esc.${pr.escalate}`, lang)}</span>
            </div>
            <div className="muted small">{reason ? `${t('iv.candidate', lang)} · ${reason}` : t('iv.aiAdded', lang)}</div>
            {why && <div className="small"><span className="ai-tag">✦ AI</span> {why}</div>}
            {pr.note && <p className="small muted">{pr.note[lang]}</p>}
            {!ground ? (
              <div className="intv-conf">
                <span className="small">{t('iv.confirm', lang)}:</span>
                {pr.confirm.map((c, i) => (
                  <label key={i} className="small"><input type="checkbox" checked={conf[i]} onChange={(e) => setConfirmed((s) => ({ ...s, [`${p.crewId}:${id}`]: conf.map((v, j) => (j === i ? e.target.checked : v)) }))} /> {c[lang]}</label>
                ))}
              </div>
            ) : <div className="muted small">{t('iv.groundReadOnly', lang)}</div>}
            <ol className="steps">
              {pr.steps.filter((st) => !st.gravity || (st.gravity === 'zeroG') === zeroG).map((st, i) => (
                <li key={i}>{st.cond && <b className="intv-cond">{st.cond[lang]}: </b>}{st.text[lang]}
                  {st.drug && <DrugLine id={st.drug.id} lang={lang} />}
                </li>
              ))}
            </ol>
            {ground && (
              <div className="intv-appr">
                <button disabled={!!apprAt} onClick={() => setApproved((s) => ({ ...s, [`${p.crewId}:${id}`]: Date.now() }))}>{t(pr.steps.some((x) => x.drug?.locked) ? 'iv.approve' : 'iv.concur', lang)}</button>
                <span className="muted small">{apprAt ? (apprOk ? `✓ ${t('iv.reached', lang)}` : `${t('iv.toAstronaut', lang)} ${fmt((apprArrives - now) / 1000)}`) : `${t('iv.oneWay', lang)}: ${fmt(oneWay)}${compress ? ' (÷60)' : ''}`} · {t('iv.localOnly', lang)}</span>
              </div>
            )}
            {!ground && pr.steps.some((x) => x.drug?.locked) && <div className="muted small">{t('iv.cmoNoApproval', lang)}</div>}
            <div className="intv-src"><ProvTag p={pr.kind === 'CLINICAL_GUIDELINE' ? 'CLINICAL_GUIDELINE' : 'PUBLISHED'} /><SourceTags sources={[pr.source]} max={1} /></div>
            {pr.kind !== 'CLINICAL_GUIDELINE' && <div className="muted small">{t(pr.kind === 'NASA_ISS' ? 'iv.issNote' : 'iv.shuttleNote', lang)}</div>}
          </div>
        );
      })}
    </div>
  );
}
