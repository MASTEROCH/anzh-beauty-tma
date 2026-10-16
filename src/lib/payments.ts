// Оплата звёздами Telegram (XTR) и доступ к купленному.
//
// Правила, из которых вырастает весь модуль:
//  1. Stars — ТОЛЬКО за цифровое: за звёзды продаются только разборы и их
//     набор (сервер отвечает `stars_not_allowed_for_kind` на всё остальное).
//  2. Счёт выписывает СЕРВЕР (POST /payments/invoice): цена берётся из базы,
//     токен бота на клиенте не живёт. Клиент только открывает ссылку через
//     `Telegram.WebApp.openInvoice`.
//  3. ДОСТУП ДАЁТ ТОЛЬКО СЕРВЕР. Статус 'paid' из окна Telegram — слово
//     клиента, а не факт оплаты: доступ открывается, когда покупка появилась
//     в GET /me/purchases (её пишет вебхук оплаты). Поэтому после 'paid'
//     фронт опрашивает покупки до 30 с. Раньше покупка писалась в
//     localStorage прямо из колбэка — и открывала разбор без денег.
//  4. Вне Telegram оплаты нет: там нечем открыть счёт. Кнопки нет вовсе,
//     вместо неё честная строка.
//
// ⚠️ Методы `Telegram.WebApp` (и `openInvoice`) МОЛЧА не работают со страницы,
// открытой не с адреса из BotFather (Bot API 10.2, с 20.07.2026; брифинг
// Telegram). «Окно оплаты не открылось» на предпросмотре — не поломка этого
// кода: проверять только по адресу из BotFather.

import { useEffect, useMemo, useSyncExternalStore } from 'react';
import { isTelegram } from './telegram';
import { ApiError, apiRequest, newIdempotencyKey, serverMessage, sessionState, subscribeSession, useSession } from './session';
import { refreshMe, useMe } from './api';
import { createInvoice, getPurchases, type ProductKind, type ServerPurchase } from './api/payments';

export type InvoiceStatus = 'paid' | 'cancelled' | 'failed' | 'pending';

/**
 * Итог попытки оплаты — для слов на экране.
 *  · 'paid'        — сервер ПОДТВЕРДИЛ: покупка есть в /me/purchases;
 *  · 'already'     — сервер ответил `already_purchased`: доступ уже открыт
 *                    (у набора — только если перечитанные покупки покрывают
 *                    ВЕСЬ его текущий состав, см. `bundleIncludes`);
 *  · 'already_partial'    — набор уже куплен (есть его оплаченная строка), но
 *                    текущий состав покрыт не весь: разборы, добавленные после
 *                    оплаты, в него не входят (решение владельца 28.09, «б»:
 *                    набор повторно не продаём, новое — отдельно);
 *  · 'already_unverified' — набор: сервер сказал «уже куплено», а список
 *                    покупок этого не подтверждает — перечитать не удалось или
 *                    не сошёлся ни один пункт серверного отказа. Ошибка, а не
 *                    «ничего не куплено» и не «всё открыто»;
 *  · 'terms'       — сервер ответил `terms_not_accepted`: версия условий не
 *                    прислана или уже не текущая. Экран уже снял галочку и
 *                    занятость (`onTermsRefused`), профиль перечитывается в
 *                    фоне — пришла другая редакция, экран сам скажет
 *                    «условия обновились»;
 *  · 'unconfirmed' — Telegram сказал «оплачено», сервер за 30 с не подтвердил;
 *  · 'cancelled' / 'failed' — окно оплаты закрыто без оплаты / с ошибкой;
 *  · 'unavailable' — не Telegram: оплата здесь невозможна в принципе;
 *  · 'disabled'    — оплата звёздами выключена флагом сервера;
 *  · 'no_session'  — нет входа (сервер не узнал человека);
 *  · 'rate_limited'— слишком часто.
 */
export type PayResult =
  | 'paid' | 'already' | 'already_partial' | 'already_unverified' | 'terms'
  | 'unconfirmed' | 'cancelled' | 'failed'
  | 'unavailable' | 'disabled' | 'no_session' | 'rate_limited';

