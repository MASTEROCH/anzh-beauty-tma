// Подсчёт результатов тестов — перенос `calcResult` с anzh.store один в один.
//
// 🚨 Логика завязана на ИНДЕКСЫ ответов и ПОРЯДОК вопросов в data/quizzes.ts.
// Поменять местами вопрос или вариант — значит молча сломать диагностику:
// человек получит чужой тип кожи, а приложение не заметит. Любая правка
// вопросов обязана идти вместе с правкой весов здесь.

import type { Quiz, QuizResult } from '../data/quizzes';

/* 🚨 ВЕСА «ТИПА КОЖИ» ИСПРАВЛЕНЫ ОТНОСИТЕЛЬНО САЙТА.
   На anzh.store они написаны под другой порядок вопросов: четыре условия
   ссылаются на несуществующие варианты (a[2]===4 при четырёх вариантах,
   a[3]===3 и a[6]===3 при трёх, a[0]===3 при трёх), а часть указывает не на
   тот ответ — «жирная кожа» получала балл за «часто некомфортно, стянутость,
   покраснение», и «чувствительная» решалась вопросом ВОЗРАСТА.
   Ниже веса переписаны по фактическому смыслу ответов: каждое условие
   указывает на вариант, который этот тип кожи и означает. Исходные веса
   сохранены в SITE_WEIGHTS_LEGACY — расхождение видно и обратимо. */

/** Как было на сайте — оставлено для сверки, в расчёте НЕ участвует */
export const SITE_WEIGHTS_LEGACY = {
  oily:   'a[1]===2 (+3) · a[2]===4 (+3, мёртвое) · a[3]===3|2 (+3/+2, ===3 мёртвое) · a[11]===1|4 (+1)',
  dry:    'a[1]===0 (+3) · a[2]===1|2 (+3) · a[3]===0 (+3) · a[11]===3 (+2)',
  combo:  'a[1]===1 (+3) · a[2]===3 (+3) · a[3]===2 (+2) · a[11]===2 (+2) · a[6]===3 (+1, мёртвое)',
  sens:   'a[7]===2 (+3) — это вопрос «Ваш возраст» · a[2]===2 (+1)',
} as const;

export type Answer = number | number[];

export interface ScoredResult extends QuizResult {
  /** Побочные состояния поверх основного типа — только у теста «Тип кожи» */
  secondary?: string[];
}

const num = (a: Answer | undefined) => (typeof a === 'number' ? a : 0);

export const SECONDARY_LABEL: Record<string, { ru: string; en: string }> = {
  sensitivity:   { ru: 'Чувствительность',      en: 'Sensitivity' },
  dehydration:   { ru: 'Обезвоженность',        en: 'Dehydration' },
  acne:          { ru: 'Склонность к высыпаниям', en: 'Breakout-prone' },
  turgor:        { ru: 'Снижение тургора',      en: 'Loss of firmness' },
  pigmentation:  { ru: 'Пигментация',           en: 'Pigmentation' },
};

