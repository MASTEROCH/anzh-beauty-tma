// План процедур. Анжелика: «если клиент сделал первую процедуру — у него
// следующий сеанс на неё, либо следующая по логическому списку». Порядок не
// произвольный: сначала чистка и подготовка кожи, потом пилинги и аппарат,
// инъекции — последними, уход — фоном. Избранное в каталоге перестаёт быть
// просто сердечком и становится входом в курс.

import { findService, isBookable, sTitle, type Service } from '../data/services';
import { getLang } from './i18n';
import { priceSourceOf, visitTotal, type PriceSource } from './money';

/** Чем меньше, тем раньше в курсе */
const ORDER: Record<Service['category'], number> = {
  derma: 0,      // сначала врач: он может отменить всю остальную программу
  clean: 1,
  peel: 2,
  apparatus: 3,
  inj: 4,
  brows: 5,
  care: 6,
  // Обучение в курсе по коже участвовать не может: это продукт для коллег,
  // а не шаг лечения. Значение нужно только для полноты типа.
  training: 99,
};

/** Пауза ПОСЛЕ процедуры этой категории, дней */
const GAP_DAYS: Record<Service['category'], number> = {
  training: 0,
  derma: 3,
  clean: 7,
  peel: 14,
  apparatus: 10,
  inj: 21,
  brows: 2,
  care: 7,
};

/**
 * Course procedures: how many sessions and how far apart. EMPTY on purpose (K7): the
 * former numbers (3 sessions of biorevitalization every 2 weeks, 4 RF-lifting / PRX-T33
 * sessions…) came from the demo catalog, not from the clinic — the clinic says the
 * number of sessions depends on the skin and is set at the examination. Each procedure
 * is one step until the clinic gives real numbers.
 */
const COURSE: Record<string, { sessions: number; everyDays: number }> = {};

/**
 * Procedures priced per session that the clinic runs as a course (K14, Hater H-9). COURSE is
 * empty, so the plan has them as ONE step and the "from … total" holds one session — the line
 * under the total says so instead of a recount. Range — the procedure's own subtitle
 * (data/services.ts biorevit, "a course of 2–5 sessions"); texts — the task (John 07.10).
 */
const SESSION_COURSE_NOTE = new Map<string, { ru: string; en: string }>([
  ['biorevit', {
    ru: 'Биоревитализация — курс 2–5 сеансов; в сумму вошёл только один сеанс, весь курс выйдет дороже.',
    en: 'Biorevitalization is a course of 2–5 sessions; the total includes only one session, so the full course costs more.',
  }],
]);

/** Lines for the course procedures in the plan, once each, in the order of the steps. */
export function courseNotes(plan: Pick<Plan, 'steps'>, lang: 'ru' | 'en'): string[] {
  const ids = [...new Set(plan.steps.map((s) => s.service.id))];
  return ids.flatMap((id) => {
    const note = SESSION_COURSE_NOTE.get(id);
    return note ? [note[lang]] : [];
  });
}

export interface PlanStep {
  service: Service;
  date: Date;
  session: number;
  ofSessions: number;
}

export interface Plan {
  steps: PlanStep[];
  /** Sum of the steps in their one currency ("from" when any step is); null — the
   *  steps are priced in different currencies or a price is missing: no total. */
  total: PriceSource | null;
  weeks: number;
  warnings: string[];
}

/** Анжелика принимает вт–сб: план не должен предлагать её выходные */
const WORK_DAYS = [2, 3, 4, 5, 6];
function toWorkday(d: Date) {
  while (!WORK_DAYS.includes(d.getDay())) d.setDate(d.getDate() + 1);
  return d;
}

