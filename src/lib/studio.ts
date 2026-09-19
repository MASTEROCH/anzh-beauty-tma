// Данные кабинета мастера: живой прайс, заметки о клиентах, закрытие смены.
// Функционально повторяет админку Anti Age, но для одного мастера: без ролей,
// без выбора врача, без склада — Анжелика прямо сказала, что это лишнее.

import { useEffect, useState } from 'react';
import { findService } from '../data/services';
import type { Appointment } from './appointments';
import { fromISODate, toISODate } from './appointments';

/* ── Живой прайс: мастер меняет цены, не трогая код ── */

const PRICE_KEY = 'anzh_prices_v1';
const priceListeners = new Set<(p: Record<string, number>) => void>();

function loadPrices(): Record<string, number> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(PRICE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, number>) : {};
  } catch {
    return {};
  }
}

let overrides: Record<string, number> = loadPrices();

export function setPrice(serviceId: string, usd: number) {
  overrides = { ...overrides, [serviceId]: usd };
  try { localStorage.setItem(PRICE_KEY, JSON.stringify(overrides)); } catch { /* ignore */ }
  priceListeners.forEach((l) => l(overrides));
}

export function resetPrice(serviceId: string) {
  const next = { ...overrides };
  delete next[serviceId];
  overrides = next;
  try { localStorage.setItem(PRICE_KEY, JSON.stringify(overrides)); } catch { /* ignore */ }
  priceListeners.forEach((l) => l(overrides));
}

export function usePrices(): Record<string, number> {
  const [s, setS] = useState(overrides);
  useEffect(() => {
    priceListeners.add(setS);
    return () => { priceListeners.delete(setS); };
  }, []);
  return s;
}

/** Цена услуги с учётом правок мастера */
export function priceOf(serviceId: string): number {
  return overrides[serviceId] ?? findService(serviceId)?.priceUsd ?? 0;
}

/* ── Приватные заметки мастера о клиенте ── */

const NOTE_KEY = 'anzh_client_notes_v1';
const noteListeners = new Set<(n: Record<string, string>) => void>();

function loadNotes(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(NOTE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, string>) : {};
  } catch {
    return {};
  }
}

let notes: Record<string, string> = loadNotes();

export function setClientNote(key: string, text: string) {
  notes = { ...notes, [key]: text };
  try { localStorage.setItem(NOTE_KEY, JSON.stringify(notes)); } catch { /* ignore */ }
  noteListeners.forEach((l) => l(notes));
}

export function useClientNotes(): Record<string, string> {
  const [s, setS] = useState(notes);
  useEffect(() => {
    noteListeners.add(setS);
    return () => { noteListeners.delete(setS); };
  }, []);
  return s;
}

/* ── Аналитика: то, что в Anti Age живёт в финансовой панели ── */

const WEEKDAY = ['воскресенье', 'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота'];

export interface NoShowInsight {
  total: number;
  lostUsd: number;
  worstWeekday?: string;
  repeatOffenders: Array<{ name: string; instagram?: string; count: number }>;
}

export function noShowInsight(list: Appointment[]): NoShowInsight {
  const noShows = list.filter((a) => a.status === 'no-show');
  const lostUsd = noShows.reduce((s, a) => s + priceOf(a.serviceId), 0);

  const byDay = new Map<number, number>();
  const byClient = new Map<string, { name: string; instagram?: string; count: number }>();

  for (const a of noShows) {
    const day = fromISODate(a.dateISO).getDay();
    byDay.set(day, (byDay.get(day) ?? 0) + 1);
    const key = a.clientInstagram || a.clientName;
    const row = byClient.get(key) ?? { name: a.clientName, instagram: a.clientInstagram, count: 0 };
    row.count += 1;
    byClient.set(key, row);
  }

  const worst = [...byDay.entries()].sort((a, b) => b[1] - a[1])[0];

  return {
    total: noShows.length,
    lostUsd,
    // Один случай — это не закономерность, а совпадение: не называем «худшим днём»
    worstWeekday: worst && worst[1] > 1 ? WEEKDAY[worst[0]] : undefined,
    repeatOffenders: [...byClient.values()].filter((c) => c.count > 1).sort((a, b) => b.count - a.count),
  };
}

/** Выручка по категориям услуг — донат в финансах Anti Age */
export interface CategorySlice {
  category: string;
  label: string;
  sum: number;
  share: number;
  color: string;
}

const CATEGORY_LABEL: Record<string, string> = {
  inj: 'Инъекции',
  clean: 'Чистки',
  peel: 'Пилинги',
  apparatus: 'Аппарат',
  care: 'Уход',
  brows: 'Брови',
  derma: 'Дерматолог',
};

const CATEGORY_COLOR: Record<string, string> = {
  inj: '#12C088',
  clean: '#35E4A6',
  peel: '#F5C842',
  apparatus: '#C9A52F',
  care: '#8FF3D4',
  brows: '#C9A52F',
  derma: '#2F767A',
};

export function revenueByCategory(list: Appointment[], sinceDays = 90): CategorySlice[] {
  const from = new Date();
  from.setDate(from.getDate() - sinceDays);
  const fromISO = toISODate(from);

  const sums = new Map<string, number>();
  for (const a of list) {
    if (a.status !== 'completed' || a.dateISO < fromISO) continue;
    const svc = findService(a.serviceId);
    if (!svc) continue;
    sums.set(svc.category, (sums.get(svc.category) ?? 0) + (a.amount ?? priceOf(a.serviceId)));
  }

  const total = [...sums.values()].reduce((s, x) => s + x, 0);
  if (total === 0) return [];

  return [...sums.entries()]
    .map(([category, sum]) => ({
      category,
      label: CATEGORY_LABEL[category] ?? category,
      sum,
      share: sum / total,
      color: CATEGORY_COLOR[category] ?? '#12C088',
    }))
    .sort((a, b) => b.sum - a.sum);
}

/** Топ услуг по деньгам — на что реально живёт кабинет */
export function topServices(list: Appointment[], limit = 5) {
  const sums = new Map<string, { count: number; sum: number }>();
  for (const a of list) {
    if (a.status !== 'completed') continue;
    const row = sums.get(a.serviceId) ?? { count: 0, sum: 0 };
    row.count += 1;
    row.sum += a.amount ?? priceOf(a.serviceId);
    sums.set(a.serviceId, row);
  }
  return [...sums.entries()]
    .map(([id, v]) => ({ service: findService(id), ...v }))
    .filter((x) => x.service)
    .sort((a, b) => b.sum - a.sum)
    .slice(0, limit);
}

/* ── Закрытие смены ── */

export interface ShiftSummary {
  dateISO: string;
  done: number;
  noShow: number;
  pending: number;
  earned: number;
  nextDay: Appointment[];
}

export function shiftSummary(list: Appointment[], tomorrow: Appointment[]): ShiftSummary {
  const today = toISODate(new Date());
  const ofDay = list.filter((a) => a.dateISO === today);
  return {
    dateISO: today,
    done: ofDay.filter((a) => a.status === 'completed').length,
    noShow: ofDay.filter((a) => a.status === 'no-show').length,
    pending: ofDay.filter((a) => a.status === 'pending' || a.status === 'confirmed').length,
    earned: ofDay.filter((a) => a.status === 'completed').reduce((s, a) => s + (a.amount ?? 0), 0),
    nextDay: tomorrow,
  };
}

