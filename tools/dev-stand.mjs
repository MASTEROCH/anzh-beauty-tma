#!/usr/bin/env node
// ЛОКАЛЬНЫЙ СТЕНД БЭКЕНДА — только для разработки фронтенда.
//
//   node tools/dev-stand.mjs          # порт 8791 — туда смотрит прокси vite
//   ANZH_STAND_PORT=8800 node tools/...
//
// ⚠️ ЭТО НЕ НАСТОЯЩИЙ СЕРВЕР. Данные в памяти, подписи Telegram не
// проверяются, PIN и лимиты упрощены. Он нужен ровно для одного: чтобы
// кабинет и записи можно было ОТКРЫТЬ и увидеть без Telegram и без чужого
// бэкенда. Форму ответов он берёт из `src/lib/api/*.ts` — то есть из того же
// контракта, что и клиент. Где контракт и настоящий сервер разойдутся, прав
// сервер, а не этот файл.
//
// Роли — по строке `init_data`. В dev-режиме клиент подставляет её из
// адреса: `?as=owner` | `maria` | `ekaterina` | `roman` | `client`
// (см. src/lib/telegram.ts, ветка `import.meta.env.DEV`). PIN у всех — 2468.
//
// Расширения контракта, которых в настоящем API ещё НЕТ, помечены
// `[ПРЕДЛОЖЕНИЕ]`: профиль студии (`/studio`) и акции (`/promos`). Их
// нужно заводить на сервере — описание форм в DEV-STAND.md.

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';

const PORT = Number(process.env.ANZH_STAND_PORT ?? 8791);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PIN = '2468';

/* ─── Каталог: берём тот же файл, что и приложение ───────────────────── */
async function loadSeed() {
  // Локально — свежие данные из src/data (tools/build-seed.mjs); на Vercel
  // его нет вместе с esbuild — берём собранный при деплое tools/stand-seed.json
  try {
    const { buildSeed } = await import('./build-seed.mjs');
    return await buildSeed();
  } catch {
    return JSON.parse(fs.readFileSync(path.join(ROOT, 'tools/stand-seed.json'), 'utf8'));
  }
}

const wire = (s, i) => ({
  slug: s.id,
  kind: s.category === 'training' ? 'training' : 'procedure',
  category: s.category,
  zone: s.zone ?? 'face',
  title: { ru: s.title, en: s.titleEn ?? s.title },
  subtitle: { ru: s.short ?? null, en: s.shortEn ?? null },
  description: { ru: s.description ?? null, en: s.descriptionEn ?? null },
  price_minor: s.priceMinor ?? null,
  currency: s.currency ?? null,
  price_from: !!s.priceFrom,
  stars_amount: null,
  duration_min: s.duration ?? null,
  days: s.days ?? null,
  includes: s.includes ?? [],
  contraindications: s.contraindications ?? [],
  photo_url: null,
  sort: i,
});

/* ─── Люди ────────────────────────────────────────────────────────────── */
const PEOPLE = {
  owner:    { telegram_id: 1001, name: 'Анжелика', title: 'Врач-косметолог · владелица', role: 'owner', first_name: 'Анжелика' },
  maria:    { telegram_id: 1002, name: 'Мария Ефименко', title: 'Врач-дерматолог', role: 'staff', first_name: 'Мария' },
  ekaterina:{ telegram_id: 1003, name: 'Екатерина Попова', title: 'Мастер-бровист', role: 'staff', first_name: 'Екатерина' },
  roman:    { telegram_id: 1004, name: 'Роман', title: 'Лазерное удаление', role: 'staff', first_name: 'Роман' },
  admin:    { telegram_id: 1005, name: 'Дарья', title: 'Администратор', role: 'admin', first_name: 'Дарья' },
  client:   { telegram_id: 5001, name: 'Тест Клиентка', title: null, role: 'client', first_name: 'Тест' },
};

const db = {
  services: [],
  archived: [],
  team: [],                    // заполняется из data/team.ts при старте (seedTeam)
  pins: {},                    // telegram_id → 'PIN'
  mustChange: new Set(),       // telegram_id: PIN задала владелица — сменить при входе
  confirmed: new Set(),        // токены с подтверждённым PIN
  bookings: [],
  notes: [],
  health: new Map(),           // telegram_id → анкета здоровья
  consents: new Map(),         // telegram_id → {kind: true}
  quizzes: new Map(),          // telegram_id → {quiz_id: result}
  chapters: new Map(),         // telegram_id → Set(quiz_id), открытые главами
  reviews: [],                 // [ПРЕДЛОЖЕНИЕ] отзывы: {id, telegram_id, name, rating, text, service_slug, state, created_at, reply, verified}
  rewards: new Map(),          // telegram_id → {profile, invite, story, review: 'idle'|'pending'|'done', story_proof, used}
  referrals: new Map(),        // telegram_id пригласившей → [telegram_id подруг]
  purchases: new Map(),        // telegram_id → [{product_slug, product_kind, status, paid_at, covers}]
  favorites: new Map(),        // [ПРЕДЛОЖЕНИЕ] telegram_id → {slugs: [], added: {slug: iso}, updated_at}
  prefs: new Map(),            // telegram_id → {reminders, review, marketing, favorites, repeat}
  reminded: new Map(),         // telegram_id → iso последнего напоминания (не чаще раза в неделю)
  /* [ПРЕДЛОЖЕНИЕ] профиль студии: то, что сейчас вшито в data/location.ts */
  studio: {
    name: 'ANZH Cosmetology',
    tagline: { ru: 'Студия косметологии в Батуми', en: 'Cosmetology studio in Batumi' },
    city: { ru: 'Батуми', en: 'Batumi' },
    street: { ru: 'ул. Parnavaz Mepe 92/94', en: '92/94 Parnavaz Mepe St' },
    floor: { ru: '1 этаж', en: 'floor 1' },
    hint: { ru: '10 мин от Boulevard · центр Батуми', en: '10 min from the Boulevard · central Batumi' },
    lat: 41.6459104, lon: 41.6317344,
    telegram: 'anzh_cosmetology',
    instagram: 'dr.domnich',
    phone: null,
    whatsapp: null,
    hours: { ru: 'Вт–Сб · 09:00–20:00', en: 'Tue–Sat · 09:00–20:00' },
    off_days: [0, 1],
    /* [ПРЕДЛОЖЕНИЕ] главы паспорта в подарок: за процедуру и за N подруг */
    passport_rules: { enabled: true, friends_per_chapter: 2 },
  },
  /* [ПРЕДЛОЖЕНИЕ] акции */
  promos: [],
};

function seedBookings() {
  const now = Date.now();
  const day = 864e5;
  const mk = (id, who, slug, offsetDays, hh, status, extra = {}) => {
    const s = db.services.find((x) => x.slug === slug);
    const d = new Date(now + offsetDays * day);
    d.setUTCHours(hh, 0, 0, 0);
    return {
      id: `b${id}`,
      telegram_id: 6000 + id,
      client_name: who,
      staff_id: extra.staff ?? PEOPLE.owner.telegram_id,
      staff_name: null,
      starts_at: d.toISOString(),
      duration_min: s?.duration_min ?? 30,
      status,
      total_minor: s?.price_minor ?? 0,
      paid_minor: extra.paid ?? null,
      currency: s?.currency ?? 'GEL',
      discount_percent: 0,
      client_note: extra.note ?? null,
      decline_reason: null,
      created_at: new Date(now - day).toISOString(),
      items: [{ slug, title_ru: s?.title.ru, title_en: s?.title.en, price_minor: s?.price_minor ?? 0 }],
    };
  };
  db.bookings = [
    mk(1, 'Катя К.', 'contour-plastic', 1, 6, 'pending'),
    mk(2, 'Оля Б.', 'biorevit', 2, 8, 'pending', { staff: PEOPLE.maria.telegram_id }),
    mk(3, 'Маша Г.', 'lip-filler', 1, 11, 'confirmed'),
    mk(4, 'Нино К.', 'botulinum', 0, 9, 'confirmed'),
    mk(5, 'Софи В.', 'smas-lifting', 3, 7, 'confirmed'),
    mk(6, 'Дарья Л.', 'dermatology', 2, 10, 'pending', { staff: PEOPLE.maria.telegram_id }),
    mk(7, 'Маша Г.', 'biorevit', -14, 8, 'done', { paid: 35000 }),
    mk(8, 'Маша Г.', 'lip-filler', -58, 9, 'done', { paid: 38000 }),
    mk(9, 'Нино К.', 'filler-dissolve', -9, 7, 'done', { paid: 10000 }),
    mk(10, 'Софи В.', 'contour-plastic', -40, 8, 'done', { paid: 80000 }),
    mk(11, 'Лена Г.', 'smas-lifting', -7, 10, 'no_show'),
    mk(12, 'Оля Б.', 'collagen-stimulators', -90, 8, 'done', { paid: 60000 }),
  ];
}

/* ─── Транспорт ───────────────────────────────────────────────────────── */
const send = (res, status, body, headers = {}) => {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', ...headers });
  res.end(JSON.stringify(body));
};
const err = (res, status, code, message = code) => send(res, status, { error: { code, message } });
const readBody = (req) => new Promise((ok) => {
  let b = '';
  req.on('data', (c) => { b += c; });
  req.on('end', () => { try { ok(b ? JSON.parse(b) : {}); } catch { ok({}); } });
});

const readRaw = (req) => new Promise((ok) => {
  const parts = [];
  req.on('data', (c) => parts.push(c));
  req.on('end', () => ok(Buffer.concat(parts)));
});