/* Курс звезды к доллару. Берём розничную цену Telegram: малый пакет 100★
   стоит $1.99, то есть ≈ $0.02 за звезду — это то, что реально платит
   клиентка, а не выплата разработчику ($0.013). Цифру держим здесь одну:
   она поменяется, и менять её надо в одном месте. */
export const STAR_USD = 0.02;

/* Подпись в долларах — маркетинговая: округляем до целого и снимаем цент.
   670★ → $13.40 → «$12.99». Цену в звёздах это НЕ трогает: платит клиентка
   звёздами, доллары стоят рядом только чтобы величина читалась. */
export function starsToUsd(stars: number): string {
  const whole = Math.max(1, Math.round(stars * STAR_USD));
  return (whole - 0.01).toFixed(2);
}

interface TgWebAppPayments {
  openInvoice?: (url: string, cb: (status: string) => void) => void;
  initData?: string;
}

/* ДЕМО-ОПЛАТА — только сборка прототипа (VITE_DEMO=1) и dev со стендом.
   Вне Telegram окна счёта нет, и без этого до вопросов и результата разбора
   в демо не дойти (Роч 15.10: «где кнопка запуска разбора?»). Покупку
   записывает демо-сервер (POST /dev/purchase), доступ всё равно берётся из
   GET /me/purchases — тот же путь, что у настоящей. В боевой сборке оба
   флага ложны и ветка вырезается при сборке; внутри настоящего Telegram
   демо-оплата в прототипе тоже включена — см. isDemoPay ниже. */
const DEMO_PAY = import.meta.env.DEV || import.meta.env.VITE_DEMO === '1';
/* Внутри Telegram прототип тоже платит понарошку: демо-сервер не умеет
   выставлять настоящие счета (нет токена бота), и оплата падала — казалось,
   что купить можно только пакет (Роч 16.10). Боевая сборка: флаг ложен. */
export const isDemoPay = (): boolean => DEMO_PAY;

function webApp(): TgWebAppPayments | undefined {
  if (typeof window === 'undefined') return undefined;
  return (window as unknown as { Telegram?: { WebApp?: TgWebAppPayments } }).Telegram?.WebApp;
}

/* НЕ по наличию метода: скрипт telegram-web-app.js подключён в index.html
   всегда и создаёт `Telegram.WebApp` даже в обычном браузере — вместе с
   `openInvoice`, который там ничего не откроет. Признак настоящего
   Telegram — присутствие initData. Это проверка ПЛАТФОРМЫ; разрешено ли
   платить — решает сервер (`usePayAvailability`). */
export const canPayWithStars = () => isTelegram() && typeof webApp()?.openInvoice === 'function';

/**
 * Можно ли показать кнопку оплаты — и если нет, то почему (для честной строки).
 *  · 'outside_telegram' — не Telegram;
 *  · 'checking'         — вход или профиль ещё грузятся;
 *  · 'no_session'       — войти не удалось (профиль не пришёл);
 *  · 'disabled'         — `Me.features.stars !== true`;
 *  · 'ready'            — можно.
 * Флаг сравнивается `=== true`: флаг, которого сервер не прислал, — выключен.
 */
export type PayAvailability = 'ready' | 'outside_telegram' | 'checking' | 'no_session' | 'disabled';

export function usePayAvailability(): PayAvailability {
  const session = useSession();
  const { me, loading } = useMe();
  // Профиль не пришёл после входа — перечитать самим, а не ждать перезапуска
  useEffect(() => {
    if (session.status === 'user' && !me && !loading) void refreshMe();
  }, [session.status, me, loading]);
  if (!canPayWithStars() && !isDemoPay()) return 'outside_telegram';
  if (session.status === 'pending') return 'checking';
  if (session.status === 'guest') return 'no_session';
  // Демо-оплате профиль не нужен: не держим кнопку, пока /me не пришёл
  if (isDemoPay()) return 'ready';
  // Вход есть, профиль не пришёл (сбой сети) — это «проверяю», а не «не удалось войти»
  if (!me) return 'checking';
  return me.features?.stars === true ? 'ready' : 'disabled';
}

/* ── Купленное: только с сервера ──────────────────────────────────── */

