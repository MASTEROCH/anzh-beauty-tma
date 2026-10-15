// Каталог процедур: ТИП услуги для экранов и СТАТИЧЕСКИЕ данные бандла.
//
// Источник правды о витрине — сервер (GET /services, lib/catalog.ts). Здесь:
//   · `services` — запасной список до первой загрузки каталога (и вход
//     tools/catalog-import.mjs, который заливает витрину в базу: slug = id);
//   · `findService` — ПЕРЕХОДНИК на загруженный каталог: сначала то, что
//     прислал сервер (или его кэш), и только для неизвестного ему id —
//     статическая запись (старые ссылки, история, избранное);
//   · форматтеры названий и фото.
//
// ⚠️ ФАЙЛ ОСТАЁТСЯ ЧИСТЫМИ ДАННЫМИ: никаких импортов, кроме `import type`.
// tools/catalog-import.mjs читает его снятием типов (esbuild) и отказывает,
// если здесь появится настоящий импорт. Загруженный каталог сюда ПОДАЁТ
// lib/catalog.ts через setLiveServices(), а не наоборот.

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
  /**
   * Length in minutes; null — no minutes (a course counted in `days`). A procedure
   * without minutes is not on the showcase (B4-A, lib/showable.ts).
   */
  duration: number | null;
  /** Курс идёт днями, а не минутами: 2 дня × 6 часов не влезают в duration */
  days?: number;
  /** Сколько моделей на практике — решающая цифра курса, её показывает плитка */
  models?: number;
  /** Price in minor units, like the server: 40000 with GEL is 400 ₾, 80000 with USD is $800. */
  priceMinor: number;
  /** Currency of THIS price (owner's decision B1-B, 06.10.2026): no switch; the main price is
   *  never converted — the only conversion is the display-only second price (lib/money.ts secondPrice, K11b). */
  currency: 'GEL' | 'USD';
  /** "from": the price is a lower bound (B3-G). */
  priceFrom?: boolean;
  icon: IconName;
  includes: string[];
  contraindications: string[];
  // ── English and the loaded catalog's fields (the bundle carries its own English, K8) ──
  titleEn?: string;
  shortEn?: string;
  descriptionEn?: string;
  /** Фото с сервера — только относительный путь /photos/… (см. servicePhoto). */
  photoUrl?: string;
  sort?: number;
  /**
   * Записывается ли через приложение — со слов сервера: `kind === 'procedure'`
   * (курс `training` сервер не записывает, 422 not_bookable). Читает
   * isBookable ниже. У статических записей бандла поля нет.
   */
  bookable?: boolean;
};

/**
 * Процедура, а не курс: можно записаться через приложение. ОДНО правило на
 * всё, что решает «процедура или курс», — запись, план, подсказки «добавить
 * к визиту», сочетания и цены помощника: сервер отказывает (422
 * not_bookable на /slots, /services/quote и POST /bookings) по kind, а не по
 * категории (Хейтер №11, решение John перед волной 3).
 * Решает признак `bookable` из каталога сервера (lib/catalog.ts fromServer:
 * `kind === 'procedure'`). Категория `training` — только запасной ответ для
 * статической записи бандла до первой загрузки каталога (у неё нет kind).
 * Через экран kind и категория не расходятся (ServiceEditor ставит kind по
 * категории, PATCH их не меняет — CREATE_ONLY в api/_domain/catalog.js,
 * импорт каталога ставит training ровно категории training); разойтись они
 * могут при POST /services в обход экрана — сервер принимает любую пару.
 */
export const isBookable = (s: Pick<Service, 'category' | 'bookable'>): boolean =>
  s.bookable ?? s.category !== 'training';

