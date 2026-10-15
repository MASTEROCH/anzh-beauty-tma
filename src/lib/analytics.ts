// Выручка в разрезах: период, сезон, процедура, мастер, клиентка.
//
// Сезон здесь — не украшение. У косметолога год не ровный: лазер и пилинги
// уходят на осень-зиму, потому что летом солнце, а инъекции и уход держатся
// круглый год. Пока выручка смотрится только «за 30 дней», этого не видно:
// проседание в июле выглядит провалом, хотя это норма отрасли. Сравнение
// «лето к лету» отвечает на вопрос «стало лучше или хуже», а «месяц к
// месяцу» на него не отвечает никогда.
//
// Всё считается по списку, который сервер отдал СМОТРЯЩЕМУ: мастеру — только
// его записи, владелице — все. Здесь чужое не отфильтровывается, потому что
// до сюда оно не доезжает. Кто вёл визит — поле `staff_id` записи, а не
// догадка по закреплённым процедурам, как в прототипе.
//
// 🔴 «Сегодня» и границы окон — по поясу САЛОНА (ЦФ1): день визита
// (`Visit.dateISO`) уже посчитан в нём (studio.ts toVisit), и окно, отсчитанное
// от даты телефона, сравнивало бы даты двух разных поясов — мастер в поездке
// видел бы «7 дней» со сдвигом на день. Календарь — addDaysISO, без поясов.
//
// 🔴 Money sums here assume ONE currency (owner's decision 06.10, B1-B: every price
// keeps its own currency, no conversion). totals / byService / byStaff / byClient /
// revenueOf get a list already split by studio.ts byCurrency (MoneyBoard, ClientRevenue);
// staffStats splits itself.

import {
  fromISODate, revenueMinor, itemShares, salonTodayISO, sumByCurrency,
  type MoneyPart, type Visit,
} from './studio';
import { addDaysISO } from './appointments';

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

/** Состоявшиеся визиты, попавшие в выбранный период и сезон */
export function inScope(list: Visit[], f: Filter): Visit[] {
  const p = PERIODS.find((x) => x.id === f.period)!;
  const season = SEASONS.find((x) => x.id === f.season)!;

  const fromISO = p.days != null ? addDaysISO(salonTodayISO(), -p.days) : '';

  return list.filter((v) => {
    if (v.status !== 'done') return false;
    if (fromISO && v.dateISO < fromISO) return false;
    if (season.months.length === 0) return true;
    return season.months.includes(fromISODate(v.dateISO).getMonth());
  });
}

const sum = (list: Visit[]) => list.reduce((s, v) => s + revenueMinor(v), 0);

export interface Totals {
  /** Минорные единицы */
  revenue: number;
  visits: number;
  average: number;
  /** Сколько человек принесли эту выручку — повторные считаются один раз */
  clients: number;
}

export function totals(list: Visit[]): Totals {
  const revenue = sum(list);
  return {
    revenue,
    visits: list.length,
    // Средний чек по визитам, а не по клиентам: мастер планирует день
    // визитами, и «сколько приносит один приём» — это его вопрос
    average: list.length ? Math.round(revenue / list.length) : 0,
    clients: new Set(list.map((v) => v.clientId)).size,
  };
}

export interface Row {
  id: string;
  label: string;
  /** Минорные единицы */
  revenue: number;
  visits: number;
  share: number;
}

function rows(map: Map<string, { label: string; revenue: number; visits: number }>): Row[] {
  const total = [...map.values()].reduce((s, r) => s + r.revenue, 0) || 1;
  return [...map.entries()]
    .map(([id, r]) => ({ id, label: r.label, revenue: r.revenue, visits: r.visits, share: r.revenue / total }))
    .sort((a, b) => b.revenue - a.revenue);
}

export function byService(list: Visit[]): Row[] {
  const map = new Map<string, { label: string; revenue: number; visits: number }>();
  for (const v of list) {
    for (const part of itemShares(v)) {
      const key = part.slug || part.title;
      const row = map.get(key) ?? { label: part.title, revenue: 0, visits: 0 };
      row.revenue += part.minor;
      row.visits += 1;
      map.set(key, row);
    }
  }
  return rows(map);
}

/** Выручка по мастерам — по `staff_id` записи. Показывается только владелице. */
export function byStaff(list: Visit[]): Row[] {
  const map = new Map<string, { label: string; revenue: number; visits: number }>();
  for (const v of list) {
    const key = String(v.staffId);
    const row = map.get(key) ?? { label: v.staffName ?? 'Мастер', revenue: 0, visits: 0 };
    row.revenue += revenueMinor(v);
    row.visits += 1;
    map.set(key, row);
  }
  return rows(map);
}

