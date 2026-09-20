-- 003 · Прайс: процедуры, обучение, разборы кожи.
--
-- Каталог правится из кабинета мастера — отдельной админки нет
-- (контракт §2.1). Поэтому цена, длительность и состав живут в базе, а не
-- в коде фронтенда, как сейчас в прототипе.

create table anzh.services (
  id              uuid primary key default gen_random_uuid(),
  -- Человекочитаемый идентификатор: он попадает в ссылку-приглашение на
  -- конкретную процедуру (ref_<код>__service-peeling, контракт §4.4) и в
  -- адрес экрана. uuid в ссылке нечитаем, а порядковый номер выдал бы
  -- размер прайса.
  slug            text not null unique
                    check (slug ~ '^[a-z0-9]([a-z0-9-]*[a-z0-9])?$'),

  kind            text not null default 'procedure'
                    check (kind in ('procedure', 'training', 'analysis')),
  category        text not null
                    check (category in ('inj','clean','peel','apparatus','care','derma','brows','training','analysis')),
  -- Зона работы. Используется правилами сочетаемости: процедуры разных зон
  -- почти всегда делаются за один приход.
  zone            text not null default 'face'
                    check (zone in ('face','body','brows','general')),

  title_ru        text not null,
  title_en        text not null,
  subtitle_ru     text,
  subtitle_en     text,
  description_ru  text,
  description_en  text,

  -- Деньги — целое в минорных единицах (контракт §5.3). 4500 = 45.00.
  price_minor     bigint check (price_minor >= 0),
  currency        char(3) check (currency ~ '^[A-Z]{3}$'),
  -- Telegram Stars — ОТДЕЛЬНОЕ поле, не валюта ISO-4217. Другой получатель
  -- и другой учёт, смешивать с выручкой салона нельзя (контракт §5.3).
  stars_amount    integer check (stars_amount >= 0),
  -- Цена «от»: объём филлера заранее не известен.
  price_from      boolean not null default false,

  duration_min    integer check (duration_min > 0),
  -- Для обучения: сколько дней. У процедур пусто.
  days            integer check (days > 0),

  -- Что входит и противопоказания — списки строк на двух языках.
  -- jsonb, а не отдельная таблица: читаются всегда целиком и никогда не
  -- ищутся по отдельному пункту.
  includes        jsonb not null default '[]',
  -- Противопоказания сверяются с анкетой клиентки перед подтверждением
  -- записи. Формулировки важны: по ним поднимается красный флаг.
  contraindications jsonb not null default '[]',

  photo_url       text,
  sort            integer not null default 0,
  -- Процедура снимается с витрины, но остаётся в истории визитов
  -- (контракт §2.2: мягкое удаление).
  archived_at     timestamptz,

  app_source      text not null default 'beauty',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  deleted_at      timestamptz,
  metadata        jsonb not null default '{}'
);

-- Витрина: только живое, в заданном порядке.
create index services_live_idx on anzh.services (sort, id)
  where archived_at is null and deleted_at is null;

create trigger services_touch before update on anzh.services
  for each row execute function anzh.touch_updated_at();


-- Кто какие процедуры ведёт. По этой таблице маршрутизируются заявки.
create table anzh.staff_services (
  staff_id    bigint not null references anzh.staff (telegram_id) on delete cascade,
  service_id  uuid   not null references anzh.services (id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (staff_id, service_id)
);

create index staff_services_by_service on anzh.staff_services (service_id);
