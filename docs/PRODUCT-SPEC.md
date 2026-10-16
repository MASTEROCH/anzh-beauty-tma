# ANZH Beauty TMA — спецификация продукта

Версия 16.10.2026 · ветка `anzh-frontend-2026-10` · демо: https://beauty-tma-prototype.vercel.app (кабинет — `/studio`, демо-PIN 2468)

Telegram Mini App студии врача-косметолога Анжелики (Батуми). Два приложения в одной сборке:
- **клиентское** — `/`;
- **кабинет студии** — `/studio`, роли: владелица, администратор, мастер.

**Как читать.** У каждой функции стоит метка:
- ✅ **контракт** — ручки уже есть в `openapi.yaml` (сервер `beauty-tma-prototype/server`);
- 🆕 **НОВОЕ** — фронт готов, нужна серверная часть. Полные ручки, поля и коды ошибок — в `BACKEND-SPEC.md`, раздел в скобках;
- 🖥 **фронт** — работает без сервера.

Каждое 🆕 реализовано на демо-сервере `tools/dev-stand.mjs` — это эталон поведения: те же пути, поля, ошибки. На Vercel он работает как функция `api/stand.mjs`.

> ⚠️ Классы «контракт / новое» сверены машинно с `openapi.yaml` из `beauty-tma-prototype/server` (26 операций). Если на боевом бэкенде часть ручек уже сделана — сверьте по таблице в конце.

---

## 1. Главное новое — что делать бэкенду в первую очередь

| # | Блок | Почему первым | BACKEND-SPEC |
|---|---|---|---|
| 1 | Кабинет: роли owner / admin / staff, PIN, команда | без этого не работают кабинет и права | «Кабинет — отдельный вход», «Команда» |
| 2 | Встроенный чат клиентка ↔ администратор (файлы, прочтение, long-poll) | главный канал связи | «Встроенный чат» |
| 3 | Результаты разборов кожи + главы паспорта | паспорт, карточка клиентки в кабинете | «Результаты разборов», «Главы паспорта» |
| 4 | Отзывы (модерация, перевод) + скидки за действия −5 % | доверие и возврат клиенток | «Отзывы», «Скидки за действия» |
| 5 | Закладки + напоминания в боте (окна, повторы) | возвращает клиенток | «Закладки и напоминания» |
| 6 | Программа «Модели ANZH» (лист ожидания, дни обучения) | набор моделей на курсы | «Программа Модели ANZH» |
| 7 | CRM-сегменты, выгрузка CSV, календарь-фид | работа администратора | «CRM», «Выгрузка», «Календарь» |
| 8 | Профиль студии, курс валют, загрузка фото | данные витрины | «Профиль студии», «Курс», «Фото услуг» |

---

## 2. Клиентское приложение

### 2.1 Знакомство (онбординг) — 🖥 фронт + 🆕
- Пять шагов: живое фото Анжелики, выбор языка RU/EN, адрес, согласие с политикой, первый разбор.
- Язык интерфейса уходит в `PATCH /me {language_code}` (🆕, в контракте только `GET /me`): на этом же языке пишет бот.

### 2.2 «О нас» (профиль студии)
- **Анжелика:** «Врач-косметолог · Батуми», высшее медицинское образование, регалии. 🖥
- **Команда.** Фото, роль, что делает, контакты. 🆕 `GET /team/public`.
- **Портфолио.** Сетка работ, листание фото свайпом. 🖥
- **Отзывы.** 🆕 `GET /reviews`.
  - Рейтинг-среднее, «в двух словах» по темам, ленты карточек.
  - Отзыв показывается на языке пользователя с пометкой «переведено автоматически», есть «показать оригинал».
  - Кнопка «Написать отзыв».
- **Адрес и карта.** 🆕 `GET /studio`.

### 2.3 Каталог и карточка процедуры
- Витрина процедур с фильтрами по направлениям. ✅ `GET /services`.
- Услуги команды без цены, «цена у администратора». 🆕 «Услуги команды без цены».
- Цена «от», валюта ₾/$ по курсу НБГ. 🆕 `GET /rates`.
- Сердечко «в закладки». 🆕 `PUT /me/favorites`.
- Карточка-вход «Стать моделью» перед разделом «Обучение». 🆕 «Модели».
- Карточка процедуры:
  - фото, описание, противопоказания, работы мастера;
  - «Поделиться» (ссылку даёт сервер), «Записаться».

