/* Экспорт визита в календарь — настоящий .ics, а не тост «мы напомним».
   Перенесено из ветки claude/anzh-beauty-tma-gtc9jt и переведено на модель
   заявки (`Appointment`) и на `data/location.ts`: их `clinic.ts` содержал
   третий этаж и общий домофон — данные, которые Роч уже поправил. */
import { STUDIO, studioAddress } from '../data/location';
import { fromISODate, type Appointment } from './appointments';
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

export function appointmentIcs(a: Appointment, lang: Lang): string {
  const svc = findService(a.serviceId);
  const title = svc ? sTitle(svc, lang) : a.serviceId;
  const [h, m] = a.slot.split(':').map(Number);
  const start = fromISODate(a.dateISO);
  start.setHours(h, m, 0, 0);
  const end = new Date(start.getTime() + (svc?.duration ?? 60) * 60_000);

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//ANZH Cosmetology//Beauty TMA//EN',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:${a.id}@anzh.tma`,
    `DTSTAMP:${stamp(new Date())}`,
    `DTSTART:${stamp(start)}`,
    `DTEND:${stamp(end)}`,
    `SUMMARY:${esc(`${title} · ANZH Cosmetology`)}`,
    `LOCATION:${esc(studioAddress(lang))}`,
    `GEO:${STUDIO.lat};${STUDIO.lon}`,
    `DESCRIPTION:${esc(
      lang === 'ru'
        ? 'Запись к Анжелике. Подготовка: 24 часа без алкоголя и аспирина.'
        : 'Appointment with Anjelika. Prep: no alcohol or aspirin for 24 hours.',
    )}`,
    // Напоминание за два часа: хватает, чтобы доехать, и не настолько рано,
    // чтобы про него забыть
    'BEGIN:VALARM',
    'TRIGGER:-PT2H',
    'ACTION:DISPLAY',
    `DESCRIPTION:${esc(title)}`,
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');
}

/** Скачивание. false — если встроенный браузер его заблокировал */
export function downloadIcs(a: Appointment, lang: Lang): boolean {
  try {
    const blob = new Blob([appointmentIcs(a, lang)], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `anzh-${a.dateISO}.ics`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return true;
  } catch {
    return false;
  }
}