export function buildPlan(favoriteIds: string[]): Plan | null {
  const chosen = favoriteIds
    .map((id) => findService(id))
    .filter((s): s is Service => !!s)
    // Курс по коже строится из процедур. Обучение для коллег попало бы сюда
    // из «избранного» и выдало бы клиентке «двухдневный курс инъекций»
    // третьим шагом её программы ухода — с кнопкой «Записаться», на которую
    // сервер ответит not_bookable. Процедура или курс — isBookable (по kind).
    .filter(isBookable)
    .sort((a, b) => ORDER[a.category] - ORDER[b.category]);

  if (chosen.length === 0) return null;

  const steps: PlanStep[] = [];

  // У каждой зоны свой курсор: лицо, тело и брови не конкурируют за время.
  // Иначе курс удаления татуировки на руке отодвигал пилинг лица на полгода.
  const start = new Date();
  start.setDate(start.getDate() + 2); // первый шаг — не «завтра», нужно время подтвердить
  toWorkday(start);
  const cursors = new Map<string, Date>();
  const cursorFor = (zone: string) => {
    if (!cursors.has(zone)) cursors.set(zone, new Date(start));
    return cursors.get(zone)!;
  };

  for (const service of chosen) {
    const zone = service.zone ?? 'face';
    const cursor = cursorFor(zone);
    const course = COURSE[service.id];
    const sessions = course?.sessions ?? 1;
    for (let i = 0; i < sessions; i++) {
      steps.push({ service, date: new Date(cursor), session: i + 1, ofSessions: sessions });
      const step = course ? course.everyDays : GAP_DAYS[service.category];
      cursor.setDate(cursor.getDate() + step);
      toWorkday(cursor);
    }
  }

  // Зоны шли параллельно — в плане шаги должны стоять по датам, а не по зонам
  steps.sort((a, b) => a.date.getTime() - b.date.getTime());

  // One currency or nothing — lari are never added to dollars (B1-B; lib/money.ts visitTotal)
  const total = visitTotal(steps.map((x) => priceSourceOf(x.service)));
  const first = steps[0].date;
  const last = steps.reduce((m, x) => (x.date > m ? x.date : m), steps[0].date);
  const weeks = Math.max(1, Math.round((last.getTime() - first.getTime()) / (7 * 864e5)));

  /* One line (K13, H-4; the lawyer). The prototype's three warnings are gone: "add a cleansing
     to favourites" (there is none on the showcase, and "I" is the assistant's voice), "three
     weeks between injectables" and "a skipped session resets the course" (no source at the
     clinic; the second fired on SMAS). The gaps above stay a rough draft — hence "approximate". */
  const ru = getLang() === 'ru';
  const warnings: string[] = [ru
    ? 'Финальный порядок и интервалы Анжелика подтверждает после осмотра — даты в плане примерные, их можно двигать.'
    : 'Anjelika confirms the final order and intervals after seeing your skin — the dates in the plan are approximate and can shift.'];

  return { steps, total, weeks, warnings };
}

/* ── Согласование плана ──────────────────────────────────────────────
   Здесь было «отправить на согласование»: статус лежал в localStorage, а
   через 45 секунд план сам становился «одобренным» — Анжелика его не видела
   никогда. Сервера для планов этой ночью нет (второй ряд), поэтому честный
   путь — написать Анжелике в Telegram готовым текстом плана. */

/** Текст плана для сообщения Анжелике: процедуры и даты, без медданных. */
export function planMessage(plan: Plan, lang: 'ru' | 'en'): string {
  const ru = lang === 'ru';
  const fmt = (d: Date) => d.toLocaleDateString(ru ? 'ru-RU' : 'en-US', { day: 'numeric', month: 'long' });
  const lines = plan.steps.map((st, i) => {
    const session = st.ofSessions > 1 ? ` (${st.session}/${st.ofSessions})` : '';
    return `${i + 1}. ${sTitle(st.service, lang)}${session} — ${fmt(st.date)}`;
  });
  const head = ru
    ? 'Анжелика, здравствуйте! Собрала план процедур в приложении — посмотрите, пожалуйста:'
    : 'Hi Anjelika! I built a treatment plan in the app — could you take a look?';
  return [head, ...lines].join('\n');
}
