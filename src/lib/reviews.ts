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

   Сервер: таблица `anzh.reviews`, ручки /reviews и /staff/reviews
   (server/openapi.yaml) — второй ряд.
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

/* ВТОРОЙ РЯД (решение на ночь): отзывы на сервер этой ночью не идут.
   Здесь жила демо-база из шести отзывов с выдуманными клиентками, и она
   писалась в localStorage (`anzh_reviews_v1`) — кабинет показывал их как
   настоящие. Демо и хранилище убраны: список — память запуска, пустой, пока
   отзывы не придут с сервера (GET /staff/reviews). */
const listeners = new Set<(items: Review[]) => void>();

let items: Review[] = [];

function persist() {
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
