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
import { clientKeyOf } from './clientCard';
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

export interface ClientRow extends Row {
  /** Средний чек: выручка, делённая на число визитов */
  average: number;
  /** Когда приходила в последний раз, ISO-дата */
  lastVisit: string | null;
  /** Сколько раз не пришла — это меняет отношение к её заявкам */
  noShows: number;
  instagram?: string;
}

/**
 * Выручка ПО КЛИЕНТКАМ.
 *
 * Отвечает на вопрос, которого не было ни в одном другом разрезе: кто
 * приносит деньги. Салон живёт повторными визитами, и разница между
 * «сто клиенток по разу» и «двадцать по пять» видна только здесь —
 * по услугам и по мастерам она не читается никак.
 *
 * Ключ — тот же `clientKeyOf`, что и в карточке: инстаграм, иначе
 * телеграм, иначе имя. Телефона у клиенток Анжелики чаще нет.
 */
export function byClient(list: Appointment[], all: Appointment[] = list): ClientRow[] {
  const map = new Map<string, {
    revenue: number; visits: number; last: string | null;
    name: string; instagram?: string;
  }>();

  for (const a of list) {
    const key = clientKeyOf(a);
    const row = map.get(key) ?? {
      revenue: 0, visits: 0, last: null, name: a.clientName, instagram: a.clientInstagram,
    };
    row.revenue += a.amount ?? priceOf(a.serviceId);
    row.visits += 1;
    // Самый поздний визит, а не последний в массиве: порядок не гарантирован.
    if (!row.last || a.dateISO > row.last) row.last = a.dateISO;
    // Имя могло смениться — берём из самой свежей записи.
    if (row.last === a.dateISO) row.name = a.clientName;
    map.set(key, row);
  }

  /* Неявки считаем по ВСЕМ записям, а не по отфильтрованным: человек,
     не пришедший в мае, остаётся риском и в июньском отчёте. Фильтр
     здесь про деньги, а не про репутацию. */
  const noShow = new Map<string, number>();
  for (const a of all) {
    if (a.status !== 'no-show') continue;
    const k = clientKeyOf(a);
    noShow.set(k, (noShow.get(k) ?? 0) + 1);
  }

  const total = [...map.values()].reduce((s, r) => s + r.revenue, 0) || 1;
  return [...map.entries()]
    .map(([id, r]) => ({
      id,
      label: r.name,
      instagram: r.instagram,
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

export interface StaffStats {
  /** Подтверждённые записи, которые ещё впереди — текущая загрузка */
  upcoming: number;
  /** Заявки, ждущие решения по его процедурам */
  pending: number;
  /** Выполнено за всё время */
  done: number;
  /** Выручка за всё время */
  revenue: number;
  /** Разных клиенток за всё время */
  clients: number;
  /** Когда был последний приём, ISO */
  lastISO: string | null;
}

/**
 * Счётчики по сотруднику: загрузка сейчас и итог за всё время.
 *
 * Считается из записей, а не хранится полем: хранимый счётчик
 * расходится с правдой на первой же отменённой записи, и починить его
 * потом нечем — исходного события уже нет.
 *
 * Принадлежность та же, что в `byStaff`: процедура, которую закреплённо
 * ведёт ровно один мастер, — его; всё остальное владелицы. Делить
 * пополам нельзя, получатся приёмы, которых никто не вёл.
 */
export function staffStats(list: Appointment[], staffId: string): StaffStats {
  const owner = getTeam().find((s) => s.role === 'owner');
  const belongs = (a: Appointment) => {
    const only = staffForService(a.serviceId).filter((s) => s.role === 'master');
    const id = only.length === 1 ? only[0].id : owner?.id ?? 'owner';
    return id === staffId;
  };

  const mine = list.filter(belongs);
  const today = toISODate(new Date());
  const doneList = mine.filter((a) => a.status === 'completed');

  return {
    upcoming: mine.filter((a) => a.status === 'confirmed' && a.dateISO >= today).length,
    pending: mine.filter((a) => a.status === 'pending').length,
    done: doneList.length,
    revenue: doneList.reduce((sum, a) => sum + (a.amount ?? priceOf(a.serviceId)), 0),
    clients: new Set(doneList.map(clientKeyOf)).size,
    lastISO: doneList.reduce<string | null>(
      (last, a) => (!last || a.dateISO > last ? a.dateISO : last),
      null,
    ),
  };
}
