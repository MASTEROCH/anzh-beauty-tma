// Вход через Telegram, пропуск сессии и транспорт — ЕДИНСТВЕННОЕ место в
// приложении, где вызывается `fetch` (контракт §0.1: «ни одного fetch вне
// одного модуля, базовый адрес — из переменной окружения»).
//
// ПОЧЕМУ ТРАНСПОРТ И СЕССИЯ В ОДНОМ ФАЙЛЕ. Пропуск (JWT, 7 дней) — самое
// ценное, что держит клиент, и отозвать его нельзя. Поэтому он живёт в
// закрытой переменной модуля: не экспортируется, не кладётся ни в
// localStorage, ни в sessionStorage, не вешается на `window` и не отдаётся
// экрану. Читает его только `apiRequest()` — значит, и `fetch` здесь.
// Внутри Telegram новый пропуск бесплатно получается из initData при каждом
// запуске, так что хранить его незачем.
//
// Образец — paratravel/app/src/lib/session.ts, урезанный: один способ входа
// (подпись Telegram), конверт ошибки контракта §7.1 `{error:{code,message}}`,
// успешный ответ — голое тело без обёртки.
//
// ВНЕ TELEGRAM (нет подписанной initData) — обычный режим «гость», а не сбой:
// ни одного запроса на вход, ни строчки в консоли. Каталог и витрина
// работают, запись, оплата и анкета просят открыть приложение в Telegram.
//
// 🔴 НИЧЕГО НЕ ПИШЕТ В КОНСОЛЬ. Через этот модуль ходят анкета здоровья и
// разборы (медданные), а в теле входа — подписанная строка человека.

import { useSyncExternalStore } from 'react';
import { rawInitData } from './telegram';

/** Базовый адрес API. По умолчанию — тот же домен, `/api/v1` (контракт §7.1). */
const API_BASE = String(import.meta.env.VITE_API_BASE ?? '/api/v1').replace(/\/+$/, '');

/**
 * Полный адрес ручки API — для того, что браузер грузит сам, без fetch:
 * <img>/<video> вложений чата. Такой адрес сервер отдаёт уже ПОДПИСАННЫМ
 * (короткоживущая подпись в query), заголовок авторизации ему не нужен.
 */
export const apiUrl = (path: string): string => (/^https?:\/\//.test(path) ? path : `${API_BASE}${path}`);

/** Настоящий `fetch`, взятый при загрузке модуля — до любого стороннего скрипта. */
const nativeFetch: typeof fetch | null =
  typeof globalThis !== 'undefined' && typeof globalThis.fetch === 'function'
    ? globalThis.fetch.bind(globalThis)
    : null;

/** Сколько ждём ответа, прежде чем считать сеть упавшей. Висящий запрос без
    срока — вечный спиннер на экране. */
const REQUEST_TIMEOUT_MS = 15_000;
/** Вход ждём меньше: пока он идёт, экраны с данными человека ждут вместе с ним. */
const LOGIN_TIMEOUT_MS = 10_000;

// ── Ошибка ──────────────────────────────────────────────────────────────────

/**
 * Отказ сервера или сети в одной форме.
 *
 * `code` — машинный код из конверта `{error:{code,message}}`. Если конверта нет
 * (HTML-страница шлюза, пустое тело), код выводится из статуса. Для сети без
 * ответа `status === 0`: `code` = `network` либо `timeout`.
 * Локальный отказ без похода в сеть — `status 401`, `code no_session` (гость
 * зовёт то, что требует входа).
 *
 * `message` из конверта — для разработчика; на экран его не выводить как есть.
 * Исключения — только там, где договор так решил, и только через
 * `serverMessage` ниже: `pin_leaked` (кабинет), `409 too_many_pending` у
 * заявки и `403 forbidden` на DELETE /me (решение John, волна 4), `409
 * terms_not_accepted` у кнопки оплаты (волна 5; по-английски — свой текст).
 */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  /** Через сколько секунд можно повторить (заголовок `Retry-After` у 429). */
  readonly retryAfterSec: number | null;
  /**
   * Машинные поля конверта рядом с code/message (инвариант 5 api/_lib/errors.js),
   * например у 423 `pin_locked` — `{ locked_until: ISO }`. Нет таких — null.
   */
  readonly details: Readonly<Record<string, unknown>> | null;

  constructor(
    status: number, code: string, message: string,
    retryAfterSec: number | null = null,
    details: Readonly<Record<string, unknown>> | null = null,
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.retryAfterSec = retryAfterSec;
    this.details = details;
  }

  /** Ответа не было вовсе: сеть, срок ожидания. */
  get isNetwork(): boolean {
    return this.status === 0;
  }
}

