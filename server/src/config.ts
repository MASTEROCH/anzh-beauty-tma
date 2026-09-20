// Конфигурация читается из окружения ОДИН раз, при старте, и проверяется
// сразу. Сервер, который поднялся без токена бота и узнал об этом при
// первой оплате, хуже сервера, который не поднялся вовсе.

function required(name: string): string {
  const v = process.env[name];
  if (!v || v.trim() === '') {
    throw new Error(
      `Не задана переменная окружения ${name}. Смотри .env.example — там перечислены все имена.`,
    );
  }
  return v.trim();
}

function optional(name: string, fallback = ''): string {
  const v = process.env[name];
  return v && v.trim() !== '' ? v.trim() : fallback;
}

function num(name: string, fallback: number): number {
  const v = process.env[name];
  if (!v || v.trim() === '') return fallback;
  const n = Number(v);
  if (!Number.isFinite(n)) throw new Error(`${name} должно быть числом, пришло «${v}»`);
  return n;
}

const nodeEnv = optional('NODE_ENV', 'development');

export const config = {
  env: nodeEnv,
  isProduction: nodeEnv === 'production',

  port: num('PORT', 8080),
  host: optional('HOST', '0.0.0.0'),
  // Пустой список = не отдавать CORS-заголовки вовсе. Мини-приложение
  // Telegram живёт на известном адресе; «*» здесь означало бы, что любой
  // сайт может ходить в API от имени открывшего его человека.
  corsOrigins: optional('CORS_ORIGINS')
    .split(',')
    .map((s) => s.trim().replace(/\/$/, ''))
    .filter(Boolean),

  databaseUrl: required('DATABASE_URL'),
  dbPoolMax: num('DB_POOL_MAX', 10),

  // Токен бота — только здесь. На клиенте его быть не может (контракт §3.2).
  botToken: required('TELEGRAM_BOT_TOKEN'),
  botUsername: required('BOT_USERNAME').replace(/^@/, ''),
  appShortname: required('APP_SHORTNAME'),
  webhookSecret: optional('TELEGRAM_WEBHOOK_SECRET'),

  jwtSecret: required('JWT_SECRET'),
  jwtTtlDays: num('JWT_TTL_DAYS', 7),
  // Контракт §3.2: отклонять initData старше часа.
  initDataMaxAgeSec: num('INITDATA_MAX_AGE_SEC', 3600),

  salonTimezone: optional('SALON_TIMEZONE', 'Asia/Tbilisi'),
  salonCurrency: optional('SALON_CURRENCY', 'GEL'),

  policyVersion: optional('POLICY_VERSION', '0'),

  cronSecret: optional('CRON_SECRET'),

  // Приложение в экосистеме. Значение закреплено за продуктом и
  // сверяется в каждом токене (контракт §3.3).
  appSource: 'beauty' as const,
} as const;

// Проверки, которые дешевле сделать при старте, чем ловить в бою.
if (config.jwtSecret.length < 32) {
  throw new Error('JWT_SECRET короче 32 символов — подпись сессии этим не защищена.');
}
if (config.isProduction && !config.webhookSecret) {
  // Без секрета любой, кто узнает адрес вебхука, сможет слать поддельные
  // события об оплате (контракт §3.5).
  throw new Error('В боевом режиме TELEGRAM_WEBHOOK_SECRET обязателен.');
}
if (config.isProduction && config.policyVersion === '0') {
  // Согласие «на условия, которых нет» — не согласие (контракт §1, вопрос 9).
  throw new Error('В боевом режиме POLICY_VERSION обязателен: согласия ссылаются на версию текста.');
}
