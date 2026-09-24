// Запись — это ЗАЯВКА, а не автобронь. Анжелика ведёт параллельные записи по
// телефону и из инстаграма, поэтому слот, выбранный в приложении, не может
// занимать себя сам: заявка уходит мастеру, и мастер принимает, отклоняет или
// предлагает другое время. Иначе она теряет право решать, кого и когда принять.
//
// Хранится в localStorage: Telegram выгружает webview при каждом сворачивании,
// а список записей — то, ради чего в приложение возвращаются.

import { useEffect, useState } from 'react';
import { releaseBonus } from './bonuses';
import { findService } from '../data/services';

export type ApptStatus =
  | 'pending'      // ждёт решения мастера
  | 'confirmed'    // мастер принял
  | 'declined'     // мастер отклонил
  | 'offered'      // мастер предложил другое время, ждём ответа клиента
  | 'completed'    // процедура прошла
  | 'cancelled'    // клиент отменил
  | 'no-show';     // клиент не пришёл

export interface Appointment {
  id: string;
  dateISO: string;              // yyyy-mm-dd
  slot: string;                 // «16:30»
  serviceId: string;
  /** Дополнительные процедуры того же визита. Основная остаётся в serviceId:
      так вся существующая логика (история, выручка, противопоказания) читает
      запись без изменений, а сумма и длительность считаются по всему набору. */
  extras?: string[];
  clientName: string;
  clientInstagram?: string;     // главный якорь: у большинства нет телефона
  clientTgUsername?: string;
  clientPhone?: string;
  comment?: string;
  status: ApptStatus;
  offeredDateISO?: string;      // встречное предложение мастера
  offeredSlot?: string;
  declineReason?: string;
  amount?: number;              // факт оплаты — для выручки и истории
  createdAt: number;
}

const KEY = 'anzh_appointments_v2';
const listeners = new Set<(items: Appointment[]) => void>();

export const toISODate = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};
export const fromISODate = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
};
const shift = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return toISODate(d);
};

/* Демо-база кабинета.
 *
 * 🚨 РАБОТА ДОЛЖНА БЫТЬ У КАЖДОГО МАСТЕРА. Прежняя база состояла из
 * процедур, которые ведёт только владелица; Марина, у которой в профиле
 * одно ламинирование бровей, входила в кабинет и видела «Новых заявок
 * нет» и «На сегодня всё» — то есть пустой продукт. Код при этом работал
 * правильно: он фильтрует записи по мастеру. Пустой кабинет у половины
 * команды — это дефект данных, который читается как дефект продукта.
 *
 * Поэтому здесь: заявки и визиты на КАЖДОГО из троих, история на полгода
 * назад (иначе разрезы по периодам и сезонам показывают одну колонку),
 * повторные визиты у части клиенток (иначе выручка по клиенткам не
 * отличается от списка) и неявки (иначе нечего показывать в рисках).
 */
const C = {
  masha: { clientName: 'Маша', clientInstagram: 'mashab' },
  nino:  { clientName: 'Нино К.', clientInstagram: 'nino.k' },
  katya: { clientName: 'Катя', clientInstagram: 'kate_bt' },
  olya:  { clientName: 'Оля', clientInstagram: 'olya.batumi' },
  lena:  { clientName: 'Лена', clientInstagram: 'lena.gr' },
  tata:  { clientName: 'Тата', clientInstagram: 'tata.tt' },
  sofi:  { clientName: 'Софи', clientInstagram: 'sofi.wave' },
  dasha: { clientName: 'Даша', clientInstagram: 'dasha.btm' },
} as const;

