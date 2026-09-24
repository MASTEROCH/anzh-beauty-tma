import { useEffect, useState } from 'react';

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
  /** Фиксированная сумма в долларах */
  | 'amount'
  /** Подарок к визиту: LED-уход, домашний набор */
  | 'gift';

export interface Promo {
  id: string;
  title: string;
  kind: PromoKind;
  /** Для percent — проценты, для amount — доллары, для gift — не нужен */
  value: number;
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
    return JSON.parse(raw) as Promo[];
  } catch {
    return seed();
  }
}

/* Две акции в базе: одна идёт, одна остановлена. Пустой список не
   показывает ни как выглядит запущенная акция, ни чем она отличается от
   черновика, — а это и есть главное, что тут нужно понять с первого
   взгляда. */
function seed(): Promo[] {
  const today = new Date();
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const plus = (n: number) => { const d = new Date(today); d.setDate(d.getDate() + n); return iso(d); };
  return [
    {
      id: 'p1',
      title: 'Вторник без очереди',
      kind: 'percent',
      value: 15,
      serviceIds: ['deep-cleansing', 'led-therapy'],
      fromISO: plus(-3),
      toISO: plus(25),
      live: true,
      createdAt: Date.now() - 3000,
    },
    {
      id: 'p2',
      title: 'LED-уход в подарок к инъекциям',
      kind: 'gift',
      value: 0,
      serviceIds: ['lip-filler', 'biorevit', 'pdrn'],
      live: false,
      createdAt: Date.now() - 2000,
    },
  ];
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
  if (p.kind === 'amount') return `−$${p.value}`;
  return 'подарок';
}
