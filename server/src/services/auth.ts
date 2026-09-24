import { sql } from '../db.ts';
import { config } from '../config.ts';
import { verifyInitData, type VerifiedInitData } from '../lib/initData.ts';
import { issueToken, type SessionClaims } from '../lib/jwt.ts';
import {
  buildReferralLink,
  makeReferralCode,
  parseStartParam,
} from '../lib/referral.ts';
import { unauthorized } from '../errors.ts';

export interface SignInResult {
  token: string;
  user: {
    telegram_id: number;
    first_name: string | null;
    last_name: string | null;
    username: string | null;
    role: SessionClaims['role'];
    referral_code: string;
    /** Готовая строка. Клиент её только показывает и копирует (§4.3). */
    referral_link: string;
  };
  /** Куда открыть приложение, если в ссылке была цель (§4.4). */
  target: string | null;
}

/** Роль берётся с сервера по telegram_id, а не из запроса (контракт §3.3). */
async function roleOf(telegramId: number): Promise<SessionClaims['role']> {
  const rows = await sql<{ role: 'staff' | 'owner' }[]>`
    select role from anzh.staff
    where telegram_id = ${telegramId} and active and deleted_at is null
  `;
  return rows[0]?.role ?? 'client';
}

interface UserRow {
  telegram_id: number;
  referral_code: string;
  referred_by: number | null;
  first_name: string | null;
  last_name: string | null;
  username: string | null;
}

/**
 * Заводит или обновляет профиль. Код выдаётся один раз при первом входе
 * и не меняется никогда (контракт §4.2) — поэтому в ветке обновления
 * referral_code не трогается.
 */
async function upsertUser(tg: VerifiedInitData['user']): Promise<UserRow> {
  // Коллизия шести символов из 62 маловероятна, но проверяется уникальным
  // индексом; при конфликте перегенерируем (контракт §4.2).
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = makeReferralCode();
    try {
      const rows = await sql<UserRow[]>`
        insert into anzh.users (
          telegram_id, referral_code,
          first_name, last_name, username, language_code, photo_url
        ) values (
          ${tg.id}, ${code},
          ${tg.first_name ?? null}, ${tg.last_name ?? null}, ${tg.username ?? null},
          ${tg.language_code ?? null}, ${tg.photo_url ?? null}
        )
        on conflict (telegram_id) do update set
          -- Профиль обновляется: человек меняет имя и ник, мастеру нужно
          -- видеть актуальное. referral_code в этот список НЕ входит.
          first_name    = excluded.first_name,
          last_name     = excluded.last_name,
          username      = excluded.username,
          language_code = excluded.language_code,
          photo_url     = excluded.photo_url
        returning telegram_id, referral_code, referred_by, first_name, last_name, username
      `;
      const row = rows[0];
      if (row) return row;
    } catch (err) {
      // 23505 — нарушение уникальности. Здесь это может быть только
      // referral_code: конфликт по telegram_id обработан выше через
      // on conflict.
      if ((err as { code?: string }).code === '23505' && attempt < 4) continue;
      throw err;
    }
  }
  throw new Error('Не удалось выдать уникальный реферальный код за пять попыток');
}

/**
 * Привязка приглашения. Пишется при ПЕРВОМ появлении параметра и больше
 * не трогается (контракт §4.5): Telegram иногда теряет start_param при
 * переоткрытии приложения, а попытка «восстановить» привязку позже из
 * других источников даёт ложные приглашения.
 */
async function bindReferral(referredId: number, refCode: string | null): Promise<void> {
  if (!refCode) return;

  const owner = await sql<{ telegram_id: number }[]>`
    select telegram_id from anzh.users
    where referral_code = ${refCode} and deleted_at is null
  `;
  const referrerId = owner[0]?.telegram_id;
  if (referrerId === undefined) return;

  // Правило 2: самоприглашение запрещено. Проверяется явно, хотя есть и
  // ограничение в базе — так в журнале не появится лишнего исключения.
  if (referrerId === referredId) return;

  await sql.begin(async (tx) => {
    // Правило 1: одна привязка на человека навсегда. Повторный вход по
    // другой ссылке ничего не меняет — do nothing, а не do update.
    const inserted = await tx<{ id: string }[]>`
      insert into anzh.referrals (referrer_id, referred_id, app_source)
      values (${referrerId}, ${referredId}, ${config.appSource})
      on conflict (referred_id, app_source) do nothing
      returning id
    `;
    const referralId = inserted[0]?.id;
    if (!referralId) return;

    // Отметка о первом появлении человека в экосистеме. Ставится один
    // раз: при переносе в общую базу она НЕ перезаписывается (§14.1).
    await tx`
      update anzh.users set referred_by = ${referrerId}
      where telegram_id = ${referredId} and referred_by is null
    `;

    /* ⚠️ Начисление процентов за приглашение УБРАНО.

       Контракт §4.7 предписывал засчитывать приглашение как задание со
       скидкой. Владелица правило изменила (24.09.2026): скидку дают
       только отзыв и отметка в сторис, по 5%, вместе 10%.

       Сама привязка выше пишется по-прежнему — реферальная программа
       (§4.1–4.6) работает полностью, формат кода и ссылки не тронуты.
       Открытый вопрос к владелице: чем награждать приглашение теперь.
       Пока — ничем, и это записано здесь, а не додумано за неё. */
  });
}

export async function signIn(initDataRaw: string): Promise<SignInResult> {
  const verified = verifyInitData(
    initDataRaw,
    config.botToken,
    config.initDataMaxAgeSec,
  );

  if (!verified.ok) {
    // Наружу — одна причина на все три случая. Подробность здесь
    // помогает только тому, кто подбирает подпись.
    throw unauthorized('bad_init_data', 'Не удалось подтвердить вход из Telegram');
  }

  const { user: tg, startParam } = verified.data;
  const { refCode, target } = parseStartParam(startParam);

  const row = await upsertUser(tg);
  await bindReferral(row.telegram_id, refCode);

  const role = await roleOf(row.telegram_id);
  const token = issueToken(
    { telegram_id: row.telegram_id, app_source: config.appSource, role },
    config.jwtSecret,
    config.jwtTtlDays,
  );

  return {
    token,
    user: {
      telegram_id: row.telegram_id,
      first_name: row.first_name,
      last_name: row.last_name,
      username: row.username,
      role,
      referral_code: row.referral_code,
      referral_link: buildReferralLink(
        row.referral_code,
        config.botUsername,
        config.appShortname,
      ),
    },
    target,
  };
}
