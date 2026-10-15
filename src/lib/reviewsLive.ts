import { useSyncExternalStore } from 'react';
import { getReviews, type ReviewWire } from './api/reviews';

/* Опубликованные отзывы — с сервера; пока не пришли — пусто (блок покажет
   приглашение оставить первый отзыв, а не выдуманные карточки). */
export interface ReviewsState { list: ReviewWire[]; avg: number | null; count: number; loaded: boolean }
let state: ReviewsState = { list: [], avg: null, count: 0, loaded: false };
const listeners = new Set<() => void>();
let inflight: Promise<void> | null = null;

export function loadReviews(force = false): Promise<void> {
  if (inflight && !force) return inflight;
  inflight = getReviews().then((r) => {
    state = { list: r.reviews, avg: r.avg, count: r.count, loaded: true };
    listeners.forEach((l) => l());
  }, () => {
    state = { ...state, loaded: true };
    listeners.forEach((l) => l());
  }).finally(() => { inflight = null; });
  return inflight;
}

export function useReviewsLive(): ReviewsState {
  return useSyncExternalStore(
    (l) => { listeners.add(l); if (!state.loaded) void loadReviews(); return () => { listeners.delete(l); }; },
    () => state, () => state,
  );
}