export interface ClientRow extends Row {
  /** Средний чек, минорные */
  average: number;
  /** Когда приходила в последний раз, ISO-дата */
  lastVisit: string | null;
  /** Сколько раз не пришла — это меняет отношение к её заявкам */
  noShows: number;
}

/**
 * Выручка ПО КЛИЕНТКАМ: кто приносит деньги. Салон живёт повторными
 * визитами, и разница между «сто клиенток по разу» и «двадцать по пять»
 * видна только здесь. Ключ — telegram_id клиентки.
 *
 * Неявки считаются по ВСЕМ записям (`all`), а не по отфильтрованным:
 * человек, не пришедший в мае, остаётся риском и в июньском отчёте.
 */
export function byClient(list: Visit[], all: Visit[] = list): ClientRow[] {
  const map = new Map<number, { revenue: number; visits: number; last: string | null; name: string }>();
  for (const v of list) {
    const row = map.get(v.clientId) ?? { revenue: 0, visits: 0, last: null, name: v.clientName };
    row.revenue += revenueMinor(v);
    row.visits += 1;
    if (!row.last || v.dateISO > row.last) {
      row.last = v.dateISO;
      row.name = v.clientName;
    }
    map.set(v.clientId, row);
  }

  const noShow = new Map<number, number>();
  for (const v of all) {
    if (v.status !== 'no_show') continue;
    noShow.set(v.clientId, (noShow.get(v.clientId) ?? 0) + 1);
  }

  const total = [...map.values()].reduce((s, r) => s + r.revenue, 0) || 1;
  return [...map.entries()]
    .map(([id, r]) => ({
      id: String(id),
      label: r.name,
      revenue: r.revenue,
      visits: r.visits,
      average: Math.round(r.revenue / r.visits),
      lastVisit: r.last,
      noShows: noShow.get(id) ?? 0,
      share: r.revenue / total,
    }))
    .sort((a, b) => b.revenue - a.revenue);
}

/** Тот же период годом раньше — чтобы «лето к лету», а не «лето к зиме» */
export function previousYear(list: Visit[], f: Filter): Visit[] {
  const p = PERIODS.find((x) => x.id === f.period)!;
  if (p.days == null) return [];
  // Тот же день салона годом раньше; 29 февраля в невисокосный год — 1 марта,
  // как у прежнего setFullYear (addDaysISO с нулём нормализует дату).
  const [y, m, d] = salonTodayISO().split('-');
  const toISO = addDaysISO(`${Number(y) - 1}-${m}-${d}`, 0);
  const fromISO = addDaysISO(toISO, -p.days);
  const season = SEASONS.find((x) => x.id === f.season)!;

  return list.filter((v) => {
    if (v.status !== 'done') return false;
    if (v.dateISO < fromISO || v.dateISO > toISO) return false;
    if (season.months.length === 0) return true;
    return season.months.includes(fromISODate(v.dateISO).getMonth());
  });
}

export const revenueOf = sum;

export interface StaffStats {
  /** Подтверждённые записи, которые ещё впереди — текущая загрузка */
  upcoming: number;
  /** Заявки, ждущие решения */
  pending: number;
  /** Выполнено в загруженной истории */
  done: number;
  /** Revenue in the loaded history, per currency (lari and dollars are not added together) */
  revenue: MoneyPart[];
  /** Разных клиенток */
  clients: number;
  /** Когда был последний приём, ISO */
  lastISO: string | null;
}

/**
 * Счётчики по сотруднику: загрузка сейчас и итог. Считаются из записей
 * (по `staff_id`), а не хранятся полем: хранимый счётчик расходится с
 * правдой на первой же отменённой записи.
 */
export function staffStats(lists: Visit[][], staffId: number): StaffStats {
  const seen = new Map<string, Visit>();
  for (const list of lists) for (const v of list) if (v.staffId === staffId) seen.set(v.id, v);
  const mine = [...seen.values()];
  const today = salonTodayISO();
  const doneList = mine.filter((v) => v.status === 'done');
  return {
    upcoming: mine.filter((v) => v.status === 'confirmed' && v.dateISO >= today).length,
    pending: mine.filter((v) => v.status === 'pending').length,
    done: doneList.length,
    revenue: sumByCurrency(doneList, revenueMinor),
    clients: new Set(doneList.map((v) => v.clientId)).size,
    lastISO: doneList.reduce<string | null>((last, v) => (!last || v.dateISO > last ? v.dateISO : last), null),
  };
}
