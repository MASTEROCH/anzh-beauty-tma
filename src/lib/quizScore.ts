// Подсчёт результатов тестов — перенос `calcResult` с anzh.store один в один.
//
// 🚨 Логика завязана на ИНДЕКСЫ ответов и ПОРЯДОК вопросов в data/quizzes.ts.
// Поменять местами вопрос или вариант — значит молча сломать диагностику:
// человек получит чужой тип кожи, а приложение не заметит. Любая правка
// вопросов обязана идти вместе с правкой весов здесь.

import type { Quiz, QuizResult } from '../data/quizzes';

/* ТИП КОЖИ — ДОСЛОВНО КАК НА САЙТЕ (app.js, calcResult, ветка skintype).
   Раньше здесь стояли «исправленные» веса с пометкой, что на сайте четыре
   условия мёртвые. Это было неверно: сайт перед стартом теста переставляет
   вопрос возраста с 8-го места на 1-е (startQuiz: qs.unshift(qs.splice(7,1)[0])),
   и в ЭТОМ порядке все сайтовые условия указывают на существующие и верные
   по смыслу ответы. Аудит 15.10: «исправленная» версия расходилась с сайтом
   в 34 % наборов ответов. Теперь вопросы в data/quizzes.ts стоят в сайтовом
   порядке (возраст первым), а формула и цепочка приоритетов перенесены без
   правок. */

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
      // M — ответы в порядке сайта: 0 возраст · 1 блеск · 2 общий вид ·
      // 3 после умывания · 4 обезвоженность · 5 воспаления · 6 частота ·
      // 7 покраснение · 8 морщины · 9 тургор · 10 пигмент · 11 поры
      const M = answers.map(num);
      const N = (M[1] === 2 ? 3 : 0) + (M[2] === 4 ? 3 : 0) + (M[3] === 3 ? 3 : M[3] === 2 ? 2 : 0) + (M[11] === 1 || M[11] === 4 ? 1 : 0);
      const Y = (M[1] === 0 ? 3 : 0) + (M[2] === 1 || M[2] === 2 ? 3 : 0) + (M[3] === 0 ? 3 : 0) + (M[11] === 3 ? 2 : 0);
      const D = (M[1] === 1 ? 3 : 0) + (M[2] === 3 ? 3 : 0) + (M[3] === 2 ? 2 : 0) + (M[11] === 2 ? 2 : 0) + (M[6] === 3 ? 1 : 0);
      const j = (M[7] === 2 ? 3 : M[7] === 1 ? 1 : 0) + (M[2] === 2 ? 1 : 0);
      // Порядок проверки — приоритет, как на сайте, а не максимум
      const base = N >= 5 ? 'oily' : Y >= 5 ? 'dry' : D >= 4 ? 'combo' : j >= 4 ? 'sensitive' : 'normal';

      const secondary: string[] = [];
      if (M[7] === 2 && base !== 'sensitive') secondary.push('sensitivity');
      if (M[4] === 0 || M[4] === 1) secondary.push('dehydration');
      if ((M[5] === 0 || M[5] === 1) && (M[6] === 0 || M[6] === 3)) secondary.push('acne');
      if ((M[8] >= 1 && M[9] >= 2) || (M[0] >= 3 && M[9] >= 2)) secondary.push('turgor');
      if (M[10] >= 1) secondary.push('pigmentation');

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
      // Как на сайте: смешанный тип — если второй балл ≥ 70 % первого;
      // при равенстве порядок deform > tired > fineline > muscular
      const types = ['fineline', 'tired', 'deform', 'muscular'];
      const prio: Record<number, number> = { 0: 2, 1: 1, 2: 0, 3: 3 };
      const order = [0, 1, 2, 3].sort((x, y) => (score[y] - score[x]) || (prio[x] - prio[y]));
      const [top, second] = order;
      const combined = score[second] >= score[top] * 0.7 && score[second] > 0;
      const out: ScoredResult = combined
        ? (res[`${types[top]}_${types[second]}_${ageKey}`] ?? res[`combined_${ageKey}`] ?? res.combined_mid ?? first)
        : (res[`${types[top]}_${ageKey}`] ?? res[`${types[top]}_mid`] ?? res.combined_mid ?? first);
      // Привычка сжимать челюсть (последний вопрос) — отдельная приписка, как на сайте.
      // Без обещаний эффекта (K14): по показаниям и после осмотра.
      const jaw = answers[16];
      if (jaw === 1 || jaw === 3) {
        const ru = 'Замечено: привычка сжимать челюсть или бруксизм — признак гипертонуса жевательных мышц. С этим работают ботулинотерапией по показаниям; решение — после осмотра у Анжелики.';
        const en = 'Noted: jaw clenching or bruxism is a sign of masseter hypertonus. It is treated with botulinum therapy when indicated; the decision comes after an exam with Anjelika.';
        return { ...out, note: out.note ? `${out.note}\n\n${ru}` : ru, noteEn: out.noteEn ? `${out.noteEn}\n\n${en}` : en };
      }
      return out;
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
  ...[[1, 2], [2, 4], [3, 3], [3, 2], [11, 1], [11, 4],   // жирная
      [1, 0], [2, 1], [2, 2], [3, 0], [11, 3],            // сухая
      [1, 1], [2, 3], [3, 2], [11, 2], [6, 3],            // комбинированная
      [7, 2], [7, 1],                                     // чувствительная
      [4, 0], [4, 1], [5, 0], [5, 1], [6, 0], [8, 1], [9, 2], [0, 3], [10, 1]] // побочные
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