export interface Purchase {
  /** = product_slug (id разбора или 'bundle') */
  id: string;
  productId: string;
  kind: ProductKind;
  status: 'paid' | 'refunded';
  /**
   * Какие разборы открывает эта покупка — снимок состава на момент оплаты
   * (`covers` из GET /me/purchases, решение John Х1). Доступ к разбору
   * решается ТОЛЬКО по нему (`hasAccess`), не по виду покупки.
   */
  covers: string[];
  /** Когда оплачено (мс), если сервер сказал */
  boughtAt: number | null;
}

export interface PurchasesState {
  /** Все покупки, включая возвращённые (`status`) — доступ даёт только 'paid' */
  list: Purchase[];
  loading: boolean;
  /** Список хоть раз пришёл с сервера. До этого «ничего не куплено» — не факт. */
  loaded: boolean;
  /** Последний отказ. Ошибка ≠ пустота: экран говорит «не удалось проверить». */
  error: ApiError | null;
}

const EMPTY: PurchasesState = { list: [], loading: false, loaded: false, error: null };
let pstate: PurchasesState = EMPTY;
const listeners = new Set<() => void>();
/* Идущее чтение — одно обещание на всех (и на двойной маунт StrictMode),
   умение strictmode-double-mount-needs-promise-ref-not-flag. */
let inflight: Promise<Purchase[] | null> | null = null;

function setPurchases(next: PurchasesState): void {
  pstate = next;
  for (const l of listeners) {
    try { l(); } catch { /* подписчик не вправе уронить остальных */ }
  }
}

/**
 * Состав покупки. Сервер до Х1 поля `covers` не присылал: разбор по
 * определению покрывает сам себя, а состав набора выдумывать нельзя — без
 * снимка набор не открывает ничего. Прежнее правило «любой оплаченный набор
 * открывает всё» отдавало даром разбор, добавленный в набор после оплаты
 * (Хейтер №1).
 */
function coversOf(p: ServerPurchase): string[] {
  if (Array.isArray(p.covers)) {
    return p.covers.filter((s): s is string => typeof s === 'string' && s.length > 0);
  }
  return p.product_kind === 'analysis' ? [p.product_slug] : [];
}

function fromServer(p: ServerPurchase): Purchase {
  const at = p.paid_at ? Date.parse(p.paid_at) : NaN;
  return {
    id: p.product_slug,
    productId: p.product_slug,
    kind: p.product_kind,
    status: p.status === 'paid' ? 'paid' : 'refunded',
    covers: coversOf(p),
    boughtAt: Number.isFinite(at) ? at : null,
  };
}

/**
 * Перечитать покупки. Не бросает: отказ ложится в `error`, прежний список
 * остаётся (он не стал неправдой от того, что сеть моргнула). Гостю — `null`
 * без похода в сеть.
 * ⚠️ Присоединяется к уже идущему чтению: если оно началось ДО события, ради
 * которого перечитываем (409 already_purchased), придёт снимок старее ответа
 * сервера. Там, где от списка зависит строка (набор после 409), несошедшийся
 * список даёт «не удалось проверить», а не догадку.
 */
export function refreshPurchases(): Promise<Purchase[] | null> {
  if (inflight) return inflight;
  if (sessionState().status === 'guest') {
    if (pstate !== EMPTY) setPurchases(EMPTY);
    return Promise.resolve(null);
  }
  setPurchases({ ...pstate, loading: true });
  inflight = getPurchases()
    .then(
      (raw) => {
        const list = raw.map(fromServer);
        setPurchases({ list, loading: false, loaded: true, error: null });
        return list;
      },
      (e: unknown) => {
        const error = e instanceof ApiError ? e : new ApiError(0, 'network', 'GET /me/purchases: сбой');
        setPurchases({ ...pstate, loading: false, error });
        return null;
      },
    )
    .finally(() => { inflight = null; });
  return inflight;
}

/** Стереть купленное из памяти устройства (удаление аккаунта). На сервере покупки остаются. */
export function resetPurchases(): void {
  setPurchases(EMPTY);
}

// Вошли — узнать, что куплено, если это уже ждёт открытый экран (экран сам
// зовёт чтение при монтировании; на старте без нужды в сеть не ходим).
// Стали гостем — чужое купленное не показывать.
subscribeSession(() => {
  const s = sessionState().status;
  if (s === 'user') {
    if (listeners.size > 0 && !pstate.loaded) void refreshPurchases();
  } else if (s === 'guest' && pstate !== EMPTY) setPurchases(EMPTY);
});

