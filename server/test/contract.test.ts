// Контрактные тесты (контракт §14): на каждый эндпоинт — успешный
// ответ, отказ без сессии, отказ с чужой ролью. Плюс то, что нельзя
// проверить глазами: гонка за слот, идемпотентность, запрещённые
// переходы статуса.

import { test, before, beforeEach, after, describe } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { resetRateLimits } from '../src/lib/rateLimit.ts';
import {
  startHarness,
  futureSlot,
  CLIENT_ID,
  OTHER_CLIENT_ID,
  OWNER_ID,
  STAFF_ID,
  type Harness,
} from './harness.ts';

let h: Harness;
let clientToken: string;
let otherToken: string;
let staffToken: string;
let ownerToken: string;

before(async () => {
  h = await startHarness();
  clientToken = await h.signIn(CLIENT_ID);
  otherToken = await h.signIn(OTHER_CLIENT_ID);
  staffToken = await h.signIn(STAFF_ID);
  ownerToken = await h.signIn(OWNER_ID);
});

// Счётчики частоты общие на процесс, и прогон целиком выбирает лимит
// живого человека за минуты — 11-я заявка подряд получала 429, и падал
// тест про чужую запись, к частоте отношения не имеющий. Ограничение
// при этом верное: чинится прогон, а не лимит. Проверяется он отдельно,
// ниже в этом файле.
beforeEach(() => {
  resetRateLimits();
});

after(async () => {
  await h.stop();
});

const auth = (token?: string) => (token ? { authorization: `Bearer ${token}` } : {});

const call = (
  method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE',
  url: string,
  opts: { token?: string; payload?: unknown; headers?: Record<string, string> } = {},
) =>
  h.app.inject({
    method,
    url: `/api/v1${url}`,
    headers: { ...auth(opts.token), ...(opts.headers ?? {}) },
    ...(opts.payload !== undefined ? { payload: opts.payload as object } : {}),
  });

// ─── Здоровье и вход ───────────────────────────────────────────────

describe('здоровье', () => {
  test('отвечает и видит базу', async () => {
    const res = await call('GET', '/health');
    assert.equal(res.statusCode, 200);
    assert.equal(res.json().database, 'ok');
  });

  test('живость отвечает без обращения к базе', async () => {
    const res = await call('GET', '/health/live');
    assert.equal(res.statusCode, 200);
  });
});

describe('вход', () => {
  test('успех: сессия и ГОТОВАЯ реферальная ссылка', async () => {
    const res = await call('POST', '/auth/telegram', {
      payload: { init_data: h.initData(910001) },
    });
    assert.equal(res.statusCode, 200);
    const body = res.json() as {
      token: string;
      user: { referral_code: string; referral_link: string; role: string };
    };
    assert.match(body.user.referral_code, /^[A-Za-z0-9]{6}$/);
    // Ссылку собирает сервер целиком (контракт §4.3).
    assert.equal(
      body.user.referral_link,
      `https://t.me/anzh_test_bot/beauty?startapp=ref_${body.user.referral_code}`,
    );
    // Числового идентификатора в ссылке быть не может.
    assert.equal(body.user.referral_link.includes('910001'), false);
    assert.equal(body.user.role, 'client');
  });

  test('отказ: подделанный initData', async () => {
    const res = await call('POST', '/auth/telegram', {
      payload: { init_data: 'user=%7B%22id%22%3A1%7D&auth_date=1&hash=deadbeef' },
    });
    assert.equal(res.statusCode, 401);
    assert.equal(res.json().error.code, 'bad_init_data');
  });

  test('отказ: без init_data — 422', async () => {
    const res = await call('POST', '/auth/telegram', { payload: {} });
    assert.equal(res.statusCode, 422);
  });

  test('код не меняется при повторном входе', async () => {
    const first = await call('POST', '/auth/telegram', {
      payload: { init_data: h.initData(910002) },
    });
    const second = await call('POST', '/auth/telegram', {
      payload: { init_data: h.initData(910002) },
    });
    assert.equal(
      first.json().user.referral_code,
      second.json().user.referral_code,
    );
  });

  test('роль владелицы приходит с сервера, а не из запроса', async () => {
    const res = await call('GET', '/me', { token: ownerToken });
    assert.equal(res.statusCode, 200);
    assert.equal(res.json().user.role, 'owner');
  });

  test('отказ: /me без сессии', async () => {
    assert.equal((await call('GET', '/me')).statusCode, 401);
  });
});

