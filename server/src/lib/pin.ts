import { randomBytes, scrypt as scryptCb, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCb) as (
  password: string,
  salt: Buffer,
  keylen: number,
) => Promise<Buffer>;

// PIN мастера — ВТОРОЙ фактор, а не источник прав (контракт §3.4).
// Право даёт telegram_id из таблицы мастеров; PIN только подтверждает,
// что за телефоном тот же человек. Поэтому короткий код здесь допустим,
// а вот хранить его открытым — нет.
//
// scrypt из node:crypto вместо bcrypt/argon2: те приходят пакетами с
// нативной сборкой, которая ломается при смене версии Node на хостинге.
// Параметры ниже дают то же сопротивление перебору.

const N = 16384; // 2^14 — около 100 мс на подбор одного варианта
const R = 8;
const P = 1;
const KEYLEN = 32;
const SALT_LEN = 16;

/** Формат хранения: scrypt$N$r$p$соль_hex$хэш_hex */
export async function hashPin(pin: string): Promise<string> {
  const salt = randomBytes(SALT_LEN);
  const key = await scrypt(pin, salt, KEYLEN);
  return `scrypt$${N}$${R}$${P}$${salt.toString('hex')}$${key.toString('hex')}`;
}

export async function verifyPin(pin: string, stored: string | null): Promise<boolean> {
  if (!stored) return false;

  const parts = stored.split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
  const [, , , , saltHex, keyHex] = parts as [string, string, string, string, string, string];

  let salt: Buffer;
  let expected: Buffer;
  try {
    salt = Buffer.from(saltHex, 'hex');
    expected = Buffer.from(keyHex, 'hex');
  } catch {
    return false;
  }
  if (salt.length !== SALT_LEN || expected.length !== KEYLEN) return false;

  const actual = await scrypt(pin, salt, KEYLEN);
  return timingSafeEqual(actual, expected);
}
