// Записи клиентки: «мои записи» с сервера, заявка, отмена, расписание
// уведомлений вокруг визита.
//
// Запись — это ЗАЯВКА, а не автобронь. Анжелика ведёт параллельные записи по
// телефону и из инстаграма, поэтому выбранное время не занимает себя само:
// заявка уходит мастеру, мастер принимает или отклоняет. Занятым считается
// только подтверждённое — это решает сервер (GET /slots).
//
// ИСТОЧНИК ПРАВДЫ — СЕРВЕР (GET /bookings, GET /bookings/declined). Здесь —
// только память этого запуска: ни в localStorage, ни куда-либо ещё записи не
// пишутся. Прежняя демо-база (38 записей с выдуманными клиентками) и
// хранилище `anzh_appointments_v2` убраны: демо-записи всплывали у живого
// человека как «его» история, а «мои записи» искались по имени — чужие.
//
// Время. Сервер хранит и отдаёт UTC (`starts_at`); день и час на экране — по
// часовому поясу САЛОНА, который приходит в ответе GET /slots (`timezone`).
// Не по поясу телефона: туристка из другого пояса иначе увидит «не тот» час.

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { findService, type Service } from '../data/services';
import {
  cancelBooking,
  createBooking,
  getBooking,
  getDeclinedBookings,
  getMyBookingList,
  type Booking,
  type BookingStatus,
  type CreateBookingBody,
  type ScheduleItem,
} from './api/bookings';
import { formatAmount, formatPrice, priceSourceOf, visitTotal, type PriceSource } from './money';
import { ApiError, isAbortError, sessionState, subscribeSession } from './session';

export type ApptStatus =
  | 'pending'      // ждёт решения мастера
  | 'confirmed'    // мастер принял
  | 'declined'     // мастер отклонил
  | 'offered'      // (нет на сервере этой ночью; тип оставлен для кабинета)
  | 'completed'    // процедура прошла (на сервере — done)
  | 'cancelled'    // клиентка отменила
  | 'no-show';     // не пришла (на сервере — no_show)

export interface Appointment {
  id: string;
  /** День визита по поясу салона, yyyy-mm-dd. */
  dateISO: string;
  /** Время начала по поясу салона, «16:30». */
  slot: string;
  serviceId: string;
  /** Остальные процедуры того же визита (serviceId — первая). */
  extras?: string[];
  clientName: string;
  clientInstagram?: string;
  clientTgUsername?: string;
  clientPhone?: string;
  comment?: string;
  status: ApptStatus;
  offeredDateISO?: string;
  offeredSlot?: string;
  declineReason?: string;
  /** Фактически оплачено, основные единицы `currency` (paid_minor / 100). Нет — не указано, не ноль. */
  amount?: number;
  createdAt: number;
  // ── поля сервера ──
  /** Начало визита, UTC ISO — как прислал сервер. */
  startsAt?: string;
  durationMin?: number;
  /** Итог визита, посчитанный сервером (минорные единицы `currency`). */
  totalMinor?: number;
  paidMinor?: number | null;
  currency?: string;
  staffName?: string;
  /** Названия процедур, зафиксированные в записи (прайс меняется, история нет). */
  itemTitles?: Array<{ ru: string; en: string }>;
}

// ── Даты ────────────────────────────────────────────────────────────────────

export const toISODate = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};
export const fromISODate = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
};

/**
 * Пояс салона. Пока сервер его не назвал (первый ответ GET /slots), берётся
 * пояс Батуми — там салон, и тот же пояс стоит в настройке стенда.
 */
const DEFAULT_SALON_TZ = 'Asia/Tbilisi';
let salonTimeZone = DEFAULT_SALON_TZ;

const validTz = (tz: string) => {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
};

/** Запомнить пояс салона из ответа сервера (GET /slots → timezone). */
export function setSalonTimeZone(tz: unknown) {
  if (typeof tz === 'string' && tz && tz !== salonTimeZone && validTz(tz)) {
    salonTimeZone = tz;
    items = items.map((a) => (a.startsAt ? { ...a, ...localParts(a.startsAt) } : a));
    emit();
  }
}
export const salonTz = () => salonTimeZone;

