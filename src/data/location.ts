// Адрес кабинета в одном месте. Раньше координаты были вписаны прямо в JSX
// в трёх файлах — переезд студии означал бы поиск по всему проекту, и один
// забытый хвост увёл бы клиентку не туда.
//
// Проверено по Nominatim: 41.6462404, 41.6323794 — это дом 92/94 по
// ფარნავაზ მეფის ქუჩა (ул. Parnavaz Mepe), Батуми.

/* КОНТАКТЫ И АДРЕС — ЖИВЫЕ.
   Раньше всё это было вшито в код: сменила Анжелика номер, инстаграм или
   переехала студия — нужен разработчик и выкладка. Теперь значения ниже —
   ЗАПАСНЫЕ: приложение показывает их, пока не пришёл профиль с сервера
   (`GET /studio`, см. lib/studioProfile.ts), а потом читает его. Правит
   профиль владелица в кабинете: «Студия → О студии».
   Запасные нужны не «на всякий случай»: гость вне Telegram и первый кадр
   до ответа сервера обязаны видеть настоящий адрес, а не пустоту.

   История, которую стоит помнить: здесь когда-то стоял WhatsApp
   995500000000, которого не существует, — кнопка открывала чат в никуда.
   Фальшивая кнопка хуже отсутствующей; поэтому у телефона и WhatsApp нет
   запасных значений вовсе, а кнопки рисуются только когда номер задан. */
export interface Bi { ru: string; en: string }

export interface StudioProfile {
  name: string;
  tagline: Bi;
  city: Bi;
  street: Bi;
  floor: Bi;
  hint: Bi;
  landmarks: { ru: string[]; en: string[] };
  lat: number;
  lon: number;
  telegram: string;
  instagram: string | null;
  phone: string | null;
  whatsapp: string | null;
  hours: Bi;
  offDays: number[];
  /** Главы паспорта в подарок: включены ли и сколько подруг за главу */
  passportRules?: { enabled: boolean; friendsPerChapter: number };
}

/* 🚨 КООРДИНАТЫ. Были 41.6462404, 41.6323794 — это центроид дома по
   Nominatim, и он увёл метку на квартал в сторону (Роч показал на снимке
   настоящее место, 15.10.2026). Текущие сняты с той метки: по ним стоит и
   кадр карты, и ссылки «открыть в Яндексе / Google».
   Снято с картинки, а не с прибора — подтвердить тапом «Открыть в картах».

   Приметы для того, кто уже стоит у двери. Строки про домофон убраны (K13,
   F3; юрист, вариант B): домофон клиника не подтвердила, а строка называла
   администратора, которого в студии нет. Вернуть — только после подтверждения. */
export const STUDIO_DEFAULT: StudioProfile = {
  name: 'ANZH Cosmetology',
  tagline: { ru: 'Студия косметологии в Батуми', en: 'Cosmetology studio in Batumi' },
  city: { ru: 'Батуми', en: 'Batumi' },
  street: { ru: 'ул. Parnavaz Mepe 92/94', en: '92/94 Parnavaz Mepe St' },
  floor: { ru: '1 этаж', en: 'floor 1' },
  hint: { ru: '10 мин от Boulevard · центр Батуми', en: '10 min from the Boulevard · central Batumi' },
  landmarks: {
    ru: [
      'Район Руставели · центр Батуми',
      'Улица без пробок — от любой точки центра 10–15 минут',
    ],
    en: [
      'Rustaveli district · central Batumi',
      'A street without traffic — 10–15 min from anywhere downtown',
    ],
  },
  lat: 41.6459104,
  lon: 41.6317344,
  telegram: 'anzh_cosmetology',
  instagram: 'dr.domnich',
  phone: null,
  whatsapp: null,
  hours: { ru: 'Вт–Сб · 09:00–20:00', en: 'Tue–Sat · 09:00–20:00' },
  offDays: [0, 1],
};

let live: StudioProfile = STUDIO_DEFAULT;
const listeners = new Set<() => void>();

export const getStudio = (): StudioProfile => live;

export function setStudio(next: StudioProfile): void {
  live = next;
  listeners.forEach((l) => l());
}

export function subscribeStudio(fn: () => void): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

/** Прежние имена остаются: их читают десять файлов. Это ЗАПАСНЫЕ значения —
    живые берутся через `getStudio()` / `useStudio()`. */