export function scoreQuiz(quiz: Quiz, answers: Answer[]): ScoredResult | null {
  const res = quiz.results;
  const keys = Object.keys(res);
  if (keys.length === 0) return null;
  const first = res[keys[0]];
  if (answers.length === 0) return first;

  const pick = (k: string, fallbackIdx = 0): ScoredResult => res[k] ?? res[keys[fallbackIdx]] ?? first;

  switch (quiz.id) {
    case 'profile':
      return pick('done');

    case 'skintype': {
      const a = answers;
      // Каждое условие указывает на ответ, который этот тип кожи и означает:
      // 0 блеск · 1 общий вид · 2 после умывания · 3 обезвоженность ·
      // 4 воспаления · 5 частота · 6 реактивность · 8 морщины · 9 тургор ·
      // 10 пигмент · 11 поры
      const oily  = (num(a[0]) === 2 ? 3 : 0)                       // блестит везде
                  + (num(a[1]) === 4 ? 3 : 0)                       // жирнится, чёрные точки
                  + (num(a[2]) === 3 ? 3 : 0)                       // жирная по всему лицу
                  + (num(a[11]) === 1 || num(a[11]) === 4 ? 2 : 0); // расширенные поры
      const dry   = (num(a[0]) === 0 ? 2 : 0)                       // матовая
                  + (num(a[1]) === 1 ? 3 : 0)                       // сухая, стягивает
                  + (num(a[2]) === 0 ? 3 : 0)                       // шелушится после умывания
                  + (num(a[11]) === 3 ? 2 : 0);                     // поры чистые, но шелушение
      const combo = (num(a[0]) === 1 ? 3 : 0)                       // блестит нос и лоб
                  + (num(a[1]) === 3 ? 3 : 0)                       // Т-зона жирная, щёки сухие
                  + (num(a[2]) === 2 ? 3 : 0)                       // жирнится участками
                  + (num(a[11]) === 2 ? 2 : 0);                     // поры только в Т-зоне
      const sens  = (num(a[1]) === 2 ? 3 : 0)                       // стянутость и покраснение
                  + (num(a[6]) === 2 ? 3 : num(a[6]) === 1 ? 1 : 0); // реагирует на тепло и еду

      let base = 'normal';
      const top = Math.max(oily, dry, combo, sens);
      if (top >= 5) {
        base = top === oily ? 'oily' : top === combo ? 'combo' : top === dry ? 'dry' : 'sensitive';
      }

      const secondary: string[] = [];
      if (num(a[6]) === 2 && base !== 'sensitive') secondary.push('sensitivity');
      if (num(a[3]) === 0 || num(a[3]) === 1) secondary.push('dehydration');
      if ((num(a[4]) === 0 || num(a[4]) === 1) && (num(a[5]) === 0 || num(a[5]) === 3)) secondary.push('acne');
      if ((num(a[8]) >= 1 && num(a[9]) >= 2) || (num(a[7]) >= 3 && num(a[9]) >= 2)) secondary.push('turgor');
      if (num(a[10]) >= 1) secondary.push('pigmentation');

      return { ...pick(base), secondary };
    }

    case 'aging': {
      // Вопросы 4 и 7 — множественный выбор, считаются отдельно
      let sum = 0, count = 0;
      answers.forEach((v, i) => {
        if (i === 4 || i === 7) return;
        sum += num(v);
        count += 1;
      });
      if (Array.isArray(answers[4])) sum += Math.min(answers[4].filter((x) => x !== 4).length, 4);
      if (Array.isArray(answers[7])) sum += answers[7].includes(3) ? 0 : answers[7].length;
      const avg = count > 0 ? sum / (count + 2) : 0;
      if (avg < 1) return pick('prevention');
      if (avg < 1.8) return pick('first_changes', 1);
      if (avg < 2.5) return pick('pronounced', 2);
      return pick('intensive', 3);
    }

    case 'sensitivity': {
      const sum = answers.reduce<number>((s, v) => s + (typeof v === 'number' && v <= 2 ? v : 0), 0);
      if (sum <= 5) return pick('stable');
      if (sum <= 12) return pick('moderate', 1);
      if (sum <= 20) return pick('pronounced', 2);
      return pick('hyper', 3);
    }

    case 'glow': {
      // Чем меньше индекс ответа, тем лучше показатель — отсюда инверсия
      const sum = answers.reduce<number>((s, v) => s + (4 - num(v)), 0);
      if (sum >= 32) return pick('high');
      if (sum >= 24) return pick('medium', 1);
      if (sum >= 16) return pick('low', 2);
      return pick('problem', 3);
    }

    case 'homecare': {
      const W = [[2,2,2,2,0],[0,2,1,0,0],[2,1,0,0],[2,1,0,0],[2,1,0],[2,1,0],[2,1,0],[2,1,0],[2,1,0],[2,1,0],[2,1,0],[2,1,0]];
      const sum = answers.reduce<number>((s, v, i) => s + (W[i]?.[num(v)] ?? 0), 0);
      if (sum >= 18) return pick('pro');
      if (sum >= 10) return pick('medium', 1);
      return pick('beginner', 2);
    }

    case 'morphotype': {
      // Четыре колонки — четыре морфотипа; вопрос 1 задаёт возрастную группу
      const ageIdx = num(answers[1]);
      const ageKey = ({ 0: 'young', 1: 'mid', 2: 'mature' } as Record<number, string>)[ageIdx] ?? 'mid';
      const W: number[][][] = [
        [[2,0,0,0],[0,2,0,0],[0,0,2,0],[0,0,0,2]],
        [[0,5,0,0],[0,0,5,0],[5,0,0,0],[0,0,0,5]],
        [[0,2,0,0],[0,0,2,0],[2,0,0,0],[0,0,0,2]],
        [[0,2,0,0],[0,0,2,0],[2,0,0,0],[0,0,0,2]],
        [[0,3,0,0],[0,0,3,0],[3,0,0,0],[0,0,0,3]],
        [[0,3,0,0],[0,0,3,0],[3,0,0,0],[0,0,0,3]],
        [[0,1,0,0],[0,0,1,0],[1,0,0,0],[0,0,0,1]],
        [[0,2,0,0],[0,0,2,0],[2,0,0,0],[0,0,0,2]],
        [[0,2,0,0],[0,0,2,0],[2,0,0,0],[0,0,0,2]],
        [[0,3,0,0],[0,0,3,0],[3,0,0,0],[0,0,0,3]],
        [[0,2,0,0],[0,0,2,0],[2,0,0,0],[0,0,0,2]],
        [[0,2,0,0],[0,0,2,0],[2,0,0,0],[0,0,0,2]],
        [[0,2,0,0],[0,0,2,0],[2,0,0,0],[0,0,0,2]],
        [[0,1,0,0],[0,0,1,0],[1,0,0,0],[0,0,0,1]],
        [[0,0,0,0],[0,0,0,1],[0,0,0,0],[0,0,0,3]],
      ];
      const score = [0, 0, 0, 0];
      for (let i = 2; i < answers.length && i <= 16; i++) {
        const row = W[i - 2];
        const col = row?.[num(answers[i])];
        if (col) col.forEach((v, k) => { score[k] += v; });
      }
      const types = ['fineline', 'tired', 'deform', 'muscular'];
      const top = score.indexOf(Math.max(...score));
      const sorted = [...score].sort((x, y) => y - x);
      // Два типа вплотную — это смешанный морфотип, у сайта он отдельным ключом
      const mixed = sorted[0] - sorted[1] <= 2 && res[`combined_${ageKey}`];
      const key = mixed ? `combined_${ageKey}` : `${types[top]}_${ageKey}`;
      return pick(key);
    }

    default:
      return first;
  }
}