/**
 * Слова сервера из конверта ошибки — или null, если сервер их не прислал
 * (конверт без message даёт «HTTP 409», его на экран не выводим). Только для
 * отказов, где договор велит показать слова сервера (см. шапку ApiError);
 * вызывающий обязан иметь свой запасной текст.
 */
export function serverMessage(e: ApiError): string | null {
  const m = e.message.trim();
  return m && !/^HTTP \d+$/.test(m) ? m : null;
}

/** Код по статусу, когда сервер своего не назвал (коды для фронта — план §4). */
function codeOfStatus(status: number): string {
  if (status === 401) return 'unauthorized';
  if (status === 403) return 'forbidden';
  if (status === 404) return 'not_found';
  if (status === 409) return 'conflict';
  if (status === 422) return 'invalid';
  if (status === 429) return 'rate_limited';
  if (status >= 500) return 'server';
  return `http_${status}`;
}

/** Обрыв по сигналу вызывающего — воля вызывающего, а не отказ: бросаем как есть. */
export function isAbortError(e: unknown): boolean {
  return (
    typeof e === 'object' && e !== null && (e as { name?: unknown }).name === 'AbortError'
  );
}

// ── Состояние сессии (закрытое) ─────────────────────────────────────────────

/** НИКОГДА не экспортируется, не сохраняется, не пишется в журнал. */
let token: string | null = null;

export type SessionStatus = 'pending' | 'user' | 'guest';

/**
 * Почему гость. Не для прав (права решает сервер) — для честных слов на экране:
 * «откройте в Telegram» верно только при `outside_telegram`; при `network` —
 * «нет связи», при `refused`/`server` — «не удалось войти».
 */
export type GuestReason = 'outside_telegram' | 'refused' | 'network' | 'server';

export interface SessionState {
  status: SessionStatus;
  reason: GuestReason | null;
}

let state: SessionState = rawInitData() === null
  ? { status: 'guest', reason: 'outside_telegram' }
  : { status: 'pending', reason: null };

/** Экран из составной метки ссылки (`ref_<код>__<цель>`) — её разбирает сервер. */
let target: string | null = null;

const listeners = new Set<() => void>();

function setState(next: SessionState): void {
  if (next.status === state.status && next.reason === state.reason) return;
  state = next;
  for (const l of listeners) {
    try { l(); } catch { /* подписчик не вправе уронить сессию */ }
  }
}

