// Каталог процедур на экране: загрузка витрины с сервера, кэш для работы без
// сети, перевод строк провода в форму экрана (`Service`).
//
// Откуда берётся список (по убыванию силы):
//   1. сервер — GET /services (публично, без пропуска);
//   2. кэш последнего ответа сервера — `anzh_catalog_cache_v1` (только
//      витрина: публичные данные, ничего о человеке). Нужен, чтобы каталог
//      открывался без сети;
//   3. статический список бандла (data/services.ts) — ТОЛЬКО до первой
//      загрузки, когда нет ни сервера, ни кэша.
// Экран обязан сказать, если показывает не свежий ответ сервера (catalogNote):
// цена из бандла или из старого кэша может разойтись с той, что запишет сервер.
//
// Money — from the server: `price_minor` in minor units of the row's OWN currency,
// GEL or USD (owner's decision B1-B, 06.10.2026: no switch; the main price is never
// converted — the "≈" second price is display-only, K11b). The price
// line is built by lib/money.ts; which row is on the showcase — lib/showable.ts.
//
// Правка прайса владелицей (добавить, снять с витрины, вернуть) — дело
// кабинета и сервера (lib/api/catalog.ts). Прежний слой правок в localStorage
// убран: правка, которая живёт только на одном телефоне, врёт всем остальным.

import { useEffect, useSyncExternalStore } from 'react';
import {
  categories,
  services as BUNDLED,
  setLiveServices,
  setServicePhotoFallback,
  type Service,
} from '../data/services';
import { getServices, type ServerService } from './api/catalog';
import { coverPhotoFor } from '../data/works';
import { ApiError } from './session';
import { isOnShowcase, isShowable, positiveOrNull, type ShowcaseCategory } from './showable';

/* Обложка из собственных снимков — там, где каталог не прислал `photo_url`.
   Подаём сюда, а не импортируем в data/services.ts: тот файл обязан остаться
   без настоящих импортов (его читают снятием типов). */
setServicePhotoFallback((id) => coverPhotoFor(id)?.src ?? null);

export const CATALOG_CACHE_KEY = 'anzh_catalog_cache_v1';
/**
 * Форма записи в кэше. Поднять, если она поменяется: старый кэш будет проигнорирован.
 * 2 — K13 (F2): a format-1 record was written by the prototype's showcase (demo rows in
 * USD — lip-filler $150 and others); it passes isShowable and would be the first frame and
 * the offline list after the release. Format 2 is written only by "her showcase" code; a
 * format-1 record is ignored (the bundle shows until the server answers) and overwritten
 * by the first answer.
 */
const CACHE_FORMAT = 2;

// ── Перевод провода в форму экрана ──────────────────────────────────────────

/** Every category of the screen type is one the showcase rule knows (checked by tsc). */
const CATEGORIES_AGREE: [Service['category']] extends [ShowcaseCategory] ? true : never = true;
void CATEGORIES_AGREE;

const ZONES = new Set(['face', 'body', 'brows']);
const bundledById = new Map(BUNDLED.map((s) => [s.id, s] as const));
const categoryIcon = new Map(categories.map((c) => [c.id, c.icon] as const));

const strings = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && x.length > 0) : [];

const text = (v: unknown): string | undefined => (typeof v === 'string' && v.length > 0 ? v : undefined);

/**
 * The bundle as the fallback list passes the same rule as a server row: wire form,
 * kind by category — the way tools/catalog-import.mjs builds rows from it.
 */
const BUNDLED_SHOWABLE = BUNDLED.filter((s) =>
  isShowable({
    slug: s.id,
    kind: s.category === 'training' ? 'training' : 'procedure',
    category: s.category,
    title: { ru: s.title },
    price_minor: s.priceMinor,
    currency: s.currency,
    duration_min: s.duration,
    days: s.days,
  }),
);

/**
 * Wire row → screen service. `null` — the screen does not show the row: only
 * isShowable (lib/showable.ts) passes — the same expression the tools count by.
 * Analyses and the analyses bundle (own showcase, Stars), no price, a currency other
 * than GEL/USD, no length (B4-A) — nothing that could be booked or shown honestly.
 * A row hidden from the showcase (HIDDEN_FROM_SHOWCASE) passes: history needs it;
 * rebuild() cuts the showcase with the same module — together that is isLive.
 */
