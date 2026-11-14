import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// /ws → canlı telemetri aktarımı (ekip laptopları arasında; host: true ile aynı ağdan erişilir)
// /api → FastAPI Claude proxy (backend/server.py, 127.0.0.1:8790). API anahtarı tarayıcıya hiç gelmez.
// Alt dizin yayını: NASA_BASE=/nasalytics/ npm run build (varsayılan "/")
export default defineConfig(({ mode }) => ({
  base: loadEnv(mode, '.', '').NASA_BASE || '/',
  plugins: [react()],
  server: { host: true, proxy: { '/api': 'http://127.0.0.1:8790', '/ws': { target: 'ws://127.0.0.1:8790', ws: true } } },
  preview: { host: true, proxy: { '/api': 'http://127.0.0.1:8790', '/ws': { target: 'ws://127.0.0.1:8790', ws: true } } },
}))