const tokenOf = (req) => (req.headers.authorization ?? '').replace(/^Bearer /, '') || null;
/* Демо на Vercel: экземпляров функции несколько, и память у каждого своя.
   Гость из токена `tok-c<uid>` / `tok-tg<id>` восстанавливается на любом из
   них одинаково — иначе вход на одном экземпляре давал 401 на другом. */
function personOf(tok) {
  if (!tok || !tok.startsWith('tok-')) return null;
  const key = tok.slice(4);
  if (PEOPLE[key]) return PEOPLE[key];
  const c = /^c([a-z0-9]{6,32})$/.exec(key);
  const t = /^tg(\d{1,15})$/.exec(key);
  if (!c && !t) return null;
  const id = t ? Number(t[1]) : 700000 + (parseInt(c[1].slice(0, 6), 36) % 299999);
  const name = t ? 'Клиентка' : `Гость ${String(id).slice(-4)}`;
  PEOPLE[key] = { telegram_id: id, name, title: null, role: 'client', first_name: name };
  return PEOPLE[key];
}

const me = (p) => ({
  telegram_id: p.telegram_id,
  first_name: p.first_name,
  last_name: null,
  username: null,
  role: p.role,
  staff_name: p.role === 'client' ? null : p.name,
  referral_code: 'DEV123',
  referral_link: `https://t.me/anzh_cosmetology_bot?start=ref_${p.telegram_id}`,
  invited_count: 0,
  notifications: { reminders: true, review: true, marketing: false, favorites: true, repeat: true, ...(db.prefs.get(p.telegram_id) ?? {}) },
  language_code: 'ru',
  can_message: true,
  bot_link: null,
  consents: { policy: true, health_data: false, photo_publish: false, marketing: false, ...(db.consents.get(p.telegram_id) ?? {}) },
  legal: { policy: 'dev-1', health_data: 'dev-1', terms: 'dev-1', refunds: 'dev-1' },
  features: { stars: true, health: true },
});

const isStaff = (p) => p && (p.role === 'owner' || p.role === 'staff' || p.role === 'admin');
const isOwner = (p) => p && p.role === 'owner';

/* Простой запас: каждый час 09–19, кроме занятых подтверждёнными */
function slotsFor(dateStr, staffId, durationMin) {
  const out = [];
  for (let h = 9; h <= 19; h++) {
    const iso = new Date(`${dateStr}T${String(h).padStart(2, '0')}:00:00+04:00`).toISOString();
    const taken = db.bookings.some((b) =>
      b.staff_id === staffId && b.status === 'confirmed' && b.starts_at === iso);
    if (!taken) out.push({ time: `${String(h).padStart(2, '0')}:00`, starts_at: iso });
  }
  return out;
}

const handlers = [];
const route = (method, pattern, fn) => handlers.push({ method, re: new RegExp(`^${pattern.replace(/:[a-z]+/gi, '([^/]+)')}$`), fn });

/* ─── Вход ────────────────────────────────────────────────────────────── */
route('POST', '/auth/telegram', async ({ res, body }) => {
  const raw = String(body.init_data ?? '');
  const m = /dev=([a-z0-9]+)/.exec(raw);
  let who = m && PEOPLE[m[1]] ? m[1] : 'client';
  // Демо: у каждого посетителя браузера своя клиентка (uid с устройства), из
  // Telegram — по его id и имени. Иначе все гости делили бы один чат.
  const uid = /uid=([a-z0-9]{6,32})/.exec(raw)?.[1];
  let tgUser = null;
  try { tgUser = JSON.parse(new URLSearchParams(raw).get('user') ?? 'null'); } catch { /* не Telegram */ }
  if (who === 'client' && (uid || tgUser?.id)) {
    who = tgUser?.id ? `tg${tgUser.id}` : `c${uid}`;
    if (!PEOPLE[who]) {
      const id = tgUser?.id ? Number(tgUser.id) : 700000 + (parseInt(uid.slice(0, 6), 36) % 299999);
      const name = tgUser?.first_name || `Гость ${String(id).slice(-4)}`;
      PEOPLE[who] = { telegram_id: id, name, title: null, role: 'client', first_name: name };
    }
  }
  // Подруга пришла по ссылке-приглашению (start=ref_<id>) — привязываем один раз
  const ref = /ref_(\d+)/.exec(raw)?.[1];
  const meId = PEOPLE[who]?.telegram_id;
  if (ref && meId && Number(ref) !== meId) {
    const list = db.referrals.get(Number(ref)) ?? [];
    if (!list.includes(meId)) { list.push(meId); db.referrals.set(Number(ref), list); }
  }
  send(res, 200, { token: `tok-${who}`, user: me(PEOPLE[who]) });
});
route('GET', '/me', ({ res, person }) => person ? send(res, 200, { user: me(person) }) : err(res, 401, 'no_session'));
route('PATCH', '/me', async ({ res, person, body }) => {
  if (!person) return err(res, 401, 'no_session');
  const n = body?.notifications;
  if (n && typeof n === 'object') {
    const cur = db.prefs.get(person.telegram_id) ?? {};
    for (const k of ['reminders', 'review', 'marketing', 'favorites', 'repeat']) if (typeof n[k] === 'boolean') cur[k] = n[k];
    db.prefs.set(person.telegram_id, cur);
  }
  send(res, 200, { user: me(person) });
});

/* ─── Сотрудник и PIN ─────────────────────────────────────────────────── */
route('GET', '/staff/me', ({ res, person, tok }) => {
  if (!person) return err(res, 401, 'no_session');
  if (!isStaff(person)) return err(res, 403, 'forbidden');
  send(res, 200, { staff: {
    ...memberOut(db.team.find((t) => t.telegram_id === person.telegram_id) ?? { telegram_id: person.telegram_id, name: person.name, title: person.title, role: person.role }),
    pin_set: person.telegram_id in db.pins || true,
    must_change_pin: db.mustChange.has(person.telegram_id),
    pin_confirmed: db.confirmed.has(tok),
  } });
});
route('POST', '/staff/pin', ({ res, person, tok, body }) => {
  if (!isStaff(person)) return err(res, 403, 'forbidden');
  if (String(body.pin) !== (db.pins[person.telegram_id] ?? PIN)) return err(res, 403, 'bad_pin', 'Неверный код');
  db.confirmed.add(tok);
  send(res, 200, { confirmed: true });
});
route('POST', '/staff/pin/set', ({ res, person, body }) => {
  if (!isStaff(person)) return err(res, 403, 'forbidden');
  if (!/^\d{4}$/.test(String(body.pin))) return err(res, 422, 'bad_pin');
  db.pins[person.telegram_id] = String(body.pin);
  db.mustChange.delete(person.telegram_id);
  send(res, 200, { updated: true });
});

/* Всё ниже — только с подтверждённым PIN, как в настоящем API */
const needPin = (ctx) => {
  if (!isStaff(ctx.person)) { err(ctx.res, 403, 'forbidden'); return false; }
  if (!db.confirmed.has(ctx.tok)) { err(ctx.res, 403, 'pin_required'); return false; }
  return true;
};

/* ─── Записи ──────────────────────────────────────────────────────────── */
route('GET', '/staff/bookings', (ctx) => {
  if (!needPin(ctx)) return;
  const { status, from, to, scope } = ctx.query;
  let list = db.bookings;
  if (!(isOwner(ctx.person) || ctx.person.role === 'admin') || scope !== 'all') list = list.filter((b) => b.staff_id === ctx.person.telegram_id);
  if (status) list = list.filter((b) => b.status === status);
  if (from) list = list.filter((b) => b.starts_at >= from);
  if (to) list = list.filter((b) => b.starts_at < to);
  send(ctx.res, 200, { bookings: list.map((b) => ({ ...b, staff_name: db.team.find((t) => t.telegram_id === b.staff_id)?.name ?? null })), timezone: 'Asia/Tbilisi' });
});
route('PATCH', '/bookings/:id', async (ctx) => {
  if (!needPin(ctx)) return;
  const b = db.bookings.find((x) => x.id === ctx.params[0]);
  if (!b) return err(ctx.res, 404, 'not_found');
  const { status, reason, paid_minor } = ctx.body;
  const ok = {
    pending: ['confirmed', 'declined'],
    confirmed: ['done', 'no_show', 'cancelled'],
  }[b.status] ?? [];
  if (!ok.includes(status)) return err(ctx.res, 409, 'bad_transition');
  if (status === 'declined' && !String(reason ?? '').trim()) return err(ctx.res, 422, 'reason_required');
  b.status = status;
  if (status === 'declined') b.decline_reason = reason;
  if (status === 'done') {
    b.paid_minor = paid_minor ?? b.total_minor;
    // Скидка за действия — разовая: визит со скидкой проведён — она использована
    if ((b.discount_percent ?? 0) > 0) rewardsOf(b.telegram_id).used = true;
  }
  send(ctx.res, 200, { booking: b });
});