// ─── Рефералы ──────────────────────────────────────────────────────

describe('рефералы', () => {
  test('привязка по ссылке пишется, а процентов за неё нет', async () => {
    const inviter = await call('POST', '/auth/telegram', {
      payload: { init_data: h.initData(920001) },
    });
    const code = inviter.json().user.referral_code as string;

    await call('POST', '/auth/telegram', {
      payload: { init_data: h.initData(920002, `ref_${code}`) },
    });

    const rows = await h.sql`
      select referrer_id, referred_id from anzh.referrals where referred_id = 920002
    `;
    assert.equal(rows.length, 1);
    assert.equal(rows[0]!.referrer_id, 920001);

    /* Скидки за приглашение БОЛЬШЕ НЕТ — решение владелицы 24.09.2026.
       Привязка при этом обязана писаться по-прежнему: реферальная
       программа работает, награда за неё — открытый вопрос. Проверяем
       именно это разделение, иначе «убрали скидку» незаметно
       превратится в «сломали рефералов». */
    const quests = await h.sql`
      select kind, percent from anzh.quest_completions where telegram_id = 920001
    `;
    assert.equal(quests.length, 0, 'приглашение не начисляет процентов');
  });

  test('повторный вход по ДРУГОЙ ссылке ничего не меняет', async () => {
    const second = await call('POST', '/auth/telegram', {
      payload: { init_data: h.initData(920003) },
    });
    const otherCode = second.json().user.referral_code as string;

    await call('POST', '/auth/telegram', {
      payload: { init_data: h.initData(920002, `ref_${otherCode}`) },
    });

    const rows = await h.sql`
      select referrer_id from anzh.referrals where referred_id = 920002
    `;
    assert.equal(rows.length, 1);
    assert.equal(rows[0]!.referrer_id, 920001, 'привязка должна остаться первой');
  });

  test('самоприглашение не записывается', async () => {
    const me = await call('POST', '/auth/telegram', {
      payload: { init_data: h.initData(920010) },
    });
    const myCode = me.json().user.referral_code as string;
    await call('POST', '/auth/telegram', {
      payload: { init_data: h.initData(920010, `ref_${myCode}`) },
    });
    const rows = await h.sql`select 1 from anzh.referrals where referred_id = 920010`;
    assert.equal(rows.length, 0);
  });

  test('несуществующий код не ломает вход', async () => {
    const res = await call('POST', '/auth/telegram', {
      payload: { init_data: h.initData(920020, 'ref_ZZZZZZ') },
    });
    assert.equal(res.statusCode, 200);
  });
});

// ─── Каталог ───────────────────────────────────────────────────────

