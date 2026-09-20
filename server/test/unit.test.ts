// Тесты того, что проверяет личность. База здесь не нужна: initData, JWT
// и формат реферального кода — чистые функции, и именно на них держится
// ответ на вопрос «кто ты». Контрактные тесты эндпоинтов — отдельно,
// им нужна живая схема.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';

import { verifyInitData } from '../src/lib/initData.ts';
import { issueToken, verifyToken } from '../src/lib/jwt.ts';
import {
  buildReferralLink,
  buildStartParam,
  makeReferralCode,
  parseStartParam,
  REFERRAL_CODE_RE,
} from '../src/lib/referral.ts';

const TOKEN = '123456:TEST-BOT-TOKEN-NOT-A-REAL-ONE';
const SECRET = 'x'.repeat(48);

/** Собирает подписанный initData так же, как это делает Telegram. */
function makeInitData(
  fields: Record<string, string>,
  botToken = TOKEN,
): string {
  const pairs = Object.entries(fields)
    .map(([k, v]) => `${k}=${v}`)
    .sort();
  const secretKey = createHmac('sha256', 'WebAppData').update(botToken).digest();
  const hash = createHmac('sha256', secretKey).update(pairs.join('\n')).digest('hex');
  const qs = new URLSearchParams(fields);
  qs.set('hash', hash);
  return qs.toString();
}

const nowSec = () => Math.floor(Date.now() / 1000);
const user = (id = 777001) => JSON.stringify({ id, first_name: 'Тест', username: 'test' });

// ─── initData ──────────────────────────────────────────────────────

test('initData: верная подпись принимается, поля разбираются', () => {
  const raw = makeInitData({
    user: user(),
    auth_date: String(nowSec()),
    start_param: 'ref_a7Kp2X__service-peeling',
  });
  const res = verifyInitData(raw, TOKEN, 3600);
  assert.equal(res.ok, true);
  assert.ok(res.ok);
  assert.equal(res.data.user.id, 777001);
  assert.equal(res.data.user.first_name, 'Тест');
  assert.equal(res.data.startParam, 'ref_a7Kp2X__service-peeling');
});

test('initData: чужой токен бота — подпись не проходит', () => {
  const raw = makeInitData({ user: user(), auth_date: String(nowSec()) }, '999:OTHER');
  const res = verifyInitData(raw, TOKEN, 3600);
  assert.deepEqual(res, { ok: false, reason: 'bad_signature' });
});

test('initData: изменённое поле ломает подпись', () => {
  const raw = makeInitData({ user: user(), auth_date: String(nowSec()) });
  // Подменяем идентификатор, оставляя чужой hash — ровно то, что сделал
  // бы человек, решивший войти под другим номером.
  const tampered = raw.replace('777001', '777002');
  const res = verifyInitData(tampered, TOKEN, 3600);
  assert.deepEqual(res, { ok: false, reason: 'bad_signature' });
});

test('initData: старше часа отклоняется', () => {
  const raw = makeInitData({ user: user(), auth_date: String(nowSec() - 3601) });
  const res = verifyInitData(raw, TOKEN, 3600);
  assert.deepEqual(res, { ok: false, reason: 'expired' });
});

test('initData: подпись верна, но auth_date из будущего — не принимаем', () => {
  const raw = makeInitData({ user: user(), auth_date: String(nowSec() + 4000) });
  const res = verifyInitData(raw, TOKEN, 3600);
  assert.deepEqual(res, { ok: false, reason: 'expired' });
});

test('initData: поле signature в data_check_string не участвует', () => {
  // Новые версии Telegram добавляют signature. Если не исключить его из
  // строки проверки, подпись перестаёт сходиться у всех, кто обновился.
  const fields = { user: user(), auth_date: String(nowSec()) };
  const raw = makeInitData(fields);
  const qs = new URLSearchParams(raw);
  qs.set('signature', 'whatever-ed25519-blob');
  const res = verifyInitData(qs.toString(), TOKEN, 3600);
  assert.equal(res.ok, true);
});

test('initData: пустая строка и мусор не проходят', () => {
  assert.equal(verifyInitData('', TOKEN, 3600).ok, false);
  assert.equal(verifyInitData('hash=zz', TOKEN, 3600).ok, false);
  // hash нечётной длины: Buffer.from(hex) раньше молча усекал.
  assert.equal(verifyInitData('user=x&auth_date=1&hash=abc', TOKEN, 3600).ok, false);
});

test('initData: подпись верна, но user отсутствует', () => {
  const raw = makeInitData({ auth_date: String(nowSec()) });
  assert.deepEqual(verifyInitData(raw, TOKEN, 3600), { ok: false, reason: 'malformed' });
});

// ─── JWT ───────────────────────────────────────────────────────────

