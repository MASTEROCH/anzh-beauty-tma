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
  role: 'Врач-косметолог · Батуми',
  bio: 'Высшее медицинское образование, врач-косметолог. Студия в Батуми: инъекционные и аппаратные процедуры, обучение.',
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
  /* 🚨 Её портрет — и ДРУГОЙ кадр, не тот, что в обложке экрана.
     Сначала здесь стоял portrait-2.jpg: лицо клиентки из стока, то есть
     блок «о враче» показывал постороннюю женщину. Потом — тот же снимок,
     что в обложке, и страница трижды показывала одно лицо.
     Этот кадр — из студии: она в халате у круглого зеркала, лицо в
     отражении. Другой кадр, другой смысл и ПОРТРЕТНАЯ пропорция: сюда
     стоял квадрат 480 px из кружка команды, растянутый на широкую рамку
     шторки — лицо обрезалось снизу и мылилось. */
  photo: '/photos/works/master-anzhelika/about-v1.webp',

  /* Кредо — ОДНА фраза, и короткая: в коде выводится в ёлочках, то есть
     как её слова. */
  credo: {
    ru: 'Подбираю действительно нужные процедуры',
    en: 'I choose the treatments that are really needed',
  },

  body: {
    ru: [
      'Я принципиально не беру всех подряд на процедуры и не всегда иду за тем, с чем человек пришёл. Прежде всего я врач: сама смотрю состояние кожи, понимаю, как работают процедуры и каков механизм их действия, и по опыту могу увидеть наперёд, как состояние кожи будет развиваться дальше. На этом строю выбор — только действительно нужные процедуры.',
      'Я окончила Харьковский национальный медицинский университет в 2020 году. Косметологией заинтересовалась на 4 курсе, когда попала на кафедру дерматовенерологии: там впервые познакомилась с кожей, лицом и профессией дерматокосметолога. Это была самая требовательная кафедра за все шесть лет, и именно этот предмет я знаю лучше всего. На 5 курсе выбрала курс дерматокосметологии, а в 2018 году пошла в школу косметологов.',
      'Учусь постоянно: у меня больше 50 сертификатов с конгрессов и мировых семинаров из разных уголков планеты. Хожу и на кадавер-курсы, где работают на биоматериалах. Главная задача — как можно больше учиться и идти в ногу со временем.',
      'В 2020 году я переехала в Батуми. Четыре месяца проработала в салоне, потом подруга, мастер по перманенту, позвала меня к себе: мы вдвоём сняли кабинет и квартиру и сделали из этого студию. Денег не было — было только желание. Потом был целый этаж в салоне красоты, первое собственное помещение — «мини-сарай», где мы сами красили стены, — и студия побольше. Через полтора года мы разделились, чтобы развивать каждая своё. Сейчас у меня собственное помещение, и мастера работают вместе со мной.',
    ],
    en: [
      'As a matter of principle, I don’t take everyone for treatments, and I don’t always go along with what a person comes in asking for. First of all I am a doctor: I look at the condition of the skin myself, I understand how treatments work and what their mechanism of action is, and from experience I can see in advance how the skin will develop. That is how I choose — only the treatments that are really needed.',
      'I graduated from Kharkiv National Medical University in 2020. I became interested in cosmetology in my 4th year, when I got to the department of dermatovenereology: that is where I first met skin, the face, and the profession of a dermatocosmetologist. It was the most demanding department of all six years, and it is the subject I know best. In my 5th year I chose a dermatocosmetology elective, and in 2018 I went to a cosmetology school.',
      'I keep learning: I have more than 50 certificates from congresses and international seminars around the world. I also attend cadaver courses, where we work on biomaterials. My main goal is to learn as much as possible and keep up with the times.',
      'In 2020 I moved to Batumi. I worked in a salon for four months, then a friend, a permanent-makeup artist, invited me to join her: together we rented a room and an apartment and turned them into a studio. We had no money — only the will. Then came a whole floor in a beauty salon, our first own space — a “mini shed” whose walls we painted ourselves — and a bigger studio. After a year and a half we split to develop our own directions. Now I have my own space, and the masters work alongside me.',
    ],
  },

  /* Факты отвечают на невысказанные вопросы. Последний — про то, чего
     она НЕ делает: отказ от работы вызывает больше доверия, чем
     перечисление регалий. */
  facts: [
    { ru: 'Практика',    en: 'Practice',      v: { ru: 'Батуми, собственная студия', en: 'Batumi, own studio' } },
    { ru: 'Образование', en: 'Education',     v: { ru: 'ХНМУ (Харьков), высшее медицинское образование, 2020', en: 'Kharkiv National Medical University, higher medical education (MD), 2020' } },
    { ru: 'Косметология', en: 'Cosmetology',  v: { ru: 'Школа косметологов, 2018; дерматокосметология — курс по выбору в университете', en: 'Cosmetology school, 2018; dermatocosmetology elective at university' } },
    { ru: 'Учится',      en: 'Keeps learning', v: { ru: 'Больше 50 сертификатов, кадавер-курсы', en: '50+ certificates, cadaver courses' } },
    { ru: 'Ведёт',       en: 'Focus',         v: { ru: 'инъекционные и аппаратные процедуры, обучение специалистов', en: 'injectables, device treatments, training for practitioners' } },
    { ru: 'Не делает',   en: 'Will not do',   v: { ru: 'ботулинотерапию жевательных мышц для похудения лица (только по показаниям — при бруксизме)', en: 'botulinum therapy of the masseter muscles to slim the face (only when indicated — for bruxism)' } },
  ],
} as const;

