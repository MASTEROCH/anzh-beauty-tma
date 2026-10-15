/* Здесь были stats (стаж, число процедур, рейтинг) и trust с числом
   постоянных клиентов — цифры-заготовки прототипа, не подтверждённые
   Анжеликой (ЗАПРОС-ДАННЫХ.md: «данные внутри — заготовки»). Решение
   владельца: выдуманное убирать из ДАННЫХ, а не только с экранов, — иначе
   следующий экран снова его покажет. Регалии живут в i18n (trust.*). */

/**
 * ONE switch for the profile texts written from her voice notes (T2 ed. 2, §2) — they go to
 * the showcase only after Anjelika's "yes"; until then John decides with the owner (K8).
 *
 * true  — shown: the line under the name (`profile.bio`), the regalia badges (`trust.*`),
 *         the stories and the "about" line on the profile, the "About the doctor" card, the
 *         regalia list in the master sheet on a service card.
 * false — all of these are HIDDEN. The prototype texts do not come back: they named brands
 *         and an administrator nobody confirmed.
 */
export const PROFILE_TEXTS_SHOWN = true;

export const profile = {
  name: 'Anjelika',
  role: 'Cosmetologist · Батуми',
  bio: 'Медицинское образование, косметолог. Студия в Батуми: инъекционные и аппаратные процедуры, обучение.',
} as const;

/* О ВРАЧЕ — блок на профиле.
 *
 * Отдельно от `profile.bio`: там одна строка про студию, здесь человек.
 * Клиентка выбирает косметолога не по списку процедур, а по тому, чьим
 * рукам доверить лицо, — и решает это по словам, а не по регалиям.
 *
 * Texts — T2 ed. 2 §2.1 (Katya, from her voice notes; regalia in the lawyer's wording
 * "before documents"). On the showcase only after her "yes": PROFILE_TEXTS_SHOWN above.
 */
export const about = {
  /* 🚨 Именно её портрет, тот же человек, что в шапке профиля.
     Сначала стоял portrait-2.jpg — это лицо клиентки из стока, и блок
     «о враче» показывал постороннюю женщину. В разделе про человека
     чужое лицо — не мелочь: оно обнуляет весь текст под ним. */
  photo: '/photos/anjelika.webp',

  /* Кредо — ОДНА фраза, и короткая: в коде выводится в ёлочках, то есть
     как её слова. */
  credo: {
    ru: 'Подбираю действительно нужные процедуры',
    en: 'I choose the treatments that are really needed',
  },

  body: {
    ru: [
      'Я принципиально не беру всех подряд на процедуры и не всегда иду за тем, с чем человек пришёл. Прежде всего я врач: сама смотрю состояние кожи, понимаю, как работают процедуры и каков механизм их действия, и по опыту могу увидеть наперёд, как состояние кожи будет развиваться дальше. На этом строю выбор — только действительно нужные процедуры.',
      'Я окончила Харьковский национальный медицинский университет в 2020 году. Косметологией заинтересовалась на 4 курсе, когда попала на кафедру дерматовенерологии: там впервые познакомилась с кожей, лицом и профессией дерматокосметолога. Это была самая тяжёлая кафедра за все шесть лет — я её ненавидела, но это один из предметов, которые я знала лучше всего. На 5 курсе выбрала курс дерматокосметологии, а в 2018 году пошла в школу косметологов.',
      'Учусь постоянно: у меня больше 50 сертификатов с конгрессов и мировых семинаров из разных уголков планеты. Хожу и на кадавер-курсы, где работают на биоматериалах. Главная задача — как можно больше учиться и идти в ногу со временем.',
      'В 2020 году я переехала в Батуми. Четыре месяца проработала в салоне, потом подруга, мастер по перманенту, позвала меня к себе: мы вдвоём сняли кабинет и квартиру и сделали из этого студию. Денег не было — было только желание. Потом был целый этаж в салоне красоты, первое собственное помещение — «мини-сарай», где мы сами красили стены, — и студия побольше. Через полтора года мы разделились, чтобы развивать каждая своё. Сейчас у меня собственное помещение, и мастера работают вместе со мной.',
    ],
    en: [
      'As a matter of principle, I don’t take everyone for treatments, and I don’t always go along with what a person comes in asking for. First of all I am a doctor: I look at the condition of the skin myself, I understand how treatments work and what their mechanism of action is, and from experience I can see in advance how the skin will develop. That is how I choose — only the treatments that are really needed.',
      'I graduated from Kharkiv National Medical University in 2020. I became interested in cosmetology in my 4th year, when I got to the department of dermatovenereology: that is where I first met skin, the face, and the profession of a dermatocosmetologist. It was the hardest department of all six years — I hated it, but it is one of the subjects I knew best. In my 5th year I chose a dermatocosmetology elective, and in 2018 I went to a cosmetology school.',
      'I keep learning: I have more than 50 certificates from congresses and international seminars around the world. I also attend cadaver courses, where we work on biomaterials. My main goal is to learn as much as possible and keep up with the times.',
      'In 2020 I moved to Batumi. I worked in a salon for four months, then a friend, a permanent-makeup artist, invited me to join her: together we rented a room and an apartment and turned them into a studio. We had no money — only the will. Then came a whole floor in a beauty salon, our first own space — a “mini shed” whose walls we painted ourselves — and a bigger studio. After a year and a half we split to develop our own directions. Now I have my own space, and the masters work alongside me.',
    ],
  },

  /* Факты отвечают на невысказанные вопросы. Последний — про то, чего
     она НЕ делает: отказ от работы вызывает больше доверия, чем
     перечисление регалий. */
  facts: [
    { ru: 'Практика',    en: 'Practice',      v: { ru: 'Батуми, собственная студия', en: 'Batumi, own studio' } },
    { ru: 'Образование', en: 'Education',     v: { ru: 'ХНМУ (Харьков), медицинское образование, 2020', en: 'Kharkiv National Medical University, medical degree, 2020' } },
    { ru: 'Косметология', en: 'Cosmetology',  v: { ru: 'Школа косметологов, 2018; дерматокосметология — курс по выбору в университете', en: 'Cosmetology school, 2018; dermatocosmetology elective at university' } },
    { ru: 'Учится',      en: 'Keeps learning', v: { ru: 'Больше 50 сертификатов, кадавер-курсы', en: '50+ certificates, cadaver courses' } },
    { ru: 'Ведёт',       en: 'Focus',         v: { ru: 'инъекционные и аппаратные процедуры, обучение специалистов', en: 'injectables, device treatments, training for practitioners' } },
    { ru: 'Не делает',   en: 'Will not do',   v: { ru: 'ботулинотерапию жевательных мышц для похудения лица (только по показаниям — при бруксизме)', en: 'botulinum therapy of the masseter muscles to slim the face (only when indicated — for bruxism)' } },
  ],
} as const;

