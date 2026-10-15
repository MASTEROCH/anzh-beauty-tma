# ANZH Beauty TMA — спецификация для бэкенда

Версия 15.10.2026 · фронтенд `~/code/anzh-frontend` (срез ветки `apphub` 4622790 + правки 15.10).
Эталон поведения всех НОВЫХ ручек — локальный стенд `tools/dev-stand.mjs`: там они реализованы
ровно так, как их ждут экраны. Где стенд и этот документ разойдутся — прав документ.

## 0. Общие правила (как в действующем контракте)

- База: `/api/v1`, JSON, ошибки `{"error":{"code","message"}}`.
- Вход: `POST /auth/telegram {init_data}` → JWT; дальше `Authorization: Bearer`.
- Кабинет (роли `owner`/`staff`) — только после `POST /staff/pin` в этой сессии; иначе `403 pin_required`.
- Всё, что создаёт сущность, принимает `Idempotency-Key`: повтор с тем же ключом → тот же ответ, без дубля.
- Данные о здоровье (анкета, разборы) пишутся только при флаге `features.health` и действующем
  согласии `health_data`, иначе `403 feature_disabled` / `403 consent_required`. Отзыв согласия стирает их.
- Публичные ручки (`auth: none`): `GET /services`, `GET /studio`, `GET /rates`, `GET /promos` — без заголовка
  авторизации, кэшируются CDN.

## 1. Карта продукта

### Клиентка (Telegram Mini App, гость вне Telegram — только витрина)
| Раздел | Что делает | Ручки |
|---|---|---|
| О нас | обложка студии, команда, портфолио, история, отзывы, карта, контакты | `GET /studio` 🆕, `GET /services` |
| Услуги | каталог с фото, фильтры, цены в ₾/$ по курсу, избранное, план курса | `GET /services`, `GET /rates` 🆕 |
| Запись | процедура + совместимые допы, слот, заявка | `POST /services/quote`, `GET /slots`, `POST /bookings` |
| Паспорт | записи, анкета здоровья, результаты разборов, согласия, экспорт/удаление | `GET /bookings`, `GET/PUT/DELETE /me/health`, `GET /me/quiz-results` 🆕, `POST/DELETE /me/consents`, `GET /me/export`, `DELETE /me` |
| ANZH | 7 разборов кожи (методология anzh.store 1:1), платные — за Stars | `POST /payments/invoice`, `GET /me/purchases`, `PUT /me/quiz-results/{quiz}` 🆕 |
| Чат 🆕 | «Администратор» — живая переписка с фото/видео; «ANZH AI» — скриптовые ответы на устройстве | `/chat*` 🆕 |

### Кабинет (owner / staff)
| Вкладка | Что делает | Ручки |
|---|---|---|
| Заявки / День | подтвердить/отклонить/провести визит, сумма | `GET /staff/bookings`, `PATCH /bookings/{id}` |
| Клиенты | база, по выручке, карточка (история, заметки, анкета, разборы 🆕), **переписка 🆕** | `GET /clients`, `GET /clients/{id}`, `…/notes`, `…/health`, `…/quiz-results` 🆕, `/chat/threads*` 🆕 |
| Деньги | выручка, по неделям, по мастерам | из `GET /staff/bookings` |
| Студия (owner) | процедуры (фото, тексты RU/EN, цена, время, состав), скрытые, команда и PIN, о студии 🆕, акции 🆕 | `/services*`, `/team*`, `PATCH /studio` 🆕, `/promos*` 🆕, `POST /uploads` 🆕 |

🆕 — ручки, которых в контракте ещё нет. Всё остальное фронтенд уже вызывает по действующему контракту.

## 2. НОВОЕ — по приоритету

### P0 · Встроенный чат клиентка ↔ администратор
Файлы фронта: `src/lib/api/chat.ts`, `src/lib/clientChat.ts`, `src/lib/staffInbox.ts`, `src/components/ChatThread.tsx`.

