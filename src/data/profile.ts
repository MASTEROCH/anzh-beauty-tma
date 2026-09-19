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
  { label: 'Контурная', photo: '/photos/lip-filler.jpg' },
  { label: 'Биоревит.', photo: '/photos/biorevit.jpg' },
  { label: 'Чистка', photo: '/photos/deep-cleansing.jpg' },
  { label: 'Мезо', photo: '/photos/pdrn.jpg' },
  { label: 'Пилинг', photo: '/photos/almagold-peel.jpg' },
  { label: 'Уход', photo: '/photos/led-therapy.jpg' },
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