function subscribe(l: () => void): () => void {
  listeners.add(l);
  return () => { listeners.delete(l); };
}

/**
 * Состояние покупок целиком: список, загрузка, ошибка. Экран, открывшийся
 * первым, запускает чтение; каждый следующий вход на экран перечитывает —
 * возврат покупки должен закрыть доступ без перезапуска приложения.
 */
export function usePurchasesState(): PurchasesState {
  const s = useSyncExternalStore(subscribe, () => pstate, () => pstate);
  useEffect(() => {
    if (sessionState().status === 'user') void refreshPurchases();
  }, []);
  return s;
}

/** Только действующие (оплаченные, не возвращённые) покупки. */
export function usePurchases(): Purchase[] {
  const s = usePurchasesState();
  return useMemo(() => s.list.filter((p) => p.status === 'paid'), [s.list]);
}

/**
 * Открыт ли разбор: есть оплаченная покупка, чей снимок состава (`covers`)
 * его покрывает. Возвращённая строка доступа не даёт; живой дубль того же
 * разбора — даёт (доступ = хоть одна paid-строка, покрывающая slug).
 */
export const hasAccess = (list: Purchase[], slug: string) =>
  list.some((p) => p.status === 'paid' && p.covers.includes(slug));

/** Открыты ли ВСЕ перечисленные разборы — по covers любых оплаченных покупок. */
export const coversAll = (list: Purchase[], slugs: readonly string[]) =>
  slugs.length > 0 && slugs.every((s) => hasAccess(list, s));

/**
 * Есть ли у человека сам товар — тем же выражением, что первый пункт
 * серверного отказа `alreadyOwns`: `owned.has(product.slug)`, где owned —
 * товары оплаченных строк и их covers (payments.js ownedSlugs). Для набора —
 * «набор куплен», каким бы ни был его состав с тех пор.
 */
export const owns = (list: Purchase[], slug: string) =>
  list.some((p) => p.status === 'paid' && (p.productId === slug || p.covers.includes(slug)));

/* ── Оплата ───────────────────────────────────────────────────────── */

/** Сколько ждём подтверждения сервера после окна оплаты (openapi: «до 30 с»). */
export const CONFIRM_TIMEOUT_MS = 30_000;
const POLL_EVERY_MS = 2_000;

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/* Оплата подтверждена: в списке сервера есть оплаченная строка ЭТОГО товара
   (набор — своя строка; его состав — в covers) или разбор уже покрыт. */
const confirmed = owns;

/** Опрос /me/purchases, пока товар не появится или не выйдет срок. */
async function waitForServer(productSlug: string): Promise<boolean> {
  const deadline = Date.now() + CONFIRM_TIMEOUT_MS;
  for (;;) {
    const list = await refreshPurchases();
    if (list && confirmed(list, productSlug)) return true;
    if (Date.now() + POLL_EVERY_MS > deadline) return false;
    await sleep(POLL_EVERY_MS);
  }
}

function normalizeStatus(s: string): InvoiceStatus {
  return s === 'paid' || s === 'cancelled' || s === 'pending' ? s : 'failed';
}

export interface PayOptions {
  /**
   * Редакция Условий покупки, которую человек принял галочкой, — ровно
   * `Me.legal.terms` (или `null`, если сервер её не назвал: тогда ключа в теле
   * нет, и решает сервер). Обязательное: оплата без ответа на вопрос «какую
   * редакцию приняли» не собирается даже по ошибке.
   */
  termsVersion: string | null;
  /**
   * Только у набора: его ТЕКУЩИЙ состав (то, что экран перечисляет в «что
   * входит»). На 409 `already_purchased` покупки перечитываются, и строка
   * выбирается теми же двумя пунктами, что серверный `alreadyOwns`: весь
   * состав покрыт (`coversAll`) — «всё уже куплено — открываю»; иначе набор
   * куплен (`owns`) — «набор у тебя уже есть»; иначе — «не удалось проверить».
   * У разбора — нет: там 409 сам по себе значит «этот разбор твой».
   */
  bundleIncludes?: readonly string[];
  /** Окно Telegram сказало «оплачено» / «в обработке» — начинаем ждать сервер. */
  onConfirming?: () => void;
  /**
   * 409 `terms_not_accepted`: экран снимает занятость и галочку и показывает
   * слова отказа (`serverText` — слова сервера из конверта или `null`).
   * Зовётся ДО того, как профиль начнут перечитывать, — пока он идёт, рядом с
   * отказом нет «Открываю оплату…» и отметки на отвергнутую редакцию.
   */
  onTermsRefused?: (serverText: string | null) => void;
}

