// Профиль студии: контакты, адрес, часы — то, что владелица правит в кабинете.
//
// Живёт в `data/location.ts` как запасное значение; здесь — загрузка с
// сервера (`GET /studio`, публично) и хук для экранов. Загрузка никогда не
// бросает: нет ручки или сети — остаётся запасной профиль, и это штатно.

import { useSyncExternalStore } from 'react';
import {
  STUDIO_DEFAULT, getStudio, setStudio, subscribeStudio, type StudioProfile,
} from '../data/location';
import { getStudio as fetchStudio, type StudioWire } from './api/studio';

export type { StudioProfile } from '../data/location';

export function useStudio(): StudioProfile {
  return useSyncExternalStore(subscribeStudio, getStudio, getStudio);
}

/** Провод → экран. Чего сервер не прислал, берётся из запасного. */
export function fromWire(w: StudioWire): StudioProfile {
  const d = STUDIO_DEFAULT;
  const bi = (x: { ru?: string; en?: string } | undefined, fb: { ru: string; en: string }) => ({
    ru: typeof x?.ru === 'string' && x.ru ? x.ru : fb.ru,
    en: typeof x?.en === 'string' && x.en ? x.en : fb.en,
  });
  const nz = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);
  return {
    name: nz(w.name) ?? d.name,
    tagline: bi(w.tagline, d.tagline),
    city: bi(w.city, d.city),
    street: bi(w.street, d.street),
    floor: bi(w.floor, d.floor),
    hint: bi(w.hint, d.hint),
    landmarks: {
      ru: Array.isArray(w.landmarks?.ru) ? w.landmarks!.ru : d.landmarks.ru,
      en: Array.isArray(w.landmarks?.en) ? w.landmarks!.en : d.landmarks.en,
    },
    lat: Number.isFinite(w.lat) ? w.lat : d.lat,
    lon: Number.isFinite(w.lon) ? w.lon : d.lon,
    telegram: nz(w.telegram)?.replace(/^@/, '') ?? d.telegram,
    instagram: w.instagram === null ? null : (nz(w.instagram)?.replace(/^@/, '') ?? d.instagram),
    phone: nz(w.phone),
    whatsapp: nz(w.whatsapp),
    hours: bi(w.hours, d.hours),
    offDays: Array.isArray(w.off_days) ? w.off_days.filter((n) => Number.isInteger(n) && n >= 0 && n <= 6) : d.offDays,
  };
}

/** Экран → провод (для PATCH). Только поля, которые правит форма. */
export function toWire(p: StudioProfile): StudioWire {
  return {
    name: p.name, tagline: p.tagline, city: p.city, street: p.street, floor: p.floor, hint: p.hint,
    landmarks: p.landmarks, lat: p.lat, lon: p.lon, telegram: p.telegram,
    instagram: p.instagram, phone: p.phone, whatsapp: p.whatsapp, hours: p.hours, off_days: p.offDays,
  };
}

export async function loadStudioProfile(signal?: AbortSignal): Promise<void> {
  try {
    setStudio(fromWire(await fetchStudio(signal)));
  } catch { /* штатно: остаёмся на запасном профиле */ }
}

/** После удачной правки в кабинете: витрина на этом телефоне получает строку из ОТВЕТА сервера, не перечитывается. */
export function applyStudio(w: StudioWire): void {
  setStudio(fromWire(w));
}