describe('каталог', () => {
  test('витрина открыта без сессии', async () => {
    const res = await call('GET', '/services');
    assert.equal(res.statusCode, 200);
    const slugs = (res.json().services as { slug: string }[]).map((s) => s.slug);
    assert.ok(slugs.includes('lips'));
  });

  test('одна процедура по slug', async () => {
    const res = await call('GET', '/services/lips');
    assert.equal(res.statusCode, 200);
    assert.equal(res.json().service.price_minor, 45000);
  });

  test('404 на неизвестный slug', async () => {
    assert.equal((await call('GET', '/services/nope')).statusCode, 404);
  });

  test('расчёт визита: сумма и длительность считаются сервером', async () => {
    const res = await call('POST', '/services/quote', {
      token: clientToken,
      payload: { slugs: ['lips', 'peel'] },
    });
    assert.equal(res.statusCode, 200);
    const q = res.json().quote;
    assert.equal(q.subtotal_minor, 63000);
    assert.equal(q.total_minor, 63000);
    assert.equal(q.duration_min, 105);
  });

  test('процедура без цены в визит не ставится', async () => {
    const res = await call('POST', '/services/quote', {
      token: clientToken,
      payload: { slugs: ['nopric'] },
    });
    assert.equal(res.statusCode, 422);
    assert.equal(res.json().error.code, 'incomplete_service');
  });

  test('отказ: расчёт без сессии', async () => {
    const res = await call('POST', '/services/quote', { payload: { slugs: ['lips'] } });
    assert.equal(res.statusCode, 401);
  });

  test('отказ: правка прайса клиенткой', async () => {
    const res = await call('PATCH', '/services/lips', {
      token: clientToken,
      payload: { price_minor: 1 },
    });
    assert.equal(res.statusCode, 403);
  });

  test('отказ: правка прайса мастером (не владелицей)', async () => {
    const res = await call('PATCH', '/services/lips', {
      token: staffToken,
      payload: { price_minor: 1 },
    });
    assert.equal(res.statusCode, 403);
  });

  test('успех: владелица меняет цену', async () => {
    const res = await call('PATCH', '/services/peel', {
      token: ownerToken,
      payload: { price_minor: 19000 },
    });
    assert.equal(res.statusCode, 200);
    assert.equal(res.json().service.price_minor, 19000);
  });

  test('дробная цена отклоняется: деньги — целое в минорных единицах', async () => {
    const res = await call('PATCH', '/services/peel', {
      token: ownerToken,
      payload: { price_minor: 190.5 },
    });
    assert.equal(res.statusCode, 422);
    assert.equal(res.json().error.code, 'bad_price');
  });

  test('снятие с витрины мягкое: процедура остаётся в базе', async () => {
    assert.equal((await call('DELETE', '/services/brows', { token: ownerToken })).statusCode, 200);

    const shelf = await call('GET', '/services');
    const slugs = (shelf.json().services as { slug: string }[]).map((s) => s.slug);
    assert.equal(slugs.includes('brows'), false, 'снятой процедуры на витрине быть не должно');

    const rows = await h.sql`select archived_at from anzh.services where slug = 'brows'`;
    assert.notEqual(rows[0]!.archived_at, null, 'строка должна остаться, история на неё ссылается');

    await call('POST', '/services/brows/restore', { token: ownerToken });
  });
});

// ─── Записи ────────────────────────────────────────────────────────

