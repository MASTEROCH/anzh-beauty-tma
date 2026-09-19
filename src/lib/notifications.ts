// Напоминания — то, что Анжелика перечислила голосом: клиенту за сутки и утром
// в день процедуры, ей самой — за полчаса до следующего человека, запрос отзыва
// через две недели, бонус за отзыв с фото через месяц и напоминание о повторной
// процедуре спустя 1–3 месяца. Настройки раньше сбрасывались при перезагрузке.

import { useEffect, useState } from 'react';
import type { IconName } from '../components/Icon';

export type NotifKey =
  | 'day_before'      // клиенту за 24 часа
  | 'morning_of'      // клиенту утром в день процедуры
  | 'post_care'       // уход после процедуры
  | 'review_request'  // через 2 недели — как результат
  | 'photo_bonus'     // через месяц — отзыв с фото за бонус
  | 'repeat'          // повтор процедуры через 1–3 месяца
  | 'promo';          // акции и подарки

export type NotifSettings = Record<NotifKey, boolean>;

export const NOTIF_ROWS: Array<{
  key: NotifKey;
  icon: IconName;
  label: { ru: string; en: string };
  sub: { ru: string; en: string };
}> = [
  { key: 'day_before',     icon: 'clock',        label: { ru: 'Напоминание за сутки',   en: 'Reminder 24h before' },   sub: { ru: 'И подготовка к процедуре',        en: 'With prep instructions' } },
  { key: 'morning_of',     icon: 'sun',          label: { ru: 'Утром в день визита',    en: 'Morning of the visit' },  sub: { ru: 'Во сколько и куда',               en: 'Time and address' } },
  { key: 'post_care',      icon: 'heart',        label: { ru: 'Post-care после',        en: 'Post-care follow-up' },   sub: { ru: 'Что можно и нельзя: 24ч, 3д, 7д', en: 'Do and don’t: 24h, 3d, 7d' } },
  { key: 'review_request', icon: 'message',      label: { ru: 'Спросить результат',     en: 'Result check-in' },       sub: { ru: 'Через 2 недели после процедуры',  en: 'Two weeks after' } },
  { key: 'photo_bonus',    icon: 'gift',         label: { ru: 'Бонус за отзыв с фото',  en: 'Bonus for a photo review' }, sub: { ru: 'Через месяц — бонус на следующую', en: 'A month later — bonus off next visit' } },
  { key: 'repeat',         icon: 'sparkles',     label: { ru: 'Пора повторить',         en: 'Time to repeat' },        sub: { ru: 'Когда эффект начинает уходить',   en: 'When the effect starts fading' } },
  { key: 'promo',          icon: 'shopping-bag', label: { ru: 'Акции и подарки',        en: 'Offers & gifts' },        sub: { ru: 'Редко и по делу',                 en: 'Rare and relevant' } },
];

const KEY = 'anzh_notifications_v1';
const listeners = new Set<(s: NotifSettings) => void>();

const DEFAULT: NotifSettings = {
  day_before: true,
  morning_of: true,
  post_care: true,
  review_request: true,
  photo_bonus: true,
  repeat: true,
  promo: false,
};

function load(): NotifSettings {
  if (typeof window === 'undefined') return DEFAULT;
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...DEFAULT, ...(JSON.parse(raw) as Partial<NotifSettings>) } : DEFAULT;
  } catch {
    return DEFAULT;
  }
}

let current: NotifSettings = load();

export function toggleNotification(key: NotifKey) {
  current = { ...current, [key]: !current[key] };
  try { localStorage.setItem(KEY, JSON.stringify(current)); } catch { /* ignore */ }
  listeners.forEach((l) => l(current));
}

export function useNotifications(): NotifSettings {
  const [s, setS] = useState<NotifSettings>(current);
  useEffect(() => {
    listeners.add(setS);
    return () => { listeners.delete(setS); };
  }, []);
  return s;
}

/* ── Что и когда уходит по конкретной записи ── */

export interface ScheduledNote {
  when: string;
  text: string;
  to: 'client' | 'master';
}

/** Расписание сообщений вокруг визита — показываем клиенту, чтобы не гадал */
export function timelineFor(serviceTitle: string): ScheduledNote[] {
  return [
    { when: 'За 24 часа',      to: 'client', text: `Напомню про ${serviceTitle.toLowerCase()} и пришлю подготовку` },
    { when: 'Утром в день',    to: 'client', text: 'Во сколько, куда идти и что взять' },
    { when: 'За 30 минут',     to: 'master', text: 'Анжелике: кто следующий и с чем приходит' },
    { when: 'Через 24 часа',   to: 'client', text: 'Post-care: что можно и чего пока нельзя' },
    { when: 'Через 2 недели',  to: 'client', text: 'Спрошу, как результат и как себя чувствуешь' },
    { when: 'Через месяц',     to: 'client', text: 'Отзыв с фото → бонус на следующую процедуру' },
    { when: 'Через 2–3 месяца',to: 'client', text: 'Напомню, когда пора повторить' },
  ];
}
