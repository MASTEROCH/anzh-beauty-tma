import { sql } from '../db.ts';
import { config } from '../config.ts';
import { conflict, forbidden, invalid, notFound } from '../errors.ts';
import { priceVisit } from './pricing.ts';
import type { SessionClaims } from '../lib/jwt.ts';

// Продуктовое правило Анжелики: клиентка оставляет ЗАЯВКУ, подтверждает
// её человек (SPEC §3.4). Заявки друг друга не блокируют — блокирует
// только подтверждение. Это отличает продукт от календаря с мгновенной
// записью и совпадает с тем, как она работает на самом деле.

export type BookingStatus =
  | 'pending'
  | 'confirmed'
  | 'declined'
  | 'done'
  | 'no_show'
  | 'cancelled';

/**
 * Кто из какого статуса куда может.
 *
 * Таблицей, а не цепочкой if: переход, которого нет в таблице,
 * невозможен по построению. Разрозненные проверки в обработчиках
 * расходятся — один забывает про отменённую запись, другой разрешает
 * подтвердить отклонённую.
 */
const TRANSITIONS: Record<BookingStatus, { staff: BookingStatus[]; client: BookingStatus[] }> = {
  pending:   { staff: ['confirmed', 'declined'],        client: ['cancelled'] },
  confirmed: { staff: ['done', 'no_show', 'cancelled'], client: ['cancelled'] },
  declined:  { staff: [],                               client: [] },
  done:      { staff: [],                               client: [] },
  no_show:   { staff: [],                               client: [] },
  cancelled: { staff: [],                               client: [] },
};

export interface BookingRow {
  id: string;
  telegram_id: number;
  staff_id: number;
  starts_at: Date;
  duration_min: number;
  status: BookingStatus;
  total_minor: number;
  currency: string;
  discount_percent: number;
  client_note: string | null;
  decline_reason: string | null;
  created_at: Date;
}

export interface BookingView extends BookingRow {
  items: { slug: string; title_ru: string; title_en: string; price_minor: number }[];
  staff_name: string | null;
}

async function withItems(rows: BookingRow[]): Promise<BookingView[]> {
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.id);

  const items = await sql<
    {
      booking_id: string;
      slug: string;
      title_ru: string;
      title_en: string;
      price_minor: number;
    }[]
  >`
    select bi.booking_id, s.slug, s.title_ru, s.title_en, bi.price_minor
    from anzh.booking_items bi
    join anzh.services s on s.id = bi.service_id
    where bi.booking_id = any(${ids}::uuid[])
    order by bi.sort, bi.id
  `;

  const staff = await sql<{ telegram_id: number; name: string }[]>`
    select telegram_id, name from anzh.staff
    where telegram_id = any(${[...new Set(rows.map((r) => r.staff_id))]})
  `;
  const nameOf = new Map(staff.map((s) => [s.telegram_id, s.name]));

  return rows.map((r) => ({
    ...r,
    staff_name: nameOf.get(r.staff_id) ?? null,
    items: items.filter((i) => i.booking_id === r.id).map(({ booking_id, ...rest }) => {
      void booking_id;
      return rest;
    }),
  }));
}

// Функция, а не константа: объект запроса в postgres.js одноразовый, и
// переиспользованный как фрагмент во втором месте он уже «выполнен».
const SELECT = () => sql`
  select id, telegram_id, staff_id, starts_at, duration_min, status,
         total_minor, currency, discount_percent, client_note,
         decline_reason, created_at
  from anzh.bookings
`;

export interface CreateInput {
  slugs: string[];
  startsAt: Date;
  staffId?: number | null;
  clientNote?: string | null;
}