test('JWT: выписанный токен читается обратно', () => {
  const token = issueToken(
    { telegram_id: 777001, app_source: 'beauty', role: 'client' },
    SECRET,
    7,
  );
  const res = verifyToken(token, SECRET, 'beauty');
  assert.ok(res.ok);
  assert.equal(res.claims.telegram_id, 777001);
  assert.equal(res.claims.role, 'client');
});

test('JWT: чужой ключ подписи не принимается', () => {
  const token = issueToken({ telegram_id: 1, app_source: 'beauty', role: 'owner' }, SECRET, 7);
  assert.deepEqual(verifyToken(token, 'y'.repeat(48), 'beauty'), {
    ok: false,
    reason: 'bad_signature',
  });
});

test('JWT: токен другого приложения не открывает это', () => {
  const token = issueToken({ telegram_id: 1, app_source: 'other', role: 'client' }, SECRET, 7);
  assert.deepEqual(verifyToken(token, SECRET, 'beauty'), { ok: false, reason: 'wrong_app' });
});

test('JWT: alg=none не принимается', () => {
  // Классическая дыра: заголовок с alg "none" и пустой подписью.
  const head = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(
    JSON.stringify({
      telegram_id: 1,
      app_source: 'beauty',
      role: 'owner',
      exp: nowSec() + 999,
    }),
  ).toString('base64url');
  assert.deepEqual(verifyToken(`${head}.${body}.`, SECRET, 'beauty'), {
    ok: false,
    reason: 'malformed',
  });
});

test('JWT: подменённая роль ломает подпись', () => {
  const token = issueToken({ telegram_id: 1, app_source: 'beauty', role: 'client' }, SECRET, 7);
  const [head, body, mac] = token.split('.') as [string, string, string];
  const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as Record<
    string,
    unknown
  >;
  payload.role = 'owner';
  const forged = Buffer.from(JSON.stringify(payload)).toString('base64url');
  assert.deepEqual(verifyToken(`${head}.${forged}.${mac}`, SECRET, 'beauty'), {
    ok: false,
    reason: 'bad_signature',
  });
});

test('JWT: истёкший токен отклоняется', () => {
  const token = issueToken(
    { telegram_id: 1, app_source: 'beauty', role: 'client' },
    SECRET,
    -1 / 24, // час назад
  );
  assert.deepEqual(verifyToken(token, SECRET, 'beauty'), { ok: false, reason: 'expired' });
});

// ─── Реферальный код ───────────────────────────────────────────────

test('код: ровно 6 символов из [A-Za-z0-9], без _ и -', () => {
  for (let i = 0; i < 2000; i++) {
    const code = makeReferralCode();
    assert.match(code, REFERRAL_CODE_RE, `негодный код: ${code}`);
  }
});

test('код: разные вызовы дают разные коды', () => {
  const seen = new Set<string>();
  for (let i = 0; i < 2000; i++) seen.add(makeReferralCode());
  // 62^6 ≈ 5.7e10 — на двух тысячах совпадений быть не должно.
  assert.equal(seen.size, 2000);
});

test('ссылку собирает сервер, метка есть всегда', () => {
  assert.equal(
    buildReferralLink('a7Kp2X', 'anzh_bot', 'beauty'),
    'https://t.me/anzh_bot/beauty?startapp=ref_a7Kp2X',
  );
  // Цель добавляется К метке, а не вместо неё (контракт §4.4).
  assert.equal(
    buildReferralLink('a7Kp2X', 'anzh_bot', 'beauty', 'service-peeling'),
    'https://t.me/anzh_bot/beauty?startapp=ref_a7Kp2X__service-peeling',
  );
  assert.equal(buildStartParam('a7Kp2X'), 'ref_a7Kp2X');
});

test('разбор start_param: код, код с целью, мусор', () => {
  assert.deepEqual(parseStartParam('ref_a7Kp2X'), { refCode: 'a7Kp2X', target: null });
  assert.deepEqual(parseStartParam('ref_a7Kp2X__service-peeling'), {
    refCode: 'a7Kp2X',
    target: 'service-peeling',
  });
  assert.deepEqual(parseStartParam(null), { refCode: null, target: null });
  assert.deepEqual(parseStartParam('service-peeling'), { refCode: null, target: null });
  // Код неверной длины в запрос к базе не уходит.
  assert.equal(parseStartParam('ref_short').refCode, null);
  assert.equal(parseStartParam("ref_a'--;X").refCode, null);
});

test('код никогда не содержит telegram_id', () => {
  // Смысловая проверка формата: алфавит без разделителей и фиксированная
  // длина делают подстановку числового идентификатора невозможной.
  const id = '123456789';
  for (let i = 0; i < 500; i++) {
    assert.equal(makeReferralCode().includes(id), false);
  }
  assert.equal(buildStartParam('a7Kp2X').includes(id), false);
});
