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

/** Длительность услуги: у обучения она измеряется днями, а не минутами */
export function durationLabel(minutes: number, dayCount?: number): string {
  return dayCount ? days(dayCount) : `${minutes} мин`;
}
