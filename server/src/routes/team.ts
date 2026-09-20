import type { FastifyInstance } from 'fastify';
import { requireRole, requireSession } from '../app.ts';
import { sql } from '../db.ts';
import { forbidden, invalid, notFound, tooMany } from '../errors.ts';
import { hashPin, verifyPin } from '../lib/pin.ts';
import { hit } from '../lib/rateLimit.ts';

// Команда студии. Право даёт telegram_id из этой таблицы, а не PIN
// (контракт §3.4): PIN остаётся вторым фактором и хранится хэшем.

interface StaffRow {
  telegram_id: number;
  name: string;
  title: string | null;
  role: 'staff' | 'owner';
  photo_url: string | null;
  active: boolean;
}

export async function registerTeam(app: FastifyInstance): Promise<void> {
  /**
   * GET /api/v1/team — кто работает и что ведёт.
   *
   * Публично: имена и должности мастеров показываются клиенткам при
   * выборе. Ни PIN, ни его хэш сюда не попадают.
   */
  app.get('/team', async () => {
    const rows = await sql<StaffRow[]>`
      select telegram_id, name, title, role, photo_url, active
      from anzh.staff
      where active and deleted_at is null
      order by role desc, name
    `;

    const links = await sql<{ staff_id: number; slug: string }[]>`
      select ss.staff_id, s.slug
      from anzh.staff_services ss
      join anzh.services s on s.id = ss.service_id
      where s.archived_at is null and s.deleted_at is null
    `;

    return {
      team: rows.map((r) => ({
        telegram_id: r.telegram_id,
        name: r.name,
        title: r.title,
        role: r.role,
        photo_url: r.photo_url,
        services: links.filter((l) => l.staff_id === r.telegram_id).map((l) => l.slug),
      })),
    };
  });

  /**
   * POST /api/v1/staff/pin — подтверждение вторым фактором.
   *
   * 🚨 Это НЕ вход. Вход уже состоялся через initData, и роль взята из
   * базы по telegram_id. Здесь человек лишь подтверждает, что за
   * телефоном он сам — например, перед открытием карточек клиенток.
   * Кто не мастер, тот не станет им, введя верный PIN.
   */
  app.post('/staff/pin', async (req, reply) => {
    const s = requireRole(req, 'staff', 'owner');

    // Четыре цифры перебираются за секунды — ограничение частоты здесь
    // единственное, что делает второй фактор фактором.
    const verdict = hit(`pin:${s.telegram_id}`, 5, 300);
    if (!verdict.allowed) {
      reply.header('Retry-After', String(verdict.retryAfterSec));
      throw tooMany('Слишком много попыток, подождите');
    }

    const body = (req.body ?? {}) as { pin?: unknown };
    if (typeof body.pin !== 'string' || body.pin.length < 4) {
      throw invalid('Нужен PIN', 'bad_pin');
    }

    const rows = await sql<{ pin_hash: string | null }[]>`
      select pin_hash from anzh.staff
      where telegram_id = ${s.telegram_id} and active and deleted_at is null
    `;
    const stored = rows[0]?.pin_hash ?? null;
    if (!stored) throw invalid('PIN ещё не задан', 'pin_not_set');

    if (!(await verifyPin(body.pin, stored))) throw forbidden('bad_pin', 'PIN не подошёл');
    return { confirmed: true };
  });

  /** POST /api/v1/staff/pin/set — задать или сменить свой PIN. */
  app.post('/staff/pin/set', async (req) => {
    const s = requireRole(req, 'staff', 'owner');
    const body = (req.body ?? {}) as { pin?: unknown };

    if (typeof body.pin !== 'string' || !/^\d{4,8}$/.test(body.pin)) {
      throw invalid('PIN — от 4 до 8 цифр', 'bad_pin');
    }
    // Демо-коды из спецификации ходили по переписке. Они должны
    // перестать быть способом входа, а не просто поменяться
    // (контракт §3.4).
    if (['2024', '1111', '2222', '0000', '1234'].includes(body.pin)) {
      throw invalid('Этот код известен из переписки, выберите другой', 'pin_leaked');
    }

    await sql`
      update anzh.staff set pin_hash = ${await hashPin(body.pin)}
      where telegram_id = ${s.telegram_id}
    `;
    return { updated: true };
  });

  // ─── Управление командой: только владелица ────────────────────────

  app.post('/team', async (req, reply) => {
    requireRole(req, 'owner');
    const body = (req.body ?? {}) as {
      telegram_id?: unknown;
      name?: unknown;
      title?: unknown;
      role?: unknown;
    };

    if (typeof body.telegram_id !== 'number' || !Number.isInteger(body.telegram_id)) {
      throw invalid('Нужен telegram_id мастера — числом', 'bad_telegram_id');
    }
    if (typeof body.name !== 'string' || body.name.trim() === '') {
      throw invalid('Нужно имя', 'bad_name');
    }
    const role = body.role === 'owner' ? 'owner' : 'staff';

    const rows = await sql<StaffRow[]>`
      insert into anzh.staff (telegram_id, name, title, role)
      values (${body.telegram_id}, ${body.name.trim()},
              ${typeof body.title === 'string' ? body.title : null}, ${role})
      on conflict (telegram_id) do update set
        name = excluded.name,
        title = excluded.title,
        role = excluded.role,
        active = true,
        deleted_at = null
      returning telegram_id, name, title, role, photo_url, active
    `;
    reply.code(201).send({ staff: rows[0] });
  });

  /**
   * DELETE /api/v1/team/:telegramId — снять доступ.
   *
   * Мягко: записи этого мастера остаются в истории и в выручке. Жёсткое
   * удаление обнулило бы прошлые месяцы.
   */
  app.delete('/team/:telegramId', async (req) => {
    const s = requireRole(req, 'owner');
    const id = Number((req.params as { telegramId: string }).telegramId);
    if (!Number.isInteger(id)) throw invalid('telegramId — число', 'bad_telegram_id');

    // Владелица, снявшая доступ сама у себя, останется без кабинета и
    // без способа вернуть его через приложение.
    if (id === s.telegram_id) throw invalid('Нельзя снять доступ у себя', 'self_removal');

    const rows = await sql<{ telegram_id: number }[]>`
      update anzh.staff set active = false
      where telegram_id = ${id} and deleted_at is null
      returning telegram_id
    `;
    if (!rows[0]) throw notFound('unknown_staff', 'Такого мастера нет');
    return { deactivated: rows[0].telegram_id };
  });

  /** PUT /api/v1/team/:telegramId/services — что ведёт мастер. */
  app.put('/team/:telegramId/services', async (req) => {
    requireRole(req, 'owner');
    const id = Number((req.params as { telegramId: string }).telegramId);
    if (!Number.isInteger(id)) throw invalid('telegramId — число', 'bad_telegram_id');

    const body = (req.body ?? {}) as { slugs?: unknown };
    if (!Array.isArray(body.slugs) || body.slugs.some((x) => typeof x !== 'string')) {
      throw invalid('slugs — список строк', 'bad_slugs');
    }
    const slugs = [...new Set(body.slugs as string[])];

    await sql.begin(async (tx) => {
      const found = await tx<{ id: string; slug: string }[]>`
        select id, slug from anzh.services
        where slug = any(${slugs}) and deleted_at is null
      `;
      if (found.length !== slugs.length) {
        const have = new Set(found.map((f) => f.slug));
        throw invalid(
          `Нет таких процедур: ${slugs.filter((s) => !have.has(s)).join(', ')}`,
          'unknown_service',
        );
      }

      // Полная замена набора, а не дописывание: «что ведёт мастер» это
      // список целиком, и снятие процедуры должно работать тем же
      // запросом, что добавление.
      await tx`delete from anzh.staff_services where staff_id = ${id}`;
      for (const f of found) {
        await tx`
          insert into anzh.staff_services (staff_id, service_id)
          values (${id}, ${f.id})
        `;
      }
    });

    return { staff_id: id, services: slugs };
  });

  /** GET /api/v1/staff/me — кабинет: кто я как сотрудник. */
  app.get('/staff/me', async (req) => {
    const s = requireSession(req);
    const rows = await sql<StaffRow[]>`
      select telegram_id, name, title, role, photo_url, active
      from anzh.staff
      where telegram_id = ${s.telegram_id} and deleted_at is null
    `;
    const row = rows[0];
    if (!row || !row.active) throw forbidden('not_staff', 'Нет доступа в кабинет');

    const hasPin = await sql<{ set: boolean }[]>`
      select (pin_hash is not null) as set from anzh.staff
      where telegram_id = ${s.telegram_id}
    `;
    return { staff: { ...row, pin_set: hasPin[0]?.set ?? false } };
  });
}
