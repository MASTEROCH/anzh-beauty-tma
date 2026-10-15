import type { IconName } from '../components/Icon';
import type { Service } from './services';
import type { MasterId } from './works';

// УСЛУГИ КОМАНДЫ «ПО ЗАПРОСУ» — то, что студия делает, но чему ещё не
// назначена цена.
//
// Почему не обычной строкой витрины: запись по времени сервер без цены не
// принимает (422 incomplete_service, lib/showable.ts), а выдумывать цену
// нельзя (лог ROCH #1011: пустая цена честнее выдуманной). Прятать тоже
// неверно — клиентка не узнаёт, что в студии есть бровист и лазер (Роч
// 15.10: «не хватает услуг других членов команды»).
//
// Поэтому такая услуга видна в каталоге со своим фото, мастером и
// направлением, а вместо цены и кнопки «выбрать время» — «Цена у
// администратора»: тап открывает чат с готовым вопросом. Как только
// владелица назначит цену и время в кабинете (Студия → Процедуры), строка
// с тем же slug придёт с сервера обычной процедурой и ЭТА карточка
// исчезнет сама (дедупликация по id в каталоге).
//
// id совпадают со slug серверного каталога и работ портфолио (works.ts),
// поэтому фото подтягиваются из работ мастера.

export interface OnRequestService {
  id: string;
  category: Service['category'];
  master: MasterId | 'mariya';
  masterName: { ru: string; en: string };
  icon: IconName;
  title: string;
  titleEn: string;
  short: string;
  shortEn: string;
}

const EKATERINA = { ru: 'Екатерина · бровист', en: 'Ekaterina · brow artist' };
const ROMAN = { ru: 'Роман · лазер', en: 'Roman · laser' };
const ANZHELIKA = { ru: 'Анжелика · врач-косметолог', en: 'Anjelika · cosmetologist' };
const MARIYA = { ru: 'Мария · врач-дерматолог', en: 'Mariya · dermatologist' };

export const ON_REQUEST: readonly OnRequestService[] = [
  { id: 'brow-lamination', category: 'brows', master: 'ekaterina', masterName: EKATERINA, icon: 'lash',
    title: 'Ламинирование бровей', titleEn: 'Brow lamination',
    short: 'Укладка волосков и фиксация формы', shortEn: 'Hair setting and shape fixation' },
  { id: 'brow-shape-tint', category: 'brows', master: 'ekaterina', masterName: EKATERINA, icon: 'lash',
    title: 'Коррекция и окрашивание бровей', titleEn: 'Brow shaping and tinting',
    short: 'Форма под черты лица, краска или хна', shortEn: 'Shape for your face, dye or henna' },
  { id: 'brow-lightening', category: 'brows', master: 'ekaterina', masterName: EKATERINA, icon: 'lash',
    title: 'Осветление бровей', titleEn: 'Brow lightening',
    short: 'Тон бровей мягче и светлее', shortEn: 'A softer, lighter brow tone' },
  { id: 'brow-pmu', category: 'brows', master: 'ekaterina', masterName: EKATERINA, icon: 'lash',
    title: 'Перманентный макияж бровей', titleEn: 'Permanent brow makeup',
    short: 'С контрольным визитом на коррекцию', shortEn: 'With a follow-up touch-up visit' },
  { id: 'tattoo-removal', category: 'apparatus', master: 'roman', masterName: ROMAN, icon: 'bolt',
    title: 'Лазерное удаление татуировок', titleEn: 'Laser tattoo removal',
    short: 'Число сеансов — после осмотра', shortEn: 'Number of sessions after an exam' },
  { id: 'pmu-removal', category: 'apparatus', master: 'roman', masterName: ROMAN, icon: 'bolt',
    title: 'Удаление перманентного макияжа', titleEn: 'Permanent makeup removal',
    short: 'Брови, веки, губы — лазером', shortEn: 'Brows, eyelids, lips — by laser' },
  { id: 'pigment-removal', category: 'apparatus', master: 'roman', masterName: ROMAN, icon: 'bolt',
    title: 'Лазерное удаление пигмента', titleEn: 'Laser pigment removal',
    short: 'Число сеансов — после осмотра', shortEn: 'Number of sessions after an exam' },
  { id: 'carbon-peel', category: 'peel', master: 'roman', masterName: ROMAN, icon: 'bolt',
    title: 'Карбоновый пилинг', titleEn: 'Carbon peel',
    short: 'Лазер: поры, тон и текстура кожи', shortEn: 'Laser: pores, tone and texture' },
  { id: 'peeling', category: 'peel', master: 'mariya', masterName: MARIYA, icon: 'leaf',
    title: 'Пилинги', titleEn: 'Peels',
    short: 'Подбор под тип кожи и задачу', shortEn: 'Matched to your skin and goal' },
  { id: 'lipolytics', category: 'inj', master: 'anzhelika', masterName: ANZHELIKA, icon: 'syringe',
    title: 'Липолитики — лицо и тело', titleEn: 'Lipolytics — face and body',
    short: 'Локальные жировые отложения', shortEn: 'Local fat deposits' },
];

/** Сообщение администратору — готовый вопрос, чтобы не печатать */
export const askAbout = (s: OnRequestService, lang: 'ru' | 'en') =>
  lang === 'ru'
    ? `Здравствуйте! Хочу записаться: «${s.title}». Подскажите, пожалуйста, цену и свободное время.`
    : `Hello! I'd like to book “${s.titleEn}”. Could you tell me the price and available times?`;
