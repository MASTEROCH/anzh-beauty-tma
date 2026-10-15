// Price string — ONE formatter for the app (K1; owner's decisions 06.10.2026, "1-a"):
//   · B1-B — every price carries its own currency, no switch: "300 ₾", "$800". This MAIN
//     price is exact and the only one that is summed, sent or stored;
//   · K11b (owner, 06.10 evening: the main price in lari, dollars — the second one, not
//     the main) — next to a LARI price a SECOND one, a reference conversion at
//     REFERENCE_RATE: "≈ $128" (secondPrice below). A dollar row has none (K13, H-1a):
//     dollars are the second price only to lari. Display only, and only on the catalog
//     card and the service screen, in one block with the main: "от 350 ₾ за сеанс (≈ $128)";
//   · B3-G — variants collapse into one "from" line: "от 300 ₾";
//   · B2-G — the price unit is a front-end map by the row's address: "от 10 ₾ за единицу".
// No currency — no sign ("300"). No price — null; a zero price is "0 ₾", never "от 0 ₾".
//
// The string is FOR DISPLAY ONLY. Wherever the number takes part (a visit total,
// a key, an input field, a request) use priceMinor — the integer in minor units —
// never this string (skill Frodo/number-formatting-must-not-leak-into-functional-value).
//
// The sign is placed here; the digits come from Intl. Measured 06.10.2026 — Node 22.18
// (ICU 77.1), Chromium 153, WebKit 26.6 printed the same:
//   · Intl currency style for GEL in ru-RU prints "300,00 GEL"; with narrowSymbol —
//     "300 ლ" (U+10DA, a Georgian letter, NOT ₾ U+20BE);
//   · ru-RU puts the dollar after the number ("800 $"), the owner approved "$800";
//   · ka-GE in Chromium prints "300 GEL" (Node and WebKit — "300 ₾").
// The digits agree everywhere: group separator U+00A0, useGrouping 'min2' keeps four
// digits whole ("1000", "10 000"), ru decimal comma ("175,50").
// Between the number and ₾ and after "от" stands a no-break space U+00A0, so neither
// the word nor the sign is torn from the number by a line break.

import type { Service } from '../data/services';
import type { Lang } from './i18n';
import { isPriceMinor } from './showable';
import { getRate, FALLBACK_RATE } from './rates';
import { getPriceMode } from './priceMode';

const NBSP = String.fromCharCode(0xa0);
const LARI = '₾';
const ISO_CODE = /^[A-Z]{3}$/;

/**
 * Price unit by the row's address (B2-G). Rows with a unit in the C4 data draft
 * (`_work/catalog/06-John-черновик-данных-C4.md` §1–§2, column "unit"; footnote 5 —
 * "per session" for mesotherapy and the laser). A new "per unit" row is a code change
 * (the price of option G, `_work/catalog/03` §3 B2).
 */
export const PRICE_UNITS: ReadonlyMap<string, Readonly<Record<Lang, string>>> = new Map([
  ['contour-plastic', { ru: 'за 1 мл', en: 'per ml' }], // §1 No. 1; EN — Katya, T2 ed. 2 §4.1
  ['lip-filler', { ru: 'за 1 мл', en: 'per ml' }], // ed. 3.1 §1 column A (lips opened, John 06.10); lawyer K13
  ['biorevit', { ru: 'за сеанс', en: 'per session' }], // ed. 3.1 §1 No. 4 — the subtitle names a course of 2–5
  ['botulinum', { ru: 'за единицу', en: 'per unit' }], // §1 No. 7
  ['mesotherapy', { ru: 'за сеанс', en: 'per session' }], // §2 No. 6
  ['face-wax', { ru: 'за зону', en: 'per zone' }], // §2 No. 21
  ['tattoo-removal', { ru: 'за сеанс', en: 'per session' }], // §2 No. 24
  ['pmu-removal', { ru: 'за сеанс', en: 'per session' }], // §2 No. 25
  ['pigment-removal', { ru: 'за сеанс', en: 'per session' }], // §2 "step 2", No. 25a
]);

