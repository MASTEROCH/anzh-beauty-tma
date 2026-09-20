import type { FastifyInstance } from 'fastify';
import { requireRole, requireSession } from '../app.ts';
import { sql } from '../db.ts';
import { invalid, notFound } from '../errors.ts';
import { priceVisit } from '../services/pricing.ts';

// Прайс правится из кабинета мастера — отдельной админки нет
// (контракт §2.1). Поэтому здесь и витрина, и редактирование.

interface ServiceOut {
  slug: string;
  kind: string;
  category: string;
  zone: string;
  title: { ru: string; en: string };
  subtitle: { ru: string | null; en: string | null };
  description: { ru: string | null; en: string | null };
  price_minor: number | null;
  currency: string | null;
  price_from: boolean;
  stars_amount: number | null;
  duration_min: number | null;
  days: number | null;
  includes: unknown;
  contraindications: unknown;
  photo_url: string | null;
  sort: number;
}

interface ServiceRow {
  slug: string; kind: string; category: string; zone: string;
  title_ru: string; title_en: string;
  subtitle_ru: string | null; subtitle_en: string | null;
  description_ru: string | null; description_en: string | null;
  price_minor: number | null; currency: string | null; price_from: boolean;
  stars_amount: number | null; duration_min: number | null; days: number | null;
  includes: unknown; contraindications: unknown;
  photo_url: string | null; sort: number;
}

const shape = (r: ServiceRow): ServiceOut => ({
  slug: r.slug,
  kind: r.kind,
  category: r.category,
  zone: r.zone,
  title: { ru: r.title_ru, en: r.title_en },
  subtitle: { ru: r.subtitle_ru, en: r.subtitle_en },
  description: { ru: r.description_ru, en: r.description_en },
  price_minor: r.price_minor,
  currency: r.currency,
  price_from: r.price_from,
  stars_amount: r.stars_amount,
  duration_min: r.duration_min,
  days: r.days,
  includes: r.includes,
  contraindications: r.contraindications,
  photo_url: r.photo_url,
  sort: r.sort,
});

const KINDS = ['procedure', 'training', 'analysis'];

const COLUMNS = () => sql`
  slug, kind, category, zone, title_ru, title_en, subtitle_ru, subtitle_en,
  description_ru, description_en, price_minor, currency, price_from,
  stars_amount, duration_min, days, includes, contraindications,
  photo_url, sort
`;

