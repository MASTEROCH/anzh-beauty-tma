// Пол спрашиваем прямо и ДО первого гендерного экрана — иначе приложение
// успевает сказать «и ты записана» человеку, к которому это обращение не
// подходит. Угадывать по имени не стали: «Саша», «Женя», «Валя» неразрешимы,
// а ошибка в обращении заметнее, чем лишний вопрос на одном шаге знакомства.

import { useEffect, useState } from 'react';

export type Gender = 'f' | 'm';

const KEY = 'anzh_gender_v1';
const listeners = new Set<(g: Gender) => void>();

function load(): Gender | null {
  if (typeof window === 'undefined') return null;
  try {
    const saved = localStorage.getItem(KEY) as Gender | null;
    if (saved === 'f' || saved === 'm') return saved;
  } catch { /* ignore */ }
  return null;
}

let current: Gender | null = load();


/** Для копирайта, пока пол не спросили: аудитория кабинета женская */
export function genderOrDefault(): Gender {
  return current ?? 'f';
}

export function setGender(g: Gender) {
  current = g;
  try { localStorage.setItem(KEY, g); } catch { /* ignore */ }
  listeners.forEach((l) => l(g));
}

export function useGender(): Gender {
  const [s, setS] = useState<Gender>(genderOrDefault);
  useEffect(() => {
    listeners.add(setS);
    return () => { listeners.delete(setS); };
  }, []);
  return s;
}

/** g('записана', 'записан') — выбирает форму по полу */
export function g(fem: string, masc: string, gender: Gender = genderOrDefault()): string {
  return gender === 'f' ? fem : masc;
}