/* ─── Клиентки ────────────────────────────────────────────────────────── */
route('GET', '/clients', (ctx) => {
  if (!needPin(ctx)) return;
  const by = new Map();
  for (const b of db.bookings) {
    const c = by.get(b.telegram_id) ?? { telegram_id: b.telegram_id, first_name: b.client_name, visits: 0, no_shows: 0, cancelled: 0, spent_minor: 0, currency: b.currency, first_visit: b.starts_at, last_visit: b.starts_at };
    if (b.status === 'done') { c.visits += 1; c.spent_minor += b.paid_minor ?? 0; }
    if (b.status === 'no_show') c.no_shows += 1;
    if (b.starts_at > c.last_visit) c.last_visit = b.starts_at;
    if (b.starts_at < c.first_visit) c.first_visit = b.starts_at;
    by.set(b.telegram_id, c);
  }
  // [ПРЕДЛОЖЕНИЕ] CRM-сегменты: due — подошёл срок повтора и нет записи;
  // lapsed — последний проведённый визит > 90 дней назад; new — один визит.
  const now = Date.now();
  for (const c of by.values()) {
    const done = db.bookings.filter((b) => b.telegram_id === c.telegram_id && b.status === 'done');
    const lastDone = done.reduce((m, b) => Math.max(m, Date.parse(b.starts_at)), 0);
    c.due = [];
    for (const b of done) for (const it of b.items) {
      const n = db.services.find((x) => x.slug === it.slug)?.repeat_after_days;
      if (!n || Date.parse(b.starts_at) + n * 86_400_000 > now) continue;
      const later = db.bookings.some((x) => x.telegram_id === c.telegram_id && x.status !== 'declined' && x.status !== 'cancelled'
        && Date.parse(x.starts_at) > Date.parse(b.starts_at) && x.items.some((i) => i.slug === it.slug));
      if (!later && !c.due.some((d) => d.slug === it.slug)) c.due.push({ slug: it.slug, title_ru: it.title_ru ?? it.slug, last_at: b.starts_at, every_days: n });
    }
    c.segments = [
      ...(c.due.length ? ['due'] : []),
      ...(lastDone && now - lastDone > 90 * 86_400_000 ? ['lapsed'] : []),
      ...(c.visits === 1 ? ['new'] : []),
    ];
  }
  const seg = ctx.query?.segment;
  const list = [...by.values()].filter((c) => !seg || c.segments.includes(seg));
  send(ctx.res, 200, { clients: list });
});
route('GET', '/clients/:id', (ctx) => {
  if (!needPin(ctx)) return;
  const id = Number(ctx.params[0]);
  const list = db.bookings.filter((b) => b.telegram_id === id);
  if (!list.length) return err(ctx.res, 404, 'not_found');
  send(ctx.res, 200, {
    client: { telegram_id: id, first_name: list[0].client_name, instagram: null, phone: null, visits: list.filter((b) => b.status === 'done').length },
    history: list.map((b) => ({ id: b.id, starts_at: b.starts_at, status: b.status, total_minor: b.total_minor, paid_minor: b.paid_minor, currency: b.currency, staff_id: b.staff_id, services: b.items.map((i) => i.slug) })),
  });
});
route('GET', '/clients/:id/notes', (ctx) => { if (needPin(ctx)) send(ctx.res, 200, { notes: db.notes.filter((n) => n.client === Number(ctx.params[0])) }); });
route('POST', '/clients/:id/notes', (ctx) => {
  if (!needPin(ctx)) return;
  const n = { id: `n${db.notes.length + 1}`, client: Number(ctx.params[0]), body: String(ctx.body.body ?? ''), author_id: ctx.person.telegram_id, author_name: ctx.person.name, created_at: new Date().toISOString() };
  db.notes.push(n);
  send(ctx.res, 201, { note: n });
});
route('GET', '/clients/:id/health', (ctx) => { if (needPin(ctx)) send(ctx.res, 200, { health: db.health.get(Number(ctx.params[0])) ?? null }); });
/* Согласия: в dev — просто флаг; отзыв health_data стирает анкету и разборы, как обещает контракт */
route('POST', '/me/consents', ({ res, person, body }) => {
  if (!person) return err(res, 401, 'no_session');
  db.consents.set(person.telegram_id, { ...(db.consents.get(person.telegram_id) ?? {}), [body.kind]: true });
  send(res, 200, { consent: { kind: body.kind, version: body.version ?? 'dev-1', granted_at: new Date().toISOString() } });
});
route('DELETE', '/me/consents/:kind', ({ res, person, params }) => {
  if (!person) return err(res, 401, 'no_session');
  const kind = params[0];
  db.consents.set(person.telegram_id, { ...(db.consents.get(person.telegram_id) ?? {}), [kind]: false });
  const wipe = kind === 'health_data';
  if (wipe) { db.health.delete(person.telegram_id); db.quizzes.delete(person.telegram_id); }
  send(res, 200, { revoked: true, health_wiped: wipe });
});
/* [ПРЕДЛОЖЕНИЕ] Результаты разборов — по последнему на тест */
const healthOk = (p) => db.consents.get(p.telegram_id)?.health_data === true;
route('GET', '/me/quiz-results', ({ res, person }) => person
  ? send(res, 200, { results: Object.values(db.quizzes.get(person.telegram_id) ?? {}) })
  : err(res, 401, 'no_session'));
route('PUT', '/me/quiz-results/:quiz', ({ res, person, params, body }) => {
  if (!person) return err(res, 401, 'no_session');
  if (!healthOk(person)) return err(res, 403, 'consent_required');
  const r = { ...body, quiz_id: params[0], taken_at: body.taken_at ?? new Date().toISOString() };
  db.quizzes.set(person.telegram_id, { ...(db.quizzes.get(person.telegram_id) ?? {}), [params[0]]: r });
  send(res, 200, { result: r });
});
route('GET', '/clients/:id/quiz-results', (ctx) => {
  if (!needPin(ctx)) return;
  send(ctx.res, 200, { results: Object.values(db.quizzes.get(Number(ctx.params[0])) ?? {}).sort((a, b) => b.taken_at.localeCompare(a.taken_at)) });
});
/* Анкета здоровья — своя у каждого; в dev хранится в памяти (настоящих анкет до юриста нет) */
route('GET', '/me/health', ({ res, person }) => person ? send(res, 200, { health: db.health.get(person.telegram_id) ?? null }) : err(res, 401, 'no_session'));
route('PUT', '/me/health', ({ res, person, body }) => {
  if (!person) return err(res, 401, 'no_session');
  const h = { answers: body.answers ?? {}, updated_at: new Date().toISOString() };
  db.health.set(person.telegram_id, h);
  send(res, 200, { health: h });
});
route('DELETE', '/me/health', ({ res, person }) => {
  if (!person) return err(res, 401, 'no_session');
  db.health.delete(person.telegram_id);
  send(res, 200, { deleted: true });
});

/* ─── Команда ─────────────────────────────────────────────────────────── */
/* ─── Команда ────────────────────────────────────────────────────────────
   [ПРЕДЛОЖЕНИЕ] профиль сотрудника (описание, фото, контакты, видимость на
   сайте, порядок), роль admin, PIN от владелицы и публичная команда. */
const BI = (v, d = '') => ({ ru: String(v?.ru ?? d), en: String(v?.en ?? v?.ru ?? d) });
const memberOut = (m) => ({ ...m, pin_set: m.telegram_id in db.pins || true, must_change_pin: db.mustChange.has(m.telegram_id) });
const sortTeam = () => db.team.sort((a, b) => (a.profile?.sort ?? 99) - (b.profile?.sort ?? 99));
route('GET', '/team', (ctx) => { if (needPin(ctx)) send(ctx.res, 200, { team: sortTeam().map(memberOut) }); });
route('GET', '/team/public', ({ res }) => {
  const list = sortTeam().filter((m) => m.profile?.visible).map((m) => {
    const p = m.profile;
    return {
      key: p.key ?? `m${m.telegram_id}`, name: p.name, surname: p.surname ?? null, role: p.role, short: p.short ?? null,
      photo_url: m.photo_url ?? null, focus: p.focus ?? null, cred: p.cred ?? null, does: p.does ?? { ru: [], en: [] },
      services: m.services ?? [], is_admin: m.role === 'admin',
      ...(p.contacts_public ? { instagram: p.instagram ?? null, telegram: p.telegram ?? null, phone: p.phone ?? null } : {}),
    };
  });
  send(res, 200, { team: list });
});
route('POST', '/team', (ctx) => {
  if (!needPin(ctx) || !isOwner(ctx.person)) return err(ctx.res, 403, 'forbidden');
  const b = ctx.body;
  if (!Number.isInteger(b.telegram_id)) return err(ctx.res, 422, 'bad_telegram_id');
  if (!String(b.name ?? '').trim()) return err(ctx.res, 422, 'bad_name');
  const role = b.role === 'admin' ? 'admin' : 'staff';
  let m = db.team.find((t) => t.telegram_id === b.telegram_id);
  if (m) Object.assign(m, { name: b.name, title: b.title ?? null, role: m.role === 'owner' ? 'owner' : role });
  else {
    m = { telegram_id: b.telegram_id, name: b.name, title: b.title ?? null, role, photo_url: null, services: [],
      profile: { key: `m${b.telegram_id}`, name: BI({ ru: b.name }), surname: null, role: BI({ ru: b.title ?? '' }), short: null,
        cred: null, does: { ru: [], en: [] }, instagram: null, telegram: null, phone: null, contacts_public: false,
        visible: false, sort: db.team.length } };
    db.team.push(m);
    // Человек из команды входит по своей подписи Telegram: в демо — по ?as=m<id>
    PEOPLE[`m${b.telegram_id}`] = { telegram_id: b.telegram_id, name: b.name, title: b.title ?? null, role, first_name: b.name };
  }
  send(ctx.res, 200, { staff: memberOut(m) });
});
route('PATCH', '/team/:id', (ctx) => {
  if (!needPin(ctx) || !isOwner(ctx.person)) return err(ctx.res, 403, 'forbidden');
  const m = db.team.find((t) => t.telegram_id === Number(ctx.params[0]));
  if (!m) return err(ctx.res, 404, 'not_found');
  const b = ctx.body;
  if (b.name !== undefined) { if (!String(b.name).trim()) return err(ctx.res, 422, 'bad_name'); m.name = String(b.name).trim(); }
  if (b.title !== undefined) m.title = b.title;
  if (b.role !== undefined && m.role !== 'owner') m.role = b.role === 'admin' ? 'admin' : 'staff';
  if (b.photo_url !== undefined) {
    if (b.photo_url !== null && !/^\/photos\/[a-z0-9._\/-]+$/i.test(b.photo_url)) return err(ctx.res, 422, 'bad_photo_url');
    m.photo_url = b.photo_url;
  }
  if (b.profile) m.profile = { ...m.profile, ...b.profile };
  const who = Object.values(PEOPLE).find((x) => x.telegram_id === m.telegram_id);
  if (who) Object.assign(who, { name: m.name, title: m.title, role: m.role, first_name: m.name });
  send(ctx.res, 200, { staff: memberOut(m) });
});
route('PUT', '/team/order', (ctx) => {
  if (!needPin(ctx) || !isOwner(ctx.person)) return err(ctx.res, 403, 'forbidden');
  (ctx.body.order ?? []).forEach((id, i) => { const m = db.team.find((t) => t.telegram_id === Number(id)); if (m) m.profile = { ...m.profile, sort: i }; });
  send(ctx.res, 200, { team: sortTeam().map(memberOut) });
});
route('POST', '/team/:id/pin/set', (ctx) => {
  if (!needPin(ctx) || !isOwner(ctx.person)) return err(ctx.res, 403, 'forbidden');
  const id = Number(ctx.params[0]);
  if (!db.team.some((t) => t.telegram_id === id)) return err(ctx.res, 404, 'not_found');
  if (!/^\d{4}$/.test(String(ctx.body.pin))) return err(ctx.res, 422, 'bad_pin', 'PIN — ровно 4 цифры');
  db.pins[id] = String(ctx.body.pin);
  if (id !== ctx.person.telegram_id) db.mustChange.add(id);
  send(ctx.res, 200, { updated: true, must_change_pin: id !== ctx.person.telegram_id });
});
route('DELETE', '/team/:id', (ctx) => {
  if (!needPin(ctx) || !isOwner(ctx.person)) return err(ctx.res, 403, 'forbidden');
  const id = Number(ctx.params[0]);
  if (id === ctx.person.telegram_id) return err(ctx.res, 422, 'self_removal');
  db.team = db.team.filter((t) => t.telegram_id !== id);
  send(ctx.res, 200, { deactivated: id });
});
route('PUT', '/team/:id/services', (ctx) => {
  if (!needPin(ctx) || !isOwner(ctx.person)) return err(ctx.res, 403, 'forbidden');
  const m = db.team.find((t) => t.telegram_id === Number(ctx.params[0]));
  if (!m) return err(ctx.res, 404, 'not_found');
  m.services = ctx.body.slugs ?? [];
  send(ctx.res, 200, { staff_id: m.telegram_id, services: m.services });
});
route('POST', '/team/:id/pin/reset', (ctx) => {
  if (!needPin(ctx) || !isOwner(ctx.person)) return err(ctx.res, 403, 'forbidden');
  if (Number(ctx.params[0]) === ctx.person.telegram_id) return err(ctx.res, 422, 'self_reset');
  delete db.pins[Number(ctx.params[0])];
  send(ctx.res, 200, { reset: true });
});

