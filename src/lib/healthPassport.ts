// Паспорт здоровья. Раньше это был статичный набор чипов в кабинете, а кнопка
// «Редактировать анкету» показывала тост-заглушку — то есть аллергии и
// противопоказания клиента негде было собрать, хотя у каждой услуги они
// прописаны в data/services.ts.

import { useEffect, useState } from 'react';

export type Sensitivity = 'low' | 'medium' | 'high';

export interface HealthPassport {
  noAllergies: boolean;
  allergies: string[];      // свободные пометки, напр. «Лидокаин — слабая реакция»
  pregnant: boolean;
  lactating: boolean;
  chronic: string;
  meds: string;
  skinType: string;
  fitzpatrick: string;
  couperose: boolean;
  sensitivity: Sensitivity;
  notes: string;
  updatedAt: number;
  /* ── Заполняется разбором ANZH Skin Intelligence ── */
  goal?: string;            // главный запрос: сияние / акне / anti-age / губы
  experience?: string;      // с чем уже сталкивалась
  pace?: string;            // разовая процедура / курс / системно
  quizAt?: number;          // когда проходили разбор
}

const KEY = 'anzh_health_v1';
const listeners = new Set<(p: HealthPassport) => void>();

const DEFAULT: HealthPassport = {
  noAllergies: false,
  allergies: ['Лидокаин — слабая реакция'],
  pregnant: false,
  lactating: false,
  chronic: '',
  meds: '',
  skinType: 'Комбинированная',
  fitzpatrick: 'II',
  couperose: false,
  sensitivity: 'medium',
  notes: '',
  updatedAt: 0,
};

function load(): HealthPassport {
  if (typeof window === 'undefined') return DEFAULT;
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...DEFAULT, ...(JSON.parse(raw) as Partial<HealthPassport>) } : DEFAULT;
  } catch {
    return DEFAULT;
  }
}

let current: HealthPassport = load();


export function updateHealthPassport(patch: Partial<HealthPassport>) {
  current = { ...current, ...patch, updatedAt: Date.now() };
  try { localStorage.setItem(KEY, JSON.stringify(current)); } catch { /* ignore */ }
  listeners.forEach((l) => l(current));
}

export function useHealthPassport(): HealthPassport {
  const [s, setS] = useState<HealthPassport>(current);
  useEffect(() => {
    listeners.add(setS);
    return () => { listeners.delete(setS); };
  }, []);
  return s;
}

export const SENSITIVITY_LABEL: Record<Sensitivity, { ru: string; en: string }> = {
  low:    { ru: 'Низкая',  en: 'Low' },
  medium: { ru: 'Средняя', en: 'Medium' },
  high:   { ru: 'Высокая', en: 'High' },
};

export const SKIN_TYPES = ['Сухая', 'Нормальная', 'Комбинированная', 'Жирная', 'Чувствительная'];
export const FITZPATRICK = ['I', 'II', 'III', 'IV', 'V', 'VI'];

/** Флаги для карточки в кабинете и для сверки с противопоказаниями услуги */
export function passportFlags(p: HealthPassport, ru = true) {
  const flags: Array<{ kind: 'warn' | 'ok'; text: string }> = [];
  if (p.allergies.length > 0 && !p.noAllergies) {
    p.allergies.forEach((a) => flags.push({ kind: 'warn', text: a }));
  } else {
    flags.push({ kind: 'ok', text: ru ? 'Без аллергий' : 'No allergies' });
  }
  if (p.pregnant) flags.push({ kind: 'warn', text: ru ? 'Беременность' : 'Pregnancy' });
  if (p.lactating) flags.push({ kind: 'warn', text: ru ? 'Лактация' : 'Lactation' });
  if (p.chronic.trim()) flags.push({ kind: 'warn', text: p.chronic.trim() });
  if (p.meds.trim()) flags.push({ kind: 'warn', text: (ru ? 'Препараты: ' : 'Meds: ') + p.meds.trim() });
  if (!p.pregnant && !p.lactating && !p.chronic.trim()) {
    flags.push({ kind: 'ok', text: ru ? 'Не беременна · без хроник' : 'Not pregnant · no chronic' });
  }
  return flags;
}

/** Совпадения анкеты с противопоказаниями конкретной услуги */
export function matchContraindications(p: HealthPassport, contraindications: string[]): string[] {
  const hits: string[] = [];
  for (const c of contraindications) {
    const low = c.toLowerCase();
    if (p.pregnant && /беремен|pregnan/.test(low)) hits.push(c);
    else if (p.lactating && /лактац|кормл|lactat/.test(low)) hits.push(c);
    else if (p.couperose && /купероз/.test(low)) hits.push(c);
    else if (!p.noAllergies && p.allergies.some((a) => {
      const word = a.toLowerCase().split(/[\s—-]/)[0];
      return word.length > 3 && low.includes(word);
    })) hits.push(c);
  }
  return hits;
}