### 2.4 Запись
- Процедура плюс допы (снимаются свайпом), мастер, день, слот.
  - 🆕 `GET /slots` (в контракте есть только `GET /staff/{id}/busy`);
  - ✅ `POST /services/quote`, `POST /bookings`;
  - 🆕 в `quote` и `bookings` поле `discount_percent` (скидки за действия).
- Предзаполненная запись по ссылке из бота: `startapp=book_<slug>_<YYYYMMDDHHMM>`. 🆕
- После заявки — «В календарь» (`.ics` / Google). 🖥

### 2.5 «Паспорт» (кабинет клиентки)
- **Проводник «Ваш следующий шаг».** Путь из пяти этапов (кожа → выбор → заявка → визит → уход) и одна кнопка. 🖥 Собирается из данных, которые уже загружены.
- **Мои записи.** ✅ `GET /bookings`.
  - Отмена своей записи: ✅ `PATCH /bookings/{id}`.
  - «В календарь» по одной записи и «все будущие». 🖥
- **Мои закладки** с записью в один тап. 🆕 «Закладки».
- **Статус в программе моделей.** 🆕
- **План процедур** (курс из закладок). 🖥
- **Анкета здоровья.** 🆕 `GET/PUT/DELETE /me/health`, согласия `POST/DELETE /me/consents`.
- **Приглашение подруги** (`Me.referral_link`). ✅
- **Настройки:**
  - язык и валюта;
  - уведомления — 🆕 тумблеры `favorites`, `repeat`;
  - выгрузка и удаление данных — 🆕 `GET /me/export`, `DELETE /me`.

### 2.6 ANZH Skin Intelligence — разборы кожи
- Skin Profile (бесплатно) и 6 платных разборов. Методика 1:1 с anzh.store. 🖥
- **Результат.** Сохраняется на сервер — 🆕 `PUT /me/quiz-results/{id}`. Видят «Паспорт» и карточка клиентки в кабинете.
  - Без согласия на данные о здоровье результат не хранится.
  - Галочка согласия стоит прямо в результате.
- **Оплата Telegram Stars.** 🆕 `POST /payments/invoice`, `GET /me/purchases`.
  - Кнопка «Начать разбор · цена» в неподвижном подвале шторки.
  - Шторка «Что такое Telegram Stars»: курс, пополнение `tg://stars_topup`.
  - Демо-оплата только в прототипе: `POST /dev/purchase`.
- **Главы паспорта в подарок.** Глава за каждую процедуру и за N подруг. 🆕 `GET /me/passport`, `POST /me/passport/unlock`.
- **Скидки за действия.** −5 % за каждое: Skin Profile, подруга, сторис, отзыв; разово, до −20 %. 🆕 `GET /me/rewards`, `POST /me/rewards/story`.

### 2.7 Чат
- **Вкладка «Администратор».** 🆕 `GET/POST /chat`, `POST /chat/attachments`.
  - Фото Дарьи; каналы Telegram, WhatsApp, Instagram, телефон.
  - Переписка с историей, фото и видео, «прочитано», повтор отправки.
- **Вкладка «ANZH AI».** 🖥 Ответы заскриптованы и не тратят API: процедуры, цены, адрес, запись, отмена, скидки, модели, команда. Язык ответа — язык интерфейса.

### 2.8 Программа «Модели ANZH» — 🆕 полностью новое
- Шторка программы:
  - зачем нужны модели;
  - три шага;
  - цены для моделей (себестоимость рядом с обычной);
  - дни обучения с местами;
  - условия.
- Заявка в лист ожидания: процедуры, удобные дни, согласия 18+ / условия / фото.
- После одобрения — «Записаться» моделью на процедуру в день обучения. Ссылка из бота `startapp=model_<dayId>`.

### 2.9 Язык и доступность — 🖥
- Полностью RU/EN, включая подписи для экранного диктора. Помощник отвечает на языке интерфейса.
- Минимальный кегль 12 px; цели касания ≥ 44 px; проверено на 320 и 390 px.
- `prefers-reduced-motion` учитывается; защита от краевого свайпа iOS.