/* ─── Каталог ─────────────────────────────────────────────────────────── */
route('GET', '/services', ({ res }) => send(res, 200, { services: db.services }));
route('GET', '/services/:slug', ({ res, params }) => {
  const s = db.services.find((x) => x.slug === params[0]);
  s ? send(res, 200, { service: s }) : err(res, 404, 'not_found');
});
route('GET', '/staff/services/archived', (ctx) => { if (needPin(ctx)) send(ctx.res, 200, { services: db.archived }); });
route('PATCH', '/services/:slug', (ctx) => {
  if (!needPin(ctx) || !isOwner(ctx.person)) return err(ctx.res, 403, 'forbidden');
  const s = db.services.find((x) => x.slug === ctx.params[0]);
  if (!s) return err(ctx.res, 404, 'not_found');
  const p = ctx.body;
  if (!Object.keys(p).length) return err(ctx.res, 422, 'empty_patch');
  for (const lang of ['ru', 'en']) {
    if (`title_${lang}` in p) s.title[lang] = p[`title_${lang}`];
    for (const f of ['subtitle', 'description']) {
      if (`${f}_${lang}` in p) (s[f] ??= {})[lang] = p[`${f}_${lang}`];
    }
  }
  if ('repeat_after_days' in p && p.repeat_after_days !== null && !(Number.isInteger(p.repeat_after_days) && p.repeat_after_days >= 7 && p.repeat_after_days <= 730)) return err(ctx.res, 422, 'bad_repeat', 'Повтор — от 7 до 730 дней');
  for (const f of ['price_minor', 'currency', 'price_from', 'duration_min', 'days', 'includes', 'contraindications', 'photo_url', 'sort', 'repeat_after_days']) {
    if (f in p) s[f] = p[f];
  }
  send(ctx.res, 200, { service: s });
});
route('POST', '/services', (ctx) => {
  if (!needPin(ctx) || !isOwner(ctx.person)) return err(ctx.res, 403, 'forbidden');
  const b = ctx.body;
  if (db.services.concat(db.archived).some((x) => x.slug === b.slug)) return err(ctx.res, 409, 'slug_taken');
  const s = {
    slug: b.slug, kind: b.kind, category: b.category, zone: b.zone ?? 'face',
    title: { ru: b.title_ru, en: b.title_en ?? b.title_ru },
    subtitle: { ru: b.subtitle_ru ?? null, en: b.subtitle_en ?? null },
    description: { ru: b.description_ru ?? null, en: b.description_en ?? null },
    price_minor: b.price_minor ?? null, currency: b.currency ?? null, price_from: !!b.price_from,
    stars_amount: null, duration_min: b.duration_min ?? null, days: b.days ?? null,
    includes: b.includes ?? [], contraindications: b.contraindications ?? [], photo_url: b.photo_url ?? null, repeat_after_days: b.repeat_after_days ?? null,
    sort: b.sort ?? db.services.length,
  };
  db.services.push(s);
  send(ctx.res, 201, { service: s });
});
route('DELETE', '/services/:slug', (ctx) => {
  if (!needPin(ctx) || !isOwner(ctx.person)) return err(ctx.res, 403, 'forbidden');
  const i = db.services.findIndex((x) => x.slug === ctx.params[0]);
  if (i < 0) return err(ctx.res, 404, 'not_found');
  db.archived.push(...db.services.splice(i, 1));
  send(ctx.res, 200, { archived: ctx.params[0] });
});
route('POST', '/services/:slug/restore', (ctx) => {
  if (!needPin(ctx) || !isOwner(ctx.person)) return err(ctx.res, 403, 'forbidden');
  const i = db.archived.findIndex((x) => x.slug === ctx.params[0]);
  if (i < 0) return err(ctx.res, 404, 'not_found');
  db.services.push(...db.archived.splice(i, 1));
  send(ctx.res, 200, { restored: ctx.params[0] });
});
route('POST', '/services/quote', ({ res, body, person }) => {
  const rows = (body.slugs ?? []).map((sl) => db.services.find((x) => x.slug === sl)).filter(Boolean);
  const sub = rows.reduce((n, s) => n + (s.price_minor ?? 0), 0);
  const pct = person ? rewardsOut(person.telegram_id).percent : 0;
  const disc = Math.round(sub * pct / 100);
  send(res, 200, { quote: {
    items: rows.map((s) => ({ slug: s.slug, title_ru: s.title.ru, title_en: s.title.en, price_minor: s.price_minor, currency: s.currency, duration_min: s.duration_min })),
    subtotal_minor: sub, discount_percent: pct, discount_minor: disc, total_minor: sub - disc,
    currency: rows[0]?.currency ?? 'GEL', duration_min: rows.reduce((n, s) => n + (s.duration_min ?? 0), 0),
  } });
});

/* ─── Клиентская запись ───────────────────────────────────────────────── */
route('GET', '/slots', ({ res, query }) => {
  const staff = Number(query.staff_id) || PEOPLE.owner.telegram_id;
  send(res, 200, { date: query.date, timezone: 'Asia/Tbilisi', staff_id: staff, slots: slotsFor(query.date, staff, 30) });
});
route('POST', '/bookings', ({ res, person, body }) => {
  if (!person) return err(res, 401, 'no_session');
  const rows = (body.slugs ?? []).map((sl) => db.services.find((x) => x.slug === sl)).filter(Boolean);
  const b = {
    id: `b${db.bookings.length + 1}`, telegram_id: person.telegram_id, client_name: person.first_name,
    staff_id: body.staff_id ?? PEOPLE.owner.telegram_id, staff_name: null, starts_at: body.starts_at,
    duration_min: rows.reduce((n, s) => n + (s.duration_min ?? 0), 0), status: 'pending',
    total_minor: Math.round(rows.reduce((n, s) => n + (s.price_minor ?? 0), 0) * (100 - rewardsOut(person.telegram_id).percent) / 100), paid_minor: null,
    currency: rows[0]?.currency ?? 'GEL', discount_percent: rewardsOut(person.telegram_id).percent, client_note: body.note ?? null, decline_reason: null,
    created_at: new Date().toISOString(),
    items: rows.map((s) => ({ slug: s.slug, title_ru: s.title.ru, title_en: s.title.en, price_minor: s.price_minor })),
  };
  db.bookings.push(b);
  send(res, 201, { booking: b });
});
route('GET', '/bookings', ({ res, person }) => person
  ? send(res, 200, { bookings: db.bookings.filter((b) => b.telegram_id === person.telegram_id), timezone: 'Asia/Tbilisi' })
  : err(res, 401, 'no_session'));
