import type { Appointment } from './appointments';

/* ВЕСТИ ЗА РУКУ (Роч 15.10: «не красивая витрина, а буквально ведёт
   пользователя»). Один следующий шаг, выбранный по тому, где человек
   сейчас, — из уже загруженных данных, без новых ручек.

   Путь клиентки — пять шагов:
     1 кожа (Skin Profile) → 2 процедура → 3 заявка → 4 визит → 5 уход и отзыв.
   Приоритет сверху вниз: то, что ближе по времени и важнее для визита,
   выигрывает. Подтверждённый визит важнее отзыва о прошлом, заявка важнее
   закладок. */

export type JourneyKind =
  | 'guest' | 'visit' | 'pending' | 'review' | 'profile' | 'bookmark' | 'choose' | 'course';

export interface JourneyStep {
  kind: JourneyKind;
  /** 1…5 — где человек на пути; 0 — путь не показываем */
  stage: number;
  appt?: Appointment;
  slug?: string;
}

export function nextStep(s: {
  guest: boolean;
  upcoming: Appointment[];
  historyCount: number;
  lastDone?: Appointment;
  profileDone: boolean;
  reviewDone: boolean;
  favorites: string[];
}): JourneyStep {
  if (s.guest) return { kind: 'guest', stage: 0 };
  const confirmed = s.upcoming.find((a) => a.status === 'confirmed');
  if (confirmed) return { kind: 'visit', stage: 4, appt: confirmed };
  const pending = s.upcoming.find((a) => a.status === 'pending');
  if (pending) return { kind: 'pending', stage: 3, appt: pending };
  if (s.historyCount > 0 && !s.reviewDone) return { kind: 'review', stage: 5, appt: s.lastDone };
  if (!s.profileDone) return { kind: 'profile', stage: 1 };
  if (s.favorites.length > 0) return { kind: 'bookmark', stage: 2, slug: s.favorites[0] };
  if (s.historyCount > 0) return { kind: 'course', stage: 5 };
  return { kind: 'choose', stage: 2 };
}