---

## 3. Кабинет студии (`/studio`)

### 3.1 Вход и роли — ✅ вход по PIN + 🆕 роли и команда
- Отдельное приложение, клиентки вход не видят.
- ✅ Подпись Telegram → `GET /staff/me` → PIN (`POST /staff/pin`, `POST /staff/pin/set`).
- 🆕 Роль «администратор», временный PIN от владелицы (`POST /team/{id}/pin/set`, `must_change_pin` — смена при первом входе), профиль сотрудника.
- Права по ролям:

| | владелица | администратор | мастер |
|---|---|---|---|
| Заявки, День | все | все | свои |
| Клиенты, переписка | да | да | свои клиентки, без чата |
| Деньги | вся студия | нет | свой доход |
| Процедуры, цены, команда, «О студии», отзывы, выгрузка | да | нет | нет |
| Модели (лист ожидания, дни обучения) | да + условия | да | нет |

### 3.2 Заявки и День — ✅ контракт + 🆕
- Принять или отклонить с причиной, провести (оплачено), неявка. ✅ `PATCH /bookings/{id}`.
- Пометка «модель · день обучения». 🆕 `booking.kind`.
- «В календарь» по записи и «весь день в календарь». 🖥
- **Сторис на проверку** — засчитать −5 %. 🆕 `/staff/rewards`.
- Кабинетный ИИ-ассистент **выключен флагом** (`STUDIO_AI = false` в `StudioScreen.tsx`), код сохранён.

### 3.3 Клиенты (CRM)
- База с поиском. ✅ `GET /clients`.
- Сегменты «Пора вернуть / Давно не была / Новые» с причиной. 🆕 `segments`, `due`.
- Карточка клиентки:
  - история визитов, выручка;
  - анкета здоровья — 🆕 `GET /clients/{id}/health`;
  - разборы кожи — 🆕 `GET /clients/{id}/quiz-results`;
  - заметки мастеров — 🆕 `/clients/{id}/notes`.
- **Переписка.** Входящие с непрочитанными, ответ с файлами. 🆕 `/chat/threads*`.
- **Модели.** Лист ожидания, одобрение и отказ, модели, дни обучения с местами, условия соглашения. 🆕

### 3.4 Деньги — ✅ контракт (`/staff/bookings` history)
- Выручка по периодам, сезонам, процедурам, мастерам, неделям; неявки; топ услуг.

### 3.5 Студия (владелица)
- **Процедуры.** ✅ `GET/PATCH/DELETE /services/{slug}`, `POST /services/{slug}/restore`; 🆕 `POST /services`, `GET /staff/services/archived`, `POST /uploads`.
  - Карточка: фото, тексты RU/EN, цена и «от», время, состав, противопоказания.
  - Новые поля: **«Напомнить о повторе через N дней»** (🆕 `repeat_after_days`) и **«Цена для моделей (себестоимость)»** (🆕 `model_price_minor`).
- **Команда.** Профиль, фото, услуги, контакты, видимость и порядок, PIN, роль. 🆕 `/team*`.
- **О студии.** Контакты, включая WhatsApp и телефон; адрес, часы, точка на карте; правила глав паспорта. 🆕 `PATCH /studio`.
- **Отзывы.** Модерация, ответ студии; перевод показывается с пометкой. 🆕 `/staff/reviews`, `PATCH /reviews/{id}`.
- **Выгрузка CSV** за период или за всё время: записи и выручка, клиентки, отзывы. Без медицинских данных. 🆕 (сейчас фронт, предложение `GET /staff/export`).

---

## 4. Бот (шлёт сервер) — 🆕
- Напоминание за 24 часа — уже есть в текущем боте (фронт показывает его в карточке записи).
- «Вы хотели X — есть окно {день, время}» по закладкам. Не чаще раза в неделю.
- «Пора повторить X» через `repeat_after_days` после визита.
- Модели: «Вы модель ANZH», «Новый день обучения», контрольное фото через 14 дней.
- Сторис засчитана, отзыв опубликован.
- Все кнопки — `startapp`-ссылки. Фронт их понимает: `book_…`, `model_…`.