route('GET', '/bookings/declined', ({ res, person }) => person
  ? send(res, 200, { bookings: db.bookings.filter((b) => b.telegram_id === person.telegram_id && b.status === 'declined') })
  : err(res, 401, 'no_session'));

/* ─── [ПРЕДЛОЖЕНИЕ] Курс ─────────────────────────────────────────────── */
/* Официальный курс Нацбанка Грузии, раз в час. Нет сети — запасной 2.70 с
   пометкой, что он не живой (source: 'fallback'): клиент так и подписывает. */
let rateCache = null;
async function nbgRate() {
  if (rateCache && Date.now() - rateCache.at < 36e5) return rateCache.value;
  try {
    const r = await fetch('https://nbg.gov.ge/gw/api/ct/monetarypolicy/currencies/en/json/?currencies=USD', { signal: AbortSignal.timeout(6000) });
    const j = await r.json();
    const usd = j?.[0]?.currencies?.find((c) => c.code === 'USD');
    if (usd?.rate > 1) {
      rateCache = { at: Date.now(), value: { lari_per_dollar: Number(usd.rate) / (usd.quantity || 1), as_of: j[0].date, source: 'nbg' } };
      return rateCache.value;
    }
  } catch { /* ниже */ }
  return { lari_per_dollar: 2.7, as_of: null, source: 'fallback' };
}
/* ─── [ПРЕДЛОЖЕНИЕ] Встроенный чат клиентки с администратором ─────────── */
/* Правила, которые должен повторить настоящий сервер (подробно — DEV-STAND.md):
   · клиентка видит ТОЛЬКО свою переписку; студия — все, и только за PIN;
   · доставка «вживую» — длинным опросом: GET с `since` (номер последнего
     увиденного события) и `wait` (сек) держится, пока не появится новое, но
     не дольше `wait`. Работает через обычный fetch с заголовком авторизации,
     без WebSocket и без токена в адресе;
   · история хранится у сервера бессрочно, с датой и временем каждого сообщения;
   · вложения (фото/видео) — отдельной загрузкой сырого файла, в сообщение
     идёт `attachment_id`. Файлы ЛИЧНЫЕ (фото кожи — данные о здоровье): не в
     публичный /photos, а по ПОДПИСАННОЙ ссылке с коротким сроком;
   · «прочитано»: сообщения студии помечаются при чтении клиенткой, сообщения
     клиентки — когда студия открыла переписку. */
// Локально — tools/.stand-data; на Vercel писать можно только в /tmp (STAND_DATA)
const DATA = process.env.STAND_DATA ?? path.join(ROOT, 'tools/.stand-data');
const FILES = path.join(DATA, 'chat-files');
fs.mkdirSync(FILES, { recursive: true });
const CHAT_JSON = path.join(DATA, 'chat.json');
const SECRET = crypto.randomBytes(32);
const chat = (() => {
  try { const j = JSON.parse(fs.readFileSync(CHAT_JSON, 'utf8')); return { seq: j.seq ?? 0, threads: j.threads ?? {}, files: j.files ?? {} }; }
  catch { return { seq: 0, threads: {}, files: {} }; }
})();
const saveChat = () => fs.writeFile(CHAT_JSON, JSON.stringify(chat), () => {});
const thread = (id) => (chat.threads[id] ??= []);
const nameOf = (id) => Object.values(PEOPLE).find((x) => x.telegram_id === Number(id))?.first_name ?? `Клиентка ${id}`;

const sign = (id, exp) => crypto.createHmac('sha256', SECRET).update(`${id}.${exp}`).digest('base64url');
const fileUrl = (id) => { const exp = Math.floor(Date.now() / 1000) + 3600; return `/chat/files/${id}?exp=${exp}&sig=${sign(id, exp)}`; };
const outAtt = (id) => { const { owner: _o, ...pub } = chat.files[id]; return { ...pub, url: fileUrl(id) }; };
const outMsg = ({ readSeq: _r, ...m }) => ({ ...m, attachment: m.attachment ? outAtt(m.attachment) : undefined });

/* Ждущие длинного опроса */
const waiters = new Set();
function wake(clientId) {
  for (const w of [...waiters]) {
    if (w.kind === 'staff' || w.client === Number(clientId)) { waiters.delete(w); clearTimeout(w.timer); w.done(); }
  }
}
function hold(ctx, kind, client, ready, reply) {
  const since = Number(ctx.query.since ?? -1);
  const wait = Math.min(Number(ctx.query.wait ?? 0), 30);
  if (!wait || since < 0 || ready(since)) return reply();
  const w = { kind, client, done: reply, timer: null };
  w.timer = setTimeout(() => { waiters.delete(w); reply(); }, wait * 1000);
  waiters.add(w);
  ctx.req.on('close', () => { if (waiters.delete(w)) clearTimeout(w.timer); });
}
const bump = () => ++chat.seq;
const newMsg = (from, text, attachment) => ({
  id: `c${Date.now().toString(36)}${crypto.randomBytes(3).toString('hex')}`,
  seq: bump(), from, text: String(text ?? '').trim().slice(0, 2000), at: new Date().toISOString(), read: false,
  ...(attachment ? { attachment } : {}),
});
const lastSeqOf = (id) => thread(id).reduce((n, m) => Math.max(n, m.seq, m.readSeq ?? 0), 0);
const seen = new Map(); // Idempotency-Key → message (повтор не задваивает)

function postMessage(ctx, clientId, from) {
  const key = ctx.req.headers['idempotency-key'];
  if (key && seen.has(key)) return send(ctx.res, 201, { message: outMsg(seen.get(key)) });
  const att = ctx.body.attachment_id ? String(ctx.body.attachment_id) : null;
  if (att && !chat.files[att]) return err(ctx.res, 422, 'bad_attachment', 'вложение не найдено');
  if (!String(ctx.body.text ?? '').trim() && !att) return err(ctx.res, 422, 'empty_message', 'пустое сообщение');
  const m = newMsg(from, ctx.body.text, att);
  thread(clientId).push(m);
  if (key) seen.set(key, m);
  saveChat(); wake(clientId);
  send(ctx.res, 201, { message: outMsg(m) });
}

function markRead(clientId, from) {
  let changed = false;
  for (const m of thread(clientId)) if (m.from === from && !m.read) { m.read = true; m.readSeq = chat.seq + 1; changed = true; }
  if (changed) { bump(); saveChat(); wake(clientId); }
}

route('GET', '/chat', (ctx) => {
  const { person, res } = ctx;
  if (!person) return err(res, 401, 'no_session');
  const id = person.telegram_id;
  markRead(id, 'studio');
  hold(ctx, 'client', id, (since) => lastSeqOf(id) > since, () => {
    if (res.writableEnded) return;
    markRead(id, 'studio');
    send(res, 200, { messages: thread(id).map(outMsg), seq: chat.seq });
  });
});
route('POST', '/chat', (ctx) => {
  if (!ctx.person) return err(ctx.res, 401, 'no_session');
  postMessage(ctx, ctx.person.telegram_id, 'client');
});
route('GET', '/chat/threads', (ctx) => {
  if (!needPin(ctx)) return;
  hold(ctx, 'staff', null, (since) => chat.seq > since, () => {
    if (ctx.res.writableEnded) return;
    const threads = Object.entries(chat.threads).filter(([, ms]) => ms.length).map(([id, ms]) => ({
      client_id: Number(id), name: nameOf(id),
      unread: ms.filter((m) => m.from === 'client' && !m.read).length,
      messages: ms.map(outMsg),
    }));
    send(ctx.res, 200, { threads, seq: chat.seq });
  });
});
route('POST', '/chat/threads/:id/reply', (ctx) => { if (needPin(ctx)) postMessage(ctx, Number(ctx.params[0]), 'studio'); });
route('POST', '/chat/threads/:id/read', (ctx) => {
  if (!needPin(ctx)) return;
  markRead(Number(ctx.params[0]), 'client');
  send(ctx.res, 200, { ok: true });
});

/* Вложение: сырой файл телом запроса. Фото ≤ 15 МБ, видео ≤ 60 МБ. */
const KINDS = { 'image/jpeg': 'image', 'image/png': 'image', 'image/webp': 'image', 'video/mp4': 'video', 'video/quicktime': 'video', 'video/webm': 'video' };
route('POST', '/chat/attachments', (ctx) => {
  if (!ctx.person) return err(ctx.res, 401, 'no_session');
  const mime = String(ctx.req.headers['content-type'] ?? '').split(';')[0];
  const kind = KINDS[mime];
  if (!kind) return err(ctx.res, 415, 'bad_type', 'Можно фото (JPEG, PNG, WebP) или видео (MP4, MOV, WebM)');
  const buf = ctx.raw;
  if (!buf?.length) return err(ctx.res, 422, 'empty_file');
  if (buf.length > (kind === 'image' ? 15 : 60) * 1024 * 1024) return err(ctx.res, 413, 'too_large', kind === 'image' ? 'Фото больше 15 МБ' : 'Видео больше 60 МБ');
  const id = crypto.randomBytes(12).toString('hex');
  fs.writeFileSync(path.join(FILES, id), buf);
  chat.files[id] = { id, kind, mime, size: buf.length, owner: ctx.person.telegram_id };
  saveChat();
  send(ctx.res, 201, { attachment: outAtt(id) });
});
/* Отдача по подписи; Range — без него Safari не играет видео */
route('GET', '/chat/files/:id', ({ req, res, params, query }) => {
  const [id] = params;
  const meta = chat.files[id];
  const exp = Number(query.exp);
  if (!meta || !exp || exp < Date.now() / 1000 || query.sig !== sign(id, exp)) return err(res, 403, 'bad_signature');
  const file = path.join(FILES, id);
  const size = fs.statSync(file).size;
  const range = /bytes=(\d*)-(\d*)/.exec(req.headers.range ?? '');
  const head = { 'Content-Type': meta.mime, 'Accept-Ranges': 'bytes', 'Cache-Control': 'private, max-age=3600' };
  if (range) {
    const start = range[1] ? Number(range[1]) : 0;
    const end = range[2] ? Math.min(Number(range[2]), size - 1) : size - 1;
    res.writeHead(206, { ...head, 'Content-Range': `bytes ${start}-${end}/${size}`, 'Content-Length': end - start + 1 });
    fs.createReadStream(file, { start, end }).pipe(res);
  } else {
    res.writeHead(200, { ...head, 'Content-Length': size });
    fs.createReadStream(file).pipe(res);
  }
});

