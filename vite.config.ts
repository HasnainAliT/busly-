import react from '@vitejs/plugin-react'
import path from 'node:path'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react()],
  // `npm run dev:all` starts the API on 8787. Without it /api/health fails and the app falls back to the in-browser demo backend.
  server: { proxy: { '/api': { target: 'http://localhost:8787', changeOrigin: false } } },
  resolve: { alias: { '@': path.resolve(__dirname, './src') } },
})
