// Провод кабинета студии: сотрудник и PIN, записи мастера, команда, прайс.
// Источник правды — server/openapi.yaml (теги «Команда», «Записи», «Каталог»).
//
// Правила папки — как в образце `api/me.ts`: только типы провода (имена
// полей как у сервера) и тонкие функции «один вызов — одна ручка»; в сеть —
// только через `apiRequest`; поле, которое сервер может не прислать, —
// необязательное в типе; перевод в форму экрана — у владельца экрана
// (`lib/staff.ts`, `lib/studio.ts`).
//
// ⚠️ PIN уходит только в теле запроса и нигде не остаётся: ни в хранилище,
// ни в памяти модуля, ни в журнале. Этот файл его не держит.
//
// Тип записи здесь свой (`StaffBooking`), а не из `api/bookings.ts`: тот
// файл — другой партии (Ф-2). Поля одни и те же — схема `Booking` openapi.

import { apiRequest } from '../session';

// ── Сотрудник и PIN ─────────────────────────────────────────────────────────

/** owner — владелица; admin — администратор студии [ПРЕДЛОЖЕНИЕ БЭКЕНДУ]; staff — мастер. */
export type StaffRole = 'staff' | 'owner' | 'admin';

/** Схема `StaffMember`. Ни PIN, ни его хэш сервер не отдаёт никогда. */
export interface StaffMember {
  telegram_id: number;
  name: string;
  title?: string | null;
  role: StaffRole;
  photo_url?: string | null;
  /** Какие процедуры ведёт — slug. */
  services?: string[];
  /** [ПРЕДЛОЖЕНИЕ] профиль для витрины «О нас → Команда» и карточки мастера */
  profile?: MemberProfile;
  /** [ПРЕДЛОЖЕНИЕ] PIN задала владелица — человеку предложат сменить при входе */
  must_change_pin?: boolean;
}

export interface Bi { ru: string; en: string }

/** [ПРЕДЛОЖЕНИЕ БЭКЕНДУ] Как человек выглядит для клиенток. Правит владелица. */
export interface MemberProfile {
  /** Ключ для данных приложения (anzhelika, mariya…); у новых — m<telegram_id> */
  key?: string;
  name: Bi;
  surname?: Bi | null;
  /** Должность на сайте: «Косметолог, владелица» */
  role: Bi;
  /** Короткая подпись под кружком: «Косметолог» */
  short?: Bi | null;
  /** Где в кадре лицо, % от левого/верхнего края */
  focus?: { x: number; y: number } | null;
  /** Регалии одной строкой */
  cred?: Bi | null;
  /** Чем занимается — пункты */
  does: { ru: string[]; en: string[] };
  instagram?: string | null;
  telegram?: string | null;
  phone?: string | null;
  /** Показывать контакты клиенткам в карточке */
  contacts_public?: boolean;
  /** Показывать человека в «Команде» на сайте */
  visible: boolean;
  /** Порядок в «Команде» */
  sort: number;
}

/** Публичная карточка — GET /team/public (без пропуска, только видимые). */
export interface PublicMember {
  key: string;
  name: Bi;
  surname?: Bi | null;
  role: Bi;
  short?: Bi | null;
  photo_url?: string | null;
  focus?: { x: number; y: number } | null;
  cred?: Bi | null;
  does?: { ru: string[]; en: string[] };
  services?: string[];
  is_admin?: boolean;
  instagram?: string | null;
  telegram?: string | null;
  phone?: string | null;
}

/** GET /staff/me → `{staff}`: сотрудник плюс состояние PIN в ЭТОЙ сессии. */
export interface StaffMe extends StaffMember {
  pin_set: boolean;
  /** PIN подтверждён в этой сессии (подтверждение живёт до конца сессии). */
  pin_confirmed: boolean;
}

/** GET /staff/me. Клиентке — 403 `forbidden`. Открыт без PIN. */
export async function getStaffMe(signal?: AbortSignal): Promise<StaffMe> {
  const r = await apiRequest<{ staff: StaffMe }>('GET', '/staff/me', { signal });
  return r.staff;
}

