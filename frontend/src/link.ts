// Yer bağlantısı kesintisi (LOS, loss of signal) gösterimi. Astronot cihazında elle açılır (demo).
// LOS sırasında: gemi içi (astronot + CMO) canlı sürer; yer kontrol yeni veri almaz, veri gemide tutulur ve bağlantı
// gelince sırasıyla aktarılır. Bulut AI'ye erişim de yer bağlantısına bağlı varsayılır → AI çağrıları yapılmaz,
// deterministik kural motoru ve kaynaklı kartlar çalışmaya devam eder.
// AI notu: Claude (Anthropic) yardımıyla yazılmıştır.
import { create } from 'zustand';

interface LinkState { down: boolean; since: number | null; toggle: () => void }
export const useLink = create<LinkState>((set) => ({
  down: false, since: null,
  toggle: () => set((s) => (s.down ? { down: false, since: null } : { down: true, since: Date.now() })),
}));
export const linkDown = () => useLink.getState().down;
