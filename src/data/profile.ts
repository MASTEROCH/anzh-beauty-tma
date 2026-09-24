import { asset } from '../lib/asset';

export const profile = {
  name: 'Anjelika',
  role: 'Cosmetologist · Батуми',
  bio: 'Авторская эстетическая медицина в формате частного кабинета. Контурная пластика, биоревитализация, аппаратные процедуры — индивидуальный протокол под кожу и стиль жизни.',
  stats: {
    years: 8,
    procedures: 1472,
    rating: 4.9,
  },
  trust: [
    '✓ Сертифицированный косметолог',
    '✓ MD-Codes · Restylane Academy',
    '✓ 312 постоянных клиентов',
    '✓ Лидокаин-фри протоколы',
  ],
} as const;

/* О ВРАЧЕ — блок на профиле.
 *
 * Отдельно от `profile.bio`: там одна строка про кабинет, здесь человек.
 * Клиентка выбирает косметолога не по списку процедур, а по тому, чьим
 * рукам доверить лицо, — и решает это по словам, а не по регалиям.
 *
 * ⚠️ Тексты написаны в её интонации по голосовым и карточкам сторис, но
 * это ЗАГОТОВКА: подтвердить у Анжелики и заменить её формулировками.
 * См. ЗАПРОС-ДАННЫХ.md, раздел 2. Регалии из `profile.trust` — тоже.
 */
export const about = {
  /* 🚨 Именно её портрет, тот же человек, что в шапке профиля.
     Сначала стоял portrait-2.jpg — это лицо клиентки из стока, и блок
     «о враче» показывал постороннюю женщину. В разделе про человека
     чужое лицо — не мелочь: оно обнуляет весь текст под ним. */
  photo: '/photos/anjelika.jpg',

  /* Кредо — ОДНА фраза, и короткая. Первая версия была на три строки
     («Лицо должно остаться твоим. Заметят, что стало лучше, но не
     поймут, что именно ты сделала») — это уже не кредо, а абзац:
     заголовок такой длины не запоминается и не цитируется. Мысль про
     «заметят, но не поймут» осталась, но ушла в текст, где ей и место. */
  credo: {
    ru: 'Лицо должно остаться твоим',
    en: 'Your face should stay yours',
  },

  body: {
    ru: [
      'Восемь лет я веду частный кабинет и ни разу не работала на потоке. Один человек в приёме — значит, есть время посмотреть кожу, спросить про сон, лекарства и планы на лето, а не только про то, что не нравится в зеркале.',
      'Учу мере. По MD-Codes и протоколам Restylane Academy можно добавить много — я добавляю ровно столько, сколько держит ваши собственные черты. Хороший результат замечают, но не могут объяснить: выглядит отдохнувшей, а что именно изменилось — непонятно.',
      'Начинаю с диагностики, а не с прайса. Сначала анкета и осмотр, потом план на несколько месяцев вперёд — с порядком, интервалами и тем, что можно не делать. Если процедура сейчас не нужна, я скажу это прямо и не запишу вас.',
      'Веду клиенток годами и вижу кожу в динамике. Поэтому в приложении живёт вся история: что делали, когда, чем и как отреагировала кожа — это не архив ради архива, а то, из чего собирается следующий шаг.',
    ],
    en: [
      'For eight years I have run a private practice and never worked on a conveyor. One person per appointment means there is time to look at your skin, ask about sleep, medication and summer plans — not only about what you dislike in the mirror.',
      'I teach restraint. MD-Codes and Restylane Academy protocols allow a lot; I add exactly as much as keeps your own features. A good result gets noticed but cannot be explained: you look rested, and no one can tell what changed.',
      'I start with a diagnosis, not a price list. Questionnaire and examination first, then a plan for the months ahead — order, intervals, and what you can skip. If you do not need a treatment right now, I will say so and will not book you.',
      'I follow clients for years and see skin over time. That is why the whole history lives in the app: what was done, when, with what, and how the skin responded — not an archive for its own sake, but the material the next step is built from.',
    ],
  },

  /* Факты отвечают на невысказанные вопросы. Последний — про то, чего
     она НЕ делает: отказ от работы вызывает больше доверия, чем
     перечисление регалий. */
  facts: [
    { ru: 'Практика',  en: 'Practice',   v: { ru: '8 лет · Батуми, частный кабинет', en: '8 years · Batumi, private practice' } },
    { ru: 'Училась',   en: 'Trained',    v: { ru: 'MD-Codes · Restylane Academy', en: 'MD-Codes · Restylane Academy' } },
    { ru: 'Работает',  en: 'Works with', v: { ru: 'Restylane, Profhilo, INDIBA', en: 'Restylane, Profhilo, INDIBA' } },
    { ru: 'Ведёт',     en: 'Focus',      v: { ru: 'инъекции, пилинги, аппаратные протоколы', en: 'injectables, peels, device protocols' } },
    { ru: 'Языки',     en: 'Languages',  v: { ru: 'русский, английский', en: 'Russian, English' } },
    { ru: 'Не делает', en: 'Will not do', v: { ru: 'объём ради объёма и «как у неё»', en: 'volume for volume’s sake' } },
  ],
} as const;

