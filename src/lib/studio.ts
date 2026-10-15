// Данные кабинета мастера — с сервера, в памяти на время открытого кабинета.
//
// Три списка записей (GET /staff/bookings):
//   queue   — заявки, ждущие решения (status=pending);
//   day     — сегодня и завтра (для «Дня», «Кто следующий» и закрытия смены);
//   history — два года назад до сейчас (деньги, клиентки по выручке).
// Мастеру сервер отдаёт только его записи; владелице фронт просит
// `scope=all` — это то же условие, что на сервере (`scope=all` действует
// только для owner), а не решение фронта о правах.
//
// Прайс — GET /services (витрина) и GET /staff/services/archived (архив).
//
// Ничего не пишется в хранилище: прежние правки цен (`anzh_prices_v1`) и
// заметки о клиентках (`anzh_client_notes_v1`) переехали на сервер.
// Кабинет закрыт (выход, PIN снова нужен) — списки стираются из памяти.

import { useEffect, useSyncExternalStore } from 'react';
import { findService } from '../data/services';
import { ApiError, isAbortError } from './session';
import { cabinetDenied, cabinetState, subscribeCabinet } from './staff';
import { getClients, type ClientSummary } from './api/clients';
import {
  getStaffBookings, patchBooking, getLiveServices, getArchivedServices,
  type StaffBooking, type BookingStatus, type BookingDecision, type WireService,
} from './api/staff';
import { salonParts, salonTz, setSalonTimeZone, addDaysISO } from './appointments';
import { formatAmount, formatPrice, servicePrice } from './money';
import { SHOWCASE_CURRENCIES } from './showable';

export type { BookingStatus, WireService } from './api/staff';

// ── Даты ────────────────────────────────────────────────────────────────────
//
// 🔴 МОМЕНТ (starts_at, created_at) → день и время — ТОЛЬКО по поясу САЛОНА
// (ЦФ1): пояс приходит в ответе GET /staff/bookings (`timezone`), счёт — тот
// же `salonParts` через Intl.DateTimeFormat, что у клиентки (appointments.ts),
// одна реализация на приложение. Голые getHours()/getDate() от момента дают
// пояс ТЕЛЕФОНА: мастер в поездке или стенд в другом поясе видели бы «День»,
// очередь и деньги смены не за тот день и не в тот час.
// toISODate/fromISODate ниже — календарная арифметика над уже готовой датой
// (yyyy-mm-dd ↔ Date), к моментам сервера их не применять.

export const toISODate = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

export const fromISODate = (iso: string): Date => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
};

const MONTHS_SHORT = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];

