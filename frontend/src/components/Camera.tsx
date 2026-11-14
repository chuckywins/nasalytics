// Kamera girdisi (yarışma metni: "camera images ... blood sugar levels in mg/dL or ultrasound images").
// Mod 1 "Cihaz": ölçüm cihazı ekranı → Claude Sonnet okur → astronot ONAYLAR → kaydedilir (köken: KAMERA+AI).
// Mod 2 "Ultrason": tarafsız görsel gözlem; teşhis yok, CMO/uçuş cerrahına yönlendirme.
// Gizlilik: görüntü yalnızca "Yakala" ile, tek kare olarak gönderilir; saklanmaz. Kamera reddedilirse dosya yükleme çalışır.
// AI notu: Claude (Anthropic) yardımıyla yazılmıştır.
import { useEffect, useRef, useState } from 'react';
import { API } from '../base';
import { createPortal } from 'react-dom';
import { INDICATORS } from '../engine/indicators';
import type { GlucoseCtx, IndicatorId } from '../engine/types';
import { useApp } from '../store';
import { t } from '../i18n';

type Mode = 'device' | 'ultrasound';
interface Result { kind: string; device?: string; readings: { indicator: IndicatorId; value: number; unit: string }[]; observations?: string[]; legible: boolean; note: string; }

async function toDataUrl(src: HTMLVideoElement | HTMLImageElement, w: number, h: number) {
  const scale = Math.min(1, 1024 / Math.max(w, h));
  const c = document.createElement('canvas'); c.width = Math.round(w * scale); c.height = Math.round(h * scale);
  c.getContext('2d')!.drawImage(src, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', 0.85);
}

export function CameraButton() {
  const lang = useApp((s) => s.lang);
  const [open, setOpen] = useState(false);
  return (<>
    <button type="button" className="cam-btn" onClick={() => setOpen(true)} title={t('cam.title', lang)}>◉ {t('cam.button', lang)}</button>
    {open && createPortal(<CameraModal onClose={() => setOpen(false)} />, document.body)}
  </>);
}

function CameraModal({ onClose }: { onClose: () => void }) {
  const { lang, addReading } = useApp();
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const [mode, setMode] = useState<Mode>('device');
  const [camErr, setCamErr] = useState('');
  const [shot, setShot] = useState<string>('');
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<Result | null>(null);
  const [err, setErr] = useState('');
  const [keep, setKeep] = useState<Record<number, boolean>>({});
  const [ctx, setCtx] = useState<GlucoseCtx>('fasting');

  useEffect(() => {
    navigator.mediaDevices?.getUserMedia({ video: { width: 1280, height: 720 } })
      .then((s) => { stream.current = s; if (video.current) { video.current.srcObject = s; void video.current.play(); } })
      .catch(() => setCamErr(t('cam.denied', lang)));
    return () => stream.current?.getTracks().forEach((tr) => tr.stop());
  }, [lang]);

  const analyze = async (dataUrl: string) => {
    setShot(dataUrl); setBusy(true); setErr(''); setRes(null);
    try {
      const r = await fetch(`${API}/api/vision`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ lang, mode, image: dataUrl }) });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const j = await r.json();
      setRes(j.result); setKeep(Object.fromEntries((j.result.readings ?? []).map((_: unknown, i: number) => [i, true])));
    } catch { setErr(t('ai.offline', lang)); } finally { setBusy(false); }
  };
  const capture = async () => { const v = video.current; if (v && v.videoWidth) await analyze(await toDataUrl(v, v.videoWidth, v.videoHeight)); };
  const upload = (f: File) => {
    const img = new Image();
    img.onload = async () => { await analyze(await toDataUrl(img, img.naturalWidth, img.naturalHeight)); URL.revokeObjectURL(img.src); };
    img.src = URL.createObjectURL(f);
  };
  const save = () => {
    res?.readings.forEach((r, i) => {
      const d = INDICATORS[r.indicator];
      if (!keep[i] || !d || r.value < d.sim.min || r.value > d.sim.max) return;
      addReading(r.indicator, r.value, r.indicator === 'glucose' ? ctx : undefined, 'CAMERA');
    });
    onClose();
  };
  const valid = (r: Result['readings'][number]) => { const d = INDICATORS[r.indicator]; return !!d && r.value >= d.sim.min && r.value <= d.sim.max; };

  return (
    <div className="gate" role="dialog" aria-modal="true" aria-label={t('cam.title', lang)} onKeyDown={(e) => e.key === 'Escape' && onClose()}>
      <div className="cam-box">
        <header className="panel-h"><span>{t('cam.title', lang)}</span><button className="x" onClick={onClose} aria-label="close">×</button></header>
        <div className="seg" role="group">
          {(['device', 'ultrasound'] as Mode[]).map((m) => <button key={m} className={mode === m ? 'on' : ''} aria-pressed={mode === m} onClick={() => { setMode(m); setRes(null); setShot(''); }}>{t(`cam.${m}`, lang)}</button>)}
        </div>
        <div className="cam-view">
          {shot ? <img src={shot} alt="" /> : camErr ? <p className="muted">{camErr}</p> : <video ref={video} playsInline muted />}
          {mode === 'device' && !shot && !camErr && <div className="cam-guide" aria-hidden />}
        </div>
        <p className="muted small">{t('cam.privacy', lang)}</p>
        <div className="cam-actions">
          {!shot && !camErr && <button className="primary" onClick={capture} disabled={busy}>◉ {t('cam.capture', lang)}</button>}
          {shot && <button onClick={() => { setShot(''); setRes(null); }}>{t('cam.retake', lang)}</button>}
          <label className="file">{t('cam.upload', lang)}<input type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} /></label>
        </div>
        {busy && <p className="ai-busy">{t('ai.thinking', lang)}</p>}
        {err && <p className="j-err">{err}</p>}
        {res && (
          <div className="cam-res">
            <p><span className="ai-tag">✦ AI · Claude Sonnet 5.5</span> {res.device && res.device !== 'unknown' ? `· ${res.device}` : ''}</p>
            {!res.legible && <p className="j-err">{t('cam.illegible', lang)}</p>}
            {res.readings.map((r, i) => (
              <label key={i} className="cam-read">
                <input type="checkbox" checked={!!keep[i] && valid(r)} disabled={!valid(r)} onChange={(e) => setKeep({ ...keep, [i]: e.target.checked })} />
                {t(`ind.${r.indicator}`, lang)}: <b className="num">{r.value} {r.unit}</b>{!valid(r) && <span className="j-err"> · {t('cam.outOfRange', lang)}</span>}
              </label>
            ))}
            {res.readings.some((r) => r.indicator === 'glucose') && (
              <div className="seg" role="group">{(['fasting', 'postprandial'] as GlucoseCtx[]).map((c) => <button key={c} className={ctx === c ? 'on' : ''} aria-pressed={ctx === c} onClick={() => setCtx(c)}>{t(`ui.${c}`, lang)}</button>)}</div>
            )}
            {res.observations && res.observations.length > 0 && <ul className="steps">{res.observations.map((o, i) => <li key={i}>{o}</li>)}</ul>}
            <p>{res.note}</p>
            <p className="ai-foot">{t('cam.disclaimer', lang)}</p>
            {res.readings.length > 0 && <button className="primary" onClick={save}>{t('cam.confirm', lang)}</button>}
          </div>
        )}
      </div>
    </div>
  );
}
