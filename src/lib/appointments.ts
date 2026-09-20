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

/** Демо-база: своя запись клиента + чужие заявки, чтобы кабинет мастера был не пустой */
function seed(): Appointment[] {
  return [
    { id: 's1', dateISO: shift(1), slot: '16:30', serviceId: 'lip-filler', clientName: 'Маша', clientInstagram: 'mashab', status: 'confirmed', createdAt: Date.now() },
    { id: 's2', dateISO: shift(0), slot: '12:00', serviceId: 'biorevit', clientName: 'Нино', clientInstagram: 'nino.k', status: 'confirmed', createdAt: Date.now() - 1 },
    { id: 's3', dateISO: shift(0), slot: '15:00', serviceId: 'deep-cleansing', clientName: 'Катя', clientInstagram: 'kate_bt', status: 'pending', createdAt: Date.now() - 2 },
    { id: 's4', dateISO: shift(2), slot: '10:30', serviceId: 'pdrn', clientName: 'Оля', clientInstagram: 'olya.batumi', status: 'pending', createdAt: Date.now() - 3 },
    { id: 's5', dateISO: shift(-14), slot: '11:00', serviceId: 'biorevit', clientName: 'Маша', clientInstagram: 'mashab', status: 'completed', amount: 110, createdAt: Date.now() - 4 },
    { id: 's6', dateISO: shift(-41), slot: '15:00', serviceId: 'deep-cleansing', clientName: 'Маша', clientInstagram: 'mashab', status: 'completed', amount: 80, createdAt: Date.now() - 5 },
    { id: 's7', dateISO: shift(-58), slot: '13:30', serviceId: 'lip-filler', clientName: 'Маша', clientInstagram: 'mashab', status: 'completed', amount: 150, createdAt: Date.now() - 6 },
    { id: 's8', dateISO: shift(-94), slot: '10:30', serviceId: 'pdrn', clientName: 'Маша', clientInstagram: 'mashab', status: 'completed', amount: 180, createdAt: Date.now() - 7 },
    { id: 's9', dateISO: shift(-7), slot: '18:00', serviceId: 'rf-lifting', clientName: 'Лена', clientInstagram: 'lena.gr', status: 'no-show', createdAt: Date.now() - 8 },
    { id: 's10', dateISO: shift(-21), slot: '09:00', serviceId: 'led-therapy', clientName: 'Тата', clientInstagram: 'tata.tt', status: 'completed', amount: 40, createdAt: Date.now() - 9 },
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