/** The unit for a row, with no-break spaces inside; null — the row has no unit. */
export function priceUnit(slug: string | null | undefined, lang: Lang = 'ru'): string | null {
  if (typeof slug !== 'string') return null;
  const unit = PRICE_UNITS.get(slug);
  return unit ? unit[lang].replaceAll(' ', NBSP) : null;
}

// 'min2' is ES2023 Intl (NumberFormat v3); the project's lib is ES2022, so the option
// type is widened here. An engine without 'min2' reads it as `true` — "1 000".
type NumberOptions = Omit<Intl.NumberFormatOptions, 'useGrouping'> & {
  useGrouping?: boolean | 'min2' | 'auto' | 'always';
};

const numberFormats = new Map<string, Intl.NumberFormat>();

function formatNumber(major: number, fractionDigits: 0 | 2, lang: Lang): string {
  const key = `${lang}:${fractionDigits}`;
  let nf = numberFormats.get(key);
  if (!nf) {
    const options: NumberOptions = { minimumFractionDigits: fractionDigits, maximumFractionDigits: fractionDigits };
    // ru: four digits stay whole ("1000"), groups from five ("10 000") — Russian typesetting;
    // en: the usual "1,000".
    if (lang !== 'en') options.useGrouping = 'min2';
    nf = new Intl.NumberFormat(lang === 'en' ? 'en-US' : 'ru-RU', options as Intl.NumberFormatOptions);
    numberFormats.set(key, nf);
  }
  return nf.format(major);
}

/**
 * Amount with its sign: "300 ₾", "$800", "15,50 ₾". Another ISO code — after the
 * number ("300 EUR"); no code (null, '', lowercase) — no sign at all. No price — null.
 */
export function formatAmount(
  minor: number | null | undefined,
  currency: string | null | undefined,
  lang: Lang = 'ru',
): string | null {
  if (!isPriceMinor(minor)) return null;
  const num = formatNumber(minor / 100, minor % 100 === 0 ? 0 : 2, lang);
  const sign = currencySign(currency);
  if (sign === '') return num;
  return currency === 'USD' ? `${sign}${num}` : `${num}${NBSP}${sign}`;
}

/**
 * The sign alone — for a field label next to an input: "₾", "$", "EUR".
 * No code (null, '', lowercase) — '' (no silent dollar). formatAmount takes its sign here.
 */
export function currencySign(currency: string | null | undefined): string {
  if (currency === 'GEL') return LARI;
  if (currency === 'USD') return '$';
  return typeof currency === 'string' && ISO_CODE.test(currency) ? currency : '';
}

export interface PriceSource {
  /** Minor units; null / undefined — the price is not set. */
  priceMinor: number | null | undefined;
  /** ISO-4217 code as the server sent it; null / undefined — unknown, no sign. */
  currency: string | null | undefined;
  /** "from": the price is a lower bound (B3-G). */
  priceFrom?: boolean | null;
  /** Row address (slug = Service.id) — picks the unit (B2-G). */
  slug?: string | null;
}

/** "от 400 ₾ за 1 мл", "$800", "300". No price — null; zero — "0 ₾" without "от" (K13, F8). */
export function formatPrice(p: PriceSource, lang: Lang = 'ru'): string | null {
  const amount = formatAmount(p.priceMinor, p.currency, lang);
  if (amount === null) return null;
  // "from 0" says nothing true: zero is the price itself, not a lower bound
  const from = p.priceFrom === true && p.priceMinor !== 0 ? `${lang === 'en' ? 'from' : 'от'}${NBSP}` : '';
  const unit = priceUnit(p.slug, lang);
  return unit ? `${from}${amount} ${unit}` : `${from}${amount}`;
}

/**
 * Reference rate — kept for the code that imported it: lari for one dollar.
 * It is now only the FALLBACK; the live rate is `getRate()` (lib/rates.ts).
 */
export const REFERENCE_RATE = { lariPerDollar: FALLBACK_RATE.lariPerDollar } as const;

