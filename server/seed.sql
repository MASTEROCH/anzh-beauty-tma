-- Тестовые данные. В боевую базу НЕ едут (контракт §5.4).
--
-- Здесь нарочно нет ни одного настоящего имени, телефона и адреса:
-- файл лежит в репозитории, а репозиторий переживает проект.
--
-- Цены и состав процедур — заготовки из прототипа. Настоящий прайс
-- приходит от Анжелики (см. ЗАПРОС-ДАННЫХ.md) и заводится через
-- кабинет, а не этим файлом.
--
--   npm run seed
--
-- Повторный запуск безопасен: всё через on conflict do nothing.

-- ─── Команда ─────────────────────────────────────────────────────
-- 🚨 telegram_id ниже — выдуманные. Перед запуском заменить на
-- настоящие: право в кабинет даёт именно этот номер (контракт §3.4).
-- PIN не задаётся вовсе: его ставит сам сотрудник через
-- POST /api/v1/staff/pin/set. Демо-коды 2024 / 1111 / 2222 из
-- спецификации ходили по переписке и способом входа быть не должны.
insert into anzh.staff (telegram_id, name, title, role) values
  (100000001, 'Владелица (заготовка)', 'Косметолог',       'owner'),
  (100000002, 'Мастер (заготовка)',    'Мастер по бровям', 'staff')
on conflict (telegram_id) do nothing;

-- ─── Процедуры ───────────────────────────────────────────────────
insert into anzh.services
  (slug, kind, category, zone, title_ru, title_en, subtitle_ru, subtitle_en,
   price_minor, currency, duration_min, sort, contraindications)
values
  ('lip-filler', 'procedure', 'inj', 'face',
   'Контурная пластика губ', 'Lip filler', 'Филлер, 1 мл', 'Filler, 1 ml',
   45000, 'GEL', 60, 10,
   '["беременность","лактация","герпес в активной фазе","аутоиммунные заболевания"]'),

  ('biorevital', 'procedure', 'inj', 'face',
   'Биоревитализация', 'Biorevitalisation', 'Гиалуроновая кислота', 'Hyaluronic acid',
   32000, 'GEL', 45, 20,
   '["беременность","лактация","воспаление в зоне обработки"]'),

  ('deep-clean', 'procedure', 'clean', 'face',
   'Глубокая чистка лица', 'Deep cleanse', null, null,
   15000, 'GEL', 90, 30,
   '["купероз в тяжёлой форме","активное воспаление"]'),

  ('prx-t33', 'procedure', 'peel', 'face',
   'Пилинг PRX-T33', 'PRX-T33 peel', null, null,
   18000, 'GEL', 45, 40,
   '["беременность","лактация","повреждения кожи в зоне обработки"]'),

  ('rf-lifting', 'procedure', 'apparatus', 'face',
   'RF-лифтинг', 'RF lifting', null, null,
   14000, 'GEL', 50, 50,
   '["кардиостимулятор","металлические импланты в зоне обработки","беременность"]'),

  ('led-care', 'procedure', 'care', 'face',
   'LED-терапия', 'LED therapy', 'Уход после процедуры', 'Post-treatment care',
   6000, 'GEL', 25, 60, '["фотодерматоз","приём фотосенсибилизирующих препаратов"]'),

  ('brow-lami', 'procedure', 'brows', 'brows',
   'Ламинирование и окрашивание бровей', 'Brow lamination and tint', null, null,
   9000, 'GEL', 40, 70, '["аллергия на составы","повреждения кожи в зоне обработки"]'),

  ('derma-visit', 'procedure', 'derma', 'general',
   'Приём дерматолога', 'Dermatologist visit', 'Осмотр и план ухода', 'Check-up and plan',
   12000, 'GEL', 30, 80, '[]')
on conflict (slug) do nothing;

-- ─── Платные разборы кожи (за Stars) ─────────────────────────────
-- 🔴 Продавать их нельзя до ответа на вопросы №2 и №3 из §1 контракта:
-- кто получатель денег и чем является «разбор» — информационной
-- услугой или медицинской. Строки заведены, чтобы работал каталог.
insert into anzh.services
  (slug, kind, category, zone, title_ru, title_en, stars_amount, sort)
values
  ('analysis-acne',    'analysis', 'analysis', 'face', 'Разбор: акне',        'Analysis: acne',       670, 110),
  ('analysis-aging',   'analysis', 'analysis', 'face', 'Разбор: возраст',     'Analysis: ageing',     670, 120),
  ('analysis-bundle',  'analysis', 'analysis', 'face', 'Все разборы',         'All analyses',        2680, 130)
on conflict (slug) do nothing;

-- ─── Обучение ────────────────────────────────────────────────────
-- ⚠️ Программы выдуманы. Настоящий перечень курсов — от Анжелики
-- (ЗАПРОС-ДАННЫХ.md, раздел 3). Групповой набор с потоками и
-- предоплатой этой таблицей не описывается: сейчас курс записывается
-- как процедура, и это неправильно — переделывается, когда появится
-- реальный список.
insert into anzh.services
  (slug, kind, category, zone, title_ru, title_en, price_minor, currency, days, duration_min, sort)
values
  ('course-basic', 'training', 'training', 'general',
   'Курс (заготовка): базовый', 'Course (placeholder): basic', 80000, 'USD', 2, 480, 210),
  ('course-adv',   'training', 'training', 'general',
   'Курс (заготовка): продвинутый', 'Course (placeholder): advanced', 100000, 'USD', 2, 480, 220)
on conflict (slug) do nothing;

-- ─── Кто что ведёт ───────────────────────────────────────────────
insert into anzh.staff_services (staff_id, service_id)
select 100000001, id from anzh.services
where slug in ('lip-filler','biorevital','deep-clean','prx-t33','rf-lifting',
               'led-care','derma-visit','course-basic','course-adv')
on conflict do nothing;

insert into anzh.staff_services (staff_id, service_id)
select 100000002, id from anzh.services where slug = 'brow-lami'
on conflict do nothing;
