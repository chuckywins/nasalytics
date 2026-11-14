import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// /api → FastAPI Claude proxy (backend/server.py, 127.0.0.1:8790). API anahtarı tarayıcıya hiç gelmez.
export default defineConfig({
  plugins: [react()],
  server: { proxy: { '/api': 'http://127.0.0.1:8790' } },
  preview: { proxy: { '/api': 'http://127.0.0.1:8790' } },
})