function seed(): Appointment[] {
  let n = 0;
  const a = (
    who: keyof typeof C,
    days: number,
    slot: string,
    serviceId: string,
    status: ApptStatus,
    amount?: number,
    extra?: Partial<Appointment>,
  ): Appointment => ({
    id: `s${++n}`,
    dateISO: shift(days),
    slot,
    serviceId,
    status,
    ...(amount !== undefined ? { amount } : {}),
    ...C[who],
    createdAt: Date.now() - n * 1000,
    ...extra,
  });

  return [
    // ── Ждут решения. По одной на каждого мастера, иначе «Заявки» пусты
    //    у того, кто вошёл не владелицей.
    a('katya', 0, '15:00', 'deep-cleansing', 'pending', undefined,
      { comment: 'Можно пораньше, если освободится' }),
    a('olya', 2, '10:30', 'pdrn', 'pending'),
    a('sofi', 1, '11:00', 'brow-lamination', 'pending'),
    a('dasha', 3, '14:00', 'tattoo-removal', 'pending',
      undefined, { comment: 'Маленькая татуировка на запястье' }),
    a('lena', 2, '17:00', 'carbon-peel', 'pending'),

    // ── Подтверждённые: сегодня и ближайшие дни
    a('masha', 1, '16:30', 'lip-filler', 'confirmed'),
    a('nino', 0, '12:00', 'biorevit', 'confirmed'),
    a('tata', 0, '18:00', 'brow-lamination', 'confirmed'),
    a('katya', 1, '13:00', 'carbon-peel', 'confirmed'),
    a('sofi', 4, '15:30', 'rf-lifting', 'confirmed'),

    // ── История: повторные визиты. Маша — постоянная клиентка, по ней
    //    видно, ради чего вообще считать выручку по людям.
    a('masha', -14, '11:00', 'biorevit', 'completed', 110),
    a('masha', -41, '15:00', 'deep-cleansing', 'completed', 80),
    a('masha', -58, '13:30', 'lip-filler', 'completed', 150),
    a('masha', -94, '10:30', 'pdrn', 'completed', 180),
    a('masha', -132, '12:00', 'biorevit', 'completed', 110),
    a('masha', -171, '16:00', 'lip-filler', 'completed', 150),

    a('nino', -9, '14:00', 'led-therapy', 'completed', 40),
    a('nino', -37, '11:30', 'biorevit', 'completed', 110),
    a('nino', -76, '13:00', 'rf-lifting', 'completed', 90),
    a('nino', -118, '10:00', 'deep-cleansing', 'completed', 80),

    a('tata', -21, '09:00', 'led-therapy', 'completed', 40),
    a('tata', -52, '18:30', 'brow-lamination', 'completed', 45),
    a('tata', -83, '18:00', 'brow-lamination', 'completed', 45),
    a('tata', -145, '17:30', 'brow-lamination', 'completed', 45),

    a('katya', -28, '15:00', 'carbon-peel', 'completed', 95),
    a('katya', -63, '15:30', 'deep-cleansing', 'completed', 80),
    a('katya', -101, '16:00', 'prx-t33', 'completed', 75),

    a('olya', -33, '10:30', 'pdrn', 'completed', 180),
    a('olya', -88, '11:00', 'biorevit', 'completed', 110),

    a('sofi', -18, '12:30', 'brow-lamination', 'completed', 45),
    a('sofi', -66, '13:00', 'rf-lifting', 'completed', 90),

    a('dasha', -25, '16:00', 'tattoo-removal', 'completed', 120),
    a('dasha', -70, '16:30', 'tattoo-removal', 'completed', 120),
    a('dasha', -112, '15:00', 'carbon-peel', 'completed', 95),

    // ── Неявки и отказы: без них нечего показывать в рисках, а кнопка
    //    «отклонить» выглядит как та, которой никогда не пользуются.
    a('lena', -7, '18:00', 'rf-lifting', 'no-show'),
    a('lena', -49, '17:00', 'led-therapy', 'no-show'),
    a('lena', -95, '18:30', 'carbon-peel', 'completed', 95),
    a('olya', -12, '09:30', 'prx-t33', 'declined', undefined,
      { declineReason: 'В этот день не работаю — предложила другое время' }),
  ];
}

function load(): Appointment[] {
  if (typeof window === 'undefined') return seed();
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) {
      const s = seed();
      localStorage.setItem(KEY, JSON.stringify(s));
      return s;
    }
    return JSON.parse(raw) as Appointment[];
  } catch {
    return seed();
  }
}

let items: Appointment[] = load();

function persist() {
  try { localStorage.setItem(KEY, JSON.stringify(items)); } catch { /* ignore */ }
  listeners.forEach((l) => l(items));
}

function patch(id: string, fields: Partial<Appointment>) {
  items = items.map((a) => (a.id === id ? { ...a, ...fields } : a));
  persist();
}

