import { useEffect, useState } from 'react';
import { formatAmount } from './money';

/*
   АКЦИИ.

   Салон живёт не только записями: свободное окно во вторник, сезонный
   спад, новая процедура, которую никто не пробовал, — всё это лечится
   предложением. До этого такое предложение жило в голове у Анжелики и
   в сторис, то есть нигде: через неделю никто не помнил, что обещали и
   кому.

   Акция здесь — не текст, а правило со сроком: что даём, на что, до
   какого числа. Поэтому её можно запустить, остановить и увидеть
   задним числом, что именно было обещано.

   ⚠️ Прототип: живёт в localStorage. На сервере это таблица со сроками
   и связью с процедурами — см. контракт бэкенда, шаг 2.
*/

export type PromoKind =
  /** Процент со всей процедуры */
  | 'percent'
  /** Fixed amount in the promo's `currency` (lari from the form, K10) */
  | 'amount'
  /** Подарок к визиту */
  | 'gift';

export interface Promo {
  id: string;
  title: string;
  kind: PromoKind;
  /** Для percent — проценты, для amount — сумма в валюте `currency`, для gift — не нужен */
  value: number;
  /**
   * ISO code of an `amount` discount (the form writes GEL — the main price is in lari).
   * A promo kept on a device from before K10 has none: its sum is shown without a sign,
   * never under a silent "$".
   */
  currency?: string | null;
  /** На какие процедуры. Пусто — на все */
  serviceIds: string[];
  /** Даты действия, ISO. Пусто — бессрочно */
  fromISO?: string;
  toISO?: string;
  /** Запущена ли прямо сейчас */
  live: boolean;
  createdAt: number;
}

const KEY = 'anzh_promos_v1';
const listeners = new Set<(items: Promo[]) => void>();

function load(): Promo[] {
  if (typeof window === 'undefined') return seed();
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) {
      const s = seed();
      localStorage.setItem(KEY, JSON.stringify(s));
      return s;
    }
    return withoutDemo(JSON.parse(raw) as Promo[]);
  } catch {
    return seed();
  }
}

/* No demo promos (owner's "1-a", 06.10.2026: demo goes to the archive). The list
   used to be seeded with two invented promos on the archived demo procedures
   ("LED therapy", "PDRN", "lip filler"); the studio screen has its own empty state. */
function seed(): Promo[] {
  return [];
}

/* The two demo promos a device may still keep from the old seed — recognised by
   their id AND title together, so a promo the studio created itself is never dropped. */
const DEMO_SEED: ReadonlyArray<readonly [string, string]> = [
  ['p1', 'Вторник без очереди'],
  ['p2', 'LED-уход в подарок к инъекциям'],
];
function withoutDemo(list: Promo[]): Promo[] {
  return list.filter((p) => !DEMO_SEED.some(([id, title]) => p.id === id && p.title === title));
}

let items: Promo[] = load();

function persist() {
  try { localStorage.setItem(KEY, JSON.stringify(items)); } catch { /* ignore */ }
  listeners.forEach((l) => l(items));
}

export function usePromos(): Promo[] {
  const [s, setS] = useState(items);
  useEffect(() => {
    listeners.add(setS);
    return () => { listeners.delete(setS); };
  }, []);
  return s;
}

export function addPromo(input: Omit<Promo, 'id' | 'createdAt' | 'live'>): Promo {
  const promo: Promo = { ...input, id: `p${Date.now()}`, live: false, createdAt: Date.now() };
  items = [promo, ...items];
  persist();
  return promo;
}

export function updatePromo(id: string, patch: Partial<Omit<Promo, 'id'>>) {
  items = items.map((p) => (p.id === id ? { ...p, ...patch } : p));
  persist();
}

export function removePromo(id: string) {
  items = items.filter((p) => p.id !== id);
  persist();
}

/** Запустить или остановить. Отдельно от правки: это решение, а не текст */
export function setLive(id: string, live: boolean) {
  updatePromo(id, { live });
}

/**
 * Идёт ли акция прямо сейчас.
 *
 * Запущенная, но с истёкшим сроком — НЕ идёт. Иначе «акция до 20-го»
 * продолжала бы висеть в интерфейсе двадцать первого, и объяснять это
 * пришлось бы клиентке у стойки.
 */
export function isRunning(p: Promo, today = new Date().toISOString().slice(0, 10)): boolean {
  if (!p.live) return false;
  if (p.fromISO && today < p.fromISO) return false;
  if (p.toISO && today > p.toISO) return false;
  return true;
}

/** Человеческая формулировка выгоды — одна на весь проект */
export function promoBenefit(p: Promo): string {
  if (p.kind === 'percent') return `−${p.value}%`;
  if (p.kind === 'amount') return `−${formatAmount(Math.round(p.value * 100), p.currency) ?? p.value}`;
  return 'подарок';
}