/**
 * POST /staff/pin — подтвердить PIN. Это не вход (вход был по initData),
 * а «за телефоном тот же человек». Отказы: 403 `bad_pin`, 422 `invalid`
 * (не 4–8 цифр), 422 `pin_not_set`, 423 `pin_locked` (10 неверных подряд —
 * заперт на сутки; `locked_until` в конверте → `ApiError.details`; пока
 * заперт, PIN не сверяется даже верный), 429 `rate_limited` (5 попыток за
 * 5 минут, ведро общее с /staff/pin/set), 503 `unavailable` (счётчик
 * недоступен — отказ, а не пропуск).
 */
export function confirmPin(pin: string): Promise<{ confirmed: true }> {
  return apiRequest('POST', '/staff/pin', { body: { pin } });
}

/**
 * POST /staff/pin/set — первый PIN (без `currentPin`) или смена своего.
 * НИКОГДА не выдаёт подтверждение: кабинет открывает только /staff/pin.
 * Порядок отказов — как в api/_domain/team.js setOwnPin: 422 `bad_pin`
 * (новый — не ровно 4 цифры, текущий — не 4–8), 422 `pin_leaked` (заводской
 * или слишком простой код; message сервера говорит, какой), 409
 * `pin_already_set` (PIN задан, текущего нет), 423 `pin_locked`, 403
 * `bad_pin` (неверный текущий; 10-й подряд → 423), 429, 503. Совпадение с
 * чужим PIN сервер НЕ проверяет (правило снято: оно было оракулом).
 */
export function setPin(pin: string, currentPin?: string): Promise<{ updated: true }> {
  const body: { pin: string; current_pin?: string } = { pin };
  if (currentPin !== undefined) body.current_pin = currentPin;
  return apiRequest('POST', '/staff/pin/set', { body });
}

// ── Записи ──────────────────────────────────────────────────────────────────

export type BookingStatus = 'pending' | 'confirmed' | 'declined' | 'done' | 'no_show' | 'cancelled';

export interface BookingItem {
  slug?: string;
  title_ru?: string;
  title_en?: string;
  /** Цена на момент записи — прайс меняется, история нет. */
  price_minor?: number;
}

/** Схема `Booking`. Деньги — в минорных единицах валюты записи. */
export interface StaffBooking {
  id: string;
  telegram_id: number;
  client_name?: string | null;
  staff_id: number;
  staff_name?: string | null;
  starts_at: string;
  duration_min: number;
  status: BookingStatus;
  total_minor: number;
  /** Фактически оплачено при `done`; null — не указано. */
  paid_minor?: number | null;
  currency: string;
  discount_percent?: number;
  /** Может содержать сведения о здоровье: только на экран, никуда больше. */
  client_note?: string | null;
  decline_reason?: string | null;
  created_at?: string;
  items: BookingItem[];
  /** [ПРЕДЛОЖЕНИЕ] 'model' — запись моделью на день обучения (цена для моделей) */
  kind?: 'regular' | 'model';
  training_day_id?: string | null;
}

export interface StaffBookingsQuery {
  status?: BookingStatus;
  /** ISO date-time. */
  from?: string;
  to?: string;
  /** `all` сервер выполняет только владелице; мастеру всё равно отдаёт своё. */
  scope?: 'mine' | 'all';
}

/** GET /staff/bookings → `{bookings, timezone}` (схема `BookingList` с поясом). */
export interface StaffBookingList {
  bookings: StaffBooking[];
  /**
   * IANA-пояс салона (SALON_TIMEZONE сервера): в нём кабинет считает день и
   * время визита, а не в поясе телефона. Необязателен в типе: не прислал —
   * остаётся прежний известный пояс.
   */
  timezone?: string;
}

/** GET /staff/bookings — день мастера и очередь заявок (staff + PIN). */
export async function getStaffBookings(q: StaffBookingsQuery, signal?: AbortSignal): Promise<StaffBookingList> {
  const r = await apiRequest<StaffBookingList>('GET', '/staff/bookings', {
    query: { status: q.status, from: q.from, to: q.to, scope: q.scope },
    signal,
  });
  return { bookings: r.bookings, timezone: r.timezone };
}

export interface BookingDecision {
  status: BookingStatus;
  /** Обязательна при `declined` (422 `reason_required`), ≤ 500. */
  reason?: string;
  /** Только вместе со `status: 'done'`; иначе 422 `invalid`. */
  paid_minor?: number | null;
}