| Метод | Путь | Кто | Тело / ответ |
|---|---|---|---|
| GET | `/chat?since&wait` | клиентка (своя переписка) | → `{messages: Message[], seq}` |
| POST | `/chat` | клиентка | `{text?, attachment_id?}` → `201 {message}` |
| GET | `/chat/threads?since&wait` | студия, PIN | → `{threads: [{client_id, name, unread, messages}], seq}` |
| POST | `/chat/threads/{client_id}/reply` | студия, PIN | `{text?, attachment_id?}` → `201 {message}` |
| POST | `/chat/threads/{client_id}/read` | студия, PIN | → `{ok:true}` — помечает сообщения клиентки прочитанными |
| POST | `/chat/attachments` | любой с сессией | **сырой файл телом**, `Content-Type` = тип файла → `201 {attachment}` |
| GET | `/chat/files/{id}?exp&sig` | по подписи | файл; **обязателен `Range`/`206`** — без него Safari/iOS не играет видео |

`Message = {id, seq, from: 'client'|'studio', text, at (ISO), read, attachment?: {id, kind: 'image'|'video', mime, size, url}}`

Правила:
1. **Реальное время = длинный опрос.** `since` — последний увиденный `seq` (глобальный монотонный счётчик событий),
   `wait` ≤ 30 с: запрос висит, пока не появится событие новее `since`, иначе отвечает по таймауту тем же
   состоянием. Событие = новое сообщение ИЛИ отметка «прочитано». Обычный fetch с Bearer — без WebSocket и без
   токена в адресе. (WebSocket/SSE можно позже — фронт поменяется в одном файле.)
2. **«Прочитано»:** `GET /chat` помечает сообщения студии прочитанными; студия — через `/read` при открытии переписки.
3. **История бессрочна**, у каждого сообщения дата-время сервера. Входит в `GET /me/export`, удаляется с `DELETE /me`.
4. **Вложения — личные данные** (часто фото кожи): НЕ в публичный `/photos`, хранилище закрытое, отдача только
   по подписанной ссылке со сроком (стенд: HMAC, 1 час). Ссылку отдавать свежую в каждом ответе.
   Лимиты: фото ≤ 15 МБ (фронт сам сжимает до JPEG 2048 px), видео ≤ 60 МБ и ≤ 3 мин (MP4/MOV/WebM, без
   перекодирования на устройстве). Ошибки: `415 bad_type`, `413 too_large`, `422 empty_file`.
   Желательно: превью-кадр видео и снятие EXIF-геометки с фото на сервере.
5. Пустое сообщение (`text` пуст и нет вложения) → `422 empty_message`. Текст ≤ 2000 знаков.
6. **Уведомления через бота (обязательно для «быстро реагировать»):** новое сообщение клиентки → бот пишет
   студии (владелице/админу) в Telegram с кнопкой «Открыть переписку» (deep link в кабинет); ответ студии →
   бот пишет клиентке, если приложение закрыто и `can_message`. Без этого администратор узнаёт о сообщении,
   только когда сам открыл кабинет (внутри кабинета фронт уже показывает счётчик и всплывающую строку).
7. Доступ к переписке — owner и staff с ролью администратора (сейчас фронт пускает всех с PIN — решить на сервере).
8. Частота: ≤ 30 сообщений/мин на клиентку, вложений ≤ 20/час → `429`.

### P0 · Результаты разборов (паспорт кожи)
Файлы: `src/lib/api/quizzes.ts`, `src/lib/quizResults.ts`, карточка — `src/components/ClientCardView.tsx`.

| Метод | Путь | Кто | Тело / ответ |
|---|---|---|---|
| GET | `/me/quiz-results` | клиентка | → `{results: QuizResult[]}` (последний по каждому тесту) |
| PUT | `/me/quiz-results/{quiz_id}` | клиентка, **флаг health + согласие** | `QuizResult` → `{result}` (заменяет прошлый) |
| GET | `/clients/{id}/quiz-results` | студия, PIN, как анкета | → `{results}` по дате ↓; просмотр — в журнал доступа |