export function fromServer(x: ServerService): Service | null {
  if (!isShowable(x)) return null;
  const minor = x.price_minor;
  const bundled = bundledById.get(x.slug);
  return {
    id: x.slug,
    category: x.category,
    zone: typeof x.zone === 'string' && ZONES.has(x.zone) ? (x.zone as Service['zone']) : undefined,
    title: x.title.ru,
    titleEn: text(x.title?.en),
    short: text(x.subtitle?.ru) ?? '',
    shortEn: text(x.subtitle?.en),
    description: text(x.description?.ru) ?? '',
    descriptionEn: text(x.description?.en),
    duration: positiveOrNull(x.duration_min),
    days: positiveOrNull(x.days) ?? undefined,
    priceMinor: minor,
    currency: x.currency,
    priceFrom: x.price_from === true,
    // Значка на сервере нет: своя иконка процедуры, иначе — иконка категории.
    icon: bundled?.icon ?? categoryIcon.get(x.category) ?? 'sparkles',
    includes: strings(x.includes),
    contraindications: strings(x.contraindications),
    photoUrl: text(x.photo_url),
    sort: typeof x.sort === 'number' ? x.sort : undefined,
    // Признак записи — по kind сервера, а не по категории: сервер решает
    // not_bookable именно по kind (Х11), категория с ним может разойтись.
    bookable: x.kind === 'procedure',
  };
}

function adapt(raw: ServerService[]): Service[] {
  const out: Service[] = [];
  const seen = new Set<string>();
  raw.forEach((x) => {
    const s = fromServer(x);
    if (s && !seen.has(s.id)) {
      seen.add(s.id);
      out.push(s);
    }
  });
  // Порядок витрины задаёт сервер (`sort`); без него — порядок ответа.
  return out
    .map((s, i) => ({ s, i }))
    .sort((a, b) => (a.s.sort ?? Infinity) - (b.s.sort ?? Infinity) || a.i - b.i)
    .map(({ s }) => s);
}

// ── Кэш ─────────────────────────────────────────────────────────────────────

interface CacheRecord {
  v: number;
  savedAt: number;
  services: ServerService[];
}

function readCache(): CacheRecord | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(CATALOG_CACHE_KEY);
    if (!raw) return null;
    const rec = JSON.parse(raw) as Partial<CacheRecord>;
    if (rec?.v !== CACHE_FORMAT || !Array.isArray(rec.services) || typeof rec.savedAt !== 'number') return null;
    return rec as CacheRecord;
  } catch {
    return null;
  }
}

function writeCache(services: ServerService[], savedAt: number) {
  try {
    const rec: CacheRecord = { v: CACHE_FORMAT, savedAt, services };
    localStorage.setItem(CATALOG_CACHE_KEY, JSON.stringify(rec));
  } catch { /* хранилище запрещено или полно — каталог просто не переживёт перезапуск */ }
}

// ── Состояние ───────────────────────────────────────────────────────────────

export type CatalogSource = 'bundled' | 'cache' | 'server';
export type CatalogStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface CatalogState {
  /** Откуда текущий список. */
  source: CatalogSource;
  status: CatalogStatus;
  /** Последний отказ загрузки. Ошибка ≠ пустота: экран говорит о ней. */
  error: ApiError | null;
  /** Когда сервер отдал этот список (для кэша — время сохранения). */
  savedAt: number | null;
  /** Витрина: что можно открыть и записать. */
  live: Service[];
  /** Всё известное (включая скрытое с витрины) — для истории и отчётов. */
  all: Service[];
  /** Совместимость со старым слоем правок; всегда пусто (см. шапку). */
  archived: string[];
}

let loaded: Service[] | null = null;
/** Строки провода, из которых собран `loaded` (сервер или кэш) — для своих правок владелицы. */
let raw: ServerService[] | null = null;
let meta: Pick<CatalogState, 'source' | 'status' | 'error' | 'savedAt'> = {
  source: 'bundled',
  status: 'idle',
  error: null,
  savedAt: null,
};
let snapshot: CatalogState;
const listeners = new Set<() => void>();

