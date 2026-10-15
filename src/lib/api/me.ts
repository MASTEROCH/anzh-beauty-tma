// Провод «я сам»: профиль, согласия, выгрузка, удаление.
// План 11-arch-plan.md §4; согласия — по решению John перед волной 2
// (_work/17-wave2-decisions.md, «Согласия»): версия у каждого текста своя.
//
// ОБРАЗЕЦ ДЛЯ ДОМЕННЫХ ФАЙЛОВ `src/lib/api/<домен>.ts`. Правила папки:
//   · здесь только ТИПЫ ПРОВОДА (имена полей как у сервера, snake_case) и
//     тонкие функции «один вызов — одна ручка»; ни состояния, ни React;
//   · в сеть — только через `apiRequest` из `../session` (своего fetch нет);
//   · поле, которое сервер может не прислать, — необязательное в типе
//     (умение «необязательное поле честнее обязательного»): новые поля
//     §4 ещё пишутся, и старый сервер их не отдаёт;
//   · перевод в форму экрана (camelCase, валюта, даты) — у владельца экрана,
//     не здесь.

import { ApiError, apiRequest } from '../session';
import { getLang, type Lang } from '../i18n';

export type Role = 'client' | 'staff' | 'owner';

export type ConsentKind = 'policy' | 'health_data' | 'photo_publish' | 'marketing';

/**
 * Правовые тексты с версией (`public/legal/*.html`, мета `legal-version`).
 * Сервер держит реестр `{kind, file, version, sha256}` и отдаёт ТЕКУЩУЮ
 * версию каждого в `Me.legal` (решение John перед волной 2, «Согласия»).
 */
export type LegalKind = 'policy' | 'health_data' | 'terms' | 'refunds';

export interface NotificationPrefs {
  reminders?: boolean;
  review?: boolean;
  marketing?: boolean;
}

/** GET /me → `{user: Me}`; тот же объект приходит в ответе POST /auth/telegram. */
export interface Me {
  telegram_id: number;
  first_name: string | null;
  last_name?: string | null;
  username?: string | null;
  role: Role;
  staff_name?: string | null;
  referral_code?: string;
  /** Готовая строка. Клиент её только показывает; пусто — «Поделиться» недоступна. */
  referral_link?: string;
  invited_count?: number;
  notifications?: NotificationPrefs;
  // ── добавлено планом §4 (новый сервер) ──
  instagram?: string | null;
  phone?: string | null;
  /** Язык уведомлений бота (PATCH /me {language_code}). Может быть и не ru/en — из Telegram. */
  language_code?: string | null;
  can_message?: boolean;
  /**
   * The chat with the bot (`…?start=notify`) for the Start hint while `can_message` is
   * false (КТ-7 С1). A ready string built by the server from its env (contract §4.8): the
   * client only opens it, never builds it or keeps a bot name of its own. `null` — no link.
   */
  bot_link?: string | null;
  /**
   * Действующее согласие ТЕКУЩЕЙ версии текста по каждому виду. Согласие на
   * прежнюю редакцию здесь — `false`: вид экрана «согласие есть / нет»
   * читается отсюда, а не из того, что человек когда-то нажимал.
   */
  consents?: Partial<Record<ConsentKind, boolean>>;
  /** Текущие версии текстов; их и только их шлёт `grantConsent`. Прежнего
   *  общего `policy_version` (провод волны 1) больше нет — только `legal`. */
  legal?: Partial<Record<LegalKind, string>>;
  /**
   * Флаги функций от сервера (openapi `Me.features`). Выключенный флаг →
   * вход в функцию прячется. Имя флага анкеты — `health` (решение John
   * после волны 0; `health_form` из 11b Д6 не используется).
   * Флаг, которого сервер не прислал, читается как ВЫКЛЮЧЕННЫЙ: экран
   * сравнивает `=== true`, а не «не false».
   */
  features?: { stars?: boolean; health?: boolean };
}

/** PATCH /me — только то, что меняется. `null` стирает instagram и phone. */
export interface MePatch {
  first_name?: string;
  instagram?: string | null;
  phone?: string | null;
  /** Только ru | en (openapi MePatch): язык интерфейса = язык уведомлений бота. */
  language_code?: Lang;
  notifications?: NotificationPrefs;
}

/** POST /me/consents → 200 `{consent}`. Повтор той же версии — та же строка. */
export interface ConsentRecord {
  kind: ConsentKind;
  version: string;
  lang: string;
  granted_at: string;
}