export function useAppointments(): Appointment[] {
  const [s, setS] = useState<Appointment[]>(items);
  useEffect(() => {
    listeners.add(setS);
    return () => { listeners.delete(setS); };
  }, []);
  return s;
}

export const findAppointment = (id: string) => items.find((a) => a.id === id);

/* ── Действия клиента ── */

export function requestAppointment(input: {
  dateISO: string; slot: string; serviceId: string; extras?: string[];
  clientName: string; clientInstagram?: string; clientTgUsername?: string; clientPhone?: string; comment?: string;
}): Appointment {
  const appt: Appointment = { id: `a${Date.now()}`, status: 'pending', createdAt: Date.now(), ...input };
  items = [appt, ...items];
  persist();
  return appt;
}

export function cancelAppointment(id: string) {
  patch(id, { status: 'cancelled' });
  releaseBonus(id);
}

/** Клиент принимает встречное время, предложенное мастером */
export function acceptOffer(id: string) {
  const a = findAppointment(id);
  if (!a?.offeredDateISO || !a.offeredSlot) return;
  patch(id, { status: 'confirmed', dateISO: a.offeredDateISO, slot: a.offeredSlot, offeredDateISO: undefined, offeredSlot: undefined });
}

/* ── Действия мастера ── */

export function confirmAppointment(id: string) {
  patch(id, { status: 'confirmed' });
}

export function declineAppointment(id: string, reason?: string) {
  patch(id, { status: 'declined', declineReason: reason });
  // Заявки не случилось — скидка не должна сгореть вместе с ней
  releaseBonus(id);
}

export function offerAnotherTime(id: string, dateISO: string, slot: string) {
  patch(id, { status: 'offered', offeredDateISO: dateISO, offeredSlot: slot });
}

export function markCompleted(id: string, amount: number) {
  patch(id, { status: 'completed', amount });
}

export function markNoShow(id: string) {
  patch(id, { status: 'no-show' });
}

/* ── Выборки ── */

const ACTIVE: ApptStatus[] = ['pending', 'confirmed', 'offered'];

/** Слот занят, если на него уже есть принятая запись — заявки друг друга не блокируют */
export function isSlotTaken(dateISO: string, slot: string) {
  return items.some((a) => a.dateISO === dateISO && a.slot === slot && a.status === 'confirmed');
}

export function getMyAppointments(all: Appointment[], instagram?: string, name?: string) {
  return all.filter((a) =>
    (instagram && a.clientInstagram === instagram) || (!!name && a.clientName === name));
}

export const byDateAsc = (a: Appointment, b: Appointment) =>
  (a.dateISO + a.slot).localeCompare(b.dateISO + b.slot);

export function getUpcoming(list: Appointment[] = items) {
  const today = toISODate(new Date());
  return list.filter((a) => ACTIVE.includes(a.status) && a.dateISO >= today).sort(byDateAsc);
}


/* Отклонённые заявки. Они не входят ни в активные (ACTIVE), ни в историю
   кабинета (там только completed) — и до этой функции просто ИСЧЕЗАЛИ у
   клиентки: человек отправил заявку, Анжелика отказала, и ответа он не
   видел никогда. Молчание в ответ на запрос — худшее, что может сделать
   сервис. Показываем две недели: позже отказ уже неактуален. */
export function getDeclined(list: Appointment[] = items, days = 14) {
  const from = new Date();
  from.setDate(from.getDate() - days);
  const fromISO = toISODate(from);
  return list
    .filter((a) => a.status === 'declined' && a.dateISO >= fromISO)
    .sort((a, b) => b.createdAt - a.createdAt);
}

export function getPast(list: Appointment[] = items) {
  return list
    .filter((a) => a.status === 'completed' || a.status === 'no-show' || a.status === 'cancelled' || a.status === 'declined')
    .sort((a, b) => b.dateISO.localeCompare(a.dateISO));
}

export function getPending(list: Appointment[] = items) {
  return list.filter((a) => a.status === 'pending').sort(byDateAsc);
}

export function getDay(list: Appointment[] = items, dateISO = toISODate(new Date())) {
  return list.filter((a) => a.dateISO === dateISO && ACTIVE.includes(a.status)).sort(byDateAsc);
}