function rebuild() {
  const all = loaded ?? BUNDLED_SHOWABLE;
  snapshot = {
    ...meta,
    all,
    // The showcase is isLive (lib/showable.ts): everything in `all` passed isShowable
    // (fromServer or BUNDLED_SHOWABLE); hidden-until-the-lawyer is cut on top.
    live: all.filter((s) => isOnShowcase(s.id)),
    archived: [],
  };
}

function emit() {
  rebuild();
  for (const l of listeners) {
    try { l(); } catch { /* подписчик не вправе уронить остальных */ }
  }
}

function applyList(list: Service[], source: CatalogSource, savedAt: number) {
  loaded = list;
  setLiveServices(list);
  meta = { ...meta, source, savedAt };
}

// ── Свои правки прайса (владелица на ЭТОМ телефоне) ─────────────────────────
//
// GET /services без пропуска край Vercel отдаёт из своего кэша до 30 с
// (api/_lib/http.js PUBLIC_READ_CDN_TTL_SEC) — всем одинаково, это витрина.
// Поэтому после правки в кабинете витрину этого телефона НЕ перечитываем
// (пришла бы прежняя цена, снятая процедура и не пришла бы возвращённая —
// Хейтер, волна 4), а кладём строку из ответа сервера. Правка держится
// поверх любого списка, прочитанного в окне края: и того, что уже летел,
// когда владелица нажала «сохранить», и загрузки по событию `online`.

/** Окно кэша края для анонимного GET /services, мс (api/_lib/http.js). */
const EDGE_WINDOW_MS = 30_000;
/** slug → строка из ответа сервера (null — снята с витрины) и когда. */
const ownEdits = new Map<string, { service: ServerService | null; at: number }>();

function withOwnEdits(list: ServerService[]): ServerService[] {
  const now = Date.now();
  let out = list;
  for (const [slug, edit] of ownEdits) {
    if (now - edit.at > EDGE_WINDOW_MS) { ownEdits.delete(slug); continue; }
    out = out.filter((x) => x.slug !== slug);
    if (edit.service) out = [...out, edit.service];
  }
  return out;
}

/**
 * Правка владелицы из кабинета — в витрину клиентки на этом телефоне.
 * `service` — строка из ответа сервера (PATCH, POST) или из архива кабинета
 * (возврат: сервер отвечает только `{restored}`); `null` — снята с витрины.
 * Своего списка сервера на телефоне ещё нет — правка ляжет на первый.
 */
export function applyOwnerEdit(slug: string, service: ServerService | null): void {
  ownEdits.set(slug, { service, at: Date.now() });
  if (!raw) return;
  raw = withOwnEdits(raw);
  const savedAt = meta.savedAt ?? Date.now();
  applyList(adapt(raw), meta.source, savedAt);
  writeCache(raw, savedAt);
  emit();
}

// Кэш поднимается при импорте модуля — до первого кадра каталога.
{
  const cached = readCache();
  if (cached) {
    raw = cached.services;
    applyList(adapt(raw), 'cache', cached.savedAt);
  }
  rebuild();
}

let inflight: Promise<void> | null = null;

/**
 * Загрузить витрину с сервера. Одно обещание на всех одновременных
 * вызывающих (и на двойной маунт StrictMode) — хранится обещание, а не
 * флажок; сеть не обрывается. Не бросает: отказ ложится в `error`, список
 * остаётся прежним (кэш или бандл).
 */
export function loadCatalog(): Promise<void> {
  if (inflight) return inflight;
  meta = { ...meta, status: 'loading' };
  emit();
  inflight = getServices()
    .then(
      (list) => {
        const savedAt = Date.now();
        raw = withOwnEdits(list);
        applyList(adapt(raw), 'server', savedAt);
        writeCache(raw, savedAt);
        meta = { ...meta, status: 'ready', error: null };
      },
      (e: unknown) => {
        const error = e instanceof ApiError ? e : new ApiError(200, 'bad_response', 'GET /services: ответ не разобран');
        meta = { ...meta, status: 'error', error };
      },
    )
    .finally(() => {
      inflight = null;
      emit();
    });
  return inflight;
}