export const categories: Array<{ id: Service['category'] | 'all'; label: string; icon: IconName }> = [
  { id: 'all',       label: 'Все',      icon: 'sparkles' },
  { id: 'inj',       label: 'Инъекции', icon: 'syringe' },
  { id: 'clean',     label: 'Чистки',   icon: 'wave' },
  { id: 'peel',      label: 'Пилинги',  icon: 'leaf' },
  { id: 'apparatus', label: 'Аппарат',  icon: 'bolt' },
  { id: 'care',      label: 'Уход',     icon: 'flower' },
  { id: 'brows',     label: 'Брови',    icon: 'lash' },
  { id: 'derma',     label: 'Дерматолог', icon: 'stethoscope' },
  { id: 'training',  label: 'Обучение',   icon: 'graduation' },
];

/*
 * Her showcase, step 1 (KT-7, K8; K13): 8 procedures and 3 courses, texts — T2 ed. 2 (Katya,
 * after the lawyer's first pass) with the lawyer's second pass (K13: lips, biorevitalization,
 * botulinum, threads, collagen stimulators); prices, units, "from" and length — table 06
 * ed. 3.1 §1, lips by column A (John 06.10: opened once the lawyer passed the visible texts)
 * — the same as tests/fixtures/catalog-c4.ts. The prototype demo is gone: archived rows are not
 * here, hidden §2 rows come from the live set (tools/catalog-apply.mjs), not from the bundle.
 * `dermatology` stays as it was (hidden until the lawyer answers, lib/showable.ts).
 *
 * Contraindication lists are NOT shown on the card (B6-V: one line instead, ServiceScreen);
 * they feed the warning at booking and the flag in the client card. Lists of the new
 * procedures come with the set after Anjelika's "yes" — the bundle does not invent them.
 * A course's `contraindications` are its "Requirements" (T2 §5.2). No brand names.
 */