/**
 * Купить товар за звёзды. Никогда не бросает. Возвращает 'paid' ТОЛЬКО когда
 * покупку подтвердил сервер.
 */
export async function payWithStars(productSlug: string, opts: PayOptions): Promise<PayResult> {
  const tg = webApp();
  // Сервер спрашиваем ТОЛЬКО когда есть кому открыть счёт: в браузере счёт
  // выписывать бессмысленно, и никакого 'paid' без денег — даже понарошку.
  if (isDemoPay()) {
    try {
      await apiRequest('POST', '/dev/purchase', { body: { product_slug: productSlug, covers: opts.bundleIncludes ?? [productSlug] } });
      const list = await refreshPurchases();
      return list && list.some((x) => x.productId === productSlug && x.status === 'paid') ? 'paid' : 'unconfirmed';
    } catch { return 'unavailable'; }
  }
  if (!canPayWithStars() || !tg?.openInvoice) return 'unavailable';

  let link: string;
  try {
    // Один ключ на одно нажатие: сетевой повтор внутри apiRequest идёт с ним же
    const inv = await createInvoice(productSlug, newIdempotencyKey(), opts.termsVersion);
    link = inv?.invoice_link;
  } catch (e) {
    if (e instanceof ApiError) {
      if (e.code === 'terms_not_accepted') {
        // Прислана не текущая редакция (или никакой). Сначала экран: занятость и
        // галочка сняты, слова отказа у кнопки. Потом — перечитать профиль, В
        // ФОНЕ: пришла другая `Me.legal.terms` — экран сам сменит строку на
        // «условия обновились», а новая отметка уйдёт уже с новой редакцией, не
        // крутя тот же отказ петлёй. Не ждём здесь нарочно: поздний итог этой
        // попытки не должен сбросить занятость следующей.
        // ⚠️ refreshMe присоединяется к уже идущему чтению профиля — если оно
        // началось до отказа, придёт снимок старее; строка тогда останется
        // словами сервера, а редакцию привяжет следующее перечитывание.
        opts.onTermsRefused?.(serverMessage(e));
        void refreshMe();
        return 'terms';
      }
      if (e.code === 'already_purchased') {
        // Сервер уже знает о покупке (или о покупках, покрывающих весь набор) —
        // доступ открываем по его списку и covers, а не по этому ответу
        const list = await refreshPurchases();
        if (!opts.bundleIncludes) return 'already';
        // Набор. Перечитать не удалось — это ошибка, а не «ничего не куплено»
        // и не «всё твоё» (умение honest-states-server-truth).
        if (list === null) return 'already_unverified';
        // Те же два пункта, что серверный alreadyOwns: весь текущий состав
        // покрыт — «всё уже куплено»; иначе куплен сам набор — «набор уже есть».
        // Ни то ни другое — список расходится с отказом (гонка чтения или
        // состав фронта ≠ services.includes): не угадываем, а говорим прямо.
        if (coversAll(list, opts.bundleIncludes)) return 'already';
        if (owns(list, productSlug)) return 'already_partial';
        return 'already_unverified';
      }
      if (e.code === 'feature_disabled') {
        void refreshMe(); // флаг выключили, пока экран был открыт
        return 'disabled';
      }
      if (e.status === 401) return 'no_session';
      if (e.status === 429) return 'rate_limited';
    }
    return 'failed';
  }
  if (typeof link !== 'string' || link.length === 0) return 'failed';

  const status = await new Promise<InvoiceStatus>((resolve) => {
    try {
      tg.openInvoice!(link, (s) => resolve(normalizeStatus(String(s))));
    } catch {
      resolve('failed');
    }
  });
  if (status === 'cancelled' || status === 'failed') return status;

  // 'paid' или 'pending' — ждём вебхук: доступ даёт только сервер
  opts.onConfirming?.();
  return (await waitForServer(productSlug)) ? 'paid' : 'unconfirmed';
}
