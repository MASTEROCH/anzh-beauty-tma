-- 006 · Деньги и мотивация: покупки за Stars, задания, отзывы, баллы.

-- Покупки платных разборов за Telegram Stars (контракт §8).
create table anzh.purchases (
  id            uuid primary key default gen_random_uuid(),
  telegram_id   bigint not null,

  product_kind  text not null check (product_kind in ('analysis','analysis_bundle','training')),
  -- Что именно куплено: services.slug либо идентификатор набора.
  product_slug  text not null,

  stars_amount  integer not null check (stars_amount >= 0),

  -- 🚨 Ключ идемпотентности оплаты (контракт §8.3). Telegram ПОВТОРЯЕТ
  -- доставку successful_payment. Без уникальности одна оплата запишется
  -- несколько раз и доступ выдастся дважды.
  telegram_payment_charge_id text not null unique,
  provider_payment_charge_id text,
  -- Полезная нагрузка счёта: по ней вебхук понимает, за что платили.
  invoice_payload text not null,

  -- Возврат не редкий случай: доступ отзывается вместе со статусом
  -- (контракт §8.5).
  status        text not null default 'paid' check (status in ('paid','refunded')),
  refunded_at   timestamptz,

  app_source    text not null default 'beauty',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  metadata      jsonb not null default '{}'
);

create index purchases_by_person on anzh.purchases (telegram_id, created_at desc);

create trigger purchases_touch before update on anzh.purchases
  for each row execute function anzh.touch_updated_at();


-- Отзывы. Один из трёх способов заработать скидку.
create table anzh.reviews (
  id           uuid primary key default gen_random_uuid(),
  telegram_id  bigint not null,
  booking_id   uuid references anzh.bookings (id),
  service_id   uuid references anzh.services (id),
  rating       smallint not null check (rating between 1 and 5),
  body         text,
  photo_url    text,
  -- Публикуется только после просмотра мастером: отзыв — публичный текст.
  published    boolean not null default false,

  app_source   text not null default 'beauty',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  deleted_at   timestamptz,

  -- Один отзыв на визит.
  unique (booking_id)
);

create index reviews_published on anzh.reviews (created_at desc)
  where published and deleted_at is null;

create trigger reviews_touch before update on anzh.reviews
  for each row execute function anzh.touch_updated_at();


-- Задания на скидку: 10% за задание, максимум 30% (SPEC §3.8).
--
-- Отдельная таблица со ссылкой на ОСНОВАНИЕ (контракт §4.7): при разборе
-- спорного случая видно, откуда взялись проценты.
create table anzh.quest_completions (
  id            uuid primary key default gen_random_uuid(),
  telegram_id   bigint not null,
  kind          text not null check (kind in ('review','invite','story')),
  percent       smallint not null check (percent between 0 and 100),

  -- Чем подтверждается. Отзыв и приглашение — автоматически, сервер
  -- видит строку. Сторис — вручную мастером: автоматически проверить
  -- нельзя, и подтверждение человеком здесь правильное решение, а не
  -- временное (контракт §4.7).
  basis_table   text not null check (basis_table in ('reviews','referrals','manual')),
  basis_id      uuid,
  confirmed_by  bigint,          -- мастер, если подтверждал человек
  confirmed_at  timestamptz,

  -- Скидка начисляется один раз за одну приглашённую (контракт §4.6,
  -- правило 3). Ключ — та же строка в referrals.
  unique (kind, basis_id),

  app_source    text not null default 'beauty',
  created_at    timestamptz not null default now()
);

create index quests_by_person on anzh.quest_completions (telegram_id, created_at);


-- Баллы лояльности. Движения, а не остаток: остаток выводится суммой и
-- всегда объясним, а перезаписываемое число объяснить нечем.
create table anzh.loyalty_ledger (
  id           uuid primary key default gen_random_uuid(),
  telegram_id  bigint not null,
  delta        integer not null,
  reason       text not null
                 check (reason in ('visit','review','referral','manual','redeem')),
  booking_id   uuid references anzh.bookings (id),
  comment      text,
  created_by   bigint,
  app_source   text not null default 'beauty',
  created_at   timestamptz not null default now()
);

create index loyalty_by_person on anzh.loyalty_ledger (telegram_id, created_at);
