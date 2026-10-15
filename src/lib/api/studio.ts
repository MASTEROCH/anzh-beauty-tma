// Провод «студия»: контакты и адрес, акции, загрузка фотографий.
//
// 🔴 [ПРЕДЛОЖЕНИЕ БЭКЕНДУ] Этих ручек в серверном контракте (openapi.yaml)
// ЕЩЁ НЕТ. Они описаны здесь так, как их ждёт кабинет, и реализованы в
// локальном стенде `tools/dev-stand.mjs`, чтобы форму можно было проверить
// глазами. Правила и поля — в DEV-STAND.md. Когда сервер их заведёт, менять
// здесь придётся только то, в чём он разойдётся с этим описанием; экраны
// ходят сюда, а не в сеть напрямую.
//
// Что в них осознанно ТАК:
//   · `GET /studio` и `GET /promos` — публичные, без пропуска: контакты и
//     акции видит и гость вне Telegram, как и витрину (`GET /services`);
//   · правят их только владелица с подтверждённым PIN, как и прайс;
//   · адрес фотографии — только относительный `/photos/…` (тот же запрет,
//     что у `photo_url` услуги, см. SAFE_PHOTO в data/services.ts): чужой
//     домен и скобка в строке до `url(...)` не доходят.

import { apiRequest } from '../session';

export interface Bilingual { ru: string; en: string }

/** Схема `Studio`. Всё, что клиентка видит как «контакты и адрес студии». */
export interface StudioWire {
  name: string;
  tagline: Bilingual;
  city: Bilingual;
  street: Bilingual;
  floor: Bilingual;
  /** «10 мин от Boulevard» — одна строка, как найти. */
  hint: Bilingual;
  /** Приметы для того, кто уже стоит у двери. */
  landmarks?: { ru: string[]; en: string[] };
  lat: number;
  lon: number;
  /** Имя в Telegram без @ — куда ведёт «Написать студии». */
  telegram: string;
  instagram: string | null;
  /** Международный формат с «+»: по нему строится `tel:`. */
  phone: string | null;
  /** Только цифры с кодом страны: по ним строится `wa.me`. */
  whatsapp: string | null;
  hours: Bilingual;
  /** Выходные: 0 — воскресенье … 6 — суббота. */
  off_days?: number[];
}

export type StudioPatch = Partial<StudioWire>;

export async function getStudio(signal?: AbortSignal): Promise<StudioWire> {
  const r = await apiRequest<{ studio: StudioWire }>('GET', '/studio', { auth: 'none', signal });
  return r.studio;
}

/** PATCH /studio — только присланные поля. Пустая правка — 422 `empty_patch`: не слать. */
export async function patchStudio(patch: StudioPatch): Promise<StudioWire> {
  const r = await apiRequest<{ studio: StudioWire }>('PATCH', '/studio', { body: patch });
  return r.studio;
}

// ── Акции ───────────────────────────────────────────────────────────────────

export type PromoKind = 'percent' | 'amount' | 'gift';

/**
 * Схема `Promo`. Акция — правило со сроком, а не текст: что даём, на что,
 * до какого числа. Размер скидки считает СЕРВЕР при расчёте визита
 * (`POST /services/quote` → `discount_percent`); клиент акцию только
 * показывает и значку у процедуры верит ответу сервера, а не своей арифметике.
 */
export interface PromoWire {
  id: string;
  title: Bilingual;
  description?: Bilingual;
  kind: PromoKind;
  /** percent: 5…90; amount: минорные единицы `currency`; gift: не используется. */
  value?: number;
  currency?: string | null;
  /** Подарок словами, только для `gift`. */
  gift?: Bilingual;
  /** slug процедур; пусто или нет поля — на все. */
  services?: string[];
  /** ISO-даты начала и конца действия (включительно). */
  starts_at: string;
  ends_at: string;
  active: boolean;
  created_at?: string;
}

export type PromoInput = Omit<PromoWire, 'id' | 'created_at' | 'active'> & { active?: boolean };

/** GET /promos — клиентке только действующие сейчас; владелице — все. */
export async function getPromos(signal?: AbortSignal): Promise<PromoWire[]> {
  const r = await apiRequest<{ promos: PromoWire[] }>('GET', '/promos', { signal });
  return Array.isArray(r?.promos) ? r.promos : [];
}

export async function createPromo(input: PromoInput): Promise<PromoWire> {
  const r = await apiRequest<{ promo: PromoWire }>('POST', '/promos', { body: input });
  return r.promo;
}

export async function patchPromo(id: string, patch: Partial<PromoInput>): Promise<PromoWire> {
  const r = await apiRequest<{ promo: PromoWire }>('PATCH', `/promos/${encodeURIComponent(id)}`, { body: patch });
  return r.promo;
}

export function deletePromo(id: string): Promise<{ deleted: string }> {
  return apiRequest('DELETE', `/promos/${encodeURIComponent(id)}`);
}

// ── Фотографии ──────────────────────────────────────────────────────────────

/**
 * POST /uploads — загрузить снимок. Тело — JSON с готовым WebP в base64:
 * кабинет сжимает снимок на устройстве (≤ 1600 px по длинной стороне), и в
 * сеть уходит сотни килобайт, а не двадцать мегабайт с телефона. Ответ — тот
 * самый относительный адрес `/photos/…`, который затем идёт в `photo_url`.
 * Отказы: 413 `too_large`, 415 `bad_type`, 429.
 */
export async function uploadPhoto(base64: string, idempotencyKey: string): Promise<{ url: string }> {
  return apiRequest<{ url: string }>('POST', '/uploads', {
    body: { content_type: 'image/webp', data: base64 },
    idempotencyKey,
    timeoutMs: 30_000,
  });
}