/** Кто ведёт эти процедуры. Заявка маршрутизируется по staff_services. */
async function pickStaff(serviceIds: string[], requested?: number | null): Promise<number> {
  const rows = await sql<{ staff_id: number; n: number }[]>`
    select ss.staff_id, count(*)::int as n
    from anzh.staff_services ss
    join anzh.staff st on st.telegram_id = ss.staff_id
    where ss.service_id = any(${serviceIds}::uuid[])
      and st.active and st.deleted_at is null
    group by ss.staff_id
    -- Сначала тот, кто ведёт БОЛЬШЕ процедур из набора: визит к одному
    -- мастеру лучше визита, разорванного между двумя.
    order by n desc, staff_id
  `;

  if (rows.length === 0) {
    // Владелица ведёт всё, чего не ведёт никто: иначе заявка на новую
    // процедуру повиснет без адресата и молча пропадёт.
    const owner = await sql<{ telegram_id: number }[]>`
      select telegram_id from anzh.staff
      where role = 'owner' and active and deleted_at is null
      order by telegram_id limit 1
    `;
    const id = owner[0]?.telegram_id;
    if (id === undefined) throw invalid('В студии не заведён ни один мастер', 'no_staff');
    return id;
  }

  if (requested != null) {
    const match = rows.find((r) => r.staff_id === requested);
    if (!match) throw invalid('Выбранный мастер не ведёт эти процедуры', 'staff_mismatch');
    return match.staff_id;
  }

  return rows[0]!.staff_id;
}

export async function createBooking(
  telegramId: number,
  input: CreateInput,
): Promise<BookingView> {
  if (!(input.startsAt instanceof Date) || Number.isNaN(input.startsAt.getTime())) {
    throw invalid('Некорректное время записи', 'bad_time');
  }
  // Прошлое временем записи быть не может — и это не придирка: сдвиг
  // часового пояса на клиенте проявляется именно так.
  if (input.startsAt.getTime() < Date.now() - 60_000) {
    throw invalid('Это время уже прошло', 'past_time');
  }

  const priced = await priceVisit(telegramId, input.slugs);
  const staffId = await pickStaff(
    priced.items.map((i) => i.service_id),
    input.staffId,
  );

  // Комментарий клиентки — свободный ввод. Обрезаем длину, но не
  // фильтруем содержимое: человек может написать сюда о здоровье, и это
  // его право. Ограничения на такой текст — в том, куда он НЕ попадает.
  const note = input.clientNote?.trim().slice(0, 1000) || null;

  const created = await sql.begin(async (tx) => {
    const rows = await tx<BookingRow[]>`
      insert into anzh.bookings (
        telegram_id, staff_id, starts_at, duration_min, status,
        total_minor, currency, discount_percent, client_note
      ) values (
        ${telegramId}, ${staffId}, ${input.startsAt}, ${priced.duration_min}, 'pending',
        ${priced.total_minor}, ${priced.currency}, ${priced.discount_percent}, ${note}
      )
      returning id, telegram_id, staff_id, starts_at, duration_min, status,
                total_minor, currency, discount_percent, client_note,
                decline_reason, created_at
    `;
    const booking = rows[0]!;

    // Цена копируется в строку визита: прайс изменится, а история
    // визита меняться не должна.
    let sort = 0;
    for (const item of priced.items) {
      await tx`
        insert into anzh.booking_items
          (booking_id, service_id, price_minor, currency, duration_min, sort)
        values (${booking.id}, ${item.service_id}, ${item.price_minor},
                ${item.currency}, ${item.duration_min}, ${sort++})
      `;
    }
    return booking;
  });

  return (await withItems([created]))[0]!;
}

export async function listForClient(telegramId: number): Promise<BookingView[]> {
  const rows = await sql<BookingRow[]>`
    ${SELECT()}
    where telegram_id = ${telegramId} and deleted_at is null
    order by starts_at desc
    limit 100
  `;
  return withItems(rows);
}

export async function listForStaff(
  staffId: number,
  opts: { status?: BookingStatus; from?: Date; to?: Date; all?: boolean },
): Promise<BookingView[]> {
  const rows = await sql<BookingRow[]>`
    ${SELECT()}
    where deleted_at is null
      -- Мастер видит СВОИ записи. Владелица — все: она ведёт кассу и
      -- подтверждает за отсутствующих.
      ${opts.all ? sql`` : sql`and staff_id = ${staffId}`}
      ${opts.status ? sql`and status = ${opts.status}` : sql``}
      ${opts.from ? sql`and starts_at >= ${opts.from}` : sql``}
      ${opts.to ? sql`and starts_at < ${opts.to}` : sql``}
    order by starts_at
    limit 500
  `;
  return withItems(rows);
}