/** Кадры для сторис-карусели «О нас» на профиле — T2 ed. 2 §2.2. Her own portrait on all
    four: the prototype frames carried stock faces of strangers and a lip photo. */
export const story: Array<{ photo: string; title: string; text: string; titleEn: string; textEn: string }> = [
  {
    photo: '/photos/anjelika.webp',
    title: 'Кафедра, которую ненавидела',
    text: 'С дерматовенерологии на 4 курсе начался мой путь в косметологии. Самая тяжёлая кафедра за все шесть лет — и один из предметов, которые я знала лучше всего.',
    titleEn: 'The department I hated',
    textEn: 'My path into cosmetology began with dermatovenereology in my 4th year. The hardest department of all six years — and one of the subjects I knew best.',
  },
  {
    photo: '/photos/anjelika.webp',
    title: 'Не было денег — было желание',
    text: 'Я переехала в Батуми в 2020 году, ушла из салона и вместе с подругой сняла первый кабинет. Теперь у меня собственное помещение, и мастера работают вместе со мной.',
    titleEn: 'No money, just the will',
    textEn: 'I moved to Batumi in 2020, left the salon and rented a first room with a friend. Now I have my own space, and the masters work alongside me.',
  },
  {
    photo: '/photos/anjelika.webp',
    title: 'Учусь постоянно',
    text: 'Больше 50 сертификатов с конгрессов и мировых семинаров, кадавер-курсы. Главная задача — как можно больше учиться.',
    titleEn: 'Always learning',
    textEn: '50+ certificates from congresses and international seminars, plus cadaver courses. My main goal is to learn as much as possible.',
  },
  {
    photo: '/photos/anjelika.webp',
    title: 'Не всех подряд',
    text: 'Я принципиально не беру всех подряд. Сначала смотрю состояние кожи, а потом решаю, какие процедуры действительно нужны.',
    titleEn: 'I don’t take everyone',
    textEn: 'As a matter of principle, I don’t take everyone. First I look at the condition of the skin, then I decide which treatments are really needed.',
  },
];

/* Отзывы — только настоящие, с согласия автора. Прежние три были выдуманы
   (ЗАПРОС-ДАННЫХ.md §7) и стёрты; пустой список прячет блок отзывов на
   профиле целиком. Настоящие придут с сервера или от Анжелики. */
export interface Review {
  stars: number;
  text: string;
  author: string;
  role: { ru: string; en: string };
}

export const reviews: Review[] = [];
