// K15 (owner 07.10, "все свои фотки выкладывай"): the studio team on the main screen.
// Data only. Names without surnames (works.ts); no buttons. The three masters with works take
// their portrait through masterPhoto(), so the `published` switch of works.ts rules here too;
// Maria and Daria have their own file and switch. Portraits — square crops of
// "Фото мастера …" from the team folder, 480 px, under /photos/works/ or /photos/team/.

import { masterPhoto, MASTERS, type MasterId } from './works';

export type TeamPhoto = { src: string; w: number; h: number; published: boolean };

/* Куда смотреть в кадре — для портретов, у которых пропорции НЕ совпадают
   с кругом (у квадрата в квадрате `cover` ничего не обрезает, и сдвигать
   нечего: там кадрируют сам файл, см. works.ts, master-anzhelika/2).
   По умолчанию центр. */
export type Focus = { x: number; y: number };
const CENTER: Focus = { x: 50, y: 50 };
export const teamFocus = (m: TeamMember): Focus => m.focus ?? CENTER;

/** Подпись под кружком: короткая форма, если она задана. */
export const teamShort = (m: TeamMember, lang: 'ru' | 'en'): string => (m.short ?? m.role)[lang];
export type TeamMember = {
  id: 'anzhelika' | 'ekaterina' | 'roman' | 'mariya' | 'darya';
  name: { ru: string; en: string };
  role: { ru: string; en: string };
  /** A master with works: the portrait is read through masterPhoto() at render time. */
  master?: MasterId;
  /** Everyone else: an own file and switch. */
  photo?: TeamPhoto;
  /** Где в кадре лицо, если не в центре (см. Focus). */
  focus?: Focus;
  /** Подпись под кружком. Колонка — 60 px: туда влезает одно слово.
      Полная должность живёт в `role` и показывается там, где есть место. */
  short?: { ru: string; en: string };
  /** Фамилия — из папки «Люди (Команда)». В кружке не помещается,
      в карточке специалиста нужна: это представление человека. */
  surname?: { ru: string; en: string };
};

/** The portrait that may be shown now, or null. */
export const teamPhoto = (m: TeamMember): TeamPhoto | null => {
  if (m.master) {
    const p = masterPhoto(m.master);
    return p ? { src: p.src, w: p.w, h: p.h, published: p.published } : null;
  }
  return m.photo && m.photo.published ? m.photo : null;
};

/* КТО ЧЕМ ЗАНИМАЕТСЯ — текст для карточки специалиста.
 *
 * Источник: голосовые владелицы (расшифровка 05.10.2026) и папка
 * «Люди (Команда)», откуда взялись фамилии — Быцкевич у Романа, Домнич у
 * Дарьи. Регалии — её словами: «три высших красных диплома» у Марии,
 * «более 50 сертификатов» и кадавер-курсы у Анжелики.
 *
 * ⚠️ У Дарьи личных фактов нет ни одного: владелица про неё не говорила.
 * Поэтому её карточка описывает РОЛЬ, а не человека — что делает
 * администратор в студии, без выдуманного стажа, образования и характера.
 * Придуманная биография живого человека — это не «дописал текст», это
 * ложь от его имени.
 */
export type TeamBio = {
  /** Регалии одной строкой — то, что подтверждено её словами */
  cred?: { ru: string; en: string };
  /** Чем занимается: короткие пункты, а не абзац */
  does: { ru: string[]; en: string[] };
};

/* Какие услуги витрины ведёт человек. Нужно для кнопки «их услуги» в
   карточке специалиста: каталог умеет фильтровать по категории, но не по
   мастеру, а человек спрашивает именно «что делает ОНА».
   Список — id услуг из data/services.ts; те, которых нет на витрине
   (нет цены или длительности), просто не нарисуются. */
export const MASTER_SERVICES: Readonly<Record<TeamMember['id'], readonly string[]>> = {
  anzhelika: [
    'contour-plastic', 'lip-filler', 'filler-dissolve', 'biorevit', 'botulinum',
    'collagen-stimulators', 'mono-threads', 'smas-lifting',
    'training-injections', 'course-collagen', 'course-cannula',
  ],
  mariya: ['dermatology', 'biorevit', 'botulinum', 'lip-filler'],
  ekaterina: [],
  roman: [],
  darya: [],
};

