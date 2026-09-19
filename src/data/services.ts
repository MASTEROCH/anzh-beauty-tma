import type { IconName } from '../components/Icon';

export type Service = {
  id: string;
  category: 'inj' | 'clean' | 'peel' | 'apparatus' | 'care' | 'derma' | 'brows' | 'training';
  /** Зона работы. Процедуры разных зон не мешают друг другу и идут параллельно:
      удаление татуировки на руке не должно отодвигать пилинг лица. */
  zone?: 'face' | 'body' | 'brows';
  title: string;
  short: string;
  description: string;
  /** Длительность в минутах. У обучения считается днями — см. `days` */
  duration: number;
  /** Курс идёт днями, а не минутами: 2 дня × 6 часов не влезают в duration */
  days?: number;
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
  { id: 'brows',     label: 'Брови',    icon: 'lash' },
  { id: 'derma',     label: 'Дерматолог', icon: 'stethoscope' },
  { id: 'training',  label: 'Обучение',   icon: 'crown' },
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
  {
    id: 'carbon-peel',
    category: 'apparatus',
    title: 'Карбоновый пилинг',
    short: 'Лазер + карбон · «голливудское сияние»',
    description:
      'Карбоновая маска впитывается в поры, лазер выпаривает её вместе с загрязнением и ороговевшим слоем. Поры чище, тон ровнее, кожа матовее — видно сразу после процедуры, без реабилитации.',
    duration: 45,
    priceUsd: 95,
    priceGel: 260,
    icon: 'bolt',
    includes: [
      'Карбоновая маска медицинского класса',
      'Лазерная обработка в двух режимах',
      'Успокаивающая маска после',
      'SPF на выход',
    ],
    contraindications: [
      'Беременность и лактация',
      'Свежий загар — менее 14 дней',
      'Герпес в активной фазе',
      'Фотосенсибилизирующие препараты',
    ],
  },
  {
    id: 'tattoo-removal',
    zone: 'body',
    category: 'apparatus',
    title: 'Удаление татуировок',
    short: 'Лазер · неодим, по сеансам',
    description:
      'Лазер дробит пигмент, организм выводит его сам. За один сеанс татуировка не уходит: нужен курс с интервалом 6–8 недель, их число зависит от плотности пигмента, цвета и давности работы.',
    duration: 40,
    priceUsd: 120,
    priceGel: 330,
    icon: 'bolt',
    includes: [
      'Оценка пигмента и прогноз по числу сеансов',
      'Анестезирующий крем',
      'Охлаждение во время процедуры',
      'Заживляющий уход и памятка',
    ],
    contraindications: [
      'Беременность и лактация',
      'Свежий загар — менее 14 дней',
      'Склонность к келоидным рубцам',
      'Онкология в анамнезе — только с допуском врача',
      'Приём антикоагулянтов и фотосенсибилизаторов',
    ],
  },
  {
    id: 'brow-lamination',
    zone: 'brows',
    category: 'brows',
    title: 'Ламинирование и окрашивание бровей',
    short: 'Форма, цвет и укладка · 6 недель',
    description:
      'Волоски фиксируются в нужном направлении, окрашивание добавляет плотности, уход питает. Брови держат форму без геля и укладки — примерно шесть недель.',
    duration: 60,
    priceUsd: 45,
    priceGel: 125,
    icon: 'lash',
    includes: [
      'Подбор формы под черты лица',
      'Ламинирование составом с кератином',
      'Окрашивание краской или хной',
      'Питательный уход после',
    ],
    contraindications: [
      'Аллергия на составы и краску — нужен тест за 48 часов',
      'Повреждения кожи в зоне бровей',
      'Беременность — обсуждаем индивидуально',
      'Недавняя пересадка бровей',
    ],
  },
  {
    id: 'dermatology',
    category: 'derma',
    title: 'Приём дерматолога',
    short: 'Диагностика · дерматоскопия',
    description:
      'Врачебный приём, а не косметологическая процедура: осмотр под дерматоскопом, оценка родинок и высыпаний, постановка диагноза и назначение лечения. Сюда же — то, что косметологией не решается.',
    duration: 40,
    priceUsd: 60,
    priceGel: 165,
    icon: 'stethoscope',
    includes: [
      'Осмотр и сбор анамнеза',
      'Дерматоскопия родинок и новообразований',
      'Назначение лечения или направление на анализы',
      'Письменное заключение',
    ],
    contraindications: [
      'Противопоказаний нет — это диагностический приём',
    ],
  },
  {
    id: 'training-injections',
    category: 'training',
    title: 'Обучение · инъекционные техники',
    short: 'Для косметологов · 2 дня',
    description:
      'Два дня практики: разметка, техника, работа с осложнениями. Группа до четырёх человек — каждый работает руками, а не смотрит. Отработка на моделях под контролем Анжелики.',
    duration: 480,
    days: 2,
    priceUsd: 800,
    priceGel: 2190,
    icon: 'syringe',
    includes: [
      'Два дня по 6 часов · теория и практика',
      'Группа до 4 человек — каждый работает сам',
      'Расходники и модели включены',
      'Сертификат и разбор ошибок после курса',
      'Чат поддержки на месяц после обучения',
    ],
    contraindications: [
      'Нужен действующий медицинский или косметологический диплом',
      'Без опыта работы с иглой — сначала базовый курс',
    ],
  },
  {
    id: 'training-authors',
    category: 'training',
    title: 'Обучение · авторская методика MD-Codes',
    short: 'Продвинутый курс · 2 дня',
    description:
      'Авторский протокол Анжелики: архитектура лица, подбор формы под овал, работа со сложными случаями. Для тех, кто уже колет и хочет перестать делать «как в учебнике».',
    duration: 480,
    days: 2,
    priceUsd: 1000,
    priceGel: 2740,
    icon: 'crown',
    includes: [
      'Два дня · разбор реальных кейсов участников',
      'Авторские протоколы разметки в печатном виде',
      'Работа на моделях со сложной анатомией',
      'Сертификат',
      'Личный разбор портфолио через месяц',
    ],
    contraindications: [
      'Требуется опыт инъекционных процедур от года',
      'Без базового курса не берём',
    ],
  },
];

