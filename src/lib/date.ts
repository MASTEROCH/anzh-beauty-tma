/* Shared date formatting — booking, confirm and account must all agree. */
import type { Lang } from './i18n';

export const DAYS_SHORT = {
  ru: ['ВС', 'ПН', 'ВТ', 'СР', 'ЧТ', 'ПТ', 'СБ'],
  en: ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'],
} as const;

export const DAYS_FULL = {
  ru: ['воскресенье', 'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота'],
  en: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
} as const;

export const MON_SHORT = {
  ru: ['ЯНВ', 'ФЕВ', 'МАР', 'АПР', 'МАЙ', 'ИЮН', 'ИЮЛ', 'АВГ', 'СЕН', 'ОКТ', 'НОЯ', 'ДЕК'],
  en: ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'],
} as const;

/** Genitive month forms — «24 мая», not «24 май». */
export const MON_OF = {
  ru: ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'],
  en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
} as const;

/** Local (not UTC) `yyyy-mm-dd` — avoids the timezone off-by-one of toISOString(). */
export function toISODate(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function fromISODate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

export function daysFromNow(n: number): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + n);
  return d;
}

/** «24 мая» · «24 May» */
export function fmtDate(iso: string, lang: Lang): string {
  const d = fromISODate(iso);
  return lang === 'ru'
    ? `${d.getDate()} ${MON_OF.ru[d.getMonth()]}`
    : `${d.getDate()} ${MON_OF.en[d.getMonth()]}`;
}

/** «пятница 24 мая» · «Friday 24 May» */
export function fmtDateLong(iso: string, lang: Lang): string {
  const d = fromISODate(iso);
  return `${DAYS_FULL[lang][d.getDay()]} ${fmtDate(iso, lang)}`;
}

/** «12 апр» · «12 Apr» — compact history rows. */
export function fmtDateShort(iso: string, lang: Lang): string {
  const d = fromISODate(iso);
  const mon = MON_SHORT[lang][d.getMonth()];
  return `${d.getDate()} ${lang === 'ru' ? mon.toLowerCase() : mon[0] + mon.slice(1).toLowerCase()}`;
}

/** «сегодня» / «завтра» / «через 5 дней» — relative countdown for the next visit. */
export function fmtRelative(iso: string, lang: Lang): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.round((fromISODate(iso).getTime() - today.getTime()) / 86_400_000);
  if (lang === 'ru') {
    if (diff < 0) return 'прошло';
    if (diff === 0) return 'сегодня';
    if (diff === 1) return 'завтра';
    if (diff === 2) return 'послезавтра';
    const n = diff % 100 >= 11 && diff % 100 <= 14 ? 0 : diff % 10;
    const word = n === 1 ? 'день' : n >= 2 && n <= 4 ? 'дня' : 'дней';
    return `через ${diff} ${word}`;
  }
  if (diff < 0) return 'past';
  if (diff === 0) return 'today';
  if (diff === 1) return 'tomorrow';
  return `in ${diff} days`;
}

/** Slot end time, given a start `HH:MM` and a duration in minutes. */
export function addMinutes(slot: string, minutes: number): string {
  const [h, m] = slot.split(':').map(Number);
  const total = h * 60 + m + minutes;
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(Math.floor(total / 60) % 24)}:${p(total % 60)}`;
}
