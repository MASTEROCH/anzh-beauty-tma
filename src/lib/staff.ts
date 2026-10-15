// Кто вошёл в кабинет и что ему видно — со слов СЕРВЕРА.
//
// Роль и право даёт сервер: вход — по подписи Telegram, роль — из базы
// (GET /staff/me), PIN подтверждает, что за телефоном тот же человек
// (POST /staff/pin). Здесь только память об ответах сервера на время
// запуска. PIN не хранится нигде: ни в localStorage, ни в памяти модуля —
// он живёт в поле ввода до нажатия и уходит в тело одного запроса.
//
// Два уровня, как и раньше:
//   owner — Анжелика: деньги салона целиком, чужие записи, прайс, команда,
//           анкеты клиенток (если сервер включил флаг `health`).
//   staff — мастер: СВОЙ день, свои клиентки, свой доход. Анкет нет вовсе.
// Условие экрана пишется тем же выражением, что серверное: «владелица» —
// это `role === 'owner'` из ответа сервера, а не что-то вычисленное здесь.
//
// Прежняя команда-заготовка с PIN 2024/1111/2222 и «кто сейчас в кабинете»
// в localStorage убраны совсем (разовая чистка старых ключей — legacyStorage).

import { useSyncExternalStore } from 'react';
import { ApiError, isAbortError } from './session';
import { salonParts, salonTz } from './appointments';
import {
  getStaffMe, confirmPin, setPin,
  type StaffMe, type StaffRole,
} from './api/staff';

export type { StaffMe, StaffRole } from './api/staff';

/**
 * Где человек в кабинете:
 *   idle       — ещё не спрашивали сервер;
 *   checking   — идёт GET /staff/me;
 *   not_staff  — сервер ответил 403: это не сотрудник;
 *   need_setup — PIN ещё не задан (`pin_set=false`);
 *   need_pin   — PIN задан, в этой сессии не подтверждён (или вышли кнопкой);
 *   open       — подтверждён, кабинет открыт;
 *   error      — сеть или сервер не ответили: это НЕ «вы не сотрудник».
 */
export type CabinetPhase = 'idle' | 'checking' | 'not_staff' | 'need_setup' | 'need_pin' | 'open' | 'error';

export interface CabinetState {
  phase: CabinetPhase;
  me: StaffMe | null;
  /**
   * Последний отказ: при phase=error — почему не узнали, кто вы; при смене
   * пути (PIN сбросили → задать; PIN уже задан → ввести) — почему путь сменился.
   */
  error: ApiError | null;
}

let state: CabinetState = { phase: 'idle', me: null, error: null };
/**
 * Человек нажал «Выйти». Сервер держит подтверждение до конца сессии, но
 * кнопка «Выйти» обещает, что следующий, кто возьмёт телефон, без PIN не
 * войдёт. Поэтому после выхода PIN спрашивается снова, даже если сервер
 * помнит подтверждение. Живёт в памяти запуска, не в хранилище.
 */
let lockedByExit = false;
let inflight: Promise<CabinetState> | null = null;

const listeners = new Set<() => void>();
function set(next: CabinetState): void {
  state = next;
  for (const l of listeners) {
    try { l(); } catch { /* подписчик не вправе уронить остальных */ }
  }
}
export function subscribeCabinet(l: () => void): () => void {
  listeners.add(l);
  return () => { listeners.delete(l); };
}
export const cabinetState = (): CabinetState => state;

export function useCabinet(): CabinetState {
  return useSyncExternalStore(subscribeCabinet, cabinetState, cabinetState);
}

function phaseOf(me: StaffMe): CabinetPhase {
  if (!me.pin_set) return 'need_setup';
  if (me.pin_confirmed && !lockedByExit) return 'open';
  return 'need_pin';
}

function asApiError(e: unknown): ApiError {
  if (e instanceof ApiError) return e;
  return new ApiError(0, isAbortError(e) ? 'aborted' : 'network', 'кабинет: сбой');
}

/**
 * Спросить сервер, кто я как сотрудник. Одно обещание на всех одновременных
 * вызывающих (и на двойной маунт StrictMode). Не бросает.
 */
export function checkCabinet(): Promise<CabinetState> {
  if (inflight) return inflight;
  set({ phase: 'checking', me: state.me, error: null });
  inflight = getStaffMe()
    .then(
      (me) => {
        const next: CabinetState = { phase: phaseOf(me), me, error: null };
        set(next);
        return next;
      },
      (e: unknown) => {
        const err = asApiError(e);
        // 403 на /staff/me — «не сотрудник». Любой другой отказ — сбой, и
        // говорить человеку «вы не мастер» на обрыве сети нельзя.
        const next: CabinetState = err.status === 403
          ? { phase: 'not_staff', me: null, error: null }
          : { phase: 'error', me: null, error: err };
        set(next);
        return next;
      },
    )
    .finally(() => { inflight = null; });
  return inflight;
}