export function findService(id: string) {
  return services.find((s) => s.id === id);
}

/* ── English titles/shorts for i18n ── */
const SERVICE_EN: Record<string, { title: string; short: string }> = {
  'lip-filler':     { title: 'Lip contouring',        short: 'Restylane Kysse · 1 ml' },
  'biorevit':       { title: 'Biorevitalization',     short: 'Hyaluronic acid · glow' },
  'deep-cleansing': { title: 'Deep facial cleansing', short: 'Atraumatic · ultrasound + manual' },
  'pdrn':           { title: 'PDRN · DNA therapy',    short: 'Regeneration & anti-age' },
  'almagold-peel':  { title: 'PRX-T33 peel',          short: 'Non-ablative · even tone' },
  'rf-lifting':     { title: 'RF face lifting',       short: 'INDIBA · needle-free lift' },
  'led-therapy':    { title: 'LED therapy',           short: 'Anti-acne / anti-age' },
};

export function sTitle(s: Service, lang: 'ru' | 'en') {
  return lang === 'en' ? SERVICE_EN[s.id]?.title ?? s.title : s.title;
}
export function sShort(s: Service, lang: 'ru' | 'en') {
  return lang === 'en' ? SERVICE_EN[s.id]?.short ?? s.short : s.short;
}
export const CATEGORY_KEY: Record<string, string> = {
  all: 'cat.all', inj: 'cat.inj', clean: 'cat.clean', peel: 'cat.peel', apparatus: 'cat.apparatus',
  care: 'cat.care', brows: 'cat.brows', derma: 'cat.derma', training: 'cat.training',
};

/* Фотографии услуг — ИЛЛЮСТРАЦИИ процедуры (сток, Pexels-лицензия), а не
   работы Анжелики. Отсюда два разных источника ниже: эту карточку показывать
   можно везде, а выдавать её за результат — нельзя. Услуга без файла честно
   показывает фирменную плитку с иконкой, а не пустой прямоугольник. */
const WITH_PHOTO = new Set([
  'lip-filler', 'biorevit', 'deep-cleansing', 'pdrn', 'almagold-peel', 'rf-lifting', 'led-therapy',
  'carbon-peel', 'tattoo-removal', 'brow-lamination', 'dermatology',
]);

export const servicePhoto = (id: string) => (WITH_PHOTO.has(id) ? `/photos/${id}.jpg` : null);

/* Настоящие «до / после» — только снимки Анжелики с согласия клиента. Пока их
   нет ни одного: пара берётся отсюда, а не из иллюстрации выше, иначе шторка
   сравнивает фотографию с самой собой и доказательство превращается в обман. */
const RESULT_PAIRS: Record<string, { before: string; after: string }> = {};

export const serviceResultPair = (id: string) => RESULT_PAIRS[id] ?? null;
