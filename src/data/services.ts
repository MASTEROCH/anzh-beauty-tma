import type { IconName } from '../components/Icon';

export type Service = {
  id: string;
  category: 'inj' | 'clean' | 'peel' | 'apparatus' | 'care';
  title: string;
  short: string;
  description: string;
  duration: number;
  priceUsd: number;
  priceGel: number;
  icon: IconName;
  includes: string[];
  contraindications: string[];
};

export const categories: Array<{ id: Service['category'] | 'all'; label: string; icon: IconName }> = [
  { id: 'all',       label: 'Все',      icon: 'sparkles' },
  { id: 'inj',       label: 'Инъекции', icon: 'syringe' },
  { id: 'clean',     label: 'Чистки',   icon: 'wave' },
  { id: 'peel',      label: 'Пилинги',  icon: 'leaf' },
  { id: 'apparatus', label: 'Аппарат',  icon: 'bolt' },
  { id: 'care',      label: 'Уход',     icon: 'flower' },
];

export const services: Service[] = [
  {
    id: 'lip-filler',
    category: 'inj',
    title: 'Контурная пластика губ',
    short: 'Restylane Kysse · 1 мл',
    description:
      'Авторская техника MD-Codes. Подбираем форму под овал лица — естественный объём без «утиного» эффекта. Лёгкая анестезия, минимальный отёк.',
    duration: 90,
    priceUsd: 150,
    priceGel: 410,
    icon: 'lip',
    includes: [
      'Консультация и разметка по MD-Codes',
      'Препарат Restylane Kysse (1 мл, EU)',
      'Анестезия лидокаин-фри по запросу',
      'Контрольный визит через 14 дней',
    ],
    contraindications: [
      'Беременность и лактация',
      'Аутоиммунные заболевания в острой фазе',
      'Герпес в активной фазе — переносим запись',
      'Антикоагулянты — обсуждаем индивидуально',
    ],
  },
  {
    id: 'biorevit',
    category: 'inj',
    title: 'Биоревитализация',
    short: 'Гиалуроновая кислота · сияние',
    description:
      'Глубокое увлажнение кожи изнутри. Подходит для возрастной кожи, после перелётов, для подготовки к лету. Курс из 3 процедур с интервалом 2 недели.',
    duration: 60,
    priceUsd: 110,
    priceGel: 300,
    icon: 'sparkles',
    includes: [
      'Препарат IAL-System / Profhilo',
      'Очищение и подготовка',
      'Постпроцедурная маска',
    ],
    contraindications: [
      'Беременность и лактация',
      'Активные воспаления на коже',
      'Аллергия на гиалуроновую кислоту',
    ],
  },
  {
    id: 'deep-cleansing',
    category: 'clean',
    title: 'Глубокая чистка лица',
    short: 'Атравматичная · ультразвук + механика',
    description:
      'Очищение пор без повреждения кожи. Подходит для жирной и комбинированной кожи. Включает мягкий пилинг и успокаивающую маску.',
    duration: 90,
    priceUsd: 80,
    priceGel: 220,
    icon: 'wave',
    includes: [
      'Диагностика типа кожи',
      'Ультразвуковая + мануальная чистка',
      'Маска по типу кожи',
      'SPF и пост-уход в подарок',
    ],
    contraindications: [
      'Купероз в активной фазе',
      'Свежий загар (менее 7 дней)',
      'Открытые воспаления',
    ],
  },
  {
    id: 'pdrn',
    category: 'inj',
    title: 'PDRN · ДНК-терапия',
    short: 'Регенерация и anti-age',
    description:
      'Полинуклеотиды лосося — глубокое восстановление кожи на клеточном уровне. Подходит после агрессивных процедур, для зрелой кожи.',
    duration: 75,
    priceUsd: 180,
    priceGel: 490,
    icon: 'droplet',
    includes: [
      'PDRN препарат (Корея, оригинал)',
      'Микроинъекционная техника',
      'LED-терапия в подарок',
    ],
    contraindications: [
      'Беременность и лактация',
      'Аллергия на рыбу/морепродукты',
      'Аутоиммунные заболевания',
    ],
  },
  {
    id: 'almagold-peel',
    category: 'peel',
    title: 'PRX-T33 пилинг',
    short: 'Безабляционный · ровный тон',
    description:
      'Биоревитализирующий пилинг без слущивания. Идеален в любой сезон. Курс из 4 процедур даёт эффект «фарфоровой кожи».',
    duration: 45,
    priceUsd: 75,
    priceGel: 205,
    icon: 'leaf',
    includes: [
      'PRX-T33 (WiQo, Italy)',
      'Подбор количества слоёв',
      'Домашний уход в подарок (5 дней)',
    ],
    contraindications: [
      'Активный купероз',
      'Свежие раны на коже',
      'Беременность',
    ],
  },
  {
    id: 'rf-lifting',
    category: 'apparatus',
    title: 'RF-лифтинг лица',
    short: 'INDIBA · подтяжка без игл',
    description:
      'Радиоволновой лифтинг — мгновенный визуальный эффект, накопительный результат через 3-4 процедуры. Без реабилитации.',
    duration: 60,
    priceUsd: 90,
    priceGel: 245,
    icon: 'bolt',
    includes: [
      'Аппарат INDIBA Deep Beauty',
      'Лифтинг-маска',
      'Массаж лица в подарок',
    ],
    contraindications: [
      'Беременность',
      'Кардиостимулятор / металл в зоне',
      'Онкология в анамнезе (< 5 лет)',
    ],
  },
  {
    id: 'led-therapy',
    category: 'care',
    title: 'LED-терапия',
    short: 'Anti-acne / Anti-age',
    description:
      'Светотерапия трёх длин волн. Снимает воспаления, ускоряет регенерацию, выравнивает тон. Можно добавить к любой процедуре.',
    duration: 30,
    priceUsd: 40,
    priceGel: 110,
    icon: 'sun',
    includes: [
      'Маска Dermalux LED',
      'Выбор протокола (acne/anti-age/calm)',
      'Сыворотка в подарок',
    ],
    contraindications: [
      'Светочувствительность кожи',
      'Эпилепсия',
    ],
  },
];

export function findService(id: string) {
  return services.find((s) => s.id === id);
}
