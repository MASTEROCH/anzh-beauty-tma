import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/* Куда dev-сервер отдаёт `/api/*`. По умолчанию — локальный стенд бэкенда
   (Р-0: server/scripts/stand.mjs, порт 8791). Свой стенд на другом порту —
   `ANZH_API_TARGET=http://localhost:NNNN npx vite`. В сборку не попадает:
   на Vercel фронт и API живут на одном домене, `/api/v1` — относительный. */
const API_TARGET = process.env.ANZH_API_TARGET ?? 'http://localhost:8791';

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5179,
    /* Порт занят — упасть, а не тихо уехать на соседний: Playwright и
       параллельные копии ждут приложение на названном порту, и «уехавший»
       сервер означает прогон по чужому дереву. Свой порт — `--port`. */
    strictPort: true,
    proxy: {
      '/api': { target: API_TARGET, changeOrigin: true },
    },
  },
});
