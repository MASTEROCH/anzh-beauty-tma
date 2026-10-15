// Провод «результаты разборов».
//
// 🔴 [ПРЕДЛОЖЕНИЕ БЭКЕНДУ] В контракте их ещё нет (DELETE /me/consents/health_data
// уже обещает стирать «анкету и разборы» — вот эти разборы). Описано так, как
// ждут экраны; реализовано в tools/dev-stand.mjs.
//
//   GET  /me/quiz-results               свои результаты (последний по каждому тесту)
//   PUT  /me/quiz-results/{quiz_id}     записать/заменить результат теста
//   GET  /clients/{id}/quiz-results     студия, за PIN, видна ли здоровье — как анкета
//
// Это данные о здоровье: писать — только с флагом `health` и действующим
// согласием `health_data` (иначе 403 feature_disabled / consent_required),
// как PUT /me/health. Отзыв согласия стирает и их.

import { apiRequest } from '../session';

export interface QuizResultWire {
  quiz_id: string;
  result_key: string;
  /** Заголовок и подзаголовок итога на языке прохождения — для карточки студии */
  title: string;
  sub: string;
  /** Побочные состояния (только «Тип кожи») */
  secondary?: string[];
  /** Ответы в порядке вопросов: число — один вариант, массив — несколько */
  answers: Array<number | number[]>;
  /** ISO */
  taken_at: string;
}

export async function getMyQuizResults(signal?: AbortSignal): Promise<QuizResultWire[]> {
  const r = await apiRequest<{ results: QuizResultWire[] }>('GET', '/me/quiz-results', { signal });
  return Array.isArray(r?.results) ? r.results : [];
}

export async function putMyQuizResult(r: QuizResultWire): Promise<QuizResultWire> {
  const out = await apiRequest<{ result: QuizResultWire }>('PUT', `/me/quiz-results/${encodeURIComponent(r.quiz_id)}`, { body: r });
  return out.result;
}

export async function getClientQuizResults(clientId: number, signal?: AbortSignal): Promise<QuizResultWire[]> {
  const r = await apiRequest<{ results: QuizResultWire[] }>('GET', `/clients/${clientId}/quiz-results`, { signal });
  return Array.isArray(r?.results) ? r.results : [];
}
