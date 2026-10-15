// Провод анкеты здоровья: GET / PUT / DELETE /me/health (server/openapi.yaml,
// раздел «Согласия и анкета»). Правила папки — как в `api/me.ts`: только типы
// провода и тонкие вызовы, ни состояния, ни React.
//
// 🔴 МЕДДАННЫЕ. Ничего отсюда не пишется в консоль, в журнал, в адрес или в
// аналитику (правила партий §8). Отказ сервера отдаётся наверх как ApiError —
// с кодом, без тела анкеты.

import { apiRequest } from '../session';

/**
 * Белый список ключей анкеты — ровно `HealthAnswers` из openapi. Лишний ключ
 * сервер отвергает `422 unknown_key`, документ больше 8 КБ — `422 too_large`.
 * Все поля необязательные: отсутствие ключа значит «человек не отвечал», и
 * это не то же самое, что `false` (см. `formAt` в lib/healthPassport.ts).
 */
export interface HealthAnswers {
  noAllergies?: boolean;
  /** ≤ 20 пунктов, каждый ≤ 200 знаков */
  allergies?: string[];
  pregnant?: boolean;
  lactating?: boolean;
  /** ≤ 500 */
  chronic?: string;
  /** ≤ 500 */
  meds?: string;
  /** ≤ 64 */
  skinType?: string;
  /** ≤ 8 */
  fitzpatrick?: string;
  couperose?: boolean;
  sensitivity?: 'low' | 'medium' | 'high';
  /** ≤ 1000 */
  notes?: string;
  /** ≤ 200 */
  goal?: string;
  /** ≤ 200 */
  experience?: string;
  /** ≤ 200 */
  pace?: string;
}

/** Лимиты `HealthAnswers` — экран держит их в полях ввода, а не режет молча. */
export const HEALTH_LIMITS = {
  allergiesMax: 20,
  allergyLen: 200,
  chronicLen: 500,
  medsLen: 500,
  notesLen: 1000,
} as const;

/** `HealthProfile`: сохранённая анкета. */
export interface HealthProfile {
  answers: HealthAnswers;
  /**
   * Версия текста согласия, под которой анкета сохранена. Необязательна:
   * провод согласий волны 2 ведёт версии по видам (`Me.legal`), и форма
   * анкеты у Р-3 может её не нести — экран это поле не читает.
   */
  policy_version?: string;
  updated_at: string;
}

/**
 * GET /me/health → `{health}`; анкеты нет — `null`. Флагом и согласием НЕ
 * закрыто: своё читается всегда (умение consent-cannot-gate-own-data-access).
 */
export async function getHealth(signal?: AbortSignal): Promise<HealthProfile | null> {
  const r = await apiRequest<{ health: HealthProfile | null }>('GET', '/me/health', { signal });
  return r?.health ?? null;
}

/**
 * PUT /me/health — ПОЛНАЯ замена документа. Нужны флаг `health` и действующее
 * согласие `health_data`: иначе `403 feature_disabled` / `403 consent_required`.
 */
export async function putHealth(answers: HealthAnswers): Promise<HealthProfile> {
  const r = await apiRequest<{ health: HealthProfile }>('PUT', '/me/health', { body: { answers } });
  return r.health;
}

/** DELETE /me/health → `{deleted:true}`; анкеты не было — ответ тот же. */
export function deleteHealth(): Promise<{ deleted: boolean }> {
  return apiRequest('DELETE', '/me/health');
}
