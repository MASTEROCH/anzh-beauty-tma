import { createHmac, timingSafeEqual } from 'node:crypto';

// Проверка initData — на сервере, и только на сервере (контракт §3.2,
// §12). Клиент не может быть источником ответа на вопрос «кто ты»:
// initDataUnsafe читается и подделывается в консоли браузера за секунду.
//
// Ровно пять шагов из контракта:
//  1. разобрать в пары, вынуть hash;
//  2. остальные пары отсортировать по ключу и склеить key=value через \n;
//  3. secret_key = HMAC_SHA256(key="WebAppData", message=<токен бота>);
//  4. HMAC_SHA256(key=secret_key, message=строка) сравнить с hash
//     через timingSafeEqual, НЕ через ===;
//  5. отклонить, если auth_date старше часа.

export interface TelegramUser {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  photo_url?: string;
  is_premium?: boolean;
}

export interface VerifiedInitData {
  user: TelegramUser;
  authDate: Date;
  /** Параметр из ссылки: ref_<код> либо ref_<код>__<цель> */
  startParam: string | null;
  queryId: string | null;
}

export type InitDataFailure =
  | 'malformed'      // не разбирается, нет hash или user
  | 'bad_signature'  // подпись не сошлась
  | 'expired';       // auth_date старше допустимого

export type InitDataResult =
  | { ok: true; data: VerifiedInitData }
  | { ok: false; reason: InitDataFailure };

export function verifyInitData(
  initData: string,
  botToken: string,
  maxAgeSec: number,
  now: Date = new Date(),
): InitDataResult {
  if (typeof initData !== 'string' || initData.length === 0) {
    return { ok: false, reason: 'malformed' };
  }

  // URLSearchParams сам декодирует проценты — это важно: подпись
  // считается по ДЕКОДИРОВАННЫМ значениям.
  let params: URLSearchParams;
  try {
    params = new URLSearchParams(initData);
  } catch {
    return { ok: false, reason: 'malformed' };
  }

  const hash = params.get('hash');
  if (!hash) return { ok: false, reason: 'malformed' };

  const pairs: string[] = [];
  for (const [key, value] of params) {
    if (key === 'hash') continue;
    // signature появляется в новых версиях Telegram и в data_check_string
    // не участвует. Оставленный в строке, он ломает подпись у всех, кто
    // обновил приложение, — и выглядит это как «перестало работать само».
    if (key === 'signature') continue;
    pairs.push(`${key}=${value}`);
  }
  pairs.sort();
  const dataCheckString = pairs.join('\n');

  const secretKey = createHmac('sha256', 'WebAppData').update(botToken).digest();
  const expected = createHmac('sha256', secretKey).update(dataCheckString).digest();

  let received: Buffer;
  try {
    received = Buffer.from(hash, 'hex');
  } catch {
    return { ok: false, reason: 'bad_signature' };
  }
  // timingSafeEqual падает на буферах разной длины — а разная длина это
  // уже «не сошлось», и падение здесь было бы 500 вместо 401.
  if (received.length !== expected.length || !timingSafeEqual(received, expected)) {
    return { ok: false, reason: 'bad_signature' };
  }

  const authDateRaw = params.get('auth_date');
  const authSec = Number(authDateRaw);
  if (!authDateRaw || !Number.isFinite(authSec)) {
    return { ok: false, reason: 'malformed' };
  }
  const ageSec = Math.floor(now.getTime() / 1000) - authSec;
  // Отрицательный возраст — часы клиента убежали вперёд. Небольшой запас
  // допустим, заметный перекос считаем негодной подписью.
  if (ageSec > maxAgeSec || ageSec < -300) {
    return { ok: false, reason: 'expired' };
  }

  const userRaw = params.get('user');
  if (!userRaw) return { ok: false, reason: 'malformed' };
  let user: TelegramUser;
  try {
    user = JSON.parse(userRaw) as TelegramUser;
  } catch {
    return { ok: false, reason: 'malformed' };
  }
  if (typeof user?.id !== 'number' || !Number.isFinite(user.id)) {
    return { ok: false, reason: 'malformed' };
  }

  return {
    ok: true,
    data: {
      user,
      authDate: new Date(authSec * 1000),
      startParam: params.get('start_param'),
      queryId: params.get('query_id'),
    },
  };
}