describe('записи', () => {
  test('успех: заявка создаётся в статусе pending', async () => {
    const res = await call('POST', '/bookings', {
      token: clientToken,
      payload: { slugs: ['lips'], starts_at: futureSlot(24) },
    });
    assert.equal(res.statusCode, 201);
    const b = res.json().booking;
    assert.equal(b.status, 'pending');
    assert.equal(b.staff_id, OWNER_ID, 'заявка ушла тому, кто ведёт процедуру');
    assert.equal(b.total_minor, 45000);
  });

  test('сумму из запроса сервер игнорирует', async () => {
    const res = await call('POST', '/bookings', {
      token: clientToken,
      payload: {
        slugs: ['lips'],
        starts_at: futureSlot(25),
        total_minor: 1,
        discount_percent: 90,
      },
    });
    assert.equal(res.statusCode, 201);
    assert.equal(res.json().booking.total_minor, 45000);
    assert.equal(res.json().booking.discount_percent, 0);
  });

  test('идемпотентность: повтор с тем же ключом не создаёт вторую запись', async () => {
    const key = randomUUID();
    const payload = { slugs: ['lips'], starts_at: futureSlot(26) };

    const first = await call('POST', '/bookings', {
      token: clientToken, payload, headers: { 'idempotency-key': key },
    });
    const second = await call('POST', '/bookings', {
      token: clientToken, payload, headers: { 'idempotency-key': key },
    });

    assert.equal(first.statusCode, 201);
    assert.equal(second.statusCode, 201);
    assert.equal(first.json().booking.id, second.json().booking.id);

    const rows = await h.sql`
      select count(*)::int as n from anzh.bookings
      where telegram_id = ${CLIENT_ID} and starts_at = ${payload.starts_at}
    `;
    assert.equal(rows[0]!.n, 1);
  });

  test('мусорный Idempotency-Key отклоняется', async () => {
    const res = await call('POST', '/bookings', {
      token: clientToken,
      payload: { slugs: ['lips'], starts_at: futureSlot(27) },
      headers: { 'idempotency-key': 'not-a-uuid' },
    });
    assert.equal(res.statusCode, 422);
  });

  test('прошедшее время отклоняется', async () => {
    const res = await call('POST', '/bookings', {
      token: clientToken,
      payload: { slugs: ['lips'], starts_at: futureSlot(-5) },
    });
    assert.equal(res.statusCode, 422);
    assert.equal(res.json().error.code, 'past_time');
  });

  test('отказ: заявка без сессии', async () => {
    const res = await call('POST', '/bookings', {
      payload: { slugs: ['lips'], starts_at: futureSlot(28) },
    });
    assert.equal(res.statusCode, 401);
  });

  test('🚨 слот занимает только ПОДТВЕРЖДЁНИЕ: две заявки на одно время живут', async () => {
    const at = futureSlot(48);
    const a = await call('POST', '/bookings', {
      token: clientToken, payload: { slugs: ['lips'], starts_at: at },
    });
    const b = await call('POST', '/bookings', {
      token: otherToken, payload: { slugs: ['lips'], starts_at: at },
    });
    assert.equal(a.statusCode, 201);
    assert.equal(b.statusCode, 201, 'заявки друг друга не блокируют');

    // Первое подтверждение проходит.
    const ok = await call('PATCH', `/bookings/${a.json().booking.id}`, {
      token: ownerToken, payload: { status: 'confirmed' },
    });
    assert.equal(ok.statusCode, 200);

    // Второе — конфликт, и ловит его БАЗА уникальным индексом.
    const clash = await call('PATCH', `/bookings/${b.json().booking.id}`, {
      token: ownerToken, payload: { status: 'confirmed' },
    });
    assert.equal(clash.statusCode, 409);
    assert.equal(clash.json().error.code, 'slot_taken');
  });

  test('занятые слоты показывают только подтверждённое', async () => {
    const res = await call('GET', `/staff/${OWNER_ID}/busy`, { token: clientToken });
    assert.equal(res.statusCode, 200);
    const busy = res.json().busy as string[];
    assert.ok(busy.includes(futureSlot(48)));
    assert.equal(busy.includes(futureSlot(24)), false, 'неподтверждённая заявка слот не занимает');
  });

  test('запрещённый переход: подтвердить отклонённую нельзя', async () => {
    const made = await call('POST', '/bookings', {
      token: clientToken, payload: { slugs: ['peel'], starts_at: futureSlot(72) },
    });
    const id = made.json().booking.id;

    const declined = await call('PATCH', `/bookings/${id}`, {
      token: ownerToken, payload: { status: 'declined', reason: 'В этот день не работаю' },
    });
    assert.equal(declined.statusCode, 200);

    const again = await call('PATCH', `/bookings/${id}`, {
      token: ownerToken, payload: { status: 'confirmed' },
    });
    assert.equal(again.statusCode, 409);
    assert.equal(again.json().error.code, 'bad_transition');
  });

  test('отклонение без причины не принимается', async () => {
    const made = await call('POST', '/bookings', {
      token: clientToken, payload: { slugs: ['peel'], starts_at: futureSlot(73) },
    });
    const res = await call('PATCH', `/bookings/${made.json().booking.id}`, {
      token: ownerToken, payload: { status: 'declined' },
    });
    assert.equal(res.statusCode, 422);
    assert.equal(res.json().error.code, 'reason_required');
  });

  test('клиентка не может подтвердить себе запись', async () => {
    const made = await call('POST', '/bookings', {
      token: clientToken, payload: { slugs: ['peel'], starts_at: futureSlot(74) },
    });
    const res = await call('PATCH', `/bookings/${made.json().booking.id}`, {
      token: clientToken, payload: { status: 'confirmed' },
    });
    assert.equal(res.statusCode, 409);
    assert.equal(res.json().error.code, 'bad_transition');
  });

  test('🚨 чужую запись по идентификатору не открыть', async () => {
    const made = await call('POST', '/bookings', {
      token: clientToken, payload: { slugs: ['peel'], starts_at: futureSlot(75) },
    });
    const id = made.json().booking.id;

    // Другая клиентка.
    assert.equal((await call('GET', `/bookings/${id}`, { token: otherToken })).statusCode, 403);
    // Мастер, которому эта запись не назначена, — тоже.
    assert.equal((await call('GET', `/bookings/${id}`, { token: staffToken })).statusCode, 403);
    // Своя — открывается.
    assert.equal((await call('GET', `/bookings/${id}`, { token: clientToken })).statusCode, 200);
  });

  test('отклонённые за две недели видны клиентке', async () => {
    const res = await call('GET', '/bookings/declined', { token: clientToken });
    assert.equal(res.statusCode, 200);
    const list = res.json().bookings as { decline_reason: string }[];
    assert.ok(list.length >= 1);
    assert.equal(list[0]!.decline_reason, 'В этот день не работаю');
  });

  test('мастер видит свои заявки, но не чужие', async () => {
    const mine = await call('GET', '/staff/bookings', { token: staffToken });
    assert.equal(mine.statusCode, 200);
    assert.equal((mine.json().bookings as unknown[]).length, 0, 'к Марине ещё не записывались');

    // scope=all мастеру не даёт общий список.
    const all = await call('GET', '/staff/bookings?scope=all', { token: staffToken });
    assert.equal((all.json().bookings as unknown[]).length, 0);

    const owner = await call('GET', '/staff/bookings?scope=all', { token: ownerToken });
    assert.ok((owner.json().bookings as unknown[]).length > 0);
  });

  test('отказ: очередь заявок клиентке', async () => {
    assert.equal((await call('GET', '/staff/bookings', { token: clientToken })).statusCode, 403);
  });
});

