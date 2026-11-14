// HUD kabuğu (tasarım v2). Sabit yükseklikli ızgara, panel kaydırma çubuğu yok; hedef 1536×700 CSS px ve üstü.
// AI notu: Claude (Anthropic) yardımıyla yazılmıştır.
import { useEffect, useMemo } from 'react';
import Body3D, { type Callout } from './components/Body3D';
import { TopBar, VitalsPanel, EcgStrip, EntryForm } from './components/Hud';
import { AssessmentPanel, RegionPanel, CabinPanel, MissionPanel, TrendChart } from './components/Panels';
import { SessionGate, AlarmBanner, Vega } from './components/Ai';
import { RoutineReminder, CheckinModals } from './components/Checkin';
import { FatigueCam } from './components/FatigueCam';
import { ScenarioBanner } from './components/Scenario';
import { CrewView, CrewNotices } from './components/CrewView';
import { useTelemetry, startTelemetry } from './telemetry';

let telStarted = false;
import { useAiAssessment } from './ai';
import { useApp, regionStatuses, evalLatest } from './store';
import { worst } from './engine/indicators';
import { t } from './i18n';
import type { Layer } from './store';

export default function App() {
  const { lang, readings, selectedRegion, selectRegion, tick, layers, toggleLayer } = useApp();
  useEffect(() => { const id = setInterval(tick, 1000); return () => clearInterval(id); }, [tick]);
  useEffect(() => { document.documentElement.lang = lang; }, [lang]);
  // Düzen testi: ?test=worst tüm göstergeleri uç değerlere çeker (ekran taşması kontrolü için). &lang=en ile İngilizce.
  useEffect(() => {
    const q = new URLSearchParams(location.search);
    if (q.get('lang') === 'en') useApp.getState().setLang('en');
    if (q.has('test')) useApp.getState().startSession();
    if (q.get('test') !== 'worst') return;
    const add = useApp.getState().addReading;
    add('systolic', 182); add('diastolic', 121); add('heartRate', 159); add('spo2', 86); add('respRate', 28);
    add('bodyTemp', 39.7); add('glucose', 127, 'fasting'); add('sleepHours', 4.0); add('mood', 1); add('cabinCO2', 5.2);
  }, []);
  useEffect(() => { if (!telStarted) { telStarted = true; startTelemetry(); } }, []);
  const role = useTelemetry((s) => s.role);
  const statuses = useMemo(() => regionStatuses(readings), [readings]);
  useAiAssessment();

  const callouts: Callout[] = useMemo(() => {
    const e = (id: Parameters<typeof evalLatest>[1]) => evalLatest(readings, id);
    const hr = e('heartRate'), sys = e('systolic'), dia = e('diastolic'), spo2 = e('spo2'), rr = e('respRate'), glu = e('glucose'), sl = e('sleepHours'), md = e('mood');
    const f = (v: number, d = 0) => v.toFixed(d);
    return [
      { region: 'brain', title: lang === 'tr' ? 'Beyin · uyku / ruh hâli' : 'Brain · sleep / mood', value: `${f(sl.reading.value, 1)} h · ${f(md.reading.value)}/5`, status: worst(sl.status, md.status) },
      { region: 'heart', title: lang === 'tr' ? 'Kalp · nabız / KB' : 'Heart · HR / BP', value: `${f(hr.reading.value)} bpm · ${f(sys.reading.value)}/${f(dia.reading.value)}`, status: worst(hr.status, worst(sys.status, dia.status)) },
      { region: 'lungs', title: lang === 'tr' ? 'Akciğer · SpO₂ / solunum' : 'Lungs · SpO₂ / resp.', value: `${f(spo2.reading.value)}% · ${f(rr.reading.value)}/min`, status: worst(spo2.status, rr.status) },
      { region: 'metabolic', title: lang === 'tr' ? 'Metabolizma · glukoz' : 'Metabolism · glucose', value: `${f(glu.reading.value)} mg/dL`, status: glu.status },
    ];
  }, [readings, lang]);

  if (role !== 'astronaut') return (
    <div className="app viewer">
      <TopBar />
      <CrewView />
      <AlarmBanner />
      <SessionGate />
    </div>
  );
  return (
    <div className="app">
      <TopBar />
      <aside className="col-left"><VitalsPanel /><EcgStrip /><EntryForm /></aside>
      <main className="col-center">
        <div className="hud-frame" aria-hidden />
        <div className="layer-ctl" role="group" aria-label={t('ui.layers', lang)}>
          <span>{t('ui.layers', lang)}</span>
          {(['organs', 'skeleton', 'muscle'] as Layer[]).map((l) => (
            <button key={l} aria-pressed={layers[l]} className={layers[l] ? 'on' : ''} onClick={() => toggleLayer(l)}>{t(`layer.${l}`, lang)}</button>
          ))}
        </div>
        <Body3D statuses={statuses} selected={selectedRegion} onSelect={selectRegion} layers={layers} callouts={callouts} />
        <AlarmBanner />
        <ScenarioBanner />
        <CrewNotices />
        <FatigueCam />
        <div className="model-credit">3D: BodyParts3D/Z-Anatomy · CC BY-SA</div>
        <Vega />
      </main>
      <aside className="col-right"><AssessmentPanel /><RegionPanel /></aside>
      <footer className="row-bottom"><CabinPanel /><MissionPanel /><TrendChart /></footer>
      <CheckinModals />
      <RoutineReminder />
      <SessionGate />
    </div>
  );
}