/** Подписка на смену состояния сессии. Возвращает отписку. */
export function subscribeSession(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export const sessionState = (): SessionState => state;
export const sessionStatus = (): SessionStatus => state.status;

/** Гость: сессии нет и в этот момент не будет (вход не идёт). */
export const isGuest = (): boolean => state.status === 'guest';

/** Экран, на который указывала ссылка запуска, — со слов сервера. */
export const launchTarget = (): string | null => target;

/** Состояние для React — вся запись: статус и причина. */
export function useSession(): SessionState {
  return useSyncExternalStore(subscribeSession, sessionState, sessionState);
}

/** Только статус — `'pending' | 'user' | 'guest'`. */
export function useSessionStatus(): SessionStatus {
  return useSyncExternalStore(subscribeSession, sessionStatus, sessionStatus);
}

// ── Ключ идемпотентности ────────────────────────────────────────────────────

/**
 * uuid v4 для заголовка `Idempotency-Key` (контракт §7.2). Ключ создаётся ОДИН
 * раз на намерение человека (одно нажатие «Записаться») и переживает повторы.
 *
 * `crypto.randomUUID` есть только в защищённом контексте (https, localhost);
 * открытый по адресу локальной сети стенд — не защищённый, поэтому запасной
 * путь через `getRandomValues`, который доступен везде.
 */
export function newIdempotencyKey(): string {
  const c = globalThis.crypto;
  if (c && typeof c.randomUUID === 'function') return c.randomUUID();
  const b = new Uint8Array(16);
  c.getRandomValues(b);
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

// ── Транспорт ───────────────────────────────────────────────────────────────

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

type QueryValue = string | number | boolean | null | undefined;

export interface RequestOptions {
  body?: unknown;
  /**
   * Файл как есть (фото/видео во вложении чата): уходит телом без JSON и
   * base64, с собственным Content-Type. Взаимоисключается с `body`.
   */
  raw?: Blob;
  /**
   * Для запросов, СОЗДАЮЩИХ сущность. С ключом сетевая ошибка даёт один
   * повтор с тем же ключом: сервер вернёт тот же результат, а не второй объект.
   */
  idempotencyKey?: string;
  /**
   * 'required' (по умолчанию) — нужна сессия; гость получает отказ
   *            `401 no_session` без похода в сеть; 401 сервера стоит одного
   *            перевхода и одного повтора.
   * 'optional' — с сессией лучше, без неё тоже можно.
   * 'none'     — публичная ручка: заголовок не прикладывается даже при сессии
   *              (каталогу не нужно знать, кто его читает, а заголовок
   *              авторизации снимает кэш CDN).
   */
  auth?: 'required' | 'optional' | 'none';
  query?: Record<string, QueryValue>;
  signal?: AbortSignal;
  timeoutMs?: number;
}

function urlOf(path: string, query?: Record<string, QueryValue>): string {
  if (!path.startsWith('/')) throw new Error(`apiRequest: путь должен начинаться с «/»: ${path}`);
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(query ?? {})) {
    if (v !== undefined && v !== null && v !== '') q.set(k, String(v));
  }
  const qs = q.toString();
  if (!qs) return `${API_BASE}${path}`;
  return `${API_BASE}${path}${path.includes('?') ? '&' : '?'}${qs}`;
}

interface SendArgs {
  method: HttpMethod;
  path: string;
  opts: RequestOptions;
  bearer: string | null;
  timeoutMs: number;
}

/**
 * Один поход в сеть. Бросает `ApiError` на любой отказ, КРОМЕ обрыва по
 * сигналу вызывающего — тот уходит наверх как есть (AbortError).
 */
async function send<T>({ method, path, opts, bearer, timeoutMs }: SendArgs): Promise<T> {
  const doFetch = nativeFetch ?? (typeof globalThis.fetch === 'function' ? globalThis.fetch : null);
  if (!doFetch) throw new ApiError(0, 'network', `${method} ${path}: fetch недоступен`);

  const outer = opts.signal;
  if (outer?.aborted) throw outer.reason ?? new DOMException('Aborted', 'AbortError');

  // Свой контроллер: срок ожидания + проброс обрыва снаружи. AbortSignal.any
  // и AbortSignal.timeout есть не во всех WebView, поэтому руками.
  const ctrl = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => { timedOut = true; ctrl.abort(); }, timeoutMs);
  const onOuterAbort = () => ctrl.abort();
  outer?.addEventListener('abort', onOuterAbort, { once: true });

  const headers: Record<string, string> = { Accept: 'application/json' };
  if (opts.raw) headers['Content-Type'] = opts.raw.type || 'application/octet-stream';
  else if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
  if (bearer) headers.Authorization = `Bearer ${bearer}`;
  if (opts.idempotencyKey) headers['Idempotency-Key'] = opts.idempotencyKey;

  try {
    let res: Response;
    try {
      res = await doFetch(urlOf(path, opts.query), {
        method,
        headers,
        body: opts.raw ?? (opts.body === undefined ? undefined : JSON.stringify(opts.body)),
        signal: ctrl.signal,
        credentials: 'same-origin',
      });
    } catch (e) {
      // Первым делом — обрыв по воле вызывающего: это не отказ сети.
      if (outer?.aborted) throw e;
      if (timedOut) throw new ApiError(0, 'timeout', `${method} ${path}: нет ответа за ${timeoutMs} мс`);
      throw new ApiError(0, 'network', `${method} ${path}: нет ответа`);
    }

    let text: string;
    try {
      text = await res.text();
    } catch (e) {
      // Обрыв может догнать уже после ответа, на чтении тела.
      if (outer?.aborted) throw e;
      if (timedOut) throw new ApiError(0, 'timeout', `${method} ${path}: тело не дочитано за ${timeoutMs} мс`);
      throw new ApiError(0, 'network', `${method} ${path}: тело ответа оборвалось`);
    }

    let body: unknown = null;
    let parsed = false;
    if (text.length > 0) {
      try { body = JSON.parse(text); parsed = true; } catch { body = null; }
    }

    if (!res.ok) {
      const env = (body as { error?: { code?: unknown; message?: unknown } } | null)?.error;
      const code = typeof env?.code === 'string' && env.code ? env.code : codeOfStatus(res.status);
      const message = typeof env?.message === 'string' ? env.message : `HTTP ${res.status}`;
      const ra = Number(res.headers.get('Retry-After'));
      let details: Record<string, unknown> | null = null;
      if (env && typeof env === 'object' && !Array.isArray(env)) {
        for (const [k, v] of Object.entries(env)) {
          if (k === 'code' || k === 'message') continue;
          (details ??= {})[k] = v;
        }
      }
      throw new ApiError(res.status, code, message, Number.isFinite(ra) && ra > 0 ? ra : null, details);
    }

    if (res.status === 204 || text.length === 0) return undefined as T;
    if (!parsed) throw new ApiError(res.status, 'bad_response', `${method} ${path}: ответ не JSON`);
    return body as T;
  } finally {
    clearTimeout(timer);
    outer?.removeEventListener('abort', onOuterAbort);
  }
}