// Связь вернулась, а последняя загрузка не удалась — пробуем снова.
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    if (meta.status === 'error') void loadCatalog();
  });
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export const catalogState = (): CatalogState => snapshot;

/**
 * Каталог для React. Первый подписчик запускает загрузку с сервера (один раз
 * за запуск; после отказа — снова по событию `online` или `loadCatalog()`).
 */
export function useCatalog(): CatalogState {
  const state = useSyncExternalStore(subscribe, catalogState, catalogState);
  useEffect(() => {
    if (meta.status === 'idle') void loadCatalog();
  }, []);
  return state;
}

/**
 * The catalog for React WITHOUT starting a load — for an app-level reader that must not
 * move the first GET /services earlier than the screens do (App: favorites cleanup, K13 F2).
 */
export function useCatalogPassive(): CatalogState {
  return useSyncExternalStore(subscribe, catalogState, catalogState);
}

/** Витрина без подписки (для не-React кода). */
export const liveServices = (): Service[] => snapshot.live;
/** Всё известное без подписки. */
export const allKnownServices = (): Service[] => snapshot.all;

/**
 * Пометка «это не свежий ответ сервера» — или null, когда пометка не нужна.
 * Пока идёт первая загрузка, пометки нет: список из бандла заменится через
 * мгновение, а мигающая плашка хуже её отсутствия.
 */
export function catalogNote(s: CatalogState): { ru: string; en: string } | null {
  if (s.status !== 'error') return null;
  // «Нет связи» — только когда ответа не было; ответил отказом — так и говорим.
  const offline = s.error?.isNetwork ?? true;
  const why = offline
    ? { ru: 'Нет связи', en: 'Offline' }
    : { ru: 'Сервер не отдал прайс', en: 'The server didn’t return the price list' };
  if (s.source === 'cache' && s.savedAt) {
    const d = new Date(s.savedAt);
    const ru = d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
    const en = d.toLocaleDateString('en-US', { day: 'numeric', month: 'long' });
    return {
      ru: `${why.ru} — показан прайс, сохранённый ${ru}. Итог заявки посчитает сервер.`,
      en: `${why.en} — showing the price list saved on ${en}. The server calculates the final total.`,
    };
  }
  if (s.source === 'bundled') {
    return {
      ru: `${offline ? 'Нет связи с сервером' : why.ru} — цены из приложения и могут отличаться. Итог заявки посчитает сервер.`,
      en: `${offline ? 'Can’t reach the server' : why.en} — prices are built into the app and may differ. The server calculates the final total.`,
    };
  }
  return null;
}

// ── Совместимость со слоем правок кабинета ──────────────────────────────────
// Прежние функции правки прайса писали в localStorage и меняли витрину только
// на этом телефоне. Кабинет (Ф-3) переводится на lib/api/catalog.ts
// (patchService / archiveService / restoreService / createService); до тех
// пор функции ниже НИЧЕГО не меняют и не сохраняют — лучше не сделать, чем
// показать владелице «убрано с витрины», которого клиентки не увидят.

/** @deprecated Правка прайса — через сервер (lib/api/catalog.ts). */
export function addService(input: Omit<Service, 'id'>): Service {
  return { ...input, id: `local-${Date.now().toString(36)}` };
}

/** @deprecated Снять с витрины — DELETE /services/{slug} (lib/api/catalog.ts). */
export function archiveService(id: string): void {
  void id;
}

/** @deprecated Вернуть на витрину — POST /services/{slug}/restore (lib/api/catalog.ts). */
export function restoreService(id: string): void {
  void id;
}

/** Архив витрины знает сервер (GET /staff/services/archived); здесь — никогда. */
export const isArchived = (id: string): boolean => {
  void id;
  return false;
};

/** Услуга, которой нет в бандле, — заведена владелицей на сервере. */
export const isCustom = (id: string): boolean => !bundledById.has(id);