/**
 * Подтвердить PIN (POST /staff/pin). Бросает `ApiError` — текст для человека
 * даёт `pinErrorText`. PIN не запоминается.
 */
export async function enterPin(pin: string): Promise<void> {
  try {
    await confirmPin(pin);
  } catch (e) {
    const err = asApiError(e);
    // Сервер говорит, что PIN не задан (сбросила владелица) — ведём задавать.
    if (err.code === 'pin_not_set' && state.me) {
      set({ phase: 'need_setup', me: { ...state.me, pin_set: false, pin_confirmed: false }, error: err });
    }
    throw err;
  }
  lockedByExit = false;
  if (state.me) set({ phase: 'open', me: { ...state.me, pin_set: true, pin_confirmed: true }, error: null });
  else set({ phase: 'open', me: null, error: null });
}

/**
 * Первый PIN: POST /staff/pin/set без текущего, затем POST /staff/pin —
 * задание PIN подтверждения не даёт (openapi), кабинет открывает только
 * подтверждение. Бросает `ApiError`.
 */
export async function createPin(pin: string): Promise<void> {
  try {
    await setPin(pin);
  } catch (e) {
    const err = asApiError(e);
    // Задан параллельно (второе устройство) — дальше только ввод.
    if (err.code === 'pin_already_set' && state.me) {
      set({ phase: 'need_pin', me: { ...state.me, pin_set: true }, error: err });
    }
    throw err;
  }
  if (state.me) set({ ...state, me: { ...state.me, pin_set: true } });
  await enterPin(pin);
}

/** Смена своего PIN (текущий обязателен). Подтверждение не меняется. Бросает `ApiError`. */
export async function changePin(current: string, next: string): Promise<void> {
  await setPin(next, current);
}

/** «Выйти»: кабинет закрыт, следующий вход — снова с PIN. */
export function lockCabinet(): void {
  lockedByExit = true;
  if (state.me) set({ phase: state.me.pin_set ? 'need_pin' : 'need_setup', me: { ...state.me, pin_confirmed: false }, error: null });
  else set({ phase: 'idle', me: null, error: null });
}

/**
 * Разбор отказа любой ручки кабинета. `pin_required` — подтверждение
 * умерло вместе с сессией (перевход выдал новый пропуск): кабинет просит PIN
 * снова. `accessLost` — сервер больше не считает человека сотрудником
 * (доступ снят). Возвращает true, если отказ обработан здесь.
 */
export function cabinetDenied(e: unknown, opts: { accessCheck?: boolean } = {}): boolean {
  if (!(e instanceof ApiError)) return false;
  if (e.code === 'pin_required') {
    if (state.me) set({ phase: 'need_pin', me: { ...state.me, pin_confirmed: false }, error: e });
    return true;
  }
  if (opts.accessCheck && e.status === 403 && e.code === 'forbidden') {
    set({ phase: 'not_staff', me: null, error: null });
    return true;
  }
  return false;
}

// ── Права. Одно место, где написано, кому что можно ─────────────────────────

export interface Access {
  /** Деньги салона целиком, а не только свои */
  seeAllMoney: boolean;
  /** Чужие записи (`scope=all` сервер выполняет только владелице) */
  seeAllAppointments: boolean;
  editPrices: boolean;
  manageTeam: boolean;
  /** Отзывы на модерации — GET /staff/reviews у сервера только владелице */
  moderateReviews: boolean;
  /** Переписка с клиентками — владелица и администратор */
  chats: boolean;
  /** Вкладка «Деньги/Доход»: у администратора своей выручки нет */
  money: boolean;
}

export function accessOf(me: StaffMe | null): Access {
  /* Три роли (Роч 15.10):
     · владелица — всё: все записи, вся касса, студия, команда, анкеты;
     · администратор — все записи и клиентки, переписка с клиентками;
       без денег студии и без настроек (цены, команда, «о студии»);
     · мастер — свои записи, свои клиентки, свой доход. */
  const owner = me?.role === 'owner';
  const admin = me?.role === 'admin';
  return {
    seeAllMoney: owner,
    seeAllAppointments: owner || admin,
    editPrices: owner,
    manageTeam: owner,
    moderateReviews: owner,
    chats: owner || admin,
    money: !admin,
  };
}

/**
 * Анкету клиентки видит только владелица И только при включённом флаге
 * сервера. То же условие, что у ручки GET /clients/{id}/health
 * (x-role: owner, x-feature: health). У мастера анкеты нет вовсе.
 */
export function canSeeHealth(me: StaffMe | null, features: { health?: boolean } | undefined): boolean {
  return me?.role === 'owner' && features?.health === true;
}

