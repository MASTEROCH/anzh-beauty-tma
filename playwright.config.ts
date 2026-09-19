import { defineConfig, devices } from '@playwright/test';

// Прогон по состояниям и сценариям. Смысл здесь не «открылось ли
// приложение», а проверка того, что ломается молча: пустые состояния,
// доступность нажатий, отсутствие горизонтальной прокрутки, чистая консоль.
export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  reporter: [['list']],
  timeout: 30_000,
  use: {
    baseURL: 'http://localhost:5173',
    // iPhone 13 — реальная рабочая ширина Telegram Mini App
    ...devices['iPhone 13'],
    trace: 'off',
  },
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
