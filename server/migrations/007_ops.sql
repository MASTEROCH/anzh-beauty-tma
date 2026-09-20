-- 007 · Служебное: очередь уведомлений и идемпотентность.

-- Таблица задач вместо брокера очередей (контракт §2.1, §9).
-- Не setTimeout в процессе: функция не живёт до завтра.
create table anzh.notifications (
  id           uuid primary key default gen_random_uuid(),
  telegram_id  bigint not null,

  -- Шаблон, а не готовый текст: тексты двумя языками живут в коде
  -- (контракт §2.1), и правка формулировки не требует переписывать очередь.
  template     text not null,
  -- Подстановки шаблона.
  -- 🚨 Сюда НЕ кладутся данные о здоровье (контракт §6.4): сообщения видны
  -- на экране блокировки. «Завтра в 14:00» — можно. Название чувствительной
  -- процедуры, результат разбора, диагноз — нельзя.
  payload      jsonb not null default '{}',

  -- Тип для отписки: у каждого своя (контракт §9).
  channel      text not null check (channel in ('reminder','review_request','marketing','system')),

  send_at      timestamptz not null,
  status       text not null default 'pending'
                 check (status in ('pending','sent','failed','skipped')),
  attempts     smallint not null default 0,
  last_error   text,
  sent_at      timestamptz,
  -- Из-за чего поставлено. Статус проверяется в момент ОТПРАВКИ, а не
  -- постановки: отменённая запись не должна присылать напоминание.
  booking_id   uuid references anzh.bookings (id) on delete cascade,

  app_source   text not null default 'beauty',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- Выборка партии к отправке. Рассылка идёт батчами с отметкой прогресса:
-- у функции есть лимит времени выполнения (контракт §9).
create index notifications_due on anzh.notifications (send_at)
  where status = 'pending';
create index notifications_by_person on anzh.notifications (telegram_id, created_at desc);
-- Одно напоминание одного вида на запись: повторный запуск планировщика
-- не должен продублировать очередь.
create unique index notifications_once on anzh.notifications (booking_id, template)
  where booking_id is not null and status in ('pending','sent');

create trigger notifications_touch before update on anzh.notifications
  for each row execute function anzh.touch_updated_at();


-- Ограничение частоты: не больше N сообщений в сутки одному человеку
-- (контракт §9). Приложение, которое пишет слишком часто, блокируют — и
-- вместе с рекламой человек теряет напоминание о записи.
create index notifications_sent_today on anzh.notifications (telegram_id, sent_at)
  where status = 'sent';


-- Идемпотентность создающих эндпоинтов (контракт §7.2).
-- Сеть теряет ответ, человек жмёт «Записаться» второй раз → две записи.
create table anzh.idempotency (
  key          text not null,
  telegram_id  bigint not null,
  endpoint     text not null,
  -- Сохранённый ответ: повтор с тем же ключом возвращает ТОТ ЖЕ результат,
  -- а не создаёт второй объект.
  status_code  smallint not null,
  response     jsonb not null,
  created_at   timestamptz not null default now(),

  -- Ключ уникален в пределах человека и эндпоинта: чужой uuid не может
  -- вернуть вам чужой ответ.
  primary key (telegram_id, endpoint, key)
);

-- Записи старше суток чистятся по расписанию — ключ идемпотентности
-- нужен на время ретраев, а не навсегда.
create index idempotency_age on anzh.idempotency (created_at);