route('GET', '/rates', async ({ res }) => send(res, 200, await nbgRate()));

/* ─── [ПРЕДЛОЖЕНИЕ] Загрузка снимка ──────────────────────────────────── */
/* В dev кладём файл в public/photos/uploads/ — vite отдаёт его сразу. Настоящий
   сервер положит в хранилище и отдаст относительный адрес `/photos/…` с того же домена. */
route('POST', '/uploads', (ctx) => {
  if (!needPin(ctx) || !isOwner(ctx.person)) return err(ctx.res, 403, 'forbidden');
  const { content_type, data } = ctx.body;
  if (content_type !== 'image/webp') return err(ctx.res, 415, 'bad_type');
  const buf = Buffer.from(String(data ?? ''), 'base64');
  if (!buf.length) return err(ctx.res, 422, 'invalid');
  if (buf.length > 4 * 1024 * 1024) return err(ctx.res, 413, 'too_large');
  if (buf.subarray(0, 4).toString() !== 'RIFF' || buf.subarray(8, 12).toString() !== 'WEBP') return err(ctx.res, 415, 'bad_type');
  const dir = process.env.STAND_DATA ? path.join(DATA, 'uploads') : path.join(ROOT, 'public/photos/uploads');
  fs.mkdirSync(dir, { recursive: true });
  const name = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}.webp`;
  fs.writeFileSync(path.join(dir, name), buf);
  send(ctx.res, 201, { url: `/photos/uploads/${name}` });
});

/* ─── [ПРЕДЛОЖЕНИЕ] Профиль студии ────────────────────────────────────── */
route('GET', '/studio', ({ res }) => send(res, 200, { studio: db.studio }));
route('PATCH', '/studio', (ctx) => {
  if (!needPin(ctx) || !isOwner(ctx.person)) return err(ctx.res, 403, 'forbidden');
  const p = ctx.body;
  if (!Object.keys(p).length) return err(ctx.res, 422, 'empty_patch');
  Object.assign(db.studio, p);
  send(ctx.res, 200, { studio: db.studio });
});

/* ─── [ПРЕДЛОЖЕНИЕ] Отзывы — только в приложении, на сервере ────────────
   Пишет любая клиентка с сессией; «был на приёме» — если у неё есть проведённый
   визит. Публикует владелица (модерация). Награда — за сам отзыв, при ЛЮБОЙ
   оценке: награда за высокие звёзды покупает оценки и делает их нечестными. */
const doneVisits = (tid) => db.bookings.filter((b) => b.telegram_id === tid && b.status === 'done').length;
const reviewOut = (r) => ({ id: r.id, name: r.name, rating: r.rating, text: r.text, service_slug: r.service_slug ?? null, created_at: r.created_at, reply: r.reply ?? null, verified: !!r.verified, publish_consent: r.consent !== false });
route('GET', '/reviews', ({ res }) => {
  const list = db.reviews.filter((r) => r.state === 'published').sort((a, b) => b.created_at.localeCompare(a.created_at));
  const avg = list.length ? list.reduce((n, r) => n + r.rating, 0) / list.length : null;
  send(res, 200, { reviews: list.map(reviewOut), count: list.length, avg: avg === null ? null : Math.round(avg * 10) / 10 });
});
route('POST', '/reviews', ({ res, person, body }) => {
  if (!person) return err(res, 401, 'no_session');
  const rating = Number(body.rating);
  const text = String(body.text ?? '').trim();
  if (!(rating >= 1 && rating <= 5 && Number.isInteger(rating))) return err(res, 422, 'bad_rating', 'Оценка — от 1 до 5 звёзд');
  if (text.length < 10) return err(res, 422, 'short_text', 'Напишите пару предложений — от 10 знаков');
  // Без согласия отзыв не публикуется никогда — его видит только студия; скидка за него та же
  if (db.reviews.some((x) => x.telegram_id === person.telegram_id && Date.now() - Date.parse(x.created_at) < 60_000)) return err(res, 429, 'too_often', 'Отзыв уже отправлен — спасибо!');
  const r = { id: `r${Date.now().toString(36)}`, telegram_id: person.telegram_id, name: person.first_name ?? 'Клиентка', rating, text: text.slice(0, 1200),
    service_slug: body.service_slug ?? null, consent: body.publish_consent === true, state: 'new', created_at: new Date().toISOString(), reply: null, verified: doneVisits(person.telegram_id) > 0 };
  db.reviews.push(r);
  rewardsOf(person.telegram_id).review = 'done';
  send(res, 201, { review: reviewOut(r), rewards: rewardsOut(person.telegram_id) });
});
route('GET', '/staff/reviews', (ctx) => {
  if (!needPin(ctx) || !isOwner(ctx.person)) return err(ctx.res, 403, 'forbidden');
  send(ctx.res, 200, { reviews: db.reviews.slice().reverse().map((r) => ({ ...reviewOut(r), state: r.state })) });
});
route('PATCH', '/reviews/:id', (ctx) => {
  if (!needPin(ctx) || !isOwner(ctx.person)) return err(ctx.res, 403, 'forbidden');
  const r = db.reviews.find((x) => x.id === ctx.params[0]);
  if (!r) return err(ctx.res, 404, 'not_found');
  if (ctx.body.state === 'published' && r.consent === false) return err(ctx.res, 409, 'no_consent', 'Клиентка не дала согласия на публикацию');
  if (['published', 'hidden', 'new'].includes(ctx.body.state)) r.state = ctx.body.state;
  if (ctx.body.reply !== undefined) r.reply = String(ctx.body.reply ?? '').slice(0, 600) || null;
  send(ctx.res, 200, { review: { ...reviewOut(r), state: r.state } });
});

/* ─── [ПРЕДЛОЖЕНИЕ] Скидки за действия: разово, −5% за каждое, до −20% ────
   profile — пройден Skin Profile (сервер видит результат) · invite — подруга
   открыла приложение по ссылке · story — сторис с отметкой (проверяет
   администратор) · review — оставлен отзыв. Скидка — на следующую процедуру,
   её считает сервер в quote; после проведённого визита — использована. */
const ACTIONS = ['profile', 'invite', 'story', 'review'];
const PER_ACTION = 5;
function rewardsOf(tid) {
  if (!db.rewards.has(tid)) db.rewards.set(tid, { profile: 'idle', invite: 'idle', story: 'idle', review: 'idle', story_proof: null, used: false });
  const r = db.rewards.get(tid);
  if (db.quizzes.get(tid)?.profile) r.profile = 'done';
  if ((db.referrals.get(tid) ?? []).length > 0) r.invite = 'done';
  return r;
}
function rewardsOut(tid) {
  const r = rewardsOf(tid);
  const done = ACTIONS.filter((a) => r[a] === 'done').length;
  return { actions: Object.fromEntries(ACTIONS.map((a) => [a, r[a]])), per_action: PER_ACTION, percent: r.used ? 0 : done * PER_ACTION, max_percent: ACTIONS.length * PER_ACTION, used: r.used };
}
route('GET', '/me/rewards', ({ res, person }) => person ? send(res, 200, { rewards: rewardsOut(person.telegram_id) }) : err(res, 401, 'no_session'));
route('POST', '/me/rewards/story', ({ res, person, body }) => {
  if (!person) return err(res, 401, 'no_session');
  const proof = String(body.proof ?? '').trim();
  if (proof.length < 3) return err(res, 422, 'bad_proof', 'Пришлите ссылку на сторис или ник');
  const r = rewardsOf(person.telegram_id);
  if (r.story === 'done') return err(res, 409, 'already_done');
  r.story = 'pending'; r.story_proof = proof; r.story_at = new Date().toISOString(); r.story_name = person.first_name;
  send(res, 200, { rewards: rewardsOut(person.telegram_id) });
});
route('GET', '/staff/rewards/pending', (ctx) => {
  if (!needPin(ctx) || !(isOwner(ctx.person) || ctx.person.role === 'admin')) return err(ctx.res, 403, 'forbidden');
  const list = [...db.rewards.entries()].filter(([, r]) => r.story === 'pending').map(([tid, r]) => ({
    client_id: tid, name: r.story_name ?? Object.values(PEOPLE).find((x) => x.telegram_id === tid)?.first_name ?? `Клиентка ${tid}`, action: 'story', proof: r.story_proof, sent_at: r.story_at,
  }));
  send(ctx.res, 200, { pending: list });
});
route('POST', '/staff/rewards/:id/:verdict', (ctx) => {
  if (!needPin(ctx) || !(isOwner(ctx.person) || ctx.person.role === 'admin')) return err(ctx.res, 403, 'forbidden');
  const r = rewardsOf(Number(ctx.params[0]));
  r.story = ctx.params[1] === 'approve' ? 'done' : 'idle';
  send(ctx.res, 200, { rewards: rewardsOut(Number(ctx.params[0])) });
});

/* ─── [ПРЕДЛОЖЕНИЕ] Главы паспорта ──────────────────────────────────────
   доступно = проведённых процедур + ⌊подруг с проведённой процедурой / N⌋ − открытых */
const PAID_QUIZ = new Set(['skintype', 'aging', 'sensitivity', 'glow', 'homecare', 'morphotype']);
function passportOf(id) {
  const rules = db.studio.passport_rules ?? { enabled: false, friends_per_chapter: 2 };
  const doneBy = (tid) => db.bookings.filter((b) => b.telegram_id === tid && b.status === 'done').length;
  const visits = doneBy(id);
  const friends = (db.referrals.get(id) ?? []).filter((f) => doneBy(f) > 0).length;
  const unlocked = [...(db.chapters.get(id) ?? new Set())];
  const n = Math.max(1, Number(rules.friends_per_chapter) || 2);
  const earned = rules.enabled ? visits + Math.floor(friends / n) : 0;
  return { enabled: !!rules.enabled, credits: Math.max(0, earned - unlocked.length), unlocked, visits_done: visits, friends_done: friends, friends_per_chapter: n };
}
route('GET', '/me/passport', ({ res, person }) => person ? send(res, 200, { passport: passportOf(person.telegram_id) }) : err(res, 401, 'no_session'));
route('POST', '/me/passport/unlock', ({ res, person, body }) => {
  if (!person) return err(res, 401, 'no_session');
  const q = String(body.quiz_id ?? '');
  if (!PAID_QUIZ.has(q)) return err(res, 422, 'not_paid_quiz');
  const p = passportOf(person.telegram_id);
  if (p.unlocked.includes(q)) return err(res, 409, 'already_open');
  if (p.credits < 1) return err(res, 409, 'no_credits', 'Пока нечем открыть главу');
  db.chapters.set(person.telegram_id, new Set([...p.unlocked, q]));
  send(res, 200, { passport: passportOf(person.telegram_id) });
});
/* Демо: привязать подругу к пригласившей (в бою это делает бот по start=ref_<id>) */
route('POST', '/dev/referral', ({ res, body }) => {
  const list = db.referrals.get(Number(body.inviter)) ?? [];
  list.push(Number(body.friend));
  db.referrals.set(Number(body.inviter), list);
  send(res, 200, { ok: true });
});

/* ─── [ПРЕДЛОЖЕНИЕ] Акции ─────────────────────────────────────────────── */
route('GET', '/promos', ({ res, person }) => {
  const now = new Date().toISOString();
  const list = isOwner(person) ? db.promos : db.promos.filter((p) => p.active && p.starts_at <= now && p.ends_at >= now);
  send(res, 200, { promos: list });
});
route('POST', '/promos', (ctx) => {
  if (!needPin(ctx) || !isOwner(ctx.person)) return err(ctx.res, 403, 'forbidden');
  const b = ctx.body;
  if (!String(b.title?.ru ?? '').trim()) return err(ctx.res, 422, 'bad_title');
  const p = { id: `p${db.promos.length + 1}`, active: true, created_at: new Date().toISOString(), ...b };
  db.promos.push(p);
  send(ctx.res, 201, { promo: p });
});
route('PATCH', '/promos/:id', (ctx) => {
  if (!needPin(ctx) || !isOwner(ctx.person)) return err(ctx.res, 403, 'forbidden');
  const p = db.promos.find((x) => x.id === ctx.params[0]);
  if (!p) return err(ctx.res, 404, 'not_found');
  Object.assign(p, ctx.body);
  send(ctx.res, 200, { promo: p });
});
route('DELETE', '/promos/:id', (ctx) => {
  if (!needPin(ctx) || !isOwner(ctx.person)) return err(ctx.res, 403, 'forbidden');
  db.promos = db.promos.filter((x) => x.id !== ctx.params[0]);
  send(ctx.res, 200, { deleted: ctx.params[0] });
});

/* Демо: загруженные владелицей фото лежат в /tmp — отдаём их сами
   (vercel.json переписывает /photos/uploads/* сюда) */
route('GET', '/uploads-file/:name', ({ res, params }) => {
  const name = path.basename(params[0]);
  const file = path.join(DATA, 'uploads', name);
  if (!/^[a-z0-9]+\.webp$/.test(name) || !fs.existsSync(file)) return err(res, 404, 'not_found');
  res.writeHead(200, { 'Content-Type': 'image/webp', 'Cache-Control': 'public, max-age=3600' });
  fs.createReadStream(file).pipe(res);
});

/* ─── Сервер ──────────────────────────────────────────────────────────── */

/* ─── [ПРЕДЛОЖЕНИЕ] Закладки и напоминания в боте ──────────────────────────
   «Хотели сделать»: процедура в закладках ≥ 3 дней, записи на неё нет, у
   мастера есть окно в ближайшие 3 дня → одно сообщение с этим окном.
   «Пора повторить»: прошло repeat_after_days после проведённого визита,
   новой записи на процедуру нет → сообщение с ближайшим окном.
   Не чаще раза в неделю на человека; выключается в настройках; без права
   писать (can_message=false) не шлём. Шлёт сервер (cron раз в час в часы
   студии); здесь — прогон «что ушло бы» для проверки. */
route('GET', '/me/favorites', ({ res, person }) => {
  if (!person) return err(res, 401, 'no_session');
  const f = db.favorites.get(person.telegram_id);
  send(res, 200, { slugs: f?.slugs ?? [], updated_at: f?.updated_at ?? null });
});
route('PUT', '/me/favorites', ({ res, person, body }) => {
  if (!person) return err(res, 401, 'no_session');
  if (!Array.isArray(body?.slugs)) return err(res, 422, 'bad_slugs');
  const known = new Set(db.services.map((x) => x.slug));
  const slugs = [...new Set(body.slugs.filter((x) => typeof x === 'string' && known.has(x)))].slice(0, 50);
  const prev = db.favorites.get(person.telegram_id) ?? { slugs: [], added: {} };
  const now = new Date().toISOString();
  const added = {};
  for (const sl of slugs) added[sl] = prev.added?.[sl] ?? now;
  db.favorites.set(person.telegram_id, { slugs, added, updated_at: now });
  send(res, 200, { slugs, updated_at: now });
});

const DAY = 86_400_000;
const tbilisiDate = (t) => new Date(t + 4 * 3600_000).toISOString().slice(0, 10);
function firstWindow(fromMs, staffId, days = 3) {
  for (let d = 0; d <= days; d++) {
    const ds = tbilisiDate(fromMs + d * DAY);
    const s = slotsFor(ds, staffId, 60).find((x) => Date.parse(x.starts_at) > fromMs + 2 * 3600_000);
    if (s) return s;
  }
  return null;
}
const svcTitle = (slug) => db.services.find((x) => x.slug === slug)?.title?.ru ?? slug;
const whenEn = (iso) => new Date(iso).toLocaleString('en-US', { timeZone: 'Asia/Tbilisi', weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
const svcTitleEn = (slug) => db.services.find((x) => x.slug === slug)?.title?.en || svcTitle(slug);
const whenRu = (iso) => new Date(iso).toLocaleString('ru-RU', { timeZone: 'Asia/Tbilisi', weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
const deepLink = (slug, iso) => {
  const t = new Date(Date.parse(iso) + 4 * 3600_000).toISOString();
  return `https://t.me/anzh_cosmetology_bot/app?startapp=book_${slug}_${t.slice(0, 10).replace(/-/g, '')}${t.slice(11, 16).replace(':', '')}`;
};
const hasOpenBooking = (tid, slug, afterMs = 0) => db.bookings.some((b) => b.telegram_id === tid && ['pending', 'confirmed'].includes(b.status)
  && Date.parse(b.starts_at) > afterMs && b.items.some((i) => i.slug === slug));

