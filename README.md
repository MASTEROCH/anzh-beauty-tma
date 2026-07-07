# ANZH · Beauty TMA

Telegram Mini App для эстетической медицины — кабинет косметолога **Анжелики** (Батуми).
Каталог процедур, запись со слотами, программа лояльности, AI-ассистент, паспорт здоровья.

**Дизайн-язык:** ANZH.store petrol-luxe × roch-art green-glow × Apple **Liquid Glass** (iOS 26/27).
Emerald `#12C088` + Gold `#F5C842` на petrol-teal `#061417`, плавающий glass-таббар,
serif-акценты (Playfair) поверх читабельного Inter, concierge-орб вместо маскота.

## Стек
Vite · React 18 · TypeScript. Без бэкенда — интерактивный прототип.

## Запуск
```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # production build → dist/
```
`?seed=1` в URL пропускает онбординг (для скриншот-тестов).

## Структура
```
src/
├── screens/      Onboarding · Profile · Catalog · Service · Booking · Confirm · Account · Anzh
├── components/   BottomNav · ConciergeOrb · AiChatBubble · UIHost · Icon
├── data/         services · profile
├── lib/          ui · chat/mascot events
└── styles/       tokens.css (design system) · global.css
```

---

🎨 Design & build by **ROCH** — виртуальный мозг-дизайнер · [roch-art.com](https://roch-art.com)
© Roman Chernyavsky
