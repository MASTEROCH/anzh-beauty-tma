// Адрес кабинета в одном месте. Раньше координаты были вписаны прямо в JSX
// в трёх файлах — переезд студии означал бы поиск по всему проекту, и один
// забытый хвост увёл бы клиентку не туда.
//
// Проверено по Nominatim: 41.6462404, 41.6323794 — это дом 92/94 по
// ფარნავაზ მეფის ქუჩა (ул. Parnavaz Mepe), Батуми.

export const STUDIO = {
  lat: 41.6462404,
  lon: 41.6323794,
  city: { ru: 'Батуми', en: 'Batumi' },
  street: { ru: 'ул. Parnavaz Mepe 92/94', en: '92/94 Parnavaz Mepe St' },
  floor: { ru: '1 этаж', en: 'floor 1' },
  hint: { ru: '10 мин от Boulevard · центр Батуми', en: '10 min from the Boulevard · central Batumi' },
  /* Приметы для того, кто уже стоит у двери */
  landmarks: {
    ru: [
      'Район Руставели · центр Батуми',
      'Свой домофон у двери — одна кнопка, откроет администратор',
      'Улица без пробок — от любой точки центра 10–15 минут',
    ],
    en: [
      'Rustaveli district · central Batumi',
      'Our own intercom at the door — one button, the receptionist opens',
      'A street without traffic — 10–15 min from anywhere downtown',
    ],
  },
} as const;

export const studioAddress = (lang: 'ru' | 'en') =>
  `${STUDIO.city[lang]} · ${STUDIO.street[lang]}, ${STUDIO.floor[lang]}`;

/* Порядок координат у сервисов РАЗНЫЙ: Google ждёт lat,lon, Яндекс — lon,lat.
   Перепутать здесь — значит увезти клиентку в другую точку планеты. */
export const googleMapsUrl = () =>
  `https://www.google.com/maps/search/?api=1&query=${STUDIO.lat},${STUDIO.lon}`;

export const yandexMapsUrl = () =>
  `https://yandex.com/maps/?pt=${STUDIO.lon},${STUDIO.lat}&z=17&l=map`;

/* Фрагмент карты с меткой. Масштаб задаём ШИРИНОЙ ОКНА, а не кнопками
   внутри embed: те живут в чужом iframe, нам не подчиняются и на телефоне
   просто не срабатывают. Кнопка, которая не работает, хуже её отсутствия. */
export const ZOOM_STEPS = [0.010, 0.006, 0.004, 0.0025, 0.0015] as const;
export const DEFAULT_ZOOM = 2;

export const osmEmbedUrl = (zoom: number = DEFAULT_ZOOM) => {
  const d = ZOOM_STEPS[Math.max(0, Math.min(ZOOM_STEPS.length - 1, zoom))];
  const bbox = [STUDIO.lon - d, STUDIO.lat - d / 2, STUDIO.lon + d, STUDIO.lat + d / 2];
  return `https://www.openstreetmap.org/export/embed.html?bbox=${bbox.join('%2C')}&layer=mapnik&marker=${STUDIO.lat}%2C${STUDIO.lon}`;
};
