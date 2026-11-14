// Taban yol: uygulama kök dizinde ("/") ya da alt dizinde ("/nasalytics/") yayınlanabilir.
// Derlemede NASA_BASE=/nasalytics/ verilir (vite.config.ts); geliştirmede "/" kalır. Tüm API, WebSocket ve dosya yolları buradan türetilir.
// AI notu: Claude (Anthropic) yardımıyla yazılmıştır.
export const BASE = import.meta.env.BASE_URL.replace(/\/$/, ''); // "" veya "/nasalytics"
export const API = import.meta.env.VITE_API_BASE ?? BASE;
export const WS_BASE = import.meta.env.VITE_WS_BASE ?? BASE;
export const asset = (p: string) => `${import.meta.env.BASE_URL}${p.replace(/^\//, '')}`;
