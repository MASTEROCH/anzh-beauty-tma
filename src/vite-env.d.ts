/// <reference types="vite/client" />

interface ImportMetaEnv {
  /**
   * Базовый адрес API без завершающего «/». По умолчанию `/api/v1` — тот же
   * домен Vercel, без CORS. Задаётся, только если API живёт отдельно.
   */
  readonly VITE_API_BASE?: string;
  /** '1' — демо-сборка для ссылки прототипа: вход без Telegram, демо-сервер рядом */
  readonly VITE_DEMO?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