/**
 * 🔄 ПЕРЕКЛЮЧАТЕЛЬ ВАЛЮТЫ (владелец, 15.10.2026).
 * `displayPrice` — цена в той валюте, которую выбрал человек, с пометкой «≈»,
 * если это пересчёт. Родная цена не теряется: `secondPrice` отдаёт её точной
 * второй строкой («400 ₾»), чтобы человек видел, сколько на самом деле
 * назначено и в чём платить.
 *
 * Пересчёт — только здесь и только для глаз. Сумма визита (`visitTotal`),
 * `priceMinor`, чеки и «оплачено» остаются в родной валюте.
 *
 * Не пересчитываем (показываем родную как есть):
 *   · нет цены, нулевая цена, чужая валюта кроме лари и доллара;
 *   · результат меньше единицы выбранной валюты: «≈ $1» за 1 ₾ = $0.36 это
 *     ложь (K13, F8).
 * Округляем до целых: «≈ $146,12» выглядит как точность, которой нет.
 */
export function convertedMinor(
  minor: number,
  from: string,
  to: 'GEL' | 'USD',
): number | null {
  if (from === to) return minor;
  const r = getRate().lariPerDollar;
  if (from === 'GEL' && to === 'USD') return Math.round(minor / r / 100) * 100;
  if (from === 'USD' && to === 'GEL') return Math.round((minor / 100) * r) * 100;
  return null;
}

/** Цена для показа в выбранной валюте. Родная валюта уже совпала — просто формат. */
export function displayPrice(p: PriceSource, lang: Lang = 'ru'): string | null {
  const mode = getPriceMode();
  if (!isPriceMinor(p.priceMinor) || p.priceMinor === 0 || !p.currency || p.currency === mode) {
    return formatPrice(p, lang);
  }
  const conv = convertedMinor(p.priceMinor, p.currency, mode);
  if (conv === null || conv < 100) return formatPrice(p, lang);
  const amount = formatAmount(conv, mode, lang);
  if (amount === null) return formatPrice(p, lang);
  const from = p.priceFrom === true ? `${lang === 'en' ? 'from' : 'от'}${NBSP}` : '';
  const unit = priceUnit(p.slug, lang);
  const body = `≈${NBSP}${amount}`;
  return unit ? `${from}${body} ${unit}` : `${from}${body}`;
}

/**
 * Вторая строка: РОДНАЯ точная цена, когда показ пересчитан («400 ₾»).
 * Показ уже в родной валюте — второй строки нет. По-прежнему только в
 * каталоге и на экране услуги, в скобках сразу за главной строкой.
 */
export function secondPrice(
  p: Pick<PriceSource, 'priceMinor' | 'currency'>,
  lang: Lang = 'ru',
): string | null {
  const mode = getPriceMode();
  if (!isPriceMinor(p.priceMinor) || p.priceMinor === 0 || !p.currency || p.currency === mode) return null;
  const conv = convertedMinor(p.priceMinor, p.currency, mode);
  if (conv === null || conv < 100) return null; // главная строка и так родная
  return formatAmount(p.priceMinor, p.currency, lang);
}

/**
 * Пояснение к пересчитанной цене — один раз на экран. Называет, в чём
 * платят на самом деле, и по какому курсу пересчитано: курс без даты
 * назван ориентировочным, с датой — курсом Нацбанка Грузии.
 */
export function secondPriceNote(lang: Lang = 'ru'): string {
  const r = getRate();
  const date = r.asOf ? new Date(r.asOf).toLocaleDateString(lang === 'en' ? 'en-GB' : 'ru-RU', { day: 'numeric', month: 'long' }) : null;
  if (lang === 'en') {
    return `Paid in lari. A price marked “≈” is converted at ${r.live && date ? `the National Bank of Georgia rate of ${date}` : 'an approximate rate'}.`;
  }
  return `Оплата в студии — в лари. Цена со знаком «≈» пересчитана ${r.live && date ? `по курсу Нацбанка Грузии на ${date}` : 'по ориентировочному курсу'}.`;
}

