// Texts of the button «Получать ответ в Telegram» and of the lines that depend on whether
// the bot can message the client (КТ-7 С2). Source: Т1 Кати 06.10.2026
// (`_work/wave7/Т1-Катя-тексты-Start.md`) with the corrections of Законник Ю1
// (`_work/wave7/Ю1-Законник-тексты-Start.md`, as relayed by John 06.10).
//
// Every key is one row of Т1 (the section is named on the key). A later wording change
// replaces the VALUES one for one: the screens and tests/smoke/f6-write-access.spec.ts read
// the texts from here, so it touches this file only.
//
// Rules for every text (Т1): only messages about bookings (marketing is a separate
// consent); no «ошибка» / «не удалось» / «не получилось» when Telegram refused or kept
// silent; no bot name — the link comes ready from the server (`Me.bot_link`) or there is none.

import type { Lang } from './i18n';

type Text = Readonly<Record<Lang, string>>;

/**
 * Т1 columns: «pending» — the booking waits for the master (Ж); «decided» — any other
 * status, AND the settings, where there is no booking (Р).
 */
export type WriteAccessContext = 'pending' | 'decided';

/** Can the bot message the client: `Me.can_message` true / false / not sent by the server. */
export type CanKey = 'yes' | 'no' | 'unknown';

export const canKeyOf = (canMessage: unknown): CanKey =>
  canMessage === true ? 'yes' : canMessage === false ? 'no' : 'unknown';

/** Т1 §1 (the block, six states and 6а) and §2 / §5 (the Start hint). */
export const WRITE_ACCESS_COPY = {
  /** §1 state 2 «offer» — the line above the button. */
  offerLine: {
    pending: { ru: 'Разреши боту писать тебе — и ответ Анжелики придёт в Telegram.', en: 'Allow the bot to message you, and Anjelika’s reply will arrive in Telegram.' },
    decided: { ru: 'Разреши боту писать тебе — и сообщения о записях будут приходить в Telegram.', en: 'Allow the bot to message you, and booking messages will arrive in Telegram.' },
  },
  /** §1 state 2 «offer» — the button. At a decided booking and in the settings — no «answer» (поправки 05, С2). */
  button: {
    pending: { ru: 'Получать ответ в Telegram', en: 'Get the reply in Telegram' },
    decided: { ru: 'Получать сообщения о записях в Telegram', en: 'Get booking messages in Telegram' },
  },
  /** §1 state 3 «waiting» — the label of the inactive button. */
  waiting: { ru: 'Жду ответ Telegram…', en: 'Waiting for Telegram…' },
  /** §1 state 4 «no answer» — followed by the Start hint. */
  timeout: { ru: 'Telegram пока не ответил.', en: 'Telegram hasn’t answered yet.' },
  /** §1 state 5 «refused, or the flag did not rise» — followed by the Start hint. */
  refused: { ru: 'Бот пока не может писать тебе.', en: 'The bot can’t message you yet.' },
  /** «Unconfirmed» (Start 1b, John 06.10): «allowed», but the last re-read of Me failed — followed by the Start hint. */
  unconfirmed: {
    ru: 'Telegram разрешил, но мы пока не видим, что бот может писать тебе.',
    en: 'Telegram allowed it, but we can’t yet see that the bot can message you.',
  },
  /** §1 state 6 «done» — after offer → press → the flag rose. */
  ready: {
    pending: { ru: 'Бот может писать тебе: когда Анжелика ответит на заявку, он напишет в Telegram.', en: 'The bot can message you: when Anjelika replies to your request, it will write in Telegram.' },
    decided: { ru: 'Бот может писать тебе: следующие сообщения о записях придут в Telegram.', en: 'The bot can message you: your next booking messages will arrive in Telegram.' },
  },
  /** §1 state 6а «done» after 1, 4 or 5 (a late answer of Telegram, or back from the bot chat). */
  readyNow: {
    pending: { ru: 'Теперь бот может писать тебе: когда Анжелика ответит на заявку, он напишет в Telegram.', en: 'The bot can now message you: when Anjelika replies to your request, it will write in Telegram.' },
    decided: { ru: 'Теперь бот может писать тебе: следующие сообщения о записях придут в Telegram.', en: 'The bot can now message you: your next booking messages will arrive in Telegram.' },
  },
  /** §1, note to 6а — a toast: the block may be off the screen. */
  readyNowToast: { ru: 'Теперь бот может писать тебе', en: 'The bot can now message you' },
  /** §2 «`bot_link` есть» (= §5 `COPY.startBot`) — states 1, 4, 5. Законник Ю1, п.1. */
  startBot: {
    ru: 'Нажми Start в чате с ботом — после этого бот сможет присылать тебе сообщения о записях.',
    en: 'Press Start in the bot chat — after that, the bot can send you messages about your bookings.',
  },
  /** §2 «`bot_link === null`» (= §5 `COPY.startBotNoLink`) — no bot name, no link. Законник Ю1, п.1. */
  startBotNoLink: {
    ru: 'Найди в Telegram чат с ботом этого приложения и нажми Start — после этого бот сможет присылать тебе сообщения о записях.',
    en: 'Find this app’s bot chat in Telegram and press Start — after that, the bot can send you messages about your bookings.',
  },
  /** §2 the link (= §5 `COPY.startBotOpen`): opens `Me.bot_link`. */
  startBotOpen: { ru: 'Открыть чат с ботом', en: 'Open the bot chat' },
} as const satisfies {
  offerLine: Record<WriteAccessContext, Text>;
  button: Record<WriteAccessContext, Text>;
  waiting: Text;
  timeout: Text;
  refused: Text;
  unconfirmed: Text;
  ready: Record<WriteAccessContext, Text>;
  readyNow: Record<WriteAccessContext, Text>;
  readyNowToast: Text;
  startBot: Text;
  startBotNoLink: Text;
  startBotOpen: Text;
};

