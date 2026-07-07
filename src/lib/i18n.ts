import { useEffect, useState } from 'react';

export type Lang = 'ru' | 'en';

/* ── Global language store — any component re-renders on switch ── */
const KEY = 'anzh_lang';
let current: Lang =
  (typeof window !== 'undefined' && (localStorage.getItem(KEY) as Lang)) || 'ru';
const listeners = new Set<(l: Lang) => void>();

export function getLang(): Lang {
  return current;
}
export function setLang(l: Lang) {
  current = l;
  try { localStorage.setItem(KEY, l); } catch { /* ignore */ }
  if (typeof document !== 'undefined') document.documentElement.lang = l;
  listeners.forEach((fn) => fn(l));
}
export function useLang(): Lang {
  const [l, setL] = useState<Lang>(current);
  useEffect(() => {
    listeners.add(setL);
    return () => { listeners.delete(setL); };
  }, []);
  return l;
}

/* ── Dictionary ── */
type Entry = { ru: string; en: string };
const DICT: Record<string, Entry> = {
  // nav
  'nav.profile':  { ru: 'Профиль', en: 'Profile' },
  'nav.catalog':  { ru: 'Каталог', en: 'Catalog' },
  'nav.booking':  { ru: 'Запись',  en: 'Booking' },
  'nav.account':  { ru: 'Кабинет', en: 'Account' },
  'nav.anzh':     { ru: 'ANZH',    en: 'ANZH' },
  // common
  'common.book':        { ru: 'Записаться', en: 'Book now' },
  'common.catalog':     { ru: 'Каталог', en: 'Catalog' },
  'common.close':       { ru: 'Закрыть', en: 'Close' },
  'common.all':         { ru: 'все', en: 'all' },
  'common.min':         { ru: 'мин', en: 'min' },
  'common.master':      { ru: 'мастер', en: 'expert' },
  'common.settings':    { ru: 'Настройки', en: 'Settings' },
  'common.map':         { ru: 'Маршрут в Maps', en: 'Directions in Maps' },
  'common.save':        { ru: 'Сохранить', en: 'Save' },
  // profile
  'profile.role':       { ru: 'Косметолог · Батуми', en: 'Cosmetologist · Batumi' },
  'profile.bio':        {
    ru: 'Авторская эстетическая медицина в формате частного кабинета. Контурная пластика, биоревитализация, аппаратные процедуры — индивидуальный протокол под кожу и стиль жизни.',
    en: 'Signature aesthetic medicine in a private practice. Lip contouring, biorevitalization and apparatus treatments — a protocol tailored to your skin and lifestyle.',
  },
  'profile.stat.years':      { ru: 'лет практики', en: 'years practising' },
  'profile.stat.procedures': { ru: 'процедур', en: 'procedures' },
  'profile.stat.rating':     { ru: 'рейтинг', en: 'rating' },
  'profile.gallery.eyebrow': { ru: 'Галерея до/после', en: 'Before / after gallery' },
  'profile.gallery.title':   { ru: 'Работы Анжелики', en: "Anjelika's work" },
  'profile.reviews.eyebrow': { ru: 'Отзывы', en: 'Reviews' },
  'profile.reviews.title':   { ru: 'Говорят клиенты', en: 'What clients say' },
  'profile.addr.eyebrow':    { ru: 'Адрес', en: 'Location' },
  'profile.addr.title':      { ru: 'Где найти', en: 'Find us' },
  'profile.publicNote':      { ru: 'Это публичный профиль Анжелики', en: "This is Anjelika's public profile" },
  // gallery tags
  'gal.contour':  { ru: 'Контурная', en: 'Lips' },
  'gal.biorevit': { ru: 'Биоревит.', en: 'Biorevit.' },
  'gal.cleaning': { ru: 'Чистка', en: 'Cleansing' },
  'gal.meso':     { ru: 'Мезо', en: 'Meso' },
  'gal.peel':     { ru: 'Пилинг', en: 'Peel' },
  'gal.care':     { ru: 'Уход', en: 'Care' },
  // trust
  'trust.certified':   { ru: '✓ Сертифицированный косметолог', en: '✓ Certified cosmetologist' },
  'trust.mdcodes':     { ru: '✓ MD-Codes · Restylane Academy', en: '✓ MD-Codes · Restylane Academy' },
  'trust.clients':     { ru: '✓ 312 постоянных клиентов', en: '✓ 312 loyal clients' },
  'trust.lidocaine':   { ru: '✓ Лидокаин-фри протоколы', en: '✓ Lidocaine-free protocols' },
  // catalog
  'catalog.eyebrow':   { ru: 'каталог', en: 'catalog' },
  'catalog.title':     { ru: 'Услуги Анжелики', en: "Anjelika's services" },
  'catalog.search':    { ru: 'Поиск процедуры…', en: 'Search treatments…' },
  'catalog.hintFav':   { ru: 'добавляй в избранное значком сердца', en: 'tap the heart to save favourites' },
  'catalog.favCount':  { ru: 'избранное', en: 'favourites' },
  'catalog.emptyTitle':{ ru: 'Ничего не нашли — попробуйте другой запрос или категорию.', en: 'Nothing found — try another query or category.' },
  'catalog.reset':     { ru: 'Сбросить фильтр', en: 'Reset filter' },
  'catalog.procedures.one':  { ru: 'процедура', en: 'treatment' },
  'catalog.procedures.many': { ru: 'процедур', en: 'treatments' },
  // categories
  'cat.all':       { ru: 'Все', en: 'All' },
  'cat.inj':       { ru: 'Инъекции', en: 'Injectables' },
  'cat.clean':     { ru: 'Чистки', en: 'Cleansing' },
  'cat.peel':      { ru: 'Пилинги', en: 'Peels' },
  'cat.apparatus': { ru: 'Аппарат', en: 'Apparatus' },
  'cat.care':      { ru: 'Уход', en: 'Care' },
  // service detail
  'service.details':   { ru: 'Подробнее', en: 'Details' },
  'service.includes':  { ru: 'Что входит', en: "What's included" },
  'service.contra':    { ru: 'Противопоказания', en: 'Contraindications' },
  'service.result':    { ru: 'Результат до / после', en: 'Before / after result' },
  'service.tapZoom':   { ru: 'Тап чтобы увеличить · фото с согласия клиента', en: 'Tap to enlarge · shared with client consent' },
  'service.cabinet':   { ru: 'Кабинет', en: 'The practice' },
  'service.pickTime':  { ru: 'Выбрать время', en: 'Pick a time' },
  // booking
  'booking.eyebrow':   { ru: 'запись', en: 'booking' },
  'booking.title':     { ru: 'Выбор времени', en: 'Choose a time' },
  'booking.step.service': { ru: 'Услуга', en: 'Service' },
  'booking.step.date':    { ru: 'Дата / слот', en: 'Date / slot' },
  'booking.step.confirm': { ru: 'Подтверждение', en: 'Confirm' },
  'booking.chosen':    { ru: 'выбранная услуга', en: 'chosen service' },
  'booking.pickDay':   { ru: 'выбери день', en: 'pick a day' },
  'booking.freeTime':  { ru: 'свободное время', en: 'available time' },
  'booking.details':   { ru: 'детали записи', en: 'booking details' },
  'booking.sum.service':  { ru: 'Процедура', en: 'Treatment' },
  'booking.sum.duration': { ru: 'Длительность', en: 'Duration' },
  'booking.sum.date':     { ru: 'Дата', en: 'Date' },
  'booking.sum.time':     { ru: 'Время', en: 'Time' },
  'booking.sum.address':  { ru: 'Адрес', en: 'Address' },
  'booking.sum.total':    { ru: 'К оплате', en: 'Total' },
  'booking.slotsNote':    { ru: 'Серые слоты — заняты, можно тапнуть и я подскажу ближайший свободный.', en: 'Greyed slots are taken — tap one and I’ll suggest the nearest free time.' },
  'booking.confirm':      { ru: 'Подтвердить запись', en: 'Confirm booking' },
  // account
  'account.hello':     { ru: 'Привет', en: 'Hi' },
  'account.next':      { ru: 'Ближайшая запись', en: 'Next appointment' },
  'account.history':   { ru: 'История', en: 'History' },
  'account.historyTitle': { ru: 'Что было', en: 'Past visits' },
  'account.passport':  { ru: 'Паспорт здоровья', en: 'Health passport' },
  'account.form':      { ru: 'Анкета', en: 'Questionnaire' },
  'settings.lang':     { ru: 'язык', en: 'language' },
  'settings.currency': { ru: 'валюта', en: 'currency' },
  'settings.notif':    { ru: 'уведомления', en: 'notifications' },
  'settings.title':    { ru: 'Настройки', en: 'Settings' },
  'settings.on':       { ru: 'вкл', en: 'on' },
  'settings.notif.24h':  { ru: 'Напоминание за 24 часа', en: 'Reminder 24h before' },
  'settings.notif.2h':   { ru: 'Напоминание за 2 часа', en: 'Reminder 2h before' },
  'settings.notif.post': { ru: 'Post-care после процедуры', en: 'Post-care follow-up' },
  'settings.notif.promo':{ ru: 'Акции и подарки', en: 'Offers & gifts' },
  'settings.appearance': { ru: 'оформление', en: 'appearance' },
  'settings.about':      { ru: 'ANZH Cosmetology · Батуми', en: 'ANZH Cosmetology · Batumi' },
  'settings.version':    { ru: 'Версия 1.0 · Beauty TMA', en: 'Version 1.0 · Beauty TMA' },
  // account
  'account.title':     { ru: 'Кабинет', en: 'Account' },
  'account.clientSince': { ru: 'Клиент с', en: 'Client since' },
  'account.procs':     { ru: 'процедур', en: 'treatments' },
  'account.rebook':    { ru: 'Записаться снова', en: 'Book again' },
  'account.details':   { ru: 'Детали', en: 'Details' },
  'account.allN':      { ru: 'все', en: 'all' },
  'account.tierNext':  { ru: 'До Gold-тира ещё', en: 'To Gold tier' },
  'account.points':    { ru: 'баллов', en: 'points' },
};

export function t(key: string, lang: Lang = current): string {
  const e = DICT[key];
  if (!e) return key;
  return e[lang];
}