/**
 * PATCH /bookings/{id}. Мастер: pending → confirmed | declined;
 * confirmed → done | no_show | cancelled. Отказы: 409 `slot_taken`,
 * `bad_transition`, `stale`; 422 `reason_required`; 403 `pin_required`.
 */
export async function patchBooking(id: string, body: BookingDecision): Promise<StaffBooking> {
  const r = await apiRequest<{ booking: StaffBooking }>('PATCH', `/bookings/${encodeURIComponent(id)}`, { body });
  return r.booking;
}

// ── Команда (владелица + PIN) ───────────────────────────────────────────────

/**
 * GET /team — только для команды студии (007 M1: публично он отдавал
 * telegram_id и роли; экранам он нужен лишь в кабинете). Идёт с пропуском, как
 * соседние ручки кабинета: без входа — 401 `no_session`, клиентке — 403
 * `forbidden`, без подтверждённого PIN — 403 `pin_required`, если сервер его
 * спросит. Отказ разбирает `cabinetDenied` у вызывающего. Ответ прежний: `{team}`.
 */
export async function getTeam(signal?: AbortSignal): Promise<StaffMember[]> {
  const r = await apiRequest<{ team: StaffMember[] }>('GET', '/team', { signal });
  return r.team;
}

export interface TeamMemberInput {
  telegram_id: number;
  name: string;
  title?: string | null;
  role?: StaffRole;
}

/**
 * POST /team — добавить или вернуть сотрудника по telegram_id. Повтор с тем
 * же telegram_id обновляет запись. Отказы: 403 `owner_unique`, 422
 * `bad_telegram_id` / `bad_name`.
 */
export async function addTeamMember(input: TeamMemberInput): Promise<StaffMember> {
  const r = await apiRequest<{ staff: StaffMember }>('POST', '/team', { body: input });
  return r.staff;
}

/** DELETE /team/{telegramId} — снять доступ (мягко). Себе — 422 `self_removal`. */
export function removeTeamMember(telegramId: number): Promise<{ deactivated: number }> {
  return apiRequest('DELETE', `/team/${telegramId}`);
}

/** PUT /team/{telegramId}/services — полная замена набора процедур мастера. */
export function setMemberServices(telegramId: number, slugs: string[]): Promise<{ staff_id: number; services: string[] }> {
  return apiRequest('PUT', `/team/${telegramId}/services`, { body: { slugs } });
}

/** POST /team/{telegramId}/pin/reset — стереть PIN мастера. Себе — 422 `self_reset`. */
export interface MemberPatch {
  name?: string;
  title?: string | null;
  role?: 'staff' | 'admin';
  photo_url?: string | null;
  profile?: Partial<MemberProfile>;
}

/** [ПРЕДЛОЖЕНИЕ] PATCH /team/{id} — профиль, роль, фото. Только владелица с PIN. */
export async function patchTeamMember(telegramId: number, patch: MemberPatch): Promise<StaffMember> {
  const r = await apiRequest<{ staff: StaffMember }>('PATCH', `/team/${telegramId}`, { body: patch });
  return r.staff;
}

/** [ПРЕДЛОЖЕНИЕ] POST /team/{id}/pin/set — владелица задаёт PIN (4 цифры); человек сменит его при входе. */
export function setMemberPin(telegramId: number, pin: string): Promise<{ updated: true; must_change_pin: boolean }> {
  return apiRequest('POST', `/team/${telegramId}/pin/set`, { body: { pin } });
}

/** [ПРЕДЛОЖЕНИЕ] PUT /team/order — порядок в «Команде» на сайте. */
export async function setTeamOrder(order: number[]): Promise<StaffMember[]> {
  const r = await apiRequest<{ team: StaffMember[] }>('PUT', '/team/order', { body: { order } });
  return r.team;
}

/** [ПРЕДЛОЖЕНИЕ] GET /team/public — команда для витрины, без пропуска. */
export async function getPublicTeam(signal?: AbortSignal): Promise<PublicMember[]> {
  const r = await apiRequest<{ team: PublicMember[] }>('GET', '/team/public', { auth: 'none', signal });
  return Array.isArray(r?.team) ? r.team : [];
}

export function resetMemberPin(telegramId: number): Promise<{ reset: true }> {
  return apiRequest('POST', `/team/${telegramId}/pin/reset`);
}

// ── Прайс (владелица + PIN) ─────────────────────────────────────────────────