/** Кому что сейчас ушло бы. nowMs можно сдвинуть — проверка «через N дней». */
function remindersPlan(nowMs, { ignoreWeekly = false, ignoreAge = false } = {}) {
  const out = [];
  const people = new Set([...db.favorites.keys(), ...db.bookings.filter((b) => b.status === 'done').map((b) => b.telegram_id)]);
  for (const tid of people) {
    const prefs = { favorites: true, repeat: true, ...(db.prefs.get(tid) ?? {}) };
    const last = db.reminded.get(tid);
    if (!ignoreWeekly && last && nowMs - Date.parse(last) < 7 * DAY) continue;
    const name = Object.values(PEOPLE).find((x) => x.telegram_id === tid)?.first_name ?? db.bookings.find((b) => b.telegram_id === tid)?.client_name ?? `Клиентка ${tid}`;
    let msg = null;
    // Повтор важнее закладки: это продолжение лечения, а не желание
    if (prefs.repeat) {
      for (const b of db.bookings.filter((x) => x.telegram_id === tid && x.status === 'done').sort((a, c) => c.starts_at.localeCompare(a.starts_at))) {
        for (const it of b.items) {
          const svc = db.services.find((x) => x.slug === it.slug);
          const n = svc?.repeat_after_days;
          if (!n) continue;
          const due = Date.parse(b.starts_at) + n * DAY;
          if (due > nowMs || hasOpenBooking(tid, it.slug, Date.parse(b.starts_at))) continue;
          const w = firstWindow(nowMs, b.staff_id);
          if (!w) continue;
          msg = { kind: 'repeat_due', slug: it.slug, slot: w.starts_at,
            text_ru: `${name}, прошло ${Math.round((nowMs - Date.parse(b.starts_at)) / DAY)} дн. после процедуры «${svcTitle(it.slug)}» — пора повторить. Ближайшее окно у мастера: ${whenRu(w.starts_at)}.`,
            text_en: `${name}, it’s been ${Math.round((nowMs - Date.parse(b.starts_at)) / DAY)} days since “${svcTitleEn(it.slug)}” — time to repeat. Next free slot: ${whenEn(w.starts_at)}.`,
            button: 'Записаться', link: deepLink(it.slug, w.starts_at) };
          break;
        }
        if (msg) break;
      }
    }
    if (!msg && prefs.favorites) {
      const f = db.favorites.get(tid);
      for (const slug of f?.slugs ?? []) {
        const age = nowMs - Date.parse(f.added?.[slug] ?? f.updated_at);
        if (!ignoreAge && age < 3 * DAY) continue;
        if (hasOpenBooking(tid, slug)) continue;
        const w = firstWindow(nowMs, PEOPLE.owner.telegram_id);
        if (!w) continue;
        msg = { kind: 'favorite_window', slug, slot: w.starts_at,
          text_ru: `${name}, вы хотели «${svcTitle(slug)}» — у Анжелики есть окно: ${whenRu(w.starts_at)}. Записаться можно в один тап.`,
          text_en: `${name}, you saved “${svcTitleEn(slug)}” — Anjelika has a free slot: ${whenEn(w.starts_at)}. Book in one tap.`,
          button: 'Записаться', link: deepLink(slug, w.starts_at) };
        break;
      }
    }
    if (msg) out.push({ telegram_id: tid, name, ...msg });
  }
  return out;
}
route('POST', '/dev/reminders/run', ({ res, body }) => {
  const shift = Number(body?.shift_days) || 0;
  const nowMs = Date.now() + shift * DAY;
  const list = remindersPlan(nowMs, { ignoreWeekly: !!body?.ignore_weekly, ignoreAge: !!body?.ignore_age });
  if (!body?.dry) for (const r of list) db.reminded.set(r.telegram_id, new Date(nowMs).toISOString());
  send(res, 200, { now: new Date(nowMs).toISOString(), sent: list });
});