/** Кадры для сторис-карусели «О нас» на профиле */
export const story: Array<{ photo: string; title: string; text: string; titleEn: string; textEn: string }> = [
  {
    photo: '/photos/anjelika.jpg',
    title: 'Частный кабинет, а не конвейер',
    text: 'Один мастер, один клиент, без очереди в коридоре. Времени столько, сколько нужно именно твоей коже.',
    titleEn: 'A private room, not a conveyor',
    textEn: 'One practitioner, one client, no queue in the hallway. As much time as your skin actually needs.',
  },
  {
    photo: '/photos/portrait-1.jpg',
    title: 'Протокол под кожу, не под прайс',
    text: 'Сначала диагностика и анкета, потом план. Если процедура тебе сейчас не нужна — так и скажу.',
    titleEn: 'A protocol for your skin, not for the price list',
    textEn: 'Diagnosis and questionnaire first, plan second. If you don’t need a treatment right now, I’ll say so.',
  },
  {
    photo: '/photos/lip-filler.jpg',
    title: 'Мера важнее объёма',
    text: 'Работаю по MD-Codes: черты остаются твоими. «Заметно, что что-то изменилось» — но непонятно что.',
    titleEn: 'Restraint over volume',
    textEn: 'I work by MD-Codes: your features stay yours. People notice something changed — but can’t tell what.',
  },
  {
    photo: '/photos/portrait-2.jpg',
    title: 'Оригинальные препараты',
    text: 'Restylane, IAL-System, PDRN из Кореи. Каждую партию показываю до вскрытия — можно снять на видео.',
    titleEn: 'Original products only',
    textEn: 'Restylane, IAL-System, Korean PDRN. I show every batch sealed before opening — film it if you like.',
  },
  {
    photo: '/photos/portrait-3.jpg',
    title: 'После процедуры не исчезаю',
    text: 'Пишу через сутки, через три дня и через неделю. Что-то пошло не так — отвечаю в тот же день.',
    titleEn: 'I don’t vanish after the treatment',
    textEn: 'I check in after a day, three days and a week. If something feels off — I answer the same day.'
  },
];

export const gallery: Array<{ label: string; photo: string }> = [
  { label: 'Контурная', photo: asset('photos/lip-filler.jpg') },
  { label: 'Биоревит.', photo: asset('photos/biorevit.jpg') },
  { label: 'Чистка', photo: asset('photos/deep-cleansing.jpg') },
  { label: 'Мезо', photo: asset('photos/pdrn.jpg') },
  { label: 'Пилинг', photo: asset('photos/almagold-peel.jpg') },
  { label: 'Уход', photo: asset('photos/led-therapy.jpg') },
];

export const reviews = [
  {
    stars: 5,
    text: '«Идеальное чувство меры — губы выглядят моими, только лучше. Анжелика объясняет каждый шаг, без давления.»',
    author: 'Maria', role: { ru: 'постоянный клиент', en: 'regular client' },
  },
  {
    stars: 5,
    text: '«Делала курс мезотерапии — результат держится 4 месяца. Сервис на уровне швейцарской клиники.»',
    author: 'Tata', role: { ru: '2026-04', en: '2026-04' },
  },
  {
    stars: 5,
    text: '«Очень люблю атмосферу: спокойно, чисто, по-человечески. Записываюсь только сюда уже 2 года.»',
    author: 'Lena', role: { ru: 'VIP', en: 'VIP' },
  },
];
