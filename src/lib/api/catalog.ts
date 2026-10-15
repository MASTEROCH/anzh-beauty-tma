// Провод «каталог»: витрина, расчёт визита, правка прайса владелицей.
// Источник правды по именам полей, кодам и ответам — server/openapi.yaml
// (пути /services*, /staff/services/archived), не план и не отчёты.
//
// Правила папки — в шапке `./me.ts`: только типы провода (snake_case, как у
// сервера) и тонкие вызовы «один вызов — одна ручка»; в сеть — через
// `apiRequest`; поле, которое сервер может не прислать, необязательное.
// Перевод в форму экрана (`Service` из data/services.ts) — в `lib/catalog.ts`.

import { apiRequest } from '../session';

export type ServiceKind = 'procedure' | 'training' | 'analysis' | 'analysis_bundle';

export interface LocalizedText {
  ru: string;
  en: string;
}

export interface OptionalText {
  ru?: string | null;
  en?: string | null;
}

/**
 * Одна строка витрины (`components/schemas/Service`).
 *
 * Деньги — целое в минорных единицах плюс код валюты: 4500 и 'USD' — это
 * 45.00 USD. `price_minor`/`duration_min` могут быть null (владелица завела
 * услугу, не указав цену) — такую услугу записать нельзя
 * (`422 incomplete_service`), поэтому тип честно допускает null.
 */
export interface ServerService {
  slug: string;
  kind: ServiceKind;
  category?: string;
  zone?: string;
  title: LocalizedText;
  subtitle?: OptionalText;
  description?: OptionalText;
  price_minor?: number | null;
  currency?: string | null;
  price_from?: boolean;
  /** Telegram Stars — только у разборов. Не валюта ISO-4217. */
  stars_amount?: number | null;
  duration_min?: number | null;
  days?: number | null;
  includes?: string[];
  contraindications?: string[];
  photo_url?: string | null;
  sort?: number;
}

/** POST /services/quote → `{quote}`. Итог визита считает сервер. */
export interface Quote {
  items: Array<{
    service_id?: string;
    slug?: string;
    title_ru?: string;
    title_en?: string;
    price_minor?: number;
    currency?: string;
    duration_min?: number;
  }>;
  subtotal_minor: number;
  discount_percent: number;
  discount_minor: number;
  total_minor: number;
  currency: string;
  duration_min: number;
}

/**
 * Правка услуги владелицей (`ServicePatch`): плоские поля `*_ru`/`*_en`,
 * только присланные; `null` стирает значение. Лишних полей сервер не
 * принимает (additionalProperties: false).
 */
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
  stars_amount?: number | null;
  duration_min?: number | null;
  days?: number | null;
  includes?: string[];
  contraindications?: string[];
  photo_url?: string | null;
  sort?: number;
}

/** Создание услуги (`ServiceCreate`): поля правки плюс адрес, вид, категория, зона. */
export interface ServiceCreate extends ServicePatch {
  slug: string;
  kind: 'procedure' | 'training' | 'analysis';
  category: string;
  zone?: 'face' | 'body' | 'brows' | 'general';
  title_ru: string;
}

// ── Витрина (публично) ──────────────────────────────────────────────────────

/**
 * GET /services — витрина. Публичная ручка: пропуск НЕ прикладывается даже
 * при сессии (`auth: 'none'`) — каталогу незачем знать, кто его читает, а
 * заголовок авторизации снимает кэш CDN.
 */
export async function getServices(signal?: AbortSignal): Promise<ServerService[]> {
  const r = await apiRequest<{ services?: unknown }>('GET', '/services', { auth: 'none', signal });
  if (!Array.isArray(r?.services)) throw new TypeError('GET /services: в ответе нет массива services');
  return r.services as ServerService[];
}

/** GET /services/{slug} — одна процедура; 404 — такой нет или снята с витрины. */
export async function getService(slug: string, signal?: AbortSignal): Promise<ServerService> {
  const r = await apiRequest<{ service: ServerService }>('GET', `/services/${encodeURIComponent(slug)}`, {
    auth: 'none',
    signal,
  });
  return r.service;
}

/** POST /services/quote — сколько выйдет визит (1–6 процедур). Нужна сессия. */
export async function quoteVisit(slugs: string[], signal?: AbortSignal): Promise<Quote> {
  const r = await apiRequest<{ quote: Quote }>('POST', '/services/quote', { body: { slugs }, signal });
  return r.quote;
}

// ── Прайс владелицы (owner + PIN) — для кабинета ────────────────────────────
// Экраны кабинета — не этой партии; вызовы лежат здесь, потому что это тот
// же домен провода. Отказы: 403 forbidden / pin_required, 404, 422.

/** PATCH /services/{slug} → `{service}`. */
export async function patchService(slug: string, patch: ServicePatch): Promise<ServerService> {
  const r = await apiRequest<{ service: ServerService }>('PATCH', `/services/${encodeURIComponent(slug)}`, {
    body: patch,
  });
  return r.service;
}

/** DELETE /services/{slug} → `{archived}`: снять с витрины (история остаётся). */
export function archiveService(slug: string): Promise<{ archived: string }> {
  return apiRequest('DELETE', `/services/${encodeURIComponent(slug)}`);
}

/** POST /services/{slug}/restore → `{restored}`. */
export function restoreService(slug: string): Promise<{ restored: string }> {
  return apiRequest('POST', `/services/${encodeURIComponent(slug)}/restore`);
}

/** GET /staff/services/archived → `{services}`. */
export async function getArchivedServices(signal?: AbortSignal): Promise<ServerService[]> {
  const r = await apiRequest<{ services: ServerService[] }>('GET', '/staff/services/archived', { signal });
  return r.services;
}

/**
 * POST /services → 201 `{service}`. Ключ идемпотентности — один на намерение
 * (одно нажатие «Добавить»), переживает повторы.
 */
export async function createService(
  body: ServiceCreate,
  idempotencyKey: string,
): Promise<ServerService> {
  const r = await apiRequest<{ service: ServerService }>('POST', '/services', { body, idempotencyKey });
  return r.service;
}