// ─── Скидка за задания ─────────────────────────────────────────────

describe('скидка за задания', () => {
  test('отзыв и сторис дают по 5%, вместе 10%', async () => {
    for (const kind of ['review', 'story']) {
      await h.sql`
        insert into anzh.quest_completions
          (telegram_id, kind, percent, basis_table, basis_id, confirmed_at)
        values (${OTHER_CLIENT_ID}, ${kind}, 5, 'manual', gen_random_uuid(), now())
      `;
    }
    const res = await call('POST', '/services/quote', {
      token: otherToken,
      payload: { slugs: ['lips'] },
    });
    const q = res.json().quote;
    assert.equal(q.discount_percent, 10);
    assert.equal(q.discount_minor, 4500);
    assert.equal(q.total_minor, 40500);
  });

  test('потолок держится: лишние основания процентов не добавляют', async () => {
    // Ещё четыре подтверждённых задания сверх двух.
    for (let i = 0; i < 4; i++) {
      await h.sql`
        insert into anzh.quest_completions
          (telegram_id, kind, percent, basis_table, basis_id, confirmed_at)
        values (${OTHER_CLIENT_ID}, 'story', 5, 'manual', gen_random_uuid(), now())
      `;
    }
    const res = await call('POST', '/services/quote', {
      token: otherToken,
      payload: { slugs: ['lips'] },
    });
    assert.equal(res.json().quote.discount_percent, 10);
  });

  test('неподтверждённое задание процентов не даёт', async () => {
    await h.sql`
      insert into anzh.quest_completions
        (telegram_id, kind, percent, basis_table, basis_id)
      values (${CLIENT_ID}, 'story', 10, 'manual', gen_random_uuid())
    `;
    const res = await call('POST', '/services/quote', {
      token: clientToken,
      payload: { slugs: ['lips'] },
    });
    assert.equal(res.json().quote.discount_percent, 0);
  });
});