/**
 * Т1 §3 and §4 — lines of the request screen by «booking status × can_message».
 * Status comes from the same GET /bookings/{id} answer as the list
 * (lib/appointments.ts ScheduleState.bookingStatus): pending = «pending», anything else = «decided».
 */
export const SCHEDULE_COPY = {
  /**
   * §3 — the line under the list when the server’s list of what the bot will send is
   * empty (NotificationSchedule, both variants; was ConfirmScreen.tsx:45).
   */
  empty: {
    pending: {
      yes: { ru: 'Когда Анжелика ответит, бот напишет тебе в Telegram.', en: 'When Anjelika replies, the bot will message you in Telegram.' },
      no: { ru: 'Пока бот не может писать тебе, ответ по заявке смотри в кабинете.', en: 'While the bot can’t message you, check the answer to your request in your account.' },
      unknown: { ru: 'Ответ по заявке появится в кабинете.', en: 'The answer to your request will show in your account.' },
    },
    decided: {
      // Законник Ю1, п.2 (shown in the timeline too)
      yes: { ru: 'Запланированных сообщений по этой записи нет.', en: 'There are no scheduled messages for this booking.' },
      no: { ru: 'Пока бот не может писать тебе, сообщений по этой записи не будет.', en: 'While the bot can’t message you, there won’t be messages about this booking.' },
      unknown: { ru: 'Статус записи — в кабинете.', en: 'The booking status is in your account.' },
    },
  },
  /** §4 — the footer of the request screen (was ConfirmScreen.tsx:197), one line per status for all three can_message. The 💛 stays outside. */
  footer: {
    pending: { ru: 'Если время не подойдёт — нажми «Написать»: перенесём одним сообщением', en: 'If the time doesn’t work — tap “Message” and we’ll move it in one message' },
    decided: { ru: 'Остались вопросы по записи — нажми «Написать»', en: 'Questions about your booking? Tap “Message”' },
  },
} as const satisfies {
  empty: Record<WriteAccessContext, Record<CanKey, Text>>;
  footer: Record<WriteAccessContext, Text>;
};