/** Кадры для сторис-карусели «О нас» на профиле — T2 ed. 2 §2.2.
 *
 * 🚨 РАЗНЫЕ КАДРЫ. Один и тот же её портрет стоял на всех четырёх, и он же
 * — в обложке экрана и в карточке «о враче»: лицо повторялось шесть раз на
 * одной странице. Повтор не «узнаваемость», а признак того, что картинку
 * поставили, лишь бы заполнить место.
 * Теперь кадр отвечает тексту: про учёбу — стеллаж с её сертификатами, про
 * первый кабинет — её сегодняшнее помещение, про отбор пациенток — кабинет,
 * где она их и смотрит. Портрет остаётся ровно там, где речь о ней самой. */
export const story: Array<{ photo: string; title: string; text: string; titleEn: string; textEn: string }> = [
  {
    /* Интерьер студии, а не снова её портрет: он уже стоит на обложке и в
       «О враче». Кресла в зоне ожидания — первое, что видит человек у двери. */
    photo: '/photos/studio/7.webp',
    /* 🚨 Тут было «Кафедра, которую ненавидела». Фраза взята из голосового, где
       это была шутка с продолжением («и именно её я знала лучше всего»), но
       на слайде она читается как «ненавидит свою работу» — клиентку это
       отталкивает, а не привлекает (Роч, 15.10.2026). Смысл тот же, стороны
       перевёрнуты: трудно — потому что требовательно, и это сделало врачом. */
    title: 'Всё началось с кожи',
    text: 'На четвёртом курсе я попала на кафедру дерматовенерологии — самую требовательную за все шесть лет учёбы. Там я впервые по-настоящему познакомилась с кожей и профессией, и этот предмет стал тем, что я знаю лучше всего.',
    titleEn: 'It all began with skin',
    textEn: 'In my fourth year I joined the dermatovenereology department — the most demanding of all six years. That is where I truly got to know skin and the profession, and it became the subject I know best.',
  },
  {
    // Помещение, к которому она шла: ресепшен сегодняшней студии
    photo: '/photos/studio/v33.webp',
    title: 'Не было денег — было желание',
    text: 'Я переехала в Батуми в 2020 году, ушла из салона и вместе с подругой сняла первый кабинет. Теперь у меня собственное помещение, и мастера работают вместе со мной.',
    titleEn: 'No money, just the will',
    textEn: 'I moved to Batumi in 2020, left the salon and rented a first room with a friend. Now I have my own space, and the masters work alongside me.',
  },
  {
    // Те самые сертификаты, о которых текст
    photo: '/photos/studio/v37.webp',
    title: 'Учусь постоянно',
    text: 'Больше 50 сертификатов с конгрессов и мировых семинаров, кадавер-курсы. Главная задача — как можно больше учиться.',
    titleEn: 'Always learning',
    textEn: '50+ certificates from congresses and international seminars, plus cadaver courses. My main goal is to learn as much as possible.',
  },
  {
    // Кабинет, где она и смотрит состояние кожи
    photo: '/photos/studio/v35.webp',
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
