// Тиры Anjelika Club считаются от баллов, а не зашиты строкой «Silver».
// Пока тир был текстом, баллы можно было копить бесконечно — прогресс-бар
// и привилегии не менялись, и программа читалась как декорация.

export interface Tier {
  key: 'bronze' | 'silver' | 'gold' | 'diamond';
  label: string;
  min: number;
  cashback: number;
  perk: { ru: string; en: string };
}

export const TIERS: Tier[] = [
  { key: 'bronze',  label: 'Bronze',  min: 0,    cashback: 5,  perk: { ru: '5% кэшбэк баллами',                 en: '5% cashback in points' } },
  { key: 'silver',  label: 'Silver',  min: 300,  cashback: 7,  perk: { ru: '7% кэшбэк + приоритетная запись',    en: '7% cashback + priority booking' } },
  { key: 'gold',    label: 'Gold',    min: 600,  cashback: 10, perk: { ru: '10% кэшбэк + закрытые акции',        en: '10% cashback + private offers' } },
  { key: 'diamond', label: 'Diamond', min: 1200, cashback: 15, perk: { ru: '15% кэшбэк + персональный протокол', en: '15% cashback + personal protocol' } },
];

export function tierOf(points: number): Tier {
  return [...TIERS].reverse().find((t) => points >= t.min) ?? TIERS[0];
}

export function nextTier(points: number): Tier | null {
  return TIERS.find((t) => t.min > points) ?? null;
}

/** 0–100 — заполненность прогресс-бара до следующего тира */
export function tierProgress(points: number): number {
  const cur = tierOf(points);
  const next = nextTier(points);
  if (!next) return 100;
  return Math.max(0, Math.min(100, Math.round(((points - cur.min) / (next.min - cur.min)) * 100)));
}

export function pointsToNext(points: number): number {
  const next = nextTier(points);
  return next ? Math.max(0, next.min - points) : 0;
}

/** Баллы за визит — тот же процент, что обещан тиром */
export function pointsForVisit(amountUsd: number, points: number): number {
  return Math.round(amountUsd * (tierOf(points).cashback / 100));
}
