import { randomBytes } from 'node:crypto';

// Формат реферального кода зафиксирован контрактом §4.2 и менять его
// нельзя НИКОГДА. Причина не техническая: ссылка, которой клиентка
// поделилась с подругой, лежит в чужой переписке и переживёт все релизы.
// Смена формата убивает такие ссылки задним числом, и узнают об этом
// только их владелицы — то есть никто.

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
const LENGTH = 6;

/**
 * Шесть символов [A-Za-z0-9] из криптографического генератора.
 *
 * Чего в коде быть не должно (контракт §4.2):
 *  ❌ telegram_id — ссылка показала бы получателю числовой идентификатор
 *     пригласившей. Это утечка, и отозвать её нельзя;
 *  ❌ UUID, base64, хэш — длинный код ломает вид ссылки;
 *  ❌ порядковый номер — выдаёт количество пользователей;
 *  ❌ символы `_` и `-` — они заняты под разделитель, см. buildStartParam.
 */
export function makeReferralCode(): string {
  const bytes = randomBytes(LENGTH);
  let out = '';
  for (const b of bytes) out += ALPHABET[b % ALPHABET.length];
  return out;
}

export const REFERRAL_CODE_RE = /^[A-Za-z0-9]{6}$/;

/**
 * Собирает start_param. Метка приглашения есть ВСЕГДА; цель добавляется
 * к ней, а не вместо неё (контракт §4.4).
 *
 * Разделитель `__` однозначен именно потому, что алфавит кода
 * подчёркивания не содержит.
 */
export function buildStartParam(code: string, target?: string | null): string {
  return target ? `ref_${code}__${target}` : `ref_${code}`;
}

/**
 * Готовая ссылка целиком. Собирает СЕРВЕР (контракт §4.3).
 *
 * Клиент эту строку только показывает и копирует. Сборка на клиенте даёт
 * ссылки без метки и утечку числового идентификатора, а сборка из
 * `window.location.href` подставит служебный адрес сборки вместо адреса
 * бота. Адрес бота и имя приложения — из окружения (§4.8): бот после
 * переноса на общую платформу остаётся тем же, значит все розданные за
 * время теста ссылки продолжат работать.
 */
export function buildReferralLink(
  code: string,
  botUsername: string,
  appShortname: string,
  target?: string | null,
): string {
  return `https://t.me/${botUsername}/${appShortname}?startapp=${buildStartParam(code, target)}`;
}

export interface ParsedStartParam {
  refCode: string | null;
  target: string | null;
}

/** Разбор параметра на входе (контракт §4.5). */
export function parseStartParam(startParam: string | null | undefined): ParsedStartParam {
  if (!startParam || !startParam.startsWith('ref_')) return { refCode: null, target: null };
  const [code, target] = startParam.slice(4).split('__');
  // Мусор в параметре не должен уходить в запрос к базе как код.
  if (!code || !REFERRAL_CODE_RE.test(code)) return { refCode: null, target: target ?? null };
  return { refCode: code, target: target ?? null };
}