/** Уникальные клиенты — база, которой у Анжелики сейчас нет */
export interface ClientRow {
  key: string;
  name: string;
  instagram?: string;
  visits: number;
  spent: number;
  lastVisit?: string;
  noShows: number;
}

export function getClients(list: Appointment[] = items): ClientRow[] {
  const map = new Map<string, ClientRow>();
  for (const a of list) {
    const key = a.clientInstagram || a.clientName;
    const row = map.get(key) ?? { key, name: a.clientName, instagram: a.clientInstagram, visits: 0, spent: 0, noShows: 0 };
    if (a.status === 'completed') {
      row.visits += 1;
      row.spent += a.amount ?? 0;
      if (!row.lastVisit || a.dateISO > row.lastVisit) row.lastVisit = a.dateISO;
    }
    if (a.status === 'no-show') row.noShows += 1;
    map.set(key, row);
  }
  return [...map.values()].sort((a, b) => b.visits - a.visits);
}

/* ── Форматирование дат ── */
const WEEKDAY_RU = ['воскресенье', 'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота'];
const WEEKDAY_EN = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTH_GEN_RU = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
const MONTH_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const MONTH_SHORT_RU = ['ЯНВ', 'ФЕВ', 'МАР', 'АПР', 'МАЙ', 'ИЮН', 'ИЮЛ', 'АВГ', 'СЕН', 'ОКТ', 'НОЯ', 'ДЕК'];
const MONTH_SHORT_EN = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

export function formatLongDate(d: Date, lang: 'ru' | 'en' = 'ru') {
  if (lang === 'en') return `${WEEKDAY_EN[d.getDay()]}, ${d.getDate()} ${MONTH_EN[d.getMonth()]}`;
  const w = WEEKDAY_RU[d.getDay()];
  return `${w[0].toUpperCase()}${w.slice(1)} ${d.getDate()} ${MONTH_GEN_RU[d.getMonth()]}`;
}
export const formatWeekday = (d: Date, lang: 'ru' | 'en' = 'ru') =>
  lang === 'en' ? WEEKDAY_EN[d.getDay()] : WEEKDAY_RU[d.getDay()];
export const formatMonthShort = (d: Date, lang: 'ru' | 'en' = 'ru') =>
  lang === 'en' ? MONTH_SHORT_EN[d.getMonth()] : MONTH_SHORT_RU[d.getMonth()];
export const formatShort = (iso: string, lang: 'ru' | 'en' = 'ru') => {
  const d = fromISODate(iso);
  return `${d.getDate()} ${(lang === 'en' ? MONTH_SHORT_EN : MONTH_SHORT_RU)[d.getMonth()].toLowerCase()}`;
};

export const STATUS_LABEL: Record<ApptStatus, { ru: string; en: string; tone: 'wait' | 'ok' | 'bad' }> = {
  pending:   { ru: 'Ждёт подтверждения', en: 'Awaiting confirmation', tone: 'wait' },
  confirmed: { ru: 'Подтверждена',       en: 'Confirmed',             tone: 'ok' },
  offered:   { ru: 'Предложено другое время', en: 'New time offered',  tone: 'wait' },
  declined:  { ru: 'Отклонена',          en: 'Declined',              tone: 'bad' },
  completed: { ru: 'Завершена',          en: 'Completed',             tone: 'ok' },
  cancelled: { ru: 'Отменена',           en: 'Cancelled',             tone: 'bad' },
  'no-show': { ru: 'Не пришёл',          en: 'No-show',               tone: 'bad' },
};

/* ── Визит из нескольких процедур ──────────────────────────
   Анжелика часто делает две-три за один приход: чистка и следом уход,
   брови вместе с пилингом. Раньше это была отдельная заявка на каждую —
   и в расписании они вставали как два разных человека. */

export const apptServiceIds = (a: Appointment): string[] => [a.serviceId, ...(a.extras ?? [])];

/** Суммарная длительность визита — от неё зависит, влезает ли он в слот */
export function apptDuration(a: Appointment): number {
  return apptServiceIds(a).reduce((sum, id) => sum + (findService(id)?.duration ?? 0), 0);
}

/** Сумма по прайсу за весь визит */
export function apptPrice(a: Appointment): number {
  return apptServiceIds(a).reduce((sum, id) => sum + (findService(id)?.priceUsd ?? 0), 0);
}
