// Скидка, которую надо заслужить.
//
// Раньше −20% давал тап по шильдику: кнопка «дай мне скидку», которую нажмёт
// каждый. Скидка без действия — это просто другая цена, только выглядящая
// как подарок.
//
// Три задания, и они РАЗНЫЕ по проверяемости — отсюда три разных исхода,
// а не один «выполнено»:
//
//   review — отзыв написан прямо здесь. Видно приложению → скидка сразу.
//   invite — ссылка с меткой Telegram-ID. Друг откроет → зачтётся на сервере.
//            Честно говорим: ждём друга. Обещать скидку за нажатие «поделиться»
//            нельзя — поделиться можно в пустоту.
//   story   — сторис с отметкой. Автоматически не проверить НИКАК, поэтому
//            уходит Анжелике на подтверждение. Это не недоделка, это
//            единственный честный вариант: иначе скидку получает тот, кто
//            нажал кнопку и ничего не выложил.
//
// ⚠️ Прототип: проверка invite и подтверждение story живут в localStorage.
// На бою это сервер (реферал через start_param) и кабинет мастера.

import { useEffect, useState } from 'react';

/* Два условия, и оба подтверждаются человеком или сервером:
   отзыв и отметка в сторис. Приглашение подруги скидки БОЛЬШЕ НЕ ДАЁТ —
   оно живёт в реферальной программе со своей механикой. */
export type QuestId = 'review' | 'story';

/** idle — не начато · pending — ждёт подтверждения · done — скидка активна */
export type QuestState = 'idle' | 'pending' | 'done';

export interface QuestRecord {
  state: QuestState;
  /** Когда отправлено на проверку — мастер видит, сколько человек ждёт */
  sentAt?: number;
  doneAt?: number;
  /** Что именно прислали на проверку: ник, ссылка на сторис */
  proof?: string;
}

export type Quests = Record<QuestId, QuestRecord>;

const KEY = 'anzh_quests_v1';
const listeners = new Set<(q: Quests) => void>();

const EMPTY: Quests = {
  review: { state: 'idle' },
  story: { state: 'idle' },
};

function load(): Quests {
  if (typeof window === 'undefined') return EMPTY;
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...EMPTY, ...(JSON.parse(raw) as Quests) } : EMPTY;
  } catch {
    return EMPTY;
  }
}

let quests: Quests = load();

function persist() {
  try { localStorage.setItem(KEY, JSON.stringify(quests)); } catch { /* ignore */ }
  listeners.forEach((l) => l(quests));
}

export function useQuests(): Quests {
  const [s, setS] = useState(quests);
  useEffect(() => {
    listeners.add(setS);
    return () => { listeners.delete(setS); };
  }, []);
  return s;
}

/** Задание отправлено на проверку — скидки пока нет */
export function sendForReview(id: QuestId, proof?: string) {
  if (quests[id].state === 'done') return;
  quests = { ...quests, [id]: { state: 'pending', sentAt: Date.now(), proof } };
  persist();
}

/** Засчитано: приложением (отзыв) или Анжеликой (сторис) */
export function completeQuest(id: QuestId) {
  if (quests[id].state === 'done') return;
  quests = { ...quests, [id]: { ...quests[id], state: 'done', doneAt: Date.now() } };
  persist();
}

/** Мастер не подтвердил — задание возвращается в исходное */
export function rejectQuest(id: QuestId) {
  quests = { ...quests, [id]: { state: 'idle' } };
  persist();
}

export const TASK_COUNT = 2;

/* Скидка НАКАПЛИВАЕТСЯ: 5% за отзыв, 5% за отметку в сторис.
   За оба условия — 10%.
   Так лучше, чем «всё или ничего»: после первого задания человек видит не
   финиш, а часть пути — и второе задание стоит ему понятных усилий за
   понятную прибавку. Одно большое «−15% за любое действие» этот стимул
   гасит: выполнил одно — дальше смысла нет.

   🚨 Потолок ВЫВОДИТСЯ из числа заданий, а не задаётся отдельно. Раньше
   он брался из IG_OFFER.percent — это другая акция, промокод в
   инстаграме. Пока совпадало 10 × 3 = 30, подмена не была видна; на 5%
   за задание бейдж начал бы обещать 30%, из которых заработать можно
   15. Обещание, которое нельзя выполнить, хуже меньшего числа. */
export const PER_TASK = 5;
export const MAX_PERCENT = TASK_COUNT * PER_TASK;

export const doneCount = (q: Quests) =>
  (Object.keys(q) as QuestId[]).filter((k) => q[k].state === 'done').length;

/** Сколько процентов уже заработано */
export const discountPercent = (q: Quests) => Math.min(MAX_PERCENT, doneCount(q) * PER_TASK);

/** Сколько ещё можно добрать */
export const remainingPercent = (q: Quests) => MAX_PERCENT - discountPercent(q);

export const discountActive = (q: Quests) => discountPercent(q) > 0;


/** Что ждёт подтверждения мастера — очередь в кабинете */
export function pendingQuests(q: Quests): Array<{ id: QuestId; sentAt: number; proof?: string }> {
  return (Object.keys(q) as QuestId[])
    .filter((k) => q[k].state === 'pending')
    .map((k) => ({ id: k, sentAt: q[k].sentAt ?? 0, proof: q[k].proof }))
    .sort((a, b) => a.sentAt - b.sentAt);
}