/**
 * Можно ли записаться на услугу через приложение (курс — нет: на экране у
 * курса «Написать Анжелике», в записи его нет). Правило живёт рядом с типом
 * услуги (data/services.ts) — его же читают план, подсказки, сочетания и
 * помощник; отсюда — для экранов записи.
 */
export { isBookable } from '../data/services';

/** День и время момента по поясу салона. */
export function salonParts(at: Date | string, tz = salonTimeZone): { dateISO: string; slot: string } | null {
  const d = typeof at === 'string' ? new Date(at) : at;
  if (Number.isNaN(d.getTime())) return null;
  const f = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });
  const p: Record<string, string> = {};
  for (const x of f.formatToParts(d)) p[x.type] = x.value;
  return { dateISO: `${p.year}-${p.month}-${p.day}`, slot: `${p.hour}:${p.minute}` };
}

function localParts(startsAt: string): { dateISO: string; slot: string } {
  return salonParts(startsAt) ?? { dateISO: '', slot: '' };
}

/** Сегодня по поясу салона, yyyy-mm-dd. */
export const salonToday = () => salonParts(new Date())?.dateISO ?? toISODate(new Date());

/** yyyy-mm-dd + n дней (календарная арифметика, без поясов). */
export function addDaysISO(iso: string, n: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, '0')}-${String(t.getUTCDate()).padStart(2, '0')}`;
}

/** День недели и месяц календарной даты yyyy-mm-dd (0 — воскресенье). */
export function isoWeekday(iso: string): { dow: number; day: number; month: number } {
  const [y, m, d] = iso.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d, 12));
  return { dow: t.getUTCDay(), day: t.getUTCDate(), month: t.getUTCMonth() };
}

/** «12 окт, 14:00» по поясу салона — для строк расписания уведомлений. */
export function formatWhen(at: string, lang: 'ru' | 'en' = 'ru'): string {
  const p = salonParts(at);
  if (!p) return '';
  return `${formatShort(p.dateISO, lang)}, ${p.slot}`;
}

// ── Провод → экран ──────────────────────────────────────────────────────────

const STATUS_FROM_SERVER: Record<BookingStatus, ApptStatus> = {
  pending: 'pending',
  confirmed: 'confirmed',
  declined: 'declined',
  done: 'completed',
  no_show: 'no-show',
  cancelled: 'cancelled',
};

export function fromBooking(b: Booking): Appointment {
  const slugs = (b.items ?? []).map((i) => i.slug).filter((s): s is string => typeof s === 'string' && s.length > 0);
  const created = b.created_at ? Date.parse(b.created_at) : NaN;
  return {
    id: b.id,
    ...localParts(b.starts_at),
    serviceId: slugs[0] ?? '',
    extras: slugs.length > 1 ? slugs.slice(1) : undefined,
    clientName: b.client_name ?? '',
    comment: b.client_note ?? undefined,
    status: STATUS_FROM_SERVER[b.status] ?? 'pending',
    declineReason: b.decline_reason ?? undefined,
    amount: typeof b.paid_minor === 'number' ? b.paid_minor / 100 : undefined,
    createdAt: Number.isFinite(created) ? created : 0,
    startsAt: b.starts_at,
    durationMin: b.duration_min,
    totalMinor: b.total_minor,
    paidMinor: b.paid_minor ?? null,
    currency: b.currency,
    staffName: b.staff_name ?? undefined,
    itemTitles: (b.items ?? []).map((i) => ({ ru: i.title_ru ?? i.slug ?? '', en: i.title_en ?? i.title_ru ?? i.slug ?? '' })),
  };
}

/** Название визита: процедуры из каталога, иначе — зафиксированные в записи. */
export function apptTitle(a: Appointment, lang: 'ru' | 'en', titleOf: (id: string) => string | undefined): string {
  const ids = apptServiceIds(a);
  const names = ids.map((id, i) => titleOf(id) ?? a.itemTitles?.[i]?.[lang] ?? id).filter(Boolean);
  return names.join(' + ');
}

// ── Мои записи (память запуска) ─────────────────────────────────────────────

export interface MyBookingsState {
  items: Appointment[];
  status: 'idle' | 'loading' | 'ready' | 'error';
  /** Ошибка ≠ пустота: экран показывает её, а не «записей пока нет». */
  error: ApiError | null;
  /** Когда список последний раз пришёл с сервера. */
  loadedAt: number | null;
}

let items: Appointment[] = [];
let meta: Omit<MyBookingsState, 'items'> = { status: 'idle', error: null, loadedAt: null };
let snapshot: MyBookingsState = { items, ...meta };
let lastCreated: Appointment | null = null;
const listeners = new Set<() => void>();

function emit() {
  snapshot = { items, ...meta };
  for (const l of listeners) {
    try { l(); } catch { /* подписчик не вправе уронить остальных */ }
  }
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => { listeners.delete(l); };
}

const byCreatedDesc = (a: Appointment, b: Appointment) => b.createdAt - a.createdAt;

function upsert(list: Appointment[], a: Appointment): Appointment[] {
  const rest = list.filter((x) => x.id !== a.id);
  return [a, ...rest].sort(byCreatedDesc);
}

// Сессия потеряна насовсем — записи прошлого входа больше не наши.
subscribeSession(() => {
  if (sessionState().status === 'guest' && (items.length || meta.status !== 'idle' || lastCreated)) {
    items = [];
    lastCreated = null;
    meta = { status: 'idle', error: null, loadedAt: null };
    emit();
  }
});

let inflight: Promise<void> | null = null;

/**
 * Перечитать мои записи: GET /bookings и GET /bookings/declined (отказ с
 * причиной — клиентка видит ответ, а не тишину). Одно обещание на всех
 * одновременных вызывающих. Не бросает: отказ ложится в `error`, прежний
 * список остаётся на экране.
 */
export function loadMyBookings(): Promise<void> {
  if (inflight) return inflight;
  meta = { ...meta, status: 'loading' };
  emit();
  inflight = Promise.all([getMyBookingList(), getDeclinedBookings()])
    .then(
      ([mine, declined]) => {
        /* Время «моих записей» — в поясе САЛОНА из этого же ответа GET /bookings
           (`timezone`), а не в поясе телефона и не в последнем поясе /slots:
           туристка в другом поясе видит то же «14:00», что и Анжелика. Пояс —
           ДО перевода записей, чтобы fromBooking посчитал их уже в нём. Сервер
           пояс не прислал — прежний остаётся, свой не выдумываем. */
        setSalonTimeZone(mine.timezone);
        const map = new Map<string, Appointment>();
        for (const b of [...declined, ...mine.bookings]) map.set(b.id, fromBooking(b));
        items = [...map.values()].sort(byCreatedDesc);
        meta = { status: 'ready', error: null, loadedAt: Date.now() };
      },
      (e: unknown) => {
        const error = e instanceof ApiError
          ? e
          : isAbortError(e)
            ? new ApiError(0, 'aborted', 'GET /bookings: оборвано')
            // Сервер ответил, но не тем: это не «нет связи».
            : new ApiError(200, 'bad_response', 'GET /bookings: ответ не разобран');
        meta = { ...meta, status: 'error', error };
      },
    )
    .finally(() => {
      inflight = null;
      emit();
    });
  return inflight;
}

export const myBookingsState = (): MyBookingsState => snapshot;

/** Мои записи для React. Загрузку запускает первый подписчик (и `loadMyBookings()`). */
export function useMyBookings(): MyBookingsState {
  const s = useSyncExternalStore(subscribe, myBookingsState, myBookingsState);
  useEffect(() => {
    if (meta.status === 'idle') void loadMyBookings();
  }, []);
  return s;
}

/** Только список (совместимость со старыми вызывающими). Сам ничего не грузит. */
export function useAppointments(): Appointment[] {
  return useSyncExternalStore(subscribe, () => snapshot.items, () => snapshot.items);
}

export const findAppointment = (id: string) => items.find((a) => a.id === id);

/** Заявка, только что созданная в этом запуске, — для экрана «заявка отправлена». */
export const lastCreatedAppointment = (): Appointment | null => lastCreated;

export function useLastCreatedAppointment(): Appointment | null {
  return useSyncExternalStore(subscribe, lastCreatedAppointment, lastCreatedAppointment);
}

// ── Действия клиентки ───────────────────────────────────────────────────────

/**
 * Отправить заявку (POST /bookings). `idempotencyKey` — один на намерение:
 * вызывающий создаёт его при первом нажатии и повторяет тот же при повторе
 * того же состава. Бросает `ApiError` — экран обязан показать отказ у поля.
 */
export async function requestBooking(body: CreateBookingBody, idempotencyKey: string): Promise<Appointment> {
  const booking = await createBooking(body, idempotencyKey);
  const appt = fromBooking(booking);
  items = upsert(items, appt);
  lastCreated = appt;
  emit();
  return appt;
}

/** Отменить запись (PATCH status=cancelled). Бросает `ApiError`. */
export async function cancelAppointment(id: string): Promise<Appointment> {
  const booking = await cancelBooking(id);
  const appt = fromBooking(booking);
  items = upsert(items, appt);
  if (lastCreated?.id === appt.id) lastCreated = appt;
  emit();
  return appt;
}

// ── Расписание уведомлений вокруг визита ───────────────────────────────────

export interface ScheduleState {
  status: 'loading' | 'ready' | 'error';
  schedule: ScheduleItem[];
  error: ApiError | null;
  /**
   * Booking status from the SAME answer as `schedule` (КТ-7 С2): the screen's texts
   * «pending / decided» must not mix answers of different age. `null` — not loaded yet
   * or the answer had no booking. While the same booking is re-read (retry) or the re-read
   * failed, the status of its last answer is kept: «not loaded» is not «pending» (Цензор Ц-5).
   */
  bookingStatus: ApptStatus | null;
}

export interface ScheduleView extends ScheduleState {
  /** Спросить ещё раз (после отказа). */
  retry: () => void;
}

/**
 * GET /bookings/{id} → schedule. Сервер — единственный автор: экран
 * показывает ровно этот список и ничего не дописывает от себя.
 * Эффект рвёт свой запрос в очистке (AbortController) — обещание не
 * хранится, поэтому двойной маунт StrictMode просто спросит ещё раз.
 */
export function useBookingSchedule(id: string | null | undefined): ScheduleView {
  const [state, setState] = useState<ScheduleState>({ status: 'loading', schedule: [], error: null, bookingStatus: null });
  const [tick, setTick] = useState(0);
  // The status of the last answer and whose it is: a retry of the same booking keeps it.
  const known = useRef<{ id: string; status: ApptStatus | null } | null>(null);
  useEffect(() => {
    if (!id) {
      setState({ status: 'ready', schedule: [], error: null, bookingStatus: null });
      return;
    }
    const ctrl = new AbortController();
    let alive = true;
    const kept = known.current?.id === id ? known.current.status : null;
    setState({ status: 'loading', schedule: [], error: null, bookingStatus: kept });
    getBooking(id, ctrl.signal).then(
      (r) => {
        if (!alive) return;
        const schedule = Array.isArray(r?.schedule) ? r.schedule : [];
        const appt = r?.booking ? fromBooking(r.booking) : null;
        if (appt) {
          items = upsert(items, appt);
          if (lastCreated?.id === appt.id) lastCreated = appt;
          emit();
        }
        const bookingStatus = appt?.status ?? null;
        known.current = { id, status: bookingStatus };
        setState({ status: 'ready', schedule, error: null, bookingStatus });
      },
      (e: unknown) => {
        if (!alive || isAbortError(e)) return;
        setState({
          status: 'error',
          schedule: [],
          error: e instanceof ApiError ? e : new ApiError(0, 'bad_response', 'GET /bookings/{id}'),
          bookingStatus: kept,
        });
      },
    );
    return () => {
      alive = false;
      ctrl.abort();
    };
  }, [id, tick]);
  // Повтор после отказа — тем же эффектом.
  const retry = useCallback(() => setTick((x) => x + 1), []);
  return useMemo(() => ({ ...state, retry }), [state, retry]);
}

// ── Действия мастера (совместимость) ────────────────────────────────────────
// Кабинет (Ф-3) переводится на свой провод: GET /staff/bookings и
// PATCH /bookings/{id} с PIN (lib/api/staff.ts). Прежние функции меняли
// демо-базу на этом телефоне; теперь базы нет, и они НИЧЕГО не делают —
// честнее, чем показать мастеру «принято», которого клиентка не увидит.

/** @deprecated Кабинет: PATCH /bookings/{id} {status:'confirmed'} через lib/api/staff.ts. */
export function confirmAppointment(id: string) { void id; }
/** @deprecated Кабинет: PATCH /bookings/{id} {status:'declined', reason}. */
export function declineAppointment(id: string, reason?: string) { void id; void reason; }
/** @deprecated Статуса offered на сервере нет (ночью не делаем). */
export function offerAnotherTime(id: string, dateISO: string, slot: string) { void id; void dateISO; void slot; }
/** @deprecated Кабинет: PATCH /bookings/{id} {status:'done', paid_minor}. */
export function markCompleted(id: string, amount: number) { void id; void amount; }
/** @deprecated Кабинет: PATCH /bookings/{id} {status:'no_show'}. */
export function markNoShow(id: string) { void id; }

// ── Выборки ─────────────────────────────────────────────────────────────────

const ACTIVE: ApptStatus[] = ['pending', 'confirmed', 'offered'];

export const byDateAsc = (a: Appointment, b: Appointment) =>
  (a.startsAt ?? a.dateISO + a.slot).localeCompare(b.startsAt ?? b.dateISO + b.slot);

/** Предстоящие: ждут ответа или подтверждены, начало ещё впереди. */
export function getUpcoming(list: Appointment[] = items) {
  const now = Date.now();
  const today = salonToday();
  return list
    .filter((a) => ACTIVE.includes(a.status))
    .filter((a) => (a.startsAt ? Date.parse(a.startsAt) + (a.durationMin ?? 0) * 60_000 > now : a.dateISO >= today))
    .sort(byDateAsc);
}

/* Отклонённые заявки. Без этой выборки отказ ИСЧЕЗАЛ у клиентки: человек
   отправил заявку, ему отказали — и ответа он не видел никогда. Сервер
   отдаёт отказы за две недели (GET /bookings/declined). */
export function getDeclined(list: Appointment[] = items, days = 14) {
  const fromISO = addDaysISO(salonToday(), -days);
  return list
    .filter((a) => a.status === 'declined' && a.dateISO >= fromISO)
    .sort((a, b) => b.createdAt - a.createdAt);
}

export function getPast(list: Appointment[] = items) {
  return list
    .filter((a) => a.status === 'completed' || a.status === 'no-show' || a.status === 'cancelled' || a.status === 'declined')
    .sort((a, b) => b.dateISO.localeCompare(a.dateISO));
}

export function getPending(list: Appointment[] = items) {
  return list.filter((a) => a.status === 'pending').sort(byDateAsc);
}

export function getDay(list: Appointment[] = items, dateISO = salonToday()) {
  return list.filter((a) => a.dateISO === dateISO && ACTIVE.includes(a.status)).sort(byDateAsc);
}

/** Уникальные клиенты — для кабинета (считается по переданному списку). */
export interface ClientRow {
  key: string;
  name: string;
  instagram?: string;
  visits: number;
  spent: number;
  lastVisit?: string;
  noShows: number;
}

export function getClients(list: Appointment[] = items): ClientRow[] {
  const map = new Map<string, ClientRow>();
  for (const a of list) {
    const key = a.clientInstagram || a.clientName;
    const row = map.get(key) ?? { key, name: a.clientName, instagram: a.clientInstagram, visits: 0, spent: 0, noShows: 0 };
    if (a.status === 'completed') {
      row.visits += 1;
      row.spent += a.amount ?? 0;
      if (!row.lastVisit || a.dateISO > row.lastVisit) row.lastVisit = a.dateISO;
    }
    if (a.status === 'no-show') row.noShows += 1;
    map.set(key, row);
  }
  return [...map.values()].sort((a, b) => b.visits - a.visits);
}

/* ── Форматирование дат ── */
const WEEKDAY_RU = ['воскресенье', 'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота'];
const WEEKDAY_EN = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTH_GEN_RU = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
const MONTH_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const MONTH_SHORT_RU = ['ЯНВ', 'ФЕВ', 'МАР', 'АПР', 'МАЙ', 'ИЮН', 'ИЮЛ', 'АВГ', 'СЕН', 'ОКТ', 'НОЯ', 'ДЕК'];
const MONTH_SHORT_EN = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

export function formatLongDate(d: Date, lang: 'ru' | 'en' = 'ru') {
  if (lang === 'en') return `${WEEKDAY_EN[d.getDay()]}, ${d.getDate()} ${MONTH_EN[d.getMonth()]}`;
  const w = WEEKDAY_RU[d.getDay()];
  return `${w[0].toUpperCase()}${w.slice(1)} ${d.getDate()} ${MONTH_GEN_RU[d.getMonth()]}`;
}
export const formatWeekday = (d: Date, lang: 'ru' | 'en' = 'ru') =>
  lang === 'en' ? WEEKDAY_EN[d.getDay()] : WEEKDAY_RU[d.getDay()];
export const formatMonthShort = (d: Date, lang: 'ru' | 'en' = 'ru') =>
  lang === 'en' ? MONTH_SHORT_EN[d.getMonth()] : MONTH_SHORT_RU[d.getMonth()];
export const formatShort = (iso: string, lang: 'ru' | 'en' = 'ru') => {
  const d = fromISODate(iso);
  return `${d.getDate()} ${(lang === 'en' ? MONTH_SHORT_EN : MONTH_SHORT_RU)[d.getMonth()].toLowerCase()}`;
};

export const STATUS_LABEL: Record<ApptStatus, { ru: string; en: string; tone: 'wait' | 'ok' | 'bad' }> = {
  pending:   { ru: 'Ждёт подтверждения', en: 'Awaiting confirmation', tone: 'wait' },
  confirmed: { ru: 'Подтверждена',       en: 'Confirmed',             tone: 'ok' },
  offered:   { ru: 'Предложено другое время', en: 'New time offered',  tone: 'wait' },
  declined:  { ru: 'Отклонена',          en: 'Declined',              tone: 'bad' },
  completed: { ru: 'Завершена',          en: 'Completed',             tone: 'ok' },
  cancelled: { ru: 'Отменена',           en: 'Cancelled',             tone: 'bad' },
  'no-show': { ru: 'Не пришёл',          en: 'No-show',               tone: 'bad' },
};

/* ── Визит из нескольких процедур ──────────────────────────
   Анжелика часто делает две-три за один приход: чистка и следом уход,
   брови вместе с пилингом. Это одна заявка, а не несколько. */

export const apptServiceIds = (a: Appointment): string[] => [a.serviceId, ...(a.extras ?? [])].filter(Boolean);

/** Длительность визита: сервера, иначе — сумма по каталогу. */
export function apptDuration(a: Appointment): number {
  if (typeof a.durationMin === 'number') return a.durationMin;
  return apptServiceIds(a).reduce((sum, id) => sum + (findService(id)?.duration ?? 0), 0);
}

/** The visit's procedures as price sources from the current catalog; null — one is unknown. */
function catalogRows(a: Appointment): PriceSource[] | null {
  const ids = apptServiceIds(a);
  const rows: PriceSource[] = [];
  for (const id of ids) {
    const s = findService(id);
    if (!s) return null;
    rows.push(priceSourceOf(s));
  }
  return rows.length > 0 ? rows : null;
}

/**
 * Visit total in ITS OWN currency (K5, B1-B): the server's `total_minor` + `currency`,
 * else the sum of the catalog prices (one currency or nothing — lib/money.ts visitTotal).
 * No currency from the server — no sign: there is no "USD by default" any more
 * (it put lari under "$"). "from" — by the same rule as the booking screen
 * (visitTotal of the catalog rows): the booking itself carries no price_from.
 */
export function apptTotal(a: Appointment): PriceSource | null {
  const rows = catalogRows(a);
  const fromCatalog = rows ? visitTotal(rows) : null;
  if (typeof a.totalMinor === 'number') {
    return { priceMinor: a.totalMinor, currency: a.currency ?? null, priceFrom: fromCatalog?.priceFrom === true };
  }
  return fromCatalog;
}

/** "от 494 ₾", "$150"; null — nothing honest to show (hide the line). */
export function apptPriceLabel(a: Appointment, lang: 'ru' | 'en' = 'ru'): string | null {
  const total = apptTotal(a);
  return total ? formatPrice({ ...total, slug: null }, lang) : null;
}

/** Paid at the visit, in the visit's currency; null — not stated (not zero). */
export const apptPaidLabel = (a: Appointment, lang: 'ru' | 'en' = 'ru'): string | null =>
  formatAmount(a.paidMinor, a.currency, lang);
