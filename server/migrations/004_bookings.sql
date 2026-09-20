-- 004 · Записи. Ядро продукта.
--
-- Продуктовое правило Анжелики (SPEC §3.4): клиентка оставляет ЗАЯВКУ,
-- подтверждает её человек. Заявки друг друга не блокируют — блокирует
-- только подтверждение. Поэтому ограничение уникальности ниже висит на
-- status = 'confirmed', а не на всех записях подряд.

create table anzh.bookings (
  id              uuid primary key default gen_random_uuid(),
  telegram_id     bigint not null,     -- клиентка
  staff_id        bigint not null,     -- мастер, тоже telegram_id

  -- UTC. Часовой пояс салона — параметр конфигурации, не константа
  -- (контракт §5.3). Сравнение часов «по UTC» даёт сдвиг на 4 часа.
  starts_at       timestamptz not null,
  duration_min    integer not null check (duration_min > 0),

  status          text not null default 'pending'
                    check (status in ('pending','confirmed','declined','done','no_show','cancelled')),

  -- Итог считает СЕРВЕР из своих данных (контракт §7.4). Клиент присылает
  -- состав визита, а не сумму — иначе сумму можно переписать в запросе.
  total_minor     bigint not null default 0 check (total_minor >= 0),
  currency        char(3) not null default 'GEL' check (currency ~ '^[A-Z]{3}$'),
  -- Скидка за задания, 0/10/20/30 (SPEC §3.8). Основание — в таблице
  -- anzh.quest_completions, здесь только применённый процент.
  discount_percent smallint not null default 0
                    check (discount_percent between 0 and 100),

  -- Комментарий клиентки к заявке.
  -- ⚠️ Поле свободного ввода: человек может написать сюда о здоровье.
  -- Оно НЕ попадает ни в логи, ни в текст уведомления (контракт §6.4).
  client_note     text,
  -- Почему мастер отклонил — видно клиентке.
  decline_reason  text,
  -- Кто и когда перевёл в текущий статус.
  decided_by      bigint,
  decided_at      timestamptz,

  app_source      text not null default 'beauty',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  deleted_at      timestamptz,
  metadata        jsonb not null default '{}',

  constraint bookings_decline_reason_only_when_declined
    check (decline_reason is null or status = 'declined')
);

-- 🚨 Конфликт слота решает БАЗА, а не код (контракт §7.3).
-- «Проверить свободно ли, затем вставить» — гонка: два запроса проходят
-- проверку одновременно. Вставка ловит нарушение и отвечает 409.
create unique index bookings_slot_unique on anzh.bookings (staff_id, starts_at)
  where status = 'confirmed' and deleted_at is null;

create index bookings_by_client on anzh.bookings (telegram_id, starts_at desc)
  where deleted_at is null;
create index bookings_by_staff_day on anzh.bookings (staff_id, starts_at)
  where deleted_at is null;
-- Очередь заявок в кабинете мастера.
create index bookings_pending on anzh.bookings (created_at)
  where status = 'pending' and deleted_at is null;

create trigger bookings_touch before update on anzh.bookings
  for each row execute function anzh.touch_updated_at();


-- Несколько процедур на один визит. Цена копируется в строку в момент
-- записи: прайс меняется, а история визита меняться не должна.
create table anzh.booking_items (
  id            uuid primary key default gen_random_uuid(),
  booking_id    uuid not null references anzh.bookings (id) on delete cascade,
  service_id    uuid not null references anzh.services (id),
  price_minor   bigint not null check (price_minor >= 0),
  currency      char(3) not null check (currency ~ '^[A-Z]{3}$'),
  duration_min  integer not null check (duration_min > 0),
  sort          integer not null default 0,
  created_at    timestamptz not null default now(),

  -- Одна процедура в визите один раз.
  unique (booking_id, service_id)
);

create index booking_items_by_booking on anzh.booking_items (booking_id, sort);
create index booking_items_by_service on anzh.booking_items (service_id);