// ─── Команда ───────────────────────────────────────────────────────

describe('команда', () => {
  test('состав открыт без сессии и не отдаёт PIN', async () => {
    const res = await call('GET', '/team');
    assert.equal(res.statusCode, 200);

    // Проверяем ФОРМУ ответа, а не подстроку: `body.includes('pin')`
    // ловит и чужое слово, и пропускает переименованное поле. Здесь
    // важно, что в отдаваемом объекте нет НИ ОДНОГО ключа про PIN —
    // как бы его ни назвали.
    const team = (res.json() as { team: Record<string, unknown>[] }).team;
    assert.ok(team.length > 0, 'состав не должен быть пустым, иначе проверка ничего не значит');
    const EXPECTED = ['telegram_id', 'name', 'title', 'role', 'photo_url', 'services'];
    for (const member of team) {
      assert.deepEqual(
        Object.keys(member).sort(),
        [...EXPECTED].sort(),
        'публичный состав отдаёт ровно эти поля и ничего сверх',
      );
    }
  });

  test('отказ: добавить мастера может только владелица', async () => {
    const asStaff = await call('POST', '/team', {
      token: staffToken,
      payload: { telegram_id: 930001, name: 'Нино' },
    });
    assert.equal(asStaff.statusCode, 403);

    const asClient = await call('POST', '/team', {
      token: clientToken,
      payload: { telegram_id: 930001, name: 'Нино' },
    });
    assert.equal(asClient.statusCode, 403);
  });

  test('успех: владелица добавляет мастера и назначает процедуры', async () => {
    const add = await call('POST', '/team', {
      token: ownerToken,
      payload: { telegram_id: 930001, name: 'Нино', title: 'Дерматолог' },
    });
    assert.equal(add.statusCode, 201);

    const link = await call('PUT', '/team/930001/services', {
      token: ownerToken,
      payload: { slugs: ['peel'] },
    });
    assert.equal(link.statusCode, 200);
  });

  test('владелица не может снять доступ у себя', async () => {
    const res = await call('DELETE', `/team/${OWNER_ID}`, { token: ownerToken });
    assert.equal(res.statusCode, 422);
    assert.equal(res.json().error.code, 'self_removal');
  });

  test('PIN: известный из переписки код не принимается', async () => {
    const res = await call('POST', '/staff/pin/set', {
      token: ownerToken,
      payload: { pin: '2024' },
    });
    assert.equal(res.statusCode, 422);
    assert.equal(res.json().error.code, 'pin_leaked');
  });

  test('PIN: задаётся, проверяется, хранится хэшем', async () => {
    assert.equal(
      (await call('POST', '/staff/pin/set', { token: ownerToken, payload: { pin: '739154' } }))
        .statusCode,
      200,
    );

    const rows = await h.sql<{ pin_hash: string }[]>`
      select pin_hash from anzh.staff where telegram_id = ${OWNER_ID}
    `;
    assert.match(rows[0]!.pin_hash, /^scrypt\$/);
    assert.equal(rows[0]!.pin_hash.includes('739154'), false, 'PIN не хранится открытым');

    assert.equal(
      (await call('POST', '/staff/pin', { token: ownerToken, payload: { pin: '739154' } }))
        .statusCode,
      200,
    );
    assert.equal(
      (await call('POST', '/staff/pin', { token: ownerToken, payload: { pin: '111111' } }))
        .statusCode,
      403,
    );
  });

  test('отказ: PIN клиентке недоступен — он не даёт прав', async () => {
    const res = await call('POST', '/staff/pin', {
      token: clientToken,
      payload: { pin: '739154' },
    });
    assert.equal(res.statusCode, 403);
  });

  test('отказ: кабинет мастера клиентке', async () => {
    assert.equal((await call('GET', '/staff/me', { token: clientToken })).statusCode, 403);
    assert.equal((await call('GET', '/staff/me', { token: ownerToken })).statusCode, 200);
  });
});