// ── Форма PIN — как у сервера (api/_domain/team.js) ─────────────────────────
//
// НОВЫЙ PIN (первый и при смене) — ровно 4 цифры: NEW_PIN_RE сервера.
// Подтверждение и текущий PIN при смене — от 4 до 8 (ANY_PIN_RE, провод
// openapi): строже сервера экран не бывает, иначе человек с таким PIN не
// вошёл бы. Слабые коды экран не угадывает — отказ `pin_leaked` приходит от
// сервера со своими словами, их и показываем.

export const NEW_PIN_LEN = 4;
export const PIN_MIN = 4;
export const PIN_MAX = 8;

// ── Человеческие слова для отказов PIN ──────────────────────────────────────

/** Минуты ожидания из Retry-After, округлённые вверх; по умолчанию — окно сервера, 5 минут. */
export function waitMinutes(e: ApiError): number {
  const sec = e.retryAfterSec ?? 300;
  return Math.max(1, Math.ceil(sec / 60));
}

/**
 * До какого момента заперт PIN (423 `pin_locked`, поле `locked_until` в
 * конверте ошибки), мс от эпохи. Нет поля или оно не дата — null.
 */
export function lockedUntilOf(e: unknown): number | null {
  if (!(e instanceof ApiError) || e.code !== 'pin_locked') return null;
  const raw = e.details?.locked_until;
  if (typeof raw !== 'string') return null;
  const t = Date.parse(raw);
  return Number.isFinite(t) ? t : null;
}

/**
 * «до 14:05» — если блокировка кончится сегодня, иначе «до 26 сен, 14:05».
 * Время — по поясу САЛОНА, как весь кабинет (ЦФ1) и как уведомление
 * владелице о той же блокировке (сервер пишет его в поясе салона).
 */
function untilText(at: number): string {
  const tz = salonTz();
  const p = salonParts(new Date(at), tz);
  if (!p) return '';
  const today = salonParts(new Date(), tz)?.dateISO;
  if (p.dateISO === today) return `до ${p.slot}`;
  const [, m, d] = p.dateISO.split('-').map(Number);
  return `до ${d} ${MONTHS_SHORT[m - 1]}, ${p.slot}`;
}

const MONTHS_SHORT = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];

/** Текст сервера, если он его прислал (конверт без message даёт «HTTP 422»). */
const serverWords = (err: ApiError): string | null =>
  err.message && !/^HTTP \d+$/.test(err.message) ? err.message : null;

export type PinMode = 'enter' | 'setup' | 'change';

/**
 * @param role чей PIN: владелице запертый PIN снимает поддержка (сбросить
 *   её PIN в приложении некому), мастеру — владелица кнопкой «Сбросить PIN».
 */
export function pinErrorText(e: unknown, mode: PinMode, role?: StaffRole): string {
  const err = asApiError(e);
  switch (err.code) {
    case 'bad_pin':
      if (err.status === 422) {
        // Ввод 4–8 цифр — провод; новый PIN — ровно 4 (сервер строже openapi).
        return mode === 'enter' ? `PIN — от ${PIN_MIN} до ${PIN_MAX} цифр` : `PIN — ровно ${NEW_PIN_LEN} цифры`;
      }
      return mode === 'change' ? 'Текущий PIN не подошёл' : 'PIN не подошёл. Проверьте и введите ещё раз';
    case 'pin_locked': {
      const at = lockedUntilOf(err);
      const until = at !== null ? `PIN заблокирован ${untilText(at)}` : 'PIN заблокирован после серии неверных вводов';
      return role === 'owner'
        ? `${until}. Снять блокировку может поддержка`
        : `${until}, попросите владелицу сбросить`;
    }
    case 'pin_already_set':
      return 'PIN уже задан — введите его. Сменить можно, зная текущий';
    case 'pin_not_set':
      return 'PIN ещё не задан — придумайте его';
    case 'pin_leaked':
      // Заводской или слишком простой — сервер говорит, какой именно.
      return serverWords(err) ?? 'Этот код не подходит — выберите другой';
    case 'pin_required':
      return 'Подтвердите PIN, чтобы продолжить';
    case 'rate_limited': {
      const m = waitMinutes(err);
      return `Слишком много попыток. Попробуйте через ${m} мин`;
    }
    case 'unavailable':
      return 'Проверка PIN сейчас недоступна. Попробуйте чуть позже';
    case 'forbidden':
      return 'Кабинет только для команды студии';
    case 'no_session':
    case 'unauthorized':
      return 'Не удалось войти через Telegram. Закройте и откройте приложение заново';
    case 'network':
    case 'timeout':
      return 'Нет связи с сервером. Проверьте интернет и повторите';
    default:
      return 'Не получилось. Попробуйте ещё раз';
  }
}