/**
 * Единственная дверь к серверу. Экраны не видят пропуск — только выбирают,
 * насколько он им нужен.
 *
 * Повторы (каждый — не больше одного раза за вызов):
 *   · 401 при сессии → один перевход по той же initData и один повтор;
 *   · сеть без ответа при `idempotencyKey` → один повтор с ТЕМ ЖЕ ключом.
 */
export async function apiRequest<T>(
  method: HttpMethod,
  path: string,
  opts: RequestOptions = {},
): Promise<T> {
  const auth = opts.auth ?? 'required';
  const timeoutMs = opts.timeoutMs ?? REQUEST_TIMEOUT_MS;

  const once = (bearer: string | null) => sendWithNetworkRetry<T>({ method, path, opts, bearer, timeoutMs });

  if (auth === 'none') return once(null);

  const bearer = await ensureToken();
  if (!bearer && auth === 'required') {
    throw new ApiError(401, 'no_session', `${method} ${path}: нет сессии`);
  }

  try {
    return await once(bearer);
  } catch (e) {
    if (!(e instanceof ApiError) || e.status !== 401 || !bearer) throw e;

    // Пропуск испортился (истёк или подделан). Выбрасываем ИМЕННО его —
    // соседний запрос мог уже получить новый — и пробуем войти один раз.
    forgetToken(bearer);
    const fresh = await ensureToken();
    if (!fresh) {
      if (auth === 'optional') return once(null);
      throw e;
    }
    try {
      return await once(fresh);
    } catch (again) {
      if (again instanceof ApiError && again.status === 401) forgetToken(fresh);
      throw again;
    }
  }
}

