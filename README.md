# ANZH · Beauty TMA

Telegram Mini App для эстетической медицины — кабинет косметолога **Анжелики** (Батуми).
Каталог процедур, запись со слотами, программа лояльности, AI-ассистент, паспорт здоровья.

**Дизайн-язык:** ANZH.store petrol-luxe × roch-art green-glow × Apple **Liquid Glass** (iOS 26/27).
Emerald `#12C088` + Gold `#F5C842` на petrol-teal `#061417`, плавающий glass-таббар,
serif-акценты (Playfair) поверх читабельного Inter, concierge-орб вместо маскота.

## Стек
Vite · React 19 · TypeScript. Без бэкенда — интерактивный прототип
с состоянием в `localStorage` и полноценной интеграцией Telegram Mini App SDK.

## Запуск
```bash
npm install
npm run dev      # http://localhost:5179
npm run build    # production build → dist/
```
`?seed=1` в URL пропускает онбординг (для скриншот-тестов).

## Структура
```
src/
├── screens/      Onboarding · Profile · Catalog · Service · Booking · Confirm · Account · Anzh
├── components/   BottomNav · Mascot · AiChatBubble · ReviewSheet · SettingsSheet · UIHost · Icon
├── data/         services · profile · clinic
├── lib/          store · telegram · date · ics · i18n · ui · chat/mascot events
└── styles/       tokens.css (design system) · global.css
```

## Как это работает

**Состояние — `lib/store.ts`.** Записи, избранное, баллы, имя и валюта живут в одном
сторе с подпиской (`useStore()`) и сохраняются в `localStorage` под ключом `anzh_state_v1`.
Запись, созданная в Booking, тут же появляется в Confirm и в «Ближайшей записи» Кабинета;
перенос и отмена меняют её на месте, отмена возвращает начисленные баллы.
`?seed=1` всегда стартует с одинакового состояния — для скриншот-тестов.

**Лояльность.** Тиры Bronze → Silver → Gold → Diamond (0 / 300 / 600 / 1200 баллов),
кэшбэк 5–15% определяет, сколько баллов даёт визит. Прогресс-бар, подсказки и
ответы AI-ассистента считаются из текущего тира, а не из констант.

**Слоты.** Воскресенье закрыто, прошедшие сегодня часы недоступны, занятые слоты
детерминированы по дате — сетка не «прыгает» между рендерами. Тап по занятому слоту
переставляет на ближайший свободный.

**Telegram — `lib/telegram.ts`.** `ready/expand`, цвет хедера, safe-area из
`safeAreaInset` в CSS-переменные, нативный BackButton (сначала закрывает шторку,
потом возвращает по стеку экранов), тактильная отдача одним делегированным
слушателем, имя и язык из `initDataUnsafe`. Вне Telegram всё превращается в no-op —
прототип одинаково работает на localhost.

**Календарь — `lib/ics.ts`.** Кнопка «В календарь» отдаёт настоящий `.ics`
с адресом, гео-меткой и напоминанием за 2 часа.

---

🎨 Design & build by **ROCH** — виртуальный мозг-дизайнер · [roch-art.com](https://roch-art.com)
© Roman Chernyavsky