export async function registerCatalog(app: FastifyInstance): Promise<void> {
  /**
   * GET /api/v1/services
   *
   * Витрина. Открыта без сессии: каталог публичен, его видно и до входа.
   */
  app.get('/services', async (req) => {
    const { kind } = req.query as { kind?: string };
    // Неизвестный kind отдавал пустой список — то есть выглядел как
    // «процедур нет», хотя на деле это опечатка в запросе. Молчаливый
    // пустой ответ на неверный параметр ищут в данных, а не в коде.
    if (kind && !KINDS.includes(kind)) {
      throw invalid(`Неизвестный вид: ${kind}. Допустимы: ${KINDS.join(', ')}`, 'bad_kind');
    }
    const rows = await sql<ServiceRow[]>`
      select ${COLUMNS()} from anzh.services
      where archived_at is null and deleted_at is null
        ${kind ? sql`and kind = ${kind}` : sql``}
      order by sort, slug
    `;
    return { services: rows.map(shape) };
  });

  app.get('/services/:slug', async (req) => {
    const { slug } = req.params as { slug: string };
    const rows = await sql<ServiceRow[]>`
      select ${COLUMNS()} from anzh.services
      where slug = ${slug} and deleted_at is null
    `;
    const row = rows[0];
    if (!row) throw notFound('unknown_service', 'Такой процедуры нет');
    return { service: shape(row) };
  });

  /**
   * POST /api/v1/services/quote
   *
   * Сколько выйдет визит из этих процедур. Нужен ДО создания заявки:
   * клиентка должна видеть итог со скидкой, и он должен совпасть с тем,
   * что запишется. Одна и та же функция считает оба раза — расхождение
   * между «показали» и «записали» невозможно по построению.
   */
  app.post('/services/quote', async (req) => {
    const s = requireSession(req);
    const body = (req.body ?? {}) as { slugs?: unknown };
    if (!Array.isArray(body.slugs) || body.slugs.some((x) => typeof x !== 'string')) {
      throw invalid('Нужен список slugs', 'bad_slugs');
    }
    const priced = await priceVisit(s.telegram_id, body.slugs as string[]);
    return { quote: priced };
  });

  // ─── Редактирование: только владелица ─────────────────────────────

  interface ServicePatch {
    title_ru?: string; title_en?: string;
    subtitle_ru?: string | null; subtitle_en?: string | null;
    description_ru?: string | null; description_en?: string | null;
    price_minor?: number | null; currency?: string | null;
    price_from?: boolean;
    stars_amount?: number | null;
    duration_min?: number | null; days?: number | null;
    includes?: unknown[]; contraindications?: unknown[];
    photo_url?: string | null; sort?: number;
  }

  app.patch('/services/:slug', async (req) => {
    requireRole(req, 'owner');
    const { slug } = req.params as { slug: string };
    const patch = (req.body ?? {}) as ServicePatch;

    if (patch.price_minor != null && (!Number.isInteger(patch.price_minor) || patch.price_minor < 0)) {
      // Деньги — целое в минорных единицах. Дробное число здесь означает,
      // что где-то на пути цену поделили на 100 (контракт §5.3).
      throw invalid('Цена — целое число в минорных единицах (4500 = 45.00)', 'bad_price');
    }
    if (patch.currency != null && !/^[A-Z]{3}$/.test(patch.currency)) {
      throw invalid('Валюта — три заглавные буквы по ISO-4217', 'bad_currency');
    }

    // Обновляем ТОЛЬКО присланные поля. Различать «не прислали» и
    // «прислали null» обязательно: подзаголовок можно осмысленно
    // стереть, и `coalesce(значение, колонка)` такую правку молча
    // проглотил бы, оставив старый текст.
    const EDITABLE = [
      'title_ru', 'title_en', 'subtitle_ru', 'subtitle_en',
      'description_ru', 'description_en', 'price_minor', 'currency',
      'price_from', 'stars_amount', 'duration_min', 'days',
      'includes', 'contraindications', 'photo_url', 'sort',
    ] as const;

    const changes: Record<string, unknown> = {};
    for (const key of EDITABLE) {
      if (patch[key] !== undefined) {
        changes[key] =
          key === 'includes' || key === 'contraindications'
            ? sql.json(patch[key] as never)
            : patch[key];
      }
    }
    const keys = Object.keys(changes);
    if (keys.length === 0) throw invalid('Нечего менять', 'empty_patch');

    const rows = await sql<ServiceRow[]>`
      update anzh.services set ${sql(changes, ...keys)}
      where slug = ${slug} and deleted_at is null
      returning ${COLUMNS()}
    `;
    const row = rows[0];
    if (!row) throw notFound('unknown_service', 'Такой процедуры нет');
    return { service: shape(row) };
  });

  /**
   * DELETE /api/v1/services/:slug — снятие с витрины, НЕ удаление.
   *
   * Мягкое (контракт §2.2): процедура остаётся в истории визитов.
   * Жёсткое удаление сломало бы карточки прошлых клиенток, у которых эта
   * процедура была.
   */
  app.delete('/services/:slug', async (req) => {
    requireRole(req, 'owner');
    const { slug } = req.params as { slug: string };
    const rows = await sql<{ slug: string }[]>`
      update anzh.services set archived_at = now()
      where slug = ${slug} and archived_at is null and deleted_at is null
      returning slug
    `;
    if (!rows[0]) throw notFound('unknown_service', 'Такой процедуры нет или она уже снята');
    return { archived: rows[0].slug };
  });

  app.post('/services/:slug/restore', async (req) => {
    requireRole(req, 'owner');
    const { slug } = req.params as { slug: string };
    const rows = await sql<{ slug: string }[]>`
      update anzh.services set archived_at = null
      where slug = ${slug} and deleted_at is null
      returning slug
    `;
    if (!rows[0]) throw notFound('unknown_service', 'Такой процедуры нет');
    return { restored: rows[0].slug };
  });
}
