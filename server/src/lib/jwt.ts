import { createHmac, timingSafeEqual } from 'node:crypto';

// JWT HS256 на node:crypto, без библиотеки. Тридцать строк против пакета
// с собственной историей уязвимостей — и здесь видно каждое решение:
// алгоритм не читается из заголовка (классическая дыра «alg: none»),
// срок проверяется всегда, app_source сверяется как обязательное поле.

export interface SessionClaims {
  telegram_id: number;
  /** Токен, выписанный для другого приложения, это не должен открывать. */
  app_source: string;
  role: 'client' | 'staff' | 'owner';
}

interface Payload extends SessionClaims {
  iat: number;
  exp: number;
}

const HEADER = base64url(Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })));

function base64url(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64url(s: string): Buffer {
  return Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
}

function sign(data: string, secret: string): string {
  return base64url(createHmac('sha256', secret).update(data).digest());
}

export function issueToken(claims: SessionClaims, secret: string, ttlDays: number): string {
  const now = Math.floor(Date.now() / 1000);
  const payload: Payload = {
    ...claims,
    iat: now,
    exp: now + Math.round(ttlDays * 86400),
  };
  const body = `${HEADER}.${base64url(Buffer.from(JSON.stringify(payload)))}`;
  return `${body}.${sign(body, secret)}`;
}

export type TokenFailure = 'malformed' | 'bad_signature' | 'expired' | 'wrong_app';

export type TokenResult =
  | { ok: true; claims: SessionClaims; expiresAt: Date }
  | { ok: false; reason: TokenFailure };

export function verifyToken(token: string, secret: string, appSource: string): TokenResult {
  if (typeof token !== 'string') return { ok: false, reason: 'malformed' };
  const parts = token.split('.');
  if (parts.length !== 3) return { ok: false, reason: 'malformed' };
  const [head, body, mac] = parts as [string, string, string];

  // 🚨 Алгоритм берём свой, а не из заголовка токена. Доверие полю alg —
  // это подпись, которую подбирает тот, кто прислал токен.
  if (head !== HEADER) return { ok: false, reason: 'malformed' };

  const expected = Buffer.from(sign(`${head}.${body}`, secret));
  const received = Buffer.from(mac);
  if (received.length !== expected.length || !timingSafeEqual(received, expected)) {
    return { ok: false, reason: 'bad_signature' };
  }

  let payload: Payload;
  try {
    payload = JSON.parse(fromBase64url(body).toString('utf8')) as Payload;
  } catch {
    return { ok: false, reason: 'malformed' };
  }

  if (
    typeof payload.telegram_id !== 'number' ||
    !Number.isFinite(payload.telegram_id) ||
    typeof payload.exp !== 'number' ||
    (payload.role !== 'client' && payload.role !== 'staff' && payload.role !== 'owner')
  ) {
    return { ok: false, reason: 'malformed' };
  }

  if (Math.floor(Date.now() / 1000) >= payload.exp) {
    return { ok: false, reason: 'expired' };
  }

  // Контракт §3.3: app_source обязателен и сверяется при каждом запросе.
  if (payload.app_source !== appSource) {
    return { ok: false, reason: 'wrong_app' };
  }

  return {
    ok: true,
    claims: {
      telegram_id: payload.telegram_id,
      app_source: payload.app_source,
      role: payload.role,
    },
    expiresAt: new Date(payload.exp * 1000),
  };
}
