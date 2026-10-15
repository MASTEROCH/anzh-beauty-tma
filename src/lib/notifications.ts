// Уведомления, о которых приложение говорит человеку.
//
// Правило одно: экран обещает ТОЛЬКО то, что сервер действительно шлёт
// (решение John 24.09; план 11b, M10). На запуск это:
//   · клиентке — напоминание за 24 часа (client_24h);
//   · мастеру  — напоминание за 30 минут (master_30min);
//   · плюс сразу — «новая заявка» владелице/мастеру и «подтверждено /
//     отклонено» клиентке (это ответы на действие, а не расписание).
//
// Раньше здесь было семь пунктов по голосовым Анжелики: утром в день
// визита, post-care, «как результат» через 2 недели, бонус за отзыв с
// фото, «пора повторить», акции. Сервер ничего из этого не шлёт: нет
// часа «утра», нет текстов ухода, нет механики бонусов. Показывать их —
// обещать сообщения, которые не придут. Вернутся, когда владелица назовёт
// час и тексты, — и тогда расписание будет присылать сервер
// (GET /bookings/{id} → schedule), а не собирать экран.
//
// Сразу, как ответ на действие, клиентке уходит и «запись отменена», если
// мастер отменил уже подтверждённую запись (booking_cancelled, решение John
// перед волной 2) — это не расписание и не переключатель.
//
// Язык этих сообщений — язык интерфейса: сервер хранит его в
// `Me.language_code`, приложение шлёт его при смене языка (ниже).

import type { Lang } from './i18n';
import { sessionState } from './session';
import { currentMe, updateMe } from './api';

export type NotifKind = 'client_24h' | 'master_30min';

/* ── Язык уведомлений бота ── */

export type LangSync = 'synced' | 'same' | 'guest' | 'failed';

let syncing: { lang: Lang; p: Promise<LangSync> } | null = null;

/**
 * Язык уведомлений бота = язык интерфейса: PATCH /me {language_code}
 * (решение John перед волной 2). Не бросает — экран сам говорит, что не
 * сохранилось. Гость — синхронизировать нечего; тот же язык, что уже на
 * сервере, — без запроса; повторный вызов с тем же языком, пока первый идёт,
 * — то же обещание (два переключателя языка — один запрос).
 */
export function syncNotificationLanguage(lang: Lang): Promise<LangSync> {
  if (syncing && syncing.lang === lang) return syncing.p;
  const p = (async (): Promise<LangSync> => {
    if (sessionState().status !== 'user') return 'guest';
    if (currentMe()?.language_code === lang) return 'same';
    try {
      await updateMe({ language_code: lang });
      return 'synced';
    } catch {
      return 'failed';
    }
  })().finally(() => { if (syncing?.p === p) syncing = null; });
  syncing = { lang, p };
  return p;
}

/** Название языка уведомлений для строки в настройках. Неизвестный код — как есть. */
export function botLangName(code: string | null | undefined, ui: Lang): string {
  if (code === 'ru') return ui === 'ru' ? 'русском' : 'Russian';
  if (code === 'en') return ui === 'ru' ? 'английском' : 'English';
  return code ? code : (ui === 'ru' ? 'языке Telegram' : 'your Telegram language');
}

/** Что клиентке придёт от бота — для строки в настройках.
    `pref` — какой переключатель сервера (`Me.notifications`, PATCH /me)
    включает и выключает эту строку. */
export const NOTIF_ROWS: Array<{
  kind: NotifKind;
  pref: 'reminders';
  label: { ru: string; en: string };
  sub: { ru: string; en: string };
}> = [
  {
    kind: 'client_24h',
    pref: 'reminders',
    label: { ru: 'Напоминание за 24 часа', en: 'Reminder 24h before' },
    sub: { ru: 'Сообщение от бота в Telegram', en: 'A message from the bot in Telegram' },
  },
];

/* ── Что и когда уходит по конкретной записи ── */

export interface ScheduledNote {
  kind: NotifKind;
  when: string;
  text: string;
  to: 'client' | 'master';
}

/** Расписание сообщений вокруг визита — показываем клиенту, чтобы не гадал.
 *
 *  Название процедуры в текст НЕ подставляется: в самом уведомлении его нет
 *  (в шаблонах только время и «визит к Анжелике» — медданные и названия
 *  чувствительных процедур в сообщения не попадают), и экран не должен
 *  обещать другое. Параметр оставлен ради совместимости вызова. */
export function timelineFor(_serviceTitle: string): ScheduledNote[] {
  return [
    { kind: 'client_24h',   when: 'За 24 часа',  to: 'client', text: 'Напомню о визите к Анжелике и его времени' },
    { kind: 'master_30min', when: 'За 30 минут', to: 'master', text: 'Анжелике: напоминание о следующем визите' },
  ];
}
