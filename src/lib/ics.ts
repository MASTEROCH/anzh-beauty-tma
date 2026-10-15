/* Экспорт визита в календарь — настоящий .ics, а не тост «мы напомним».
   Перенесено из ветки claude/anzh-beauty-tma-gtc9jt и переведено на модель
   заявки (`Appointment`) и на `data/location.ts`: их `clinic.ts` содержал
   третий этаж и общий домофон — данные, которые Роч уже поправил. */
import { STUDIO, studioAddress } from '../data/location';
import { salonParts, type Appointment } from './appointments';
import { findService, sTitle } from '../data/services';
import type { Lang } from './i18n';

function stamp(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}T${p(d.getUTCHours())}${p(d.getUTCMinutes())}00Z`;
}

/** Экранирование по RFC 5545 — запятая, точка с запятой и перенос структурны */
function esc(s: string): string {
  return s.replace(/([\\,;])/g, '\\$1').replace(/\n/g, '\\n');
}

/* Начало визита — МОМЕНТ, а не «день + время» в поясе телефона.
   Прежде здесь было dateISO + slot через setHours: это время салона, но
   прочитанное в поясе ТЕЛЕФОНА. У туристки с телефоном в своём поясе событие
   в календаре съезжало на разницу поясов. Сервер присылает starts_at в UTC —
   его и берём. Нет его — день и время салона переводятся в момент по поясу
   САЛОНА (salonParts), а не телефона. */
function visitStart(a: Appointment): Date | null {
  if (a.startsAt) {
    const d = new Date(a.startsAt);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const [y, mo, d] = a.dateISO.split('-').map(Number);
  const [h, mi] = a.slot.split(':').map(Number);
  if (![y, mo, d, h, mi].every(Number.isFinite)) return null;
  // Стенные часы салона как будто в UTC, затем поправка на смещение пояса
  // салона в этот момент; второй проход — на случай перехода на летнее время.
  const wall = Date.UTC(y, mo - 1, d, h, mi);
  let t = wall;
  for (let i = 0; i < 2; i++) {
    const p = salonParts(new Date(t));
    if (!p) return null;
    const [py, pmo, pd] = p.dateISO.split('-').map(Number);
    const [ph, pmi] = p.slot.split(':').map(Number);
    t += wall - Date.UTC(py, pmo - 1, pd, ph, pmi);
  }
  return new Date(t);
}

/** Событие календаря — общий вид для визита клиентки и для записи в кабинете */
export interface CalEvent {
  uid: string;
  start: Date;
  durationMin: number;
  title: string;
  location: string;
  description: string;
  /** Напоминание за N минут; null — без напоминания */
  alarmMin: number | null;
}

/** Визит клиентки → событие. null — у визита нет понятного начала. */
export function eventOfAppointment(a: Appointment, lang: Lang): CalEvent | null {
  const svc = findService(a.serviceId);
  const title = svc ? sTitle(svc, lang) : a.serviceId;
  const start = visitStart(a);
  if (!start) return null;
  return {
    uid: `${a.id}@anzh.tma`,
    start,
    // Длительность — посчитанная сервером на весь визит, иначе из каталога
    durationMin: a.durationMin ?? svc?.duration ?? 60,
    title: `${title} · ANZH Cosmetology`,
    location: studioAddress(lang),
    description: lang === 'ru'
      ? 'Запись к Анжелике. Подготовка: 24 часа без алкоголя и аспирина.'
      : 'Appointment with Anjelika. Prep: no alcohol or aspirin for 24 hours.',
    // За два часа: хватает, чтобы доехать, и не настолько рано, чтобы забыть
    alarmMin: 120,
  };
}

function veventLines(e: CalEvent): string[] {
  const end = new Date(e.start.getTime() + e.durationMin * 60_000);
  return [
    'BEGIN:VEVENT',
    `UID:${e.uid}`,
    `DTSTAMP:${stamp(new Date())}`,
    `DTSTART:${stamp(e.start)}`,
    `DTEND:${stamp(end)}`,
    `SUMMARY:${esc(e.title)}`,
    `LOCATION:${esc(e.location)}`,
    `GEO:${STUDIO.lat};${STUDIO.lon}`,
    `DESCRIPTION:${esc(e.description)}`,
    ...(e.alarmMin !== null ? ['BEGIN:VALARM', `TRIGGER:-PT${e.alarmMin}M`, 'ACTION:DISPLAY', `DESCRIPTION:${esc(e.title)}`, 'END:VALARM'] : []),
    'END:VEVENT',
  ];
}

/** Один файл на любое число событий («весь день», «все будущие») */
export function eventsIcs(list: CalEvent[]): string {
  return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//ANZH Cosmetology//Beauty TMA//EN', 'CALSCALE:GREGORIAN',
    ...list.flatMap(veventLines), 'END:VCALENDAR'].join('\r\n');
}

/** Google Календарь — ссылка на готовую форму события (работает везде, где открывается браузер) */
export function googleCalendarUrl(e: CalEvent): string {
  const end = new Date(e.start.getTime() + e.durationMin * 60_000);
  const q = new URLSearchParams({
    action: 'TEMPLATE', text: e.title, dates: `${stamp(e.start)}/${stamp(end)}`,
    details: e.description, location: e.location, ctz: 'Asia/Tbilisi',
  });
  return `https://calendar.google.com/calendar/render?${q.toString()}`;
}

/** Скачать .ics. false — встроенный браузер заблокировал загрузку */
export function downloadEvents(list: CalEvent[], fileName: string): boolean {
  if (list.length === 0) return false;
  try {
    const blob = new Blob([eventsIcs(list)], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return true;
  } catch {
    return false;
  }
}

/** Текст .ics одного визита. null — у визита нет понятного начала (календарь с чужим временем хуже, чем никакого). */
export function appointmentIcs(a: Appointment, lang: Lang): string | null {
  const e = eventOfAppointment(a, lang);
  return e ? eventsIcs([e]) : null;
}

/** Скачивание. false — если встроенный браузер его заблокировал */
export function downloadIcs(a: Appointment, lang: Lang): boolean {
  const e = eventOfAppointment(a, lang);
  return e ? downloadEvents([e], `anzh-${a.dateISO}.ics`) : false;
}