/* ── Проверка достижимости весов ──
   Вес, ссылающийся на несуществующий вариант ответа, не падает и не виден —
   он просто никогда не срабатывает, и человек получает чужой диагноз.
   Считаем это в разработке и говорим вслух. */

interface WeightRef { quiz: string; question: number; answer: number }

const WEIGHT_REFS: WeightRef[] = [
  ...[[0, 2], [1, 4], [2, 3], [11, 1], [11, 4],   // жирная
      [0, 0], [1, 1], [2, 0], [11, 3],            // сухая
      [0, 1], [1, 3], [2, 2], [11, 2],            // комбинированная
      [1, 2], [6, 2], [6, 1],                     // чувствительная
      [3, 0], [3, 1], [4, 0], [4, 1], [5, 0], [5, 3],
      [8, 1], [9, 2], [7, 3], [10, 1]]            // побочные состояния
    .map(([question, answer]) => ({ quiz: 'skintype', question, answer })),
];

export function unreachableWeights(quizzes: Quiz[]): WeightRef[] {
  const dead: WeightRef[] = [];
  for (const ref of WEIGHT_REFS) {
    const q = quizzes.find((x) => x.id === ref.quiz);
    const options = q?.questions[ref.question]?.a.length ?? 0;
    if (ref.answer >= options) dead.push(ref);
  }
  return dead;
}

if (typeof import.meta !== 'undefined' && (import.meta as { env?: { DEV?: boolean } }).env?.DEV) {
  import('../data/quizzes').then(({ QUIZZES }) => {
    const dead = unreachableWeights(QUIZZES);
    if (dead.length > 0) {
      console.warn(
        `[quizScore] весов без достижимого ответа: ${dead.length} — ` +
        dead.map((d) => `${d.quiz} a[${d.question}]===${d.answer}`).join(', ') +
        '. Диагноз по ним не сработает никогда.',
      );
    }
  });
}
