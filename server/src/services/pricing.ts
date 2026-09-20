import type { Sql, TransactionSql } from 'postgres';
import { sql as rootSql } from '../db.ts';
import { invalid } from '../errors.ts';

// Итог визита считает СЕРВЕР из своих данных (контракт §7.4). Клиент
// присылает состав визита, а не сумму — иначе сумму можно переписать
// в запросе.
//
// Округление: все деньги — целое в минорных единицах, скидка считается
// один раз от суммы всего визита и округляется вниз. Построчное
// округление даёт расхождение с чеком на 1–2 копейки, и сходится оно
// никогда.

/** 10% за задание, максимум 30% (SPEC §3.8, контракт §4.7). */
export const PERCENT_PER_QUEST = 10;
export const MAX_DISCOUNT_PERCENT = 30;

type Db = Sql | TransactionSql;

export interface PricedItem {
  service_id: string;
  slug: string;
  title_ru: string;
  title_en: string;
  price_minor: number;
  currency: string;
  duration_min: number;
}

export interface VisitPrice {
  items: PricedItem[];
  subtotal_minor: number;
  discount_percent: number;
  discount_minor: number;
  total_minor: number;
  currency: string;
  duration_min: number;
}

/**
 * Сколько процентов скидки заработано. Считается из подтверждённых
 * заданий, а не хранится числом: перезаписываемый процент объяснить
 * нечем, а по строкам оснований видно, откуда он взялся.
 */
export async function discountPercentFor(telegramId: number, db: Db = rootSql): Promise<number> {
  const rows = await db<{ total: number }[]>`
    select coalesce(sum(percent), 0)::int as total
    from anzh.quest_completions
    where telegram_id = ${telegramId} and confirmed_at is not null
  `;
  return Math.min(rows[0]?.total ?? 0, MAX_DISCOUNT_PERCENT);
}

interface ServiceRow {
  id: string;
  slug: string;
  title_ru: string;
  title_en: string;
  price_minor: number | null;
  currency: string | null;
  duration_min: number | null;
}

/**
 * Считает визит по списку slug'ов. Берёт цены и длительность ИЗ БАЗЫ на
 * момент расчёта — прайс мог измениться с тех пор, как клиентка открыла
 * экран.
 */
export async function priceVisit(
  telegramId: number,
  slugs: string[],
  db: Db = rootSql,
): Promise<VisitPrice> {
  if (slugs.length === 0) throw invalid('Нужна хотя бы одна процедура', 'empty_visit');
  // Порядок в наборе значения не имеет, а дубли — ошибка ввода, не повод
  // посчитать процедуру дважды.
  const unique = [...new Set(slugs)];
  if (unique.length > 6) throw invalid('Больше шести процедур за визит не записываем', 'too_many');

  const rows = await db<ServiceRow[]>`
    select id, slug, title_ru, title_en, price_minor, currency, duration_min
    from anzh.services
    where slug = any(${unique}) and archived_at is null and deleted_at is null
  `;

  if (rows.length !== unique.length) {
    const found = new Set(rows.map((r) => r.slug));
    const missing = unique.filter((s) => !found.has(s));
    throw invalid(`Нет таких процедур: ${missing.join(', ')}`, 'unknown_service');
  }

  const items: PricedItem[] = [];
  for (const r of rows) {
    if (r.price_minor === null || r.currency === null || r.duration_min === null) {
      // Процедура без цены или длительности в визит не ставится: иначе
      // клиентка увидит итог, который не совпадёт с чеком.
      throw invalid(`У процедуры «${r.title_ru}» не заполнены цена или длительность`, 'incomplete_service');
    }
    items.push({
      service_id: r.id,
      slug: r.slug,
      title_ru: r.title_ru,
      title_en: r.title_en,
      price_minor: r.price_minor,
      currency: r.currency,
      duration_min: r.duration_min,
    });
  }

  // Смешанные валюты в одном визите сложить нельзя — и не надо молча
  // складывать «как будто одинаковые».
  const currencies = new Set(items.map((i) => i.currency));
  if (currencies.size > 1) {
    throw invalid('В одном визите процедуры в разных валютах', 'mixed_currency');
  }
  const currency = items[0]!.currency;

  const subtotal = items.reduce((sum, i) => sum + i.price_minor, 0);
  const percent = await discountPercentFor(telegramId, db);
  const discount = Math.floor((subtotal * percent) / 100);

  return {
    items,
    subtotal_minor: subtotal,
    discount_percent: percent,
    discount_minor: discount,
    total_minor: subtotal - discount,
    currency,
    duration_min: items.reduce((sum, i) => sum + i.duration_min, 0),
  };
}
