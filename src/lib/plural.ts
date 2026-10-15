// Русские числительные. «2 визит(ов)» — это не экономия, а признак того,
// что текст писали не для человека: на экране мастера такие скобки стоят
// в каждой строке отчёта.

/** plural(2, 'визит', 'визита', 'визитов') → «визита» */
export function plural(n: number, one: string, few: string, many: string): string {
  const d = Math.abs(n) % 10;
  const h = Math.abs(n) % 100;
  if (d === 1 && h !== 11) return one;
  if (d >= 2 && d <= 4 && (h < 12 || h > 14)) return few;
  return many;
}

export const visits = (n: number) => `${n} ${plural(n, 'визит', 'визита', 'визитов')}`;
export const people = (n: number) => `${n} ${plural(n, 'человек', 'человека', 'человек')}`;
export const times = (n: number) => `${n} ${plural(n, 'раз', 'раза', 'раз')}`;
export const days = (n: number) => `${n} ${plural(n, 'день', 'дня', 'дней')}`;

/**
 * Длительность услуги: у обучения она измеряется днями, а не минутами.
 * Neither days nor minutes (null, 0) — an empty string: there is nothing true to show
 * (such rows are off the showcase — B4-A, lib/showable.ts); "null мин" or "0 мин" would lie.
 * English (K13, F7): "40 min", "1 day", "2 days" — next to "from … per ml" a Russian
 * "40 мин" read as a leftover.
 */
export function durationLabel(
  minutes: number | null | undefined,
  dayCount?: number | null,
  lang: 'ru' | 'en' = 'ru',
): string {
  if (dayCount != null && dayCount > 0) {
    return lang === 'en' ? `${dayCount} ${dayCount === 1 ? 'day' : 'days'}` : days(dayCount);
  }
  return minutes != null && minutes > 0 ? `${minutes} ${lang === 'en' ? 'min' : 'мин'}` : '';
}
