import { defineConfig, devices } from '@playwright/test';

/* Порт задан ОДИН раз и здесь же. Он был зашит числом в двух местах и
   разошёлся с vite.config.ts (там 5179): Playwright ждал 5173, сервер
   поднимался на 5179, и прогон падал по таймауту ожидания сервера — то
   есть тесты не запускались вовсе, а выглядело это как «всё сломалось».
   Меняешь порт в vite.config.ts — меняешь здесь. */
const PORT = 'http://localhost:5179';

// Прогон по состояниям и сценариям. Смысл здесь не «открылось ли
// приложение», а проверка того, что ломается молча: пустые состояния,
// доступность нажатий, отсутствие горизонтальной прокрутки, чистая консоль.
export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  reporter: [['list']],
  timeout: 30_000,
  use: {
    baseURL: PORT,
    // iPhone 13 — реальная рабочая ширина Telegram Mini App
    ...devices['iPhone 13'],
    trace: 'off',
  },
  webServer: {
    command: 'npm run dev',
    url: PORT,
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
