import type { FastifyInstance } from 'fastify';
import { requireRole, requireSession } from '../app.ts';
import { invalid, tooMany } from '../errors.ts';
import { hit } from '../lib/rateLimit.ts';
import { once, readKey } from '../lib/idempotency.ts';
import {
  busySlots,
  createBooking,
  decide,
  declinedRecently,
  getBooking,
  listForClient,
  listForStaff,
  type BookingStatus,
} from '../services/bookings.ts';

const STATUSES: BookingStatus[] = [
  'pending', 'confirmed', 'declined', 'done', 'no_show', 'cancelled',
];

function parseDate(value: unknown, field: string): Date {
  if (typeof value !== 'string') throw invalid(`Нужна дата в поле ${field}`, 'bad_date');
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) throw invalid(`Не разбирается дата в поле ${field}`, 'bad_date');
  return d;
}

export async function registerBookings(app: FastifyInstance): Promise<void> {
  /**
   * POST /api/v1/bookings — заявка на визит.
   *
   * Клиент присылает СОСТАВ визита, а не сумму (контракт §7.4).
   * Идемпотентность по заголовку Idempotency-Key: сеть теряет ответ,
   * человек жмёт «Записаться» второй раз (§7.2).
   */
  app.post('/bookings', async (req, reply) => {
    const s = requireSession(req);

    const verdict = hit(`book:${s.telegram_id}`, 10, 300);
    if (!verdict.allowed) {
      reply.header('Retry-After', String(verdict.retryAfterSec));
      throw tooMany('Слишком много заявок подряд');
    }

    const body = (req.body ?? {}) as {
      slugs?: unknown;
      starts_at?: unknown;
      staff_id?: unknown;
      note?: unknown;
    };

    if (!Array.isArray(body.slugs) || body.slugs.length === 0) {
      throw invalid('Нужен непустой список slugs', 'bad_slugs');
    }
    if (body.slugs.some((x) => typeof x !== 'string')) {
      throw invalid('slugs — список строк', 'bad_slugs');
    }

    const result = await once(s.telegram_id, 'POST /bookings', readKey(req), async () => {
      const booking = await createBooking(s.telegram_id, {
        slugs: body.slugs as string[],
        startsAt: parseDate(body.starts_at, 'starts_at'),
        staffId: typeof body.staff_id === 'number' ? body.staff_id : null,
        clientNote: typeof body.note === 'string' ? body.note : null,
      });
      return { status: 201, body: { booking } };
    });

    reply.code(result.status).send(result.body);
  });

  /** GET /api/v1/bookings — мои записи. */
  app.get('/bookings', async (req) => {
    const s = requireSession(req);
    return { bookings: await listForClient(s.telegram_id) };
  });

  /** GET /api/v1/bookings/declined — отклонённые за две недели. */
  app.get('/bookings/declined', async (req) => {
    const s = requireSession(req);
    return { bookings: await declinedRecently(s.telegram_id) };
  });

  /**
   * GET /api/v1/staff/bookings — день мастера и очередь заявок.
   *
   * Мастер видит свои записи, владелица — все. Проверку делает сервис,
   * а не этот обработчик: право на объект и право на список — разные
   * проверки, и держать их надо рядом с данными.
   */
  app.get('/staff/bookings', async (req) => {
    const s = requireRole(req, 'staff', 'owner');
    const q = req.query as { status?: string; from?: string; to?: string; scope?: string };

    if (q.status && !STATUSES.includes(q.status as BookingStatus)) {
      throw invalid('Неизвестный статус', 'bad_status');
    }

    return {
      bookings: await listForStaff(s.telegram_id, {
        status: q.status as BookingStatus | undefined,
        from: q.from ? parseDate(q.from, 'from') : undefined,
        to: q.to ? parseDate(q.to, 'to') : undefined,
        // Общий список — только владелице, даже если мастер попросит.
        all: q.scope === 'all' && s.role === 'owner',
      }),
    };
  });

  /** GET /api/v1/bookings/:id — одна запись. Право на объект (§12). */
  app.get('/bookings/:id', async (req) => {
    const s = requireSession(req);
    const { id } = req.params as { id: string };
    return { booking: await getBooking(id, s) };
  });

  /**
   * PATCH /api/v1/bookings/:id — смена статуса.
   *
   * Один эндпоинт на все переходы: разрешённые пары описаны таблицей в
   * сервисе, и «подтвердить отклонённую» невозможно по построению, а не
   * потому, что кто-то вспомнил про этот случай.
   */
  app.patch('/bookings/:id', async (req) => {
    const s = requireSession(req);
    const { id } = req.params as { id: string };
    const body = (req.body ?? {}) as { status?: unknown; reason?: unknown };

    if (typeof body.status !== 'string' || !STATUSES.includes(body.status as BookingStatus)) {
      throw invalid('Нужен новый статус', 'bad_status');
    }

    return {
      booking: await decide(id, s, {
        to: body.status as BookingStatus,
        reason: typeof body.reason === 'string' ? body.reason : null,
      }),
    };
  });

  /**
   * GET /api/v1/staff/:staffId/busy — занятые слоты на период.
   *
   * Занятыми считаются только ПОДТВЕРЖДЁННЫЕ записи: заявки друг друга
   * не блокируют (SPEC §3.4). Список открыт вошедшим — по нему рисуется
   * сетка выбора времени, и он не раскрывает ни кто записан, ни на что.
   */
  app.get('/staff/:staffId/busy', async (req) => {
    requireSession(req);
    const { staffId } = req.params as { staffId: string };
    const q = req.query as { from?: string; to?: string };

    const id = Number(staffId);
    if (!Number.isInteger(id)) throw invalid('staffId — число', 'bad_staff');

    const from = q.from ? parseDate(q.from, 'from') : new Date();
    const to = q.to ? parseDate(q.to, 'to') : new Date(from.getTime() + 30 * 86400_000);
    if (to <= from) throw invalid('Конец периода раньше начала', 'bad_range');
    if (to.getTime() - from.getTime() > 90 * 86400_000) {
      throw invalid('Период больше 90 дней', 'range_too_long');
    }

    return { busy: (await busySlots(id, from, to)).map((d) => d.toISOString()) };
  });
}
