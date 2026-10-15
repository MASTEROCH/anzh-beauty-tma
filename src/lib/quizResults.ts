// Результаты разборов. Без них тест был витриной: человек проходил 12
// вопросов, видел вывод — и, закрыв шторку, терял его. А весь смысл по
// словам Анжелики в обратном: «люди проходят тесты, формируется паспорт
// пациента, и ты заранее знаешь, кто что и чем пришёл».
//
// ГДЕ ЖИВУТ. На устройстве — нет: ответы разбора — данные о здоровье, ключ
// `anzh_quiz_results_v1` в списке разовой чистки (план 11b, m8). Надолго —
// на СЕРВЕРЕ (api/quizzes.ts), КАЖДЫЙ из семи разборов, и только с флагом
// `health` и согласием на данные о здоровье. Там их видит «Паспорт» после
// перезапуска и студия в карточке клиентки. Раньше на сервер уходили лишь
// итоги «Профиля» и «Типа кожи», остальные пять терялись с закрытием
// приложения (аудит 15.10). Без согласия — в памяти запуска, и экран
// результата прямо говорит об этом (SaveNote).
//
// Доступ к платному разбору решает НЕ этот список, а покупки с сервера
// (lib/payments.ts): результат в памяти не открывает разбор без оплаты.

import { useEffect, useSyncExternalStore } from 'react';
import type { Answer } from './quizScore';
import { getMyQuizResults, putMyQuizResult, type QuizResultWire } from './api/quizzes';
import { healthSyncAllowed } from './healthPassport';

export interface StoredResult {
  quizId: string;
  quizTitle: string;
  resultKey: string;
  title: string;
  sub: string;
  secondary?: string[];
  answers: Answer[];
  takenAt: number;
}

let items: StoredResult[] = [];
const listeners = new Set<() => void>();

function emit(): void {
  for (const l of listeners) {
    try { l(); } catch { /* подписчик не вправе уронить остальных */ }
  }
}

export function saveResult(r: StoredResult) {
  // Один разбор — одна запись: пройденный заново тест заменяет прошлый,
  // иначе в кабинете копятся дубли одного и того же теста
  items = [r, ...items.filter((x) => x.quizId !== r.quizId)];
  emit();
}

/** Стереть результаты из памяти (удаление аккаунта, отзыв согласия). */
export function clearQuizResults(): void {
  items = [];
  emit();
}

function subscribe(l: () => void): () => void {
  listeners.add(l);
  return () => { listeners.delete(l); };
}

export const toWire = (r: StoredResult): QuizResultWire => ({
  quiz_id: r.quizId, result_key: r.resultKey, title: r.title, sub: r.sub,
  secondary: r.secondary, answers: r.answers, taken_at: new Date(r.takenAt).toISOString(),
});

export const fromWire = (w: QuizResultWire): StoredResult => ({
  quizId: w.quiz_id, quizTitle: w.quiz_id, resultKey: w.result_key, title: w.title, sub: w.sub,
  secondary: w.secondary, answers: w.answers, takenAt: Date.parse(w.taken_at) || Date.now(),
});

/** Записать на сервер: 'saved' / 'kept_local' (нельзя — нет входа или согласия) / 'failed' */
export async function syncQuizResult(r: StoredResult): Promise<'saved' | 'kept_local' | 'failed'> {
  if (!healthSyncAllowed()) return 'kept_local';
  try { await putMyQuizResult(toWire(r)); return 'saved'; } catch { return 'failed'; }
}

let loading: Promise<void> | null = null;
/** Подтянуть сохранённые разборы с сервера (один раз за запуск, когда можно). */
export function loadQuizResults(): Promise<void> {
  if (loading || !healthSyncAllowed()) return loading ?? Promise.resolve();
  loading = getMyQuizResults().then((server) => {
    const local = new Map(items.map((x) => [x.quizId, x]));
    for (const w of server) {
      const r = fromWire(w);
      const mine = local.get(r.quizId);
      if (!mine || mine.takenAt < r.takenAt) local.set(r.quizId, { ...r, quizTitle: mine?.quizTitle ?? r.quizTitle });
    }
    items = [...local.values()].sort((a, b) => b.takenAt - a.takenAt);
    emit();
  }).catch(() => { loading = null; });
  return loading;
}

export function useQuizResults(): StoredResult[] {
  useEffect(() => { void loadQuizResults(); }, []);
  return useSyncExternalStore(subscribe, () => items, () => items);
}