export const services: Service[] = [
  {
    id: 'contour-plastic',
    category: 'inj',
    zone: 'face',
    title: 'Контурная пластика',
    titleEn: 'Facial contouring',
    short: 'Скулы, углы челюсти, подбородок, профиль',
    shortEn: 'Cheekbones, jawline, chin, profile',
    description: [
      'Коррекция углов нижней челюсти и скул, удлинение и заострение подбородка, вытягивание профиля.',
      'Чаще всего работают на всё лицо: углы челюсти, скулы, подбородок. Объём — минимум 2 мл на все зоны, максимум 3–4 мл; сколько именно, зависит от того, насколько нужна коррекция.',
      'Только по показаниям. Начать можно с очного осмотра или онлайн-консультации по твоим фото, окончательное решение — на приёме.',
    ].join('\n\n'),
    descriptionEn: [
      'Correction of the lower jaw angles and cheekbones, a longer and sharper chin, a more defined profile.',
      'Most often it is done on the whole face: jaw angles, cheekbones, chin. The volume is at least 2 ml for all areas together and 3–4 ml at most; the exact amount depends on how much correction is needed.',
      'Only when indicated. You can start with an in-person examination or an online consultation based on your photos; the final decision is made at the appointment.',
    ].join('\n\n'),
    duration: 40,
    priceMinor: 40000,
    currency: 'GEL',
    priceFrom: true,
    icon: 'syringe',
    includes: [],
    contraindications: [],
  },
  {
    id: 'lip-filler',
    category: 'inj',
    zone: 'face',
    title: 'Увеличение губ',
    titleEn: 'Lip enhancement',
    short: 'Форма и объём, увлажнение, коррекция асимметрии',
    shortEn: 'Shape and volume, hydration, correcting asymmetry',
    description: [
      'Не только увеличение: коррекция асимметрии, увлажнение, придание лёгкой формы и припухлости.',
      'Цена зависит от препарата: 380 ₾, 400 ₾ или 650 ₾ за 1 мл. У одного препарата шприц 0,55 мл — 450 ₾. Наличие нужного препарата уточняй заранее.',
      'Подходит ли процедура и сколько препарата нужно, решают на осмотре.',
    ].join('\n\n'),
    descriptionEn: [
      'Not just enlargement: correction of asymmetry, hydration, a light shape and fullness.',
      'The price depends on the product: 380 ₾, 400 ₾ or 650 ₾ per ml. One product comes in a 0.55 ml syringe — 450 ₾. Check availability of the product you want in advance.',
      'Whether the treatment suits you, and how much product is needed, is decided at the examination.',
    ].join('\n\n'),
    duration: 30,
    priceMinor: 38000,
    currency: 'GEL',
    priceFrom: true,
    icon: 'lip',
    includes: [],
    contraindications: [],
  },
  {
    id: 'filler-dissolve',
    category: 'inj',
    zone: 'face',
    title: 'Удаление филлера',
    titleEn: 'Filler removal',
    short: 'Растворение филлера в губах: точечно или полностью',
    shortEn: 'Dissolving lip filler: spot or full',
    description: [
      'Для губ, в которых уже есть филлер: если он мигрировал, образовались комочки, уплотнения или неровности. Или если хочешь убрать весь старый филлер и сделать новый.',
      'Растворение бывает локальным — точечно, только проблемное место — и полным, когда из губ убирают весь филлер. Что подойдёт, решают на осмотре. Локальное растворение — 100 ₾, полное удаление из губ — 200 ₾.',
      'Используется гиалуронидаза испанского производства.',
    ].join('\n\n'),
    descriptionEn: [
      'For lips that already have filler: if it has migrated, or lumps, hardening or unevenness have formed. Or if you want all the old filler removed and a new one placed.',
      'Dissolving can be local — spot treatment of the problem area only — or full, when all the filler is removed from the lips. What suits you is decided at the examination. Local dissolving costs 100 ₾, full removal from the lips 200 ₾.',
      'Spanish-made hyaluronidase is used.',
    ].join('\n\n'),
    duration: 30,
    priceMinor: 10000,
    currency: 'GEL',
    priceFrom: true,
    icon: 'droplet',
    includes: [],
    contraindications: [],
  },
  {
    id: 'biorevit',
    category: 'inj',
    zone: 'face',
    title: 'Биоревитализация',
    titleEn: 'Biorevitalization',
    // "a course of 2–5" only with the unit "per session" next to the price (lib/money.ts
    // PRICE_UNITS; the lawyer, K13 block 4) — otherwise the card reads as the price of a course
    short: 'Увлажнение кожи · курс 2–5 сеансов',
    shortEn: 'Skin hydration · a course of 2–5 sessions',
    description: [
      'Базовая процедура: увлажнение кожи; её делают и с профилактической целью. Вау-эффекта она не даёт — и мы его не обещаем. Кожа может стать глаже и увлажнённее, может появиться сияние — насколько заметно, у всех по-разному.',
      'Нужен курс — от 2 до 5 сеансов; сколько именно, зависит от состояния кожи, степени обезвоживания и препарата. Препараты разные, цена зависит от препарата: 350 ₾, 400 ₾, 550 ₾ или 650 ₾ за сеанс. Наличие нужного препарата уточняй заранее.',
    ].join('\n\n'),
    descriptionEn: [
      'A basic treatment: skin hydration; it is also done as a preventive measure. It does not give a “wow” effect, and we do not promise one. Your skin may become smoother and more hydrated, with a glow — how noticeable this is varies from person to person.',
      'A course is needed — from 2 to 5 sessions; how many depends on the condition of your skin, how dehydrated it is, and the product. The price depends on the product: 350 ₾, 400 ₾, 550 ₾ or 650 ₾ per session. Check availability of the product you want in advance.',
    ].join('\n\n'),
    duration: 15,
    priceMinor: 35000,
    currency: 'GEL',
    priceFrom: true,
    icon: 'sparkles',
    includes: [],
    // The prototype list is gone (the lawyer, K13: the set's list with its closing line, or
    // none): the list comes with the set, like every other procedure's.
    contraindications: [],
  },
  {
    id: 'botulinum',
    category: 'inj',
    zone: 'face',
    title: 'Ботулинотерапия',
    titleEn: 'Botulinum therapy',
    short: 'Верхняя треть лица, бруксизм, гипергидроз, шея',
    shortEn: 'Upper face, bruxism, hyperhidrosis, neck',
    description: [
      'Ботулотоксин на время расслабляет мышцы, поэтому мимические заломы и морщины становятся менее заметны.',
      'Зоны: верхняя треть лица — лоб, межбровье, «кроличьи» морщины у носа, область вокруг глаз, при необходимости подъём кончика носа; флип-лип — разворот верхней губы за счёт расслабления круговой мышцы рта; DAO — мышца, опускающая углы рта («грустная улыбка»); жевательные мышцы — при бруксизме (когда человек скрипит или сжимает зубами, чаще ночью); гипергидроз — повышенная потливость подмышек, ладоней и стоп; платизма на шее — мышца, которая тянет лицо вниз; работают и с тяжами, и со спазмом мышцы.',
      'Жевательные мышцы мы колем только по показаниям — при бруксизме, не для похудения лица.',
      'Цена — за единицу препарата: 10 ₾ или 15 ₾ в зависимости от препарата. Сколько единиц нужно, индивидуально: например, на лоб уходит 10, 15 или 20 единиц.',
    ].join('\n\n'),
    descriptionEn: [
      'Botulinum toxin temporarily relaxes the muscles, so expression lines and wrinkles become less visible.',
      'Areas: the upper third of the face — forehead, between the brows, “bunny lines” at the nose, around the eyes, and, if needed, lifting the tip of the nose; flip-lip — turning out the upper lip by relaxing the muscle around the mouth; DAO — the muscle that pulls the corners of the mouth down, which can make a smile look sad; masseter muscles — for bruxism (grinding or clenching the teeth, usually at night); hyperhidrosis — excessive sweating of the underarms, palms and feet; platysma in the neck — the muscle that pulls the face down; we also work with neck bands and muscle spasm.',
      'We treat the masseter muscles only when indicated, for bruxism — not to slim the face.',
      'The price is per unit of the product: 10 ₾ or 15 ₾ depending on the product. How many units you need is individual: for the forehead, for example, 10, 15 or 20 units.',
    ].join('\n\n'),
    duration: 30,
    priceMinor: 1000,
    currency: 'GEL',
    priceFrom: true,
    icon: 'syringe',
    includes: [],
    contraindications: [],
  },
  {
    id: 'collagen-stimulators',
    category: 'inj',
    zone: 'face',
    title: 'Коллагеностимуляторы',
    titleEn: 'Collagen stimulators',
    short: 'Чаще после 30 · гидроксиапатит кальция, полимолочная кислота',
    shortEn: 'Often after 30 · calcium hydroxylapatite, polylactic acid',
    description: [
      'Препараты, которые стимулируют выработку собственного коллагена и уплотняют кожу. Чаще их делают после 30. Используют, чтобы работать с дряблостью кожи, сгладить поверхность и создать «каркас» внутри кожи.',
      'Цена зависит от препарата и зоны: от 600 ₾ до 1500 ₾. Наличие нужного препарата уточняй заранее. Армирующие мононити — отдельная позиция каталога.',
    ].join('\n\n'),
    descriptionEn: [
      'Products that stimulate your own collagen production and firm the skin. They are most often done after 30. Used to work on sagging skin, smooth the surface and create a “framework” inside the skin.',
      'The price depends on the product and the area: from 600 ₾ to 1500 ₾. Check availability of the product you want in advance. Reinforcing mono threads are a separate item in the catalog.',
    ].join('\n\n'),
    duration: 60,
    priceMinor: 60000,
    currency: 'GEL',
    priceFrom: true,
    icon: 'layers',
    includes: [],
    contraindications: [],
  },
  {
    id: 'mono-threads',
    category: 'inj',
    zone: 'face',
    title: 'Армирующие мононити',
    titleEn: 'Reinforcing mono threads',
    short: 'Рассасывающиеся нити · цена зависит от зоны',
    shortEn: 'Absorbable threads · price depends on the area',
    description: [
      'Армирующие мононити, их называют ещё мезонитями, относятся к коллагеностимуляторам. Используются нити из поликапролактона или полимолочной кислоты; они рассасываются.',
      'Цена зависит от зоны.',
    ].join('\n\n'),
    descriptionEn: [
      'Reinforcing mono threads, also called mesothreads, belong to the collagen stimulators. The threads are made of polycaprolactone or polylactic acid and are absorbed by the body.',
      'The price depends on the area.',
    ].join('\n\n'),
    duration: 60,
    priceMinor: 60000,
    currency: 'GEL',
    priceFrom: true,
    icon: 'wave',
    includes: [],
    contraindications: [],
  },
  {
    id: 'smas-lifting',
    category: 'apparatus',
    zone: 'face',
    title: 'SMAS-лифтинг аппаратный',
    titleEn: 'SMAS lifting (device)',
    short: 'Аппаратная процедура без игл',
    shortEn: 'A device treatment, no needles',
    description: [
      'Аппаратная процедура, которая уплотняет кожу и стимулирует выработку коллагена. Чаще её советуют при отёчно-деформационном типе возрастных изменений; подходит ли она тебе — решают на осмотре.',
      'Главное отличие от инъекций: процедура безинъекционная, то есть без игл. Цена зависит от зоны.',
    ].join('\n\n'),
    descriptionEn: [
      'A device treatment that firms the skin and stimulates collagen production. It is most often recommended for the edematous-deformational aging type; whether it suits you is decided at the examination.',
      'The main difference from injections: it is needle-free. The price depends on the area.',
    ].join('\n\n'),
    duration: 60,
    priceMinor: 25000,
    currency: 'GEL',
    priceFrom: true,
    icon: 'bolt',
    includes: [],
    contraindications: [],
  },
  {
    id: 'dermatology',
    category: 'derma',
    title: 'Приём дерматолога',
    short: 'Диагностика · дерматоскопия',
    description:
      'Врачебный приём, а не косметологическая процедура: осмотр под дерматоскопом, оценка родинок и высыпаний, постановка диагноза и назначение лечения. Сюда же — то, что косметологией не решается.',
    duration: 40,
    priceMinor: 6000,
    currency: 'USD',
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
  // Из голосовых владелицы 05.10 (лог ROCH #1009): цены названы, «от».
  // ⚠️ Длительность в голосовых НЕ названа — 60 и 30 мин стоят как
  // допущение до слова Анжелики (сервер без минут не записывает, B4-A).
  {
    id: 'deep-cleansing',
    category: 'clean',
    zone: 'face',
    title: 'Чистка лица',
    titleEn: 'Facial cleansing',
    short: 'Поры, закрытые комедоны, уход после',
    shortEn: 'Pores, closed comedones, aftercare',
    description: 'Эстетическая чистка: очищение пор, работа с закрытыми комедонами и уход после процедуры. Проводит врач-дерматолог Мария.',
    descriptionEn: 'An aesthetic cleansing: clearing pores, working with closed comedones and aftercare. Performed by dermatologist Mariya.',
    duration: 60,
    priceMinor: 20000,
    currency: 'GEL',
    priceFrom: true,
    icon: 'wave',
    includes: [],
    contraindications: [],
  },
  {
    id: 'mesotherapy',
    category: 'inj',
    zone: 'face',
    title: 'Мезотерапия',
    titleEn: 'Mesotherapy',
    short: 'Лицо, зона вокруг глаз, кожа головы · курс от 3 сеансов',
    shortEn: 'Face, eye area, scalp · a course of 3+ sessions',
    description: 'Всегда курсом — минимум 3 сеанса. Препарат и число сеансов Анжелика подбирает на осмотре под задачу: лицо, зона вокруг глаз или кожа головы. Цена — за один сеанс.',
    descriptionEn: 'Always as a course — at least 3 sessions. Anjelika picks the product and the number of sessions at the exam for your goal: face, eye area or scalp. The price is per session.',
    duration: 30,
    priceMinor: 25000,
    currency: 'GEL',
    priceFrom: true,
    icon: 'droplet',
    includes: ['Минимальный курс — 3 сеанса'],
    contraindications: [],
  },
  {
    id: 'training-injections',
    category: 'training',
    title: 'Обучение: мезотерапия и биоревитализация',
    titleEn: 'Training: mesotherapy and biorevitalization',
    short: '2 дня · строго индивидуальный формат',
    shortEn: '2 days · strictly individual format',
    description: [
      'Мезотерапия и биоревитализация — с этого курса начинается обучение у Анжелики. Два дня, на практике — 10 моделей. Формат строго индивидуальный.',
      'Оба дня — с 12:00 до 17:00, есть получасовой перерыв на обед — он входит в стоимость. В конце второго дня выдаётся сертификат. Сертификат подтверждает прохождение курса; права на медицинскую практику он сам по себе не даёт.',
      'Обучение — для специалистов с высшим или средним медицинским образованием: с нуля Анжелика не обучает.',
    ].join('\n\n'),
    descriptionEn: [
      'Mesotherapy and biorevitalization — this is where Anjelika’s training starts. Two days, with 10 models for practice. The format is strictly individual.',
      'Both days run from 12:00 to 17:00, with a 30-minute lunch break that is included in the price. A certificate is issued at the end of the second day. The certificate confirms completion of the course; it does not by itself grant the right to practise.',
      'The training is for specialists with a higher or secondary medical education: Anjelika does not train from scratch.',
    ].join('\n\n'),
    // A course runs in days, not minutes (B4-A): no visit minutes.
    duration: null,
    days: 2,
    models: 10,
    priceMinor: 80000,
    currency: 'USD',
    icon: 'droplet',
    includes: [
      'Два дня, оба — с 12:00 до 17:00',
      'Практика на 10 моделях',
      'Обед (30 минут) входит в стоимость',
      'Сертификат о прохождении курса — в конце второго дня',
    ],
    contraindications: [
      'Высшее или среднее медицинское образование',
      'Обучение не с нуля: нужна база',
    ],
  },
  {
    id: 'course-collagen',
    category: 'training',
    title: 'Обучение: коллагеностимуляторы',
    titleEn: 'Training: collagen stimulators',
    short: '2 дня практики · 5 моделей',
    shortEn: '2 days of practice · 5 models',
    description: [
      'Два дня практики по коллагеностимуляторам: полимолочная кислота и армирующие мононити. В первый день — теория и практика, во второй — усиленная практика. Работа идёт на 5 моделях.',
      'Обучение — для специалистов с высшим или средним медицинским образованием: с нуля Анжелика не обучает.',
    ].join('\n\n'),
    descriptionEn: [
      'Two days of practice with collagen stimulators: polylactic acid and reinforcing mono threads. Day one is theory and practice, day two is intensive practice. You work on 5 models.',
      'The training is for specialists with a higher or secondary medical education: Anjelika does not train from scratch.',
    ].join('\n\n'),
    duration: null,
    days: 2,
    models: 5,
    priceMinor: 100000,
    currency: 'USD',
    icon: 'layers',
    includes: [
      'Два дня практики',
      'Первый день — теория и практика',
      'Второй день — усиленная практика',
      'Работа на 5 моделях',
    ],
    contraindications: [
      'Высшее или среднее медицинское образование',
      'Обучение не с нуля: нужна база',
    ],
  },
  {
    id: 'course-cannula',
    category: 'training',
    title: 'Обучение: работа с канюлями',
    titleEn: 'Training: working with cannulas',
    short: '1 день · 5 моделей',
    shortEn: '1 day · 5 models',
    description: [
      'Однодневный курс: на нём учатся работать с канюлями. На практике — 5 моделей.',
      'Обучение — для специалистов с высшим или средним медицинским образованием: с нуля Анжелика не обучает.',
    ].join('\n\n'),
    descriptionEn: [
      'A one-day course: you learn to work with cannulas. 5 models for practice.',
      'The training is for specialists with a higher or secondary medical education: Anjelika does not train from scratch.',
    ].join('\n\n'),
    duration: null,
    days: 1,
    models: 5,
    priceMinor: 40000,
    currency: 'USD',
    icon: 'cannula',
    includes: [],
    contraindications: [
      'Высшее или среднее медицинское образование',
      'Обучение не с нуля: нужна база',
    ],
  },
];

/* ── Загруженный каталог ──────────────────────────────────────────────── */

// HIDDEN_FROM_SHOWCASE / isOnShowcase moved to lib/showable.ts (K1): the showcase rule
// lives in one module the tools load too. This file stays pure data (no real imports).

let live: Service[] | null = null;
let liveById = new Map<string, Service>();
const staticById = new Map(services.map((s) => [s.id, s] as const));

/** Подаёт загруженный каталог (сервер или его кэш). Зовёт только lib/catalog.ts. */
export function setLiveServices(list: Service[] | null) {
  live = list;
  liveById = new Map((list ?? []).map((s) => [s.id, s] as const));
}

/** Загруженный каталог или null, пока ни сервер, ни кэш его не дали. */
export const loadedServices = (): Service[] | null => live;

/**
 * Услуга по id. Сначала — загруженный каталог (цена и тексты сервера);
 * статическая запись — только для id, которого загруженный каталог не знает
 * (до первой загрузки — для всех). Отсутствие — честное undefined: вызывающий
 * обязан показать «не найдено», а не подставить соседнюю процедуру.
 */
export function findService(id: string): Service | undefined {
  return liveById.get(id) ?? staticById.get(id);
}

/* English — only the row's own field (K8; 03 and 06 §4a). The spare dictionary by id is
   gone: it put a prototype title (and a brand) over a server row whose English differs. */
export function sTitle(s: Service, lang: 'ru' | 'en') {
  return lang === 'en' ? s.titleEn || s.title : s.title;
}
export function sShort(s: Service, lang: 'ru' | 'en') {
  return lang === 'en' ? s.shortEn || s.short : s.short;
}
export const CATEGORY_KEY: Record<string, string> = {
  all: 'cat.all', inj: 'cat.inj', clean: 'cat.clean', peel: 'cat.peel', apparatus: 'cat.apparatus',
  care: 'cat.care', brows: 'cat.brows', derma: 'cat.derma', training: 'cat.training',
};

/* A service's cover photo comes from the loaded catalog only (`photo_url`). The prototype's
   stock illustrations (the fixed list of seven) are gone from the screens (K11a; owner 06.10: "only
   our own photos"): a service without a photo shows the brand tile with its icon. The studio's
   own work photos live in data/works.ts. Rows whose `photo_url` still names a stock file are
   cleared by the data set (photo_url = null), not here. */
/* Фото из загруженного каталога берём ТОЛЬКО относительным путём внутри
   /photos/: адрес пишет владелица из кабинета, а подставляется он в
   `url(...)` стиля — чужой домен или скобка в строке сюда не пройдут. */
/* До двух папок внутри /photos/: собственные снимки лежат не в корне, а
   в `/photos/works/<услуга>/1.webp`. Прежнее правило разрешало только корень
   и молча отрезало бы их, даже если бы владелица вписала адрес из кабинета.
   `..` и чужой домен по-прежнему не проходят: разрешены только эти символы. */
const SAFE_PHOTO = /^\/photos\/(?:[A-Za-z0-9._-]+\/){0,2}[A-Za-z0-9._-]+\.(?:jpe?g|png|webp)$/;

/* Запасная обложка из наших снимков. Подаётся снаружи (lib/catalog.ts), а не
   импортируется: этот файл остаётся чистыми данными — tools/catalog-import.mjs
   снимает с него типы и отказывает на любом настоящем импорте. */
let photoFallback: ((id: string) => string | null) | null = null;
export function setServicePhotoFallback(fn: ((id: string) => string | null) | null) {
  photoFallback = fn;
}

export const servicePhoto = (id: string): string | null => {
  const fromCatalog = liveById.get(id)?.photoUrl;
  if (fromCatalog && SAFE_PHOTO.test(fromCatalog)) return fromCatalog;
  const own = photoFallback?.(id);
  return own && SAFE_PHOTO.test(own) ? own : null;
};