// ─── Клиентки ──────────────────────────────────────────────────────

describe('клиентки', () => {
  test('успех: владелица видит список с историей', async () => {
    const res = await call('GET', '/clients', { token: ownerToken });
    assert.equal(res.statusCode, 200);
    const list = res.json().clients as { telegram_id: number }[];
    assert.ok(list.some((c) => c.telegram_id === CLIENT_ID));
  });

  test('отказ: список клиенток закрыт от клиентки', async () => {
    assert.equal((await call('GET', '/clients', { token: clientToken })).statusCode, 403);
    assert.equal((await call('GET', '/clients')).statusCode, 401);
  });

  test('мастер не видит тех, кто к нему не приходил', async () => {
    // К Марине не записывались — её список пуст.
    const list = await call('GET', '/clients', { token: staffToken });
    assert.equal((list.json().clients as unknown[]).length, 0);

    // И карточка отдаёт 404, а не 403: 403 подтвердил бы, что такая
    // клиентка у студии есть.
    const card = await call('GET', `/clients/${CLIENT_ID}`, { token: staffToken });
    assert.equal(card.statusCode, 404);
  });

  test('🔒 карточка не отдаёт анкету здоровья до ответов юриста', async () => {
    const res = await call('GET', `/clients/${CLIENT_ID}`, { token: ownerToken });
    assert.equal(res.statusCode, 200);
    assert.equal(res.json().client.health.available, false);
  });
});

// ─── Общие свойства API ────────────────────────────────────────────

describe('общее', () => {
  test('неизвестный путь отвечает единой формой ошибки', async () => {
    const res = await call('GET', '/nope');
    assert.equal(res.statusCode, 404);
    assert.equal(res.json().error.code, 'not_found');
  });

  test('ошибка не содержит трассировки и текста запроса к базе', async () => {
    const res = await call('GET', '/clients/не-число', { token: ownerToken });
    assert.equal(res.statusCode, 422);
    const body = res.body;
    assert.equal(body.includes('select'), false);
    assert.equal(body.includes('stack'), false);
    assert.equal(body.includes('anzh.'), false);
  });

  test('заголовки безопасности стоят на каждом ответе', async () => {
    const res = await call('GET', '/health');
    assert.equal(res.headers['x-content-type-options'], 'nosniff');
    assert.equal(res.headers['referrer-policy'], 'no-referrer');
    assert.match(String(res.headers['content-security-policy']), /frame-ancestors 'none'/);
  });

  test('ограничение частоты: 11-я заявка подряд получает 429', async () => {
    resetRateLimits();
    let last = 0;
    for (let i = 0; i < 11; i++) {
      const res = await call('POST', '/bookings', {
        token: otherToken,
        payload: { slugs: ['lips'], starts_at: futureSlot(200 + i) },
      });
      last = res.statusCode;
      if (i < 10) assert.equal(res.statusCode, 201, `заявка ${i + 1} должна пройти`);
    }
    assert.equal(last, 429);
  });

  test('CORS не отдаётся неразрешённому источнику', async () => {
    const res = await call('GET', '/health', { headers: { origin: 'https://evil.example' } });
    assert.equal(res.headers['access-control-allow-origin'], undefined);
  });

  test('токен другого приложения не открывает это', async () => {
    const { issueToken } = await import('../src/lib/jwt.ts');
    const foreign = issueToken(
      { telegram_id: CLIENT_ID, app_source: 'other-app', role: 'owner' },
      process.env.JWT_SECRET!,
      7,
    );
    assert.equal((await call('GET', '/me', { token: foreign })).statusCode, 401);
  });
});
