// Выручка в разрезах: период, сезон, процедура, мастер.
//
// Сезон здесь — не украшение. У косметолога год не ровный: лазер и пилинги
// уходят на осень-зиму, потому что летом солнце, а инъекции и уход держатся
// круглый год. Пока выручка смотрится только «за 30 дней», этого не видно:
// проседание в июле выглядит провалом, хотя это норма отрасли. Сравнение
// «лето к лету» отвечает на вопрос «стало лучше или хуже», а «месяц к
// месяцу» на него не отвечает никогда.

import { findService } from '../data/services';
import type { Appointment } from './appointments';
import { fromISODate, toISODate } from './appointments';
import { priceOf } from './studio';
import { getTeam, staffForService } from './staff';

export type PeriodId = '7d' | '30d' | '90d' | 'year' | 'all';
export type SeasonId = 'all' | 'winter' | 'spring' | 'summer' | 'autumn';

export const PERIODS: Array<{ id: PeriodId; label: string; days: number | null }> = [
  { id: '7d', label: '7 дней', days: 7 },
  { id: '30d', label: '30 дней', days: 30 },
  { id: '90d', label: '90 дней', days: 90 },
  { id: 'year', label: 'Год', days: 365 },
  { id: 'all', label: 'Всё время', days: null },
];

export const SEASONS: Array<{ id: SeasonId; label: string; months: number[] }> = [
  { id: 'all', label: 'Весь год', months: [] },
  { id: 'winter', label: 'Зима', months: [11, 0, 1] },
  { id: 'spring', label: 'Весна', months: [2, 3, 4] },
  { id: 'summer', label: 'Лето', months: [5, 6, 7] },
  { id: 'autumn', label: 'Осень', months: [8, 9, 10] },
];

export interface Filter {
  period: PeriodId;
  season: SeasonId;
}

/** Завершённые визиты, попавшие в выбранный период и сезон */
export function inScope(list: Appointment[], f: Filter): Appointment[] {
  const p = PERIODS.find((x) => x.id === f.period)!;
  const season = SEASONS.find((x) => x.id === f.season)!;

  let fromISO = '';
  if (p.days != null) {
    const from = new Date();
    from.setDate(from.getDate() - p.days);
    fromISO = toISODate(from);
  }

  return list.filter((a) => {
    if (a.status !== 'completed') return false;
    if (fromISO && a.dateISO < fromISO) return false;
    if (season.months.length === 0) return true;
    return season.months.includes(fromISODate(a.dateISO).getMonth());
  });
}

const sum = (list: Appointment[]) =>
  list.reduce((s, a) => s + (a.amount ?? priceOf(a.serviceId)), 0);

export interface Totals {
  revenue: number;
  visits: number;
  average: number;
  /** Сколько человек принесли эту выручку — повторные считаются один раз */
  clients: number;
}

export function totals(list: Appointment[]): Totals {
  const revenue = sum(list);
  const people = new Set(list.map((a) => a.clientInstagram || a.clientName));
  return {
    revenue,
    visits: list.length,
    // Средний чек по визитам, а не по клиентам: мастер планирует день
    // визитами, и «сколько приносит один приём» — это его вопрос
    average: list.length ? Math.round(revenue / list.length) : 0,
    clients: people.size,
  };
}

export interface Row {
  id: string;
  label: string;
  revenue: number;
  visits: number;
  share: number;
}

export function byService(list: Appointment[]): Row[] {
  const map = new Map<string, { revenue: number; visits: number }>();
  for (const a of list) {
    const row = map.get(a.serviceId) ?? { revenue: 0, visits: 0 };
    row.revenue += a.amount ?? priceOf(a.serviceId);
    row.visits += 1;
    map.set(a.serviceId, row);
  }
  const total = [...map.values()].reduce((s, r) => s + r.revenue, 0) || 1;
  return [...map.entries()]
    .map(([id, r]) => ({
      id,
      label: findService(id)?.title ?? id,
      revenue: r.revenue,
      visits: r.visits,
      share: r.revenue / total,
    }))
    .sort((a, b) => b.revenue - a.revenue);
}

/** Выручка по мастерам. Владелице приписываем то, что не делает никто другой */
export function byStaff(list: Appointment[]): Row[] {
  const map = new Map<string, { revenue: number; visits: number }>();
  for (const a of list) {
    const performers = staffForService(a.serviceId);
    // Если процедуру закреплённо ведёт один мастер — она его; иначе это
    // работа владелицы. Делить пополам нельзя: получатся деньги, которых
    // никто не зарабатывал.
    const owner = getTeam().find((s) => s.role === 'owner');
    const only = performers.filter((s) => s.role === 'master');
    const id = only.length === 1 ? only[0].id : owner?.id ?? 'owner';
    const row = map.get(id) ?? { revenue: 0, visits: 0 };
    row.revenue += a.amount ?? priceOf(a.serviceId);
    row.visits += 1;
    map.set(id, row);
  }
  const total = [...map.values()].reduce((s, r) => s + r.revenue, 0) || 1;
  return [...map.entries()]
    .map(([id, r]) => ({
      id,
      label: getTeam().find((s) => s.id === id)?.name ?? id,
      revenue: r.revenue,
      visits: r.visits,
      share: r.revenue / total,
    }))
    .sort((a, b) => b.revenue - a.revenue);
}

/** Тот же период годом раньше — чтобы «лето к лету», а не «лето к зиме» */
export function previousYear(list: Appointment[], f: Filter): Appointment[] {
  const p = PERIODS.find((x) => x.id === f.period)!;
  if (p.days == null) return [];
  const to = new Date();
  to.setFullYear(to.getFullYear() - 1);
  const from = new Date(to);
  from.setDate(from.getDate() - p.days);
  const fromISO = toISODate(from);
  const toISO = toISODate(to);
  const season = SEASONS.find((x) => x.id === f.season)!;

  return list.filter((a) => {
    if (a.status !== 'completed') return false;
    if (a.dateISO < fromISO || a.dateISO > toISO) return false;
    if (season.months.length === 0) return true;
    return season.months.includes(fromISODate(a.dateISO).getMonth());
  });
}

export const revenueOf = sum;
