// Köşedeki canlı kamera: yorgunluk ipuçları (göz kırpma, PERCLOS, uzun kapanma, esneme, görünen ifade).
// Sayfa açılınca başlar (kullanıcı kapatabilir; tercih hatırlanır). Tüm işlem CİHAZDA; kare gönderilmez.
// AI notu: Claude (Anthropic) yardımıyla yazılmıştır.
import { useEffect, useRef } from 'react';
import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';
import { useFatigue, FatigueAnalyzer } from '../fatigue';
import { useApp } from '../store';
import { t } from '../i18n';
import { STATUS_COLOR, STATUS_GLYPH } from './Hud';
import { InfoTip } from './Info';

async function createLandmarker() {
  const fileset = await FilesetResolver.forVisionTasks('/mediapipe');
  const opts = (delegate: 'GPU' | 'CPU') => ({
    baseOptions: { modelAssetPath: '/models/face_landmarker.task', delegate },
    runningMode: 'VIDEO' as const, numFaces: 1, outputFaceBlendshapes: true,
  });
  try { return await FaceLandmarker.createFromOptions(fileset, opts('GPU')); }
  catch { return await FaceLandmarker.createFromOptions(fileset, opts('CPU')); }
}

export function FatigueCam() {
  const lang = useApp((s) => s.lang);
  const f = useFatigue();
  const video = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (!f.enabled) { useFatigue.setState({ phase: 'off', face: false, status: 'unknown', perclos: null, blinkPerMin: null }); return; }
    let stream: MediaStream | null = null, lm: FaceLandmarker | null = null, raf = 0, alive = true, last = 0;
    const an = new FatigueAnalyzer();
    useFatigue.setState({ phase: 'loading' });
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480, facingMode: 'user' }, audio: false });
      } catch { if (alive) useFatigue.setState({ phase: 'nocam' }); return; }
      if (!alive || !video.current) { stream.getTracks().forEach((tr) => tr.stop()); return; }
      video.current.srcObject = stream; await video.current.play().catch(() => undefined);
      try { lm = await createLandmarker(); } catch { if (alive) useFatigue.setState({ phase: 'error' }); return; }
      if (!alive) { lm.close(); return; }
      useFatigue.setState({ phase: 'calibrating' });
      const loop = () => {
        if (!alive) return;
        const now = performance.now();
        const v = video.current;
        if (v && v.readyState >= 2 && now - last >= 66) { // ~15 kare/sn
          last = now;
          const res = lm!.detectForVideo(v, now);
          const cats = res.faceBlendshapes?.[0]?.categories;
          an.push(now, cats ? Object.fromEntries(cats.map((c) => [c.categoryName, c.score])) : null);
        }
        raf = requestAnimationFrame(loop);
      };
      loop();
    })();
    return () => { alive = false; cancelAnimationFrame(raf); stream?.getTracks().forEach((tr) => tr.stop()); lm?.close(); };
  }, [f.enabled]);

  const s = f.status;
  const col = s === 'unknown' ? '#6e7681' : STATUS_COLOR[s];
  return (
    <div className={`fcam ${f.enabled ? '' : 'off'}`} aria-label={t('fc.title', lang)}>
      <div className="fcam-h">
        <span>{t('fc.title', lang)} <InfoTip k="fatigueCam" /></span>
        <button className="fcam-tg" aria-pressed={f.enabled} onClick={() => f.setEnabled(!f.enabled)} title={f.enabled ? t('fc.off', lang) : t('fc.on', lang)}>{f.enabled ? '● ' + t('fc.offShort', lang) : '○ ' + t('fc.onShort', lang)}</button>
      </div>
      {f.enabled && (
        <div className="fcam-v">
          <video ref={video} playsInline muted />
          {f.phase === 'running' || f.phase === 'calibrating' ? (
            <div className="fcam-o">
              {!f.face && <span className="fcam-warn">{t('fc.noFace', lang)}</span>}
              {f.face && f.eyesClosed && <span className="fcam-warn">{t('fc.eyesClosed', lang)}</span>}
            </div>
          ) : <div className="fcam-o center"><span>{t(`fc.${f.phase}`, lang)}</span></div>}
        </div>
      )}
      {f.enabled && (
        <div className="fcam-m num">
          <span>{t('fc.blink', lang)} <b>{f.blinkPerMin != null ? f.blinkPerMin.toFixed(0) : '–'}</b>/{t('ui.min', lang)}</span>
          <span>PERCLOS <b>{f.perclos != null ? `%${(f.perclos * 100).toFixed(0)}` : '…'}</b></span>
          <span>{t('fc.yawn', lang)} <b>{f.yawns}</b></span>
        </div>
      )}
      {f.enabled && f.phase !== 'nocam' && f.phase !== 'error' && (
        <div className="fcam-s">
          <span style={{ color: col }}>{STATUS_GLYPH[s]} {t(`fc.st.${s}`, lang)}</span>
          {f.face && f.expression !== 'none' && <span className="muted">{t('fc.expr', lang)}: {t(`fc.ex.${f.expression}`, lang)}</span>}
        </div>
      )}
    </div>
  );
}