`QuizResult = {quiz_id, result_key, title, sub, secondary?: string[], answers: (number|number[])[], taken_at}`
`quiz_id ∈ profile, skintype, aging, sensitivity, glow, homecare, morphotype`. Отзыв `health_data` и `DELETE /me`
стирают их (`DELETE /me/consents` уже обещает «анкету и разборы»). Входят в экспорт.
Подсчёт итогов делает фронт (сверен с сайтом: 0 расхождений на 3000 прогонов каждого теста); сервер хранит.

### P0 · Кабинет — отдельный вход `/studio` и три роли
- В клиентском приложении входа в кабинет **нет**. Кабинет — второй Mini App **того же бота**: BotFather →
  `/newapp` → URL `https://<домен>/studio` → ссылка `t.me/<бот>/studio`. Тот же токен бота — та же проверка
  `initData`, на сервере ничего не меняется. Фронт выбирает приложение по адресу (`src/main.tsx`).
- Роль `admin` **[ПРЕДЛОЖЕНИЕ]** к `owner`/`staff`. Права (фронт — `accessOf` в `src/lib/staff.ts`; сервер обязан
  проверять сам):

| | owner | admin | staff (мастер) |
|---|---|---|---|
| `/staff/bookings?scope=all`, `PATCH /bookings` | все | все | свои |
| `/clients*`, `/chat/threads*` | да | да | свои клиентки, без чата |
| деньги (`/staff/bookings` history для выручки студии) | да | нет | свой доход |
| `/services` правка, `/team*`, `/studio` PATCH, `/promos` | да | нет | нет |
| `/clients/{id}/health`, `/clients/{id}/quiz-results` | да | нет | нет |

### P1 · Команда: профиль сотрудника, PIN от владелицы, публичная команда
| Метод | Путь | Кто | Тело → ответ |
|---|---|---|---|
| PATCH | `/team/{id}` | owner+PIN | `{name?, title?, role?: 'staff'\|'admin', photo_url?, profile?: Partial<MemberProfile>}` → `{staff}` |
| POST | `/team/{id}/pin/set` | owner+PIN | `{pin: '4 цифры'}` → `{updated, must_change_pin: true}` |
| PUT | `/team/order` | owner+PIN | `{order: telegram_id[]}` → `{team}` |
| GET | `/team/public` | публичная | `{team: PublicMember[]}` — только `visible`, по `sort` |

```
MemberProfile = {key, name{ru,en}, surname?, role{ru,en}, short?, focus?{x,y}, cred?, does{ru[],en[]},
                 instagram?, telegram?, phone?, contacts_public, visible, sort}
PublicMember  = {key, name, surname, role, short, photo_url, focus, cred, does, services[], is_admin,
                 instagram/telegram/phone — только при contacts_public}
StaffMember   += {profile?, must_change_pin?}   (GET /team и GET /staff/me)
```
- `POST /team` принимает `role: 'staff'|'admin'`; вторая `owner` — `403 owner_unique`.
- PIN от владелицы — **временный**: `must_change_pin=true`, после `POST /staff/pin` фронт требует задать свой
  (`POST /staff/pin/set` с текущим) и только потом открывает кабинет. Хранить хэшем, как свой.
- Витрина «О нас → Команда» читает `/team/public`; без ответа — данные из сборки (`src/data/team.ts`).

