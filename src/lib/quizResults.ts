// Результаты разборов. Без них тест был витриной: человек проходил 12
// вопросов, видел вывод — и, закрыв шторку, терял его. А весь смысл по
// словам Анжелики в обратном: «люди проходят тесты, формируется паспорт
// пациента, и ты заранее знаешь, кто что и чем пришёл».
//
// ГДЕ ЖИВУТ. Только в памяти этого запуска. На устройстве результаты больше
// не хранятся: ответы разбора — данные о здоровье, а ключ
// `anzh_quiz_results_v1` стоит в списке разовой чистки (план 11b, m8:
// на устройстве остаются только onboarded, favorites, gender, lang).
// Разборы на сервере — второй ряд, не этой ночью. Что сохраняется надолго —
// ключевые поля в анкете (lib/healthPassport.ts, `saveQuizToPassport`), и
// только с согласием на данные о здоровье.
//
// Доступ к платному разбору решает НЕ этот список, а покупки с сервера
// (lib/payments.ts): результат в памяти не открывает разбор без оплаты.

import { useSyncExternalStore } from 'react';
import type { Answer } from './quizScore';

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

export function useQuizResults(): StoredResult[] {
  return useSyncExternalStore(subscribe, () => items, () => items);
}
