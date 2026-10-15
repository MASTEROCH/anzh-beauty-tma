// Showcase rule: which catalog row a client sees — the `live` expression.
//
// ONE expression for every reader (finding m2-1, part K1 of wave 7):
//   · the screen — lib/catalog.ts: fromServer() lets through only isShowable(),
//     the showcase list drops HIDDEN_FROM_SHOWCASE on top; together that is isLive();
//   · the tools that count visible rows (K4: tools/catalog-apply.mjs and its
//     --live-count mode; J3 live check) load THIS file by type stripping, the way
//     tools/catalog-import.mjs:60-71 loads data/services.ts.
// Hence: NO imports (not even `import type`), NO enum, nothing type stripping
// cannot erase. Input is a row in wire form (GET /services, server/openapi.yaml
// schemas/Service) — the same object shape() in api/_domain/catalog.js returns.
//
// Rules (owner's decisions 06.10.2026, "1-a"):
//   · B1-B — every price carries its own currency: the showcase shows GEL and USD,
//     the main price never converted (the “≈” second one is display-only, K11b).
//     Any other code (the server accepts any ISO-4217, catalog.js:160) or no code at
//     all — the row is not shown: there is no sign to print for it;
//   · B4-A — a row without a length is hidden: a procedure needs minutes (without
//     them the server will not book it — 422 incomplete_service, pricing.js:95);
//     a course may have days instead (courses are not booked — 422 not_bookable);
//   · no price — hidden (the same incomplete_service); price 0 is a price, null is not;
//   · "Dermatologist appointment" stays hidden until the lawyer answers (below).

export type ShowcaseCurrency = 'GEL' | 'USD';
export type ShowcaseKind = 'procedure' | 'training';
export type ShowcaseCategory = 'inj' | 'clean' | 'peel' | 'apparatus' | 'care' | 'derma' | 'brows' | 'training';

export const SHOWCASE_CURRENCIES: readonly ShowcaseCurrency[] = ['GEL', 'USD'];
export const SHOWCASE_KINDS: readonly ShowcaseKind[] = ['procedure', 'training'];
export const SHOWCASE_CATEGORIES: readonly ShowcaseCategory[] = [
  'inj', 'clean', 'peel', 'apparatus', 'care', 'derma', 'brows', 'training',
];

/**
 * Not on the showcase even when the server sends it.
 *
 * "Dermatologist appointment" promises a diagnosis and a treatment plan — medical
 * practice; whether the app may offer it waits for the lawyer (Zakonnik, question 4;
 * report F-1 of wave 0). Until then it is hidden from the showcase and from booking;
 * the data is not deleted. Moved here from data/services.ts (K1).
 */
export const HIDDEN_FROM_SHOWCASE: ReadonlySet<string> = new Set(['dermatology']);

export const isOnShowcase = (slug: string): boolean => !HIDDEN_FROM_SHOWCASE.has(slug);

/** A price: integer minor units, 0 or more. null / undefined / fractions — no price. */
export const isPriceMinor = (v: unknown): v is number =>
  typeof v === 'number' && Number.isInteger(v) && v >= 0;

export const isShowcaseCurrency = (v: unknown): v is ShowcaseCurrency =>
  (SHOWCASE_CURRENCIES as readonly unknown[]).includes(v);

/** A length (minutes or days) — a finite number above zero; anything else is null. */
export const positiveOrNull = (v: unknown): number | null =>
  typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : null;

/** What the rule reads from a row (wire form). Every field may be missing. */
export interface ShowcaseInput {
  slug?: unknown;
  kind?: unknown;
  category?: unknown;
  title?: { ru?: unknown } | null;
  price_minor?: unknown;
  currency?: unknown;
  duration_min?: unknown;
  days?: unknown;
}

/** What a row that passed isShowable() is known to have. */
export interface ShowableRow {
  slug: string;
  kind: ShowcaseKind;
  category: ShowcaseCategory;
  title: { ru: string };
  price_minor: number;
  currency: ShowcaseCurrency;
}

/** B4-A: a procedure has minutes; a course has minutes or days. */
export function hasLength(x: ShowcaseInput): boolean {
  if (positiveOrNull(x.duration_min) !== null) return true;
  return x.kind === 'training' && positiveOrNull(x.days) !== null;
}

/**
 * The row is a well-formed showcase row: a procedure or a course of a known
 * category, with a title, a price in GEL or USD and a length. It does NOT look at
 * HIDDEN_FROM_SHOWCASE: a hidden row is still known to the app (history, reports).
 */
export function isShowable<T extends ShowcaseInput>(x: T): x is T & ShowableRow {
  if (!x || typeof x !== 'object') return false;
  if (typeof x.slug !== 'string' || x.slug.length === 0) return false;
  if (!(SHOWCASE_KINDS as readonly unknown[]).includes(x.kind)) return false;
  if (!(SHOWCASE_CATEGORIES as readonly unknown[]).includes(x.category)) return false;
  const titleRu = x.title?.ru;
  if (typeof titleRu !== 'string' || titleRu.length === 0) return false;
  if (!isPriceMinor(x.price_minor)) return false;
  if (!isShowcaseCurrency(x.currency)) return false;
  return hasLength(x);
}

/** The `live` expression: the client sees this row on the showcase. */
export function isLive(x: ShowcaseInput): boolean {
  return isShowable(x) && isOnShowcase(x.slug);
}
