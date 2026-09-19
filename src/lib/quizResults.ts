// Результаты разборов. Без них тест был витриной: человек проходил 12
// вопросов, видел вывод — и, закрыв шторку, терял его навсегда. А весь смысл
// по словам Анжелики в обратном: «люди проходят тесты, формируется паспорт
// пациента, и ты заранее знаешь, кто что и чем пришёл».
//
// Поэтому результат живёт в трёх местах сразу: у клиента в кабинете, в
// паспорте кожи (ключевые поля) и в карточке клиента у мастера.

import { useEffect, useState } from 'react';
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

const KEY = 'anzh_quiz_results_v1';
const listeners = new Set<(r: StoredResult[]) => void>();

function load(): StoredResult[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as StoredResult[]) : [];
  } catch {
    return [];
  }
}

let items: StoredResult[] = load();

export function saveResult(r: StoredResult) {
  // Один разбор — одна запись: пройденный заново тест заменяет прошлый,
  // иначе в кабинете копятся дубли одного и того же теста
  items = [r, ...items.filter((x) => x.quizId !== r.quizId)];
  try { localStorage.setItem(KEY, JSON.stringify(items)); } catch { /* ignore */ }
  listeners.forEach((l) => l(items));
}

export function useQuizResults(): StoredResult[] {
  const [s, setS] = useState<StoredResult[]>(items);
  useEffect(() => {
    listeners.add(setS);
    return () => { listeners.delete(setS); };
  }, []);
  return s;
}

