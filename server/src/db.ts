import postgres from 'postgres';
import { config } from './config.ts';

// Один пул на процесс. ORM нет намеренно: схема описана SQL-миграциями,
// и второй источник правды в виде моделей разошёлся бы с ней на первой же
// правке. Запросы пишутся руками, параметры подставляет драйвер.

export const sql = postgres(config.databaseUrl, {
  max: config.dbPoolMax,
  // Имена колонок остаются как в схеме. Драйвер умеет превращать
  // snake_case в camelCase — и тогда имя поля в коде перестаёт совпадать
  // с именем в базе. При экспорте (контракт §14.1) требуется совпадение,
  // а два набора имён в одной голове не держатся.
  transform: undefined,
  // bigint по умолчанию приезжает СТРОКОЙ — она молча ломает сравнения
  // (`'900001' === 900001` ложно) и попадает в JSON в кавычках. Штатный
  // postgres.BigInt отдаёт настоящий BigInt, который JSON.stringify не
  // умеет сериализовать вовсе — на этом падал выпуск токена.
  //
  // Поэтому свой разбор в number: telegram_id укладывается в
  // Number.MAX_SAFE_INTEGER с огромным запасом (максимальный
  // идентификатор Telegram ~2^52), деньги в минорных единицах — тем
  // более. Если когда-нибудь не уложится, лучше падение, чем тихая
  // потеря точности в кассе.
  types: {
    bigint: {
      to: 20,
      from: [20],
      serialize: (x: number | bigint) => x.toString(),
      parse: (x: string) => {
        const n = Number(x);
        if (!Number.isSafeInteger(n)) {
          throw new Error(`bigint ${x} не укладывается в безопасное целое JS`);
        }
        return n;
      },
    },
  },
  // 🚨 Без onnotice драйвер печатает NOTICE от Postgres в stdout. В теле
  // такого сообщения может оказаться значение из запроса — то есть
  // данные о здоровье в логах (контракт §6.4).
  onnotice: () => {},
  connection: {
    application_name: 'anzh-beauty',
  },
});

/** Живо ли соединение. Для /api/v1/health. */
export async function pingDatabase(): Promise<boolean> {
  try {
    await sql`select 1`;
    return true;
  } catch {
    return false;
  }
}

export async function closeDatabase(): Promise<void> {
  await sql.end({ timeout: 5 });
}
