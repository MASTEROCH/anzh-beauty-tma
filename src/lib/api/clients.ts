// Провод «Клиентки» кабинета: список, карточка, заметки мастеров, анкета.
// Источник правды — server/openapi.yaml, тег «Клиентки».
//
// 🔴 МЕДДАННЫЕ. Заметки мастеров и анкета — медицинские сведения: не в
// консоль, не в хранилище, не в адрес, не в аналитику. Здесь они только
// проходят насквозь от `apiRequest` к экрану.
//
// Видимость решает сервер (Х14, api/_domain/clients.js canSeeClient): мастер
// видит клиентку, пока у них есть действующая связь — визит confirmed/done за
// последние 12 месяцев или будущая pending/confirmed запись; так и в списке
// GET /clients, и в карточке, и в заметках. Нет связи — 404, а не 403.
// Владелица видит всех. Заметки — только автору и владелице. Анкету читает
// ТОЛЬКО владелица отдельной ручкой; у мастера этой ручки нет вовсе (403).

import { apiRequest } from '../session';
import type { BookingStatus } from './staff';

/** Схема `ClientSummary`. */
export interface ClientSummary {
  telegram_id: number;
  first_name?: string | null;
  last_name?: string | null;
  username?: string | null;
  visits?: number;
  no_shows?: number;
  cancelled?: number;
  /**
   * ⚠️ The server (api/_domain/clients.js COUNTERS) adds up EVERY currency of her
   * visits, and `currency` is one of them — with lari and dollars the number is
   * mixed. The card splits it by the history rows (ClientCardView); a per-currency
   * field is a server task (K6 report).
   */
  spent_minor?: number;
  currency?: string | null;
  /** [ПРЕДЛОЖЕНИЕ] CRM-сегменты: due — пора повторить, lapsed — > 90 дней без визита, new — один визит */
  segments?: Array<'due' | 'lapsed' | 'new'>;
  /** Что пора повторить: процедура, когда была, интервал */
  due?: Array<{ slug: string; title_ru?: string; last_at: string; every_days: number }>;
  first_visit?: string | null;
  last_visit?: string | null;
}

/** Схема `ClientCard`. Анкеты в карточке нет — только отдельной ручкой. */
export interface ClientCardWire extends ClientSummary {
  instagram?: string | null;
  phone?: string | null;
  created_at?: string;
  discount_percent?: number;
}

/** Схема `HistoryEntry`. */
export interface HistoryEntry {
  id: string;
  starts_at: string;
  status: BookingStatus;
  total_minor?: number;
  paid_minor?: number | null;
  currency?: string;
  staff_id?: number;
  /** slug процедур визита. */
  services?: string[];
}

/** Схема `Note`. */
export interface Note {
  id: string;
  body: string;
  author_id: number;
  author_name?: string | null;
  created_at: string;
}

/** Схема `HealthAnswers` — белый список полей анкеты, все необязательные. */
export interface HealthAnswers {
  noAllergies?: boolean;
  allergies?: string[];
  pregnant?: boolean;
  lactating?: boolean;
  chronic?: string;
  meds?: string;
  skinType?: string;
  fitzpatrick?: string;
  couperose?: boolean;
  sensitivity?: 'low' | 'medium' | 'high';
  notes?: string;
  goal?: string;
  experience?: string;
  pace?: string;
}

/** Схема `HealthProfile`. */
export interface HealthProfile {
  answers: HealthAnswers;
  policy_version: string;
  updated_at: string;
}

/** GET /clients (staff + PIN). */
export async function getClients(
  q: { search?: string; limit?: number } = {},
  signal?: AbortSignal,
): Promise<ClientSummary[]> {
  const r = await apiRequest<{ clients: ClientSummary[] }>('GET', '/clients', {
    query: { search: q.search, limit: q.limit },
    signal,
  });
  return r.clients;
}

/** GET /clients/{telegramId} → `{client, history}` (staff + PIN). */
export function getClient(
  telegramId: number,
  signal?: AbortSignal,
): Promise<{ client: ClientCardWire; history: HistoryEntry[] }> {
  return apiRequest('GET', `/clients/${telegramId}`, { signal });
}

/**
 * GET /clients/{telegramId}/health — ТОЛЬКО владелица с PIN и при включённом
 * флаге `health`. Каждый вызов пишет строку журнала доступа на сервере —
 * поэтому зовётся только по явному нажатию, а не при открытии карточки.
 */
export async function getClientHealth(telegramId: number, signal?: AbortSignal): Promise<HealthProfile | null> {
  const r = await apiRequest<{ health: HealthProfile | null }>('GET', `/clients/${telegramId}/health`, { signal });
  return r.health;
}

/** GET /clients/{telegramId}/notes — новые сверху. */
export async function getNotes(telegramId: number, signal?: AbortSignal): Promise<Note[]> {
  const r = await apiRequest<{ notes: Note[] }>('GET', `/clients/${telegramId}/notes`, { signal });
  return r.notes;
}

/** POST /clients/{telegramId}/notes с Idempotency-Key (ключ — на одно нажатие «Сохранить»). */
export async function addNote(telegramId: number, body: string, idempotencyKey: string): Promise<Note> {
  const r = await apiRequest<{ note: Note }>('POST', `/clients/${telegramId}/notes`, {
    body: { body },
    idempotencyKey,
  });
  return r.note;
}

/**
 * DELETE /notes/{id} — автор или владелица. Иначе — 404 `not_found`, как будто
 * заметки нет (Х14: 403 подтвердил бы, что о клиентке кто-то пишет); 404 и
 * когда её уже удалили.
 */
export function deleteNote(id: string): Promise<{ deleted: true }> {
  return apiRequest('DELETE', `/notes/${encodeURIComponent(id)}`);
}