### P1 · Отзывы — только в приложении, публикует владелица
| Метод | Путь | Кто | Тело → ответ |
|---|---|---|---|
| GET | `/reviews` | публичная | `{reviews: Review[], count, avg}` — только `published`, новые сверху; `avg` с точностью 0,1 |
| POST | `/reviews` | клиентка | `{rating: 1..5, text ≥ 10 знаков ≤ 1200, service_slug?, publish_consent: bool}` → `{review, rewards}` |
| GET | `/staff/reviews` | owner+PIN | `{reviews: Review[] + state}` — все, новые сверху |
| PATCH | `/reviews/{id}` | owner+PIN | `{state?: 'published'\|'hidden', reply?: string\|null ≤ 600}` → `{review}` |

```
Review = {id, name (имя из Telegram), rating, text, service_slug|null, created_at, reply|null,
          verified (у автора есть проведённый визит), publish_consent, state? (только кабинет): new|published|hidden}
```
- Новый отзыв — `state='new'`, на витрину попадает только после решения владелицы.
- `publish_consent=false` — отзыв видит только студия; `PATCH {state:'published'}` на такой → `409 no_consent`.
- Анти-флуд: не чаще одного отзыва в минуту с человека (`429 too_often`); ошибки валидации — `422` с текстом для человека.
- **Скидка за отзыв начисляется в момент POST и не зависит ни от оценки, ни от публикации** — иначе это покупка оценок.

### P1 · Скидки за действия — разовые, −5 % за каждое, до −20 %
Четыре действия, каждое засчитывается один раз на человека: `profile` (пройден бесплатный Skin Profile —
сервер видит результат в `PUT /me/quiz-results`), `invite` (по ссылке `ref_<id>` пришла новая клиентка),
`review` (отправлен отзыв), `story` (сторис — проверяет администратор).

| Метод | Путь | Кто | Тело → ответ |
|---|---|---|---|
| GET | `/me/rewards` | клиентка | `{rewards}` |
| POST | `/me/rewards/story` | клиентка | `{proof: ссылка или ник, ≥ 3 знака}` → `{rewards}` (`story='pending'`); повтор после `done` → `409` |
| GET | `/staff/rewards/pending` | owner, admin + PIN | `{pending: [{client_id, name, action:'story', proof, sent_at}]}` |
| POST | `/staff/rewards/{client_id}/approve\|reject` | owner, admin + PIN | → `{rewards}`; reject возвращает `story` в `idle` |

```
Rewards = {actions: {profile, invite, story, review: 'idle'|'pending'|'done'}, per_action: 5,
           percent (действующая скидка = done × 5, 0 если used), max_percent: 20, used: bool}
```
- **Применяет только сервер:** `POST /services/quote` → `{subtotal_minor, discount_percent, discount_minor, total_minor}`;
  `POST /bookings` пишет `discount_percent` и `total_minor` со скидкой. Фронт показывает процент строкой в итоге записи.
- Скидка одна на одну процедуру: при переводе визита в `done` с ненулевой скидкой — `used=true`; после этого
  действия больше не дают процентов (повторно акция не запускается).
- Отмена/отклонение визита скидку не «сжигает» — `used` ставится только на проведённом визите.

### P1 · Главы паспорта за процедуры и подруг
| Метод | Путь | Кто | Тело → ответ |
|---|---|---|---|
| GET | `/me/passport` | клиентка | `{passport: {enabled, credits, unlocked[], visits_done, friends_done, friends_per_chapter}}` |
| POST | `/me/passport/unlock` | клиентка | `{quiz_id}` (один из 6 платных) → `{passport}`; `409 already_open` / `409 no_credits`, `422 not_paid_quiz` |
| PATCH | `/studio` | owner+PIN | `{passport_rules: {enabled, friends_per_chapter: 1..10}}` |

- `credits = visits_done + ⌊friends_done / friends_per_chapter⌋ − открытых глав` (не меньше 0). Считает только сервер.
- `visits_done` — визиты в статусе `done`; `friends_done` — приглашённые по ссылке, у которых есть **проведённый**
  визит (не регистрация — иначе главы раздаются за фейковые аккаунты).
- Открытая глава равна покупке разбора: фронт пускает в разбор, если он куплен Stars (`/me/purchases`) **или** есть в `unlocked`.

