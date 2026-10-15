// Курс лари к доллару — ТОЛЬКО для показа цены в другой валюте.
//
// 🔴 [ПРЕДЛОЖЕНИЕ БЭКЕНДУ] `GET /rates` → `{lari_per_dollar, as_of, source}`.
// Публичная ручка без пропуска. Сервер берёт официальный курс Нацбанка
// Грузии (NBG) раз в час и отдаёт его же всем: так телефон клиентки не ходит
// на чужой сервер сам и не светит ему свой адрес (то же правило, по которому
// карта студии лежит у нас, а не встроенная). Пока сервер ручки не завёл —
// и пока он молчит — работает ЗАПАСНОЕ значение ниже, и экран говорит об
// этом честно: курс без даты называется «ориентировочным».
//
// Курс не участвует ни в одной сумме, которая уходит или хранится: пересчёт
// только для глаз, с пометкой «≈» (lib/money.ts displayPrice).

import { useSyncExternalStore } from 'react';
import { apiRequest } from './session';

export interface Rate {
  lariPerDollar: number;
  /** Когда курс назначен (ISO-дата); null — запасной, без даты. */
  asOf: string | null;
  /** Пришёл с сервера. */
  live: boolean;
}

/** Запасной курс: значение, которое было в коде до живого (K11b, John 06.10). */
export const FALLBACK_RATE: Rate = { lariPerDollar: 2.74, asOf: null, live: false };

let rate: Rate = FALLBACK_RATE;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export const getRate = (): Rate => rate;

export function useRate(): Rate {
  return useSyncExternalStore(
    (fn) => { listeners.add(fn); return () => { listeners.delete(fn); }; },
    getRate,
    getRate,
  );
}

interface RatesWire { lari_per_dollar?: unknown; as_of?: unknown }

/** Курс с сервера. Никогда не бросает: нет ручки, нет сети, мусор в ответе —
    остаётся запасной, и это не ошибка, а штатный режим. */
export async function loadRate(signal?: AbortSignal): Promise<void> {
  try {
    const r = await apiRequest<RatesWire>('GET', '/rates', { auth: 'none', signal });
    const v = Number(r?.lari_per_dollar);
    // Курс лари к доллару за последние годы — 2.4…3.2; всё вне 1…10 это
    // мусор, и показывать по нему цены хуже, чем по запасному.
    if (Number.isFinite(v) && v > 1 && v < 10) {
      rate = {
        lariPerDollar: v,
        asOf: typeof r.as_of === 'string' ? r.as_of : null,
        live: true,
      };
      emit();
    }
  } catch { /* штатно: остаёмся на запасном */ }
}
