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
    author: 'Maria · постоянный клиент',
  },
  {
    stars: 5,
    text: '«Делала курс мезотерапии — результат держится 4 месяца. Сервис на уровне швейцарской клиники.»',
    author: 'Tata · 2026-04',
  },
  {
    stars: 5,
    text: '«Очень люблю атмосферу: спокойно, чисто, по-человечески. Записываюсь только сюда уже 2 года.»',
    author: 'Lena · VIP',
  },
];