### P0 · Закладки и напоминания в боте
| Метод | Путь | Кто | Тело → ответ |
|---|---|---|---|
| GET | `/me/favorites` | клиентка | `{slugs: string[], updated_at}` |
| PUT | `/me/favorites` | клиентка | `{slugs}` (целиком, ≤ 50, неизвестные slug отбрасываются) → `{slugs, updated_at}`; хранить дату добавления каждого slug |
| PATCH | `/me` | клиентка | `notifications: {favorites?: bool, repeat?: bool}` — новые тумблеры, по умолчанию `true` |
| PATCH | `/services/{slug}` | owner+PIN | `repeat_after_days: 7..730 \| null` (`422 bad_repeat`); null — не напоминать |

**Планировщик (cron раз в час, только в часы студии):**
- **repeat_due** (приоритетнее): прошло `repeat_after_days` после визита `done`, новой записи на эту процедуру нет → «{Имя}, прошло N дн. после «{процедура}» — пора повторить. Ближайшее окно: {день, время}».
- **favorite_window**: slug в закладках ≥ 3 дней, открытой записи на него нет, у мастера есть свободный слот в ближайшие 3 дня → «{Имя}, вы хотели «{процедура}» — есть окно: {день, время}».
- Не чаще 1 сообщения в 7 дней на человека; только при `can_message=true` и включённом тумблере; язык — `language_code`.
- Кнопка в сообщении — `https://t.me/<bot>/app?startapp=book_<slug>_<YYYYMMDDHHMM>` (время салона). Фронт открывает запись на этой процедуре и предвыбирает слот, если он ещё свободен (`lib/telegram.ts navStartParam`). `start_param` — только навигация, не личность.
- Право писать просим в момент первой закладки (`requestWriteAccess`), один раз.
- Стенд: `POST /dev/reminders/run {shift_days?, ignore_weekly?, ignore_age?, dry?}` → `{now, sent: [{telegram_id, name, kind, slug, slot, text_ru, text_en, link}]}` — превью того, что ушло бы.

### P1 · CRM-сегменты в «Клиентах»
`GET /clients` → у каждой клиентки `segments: ('due'|'lapsed'|'new')[]` и `due: [{slug, title_ru, last_at, every_days}]`; `?segment=due|lapsed|new` фильтрует.
`due` — подошёл срок повтора (`repeat_after_days`) и нет новой записи; `lapsed` — последний визит `done` > 90 дней; `new` — ровно один визит.

### P1 · Календарь
- Фронт сам собирает `.ics` (один визит / «все будущие» / «весь день» в кабинете) и ссылку Google Calendar. Комментарий клиентки в событие кабинета **не кладётся** (бывает о здоровье).
- [ПРЕДЛОЖЕНИЕ] Подписка мастера: `GET /staff/calendar.ics?token=<персональный, отзываемый>` — живой фид его записей (confirmed + pending с пометкой), календарь телефона обновляется сам. Токен — в «Студия → Команда → сотрудник», «сбросить» отзывает.

### P1 · Выгрузка данных (owner)
Сейчас фронт выгружает CSV сам из `/staff/bookings?from&to&scope=all`, `/clients?limit=5000`, `/staff/reviews` (разделитель `;`, BOM, время салона).
Для больших баз [ПРЕДЛОЖЕНИЕ]: `GET /staff/export?kind=bookings|clients|reviews&from&to` → `text/csv`, стриминг, owner+PIN, запись в журнал «кто и когда выгрузил». **`client_note`, анкеты здоровья и результаты разборов в выгрузку не входят.**

### Демо-оплата (только прототип)
`POST /dev/purchase {product_slug, covers}` — стенд записывает покупку без счёта Telegram, чтобы в прототипе пройти разбор целиком. Боевая сборка её не вызывает (флаг `VITE_DEMO`/dev). `GET /me/purchases` — как в контракте.

