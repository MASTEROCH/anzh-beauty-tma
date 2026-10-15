// Провод «главы паспорта»: разборы открываются не только за Stars, но и
// за пройденные процедуры и за подруг, которые пришли на процедуру.
//
// 🔴 [ПРЕДЛОЖЕНИЕ БЭКЕНДУ] Считает ТОЛЬКО сервер (клиенту не верим):
//   доступно глав = процедур «проведён» + ⌊подруг с проведённой процедурой / N⌋ − уже открытых.
//   Подруга засчитывается после ЕЁ первой проведённой процедуры (не после
//   регистрации): иначе главы раздаются за фейковые аккаунты.
//
//   GET  /me/passport                 → {passport}
//   POST /me/passport/unlock {quiz_id} → {passport}   409 no_credits · 409 already_open · 422 not_paid_quiz
//   Правила — в профиле студии: Studio.passport_rules {enabled, friends_per_chapter}; правит владелица (PATCH /studio).

import { apiRequest } from '../session';

export interface PassportWire {
  enabled: boolean;
  /** Сколько глав можно открыть прямо сейчас */
  credits: number;
  /** quiz_id, открытые главами (купленные за Stars — в /me/purchases) */
  unlocked: string[];
  visits_done: number;
  friends_done: number;
  friends_per_chapter: number;
}

export async function getMyPassport(signal?: AbortSignal): Promise<PassportWire> {
  const r = await apiRequest<{ passport: PassportWire }>('GET', '/me/passport', { signal });
  return r.passport;
}

export async function unlockChapter(quizId: string): Promise<PassportWire> {
  const r = await apiRequest<{ passport: PassportWire }>('POST', '/me/passport/unlock', { body: { quiz_id: quizId } });
  return r.passport;
}
