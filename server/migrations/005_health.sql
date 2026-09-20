-- 005 · Данные о здоровье — отдельный режим (контракт §6).
--
-- 🔴 ЮРИДИЧЕСКИЙ СТОП-ЛИСТ. Схема готова, но запускать её на реальных
-- клиентках нельзя до ответов на вопросы §1 контракта (кто оператор
-- данных, на каком основании, сколько хранит, трансграничная передача).
-- См. ОТЧЁТ-§1.md. Для отладки — тестовые данные.
--
-- Почему отдельные таблицы, а не колонки в профиле: когда понадобится
-- дать доступ к базе клиентов бухгалтеру или маркетологу, медицинская
-- часть не должна уехать вместе с ней.

-- Три разных согласия, а не одна галочка (контракт §6.2).
create table anzh.consents (
  id             uuid primary key default gen_random_uuid(),
  telegram_id    bigint not null,
  kind           text not null
                   check (kind in ('health_data','photo_publish','marketing')),
  -- На какую версию текста согласились. Текст меняется — старые согласия
  -- остаются привязанными к своей версии.
  policy_version text not null,
  granted_at     timestamptz not null default now(),
  -- Отзыв согласия ОБЯЗАН работать.
  revoked_at     timestamptz,
  app_source     text not null default 'beauty'
);

-- Действующее согласие одного вида на человека — одно.
create unique index consents_active_unique on anzh.consents (telegram_id, kind, app_source)
  where revoked_at is null;
create index consents_by_person on anzh.consents (telegram_id, granted_at desc);


-- Анкета здоровья. Специальная категория персональных данных.
create table anzh.health_profiles (
  telegram_id    bigint primary key,
  -- Ответы анкеты одним документом: читаются всегда целиком, по
  -- отдельному полю не ищутся. Разносить по колонкам — значит менять
  -- схему при каждой новой строке анкеты.
  answers        jsonb not null default '{}',
  -- Версия текста согласия, под которым анкета заполнена.
  policy_version text not null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  deleted_at     timestamptz,
  app_source     text not null default 'beauty'
);

create trigger health_profiles_touch before update on anzh.health_profiles
  for each row execute function anzh.touch_updated_at();


-- Разборы кожи ANZH: 7 разборов, 86 вопросов, 38 исходов.
create table anzh.analyses (
  id             uuid primary key default gen_random_uuid(),
  telegram_id    bigint not null,
  -- Какой разбор: совпадает с services.slug у строк kind = 'analysis'.
  analysis_slug  text not null,
  answers        jsonb not null default '{}',
  -- Идентификатор исхода из методологии.
  outcome        text,
  completed_at   timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  deleted_at     timestamptz,
  app_source     text not null default 'beauty'
);

-- Один незавершённый проход разбора на человека: повторное открытие
-- продолжает прежний, а не плодит черновики.
create unique index analyses_open_unique on anzh.analyses (telegram_id, analysis_slug)
  where completed_at is null and deleted_at is null;
create index analyses_by_person on anzh.analyses (telegram_id, created_at desc);

create trigger analyses_touch before update on anzh.analyses
  for each row execute function anzh.touch_updated_at();


-- Журнал доступа (контракт §6.3). Каждое чтение чужой анкеты мастером —
-- строка: кто, чью, когда. Это спрашивают первым при любой проверке, и
-- это же защищает саму Анжелику, если данные утекут.
--
-- Только на добавление. Ни update, ни delete в коде быть не должно.
create table anzh.health_access_log (
  id           bigserial primary key,
  actor_id     bigint not null,      -- кто смотрел
  subject_id   bigint not null,      -- чью анкету
  object       text   not null
                 check (object in ('health_profile','analysis','client_card')),
  -- Зачем смотрел: идентификатор записи, из-за которой открыли карточку.
  reason_id    uuid,
  at           timestamptz not null default now()
);

create index health_access_by_subject on anzh.health_access_log (subject_id, at desc);
create index health_access_by_actor on anzh.health_access_log (actor_id, at desc);
