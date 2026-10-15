// Провод «записи»: свободное время, заявка, мои записи, отмена, расписание
// уведомлений вокруг визита. Источник правды — server/openapi.yaml (пути
// /slots, /bookings, /bookings/declined, /bookings/{id}); коды отказов —
// оттуда же (`x-codes`, словарь `x-error-codes`).
//
// Правила папки — в шапке `./me.ts`. Перевод в форму экрана (`Appointment`,
// местное время салона) — в `lib/appointments.ts`.
//
// Кабинетные ручки (/staff/bookings, /staff/{id}/busy) — не здесь: это
// провод кабинета (lib/api/staff.ts).

import { apiRequest } from '../session';

export type BookingStatus = 'pending' | 'confirmed' | 'declined' | 'done' | 'no_show' | 'cancelled';

/** Строка визита. Цены зафиксированы на момент записи — прайс меняется, история нет. */
export interface BookingItem {
  slug?: string;
  title_ru?: string;
  title_en?: string;
  price_minor?: number;
}

/** `components/schemas/Booking`. Сумму, скидку и длительность считает сервер. */
export interface Booking {
  id: string;
  telegram_id: number;
  client_name?: string | null;
  staff_id: number;
  staff_name?: string | null;
  /** UTC, ISO-8601. Местное время салона считает экран по `timezone` из GET /bookings или /slots. */
  starts_at: string;
  duration_min: number;
  status: BookingStatus;
  /** Итог визита после скидки, минорные единицы `currency`. */
  total_minor: number;
  /** Фактически оплачено при done, в `currency`; null — не указано (не путать с нулём). */
  paid_minor?: number | null;
  /**
   * ISO-4217 всего визита (GEL или USD — у каждой цены своя валюта, пересчёта нет).
   * Валюта у визита одна: смешанный визит сервер не заводит (422 `mixed_currency`,
   * api/_domain/pricing.js priceVisit). Экран печатает её как есть — без «USD по умолчанию».
   */
  currency: string;
  discount_percent?: number;
  client_note?: string | null;
  decline_reason?: string | null;
  created_at?: string;
  items: BookingItem[];
}

/**
 * Одно уведомление, которое сервер ДЕЙСТВИТЕЛЬНО шлёт (`ScheduleItem`).
 * Других видов нет; экран не обещает ничего сверх этого списка.
 */
export interface ScheduleItem {
  /** `booking_cancelled` — клиентке, когда мастер отменил подтверждённую запись
      (решение John перед волной 2). `pin_locked` в расписание клиентки не попадает. */
  kind: 'booking_new' | 'booking_confirmed' | 'booking_declined' | 'booking_cancelled' | 'client_24h' | 'master_30min';
  /** Когда отправлено или будет отправлено (UTC). */
  when: string;
  text: { ru: string; en: string };
}

export interface Slot {
  /** Местное время салона, 'HH:MM'. */
  time: string;
  /** То самое значение для `POST /bookings` — не собирать из даты и времени самим. */
  starts_at: string;
}

export interface SlotsResponse {
  /** День по часовому поясу салона. */
  date: string;
  /** Пояс салона, например 'Asia/Tbilisi'. */
  timezone: string;
  /** Кто ведёт; null — некому. */
  staff_id: number | null;
  slots: Slot[];
}

export interface CreateBookingBody {
  slugs: string[];
  starts_at: string;
  staff_id?: number | null;
  /** Может содержать сведения о здоровье — сервер не пишет её ни в журнал, ни в уведомления. */
  note?: string | null;
}

// ── Вызовы ──────────────────────────────────────────────────────────────────

/**
 * GET /slots?date=&slugs= — свободные начала визита на день по поясу салона.
 * Единственный источник времени для записи. Отказы 422: bad_date, bad_slugs,
 * unknown_service, incomplete_service, no_staff, staff_mismatch, past_time, too_far.
 */
export function getSlots(
  date: string,
  slugs: string[],
  opts: { staffId?: number | null; signal?: AbortSignal } = {},
): Promise<SlotsResponse> {
  return apiRequest<SlotsResponse>('GET', '/slots', {
    query: { date, slugs: slugs.join(','), staff_id: opts.staffId ?? undefined },
    signal: opts.signal,
  });
}

/**
 * POST /bookings → 201 `{booking}` (или та же заявка по тому же ключу).
 *
 * `idempotencyKey` — ОДИН на намерение человека (одно нажатие «Отправить
 * заявку»). Сетевую ошибку транспорт повторяет сам один раз с тем же ключом
 * (lib/session.ts); повтор нажатия тем же составом — тоже с тем же ключом.
 * Отказы: 409 slot_taken / idempotency_in_progress; 422 bad_time, past_time,
 * too_far, outside_hours, off_grid и др.; 429 rate_limited.
 */
export async function createBooking(body: CreateBookingBody, idempotencyKey: string): Promise<Booking> {
  const r = await apiRequest<{ booking: Booking }>('POST', '/bookings', { body, idempotencyKey });
  return r.booking;
}

/**
 * GET /bookings → `{bookings, timezone}` (решение John перед волной 2):
 * мои записи, новые сверху, и пояс салона, в котором их показывать.
 * `timezone` — `null`, если сервер его не прислал (старый ответ): экран
 * тогда держит прежний пояс, а не выдумывает свой.
 */
export interface BookingList {
  bookings: Booking[];
  timezone: string | null;
}

export async function getMyBookingList(signal?: AbortSignal): Promise<BookingList> {
  const r = await apiRequest<{ bookings?: unknown; timezone?: unknown }>('GET', '/bookings', { signal });
  if (!Array.isArray(r?.bookings)) throw new TypeError('GET /bookings: в ответе нет массива bookings');
  const tz = typeof r.timezone === 'string' && r.timezone.length > 0 ? r.timezone : null;
  return { bookings: r.bookings as Booking[], timezone: tz };
}

/** GET /bookings/declined → `{bookings}` — отклонённые за две недели (с причиной). */
export async function getDeclinedBookings(signal?: AbortSignal): Promise<Booking[]> {
  const r = await apiRequest<{ bookings?: unknown }>('GET', '/bookings/declined', { signal });
  if (!Array.isArray(r?.bookings)) throw new TypeError('GET /bookings/declined: в ответе нет массива bookings');
  return r.bookings as Booking[];
}

/**
 * GET /bookings/{id} → `{booking, schedule}`. `schedule` рисует сервер, он
 * единственный автор: только уведомления этой записи, адресованные тому, кто
 * смотрит, и только те, что сервер действительно отправит или отправил.
 */
export function getBooking(id: string, signal?: AbortSignal): Promise<{ booking: Booking; schedule: ScheduleItem[] }> {
  return apiRequest('GET', `/bookings/${encodeURIComponent(id)}`, { signal });
}

/**
 * PATCH /bookings/{id} `{status:'cancelled'}` → `{booking}`. Клиентка может
 * только отменить (из pending и confirmed). Отказы: 409 bad_transition /
 * stale / slot_taken, 403 forbidden, 404.
 */
export async function cancelBooking(id: string): Promise<Booking> {
  const r = await apiRequest<{ booking: Booking }>('PATCH', `/bookings/${encodeURIComponent(id)}`, {
    body: { status: 'cancelled' },
  });
  return r.booking;
}
