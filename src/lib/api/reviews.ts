// Провод «отзывы» — хранятся только в приложении, на сервере.
// 🔴 [ПРЕДЛОЖЕНИЕ БЭКЕНДУ]
//   GET   /reviews                    публичные (опубликованные), avg, count
//   POST  /reviews {rating 1–5, text ≥10, service_slug?, publish_consent:true} → {review, rewards}
//   GET   /staff/reviews              владелица: все, со статусом
//   PATCH /reviews/{id} {state?: 'published'|'hidden', reply?}
// Награда (−5% за действие «отзыв») — за сам отзыв при ЛЮБОЙ оценке: награда
// за высокие звёзды покупает оценки, это нечестно и запрещено правилами о рекламе.
import { apiRequest } from '../session';
import type { RewardsWire } from './rewards';

export interface ReviewWire {
  id: string;
  name: string;
  /** [ПРЕДЛОЖЕНИЕ] имя латиницей для английского интерфейса */
  name_en?: string | null;
  /** Демо-пример (стенд): подпись «Пример ·» */
  demo?: boolean;
  /** [ПРЕДЛОЖЕНИЕ] язык оригинала и переводы на языки приложения (переводит сервер) */
  lang?: 'ru' | 'en';
  translations?: Partial<Record<'ru' | 'en', string>>;
  reply_lang?: 'ru' | 'en' | null;
  reply_translations?: Partial<Record<'ru' | 'en', string>>;
  rating: number;
  text: string;
  service_slug?: string | null;
  created_at: string;
  reply?: string | null;
  /** У автора есть проведённый визит в студии */
  verified?: boolean;
  /** Согласие на публикацию. Без него отзыв видит только студия */
  publish_consent?: boolean;
  /** Только в кабинете */
  state?: 'new' | 'published' | 'hidden';
}

export async function getReviews(signal?: AbortSignal): Promise<{ reviews: ReviewWire[]; avg: number | null; count: number }> {
  const r = await apiRequest<{ reviews: ReviewWire[]; avg: number | null; count: number }>('GET', '/reviews', { auth: 'none', signal });
  return { reviews: Array.isArray(r?.reviews) ? r.reviews : [], avg: r?.avg ?? null, count: r?.count ?? 0 };
}

export async function postReview(input: { rating: number; text: string; service_slug?: string | null; publish_consent: boolean }): Promise<{ review: ReviewWire; rewards?: RewardsWire }> {
  return apiRequest('POST', '/reviews', { body: input });
}

export async function getStaffReviews(): Promise<ReviewWire[]> {
  const r = await apiRequest<{ reviews: ReviewWire[] }>('GET', '/staff/reviews');
  return Array.isArray(r?.reviews) ? r.reviews : [];
}

export async function patchReview(id: string, patch: { state?: 'published' | 'hidden'; reply?: string | null }): Promise<ReviewWire> {
  const r = await apiRequest<{ review: ReviewWire }>('PATCH', `/reviews/${encodeURIComponent(id)}`, { body: patch });
  return r.review;
}

/** Текст отзыва на языке интерфейса: перевод сервера, если оригинал на другом языке.
    `translated` — показали перевод (подпись «переведено»), `original` — для «показать оригинал». */
export function reviewText(r: ReviewWire, lang: 'ru' | 'en'): { text: string; translated: boolean; original: string } {
  const src = r.lang ?? (/[А-Яа-яЁё]/.test(r.text) ? 'ru' : 'en');
  const tr = src !== lang ? r.translations?.[lang] : undefined;
  return { text: tr ?? r.text, translated: !!tr, original: r.text };
}
export function replyText(r: ReviewWire, lang: 'ru' | 'en'): string | null {
  if (!r.reply) return null;
  const src = r.reply_lang ?? (/[А-Яа-яЁё]/.test(r.reply) ? 'ru' : 'en');
  return (src !== lang ? r.reply_translations?.[lang] : undefined) ?? r.reply;
}
export function reviewName(r: ReviewWire, lang: 'ru' | 'en'): string {
  const n = lang === 'en' ? r.name_en || r.name : r.name;
  return r.demo ? `${lang === 'en' ? 'Example' : 'Пример'} · ${n}` : n;
}
