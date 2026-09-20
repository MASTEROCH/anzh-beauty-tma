// Контрактные тесты гоняются на НАСТОЯЩЕМ PostgreSQL, поднятом внутри
// процесса (PGlite по сетевому протоколу). Причина: тесты на моке базы
// проверяют мок. Ровно то, что важнее всего в этой схеме — уникальный
// индекс на подтверждённый слот, CHECK-ограничения, поведение
// on conflict — мок не воспроизводит, а именно на них держится всё
// остальное.
//
// Внешнего сервера не нужно: ни docker, ни установленный postgres. Тот
// же прогон работает и на чужой машине, и в CI.

import { readdir, readFile } from 'node:fs/promises';
import { createHmac } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:net';
import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';
import type { FastifyInstance } from 'fastify';
import type { Sql } from 'postgres';

export const BOT_TOKEN = '123456:TEST-BOT-TOKEN-NOT-A-REAL-ONE';

export const OWNER_ID = 900001;
export const STAFF_ID = 900002;
export const CLIENT_ID = 900003;
export const OTHER_CLIENT_ID = 900004;

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

async function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = createServer();
    srv.once('error', reject);
    srv.listen(0, '127.0.0.1', () => {
      const addr = srv.address();
      const port = typeof addr === 'object' && addr ? addr.port : 0;
      srv.close(() => resolve(port));
    });
  });
}

export interface Harness {
  app: FastifyInstance;
  sql: Sql;
  stop: () => Promise<void>;
  /** Подписанный initData, как его прислал бы Telegram. */
  initData: (telegramId: number, startParam?: string) => string;
  /** Войти и получить токен сессии. */
  signIn: (telegramId: number, startParam?: string) => Promise<string>;
}

export async function startHarness(): Promise<Harness> {
  const db = await PGlite.create();
  const port = await freePort();
  const socket = new PGLiteSocketServer({ db, port, host: '127.0.0.1' });
  await socket.start();

  // 🚨 Окружение выставляется ДО импорта src: config.ts и db.ts читают
  // его в теле модуля. Поэтому импорты ниже — динамические: статические
  // Node поднял бы раньше этих строк.
  process.env.DATABASE_URL = `postgres://postgres@127.0.0.1:${port}/postgres`;
  process.env.TELEGRAM_BOT_TOKEN = BOT_TOKEN;
  process.env.BOT_USERNAME = 'anzh_test_bot';
  process.env.APP_SHORTNAME = 'beauty';
  process.env.JWT_SECRET = 'test-secret-'.padEnd(48, 'x');
  process.env.NODE_ENV = 'test';
  process.env.POLICY_VERSION = 'test-1';
  process.env.DB_POOL_MAX = '2';

  const { sql } = (await import('../src/db.ts')) as { sql: Sql };
  const { buildApp } = await import('../src/app.ts');

  // Миграции — те же файлы, что поедут в бой. Отдельная «тестовая
  // схема» проверяла бы схему, которой нет в проде.
  const files = (await readdir(join(ROOT, 'migrations'))).filter((f) => f.endsWith('.sql')).sort();
  for (const file of files) {
    await sql.unsafe(await readFile(join(ROOT, 'migrations', file), 'utf8')).simple();
  }

  await seed(sql);

  const app = buildApp();
  await app.ready();

  const initData = (telegramId: number, startParam?: string): string => {
    const fields: Record<string, string> = {
      user: JSON.stringify({ id: telegramId, first_name: `U${telegramId}` }),
      auth_date: String(Math.floor(Date.now() / 1000)),
    };
    if (startParam) fields.start_param = startParam;
    const pairs = Object.entries(fields)
      .map(([k, v]) => `${k}=${v}`)
      .sort();
    const secret = createHmac('sha256', 'WebAppData').update(BOT_TOKEN).digest();
    const hash = createHmac('sha256', secret).update(pairs.join('\n')).digest('hex');
    const qs = new URLSearchParams(fields);
    qs.set('hash', hash);
    return qs.toString();
  };

  const signIn = async (telegramId: number, startParam?: string): Promise<string> => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/telegram',
      payload: { init_data: initData(telegramId, startParam) },
    });
    if (res.statusCode !== 200) throw new Error(`вход не удался: ${res.statusCode} ${res.body}`);
    return (res.json() as { token: string }).token;
  };

  return {
    app,
    sql,
    initData,
    signIn,
    stop: async () => {
      await app.close();
      await sql.end({ timeout: 5 });
      await socket.stop();
      await db.close();
    },
  };
}

/** Минимум данных, на котором проверяется полный круг. */
async function seed(sql: Sql): Promise<void> {
  await sql`
    insert into anzh.staff (telegram_id, name, title, role) values
      (${OWNER_ID}, 'Анжелика', 'Косметолог', 'owner'),
      (${STAFF_ID}, 'Марина',   'Мастер по бровям', 'staff')
  `;

  await sql`
    insert into anzh.services
      (slug, kind, category, zone, title_ru, title_en, price_minor, currency, duration_min, sort)
    values
      ('lips',   'procedure', 'inj',   'face',  'Контурная пластика губ', 'Lip filler',   45000, 'GEL', 60, 1),
      ('peel',   'procedure', 'peel',  'face',  'Пилинг PRX-T33',         'PRX-T33 peel', 18000, 'GEL', 45, 2),
      ('brows',  'procedure', 'brows', 'brows', 'Ламинирование бровей',   'Brow lamination', 9000, 'GEL', 40, 3),
      ('nopric', 'procedure', 'care',  'face',  'Без цены',               'No price',     null,  null,  null, 9)
  `;

  const ids = await sql<{ id: string; slug: string }[]>`select id, slug from anzh.services`;
  const idOf = (slug: string) => ids.find((r) => r.slug === slug)!.id;

  await sql`
    insert into anzh.staff_services (staff_id, service_id) values
      (${OWNER_ID}, ${idOf('lips')}),
      (${OWNER_ID}, ${idOf('peel')}),
      (${STAFF_ID}, ${idOf('brows')})
  `;
}

/** Время в будущем, кратное часу — чтобы слоты совпадали между тестами. */
export function futureSlot(hoursAhead: number): string {
  const d = new Date();
  d.setUTCMinutes(0, 0, 0);
  d.setUTCHours(d.getUTCHours() + hoursAhead);
  return d.toISOString();
}