/** Код 409: версия, которую человек видел, уже не текущая для этого вида. */
export const VERSION_MISMATCH = 'version_mismatch';

export function isVersionMismatch(e: unknown): boolean {
  return e instanceof ApiError && e.status === 409 && e.code === VERSION_MISMATCH;
}

/** Текущая версия текста или `null` — сервер её не назвал (текст не заведён). */
export function legalVersion(me: Me | null | undefined, kind: LegalKind): string | null {
  const v = me?.legal?.[kind];
  return typeof v === 'string' && v.length > 0 ? v : null;
}

/**
 * Есть ли согласие ТЕКУЩЕЙ версии. `=== true`: поле, которого сервер не
 * прислал, — «согласия нет», а не «наверное, есть».
 */
export function hasConsent(me: Me | null | undefined, kind: ConsentKind): boolean {
  return me?.consents?.[kind] === true;
}

/** GET /me/export — всё, что сервер знает о человеке. Состав разделов — сервера. */
export interface MeExport {
  generated_at: string;
  [section: string]: unknown;
}

// ── Вызовы ──────────────────────────────────────────────────────────────────

/** GET /me — роль и флаги считаются сервером на КАЖДЫЙ вызов, не берутся из токена. */
export async function getMe(signal?: AbortSignal): Promise<Me> {
  const r = await apiRequest<{ user: Me }>('GET', '/me', { signal });
  return r.user;
}

/**
 * 1. PATCH /me → `{user}` — то же имя, что у GET /me (openapi; решение John
 * после волны 0, в плане 11 было `{me}`). Ответ без `user` — поломка стыка,
 * а не пустой профиль: бросаем, иначе экран положил бы в состояние `undefined`.
 */
export async function patchMe(patch: MePatch): Promise<Me> {
  const r = await apiRequest<{ user?: Me }>('PATCH', '/me', { body: patch });
  if (!r || typeof r.user !== 'object' || r.user === null) {
    throw new ApiError(200, 'bad_response', 'PATCH /me: в ответе нет user');
  }
  return r.user;
}

/**
 * POST /me/consents `{kind, version, lang}`. Версию присылает клиент ту,
 * которую человек ВИДЕЛ (`Me.legal[kind]`), язык — язык интерфейса, на
 * котором он её видел. Не текущая для вида → 409 `version_mismatch`: экран
 * перечитывает `Me.legal` и показывает свежий текст, а не повторяет молча.
 * Сервер сам пишет `text_sha256` по своему реестру. Идемпотентен по природе
 * (тот же вид и версия — та же строка), поэтому ключ идемпотентности не нужен.
 *
 * `lang` в теле есть ВСЕГДА — по умолчанию текущий язык интерфейса.
 */
export async function grantConsent(kind: ConsentKind, version: string, lang: Lang = getLang()): Promise<ConsentRecord> {
  const r = await apiRequest<{ consent?: ConsentRecord }>('POST', '/me/consents', {
    body: { kind, version, lang },
  });
  if (!r || typeof r.consent !== 'object' || r.consent === null) {
    throw new ApiError(200, 'bad_response', 'POST /me/consents: в ответе нет consent');
  }
  return r.consent;
}

/**
 * DELETE /me/consents/{kind} → `{revoked:true, health_wiped}`. Отзыв
 * `health_data` ФИЗИЧЕСКИ стирает анкету и разборы на сервере.
 * Согласие с политикой отдельно не отзывается (только удалением аккаунта) —
 * поэтому `policy` здесь не принимается и на уровне типа.
 */
export function revokeConsent(kind: Exclude<ConsentKind, 'policy'>): Promise<{ revoked: boolean; health_wiped: boolean }> {
  return apiRequest('DELETE', `/me/consents/${encodeURIComponent(kind)}`);
}

/** 2. GET /me/export. Ограничение сервера — 5 раз в час (429 `rate_limited`). */
export async function exportMe(): Promise<MeExport> {
  const r = await apiRequest<{ export: MeExport }>('GET', '/me/export', { timeoutMs: 30_000 });
  return r.export;
}

/**
 * 3. DELETE /me. Необратимо: ПДн стёрты, согласия отозваны, анкета стёрта,
 * будущие записи отменены. Слово `DELETE` в теле — защита от случайного
 * вызова, а не подтверждение человека: окно подтверждения — на экране.
 */
export function deleteMe(): Promise<{ deleted: boolean }> {
  return apiRequest('DELETE', '/me', { body: { confirm: 'DELETE' } });
}
