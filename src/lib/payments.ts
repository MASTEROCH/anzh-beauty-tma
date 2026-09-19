// Оплата звёздами Telegram (XTR).
//
// Два правила платформы, из которых вырастает вся архитектура экрана:
//  1. Stars — ТОЛЬКО за цифровое. Физическую косметику ими оплачивать нельзя,
//     поэтому уход остаётся партнёрской витриной по промокоду, а за звёзды
//     продаются разборы, протоколы и сертификаты.
//  2. Ссылку на инвойс создаёт СЕРВЕР через Bot API `createInvoiceLink`
//     (нужен токен бота — на клиенте его быть не должно). Клиент только
//     открывает её через `WebApp.openInvoice` и слушает статус.
//
// Здесь — клиентская половина и честный шов для сервера: в Telegram идёт
// настоящий openInvoice, в обычном браузере — симуляция, чтобы прототип
// проходился целиком.

import { useEffect, useState } from 'react';
import { isTelegram } from './telegram';

export type InvoiceStatus = 'paid' | 'cancelled' | 'failed' | 'pending';

/* Курс звезды к доллару. Берём розничную цену Telegram: малый пакет 100★
   стоит $1.99, то есть ≈ $0.02 за звезду — это то, что реально платит
   клиентка, а не выплата разработчику ($0.013). Цифру держим здесь одну:
   она поменяется, и менять её надо в одном месте. */
export const STAR_USD = 0.02;

/* Подпись в долларах — маркетинговая: округляем до целого и снимаем цент.
   670★ → $13.40 → «$12.99». Цену в звёздах это НЕ трогает: платит клиентка
   звёздами, доллары стоят рядом только чтобы величина читалась. */
export function starsToUsd(stars: number): string {
  const whole = Math.max(1, Math.round(stars * STAR_USD));
  return (whole - 0.01).toFixed(2);
}

interface TgWebAppPayments {
  openInvoice?: (url: string, cb: (status: InvoiceStatus) => void) => void;
  showAlert?: (msg: string) => void;
}

function webApp(): TgWebAppPayments | undefined {
  if (typeof window === 'undefined') return undefined;
  return (window as unknown as { Telegram?: { WebApp?: TgWebAppPayments } }).Telegram?.WebApp;
}

/* НЕ по наличию метода: скрипт telegram-web-app.js подключён в index.html
   всегда и создаёт `Telegram.WebApp` даже в обычном браузере — вместе с
   `openInvoice`, который там ничего не откроет. Признак настоящего
   Telegram — присутствие initData, его подделать нечем. */
export const canPayWithStars = () => isTelegram() && typeof webApp()?.openInvoice === 'function';

/** Сервер: POST /api/invoice { productId } → { link } (createInvoiceLink, currency XTR) */
async function fetchInvoiceLink(productId: string): Promise<string | null> {
  try {
    const res = await fetch('/api/invoice', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productId }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { link?: string };
    return data.link ?? null;
  } catch {
    return null;
  }
}

export async function payWithStars(productId: string): Promise<InvoiceStatus> {
  const tg = webApp();

  // Сервер спрашиваем ТОЛЬКО когда есть кому открыть счёт. Раньше запрос
  // уходил всегда, и в браузере каждая «покупка» оставляла в консоли красный
  // 404 от несуществующего /api/invoice — свой же шум, в котором тонет чужая
  // настоящая ошибка.
  if (canPayWithStars() && tg?.openInvoice) {
    const link = await fetchInvoiceLink(productId);
    if (link) return new Promise<InvoiceStatus>((resolve) => tg.openInvoice!(link, resolve));
    return 'failed';
  }

  // Прототип вне Telegram — проходим путь целиком, без обращения к серверу
  await new Promise((r) => setTimeout(r, 900));
  return 'paid';
}

/* ── Купленное живёт в кабинете ── */

export interface Purchase {
  id: string;
  productId: string;
  title: string;
  stars: number;
  boughtAt: number;
}

const KEY = 'anzh_purchases_v1';
const listeners = new Set<(p: Purchase[]) => void>();

function load(): Purchase[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Purchase[]) : [];
  } catch {
    return [];
  }
}

let items: Purchase[] = load();

export function addPurchase(p: Omit<Purchase, 'id' | 'boughtAt'>): Purchase {
  const purchase: Purchase = { id: `p${Date.now()}`, boughtAt: Date.now(), ...p };
  items = [purchase, ...items];
  try { localStorage.setItem(KEY, JSON.stringify(items)); } catch { /* ignore */ }
  listeners.forEach((l) => l(items));
  return purchase;
}

export function usePurchases(): Purchase[] {
  const [s, setS] = useState<Purchase[]>(items);
  useEffect(() => {
    listeners.add(setS);
    return () => { listeners.delete(setS); };
  }, []);
  return s;
}

export const owns = (list: Purchase[], productId: string) =>
  list.some((p) => p.productId === productId);