async function sendWithNetworkRetry<T>(args: SendArgs): Promise<T> {
  try {
    return await send<T>(args);
  } catch (e) {
    // Ответа не было — сервер мог выполнить работу и потерять ответ. Повтор
    // безопасен только с ключом: тот же ключ → тот же результат (§7.2).
    if (args.opts.idempotencyKey && e instanceof ApiError && e.isNetwork && !args.opts.signal?.aborted) {
      return send<T>(args);
    }
    throw e;
  }
}

// ── Вход ────────────────────────────────────────────────────────────────────

/**
 * Сколько раз за жизнь страницы вход может ДОЙТИ до сервера. Сеть без ответа
 * не считается (человек мог стартовать без связи). Потолок нужен, чтобы
 * порченый пропуск не превратил каждый запрос в перевход и не упёрся в
 * ограничение частоты входа на сервере.
 */
const MAX_LOGINS = 3;
let logins = 0;
/** Сервер отверг подпись — той же строкой входить бессмысленно до перезапуска. */
let refused = false;
/** Идущий вход — одно обещание на всех (и на двойной маунт StrictMode). */
let pendingLogin: Promise<string | null> | null = null;

interface LoginResponse {
  token?: unknown;
  target?: unknown;
}

function forgetToken(used: string): void {
  if (token !== used) return; // соседний запрос уже получил новый
  token = null;
  setState({ status: 'pending', reason: null });
}

async function login(initData: string): Promise<string | null> {
  setState({ status: 'pending', reason: null });
  try {
    const r = await send<LoginResponse>({
      method: 'POST',
      path: '/auth/telegram',
      // Сырая строка целиком — и ничего больше: start_param сервер
      // достаёт из неё сам, подписанным.
      opts: { body: { init_data: initData } },
      bearer: null,
      timeoutMs: LOGIN_TIMEOUT_MS,
    });
    logins += 1;
    if (typeof r?.token !== 'string' || r.token.length === 0) {
      setState({ status: 'guest', reason: 'server' });
      return null;
    }
    token = r.token;
    target = typeof r.target === 'string' && r.target ? r.target : null;
    setState({ status: 'user', reason: null });
    return token;
  } catch (e) {
    if (e instanceof ApiError && e.isNetwork) {
      setState({ status: 'guest', reason: 'network' });
      return null;
    }
    logins += 1;
    const status = e instanceof ApiError ? e.status : 0;
    if (status === 401 || status === 403 || status === 422) {
      refused = true;
      setState({ status: 'guest', reason: 'refused' });
    } else {
      setState({ status: 'guest', reason: 'server' });
    }
    return null;
  }
}

/** Пропуск, если он есть или его можно получить; `null` для гостя. Не бросает. */
async function ensureToken(): Promise<string | null> {
  if (token) return token;
  if (pendingLogin) return pendingLogin;
  const initData = rawInitData();
  if (initData === null) {
    setState({ status: 'guest', reason: 'outside_telegram' });
    return null;
  }
  if (refused || logins >= MAX_LOGINS) {
    if (state.status !== 'guest') setState({ status: 'guest', reason: refused ? 'refused' : 'server' });
    return null;
  }
  pendingLogin = login(initData).finally(() => { pendingLogin = null; });
  return pendingLogin;
}

/**
 * Вход при старте. Никогда не бросает. Вызывается сколько угодно раз:
 * пока вход идёт — возвращает то же обещание; после сетевого сбоя — пробует
 * снова (например, по событию `online`); после отказа сервера — сразу 'guest'.
 *
 * Экран НЕ должен ждать этого обещания, чтобы нарисоваться: оно решает, что
 * загрузить, а не можно ли работать.
 */
export async function initSession(): Promise<'user' | 'guest'> {
  return (await ensureToken()) ? 'user' : 'guest';
}

/** Повторить вход по нажатию человека («Повторить»): сбой сети или холодный
    старт сервера не должен оставлять экран в тупике «откройте заново».
    Отказ сервера (refused) не повторяем — подпись не станет вернее. */
export async function retrySession(): Promise<'user' | 'guest'> {
  if (refused) return 'guest';
  if (state.status === 'guest' && state.reason !== 'outside_telegram') logins = 0;
  return initSession();
}
