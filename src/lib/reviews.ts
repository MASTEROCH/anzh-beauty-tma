import { useEffect, useState } from 'react';
import type { Appointment } from './appointments';
import { clientKeyOf } from './clientCard';

/*
   ОТЗЫВЫ В КАБИНЕТЕ.

   На витрине отзывы были статическим списком в данных — показать и всё.
   Но отзыв это входящее: его надо прочитать, решить, публиковать ли, и
   ответить, если человек недоволен. Без этого механика «−5% за отзыв»
   не работает: никто не подтверждает, что отзыв вообще был.

   Фильтр здесь не украшение. Отзывов со временем становятся сотни, а
   нужны из них ровно два вида: новые, которые ещё никто не смотрел, и
   низкие оценки, на которые надо ответить сегодня. Всё остальное —
   архив.

   ⚠️ Прототип: localStorage. На сервере это таблица `anzh.reviews`,
   она уже описана в миграции 006.
*/

export type ReviewState = 'new' | 'published' | 'hidden';

export interface Review {
  id: string;
  clientKey: string;
  clientName: string;
  clientInstagram?: string;
  serviceId: string;
  stars: number;
  text: string;
  /** Ответ мастера — виден клиентке */
  reply?: string;
  state: ReviewState;
  createdAt: number;
}

const KEY = 'anzh_reviews_v1';
const listeners = new Set<(items: Review[]) => void>();

function seed(): Review[] {
  const day = 86400_000;
  const now = Date.now();
  return [
    { id: 'r1', clientKey: 'mashab', clientName: 'Маша', clientInstagram: 'mashab', serviceId: 'lip-filler', stars: 5, text: 'Идеальное чувство меры — губы выглядят моими, только лучше. Анжелика объясняет каждый шаг, без давления.', state: 'published', createdAt: now - day * 12 },
    { id: 'r2', clientKey: 'tata.tt', clientName: 'Тата', clientInstagram: 'tata.tt', serviceId: 'brow-lamination', stars: 5, text: 'Делала брови, результат держится месяц. Сервис на уровне хорошей клиники.', state: 'published', createdAt: now - day * 20 },
    { id: 'r3', clientKey: 'kate_bt', clientName: 'Катя', clientInstagram: 'kate_bt', serviceId: 'carbon-peel', stars: 4, text: 'Кожа стала ровнее, но покраснение держалось дольше, чем я ждала. Предупредили бы заранее — было бы спокойнее.', state: 'new', createdAt: now - day * 2 },
    { id: 'r4', clientKey: 'lena.gr', clientName: 'Лена', clientInstagram: 'lena.gr', serviceId: 'rf-lifting', stars: 3, text: 'Ждала больше эффекта за эти деньги. Может, нужен курс, но мне об этом сказали уже после.', state: 'new', createdAt: now - day },
    { id: 'r5', clientKey: 'olya.batumi', clientName: 'Оля', clientInstagram: 'olya.batumi', serviceId: 'pdrn', stars: 5, text: 'Второй курс подряд. Вижу разницу на фото за полгода — ради этого и хожу.', state: 'published', createdAt: now - day * 33 },
    { id: 'r6', clientKey: 'sofi.wave', clientName: 'Софи', clientInstagram: 'sofi.wave', serviceId: 'brow-lamination', stars: 5, text: 'Наконец-то мастер, который не делает «как у всех».', state: 'new', createdAt: now - day * 4 },
  ];
}

function load(): Review[] {
  if (typeof window === 'undefined') return seed();
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) { const s = seed(); localStorage.setItem(KEY, JSON.stringify(s)); return s; }
    return JSON.parse(raw) as Review[];
  } catch { return seed(); }
}

let items: Review[] = load();

function persist() {
  try { localStorage.setItem(KEY, JSON.stringify(items)); } catch { /* ignore */ }
  listeners.forEach((l) => l(items));
}

export function useReviews(): Review[] {
  const [s, setS] = useState(items);
  useEffect(() => {
    listeners.add(setS);
    return () => { listeners.delete(setS); };
  }, []);
  return s;
}

export function setReviewState(id: string, state: ReviewState) {
  items = items.map((r) => (r.id === id ? { ...r, state } : r));
  persist();
}

export function replyToReview(id: string, reply: string) {
  items = items.map((r) => (r.id === id ? { ...r, reply: reply.trim() || undefined } : r));
  persist();
}

export function addReview(input: Omit<Review, 'id' | 'state' | 'createdAt'>): Review {
  const r: Review = { ...input, id: `r${Date.now()}`, state: 'new', createdAt: Date.now() };
  items = [r, ...items];
  persist();
  return r;
}

export type ReviewFilter = 'new' | 'low' | 'published' | 'hidden' | 'all';

export const REVIEW_FILTERS: Array<{ id: ReviewFilter; label: string }> = [
  { id: 'new', label: 'Новые' },
  { id: 'low', label: 'Низкие' },
  { id: 'published', label: 'На витрине' },
  { id: 'hidden', label: 'Скрытые' },
  { id: 'all', label: 'Все' },
];

/**
 * Отбор по фильтру.
 *
 * «Низкие» — три звезды и меньше, независимо от состояния: отзыв на
 * тройку, уже опубликованный, всё равно требует ответа. Поэтому это
 * не состояние, а отдельный срез.
 */
export function filterReviews(list: Review[], f: ReviewFilter): Review[] {
  const sorted = [...list].sort((a, b) => b.createdAt - a.createdAt);
  if (f === 'all') return sorted;
  if (f === 'low') return sorted.filter((r) => r.stars <= 3);
  return sorted.filter((r) => r.state === f);
}

/** Сколько в каждом срезе — для счётчиков на фильтрах */
export function reviewCounts(list: Review[]): Record<ReviewFilter, number> {
  return {
    new: list.filter((r) => r.state === 'new').length,
    low: list.filter((r) => r.stars <= 3).length,
    published: list.filter((r) => r.state === 'published').length,
    hidden: list.filter((r) => r.state === 'hidden').length,
    all: list.length,
  };
}

/** Отзывы одной клиентки — для её карточки */
export function reviewsOf(list: Review[], appt: Appointment): Review[] {
  const key = clientKeyOf(appt);
  return list.filter((r) => r.clientKey === key);
}