export const TEAM_BIO: Readonly<Record<TeamMember['id'], TeamBio>> = {
  anzhelika: {
    cred: {
      ru: 'Харьковский национальный медицинский университет, 2020 · более 50 сертификатов · кадавер-курсы',
      en: 'Kharkiv National Medical University, 2020 · 50+ certificates · cadaver courses',
    },
    does: {
      ru: [
        'Контурная пластика: скулы, углы челюсти, подбородок, профиль',
        'Увеличение губ и коррекция формы, удаление филлера',
        'Биоревитализация, мезотерапия, ботулинотерапия',
        'Коллагеностимуляторы и армирующие мононити',
        'Аппаратный SMAS-лифтинг',
        'Обучение действующих врачей',
      ],
      en: [
        'Contouring: cheekbones, jawline, chin, profile',
        'Lip augmentation and shape correction, filler dissolving',
        'Biorevitalization, mesotherapy, botulinum therapy',
        'Collagen stimulators and reinforcing threads',
        'Device SMAS lifting',
        'Training for practising doctors',
      ],
    },
  },
  ekaterina: {
    does: {
      ru: [
        'Ламинирование бровей',
        'Окрашивание и осветление',
        'Архитектура и коррекция формы',
        'Перманентный макияж бровей',
      ],
      en: [
        'Brow lamination',
        'Tinting and lightening',
        'Shape architecture and correction',
        'Brow permanent makeup',
      ],
    },
  },
  roman: {
    does: {
      ru: [
        'Лазерное удаление татуировок',
        'Удаление перманентного макияжа',
        'Удаление пигмента',
        'Карбоновый пилинг',
      ],
      en: [
        'Laser tattoo removal',
        'Permanent makeup removal',
        'Pigment removal',
        'Carbon peel',
      ],
    },
  },
  mariya: {
    cred: { ru: 'Врач-дерматолог, дерматовенеролог · три высших красных диплома', en: 'Dermatologist, dermatovenereologist · three honours degrees' },
    does: {
      ru: [
        'Лечение акне и хронических заболеваний кожи',
        'Работа с рубцами и постакне',
        'Чистки и пилинги',
        'Биоревитализация, ботулинотерапия, контурная пластика губ',
        'Назначение лечения и домашнего ухода',
      ],
      en: [
        'Acne and chronic skin conditions',
        'Scars and post-acne',
        'Cleansings and peels',
        'Biorevitalization, botulinum therapy, lip contouring',
        'Prescribing treatment and home care',
      ],
    },
  },
  darya: {
    does: {
      ru: [
        'Встречает в студии и провожает в кабинет',
        'Записывает на процедуры и переносит записи',
        'Отвечает на вопросы до визита',
        'Подтверждает заявки вместе с Анжеликой',
      ],
      en: [
        'Meets you at the studio and shows you in',
        'Books and reschedules appointments',
        'Answers questions before the visit',
        'Confirms requests together with Anjelika',
      ],
    },
  },
};

/* Order and roles — Sanya's K15 §3, the lawyer's table (roles «как есть»). */
export const TEAM: readonly TeamMember[] = [
  { id: 'anzhelika', name: MASTERS.anzhelika.name, role: { ru: 'Косметолог, владелица', en: 'Cosmetologist, owner' }, short: { ru: 'Косметолог', en: 'Cosmetologist' }, master: 'anzhelika' },
  { id: 'ekaterina', name: MASTERS.ekaterina.name, role: { ru: 'Бровист', en: 'Brow artist' }, surname: { ru: 'Попова', en: 'Popova' }, master: 'ekaterina' },
  { id: 'roman', name: MASTERS.roman.name, role: { ru: 'Лазерное удаление', en: 'Laser removal' }, short: { ru: 'Лазер', en: 'Laser' }, surname: { ru: 'Быцкевич', en: 'Bytskevich' }, master: 'roman' },
  { id: 'mariya', name: { ru: 'Мария', en: 'Maria' }, surname: { ru: 'Ефименко', en: 'Yefimenko' }, role: { ru: 'Дерматолог', en: 'Dermatologist' }, photo: { src: '/photos/team/mariya.webp', w: 480, h: 480, published: true } },
  { id: 'darya', name: { ru: 'Дарья', en: 'Daria' }, role: { ru: 'Администратор', en: 'Receptionist' }, short: { ru: 'Админ', en: 'Front desk' }, surname: { ru: 'Домнич', en: 'Domnich' }, photo: { src: '/photos/team/darya.webp', w: 480, h: 480, published: true } },
];
