/* Calendar export for a booking — a real .ics, not a toast. */
import { clinic, clinicAddress } from '../data/clinic';
import { fromISODate } from './date';
import type { Booking } from './store';
import { findService, sTitle } from '../data/services';
import type { Lang } from './i18n';

function stamp(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}T${p(d.getUTCHours())}${p(d.getUTCMinutes())}00Z`;
}

/** Escapes per RFC 5545 — commas, semicolons and newlines are structural. */
function esc(s: string): string {
  return s.replace(/([\\,;])/g, '\\$1').replace(/\n/g, '\\n');
}

export function bookingIcs(b: Booking, lang: Lang): string {
  const svc = findService(b.serviceId);
  const title = svc ? sTitle(svc, lang) : b.serviceId;
  const [h, m] = b.slot.split(':').map(Number);
  const start = fromISODate(b.date);
  start.setHours(h, m, 0, 0);
  const end = new Date(start.getTime() + (svc?.duration ?? 60) * 60_000);

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//ANZH Cosmetology//Beauty TMA//EN',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:${b.id}@anzh.tma`,
    `DTSTAMP:${stamp(new Date())}`,
    `DTSTART:${stamp(start)}`,
    `DTEND:${stamp(end)}`,
    `SUMMARY:${esc(`${title} · ${clinic.name}`)}`,
    `LOCATION:${esc(clinicAddress(lang))}`,
    `GEO:${clinic.lat};${clinic.lon}`,
    `DESCRIPTION:${esc(
      lang === 'ru'
        ? 'Запись к Анжелике. Подготовка: 24 часа без алкоголя и аспирина.'
        : 'Appointment with Anjelika. Prep: no alcohol or aspirin for 24 hours.',
    )}`,
    'BEGIN:VALARM',
    'TRIGGER:-PT2H',
    'ACTION:DISPLAY',
    `DESCRIPTION:${esc(title)}`,
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');
}

/** Triggers a download. Returns false when the client blocks it (some in-app browsers). */
export function downloadIcs(b: Booking, lang: Lang): boolean {
  try {
    const blob = new Blob([bookingIcs(b, lang)], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `anzh-${b.date}.ics`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return true;
  } catch {
    return false;
  }
}
