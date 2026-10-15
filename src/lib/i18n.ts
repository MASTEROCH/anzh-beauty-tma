import { useEffect, useState } from 'react';

export type Lang = 'ru' | 'en';

/* ── Global language store — any component re-renders on switch ── */
const KEY = 'anzh_lang';

/* Язык по умолчанию берём из клиента Telegram, а не назначаем русский:
   приложение открывают и грузинки, и приезжие. Ручной выбор, если он был,
   всегда сильнее — его и храним в KEY. */
function fromTelegram(): Lang | null {
  if (typeof window === 'undefined') return null;
  const code = (window as unknown as {
    Telegram?: { WebApp?: { initDataUnsafe?: { user?: { language_code?: string } } } };
  }).Telegram?.WebApp?.initDataUnsafe?.user?.language_code;
  if (!code) return null;
  return code.startsWith('ru') ? 'ru' : 'en';
}
/* Хранилище может быть запрещено (приватный режим, политика WebView) —
   тогда getItem бросает, и без try/catch падал бы импорт модуля, а с ним
   всё приложение. Нет хранилища — язык из Telegram. */
function storedLang(): Lang | null {
  if (typeof window === 'undefined') return null;
  try {
    const v = localStorage.getItem(KEY);
    return v === 'ru' || v === 'en' ? v : null;
  } catch {
    return null;
  }
}
let current: Lang = storedLang() || fromTelegram() || 'ru';
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
  /* «О нас», а не «Профиль». Профиль — это личный кабинет человека, а
     вкладка ведёт на страницу студии: кто такая Анжелика, как устроен
     приём, работы, отзывы, адрес. Личное живёт в «Паспорте». */
  'nav.profile':  { ru: 'О нас', en: 'About' },
  'nav.catalog':  { ru: 'Услуги', en: 'Services' },
  'nav.booking':  { ru: 'Запись',  en: 'Booking' },
  'nav.account':  { ru: 'Паспорт', en: 'Passport' },
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
  // profile.bio, trust.* — T2 ed. 2 §2.6, §2.4; shown under PROFILE_TEXTS_SHOWN (data/profile.ts)
  'profile.bio':        {
    ru: 'Медицинское образование, косметолог. Студия в Батуми: инъекционные и аппаратные процедуры, обучение.',
    en: 'Medical degree, cosmetologist. A studio in Batumi: injectable and device treatments, and training.',
  },
  // Work photos block (K11a): heading — decision John 06.10 (true even if part of the work is
  // from the specialists' earlier portfolio); the rest — Katya's K11 texts, checked by the lawyer.
  'profile.gallery.eyebrow': { ru: 'Портфолио', en: 'Portfolio' },
  'profile.gallery.title':   { ru: 'Работы наших мастеров', en: 'Our specialists’ work' },
  'works.laser':        { ru: 'Лазер', en: 'Laser' },
  'works.master':       { ru: 'Мастер {name}', en: 'by {name}' },
  'works.badge.pair':   { ru: 'до / после', en: 'before / after' },
  'works.badge.after':  { ru: 'после', en: 'after' },
  'works.hint.pairTb':  { ru: 'Сверху — до, снизу — после', en: 'Top — before, bottom — after' },
  'works.hint.pairLr':  { ru: 'Слева — до, справа — после', en: 'Left — before, right — after' },
  'works.hint.threeTb': { ru: 'Сверху вниз: до, в процессе, после', en: 'Top to bottom: before, in progress, after' },
  'works.hint.threeLr': { ru: 'Слева направо: до, в процессе, после', en: 'Left to right: before, in progress, after' },
  'works.hint.fourTb':  { ru: 'Сверху вниз: до, осветление, ламинирование, после', en: 'Top to bottom: before, lightening, lamination, after' },
  // RU: the frame itself says «ДО / ПОСЛЕ» — no hint needed
  'works.hint.baked':   { ru: '', en: 'Labels in Russian: ДО — before, ПОСЛЕ — after' },
  'works.hint.after':   { ru: 'После процедуры', en: 'After the treatment' },
  // {by} — 'works.by' with the master's name
  'works.alt.pair':     { ru: '{title}: до и после, {by}', en: '{title}: before and after, {by}' },
  'works.alt.multi':    { ru: '{title}: до, в процессе и после, {by}', en: '{title}: before, in progress and after, {by}' },
  'works.alt.after':    { ru: '{title}: после процедуры, {by}', en: '{title}: after the treatment, {by}' },
  'works.alt.process':  { ru: '{title}: кадр с процедуры, {by}', en: '{title}: a shot from the treatment, {by}' },
  'works.by':           { ru: 'мастер {name}', en: 'by {name}' },
  'works.badge.process': { ru: 'процесс', en: 'treatment' },
  'works.hint.process': { ru: 'Снимок во время или сразу после процедуры', en: 'Taken during or right after the treatment' },
  'works.hint.collage': { ru: 'До и после — на одном снимке', en: 'Before and after in one photo' },
  'works.more':         { ru: 'Показать ещё · {n}', en: 'Show more · {n}' },
  // The lawyer's B1 + «results vary» on EVERY path: the sheet, the service screen, the lightbox
  'works.note':         { ru: 'Фото — с согласия клиентов. Результат у каждого свой.', en: 'Photos shared with client consent. Results vary from person to person.' },
  'works.open':         { ru: 'Открыть фото', en: 'Open the photo' },
  'works.book':         { ru: 'Записаться на эту процедуру', en: 'Book this treatment' },
  'works.details':      { ru: 'Подробно о процедуре', en: 'Full details' },
  'works.write':        { ru: 'Написать в студию', en: 'Message the studio' },
  'works.message':      { ru: 'Здравствуйте! Хочу записаться на «{title}»{with}', en: 'Hi! I’d like to book “{title}”{with}' },
  'works.with':         { ru: ' (мастер {name})', en: ' (with {name})' },
  // K15 procedure photos on their service screen: no author, no consent on record (Hater K15-H1,
  // John 07.10) — the "results vary" half of 'works.note' only
  'proc.title':         { ru: 'Фото процедуры', en: 'Treatment photos' },
  'proc.note':          { ru: 'Результат у каждого свой.', en: 'Results vary from person to person.' },
  // K15: the studio cover (the route video), the studio photos, the team (texts — the lawyer's table)
  'studio.eyebrow':     { ru: 'студия', en: 'studio' },
  'studio.video':       { ru: 'Видео: путь с улицы до двери студии', en: 'Video: the way from the street to the studio door' },
  'studio.poster':      { ru: 'Вход в студию с улицы', en: 'The studio entrance from the street' },
  'studio.play':        { ru: 'Смотреть видео', en: 'Play the video' },
  'studio.pause':       { ru: 'Пауза', en: 'Pause' },
  'studio.soundOn':     { ru: 'Включить звук', en: 'Turn sound on' },
  'studio.soundOff':    { ru: 'Выключить звук', en: 'Turn sound off' },
  'studio.photos':      { ru: 'Фото студии', en: 'Studio photos' },
  'studio.all':         { ru: 'Все фото · {n}', en: 'All photos · {n}' },
  'studio.allTitle':    { ru: 'Студия изнутри', en: 'Inside the studio' },
  'team.eyebrow':       { ru: 'команда', en: 'team' },
  'team.title':         { ru: 'Кто тебя встретит', en: 'Who you’ll meet' },
  'team.label':         { ru: 'Команда студии', en: 'Studio team' },
  'profile.reviews.eyebrow': { ru: 'Отзывы', en: 'Reviews' },
  'profile.reviews.title':   { ru: 'Говорят клиенты', en: 'What clients say' },
  'profile.addr.eyebrow':    { ru: 'Адрес', en: 'Location' },
  'profile.addr.title':      { ru: 'Где найти', en: 'Find us' },
  'profile.publicNote':      { ru: 'Это публичный профиль Анжелики', en: "This is Anjelika's public profile" },
  // trust — the lawyer's wording "before documents" (T2 ed. 2 §2.4)
  'trust.certified':   { ru: '✓ Высшее медицинское образование', en: '✓ Medical degree' },
  'trust.certs':       { ru: '✓ Больше 50 сертификатов конгрессов и семинаров', en: '✓ 50+ certificates from congresses and seminars' },
  'trust.cadaver':     { ru: '✓ Кадавер-курсы', en: '✓ Cadaver courses' },
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
  'cat.brows':     { ru: 'Брови', en: 'Brows' },
  'cat.derma':     { ru: 'Дерматолог', en: 'Dermatology' },
  'cat.training':  { ru: 'Обучение', en: 'Training' },
  // service detail
  'service.details':   { ru: 'Подробнее', en: 'Details' },
  'service.includes':  { ru: 'Что входит', en: "What's included" },
  'service.contra':    { ru: 'Противопоказания', en: 'Contraindications' },
  // B6-V (decision John 06.10, the lawyer's wording): on EVERY procedure card instead of the list
  'service.contraLine': {
    ru: 'У процедуры есть противопоказания. Анжелика проверит их на приёме — и по анкете здоровья, если она заполнена.',
    en: 'This treatment has contraindications. Anjelika will check them at your appointment — and against your health questionnaire if it is filled in.',
  },
  'service.requirements': { ru: 'Требования', en: 'Requirements' },
  // Katya K11 §5: «before / after» in the heading lied for single «after» shots
  'service.result':    { ru: 'Примеры работ', en: 'Examples of work' },
  'service.noPairs':   { ru: 'Фото «до и после» по этой процедуре пока нет.', en: 'No before/after photos for this treatment yet.' },
  'service.tapZoom':   { ru: 'Нажми на фото, чтобы увеличить', en: 'Tap a photo to enlarge' },
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
  'settings.notif':    { ru: 'уведомления', en: 'notifications' },
  'settings.title':    { ru: 'Настройки', en: 'Settings' },
  'settings.on':       { ru: 'вкл', en: 'on' },
  'settings.appearance': { ru: 'оформление', en: 'appearance' },
  'settings.about':      { ru: 'ANZH Cosmetology · Батуми', en: 'ANZH Cosmetology · Batumi' },
  'settings.version':    { ru: 'Версия 1.0 · Beauty TMA', en: 'Version 1.0 · Beauty TMA' },
  // account
  'account.title':     { ru: 'Паспорт', en: 'Passport' },
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

/* ── Plurals ─────────────────────────────────────────────────────────
   Russian needs three forms (1 балл · 2 балла · 5 баллов); English two.
   ────────────────────────────────────────────────────────────────── */
export function pluralRu(n: number, one: string, few: string, many: string): string {
  const mod100 = Math.abs(n) % 100;
  if (mod100 >= 11 && mod100 <= 14) return many;
  const mod10 = mod100 % 10;
  if (mod10 === 1) return one;
  if (mod10 >= 2 && mod10 <= 4) return few;
  return many;
}

/** «401 балл» · «401 points» */
export function pts(n: number, lang: Lang = current): string {
  return lang === 'ru' ? pluralRu(n, 'балл', 'балла', 'баллов') : n === 1 ? 'point' : 'points';
}

/** «4 процедуры» · «4 treatments» */
export function procs(n: number, lang: Lang = current): string {
  return lang === 'ru' ? pluralRu(n, 'процедура', 'процедуры', 'процедур') : n === 1 ? 'treatment' : 'treatments';
}
