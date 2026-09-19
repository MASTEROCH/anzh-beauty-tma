// Бонусы клиента. Анжелика: «спустя месяц после процедуры прислать
// уведомление — сделать отзыв с фотографией, чтобы получить бонус на
// следующую, и оно в личном кабинете человека сохранить этот бонус».
// До этого скидка жила одним тостом с промокодом: закрыл — и нет её.

import { useEffect, useState } from 'react';

export type BonusSource = 'review' | 'review_photo' | 'stories' | 'referral' | 'welcome';

export interface Bonus {
  id: string;
  source: BonusSource;
  /** Скидка в процентах на одну процедуру */
  percent: number;
  code: string;
  title: string;
  note: string;
  createdAt: number;
  expiresAt: number;
  usedAt?: number;
  /** К какой заявке привязан — чтобы вернуть, если её отклонили */
  usedFor?: string;
}

const KEY = 'anzh_bonuses_v1';
const listeners = new Set<(b: Bonus[]) => void>();
const DAY = 864e5;

export const SOURCE_LABEL: Record<BonusSource, { ru: string; en: string }> = {
  review:       { ru: 'За отзыв',            en: 'For a review' },
  review_photo: { ru: 'За отзыв с фото',     en: 'For a photo review' },
  stories:      { ru: 'За сторис с отметкой', en: 'For a tagged Story' },
  referral:     { ru: 'За подругу',          en: 'For a referral' },
  welcome:      { ru: 'Приветственный',      en: 'Welcome bonus' },
};

function load(): Bonus[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Bonus[]) : [];
  } catch {
    return [];
  }
}

let items: Bonus[] = load();

function persist() {
  try { localStorage.setItem(KEY, JSON.stringify(items)); } catch { /* ignore */ }
  listeners.forEach((l) => l(items));
}

export function addBonus(input: {
  source: BonusSource; percent: number; title: string; note: string; validDays?: number;
}): Bonus {
  const bonus: Bonus = {
    id: `b${Date.now()}`,
    code: `ANZH${input.percent}`,
    createdAt: Date.now(),
    expiresAt: Date.now() + (input.validDays ?? 90) * DAY,
    ...input,
  };
  items = [bonus, ...items];
  persist();
  return bonus;
}

/** Погасить бонус, привязав к заявке. Не хук — имя нарочно не с `use`,
    иначе правила хуков React потребуют вызова на верхнем уровне компонента. */
export function redeemBonus(id: string, appointmentId: string) {
  items = items.map((b) => (b.id === id ? { ...b, usedAt: Date.now(), usedFor: appointmentId } : b));
  persist();
}

/** Заявку отклонили или отменили — бонус возвращается человеку.
    Без этого скидка сгорала за запись, которой не случилось. */
export function releaseBonus(appointmentId: string) {
  let touched = false;
  items = items.map((b) => {
    if (b.usedFor !== appointmentId) return b;
    touched = true;
    const { usedAt, usedFor, ...rest } = b;
    void usedAt; void usedFor;
    return rest as Bonus;
  });
  if (touched) persist();
}

export function useBonuses(): Bonus[] {
  const [s, setS] = useState<Bonus[]>(items);
  useEffect(() => {
    listeners.add(setS);
    return () => { listeners.delete(setS); };
  }, []);
  return s;
}

export const isActive = (b: Bonus) => !b.usedAt && b.expiresAt > Date.now();

export function getActiveBonuses(list: Bonus[] = items) {
  return list.filter(isActive).sort((a, b) => b.percent - a.percent);
}

/** Лучший бонус, который применится к записи */
export function bestBonus(list: Bonus[] = items): Bonus | undefined {
  return getActiveBonuses(list)[0];
}

export function daysLeft(b: Bonus) {
  return Math.max(0, Math.ceil((b.expiresAt - Date.now()) / DAY));
}
