// Pure rules of the button «Получать ответ в Telegram» (КТ-7 Start 1b): no imports, so the
// smoke specs import the same values the app uses (like WRITE_ACCESS_TIMEOUT_MS in telegram.ts).

/**
 * Telegram said «allowed», but the read of Me right after it did not show
 * can_message === true: the webhook may lag (a cold function, Neon waking up). Me is read
 * again after each of these pauses while the flag is not true — ~12 s in total (Хейтер H-2,
 * Цензор Ц-4). A failed read is not a refusal: the schedule goes on.
 */
export const RECHECK_DELAYS_MS: readonly number[] = [3_000, 4_000, 5_000];

/** The only form of `Me.bot_link` the server builds (api/_domain/tg.js botLink, LINK_PART_RE). */
const BOT_LINK_RE = /^https:\/\/t\.me\/[A-Za-z0-9_]{3,64}\?start=notify$/;

/**
 * `Me.bot_link` the client may open, or null (007 m-2). The server already builds only
 * https://t.me/<bot>?start=notify or null; the client keeps a second line of defence and
 * treats anything else as «no link» (the Start hint without a link).
 */
export const safeBotLink = (link: unknown): string | null =>
  typeof link === 'string' && BOT_LINK_RE.test(link) ? link : null;