/** «25 сен» — как прежний formatShort. */
export const formatShort = (iso: string): string => {
  const d = fromISODate(iso);
  return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`;
};

/** День момента по поясу салона, yyyy-mm-dd (пусто — не дата). */
export const salonDateISO = (at: string | Date): string => salonParts(at)?.dateISO ?? '';

/** Сегодня по поясу салона, yyyy-mm-dd. */
export const salonTodayISO = (): string => salonParts(new Date())?.dateISO ?? toISODate(new Date());

/**
 * Момент полуночи дня `dateISO` по поясу салона — граница окна запроса.
 * Смещение пояса берётся у Intl в этот момент (два шага — на случай
 * перехода на летнее время рядом с полуночью).
 */
export function salonDayStart(dateISO: string): Date {
  const [y, m, d] = dateISO.split('-').map(Number);
  const wall = Date.UTC(y, m - 1, d);
  let t = wall;
  for (let i = 0; i < 2; i++) {
    const p = salonParts(new Date(t));
    if (!p) break;
    const [py, pm, pd] = p.dateISO.split('-').map(Number);
    const [hh, mi] = p.slot.split(':').map(Number);
    t += wall - Date.UTC(py, pm - 1, pd, hh, mi);
  }
  return new Date(t);
}

// ── Деньги ──────────────────────────────────────────────────────────────────

/**
 * Minor units → screen string. A wrapper over money.ts formatAmount (K1): ONE
 * formatter for the app — "300 ₾", "$45", "45,50 ₾", "300 EUR". The currency is
 * required and comes from the row: no currency — no sign (the old default dollar
 * is gone); no number — a dash, never "$0" (skill Katya/copy-empty-states-and-restraint).
 */
export function formatMoney(minor: number | null | undefined, currency: string | null | undefined): string {
  return formatAmount(minor, currency, 'ru') ?? '—';
}

/** One currency's part of a sum. Lari and dollars are never added together. */
export interface MoneyPart {
  currency: string | null;
  /** Minor units of THIS currency */
  minor: number;
}

const currencyKey = (c: string | null | undefined): string | null => (c ? c : null);

/** Lari, dollars, other codes A→Z, no currency last — one order on every screen. */
function currencyRank(c: string | null): number {
  if (c === null) return SHOWCASE_CURRENCIES.length + 1;
  const i = (SHOWCASE_CURRENCIES as readonly string[]).indexOf(c);
  return i >= 0 ? i : SHOWCASE_CURRENCIES.length;
}

/**
 * Rows split by their own currency (owner's decision 06.10, B1-B: no conversion).
 * A visit has one currency (the server refuses a mixed one, `mixed_currency`), so
 * every sum of the cabinet is taken inside one group — never across groups.
 */
export function byCurrency<T extends { currency?: string | null }>(
  list: readonly T[],
): Array<{ currency: string | null; list: T[] }> {
  const groups = new Map<string | null, T[]>();
  for (const x of list) {
    const key = currencyKey(x.currency);
    const g = groups.get(key);
    if (g) g.push(x);
    else groups.set(key, [x]);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => currencyRank(a) - currencyRank(b) || (a ?? '').localeCompare(b ?? ''))
    .map(([currency, items]) => ({ currency, list: items }));
}

/** A sum per currency; an empty list — no parts. */
export function sumByCurrency<T extends { currency?: string | null }>(
  list: readonly T[],
  minorOf: (x: T) => number,
): MoneyPart[] {
  return byCurrency(list).map((g) => ({ currency: g.currency, minor: g.list.reduce((s, x) => s + minorOf(x), 0) }));
}

/** "1200 ₾ + $300"; no parts — a dash. */
export function formatMoneyParts(parts: readonly MoneyPart[]): string {
  return parts.length ? parts.map((p) => formatMoney(p.minor, p.currency)).join(' + ') : '—';
}

/** Heading of a currency group when the screen shows more than one (draft words for Katya). */
export function currencyTitle(currency: string | null): string {
  if (currency === 'GEL') return 'в лари';
  if (currency === 'USD') return 'в долларах';
  return currency ? `в ${currency}` : 'без валюты';
}

/** Ввод человека «52,5» / «52.50» → 5250. Непонятное или отрицательное — null. */
export function parseMoneyInput(text: string): number | null {
  const t = text.trim().replace(',', '.');
  if (!/^\d+(\.\d{0,2})?$/.test(t)) return null;
  const n = Math.round(Number(t) * 100);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/** Минорные → значение поля ввода: «45» или «45.50». Для поля, не для показа. */
export const minorToInput = (minor: number): string =>
  minor % 100 === 0 ? String(minor / 100) : (minor / 100).toFixed(2);

// ── Визит: запись сервера в форме экрана ────────────────────────────────────

export interface Visit {
  id: string;
  /** telegram_id клиентки */
  clientId: number;
  clientName: string;
  staffId: number;
  staffName: string | null;
  startsAt: string;
  /** Дата и время начала по поясу салона */
  dateISO: string;
  slot: string;
  durationMin: number;
  status: BookingStatus;
  totalMinor: number;
  /** Фактически оплачено; null — не указано */
  paidMinor: number | null;
  /** The visit's own currency; null — the server did not send one (no sign, no dollar). */
  currency: string | null;
  slugs: string[];
  titles: string[];
  itemPrices: number[];
  /** Комментарий клиентки. Может быть о здоровье: только на экран. */
  note: string | null;
}

export function toVisit(b: StaffBooking): Visit {
  const at = salonParts(b.starts_at) ?? { dateISO: '', slot: '' };
  const items = Array.isArray(b.items) ? b.items : [];
  return {
    id: b.id,
    clientId: b.telegram_id,
    clientName: (b.client_name ?? '').trim() || 'Без имени',
    staffId: b.staff_id,
    staffName: b.staff_name ?? null,
    startsAt: b.starts_at,
    dateISO: at.dateISO,
    slot: at.slot,
    durationMin: b.duration_min,
    status: b.status,
    totalMinor: b.total_minor,
    paidMinor: b.paid_minor ?? null,
    currency: b.currency || null,
    slugs: items.map((i) => i.slug ?? '').filter(Boolean),
    titles: items.map((i) => i.title_ru || i.slug || '').filter(Boolean),
    itemPrices: items.map((i) => i.price_minor ?? 0),
    note: b.client_note ?? null,
  };
}

/** Выручка визита: сколько фактически взяли; не указано — сумма записи. */
export const revenueMinor = (v: Visit): number => v.paidMinor ?? v.totalMinor;

export const visitTitle = (v: Visit): string => v.titles.join(' + ') || 'Процедура';

export const STATUS_WORD: Record<BookingStatus, string> = {
  pending: 'ждёт решения',
  confirmed: 'подтверждена',
  declined: 'отклонена',
  done: 'оплачено',
  no_show: 'не пришла',
  cancelled: 'отменена',
};

// ── Списки записей ──────────────────────────────────────────────────────────

export type ListKind = 'queue' | 'day' | 'history';

export interface ListState {
  visits: Visit[];
  loaded: boolean;
  loading: boolean;
  /** Ошибка ≠ пустота: экран показывает отказ, а не «записей нет». */
  error: ApiError | null;
}

const EMPTY: ListState = { visits: [], loaded: false, loading: false, error: null };

let lists: Record<ListKind, ListState> = { queue: EMPTY, day: EMPTY, history: EMPTY };
/** Идущая загрузка — одно обещание на всех (двойной маунт StrictMode). */
const inflight: Partial<Record<ListKind, Promise<void>>> = {};
/** Поколение данных: ответ, пришедший после закрытия кабинета, не пишется. */
let generation = 0;

const listListeners = new Set<() => void>();
function emitLists(): void {
  for (const l of listListeners) {
    try { l(); } catch { /* ignore */ }
  }
}
function setList(kind: ListKind, next: ListState): void {
  lists = { ...lists, [kind]: next };
  emitLists();
}
function subscribeLists(l: () => void): () => void {
  listListeners.add(l);
  return () => { listListeners.delete(l); };
}

/** Стереть всё из памяти — кабинет закрыт. */
export function resetStudioData(): void {
  generation += 1;
  lists = { queue: EMPTY, day: EMPTY, history: EMPTY };
  archived = { list: [], loaded: false, loading: false, error: null };
  clients = { list: [], loaded: false, loading: false, error: null };
  clientsInflight = null;
  archInflight = null;
  for (const k of Object.keys(inflight) as ListKind[]) delete inflight[k];
  emitLists();
  emitSvc();
}

// Кабинет перестал быть открытым — данные чужих людей в памяти не держим.
subscribeCabinet(() => {
  if (cabinetState().phase === 'open') return;
  // И загруженное, и загружаемое: ответ, пришедший после закрытия, не пишется
  // (поколение), а флаг «грузится» не должен пережить закрытие — иначе после
  // повторного PIN список так и остался бы в вечной загрузке.
  const busy = (x: { loaded: boolean; loading: boolean }) => x.loaded || x.loading;
  if (busy(lists.queue) || busy(lists.day) || busy(lists.history) || busy(clients) || busy(archived)) {
    resetStudioData();
  }
});

function queryOf(kind: ListKind) {
  // Роль — из ответа сервера (GET /staff/me), тем же выражением, что у него:
  // `scope=all` действует только для owner. Мастеру его не шлём вовсе.
  const scope = cabinetState().me?.role === 'owner' ? 'all' as const : undefined;
  if (kind === 'queue') return { status: 'pending' as const, scope };
  // Границы — полночь САЛОНА: «сегодня и завтра» салона, а не телефона.
  const today = salonTodayISO();
  if (kind === 'day') {
    return { from: salonDayStart(today).toISOString(), to: salonDayStart(addDaysISO(today, 2)).toISOString(), scope };
  }
  return { from: salonDayStart(addDaysISO(today, -730)).toISOString(), to: new Date().toISOString(), scope };
}

/**
 * Пояс салона из ответа сервера. Сменился (ответ назвал не тот пояс, что был
 * известен до него) — уже загруженные визиты пересчитываются в новом.
 */
function applyTimezone(tz: unknown): void {
  const before = salonTz();
  setSalonTimeZone(tz);
  if (salonTz() === before) return;
  const retime = (s: ListState): ListState => ({
    ...s,
    visits: s.visits.map((v) => ({ ...v, ...(salonParts(v.startsAt) ?? { dateISO: v.dateISO, slot: v.slot }) })),
  });
  lists = { queue: retime(lists.queue), day: retime(lists.day), history: retime(lists.history) };
  emitLists();
}

export function loadList(kind: ListKind, force = false): Promise<void> {
  const cur = lists[kind];
  if (inflight[kind]) return inflight[kind]!;
  if (cur.loaded && !force) return Promise.resolve();
  const gen = generation;
  setList(kind, { ...cur, loading: true, error: null });
  const askedTz = salonTz();
  const p = getStaffBookings(queryOf(kind))
    .then(
      (res) => {
        if (gen !== generation) return;
        // Пояс — до перевода записей в форму экрана: день и час считаются в нём.
        applyTimezone(res.timezone);
        setList(kind, { visits: res.bookings.map(toVisit), loaded: true, loading: false, error: null });
        // Окно «День»/истории считалось от полуночи прежнего пояса — перечитать
        // (после finally этого обещания, иначе loadList вернёт его же).
        if (kind !== 'queue' && salonTz() !== askedTz) {
          setTimeout(() => { if (gen === generation) void loadList(kind, true); }, 0);
        }
      },
      (e: unknown) => {
        if (gen !== generation) return;
        if (cabinetDenied(e, { accessCheck: true })) return;
        const error = e instanceof ApiError
          ? e
          : new ApiError(0, isAbortError(e) ? 'aborted' : 'network', 'GET /staff/bookings: сбой');
        setList(kind, { ...lists[kind], loading: false, error });
      },
    )
    .finally(() => { if (inflight[kind] === p) delete inflight[kind]; });
  inflight[kind] = p;
  return p;
}

export function reloadStudio(): void {
  void loadList('queue', true);
  void loadList('day', true);
  if (clients.loaded || clients.error) void loadClients(true);
  if (lists.history.loaded || lists.history.error) void loadList('history', true);
}

/** Список записей для экрана; загрузка запускается при первом показе. */
export function useStaffList(kind: ListKind, enabled = true): ListState {
  const s = useSyncExternalStore(subscribeLists, () => lists[kind], () => lists[kind]);
  useEffect(() => {
    if (enabled && !s.loaded && !s.loading && !s.error) void loadList(kind);
  }, [enabled, kind, s.loaded, s.loading, s.error]);
  return s;
}

/** Положить ответ сервера во все списки, где эта запись есть. */
function applyBooking(v: Visit): void {
  for (const kind of ['queue', 'day', 'history'] as ListKind[]) {
    const cur = lists[kind];
    if (!cur.visits.some((x) => x.id === v.id)) continue;
    setList(kind, { ...cur, visits: cur.visits.map((x) => (x.id === v.id ? v : x)) });
  }
}

/**
 * Решение по записи (PATCH /bookings/{id}). Ответ сервера кладётся в списки.
 * Бросает `ApiError`; на `stale` / `bad_transition` списки перечитываются —
 * кто-то уже решил эту заявку.
 */
export async function decideVisit(id: string, body: BookingDecision): Promise<Visit> {
  try {
    const b = await patchBooking(id, body);
    const v = toVisit(b);
    applyBooking(v);
    // Закрытый визит — это выручка: история перечитается при следующем показе.
    if ((v.status === 'done' || v.status === 'no_show') && lists.history.loaded) {
      setList('history', { ...lists.history, loaded: false });
    }
    return v;
  } catch (e) {
    if (cabinetDenied(e)) throw e;
    if (e instanceof ApiError && (e.code === 'stale' || e.code === 'bad_transition')) reloadStudio();
    throw e;
  }
}

/** Человеческие слова для отказа по записи. */
export function decisionErrorText(e: unknown): string {
  const code = e instanceof ApiError ? e.code : 'network';
  switch (code) {
    case 'slot_taken': return 'Это время уже занято подтверждённой записью';
    case 'bad_transition':
    case 'stale': return 'Заявку уже изменили — список обновлён';
    case 'reason_required': return 'Напишите причину — клиентка её увидит';
    case 'forbidden': return 'Эта запись не ваша';
    case 'not_found': return 'Записи больше нет';
    case 'pin_required': return 'Подтвердите PIN, чтобы продолжить';
    case 'invalid': return 'Сумма не принята — проверьте число';
    case 'network':
    case 'timeout': return 'Нет связи — ничего не изменилось, повторите';
    default: return 'Не получилось — ничего не изменилось, повторите';
  }
}

/** Слова для отказа загрузки списка. */
export function loadErrorText(e: ApiError | null): string {
  if (!e) return '';
  if (e.isNetwork) return 'Нет связи с сервером';
  return 'Сервер не ответил';
}

// ── Клиентки (GET /clients) ─────────────────────────────────────────────────

interface ClientsState { list: ClientSummary[]; loaded: boolean; loading: boolean; error: ApiError | null }

let clients: ClientsState = { list: [], loaded: false, loading: false, error: null };
let clientsInflight: Promise<void> | null = null;

export function loadClients(force = false): Promise<void> {
  if (clientsInflight) return clientsInflight;
  if (clients.loaded && !force) return Promise.resolve();
  const gen = generation;
  clients = { ...clients, loading: true, error: null };
  emitLists();
  const p = getClients({ limit: 500 })
    .then(
      (list) => { if (gen === generation) clients = { list, loaded: true, loading: false, error: null }; },
      (e: unknown) => {
        if (gen !== generation) return;
        if (cabinetDenied(e, { accessCheck: true })) return;
        const error = e instanceof ApiError ? e : new ApiError(0, 'network', 'GET /clients: сбой');
        clients = { ...clients, loading: false, error };
      },
    )
    .finally(() => { if (clientsInflight === p) clientsInflight = null; emitLists(); });
  clientsInflight = p;
  return p;
}

export function useClientsList(enabled = true): ClientsState {
  const s = useSyncExternalStore(subscribeLists, () => clients, () => clients);
  useEffect(() => {
    if (enabled && !s.loaded && !s.loading && !s.error) void loadClients();
  }, [enabled, s.loaded, s.loading, s.error]);
  return s;
}

// ── Выборки ─────────────────────────────────────────────────────────────────

const byStart = (a: Visit, b: Visit) => a.startsAt.localeCompare(b.startsAt);

export const pendingOf = (list: Visit[]) => list.filter((v) => v.status === 'pending').sort(byStart);

/** Записи дня, кроме отклонённых и отменённых. */
export function dayOf(list: Visit[], dateISO = salonTodayISO()): Visit[] {
  return list
    .filter((v) => v.dateISO === dateISO && v.status !== 'declined' && v.status !== 'cancelled')
    .sort(byStart);
}

export const tomorrowISO = (): string => addDaysISO(salonTodayISO(), 1);

// ── Прайс ───────────────────────────────────────────────────────────────────

interface LiveState { list: WireService[]; loaded: boolean; loading: boolean; error: ApiError | null }

let live: LiveState = { list: [], loaded: false, loading: false, error: null };
let archived: LiveState = { list: [], loaded: false, loading: false, error: null };
let liveInflight: Promise<void> | null = null;
let archInflight: Promise<void> | null = null;
const svcListeners = new Set<() => void>();
function emitSvc(): void {
  for (const l of svcListeners) {
    try { l(); } catch { /* ignore */ }
  }
}
function subscribeSvc(l: () => void): () => void {
  svcListeners.add(l);
  return () => { svcListeners.delete(l); };
}

export function loadLiveServices(force = false): Promise<void> {
  if (liveInflight) return liveInflight;
  if (live.loaded && !force) return Promise.resolve();
  live = { ...live, loading: true, error: null };
  emitSvc();
  liveInflight = getLiveServices()
    .then(
      (list) => { live = { list, loaded: true, loading: false, error: null }; },
      (e: unknown) => {
        const error = e instanceof ApiError ? e : new ApiError(0, 'network', 'GET /services: сбой');
        live = { ...live, loading: false, error };
      },
    )
    .finally(() => { liveInflight = null; emitSvc(); });
  return liveInflight;
}

export function loadArchivedServices(force = false): Promise<void> {
  if (archInflight) return archInflight;
  if (archived.loaded && !force) return Promise.resolve();
  const gen = generation;
  archived = { ...archived, loading: true, error: null };
  emitSvc();
  archInflight = getArchivedServices()
    .then(
      (list) => { if (gen === generation) archived = { list, loaded: true, loading: false, error: null }; },
      (e: unknown) => {
        if (gen !== generation) return;
        if (cabinetDenied(e)) { archived = { ...archived, loading: false }; return; }
        const error = e instanceof ApiError ? e : new ApiError(0, 'network', 'GET /staff/services/archived: сбой');
        archived = { ...archived, loading: false, error };
      },
    )
    .finally(() => { archInflight = null; emitSvc(); });
  return archInflight;
}

/**
 * Витрина кабинета — с пропуском (getLiveServices: мимо кэша края). Данные
 * публичные, их можно держать и после закрытия кабинета.
 */
export function useLiveServices(): LiveState {
  const s = useSyncExternalStore(subscribeSvc, () => live, () => live);
  useEffect(() => {
    if (!s.loaded && !s.loading && !s.error) void loadLiveServices();
  }, [s.loaded, s.loading, s.error]);
  return s;
}

export function useArchivedServices(enabled: boolean): LiveState {
  const s = useSyncExternalStore(subscribeSvc, () => archived, () => archived);
  useEffect(() => {
    if (enabled && !s.loaded && !s.loading && !s.error) void loadArchivedServices();
  }, [enabled, s.loaded, s.loading, s.error]);
  return s;
}

/** Поменять одну процедуру в витрине после ответа сервера. */
export function applyService(svc: WireService): void {
  live = { ...live, list: live.list.map((x) => (x.slug === svc.slug ? svc : x)) };
  emitSvc();
}

/**
 * После снятия, возврата или создания — перечитать оба списка кабинета. Оба
 * читаются с пропуском, поэтому приходят свежими, а не из кэша края; витрину
 * клиентки на этом телефоне правит lib/catalog.ts applyOwnerEdit.
 */
export function refreshServices(): void {
  void loadLiveServices(true);
  void loadArchivedServices(true);
}

/** Процедура по slug из загруженной витрины (или архива). */
export function serviceBySlug(slug: string): WireService | undefined {
  return live.list.find((s) => s.slug === slug) ?? archived.list.find((s) => s.slug === slug);
}

/**
 * The price line of a showcase procedure for the studio (PromoStudio, hidden): the
 * cabinet's loaded row first (fresh after an edit), otherwise the catalog. One formatter
 * (lib/money.ts) — the row's own currency, "from" and unit; no price — null, never "$0".
 */
export function priceLineOf(serviceId: string): string | null {
  const s = serviceBySlug(serviceId);
  if (s) return formatPrice({ priceMinor: s.price_minor, currency: s.currency, priceFrom: s.price_from, slug: s.slug });
  const known = findService(serviceId);
  return known ? servicePrice(known) : null;
}

// ── Аналитика кабинета ──────────────────────────────────────────────────────

const WEEKDAY = ['воскресенье', 'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота'];

export interface NoShowInsight {
  total: number;
  /** Lost money per currency */
  lost: MoneyPart[];
  worstWeekday?: string;
  repeatOffenders: Array<{ name: string; count: number }>;
}

/** Неявки — только по списку, который пришёл смотрящему (мастеру — свои). */
export function noShowInsight(list: Visit[]): NoShowInsight {
  const noShows = list.filter((v) => v.status === 'no_show');
  const byDay = new Map<number, number>();
  const byClient = new Map<number, { name: string; count: number }>();
  for (const v of noShows) {
    const day = fromISODate(v.dateISO).getDay();
    byDay.set(day, (byDay.get(day) ?? 0) + 1);
    const row = byClient.get(v.clientId) ?? { name: v.clientName, count: 0 };
    row.count += 1;
    byClient.set(v.clientId, row);
  }
  const worst = [...byDay.entries()].sort((a, b) => b[1] - a[1])[0];
  return {
    total: noShows.length,
    lost: sumByCurrency(noShows, (v) => v.totalMinor),
    // Один случай — это не закономерность, а совпадение
    worstWeekday: worst && worst[1] > 1 ? WEEKDAY[worst[0]] : undefined,
    repeatOffenders: [...byClient.values()].filter((c) => c.count > 1).sort((a, b) => b.count - a.count),
  };
}

export interface CategorySlice {
  category: string;
  label: string;
  sum: number;
  share: number;
  color: string;
}

const CATEGORY_LABEL: Record<string, string> = {
  inj: 'Инъекции', clean: 'Чистки', peel: 'Пилинги', apparatus: 'Аппарат',
  care: 'Уход', brows: 'Брови', derma: 'Дерматолог', training: 'Обучение', analysis: 'Разборы',
};

const CATEGORY_COLOR: Record<string, string> = {
  inj: '#12C088', clean: '#35E4A6', peel: '#F5C842', apparatus: '#C9A52F',
  care: '#8FF3D4', brows: '#C9A52F', derma: '#2F767A', training: '#8FF3D4', analysis: '#35E4A6',
};

/**
 * Доли процедур визита в его выручке: цена процедуры на момент записи,
 * пересчитанная на фактически взятую сумму (скидка, округление).
 */
export function itemShares(v: Visit): Array<{ slug: string; title: string; minor: number }> {
  const total = v.itemPrices.reduce((s, x) => s + x, 0);
  const rev = revenueMinor(v);
  if (v.slugs.length === 0) return [{ slug: '', title: visitTitle(v), minor: rev }];
  return v.slugs.map((slug, i) => ({
    slug,
    title: v.titles[i] ?? slug,
    minor: total > 0 ? Math.round((v.itemPrices[i] ?? 0) * rev / total) : Math.round(rev / v.slugs.length),
  }));
}

export function revenueByCategory(list: Visit[], sinceDays = 90): CategorySlice[] {
  const fromISO = addDaysISO(salonTodayISO(), -sinceDays);
  const sums = new Map<string, number>();
  for (const v of list) {
    if (v.status !== 'done' || v.dateISO < fromISO) continue;
    for (const part of itemShares(v)) {
      const cat = serviceBySlug(part.slug)?.category ?? findService(part.slug)?.category;
      if (!cat) continue;
      sums.set(cat, (sums.get(cat) ?? 0) + part.minor);
    }
  }
  const total = [...sums.values()].reduce((s, x) => s + x, 0);
  if (total === 0) return [];
  return [...sums.entries()]
    .map(([category, sum]) => ({
      category,
      label: CATEGORY_LABEL[category] ?? category,
      sum,
      share: sum / total,
      color: CATEGORY_COLOR[category] ?? '#12C088',
    }))
    .sort((a, b) => b.sum - a.sum);
}

export function topServices(list: Visit[], limit = 5) {
  const sums = new Map<string, { title: string; count: number; sum: number }>();
  for (const v of list) {
    if (v.status !== 'done') continue;
    for (const part of itemShares(v)) {
      const key = part.slug || part.title;
      const row = sums.get(key) ?? { title: part.title, count: 0, sum: 0 };
      row.count += 1;
      row.sum += part.minor;
      sums.set(key, row);
    }
  }
  return [...sums.entries()]
    .map(([slug, v]) => ({ slug, ...v }))
    .sort((a, b) => b.sum - a.sum)
    .slice(0, limit);
}

export interface ShiftSummary {
  dateISO: string;
  done: number;
  noShow: number;
  open: number;
  /** Earned per currency — lari and dollars are not added together */
  earned: MoneyPart[];
  nextDay: Visit[];
}

export function shiftSummary(dayList: Visit[]): ShiftSummary {
  const today = salonTodayISO();
  const ofDay = dayList.filter((v) => v.dateISO === today);
  const done = ofDay.filter((v) => v.status === 'done');
  return {
    dateISO: today,
    done: done.length,
    noShow: ofDay.filter((v) => v.status === 'no_show').length,
    open: ofDay.filter((v) => v.status === 'pending' || v.status === 'confirmed').length,
    earned: sumByCurrency(done, revenueMinor),
    nextDay: dayOf(dayList, tomorrowISO()),
  };
}