## 5. Открытые вопросы к студии
- Номер WhatsApp и телефон студии. Сейчас пусто: кнопка WhatsApp говорит «скоро».
- Настоящая себестоимость для моделей. В демо стоят примерные цены.
- Текст условий для моделей — черновик, на согласовании у Анжелики.
- Интервалы повторов процедур: вносит владелица.
- Юридическое: хранение анкет здоровья и платежи — до заключения юриста (см. `server/ОТЧЁТ-§1.md`).

---

## Приложение A. Все обращения фронта к API — машинная сверка с `openapi.yaml`

Всего обращений: 85 · в контракте: 22 · новых: 63

| Статус | Метод | Путь | Где во фронте |
|---|---|---|---|
| 🆕 новое | GET | `/chat` | src/lib/api/chat.ts |
| 🆕 новое | POST | `/chat` | src/lib/api/chat.ts |
| 🆕 новое | POST | `/chat/attachments` | src/lib/api/chat.ts |
| 🆕 новое | GET | `/chat/threads` | src/lib/api/chat.ts |
| 🆕 новое | POST | `/chat/threads/{id}/read` | src/lib/api/chat.ts |
| 🆕 новое | POST | `/chat/threads/{id}/reply` | src/lib/api/chat.ts |
| 🆕 новое | GET | `/clients/{id}/health` | src/lib/api/clients.ts |
| 🆕 новое | GET | `/clients/{id}/notes` | src/lib/api/clients.ts |
| 🆕 новое | POST | `/clients/{id}/notes` | src/lib/api/clients.ts |
| 🆕 новое | GET | `/clients/{id}/quiz-results` | src/lib/api/quizzes.ts |
| 🆕 новое | POST | `/dev/purchase` | src/lib/payments.ts |
| 🆕 новое | DELETE | `/me` | src/lib/api/me.ts |
| 🆕 новое | PATCH | `/me` | src/lib/api/me.ts |
| 🆕 новое | POST | `/me/consents` | src/lib/api/me.ts |
| 🆕 новое | DELETE | `/me/consents/{id}` | src/lib/api/me.ts |
| 🆕 новое | GET | `/me/export` | src/lib/api/me.ts |
| 🆕 новое | GET | `/me/favorites` | src/lib/api/favorites.ts |
| 🆕 новое | PUT | `/me/favorites` | src/lib/api/favorites.ts |
| 🆕 новое | DELETE | `/me/health` | src/lib/api/medical.ts |
| 🆕 новое | GET | `/me/health` | src/lib/api/medical.ts |
| 🆕 новое | PUT | `/me/health` | src/lib/api/medical.ts |
| 🆕 новое | GET | `/me/model` | src/lib/api/models.ts |
| 🆕 новое | POST | `/me/model/apply` | src/lib/api/models.ts |
| 🆕 новое | GET | `/me/passport` | src/lib/api/passport.ts |
| 🆕 новое | POST | `/me/passport/unlock` | src/lib/api/passport.ts |
| 🆕 новое | GET | `/me/purchases` | src/lib/api/payments.ts |
| 🆕 новое | GET | `/me/quiz-results` | src/lib/api/quizzes.ts |
| 🆕 новое | PUT | `/me/quiz-results/{id}` | src/lib/api/quizzes.ts |
| 🆕 новое | GET | `/me/rewards` | src/lib/api/rewards.ts |
| 🆕 новое | POST | `/me/rewards/story` | src/lib/api/rewards.ts |
| 🆕 новое | POST | `/models/days/{id}/book` | src/lib/api/models.ts |
| 🆕 новое | GET | `/models/program` | src/lib/api/models.ts |
| 🆕 новое | DELETE | `/notes/{id}` | src/lib/api/clients.ts |
| 🆕 новое | POST | `/payments/invoice` | src/lib/api/payments.ts |
| 🆕 новое | GET | `/promos` | src/lib/api/studio.ts |
| 🆕 новое | POST | `/promos` | src/lib/api/studio.ts |
| 🆕 новое | DELETE | `/promos/{id}` | src/lib/api/studio.ts |
| 🆕 новое | PATCH | `/promos/{id}` | src/lib/api/studio.ts |
| 🆕 новое | GET | `/rates` | src/lib/rates.ts |
| 🆕 новое | GET | `/reviews` | src/lib/api/reviews.ts |
| 🆕 новое | POST | `/reviews` | src/lib/api/reviews.ts |
| 🆕 новое | PATCH | `/reviews/{id}` | src/lib/api/reviews.ts |
| 🆕 новое | POST | `/services` | src/lib/api/catalog.ts, src/lib/api/staff.ts |
| 🆕 новое | GET | `/slots` | src/lib/api/bookings.ts |
| 🆕 новое | PUT | `/staff/model-agreement` | src/lib/api/models.ts |
| 🆕 новое | GET | `/staff/models` | src/lib/api/models.ts |
| 🆕 новое | PATCH | `/staff/models/{id}` | src/lib/api/models.ts |
| 🆕 новое | GET | `/staff/reviews` | src/lib/api/reviews.ts |
| 🆕 новое | GET | `/staff/rewards/pending` | src/lib/api/rewards.ts |
| 🆕 новое | POST | `/staff/rewards/{id}/{id}` | src/lib/api/rewards.ts |
| 🆕 новое | GET | `/staff/services/archived` | src/lib/api/catalog.ts, src/lib/api/staff.ts |
| 🆕 новое | GET | `/staff/training-days` | src/lib/api/models.ts |
| 🆕 новое | POST | `/staff/training-days` | src/lib/api/models.ts |
| 🆕 новое | DELETE | `/staff/training-days/{id}` | src/lib/api/models.ts |
| 🆕 новое | PATCH | `/staff/training-days/{id}` | src/lib/api/models.ts |
| 🆕 новое | GET | `/studio` | src/lib/api/studio.ts |
| 🆕 новое | PATCH | `/studio` | src/lib/api/studio.ts |
| 🆕 новое | PUT | `/team/order` | src/lib/api/staff.ts |
| 🆕 новое | GET | `/team/public` | src/lib/api/staff.ts |
| 🆕 новое | PATCH | `/team/{id}` | src/lib/api/staff.ts |
| 🆕 новое | POST | `/team/{id}/pin/reset` | src/lib/api/staff.ts |
| 🆕 новое | POST | `/team/{id}/pin/set` | src/lib/api/staff.ts |
| 🆕 новое | POST | `/uploads` | src/lib/api/studio.ts |
| ✅ контракт | GET | `/bookings` | src/lib/api/bookings.ts |
| ✅ контракт | POST | `/bookings` | src/lib/api/bookings.ts |
| ✅ контракт | GET | `/bookings/declined` | src/lib/api/bookings.ts |
| ✅ контракт | GET | `/bookings/{id}` | src/lib/api/bookings.ts |
| ✅ контракт | PATCH | `/bookings/{id}` | src/lib/api/bookings.ts, src/lib/api/staff.ts |
| ✅ контракт | GET | `/clients` | src/lib/api/clients.ts |
| ✅ контракт | GET | `/clients/{id}` | src/lib/api/clients.ts |
| ✅ контракт | GET | `/me` | src/lib/api/me.ts |
| ✅ контракт | GET | `/services` | src/lib/api/catalog.ts, src/lib/api/staff.ts |
| ✅ контракт | POST | `/services/quote` | src/lib/api/catalog.ts |
| ✅ контракт | DELETE | `/services/{id}` | src/lib/api/catalog.ts, src/lib/api/staff.ts |
| ✅ контракт | GET | `/services/{id}` | src/lib/api/catalog.ts |
| ✅ контракт | PATCH | `/services/{id}` | src/lib/api/catalog.ts, src/lib/api/staff.ts |
| ✅ контракт | POST | `/services/{id}/restore` | src/lib/api/catalog.ts, src/lib/api/staff.ts |
| ✅ контракт | GET | `/staff/bookings` | src/lib/api/staff.ts |
| ✅ контракт | GET | `/staff/me` | src/lib/api/staff.ts |
| ✅ контракт | POST | `/staff/pin` | src/lib/api/staff.ts |
| ✅ контракт | POST | `/staff/pin/set` | src/lib/api/staff.ts |
| ✅ контракт | GET | `/team` | src/lib/api/staff.ts |
| ✅ контракт | POST | `/team` | src/lib/api/staff.ts |
| ✅ контракт | DELETE | `/team/{id}` | src/lib/api/staff.ts |
| ✅ контракт | PUT | `/team/{id}/services` | src/lib/api/staff.ts |