### P1 · Профиль студии `GET/PATCH /studio`
`Studio = {name, tagline{ru,en}, city, street, floor, hint, landmarks{ru[],en[]}, lat, lon, telegram, instagram|null,
phone|null (+…), whatsapp|null (цифры), hours{ru,en}, off_days[]}`. GET публичный; PATCH — owner+PIN, только присланные
поля, пустой патч → `422 empty_patch`. Фронт показывает кнопки «Позвонить / WhatsApp» только при заданных номерах.
**Сейчас номеров WhatsApp и телефона нет нигде — владелица вносит в «Студия → О студии».**

### P1 · Курс валют `GET /rates`
→ `{lari_per_dollar, as_of, source}`. Источник — НБГ (`nbg.gov.ge` JSON API), кэш на сервере ≥ 1 ч, на сбой — последний
известный. Только для показа «≈ $»: суммы, чеки и оплаты остаются в валюте услуги.

### P1 · Фото услуг: `POST /uploads` + `photo_url`
`POST /uploads {content_type:'image/webp', data: base64}` (owner+PIN) → `{url:'/photos/…'}`; затем
`PATCH /services/{slug} {photo_url}`. Допустим только относительный `/photos/…` (≤ 2 уровня вложенности) —
фронт отбрасывает остальное. Сброс кэша CDN по `/photos/` при замене.

### P2 · Акции `/promos`
`Promo = {id, title{ru,en}, description?, kind: percent|amount|gift, value?, currency?, gift?, services?: slug[],
starts_at, ends_at, active}`. `GET /promos` публичный (клиентке — только действующие), CRUD — owner+PIN.
Размер скидки считает сервер в `POST /services/quote` (`discount_percent`), клиент не считает.
Кабинет: форма есть; витрина клиентки акции пока не показывает — включим после сервера.

### P2 · Услуги команды без цены
Брови (Екатерина), лазер (Роман), пилинги, липолитики **есть в студии, но без цены** — сервер их не записывает
(`422 incomplete_service`). Фронт показывает их карточками «Цена у администратора» (ведут в чат) по slug:
`brow-lamination, brow-shape-tint, brow-lightening, brow-pmu, tattoo-removal, pmu-removal, pigment-removal,
carbon-peel, peeling, lipolytics`. Как только владелица задаст цену и время в кабинете — строка с тем же slug
становится обычной процедурой с записью. Просьба: slug в серверном каталоге — ровно эти.
Новые позиции с ценой из голосовых владелицы: `deep-cleansing` (clean, от 200 ₾, **60 мин — допущение**),
`mesotherapy` (inj, от 250 ₾ за сеанс, **30 мин — допущение**). Длительности подтвердить у Анжелики.

## 3. Что поменялось во фронте в сетевой части
- `src/lib/session.ts`: добавлены `raw` (отправка файла телом без JSON) и `apiUrl()` (полный адрес для `<img>/<video>`).
  Старое поведение не тронуто.
- Чат опрашивается только пока окно открыто; кабинет держит один опрос на весь кабинет.

## 4. Как проверить
```
node tools/dev-stand.mjs      # порт 8791, PIN 2468, история чата и вложения — в tools/.stand-data/
npm run dev                   # http://localhost:5180/?as=client | ?as=owner | ?as=maria
```

## 5. Открытые вопросы к студии / юристу
1. Номера телефона и WhatsApp студии. 2. Цены и время бровей и лазера. 3. Длительность чистки и мезотерапии.
4. Кто отвечает в чате (владелица / администратор Дарья), часы ответа. 5. Срок хранения вложений чата и анкет
(юрист: данные о здоровье). 6. Нужен ли ИИ-ответ через Claude API для вопросов вне скриптов (сейчас — только
скрипты на устройстве; если да — отдельная ручка `POST /ai/ask` с лимитами, ключ только на сервере).