export type ServiceKind = 'procedure' | 'training' | 'analysis';
export type ServiceCategory =
  | 'inj' | 'clean' | 'peel' | 'apparatus' | 'care' | 'derma' | 'brows' | 'training' | 'analysis';

/** Схема `Service`. */
export interface WireService {
  slug: string;
  kind: ServiceKind;
  category?: ServiceCategory;
  zone?: 'face' | 'body' | 'brows' | 'general';
  title: { ru: string; en: string };
  subtitle?: { ru?: string | null; en?: string | null };
  description?: { ru?: string | null; en?: string | null };
  price_minor?: number | null;
  currency?: string | null;
  price_from?: boolean;
  stars_amount?: number | null;
  duration_min?: number | null;
  days?: number | null;
  includes?: string[];
  contraindications?: string[];
  photo_url?: string | null;
  sort?: number;
  /** [ПРЕДЛОЖЕНИЕ] через сколько дней после визита бот напомнит о повторе; null — не напоминать */
  repeat_after_days?: number | null;
  /** [ПРЕДЛОЖЕНИЕ] цена для моделей в день обучения (себестоимость), минорные; null — моделям не предлагается */
  model_price_minor?: number | null;
}

/** Схема `ServicePatch`: только присланные поля, `null` стирает. */
export interface ServicePatch {
  title_ru?: string;
  title_en?: string;
  subtitle_ru?: string | null;
  subtitle_en?: string | null;
  description_ru?: string | null;
  description_en?: string | null;
  price_minor?: number | null;
  currency?: string | null;
  price_from?: boolean;
  duration_min?: number | null;
  days?: number | null;
  includes?: string[];
  contraindications?: string[];
  photo_url?: string | null;
  sort?: number;
  repeat_after_days?: number | null;
  model_price_minor?: number | null;
}

/** Схема `ServiceCreate`. */
export interface ServiceCreate extends ServicePatch {
  slug: string;
  kind: ServiceKind;
  category: ServiceCategory;
  zone?: 'face' | 'body' | 'brows' | 'general';
  title_ru: string;
}

/**
 * GET /services — витрина глазами кабинета: снятые с витрины не приходят.
 * С пропуском, хотя ручка публичная: ответ без Authorization край Vercel
 * держит до 30 с (api/_lib/http.js publicReadCacheHeaders), и владелица
 * сразу после своей правки видела бы прежний прайс (Хейтер, волна 4).
 * Витрина клиентки (lib/api/catalog.ts getServices) — без пропуска: там кэш
 * края уместен.
 */
export async function getLiveServices(signal?: AbortSignal): Promise<WireService[]> {
  const r = await apiRequest<{ services: WireService[] }>('GET', '/services', { signal });
  return r.services;
}

/** GET /staff/services/archived — снятые с витрины (владелица + PIN). */
export async function getArchivedServices(signal?: AbortSignal): Promise<WireService[]> {
  const r = await apiRequest<{ services: WireService[] }>('GET', '/staff/services/archived', { signal });
  return r.services;
}

/** PATCH /services/{slug}. Пустая правка — 422 `empty_patch`: не слать. */
export async function patchService(slug: string, patch: ServicePatch): Promise<WireService> {
  const r = await apiRequest<{ service: WireService }>('PATCH', `/services/${encodeURIComponent(slug)}`, { body: patch });
  return r.service;
}

/**
 * POST /services с Idempotency-Key: ключ создаётся один раз на намерение
 * (одну открытую форму) и переживает повторы. 409 `slug_taken` — адрес
 * занят, в том числе процедурой в архиве.
 */
export async function createService(input: ServiceCreate, idempotencyKey: string): Promise<WireService> {
  const r = await apiRequest<{ service: WireService }>('POST', '/services', { body: input, idempotencyKey });
  return r.service;
}

/** DELETE /services/{slug} — снять с витрины (мягко: история визитов остаётся). */
export function archiveService(slug: string): Promise<{ archived: string }> {
  return apiRequest('DELETE', `/services/${encodeURIComponent(slug)}`);
}

/** POST /services/{slug}/restore — вернуть на витрину. */
export function restoreService(slug: string): Promise<{ restored: string }> {
  return apiRequest('POST', `/services/${encodeURIComponent(slug)}/restore`);
}