export async function getBooking(id: string, session: SessionClaims): Promise<BookingView> {
  const rows = await sql<BookingRow[]>`${SELECT()} where id = ${id} and deleted_at is null`;
  const row = rows[0];
  if (!row) throw notFound();

  // 🚨 Право проверяется на КОНКРЕТНЫЙ объект, а не только факт входа
  // (контракт §12). Мастер, запросивший чужую запись по идентификатору,
  // получает отказ, даже если он вошёл.
  const mine = row.telegram_id === session.telegram_id;
  const assigned = row.staff_id === session.telegram_id;
  if (!mine && !assigned && session.role !== 'owner') throw forbidden();

  return (await withItems([row]))[0]!;
}

export interface DecideInput {
  to: BookingStatus;
  reason?: string | null;
}

export async function decide(
  id: string,
  session: SessionClaims,
  input: DecideInput,
): Promise<BookingView> {
  const current = await sql<BookingRow[]>`
    ${SELECT()} where id = ${id} and deleted_at is null
  `;
  const row = current[0];
  if (!row) throw notFound();

  const isClient = row.telegram_id === session.telegram_id;
  const isAssigned = row.staff_id === session.telegram_id;
  const isOwner = session.role === 'owner';
  if (!isClient && !isAssigned && !isOwner) throw forbidden();

  // Роль в ЭТОЙ записи, а не вообще: владелица, записавшаяся к своему
  // мастеру, здесь клиентка.
  const asStaff = (isAssigned || isOwner) && !isClient;
  const allowed = TRANSITIONS[row.status][asStaff ? 'staff' : 'client'];
  if (!allowed.includes(input.to)) {
    throw conflict(
      'bad_transition',
      `Из статуса «${row.status}» так перевести нельзя`,
    );
  }

  const reason = input.to === 'declined' ? (input.reason?.trim().slice(0, 500) || null) : null;
  if (input.to === 'declined' && !reason) {
    throw invalid('Отклонённая заявка без причины не видна клиентке', 'reason_required');
  }

  try {
    const updated = await sql<BookingRow[]>`
      update anzh.bookings set
        status = ${input.to},
        decline_reason = ${reason},
        decided_by = ${session.telegram_id},
        decided_at = now()
      where id = ${id} and status = ${row.status}
      returning id, telegram_id, staff_id, starts_at, duration_min, status,
                total_minor, currency, discount_percent, client_note,
                decline_reason, created_at
    `;
    const next = updated[0];
    // Статус изменился между чтением и записью — кто-то успел раньше.
    if (!next) throw conflict('stale', 'Заявку только что изменили, откройте заново');
    return (await withItems([next]))[0]!;
  } catch (err) {
    // 🚨 Конфликт слота решает БАЗА (контракт §7.3). Уникальный индекс на
    // (staff_id, starts_at) where status = 'confirmed' ловит то, чего
    // проверка «свободно ли» перед вставкой поймать не может: два
    // подтверждения, прошедшие проверку одновременно.
    if ((err as { code?: string }).code === '23505') {
      throw conflict('slot_taken', 'Это время уже занято подтверждённой записью');
    }
    throw err;
  }
}

/**
 * Свободные слоты мастера на день. Занятыми считаются только
 * ПОДТВЕРЖДЁННЫЕ записи — заявки друг друга не блокируют.
 */
export async function busySlots(staffId: number, from: Date, to: Date): Promise<Date[]> {
  const rows = await sql<{ starts_at: Date }[]>`
    select starts_at from anzh.bookings
    where staff_id = ${staffId}
      and status = 'confirmed'
      and deleted_at is null
      and starts_at >= ${from} and starts_at < ${to}
    order by starts_at
  `;
  return rows.map((r) => r.starts_at);
}

/** Отклонённые заявки за последние N дней — клиентка должна их видеть. */
export async function declinedRecently(telegramId: number, days = 14): Promise<BookingView[]> {
  const rows = await sql<BookingRow[]>`
    ${SELECT()}
    where telegram_id = ${telegramId}
      and status = 'declined'
      and deleted_at is null
      and decided_at > now() - ${`${days} days`}::interval
    order by decided_at desc
  `;
  return withItems(rows);
}

export const APP_SOURCE = config.appSource;
