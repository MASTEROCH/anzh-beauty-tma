// Сверка анкеты клиентки с противопоказаниями процедур визита.
//
// Главное здесь — не список полей, а СВЕРКА: противопоказания услуги
// сопоставляются с анкетой, и совпадения поднимаются наверх. Беременность
// в анкете и «беременность» в противопоказаниях процедуры — это то, что
// нельзя оставлять на внимательность человека в конце смены.
//
// ⚠️ Сверка — по словам, а не по смыслу: «совпадений нет» не значит «можно».
// Поэтому экран при пустом результате говорит «просмотрите анкету», а не
// «конфликта нет».
//
// Анкету отдаёт сервер ТОЛЬКО владелице (GET /clients/{id}/health, флаг
// `health`). У мастера анкеты нет вовсе — и этих флагов тоже.
// 🔴 Медданные: результат сверки — только на экран, никуда больше.

import { findService } from '../data/services';
import type { Appointment } from './appointments';
import type { HealthAnswers } from './api/clients';
import { serviceBySlug } from './studio';

export type FlagLevel = 'stop' | 'check';

export interface Flag {
  level: FlagLevel;
  /** Что в анкете */
  from: string;
  /** Какому противопоказанию услуги это отвечает */
  matches: string;
}

const text = (s: string | undefined): string => (s ?? '').trim();

/* Анкета описана полями, противопоказания — живым текстом. Сводим их
   словарём: ключ — признак анкеты, значения — по каким словам его искать
   в противопоказаниях услуги. Точное совпадение строк тут невозможно, а
   пропустить беременность нельзя. Все поля анкеты необязательны. */
const MATCHERS: Array<{
  level: FlagLevel;
  test: (p: HealthAnswers) => boolean;
  label: (p: HealthAnswers) => string;
  words: string[];
}> = [
  { level: 'stop', test: (p) => p.pregnant === true, label: () => 'Беременность', words: ['беременн'] },
  { level: 'stop', test: (p) => p.lactating === true, label: () => 'Лактация', words: ['лактац', 'кормл'] },
  { level: 'check', test: (p) => p.couperose === true, label: () => 'Купероз', words: ['купероз'] },
  {
    level: 'check',
    test: (p) => !p.noAllergies && (p.allergies?.length ?? 0) > 0,
    label: (p) => `Аллергии: ${(p.allergies ?? []).join(', ')}`,
    words: ['аллерг', 'лидокаин', 'анестез'],
  },
  {
    level: 'check',
    test: (p) => p.sensitivity === 'high',
    label: () => 'Высокая чувствительность',
    words: ['чувствительн', 'раздраж'],
  },
  {
    level: 'check',
    test: (p) => text(p.meds).length > 0,
    label: (p) => `Препараты: ${text(p.meds)}`,
    words: ['антикоагулянт', 'препарат', 'фотосенсибил', 'ретиноид'],
  },
  {
    level: 'check',
    test: (p) => text(p.chronic).length > 0,
    label: (p) => `Хронические: ${text(p.chronic)}`,
    words: ['аутоиммун', 'онколог', 'хронич', 'эпилепс', 'кардиостимул'],
  },
];

/** Противопоказания процедуры: с сервера, а если витрина не загружена — из местного описания. */
function contraOf(slug: string): string[] {
  return serviceBySlug(slug)?.contraindications ?? findService(slug)?.contraindications ?? [];
}

/**
 * Что из анкеты пересекается с противопоказаниями процедур визита.
 * Визит из трёх процедур опасен противопоказанием ЛЮБОЙ из них.
 */
export function flagsFor(slugs: string[], answers: HealthAnswers | null): Flag[] {
  if (!answers) return [];
  const contra = slugs.flatMap(contraOf).map((c) => c.toLowerCase());
  if (contra.length === 0) return [];

  const out: Flag[] = [];
  for (const m of MATCHERS) {
    if (!m.test(answers)) continue;
    const hit = contra.find((c) => m.words.some((w) => c.includes(w)));
    if (hit) out.push({ level: m.level, from: m.label(answers), matches: hit });
  }
  // Сначала «стоп», потом «уточнить» — порядок чтения, а не порядок словаря
  return out.sort((a, b) => (a.level === b.level ? 0 : a.level === 'stop' ? -1 : 1));
}

/** Чувствительность словом; пусто — прочерк, а не «средняя» по умолчанию. */
export function sensitivityWord(s: HealthAnswers['sensitivity'] | '' | undefined): string {
  return s === 'high' ? 'высокая' : s === 'low' ? 'низкая' : s === 'medium' ? 'средняя' : '—';
}

/**
 * Ключ клиентки для экранов, которые ещё читают местные записи (отзывы).
 * В кабинете ключ — telegram_id клиентки с сервера.
 */
export const clientKeyOf = (a: Appointment) => a.clientInstagram || a.clientTgUsername || a.clientName;
