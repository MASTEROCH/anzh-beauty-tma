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

/** Текст .ics. null — у визита нет понятного начала (календарь с чужим временем хуже, чем никакого). */
export function appointmentIcs(a: Appointment, lang: Lang): string | null {
  const svc = findService(a.serviceId);
  const title = svc ? sTitle(svc, lang) : a.serviceId;
  const start = visitStart(a);
  if (!start) return null;
  // Длительность — посчитанная сервером на весь визит (несколько процедур),
  // иначе — из каталога
  const end = new Date(start.getTime() + (a.durationMin ?? svc?.duration ?? 60) * 60_000);

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
    const text = appointmentIcs(a, lang);
    if (text === null) return false;
    const blob = new Blob([text], { type: 'text/calendar;charset=utf-8' });
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