export const CONTACTS = {
  telegram: STUDIO_DEFAULT.telegram,
  instagram: STUDIO_DEFAULT.instagram ?? '',
} as const;
export const STUDIO = STUDIO_DEFAULT;

export const telegramUrl = (text?: string) =>
  `https://t.me/${getStudio().telegram}${text ? `?text=${encodeURIComponent(text)}` : ''}`;
export const instagramUrl = (handle: string | null = getStudio().instagram) =>
  `https://instagram.com/${(handle ?? '').replace(/^@/, '')}`;
/** `tel:` только при заданном номере: кнопка «Позвонить» без номера не рисуется. */
export const phoneUrl = (): string | null => {
  const p = getStudio().phone;
  return p ? `tel:${p.replace(/[^\d+]/g, '')}` : null;
};
export const whatsappUrl = (text?: string): string | null => {
  const w = getStudio().whatsapp;
  return w ? `https://wa.me/${w.replace(/\D/g, '')}${text ? `?text=${encodeURIComponent(text)}` : ''}` : null;
};

export const studioAddress = (lang: 'ru' | 'en') => {
  const s = getStudio();
  return `${s.city[lang]} · ${s.street[lang]}, ${s.floor[lang]}`;
};

/* Порядок координат у сервисов РАЗНЫЙ: Google ждёт lat,lon, Яндекс — lon,lat.
   Перепутать здесь — значит увезти клиентку в другую точку планеты. */
export const googleMapsUrl = () =>
  `https://www.google.com/maps/search/?api=1&query=${getStudio().lat},${getStudio().lon}`;

export const yandexMapsUrl = () =>
  `https://yandex.com/maps/?pt=${getStudio().lon},${getStudio().lat}&z=17&l=map`;

/* Снимок со спутника вместо встроенной карты.
   Кадр снят ровно вокруг координат студии (центр 41.6459104, 41.6317344,
   зум 19, 201 × 134 м, 0.22 м на пиксель), поэтому метку на экране рисуем
   по центру и никакой математики не нужно.

   v2: кадр собран из плиток зума 19 и склеен, а не заказан у `export` —
   тот отдаёт максимум 1200 px и на нужном приближении просто отказывает,
   отчего первый кадр был мутным. Зум 20 в Батуми Esri ещё не отснял
   («Map data not yet available»), 19 — предел чёткости здесь.

   Лежит У НАС: встроенная карта — это запрос к чужому серверу с IP
   телефона, а здесь наружу не уходит ничего, и при этом видно сразу.

   🚨 Снимок — ESRI World Imagery. Атрибуция обязательна и выводится на
   кадре. Перед публикацией подтвердить, что условия ArcGIS позволяют
   хранить кадр у себя в коммерческом приложении; если нет — выкупить
   тот же кадр у Mapbox или Google Static Maps, поменяв только файл и
   строку `credit`. */
export const STUDIO_SAT = {
  src: '/photos/studio/map-sat-v2.webp',
  w: 900,
  h: 600,
  credit: 'Esri · Maxar · Earthstar Geographics',
} as const;

/* ПРАВОВЫЕ ДОКУМЕНТЫ.

   Адреса проверены запросом, все три отвечают 200 и открываются на
   языке интерфейса через `?lang=`. Выдумывать их было нельзя: мёртвая
   ссылка в правовом блоке хуже её отсутствия — человек решает, что
   согласие где-то есть, а открыть его не может. Тот же урок, что с
   несуществующим номером WhatsApp выше.

   🔴 Это ЧАСТЬ ответа на вопрос №9 из §1 контракта бэкенда: тексты
   обязаны существовать и быть доступны из приложения до первого
   реального клиента. Теперь они доступны. Открытым остаётся, покрывают
   ли эти тексты мини-приложение и обработку анкеты здоровья, — на сайте
   они написаны для сайта. Вопрос к юристу, не к коду. */
export const LEGAL = [
  { id: 'privacy', ru: 'Политика конфиденциальности', en: 'Privacy Policy', path: 'privacy.html' },
  { id: 'terms',   ru: 'Условия использования',       en: 'Terms of Use',   path: 'terms.html' },
  { id: 'refund',  ru: 'Политика возврата',           en: 'Refund Policy',  path: 'refund-policy.html' },
] as const;

export const legalUrl = (path: string, lang: 'ru' | 'en') =>
  `https://anzh.store/${path}?lang=${lang}`;
