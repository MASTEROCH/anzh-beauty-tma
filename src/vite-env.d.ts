/// <reference types="vite/client" />

interface ImportMetaEnv {
  /**
   * Базовый адрес API без завершающего «/». По умолчанию `/api/v1` — тот же
   * домен Vercel, без CORS. Задаётся, только если API живёт отдельно.
   */
  readonly VITE_API_BASE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
