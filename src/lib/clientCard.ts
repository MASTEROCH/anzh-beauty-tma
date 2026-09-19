// Карта клиента: всё, что Анжелика должна знать ДО того, как нажмёт
// «подтвердить».
//
// Раньше эти сведения лежали в трёх несвязанных местах: заявка — в
// `appointments`, анкета здоровья — в `healthPassport`, результаты разборов —
// в `quizResults`. Мастер видел имя и услугу, а «была ли раньше», «что
// нельзя» и «что показал разбор» приходилось вспоминать или спрашивать
// заново на приёме — то есть тратить визит на то, что уже записано.
//
// Главное здесь — не список полей, а СВЕРКА: противопоказания услуги
// сопоставляются с анкетой, и совпадения поднимаются наверх. Беременность
// в анкете и «беременность» в противопоказаниях процедуры — это то, что
// нельзя оставлять на внимательность человека в конце смены.
//
// ⚠️ Прототип: анкета и результаты лежат в localStorage одного устройства,
// поэтому в кабинете мастера видны только «свои». На бою это профиль
// клиента на сервере по Telegram-ID.

import { findService } from '../data/services';
import type { Appointment } from './appointments';
import type { HealthPassport } from './healthPassport';
import type { StoredResult } from './quizResults';

export type FlagLevel = 'stop' | 'check';

export interface Flag {
  level: FlagLevel;
  /** Что в анкете */
  from: string;
  /** Какому противопоказанию услуги это отвечает */
  matches: string;
}

export interface ClientCard {
  name: string;
  handle?: string;
  /** Сколько раз доходила до процедуры */
  visits: number;
  /** Была ли раньше вообще */
  returning: boolean;
  lastVisitISO?: string;
  /** Сколько раз не пришла — это меняет решение о подтверждении */
  noShows: number;
  spentUsd: number;
  /** Что уже делала — от свежего к старому */
  history: Array<{ dateISO: string; title: string; amount?: number }>;
  flags: Flag[];
  passport: HealthPassport | null;
  quizzes: StoredResult[];
}

/* Анкета описана полями, противопоказания — живым текстом. Сводим их
   словарём: ключ — признак анкеты, значения — по каким словам его искать
   в противопоказаниях услуги. Точное совпадение строк тут невозможно, а
   пропустить беременность нельзя. */
const MATCHERS: Array<{
  level: FlagLevel;
  test: (p: HealthPassport) => boolean;
  label: (p: HealthPassport) => string;
  words: string[];
}> = [
  {
    level: 'stop',
    test: (p) => p.pregnant,
    label: () => 'Беременность',
    words: ['беременн'],
  },
  {
    level: 'stop',
    test: (p) => p.lactating,
    label: () => 'Лактация',
    words: ['лактац', 'кормл'],
  },
  {
    level: 'check',
    test: (p) => p.couperose,
    label: () => 'Купероз',
    words: ['купероз'],
  },
  {
    level: 'check',
    test: (p) => !p.noAllergies && p.allergies.length > 0,
    label: (p) => `Аллергии: ${p.allergies.join(', ')}`,
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
    test: (p) => p.meds.trim().length > 0,
    label: (p) => `Препараты: ${p.meds.trim()}`,
    words: ['антикоагулянт', 'препарат', 'фотосенсибил', 'ретиноид'],
  },
  {
    level: 'check',
    test: (p) => p.chronic.trim().length > 0,
    label: (p) => `Хронические: ${p.chronic.trim()}`,
    words: ['аутоиммун', 'онколог', 'хронич', 'эпилепс', 'кардиостимул'],
  },
];

/** Что из анкеты пересекается с противопоказаниями конкретной услуги */
export function flagsFor(serviceId: string, passport: HealthPassport | null): Flag[] {
  if (!passport) return [];
  const svc = findService(serviceId);
  if (!svc) return [];
  const contra = svc.contraindications.map((c) => c.toLowerCase());

  const out: Flag[] = [];
  for (const m of MATCHERS) {
    if (!m.test(passport)) continue;
    const hit = contra.find((c) => m.words.some((w) => c.includes(w)));
    if (hit) out.push({ level: m.level, from: m.label(passport), matches: hit });
  }
  // Сначала «стоп», потом «уточнить» — порядок чтения, а не порядок словаря
  return out.sort((a, b) => (a.level === b.level ? 0 : a.level === 'stop' ? -1 : 1));
}

/** Ключ клиента: инстаграм надёжнее имени — тёзок больше, чем аккаунтов */
export const clientKeyOf = (a: Appointment) => a.clientInstagram || a.clientTgUsername || a.clientName;

export function buildClientCard(
  appt: Appointment,
  all: Appointment[],
  passport: HealthPassport | null,
  quizzes: StoredResult[],
): ClientCard {
  const key = clientKeyOf(appt);
  const mine = all.filter((a) => clientKeyOf(a) === key);
  const done = mine
    .filter((a) => a.status === 'completed')
    .sort((a, b) => b.dateISO.localeCompare(a.dateISO));

  return {
    name: appt.clientName,
    handle: appt.clientInstagram || appt.clientTgUsername,
    visits: done.length,
    // «Была раньше» считаем по завершённым визитам, а не по числу заявок:
    // три отменённые записи не делают человека постоянным клиентом
    returning: done.length > 0,
    lastVisitISO: done[0]?.dateISO,
    noShows: mine.filter((a) => a.status === 'no-show').length,
    spentUsd: done.reduce((s, a) => s + (a.amount ?? 0), 0),
    history: done.slice(0, 8).map((a) => ({
      dateISO: a.dateISO,
      title: findService(a.serviceId)?.title ?? a.serviceId,
      amount: a.amount,
    })),
    flags: flagsFor(appt.serviceId, passport),
    passport,
    quizzes: [...quizzes].sort((a, b) => b.takenAt - a.takenAt),
  };
}
