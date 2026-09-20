-- 002 · Люди: клиентки, сотрудники, приглашения.
--
-- Ключ человека — telegram_id bigint (контракт §3.1). Не UUID, не
-- автоинкремент, не ник (меняется), не телефон (у клиенток Анжелики его
-- часто нет). Своя таблица пользователей с собственным идентификатором
-- потребовала бы при слиянии баз таблицы соответствий на каждую ссылку.

create table anzh.users (
  telegram_id     bigint primary key,

  -- Реферальный код: 6 символов [A-Za-z0-9], выдаётся один раз при первом
  -- входе и не меняется НИКОГДА (контракт §4.2). Розданные ссылки лежат в
  -- чужих переписках и переживут все релизы.
  referral_code   text not null unique
                    check (referral_code ~ '^[A-Za-z0-9]{6}$'),
  -- Кто привёл. Ставится один раз, при первом появлении start_param.
  referred_by     bigint,

  -- Профиль из initData. Обновляется при каждом входе — человек меняет
  -- имя и ник, а мастеру нужно видеть актуальное.
  first_name      text,
  last_name       text,
  username        text,
  language_code   text,
  photo_url       text,

  -- Право писать в Telegram. Бот пишет только тем, кто его запускал
  -- (контракт §9). Снимается при ответе 403 bot was blocked by the user.
  can_message     boolean not null default false,
  -- Отписка по каждому типу отдельно, тоже §9.
  notify_reminders  boolean not null default true,
  notify_review     boolean not null default true,
  notify_marketing  boolean not null default false,

  app_source      text not null default 'beauty',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  deleted_at      timestamptz,
  metadata        jsonb not null default '{}',

  -- Самоприглашение запрещено (контракт §4.6, правило 2). Проверяется и в
  -- коде, и здесь: код можно обойти новым эндпоинтом, базу — нельзя.
  constraint users_no_self_referral check (referred_by is distinct from telegram_id)
);

create index users_referred_by_idx on anzh.users (referred_by)
  where referred_by is not null;

create trigger users_touch before update on anzh.users
  for each row execute function anzh.touch_updated_at();


-- Привязка приглашения. Отдельно от users.referred_by: users хранит
-- «кто привёл» как отметку о первом появлении человека в экосистеме
-- (при переносе она НЕ перезаписывается, контракт §14.1), а referrals —
-- событие приглашения внутри конкретного приложения.
create table anzh.referrals (
  id            uuid primary key default gen_random_uuid(),
  referrer_id   bigint not null,
  referred_id   bigint not null,
  app_source    text not null default 'beauty',
  created_at    timestamptz not null default now(),

  -- Одна привязка на человека навсегда (контракт §4.6, правило 1).
  unique (referred_id, app_source),
  constraint referrals_no_self check (referrer_id <> referred_id)
);

create index referrals_referrer_idx on anzh.referrals (referrer_id);


-- Сотрудники студии. Право даёт telegram_id, а не PIN (контракт §3.4).
-- PIN остаётся вторым фактором и хранится только хэшем.
create table anzh.staff (
  telegram_id   bigint primary key,
  name          text not null,
  -- Должность как её называют клиенткам: косметолог, администратор,
  -- мастер по бровям, дерматолог.
  title         text,
  role          text not null check (role in ('staff', 'owner')),
  -- scrypt, формат «N:r:p:соль:хэш» в hex. Открытым текстом — никогда.
  pin_hash      text,
  photo_url     text,
  active        boolean not null default true,

  app_source    text not null default 'beauty',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  deleted_at    timestamptz,
  metadata      jsonb not null default '{}'
);

create trigger staff_touch before update on anzh.staff
  for each row execute function anzh.touch_updated_at();
