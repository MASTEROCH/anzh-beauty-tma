import type { FastifyInstance } from 'fastify';
import { requireSession } from '../app.ts';
import { invalid, tooMany } from '../errors.ts';
import { hit } from '../lib/rateLimit.ts';
import { signIn } from '../services/auth.ts';
import { sql } from '../db.ts';
import { config } from '../config.ts';
import { buildReferralLink } from '../lib/referral.ts';

interface SignInBody {
  init_data?: unknown;
}

export async function registerAuth(app: FastifyInstance): Promise<void> {
  /**
   * POST /api/v1/auth/telegram
   *
   * Единственный вход. Принимает сырой initData, возвращает сессию и
   * профиль вместе с ГОТОВОЙ реферальной ссылкой (контракт §4.3).
   */
  app.post('/auth/telegram', async (req, reply) => {
    // Подбор подписи стоит перебора; ограничиваем по адресу (§12).
    const verdict = hit(`auth:${req.ip}`, 20, 60);
    if (!verdict.allowed) {
      reply.header('Retry-After', String(verdict.retryAfterSec));
      throw tooMany();
    }

    const body = (req.body ?? {}) as SignInBody;
    if (typeof body.init_data !== 'string' || body.init_data.length === 0) {
      throw invalid('Нужна строка init_data из Telegram');
    }

    const result = await signIn(body.init_data);
    reply.code(200).send(result);
  });

  /**
   * GET /api/v1/me
   *
   * Кто я сейчас. Роль отдаётся ИЗ БАЗЫ, а не из токена: мастера могли
   * добавить после того, как человек вошёл, и заставлять его выходить
   * ради этого незачем.
   */
  app.get('/me', async (req) => {
    const s = requireSession(req);

    const rows = await sql<
      {
        telegram_id: number;
        first_name: string | null;
        last_name: string | null;
        username: string | null;
        referral_code: string;
        notify_reminders: boolean;
        notify_review: boolean;
        notify_marketing: boolean;
      }[]
    >`
      select telegram_id, first_name, last_name, username, referral_code,
             notify_reminders, notify_review, notify_marketing
      from anzh.users
      where telegram_id = ${s.telegram_id} and deleted_at is null
    `;
    const row = rows[0];
    if (!row) throw invalid('Профиль не найден, войдите заново', 'no_profile');

    const staff = await sql<{ role: 'staff' | 'owner'; name: string }[]>`
      select role, name from anzh.staff
      where telegram_id = ${s.telegram_id} and active and deleted_at is null
    `;

    const invited = await sql<{ n: number }[]>`
      select count(*)::int as n from anzh.referrals
      where referrer_id = ${s.telegram_id} and app_source = ${config.appSource}
    `;

    return {
      user: {
        telegram_id: row.telegram_id,
        first_name: row.first_name,
        last_name: row.last_name,
        username: row.username,
        role: staff[0]?.role ?? 'client',
        staff_name: staff[0]?.name ?? null,
        referral_code: row.referral_code,
        referral_link: buildReferralLink(
          row.referral_code,
          config.botUsername,
          config.appShortname,
        ),
        invited_count: invited[0]?.n ?? 0,
        notifications: {
          reminders: row.notify_reminders,
          review: row.notify_review,
          marketing: row.notify_marketing,
        },
      },
    };
  });
}