/* ─── Покупки разборов (стенд/демо) ───────────────────────────────────────
   GET /me/purchases — как у боевого сервера. POST /dev/purchase — только
   демо: записывает покупку без Telegram-счёта, чтобы в прототипе можно было
   пройти разбор целиком (боевая сборка эту ручку не зовёт). */
route('GET', '/me/purchases', ({ res, person }) => person
  ? send(res, 200, { purchases: db.purchases.get(person.telegram_id) ?? [] })
  : err(res, 401, 'no_session'));
route('POST', '/dev/purchase', ({ res, person, body }) => {
  if (!person) return err(res, 401, 'no_session');
  const slug = String(body?.product_slug ?? '');
  if (!/^[a-z0-9-]{2,40}$/.test(slug)) return err(res, 422, 'bad_product');
  const list = db.purchases.get(person.telegram_id) ?? [];
  if (!list.some((x) => x.product_slug === slug && x.status === 'paid')) {
    const covers = Array.isArray(body?.covers) ? body.covers.filter((x) => typeof x === 'string').slice(0, 10) : [slug];
    list.push({ product_slug: slug, product_kind: slug === 'bundle' ? 'bundle' : 'analysis', status: 'paid', paid_at: new Date().toISOString(), covers });
  }
  db.purchases.set(person.telegram_id, list);
  send(res, 200, { purchases: list });
});

export async function handle(req, res) {
  const url = new URL(req.url, 'http://x');
  const p = url.pathname.replace(/^\/api\/v1/, '') || '/';
  const tok = tokenOf(req);
  const ctx = {
    req, res, tok, person: personOf(tok), query: Object.fromEntries(url.searchParams), body: {}, params: [],
  };
  const ct = String(req.headers['content-type'] ?? '');
  if (req.method === 'POST' && ct && !ct.startsWith('application/json')) ctx.raw = await readRaw(req);
  else if (req.method !== 'GET' && req.method !== 'DELETE') ctx.body = await readBody(req);
  for (const h of handlers) {
    if (h.method !== req.method) continue;
    const m = h.re.exec(p);
    if (!m) continue;
    ctx.params = m.slice(1).map(decodeURIComponent);
    try { await h.fn(ctx); } catch (e) { console.error('[stand]', req.method, p, e); err(res, 500, 'internal'); }
    return;
  }
  console.warn('[stand] нет ручки:', req.method, p);
  err(res, 404, 'not_found', `нет ручки ${req.method} ${p}`);
}

const SEED = await loadSeed();
/* Демо: несколько отзывов-примеров, чтобы блок не был пустым на показе.
   Помечены как пример в имени — в бою отзывы пишут только клиентки. */
db.reviews.push(
  { id: 'rdemo1', telegram_id: 0, name: 'Пример · Нино', rating: 5, text: 'Делала губы у Анжелики — аккуратно, естественно, без боли. Всё объяснила до процедуры и написала, как ухаживать после.', service_slug: 'lip-filler', state: 'published', created_at: '2026-10-02T10:00:00.000Z', reply: null, verified: true },
  { id: 'rdemo2', telegram_id: 0, name: 'Пример · Мария', rating: 5, text: 'Атмосфера в студии очень уютная, встретили с кофе. Биоревитализация — кожа стала свежее уже через неделю.', service_slug: 'biorevit', state: 'published', created_at: '2026-09-20T10:00:00.000Z', reply: 'Спасибо, Мария! Ждём на второй сеанс курса.', verified: true },
  { id: 'rdemo3', telegram_id: 0, name: 'Пример · Софи', rating: 4, text: 'Хороший результат по скулам, но пришлось подождать минут 15. Анжелика — профессионал, вернусь.', service_slug: 'contour-plastic', state: 'published', created_at: '2026-09-05T10:00:00.000Z', reply: null, verified: true },
  { id: 'rdemo4', telegram_id: 0, name: 'Пример · Тамара', rating: 5, text: 'Ботокс на лоб сделали за 20 минут, ничего не болело. Через две недели — естественный результат, мимика осталась.', service_slug: 'botulinum', state: 'published', created_at: '2026-08-28T10:00:00.000Z', reply: null, verified: true },
  { id: 'rdemo5', telegram_id: 0, name: 'Пример · Ольга', rating: 5, text: 'Чистка лица — лучшая в Батуми. Кожа ровная, без покраснения на следующий день. Анжелика подсказала домашний уход.', service_slug: 'deep-cleansing', state: 'published', created_at: '2026-08-15T10:00:00.000Z', reply: 'Ольга, спасибо! Через месяц — следующая чистка.', verified: true },
  { id: 'rdemo6', telegram_id: 0, name: 'Пример · Ани', rating: 5, text: 'Мезотерапия курсом — кожа стала плотнее и свежее. Всё по делу, ничего лишнего не навязывали.', service_slug: 'mesotherapy', state: 'published', created_at: '2026-08-02T10:00:00.000Z', reply: null, verified: true },
  { id: 'rdemo7', telegram_id: 0, name: 'Пример · Екатерина', rating: 5, text: 'Нити на овал. Боялась, но Анжелика всё объяснила, результат видно сразу. Очень аккуратная работа.', service_slug: 'mono-threads', state: 'published', created_at: '2026-07-21T10:00:00.000Z', reply: null, verified: true },
  { id: 'rdemo8', telegram_id: 0, name: 'Пример · Лиза', rating: 5, text: 'Растворила неудачный филлер из другой клиники и потом сделала губы заново. Наконец-то естественно.', service_slug: 'filler-dissolve', state: 'published', created_at: '2026-07-09T10:00:00.000Z', reply: null, verified: true },
  { id: 'rdemo9', telegram_id: 0, name: 'Пример · Наталья', rating: 5, text: 'Коллагеностимулятор — через месяц кожа подтянулась. Уютно, вовремя, без очередей.', service_slug: 'collagen-stimulators', state: 'published', created_at: '2026-06-30T10:00:00.000Z', reply: null, verified: true },
  { id: 'rdemo10', telegram_id: 0, name: 'Пример · Майя', rating: 5, text: 'Хожу на биоревитализацию второй курс. Анжелика помнит всё про мою кожу и каждый раз объясняет, что делаем.', service_slug: 'biorevit', state: 'published', created_at: '2026-06-12T10:00:00.000Z', reply: null, verified: true },
);
db.services = (Array.isArray(SEED) ? SEED : SEED.services).map(wire);
/* Команда — из data/team.ts; ключ профиля → человек стенда */
const KEY_TO_PERSON = { anzhelika: 'owner', mariya: 'maria', ekaterina: 'ekaterina', roman: 'roman', darya: 'admin' };
db.team = (Array.isArray(SEED) ? [] : SEED.team).map((t) => {
  const who = PEOPLE[KEY_TO_PERSON[t.key]];
  if (!who) return null;
  return {
    telegram_id: who.telegram_id, name: who.name, title: who.title, role: who.role,
    photo_url: t.photo_url, services: t.services,
    profile: { key: t.key, name: t.name, surname: t.surname, role: t.role, short: t.short, focus: t.focus, cred: t.cred, does: t.does,
      instagram: null, telegram: null, phone: null, contacts_public: false, visible: t.visible, sort: t.sort },
  };
}).filter(Boolean);
seedBookings();

// Запуск руками (node tools/dev-stand.mjs) — свой порт; импорт из функции Vercel — только handle
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  http.createServer(handle).listen(PORT, () => console.log(`[stand] http://localhost:${PORT} · сервисов ${db.services.length} · PIN ${PIN}`));
}
