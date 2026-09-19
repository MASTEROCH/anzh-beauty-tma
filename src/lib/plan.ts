// План процедур. Анжелика: «если клиент сделал первую процедуру — у него
// следующий сеанс на неё, либо следующая по логическому списку». Порядок не
// произвольный: сначала чистка и подготовка кожи, потом пилинги и аппарат,
// инъекции — последними, уход — фоном. Избранное в каталоге перестаёт быть
// просто сердечком и становится входом в курс.

import { useEffect, useState } from 'react';
import { findService, type Service } from '../data/services';
import { getLang } from './i18n';

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

/** Курсовые процедуры: сколько сеансов и с каким шагом */
const COURSE: Record<string, { sessions: number; everyDays: number }> = {
  biorevit: { sessions: 3, everyDays: 14 },
  'almagold-peel': { sessions: 4, everyDays: 14 },
  'rf-lifting': { sessions: 4, everyDays: 10 },
  'carbon-peel': { sessions: 4, everyDays: 14 },
  // Татуировка уходит за курс с длинной паузой: организм выводит пигмент сам
  'tattoo-removal': { sessions: 5, everyDays: 45 },
};

export interface PlanStep {
  service: Service;
  date: Date;
  session: number;
  ofSessions: number;
}

export interface Plan {
  steps: PlanStep[];
  totalUsd: number;
  totalGel: number;
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
    // третьим шагом её программы ухода.
    .filter((s) => s.category !== 'training')
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

  const totalUsd = steps.reduce((s, x) => s + x.service.priceUsd, 0);
  const totalGel = steps.reduce((s, x) => s + x.service.priceGel, 0);
  const first = steps[0].date;
  const last = steps.reduce((m, x) => (x.date > m ? x.date : m), steps[0].date);
  const weeks = Math.max(1, Math.round((last.getTime() - first.getTime()) / (7 * 864e5)));

  const warnings: string[] = [];
  const cats = new Set(chosen.map((s) => s.category));
  const ru = getLang() === 'ru';
  if (cats.has('inj') && !cats.has('clean')) {
    warnings.push(ru
      ? 'Перед инъекциями лучше сделать чистку — кожа должна быть спокойной. Добавь её в избранное, и я поставлю первой.'
      : 'Before injectables the skin should be calm — a cleansing first is better. Heart it and I’ll put it first.');
  }
  if (chosen.filter((s) => s.category === 'inj').length > 1) {
    warnings.push(ru
      ? 'Две инъекционные процедуры подряд не делаем: между ними в плане 3 недели.'
      : 'Two injectable treatments never run back to back — the plan keeps three weeks between them.');
  }
  if (cats.has('peel') || cats.has('apparatus')) {
    warnings.push(ru
      ? 'Пилинги и аппарат работают накопительно — пропущенный сеанс сбрасывает эффект курса.'
      : 'Peels and apparatus work cumulatively — a skipped session resets the course.');
  }
  warnings.push(ru
    ? 'Финальный порядок Анжелика подтверждает после осмотра — план можно двигать.'
    : 'Anjelika confirms the final order after seeing your skin — the plan can shift.');

  return { steps, totalUsd, totalGel, weeks, warnings };
}

/* ── Статус согласования плана ── */

export type PlanStatus = 'draft' | 'sent' | 'approved';

const KEY = 'anzh_plan_v1';
const listeners = new Set<(s: PlanStatus) => void>();
const DEMO_APPROVE_MS = 45_000; // в прототипе Анжелика «отвечает» сама

interface Stored { status: PlanStatus; sentAt?: number }

function load(): Stored {
  if (typeof window === 'undefined') return { status: 'draft' };
  try {
    const raw = localStorage.getItem(KEY);
    const s = raw ? (JSON.parse(raw) as Stored) : { status: 'draft' as PlanStatus };
    // Если ушло достаточно времени, пока приложение было закрыто — план уже согласован
    if (s.status === 'sent' && s.sentAt && Date.now() - s.sentAt > DEMO_APPROVE_MS) {
      return { status: 'approved' };
    }
    return s;
  } catch {
    return { status: 'draft' };
  }
}

let stored: Stored = load();

function save(next: Stored) {
  stored = next;
  try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* ignore */ }
  listeners.forEach((l) => l(next.status));
}

export function sendPlanForApproval() {
  save({ status: 'sent', sentAt: Date.now() });
  window.setTimeout(() => {
    if (stored.status === 'sent') save({ status: 'approved' });
  }, DEMO_APPROVE_MS);
}


export function usePlanStatus(): PlanStatus {
  const [s, setS] = useState<PlanStatus>(stored.status);
  useEffect(() => {
    listeners.add(setS);
    return () => { listeners.delete(setS); };
  }, []);
  return s;
}
