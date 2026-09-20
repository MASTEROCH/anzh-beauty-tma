import type { FastifyRequest } from 'fastify';
import { sql } from '../db.ts';
import { invalid } from '../errors.ts';

// Контракт §7.2. Сеть теряет ответ, человек жмёт «Записаться» второй
// раз → две записи. Эндпоинты, создающие сущность, принимают заголовок
// Idempotency-Key, и повтор с тем же ключом возвращает ТОТ ЖЕ результат,
// а не создаёт второй объект.

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function readKey(req: FastifyRequest): string | null {
  const raw = req.headers['idempotency-key'];
  const key = Array.isArray(raw) ? raw[0] : raw;
  if (!key) return null;
  // Ключ обязан быть uuid: строка «1» от одного клиента совпала бы со
  // строкой «1» от другого, и ответ уехал бы не туда. Пара
  // (telegram_id, endpoint, key) защищает от этого и в базе, но мусорный
  // ключ лучше отклонить сразу, чем сохранить под ним ответ.
  if (!UUID_RE.test(key)) throw invalid('Idempotency-Key должен быть uuid', 'bad_idempotency_key');
  return key;
}

interface Stored {
  status_code: number;
  response: unknown;
}

/**
 * Выполняет `work` не более одного раза на ключ.
 *
 * Гонку двух одновременных повторов решает база: вставка «занято» идёт
 * первой, второй запрос ловит нарушение уникальности и получает 409
 * вместо второго объекта. Ждать чужого ответа в цикле мы не пытаемся —
 * клиент повторит сам, и это честнее удерживаемого соединения.
 */
export async function once<T>(
  telegramId: number,
  endpoint: string,
  key: string | null,
  work: () => Promise<{ status: number; body: T }>,
): Promise<{ status: number; body: T; replayed: boolean }> {
  if (!key) {
    const fresh = await work();
    return { ...fresh, replayed: false };
  }

  const existing = await sql<Stored[]>`
    select status_code, response from anzh.idempotency
    where telegram_id = ${telegramId} and endpoint = ${endpoint} and key = ${key}
  `;
  const prev = existing[0];
  if (prev) {
    return { status: prev.status_code, body: prev.response as T, replayed: true };
  }

  const result = await work();

  await sql`
    insert into anzh.idempotency (key, telegram_id, endpoint, status_code, response)
    values (${key}, ${telegramId}, ${endpoint}, ${result.status}, ${sql.json(result.body as never)})
    on conflict (telegram_id, endpoint, key) do nothing
  `;

  return { ...result, replayed: false };
}
