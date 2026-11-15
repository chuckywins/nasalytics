// Görünüm (astronot / CMO / yer kontrol) ve astronot kimliği seçici. AI notu: Claude (Anthropic) yardımıyla yazılmıştır.
import { useApp } from '../store';
import { t } from '../i18n';
import { useTelemetry } from '../telemetry';
import { ROSTER } from '../crew';

export function RoleSelect() {
  const lang = useApp((s) => s.lang);
  const { role, setRole, crewId, setCrewId } = useTelemetry();
  return (
    <div className="role-sel">
      <select value={role} onChange={(e) => setRole(e.target.value as typeof role)} aria-label={t('view.role', lang)}>
        <option value="astronaut">{t('view.astronaut', lang)}</option>
        <option value="cmo">{t('view.cmo', lang)}</option>
        <option value="ground">{t('view.ground', lang)}</option>
      </select>
      <select value={crewId} onChange={(e) => setCrewId(e.target.value)} aria-label="crew id">
        {ROSTER.map((c) => <option key={c.id} value={c.id}>{c.id} · {c.rec.name}</option>)}
      </select>
    </div>
  );
}
