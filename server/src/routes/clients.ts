import type { FastifyInstance } from 'fastify';
import { requireRole } from '../app.ts';
import { sql } from '../db.ts';
import { invalid, notFound } from '../errors.ts';
import { discountPercentFor } from '../services/pricing.ts';

// Карточка клиентки для мастера. Одна и та же при каждой записи — чтобы
// Анжелика видела историю до того, как подтвердит заявку, а не искала
// её в переписке.
//
// 🔒 Здесь НЕТ анкеты здоровья и результатов разборов. Они приезжают на
// шаге 4, отдельным эндпоинтом, с записью в журнал доступа и после
// ответов юриста по §1. Смешивать их с этой карточкой нельзя: тогда
// каждое открытие списка клиенток становится доступом к медданным.

interface ClientSummary {
  telegram_id: number;
  first_name: string | null;
  last_name: string | null;
  username: string | null;
  visits: number;
  no_shows: number;
  cancelled: number;
  spent_minor: number;
  currency: string | null;
  first_visit: Date | null;
  last_visit: Date | null;
}

export async function registerClients(app: FastifyInstance): Promise<void> {
  /**
   * GET /api/v1/clients — список клиенток с историей.
   *
   * Мастер видит тех, кто к НЕМУ приходил; владелица — всех. Иначе
   * список клиенток студии открывается любому, кого добавили в команду.
   */
  app.get('/clients', async (req) => {
    const s = requireRole(req, 'staff', 'owner');
    const q = req.query as { search?: string; limit?: string };

    const limit = Math.min(Number(q.limit) || 100, 500);
    const search = q.search?.trim();

    const rows = await sql<ClientSummary[]>`
      select
        u.telegram_id, u.first_name, u.last_name, u.username,
        count(*) filter (where b.status = 'done')::int      as visits,
        count(*) filter (where b.status = 'no_show')::int   as no_shows,
        count(*) filter (where b.status = 'cancelled')::int as cancelled,
        coalesce(sum(b.total_minor) filter (where b.status = 'done'), 0)::bigint as spent_minor,
        max(b.currency)                                     as currency,
        min(b.starts_at) filter (where b.status = 'done')   as first_visit,
        max(b.starts_at) filter (where b.status = 'done')   as last_visit
      from anzh.users u
      join anzh.bookings b on b.telegram_id = u.telegram_id and b.deleted_at is null
      where u.deleted_at is null
        ${s.role === 'owner' ? sql`` : sql`and b.staff_id = ${s.telegram_id}`}
        ${
          search
            ? sql`and (u.first_name ilike ${'%' + search + '%'}
                    or u.last_name ilike ${'%' + search + '%'}
                    or u.username  ilike ${'%' + search + '%'})`
            : sql``
        }
      group by u.telegram_id, u.first_name, u.last_name, u.username
      order by max(b.starts_at) desc nulls last
      limit ${limit}
    `;

    return { clients: rows };
  });

  /**
   * GET /api/v1/clients/:telegramId — карточка одной клиентки.
   *
   * Право проверяется на КОНКРЕТНЫЙ объект (контракт §12): мастер,
   * запросивший карточку человека, который к нему никогда не приходил,
   * получает 404 — не 403. Разница существенна: 403 подтвердил бы, что
   * такая клиентка у студии есть.
   */
  app.get('/clients/:telegramId', async (req) => {
    const s = requireRole(req, 'staff', 'owner');
    const id = Number((req.params as { telegramId: string }).telegramId);
    if (!Number.isInteger(id)) throw invalid('telegramId — число', 'bad_telegram_id');

    const user = await sql<
      { telegram_id: number; first_name: string | null; last_name: string | null; username: string | null; created_at: Date }[]
    >`
      select telegram_id, first_name, last_name, username, created_at
      from anzh.users where telegram_id = ${id} and deleted_at is null
    `;
    if (!user[0]) throw notFound('unknown_client', 'Такой клиентки нет');

    const history = await sql<
      {
        id: string;
        starts_at: Date;
        status: string;
        total_minor: number;
        currency: string;
        staff_id: number;
        services: string[];
      }[]
    >`
      select b.id, b.starts_at, b.status, b.total_minor, b.currency, b.staff_id,
             coalesce(array_agg(s.slug order by bi.sort)
                        filter (where s.slug is not null), '{}') as services
      from anzh.bookings b
      left join anzh.booking_items bi on bi.booking_id = b.id
      left join anzh.services s on s.id = bi.service_id
      where b.telegram_id = ${id} and b.deleted_at is null
        ${s.role === 'owner' ? sql`` : sql`and b.staff_id = ${s.telegram_id}`}
      group by b.id
      order by b.starts_at desc
      limit 200
    `;

    // Мастер, которому эта клиентка не приходила, не должен узнать даже
    // факт её существования.
    if (history.length === 0 && s.role !== 'owner') {
      throw notFound('unknown_client', 'Такой клиентки нет');
    }

    const done = history.filter((h) => h.status === 'done');

    return {
      client: {
        ...user[0],
        visits: done.length,
        no_shows: history.filter((h) => h.status === 'no_show').length,
        cancelled: history.filter((h) => h.status === 'cancelled').length,
        spent_minor: done.reduce((sum, h) => sum + h.total_minor, 0),
        currency: done[0]?.currency ?? null,
        discount_percent: await discountPercentFor(id),
        // 🔒 Анкета и разборы сюда не входят — см. шапку файла.
        health: { available: false, reason: 'pending_legal_review' },
      },
      history,
    };
  });
}
