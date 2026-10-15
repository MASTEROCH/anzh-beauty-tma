// В какой валюте человек хочет видеть ЦЕНЫ.
//
// Решение владельца 15.10.2026: переключатель «лари / доллары» возвращается.
// До этого стояло решение от 06.10 («B1-B»: валюты нет, у каждой цены своя) —
// оно разводило два риска: путаницу «в чём платить» и ложь пересчёта. Новый
// режим их не возвращает, потому что пересчитывается ТОЛЬКО показ:
//   · цена в её родной валюте остаётся второй строкой в скобках и точной;
//   · пересчитанная помечена «≈» и датой курса (lib/rates.ts);
//   · суммы визита, чеки, «оплачено» и всё, что уходит на сервер, считаются
//     в родной валюте и этим режимом не задеваются.
//
// Это удобство конкретного человека, а не данные: лежит в localStorage и
// никуда не уходит; нет хранилища — по умолчанию лари (платят в студии в них).

import { useSyncExternalStore } from 'react';

export type PriceMode = 'GEL' | 'USD';
const KEY = 'anzh_price_mode_v1';

function read(): PriceMode {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'USD' ? 'USD' : 'GEL';
  } catch { return 'GEL'; }
}

let mode: PriceMode = typeof window === 'undefined' ? 'GEL' : read();
const listeners = new Set<() => void>();

export const getPriceMode = (): PriceMode => mode;

export function setPriceMode(next: PriceMode): void {
  if (next === mode) return;
  mode = next;
  try { localStorage.setItem(KEY, next); } catch { /* не страшно: на этот сеанс режим держится */ }
  listeners.forEach((l) => l());
}

export function usePriceMode(): PriceMode {
  return useSyncExternalStore(
    (fn) => { listeners.add(fn); return () => { listeners.delete(fn); }; },
    getPriceMode,
    getPriceMode,
  );
}