/** Прежнее имя — на случай стороннего кода: теперь это функция `secondPriceNote`. */
export const SECOND_PRICE_NOTE: Readonly<Record<Lang, string>> = {
  get ru() { return secondPriceNote('ru'); },
  get en() { return secondPriceNote('en'); },
};

/** The visit summary (K13, H-5): it carries no second price, so the note names only the payment currency. */
export const PAY_NOTE: Readonly<Record<Lang, string>> = {
  ru: 'Оплата — в лари.',
  en: 'Paid in lari.',
};

type PricedService = Pick<Service, 'id' | 'priceMinor' | 'currency' | 'priceFrom'>;

/** A catalog service as a price source (slug = Service.id picks the unit). */
export const priceSourceOf = (s: PricedService): PriceSource =>
  ({ priceMinor: s.priceMinor, currency: s.currency, priceFrom: s.priceFrom, slug: s.id });

/** The price line of a catalog service — the same string on every screen (K5). */
export const servicePrice = (s: PricedService, lang: Lang = 'ru'): string | null =>
  displayPrice(priceSourceOf(s), lang);

/** Родная цена услуги как назначена владелицей — для кабинета и правок. */
export const serviceNativePrice = (s: PricedService, lang: Lang = 'ru'): string | null =>
  formatPrice(priceSourceOf(s), lang);

/** The second price of a catalog service (K11b) — the catalog card and the service screen only. */
export const serviceSecondPrice = (s: PricedService, lang: Lang = 'ru'): string | null =>
  secondPrice(priceSourceOf(s), lang);

/**
 * A visit total from its rows — shown while the visit is being put together; the
 * booked total is the server's (Booking.total_minor). One currency or nothing: the
 * server refuses a mixed visit (api/_domain/pricing.js priceVisit — `currencies.size > 1`
 * → 422 mixed_currency), so the screen never adds lari to dollars either.
 * One row keeps its unit ("от 400 ₾ за 1 мл"). Several rows: no unit, and "from" when
 * any row is "from" or priced per unit — the sum is then a lower bound.
 */
export function visitTotal(rows: ReadonlyArray<PriceSource>): PriceSource | null {
  if (rows.length === 0) return null;
  if (rows.length === 1) return isPriceMinor(rows[0].priceMinor) ? rows[0] : null;
  const currency = rows[0].currency;
  let minor = 0;
  let from = false;
  for (const r of rows) {
    if (!isPriceMinor(r.priceMinor) || r.currency !== currency) return null;
    minor += r.priceMinor;
    if (r.priceFrom === true || priceUnit(r.slug) !== null) from = true;
  }
  return { priceMinor: minor, currency, priceFrom: from };
}

/*
 * Texts for a "from" price — Katya, T2 ed. 2 §4.2 (RU and EN as approved by the
 * lawyer, Yu2). Shown ONLY where the price is "from" (priceFrom === true), never for courses.
 * PENDING the clinic's answer (_work/wave7/J2-вопросы-клинике.md No. 15): if the final
 * price is named after the examination but BEFORE the treatment, §4.2 adds
 * ", до процедуры" / ", before the treatment" — change it here, nowhere else.
 */
/** Caption under a "from" total (booking summary, gallery card). */
export const FROM_NOTE: Readonly<Record<Lang, string>> = {
  ru: 'итог — после осмотра',
  en: 'final price after the examination',
};
/** The sentence on the service screen and the confirmation. */
export const FROM_SENTENCE: Readonly<Record<Lang, string>> = {
  ru: 'Это минимальная цена, итог — после осмотра.',
  en: 'This is the starting price; the final price is set after the examination.',
};
/** The tail of the booking footnote (BookingScreen; §4.2 "Замена BookingScreen.tsx:822"). */
export const FROM_FOOTNOTE: Readonly<Record<Lang, string>> = {
  ru: 'Цена «от» — минимальная: итог — после осмотра.',
  en: 'A “from” price is a minimum: the final price is set after the examination.',
};
