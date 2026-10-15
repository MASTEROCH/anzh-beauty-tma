import { useEffect, useSyncExternalStore } from 'react';
import { getMyRewards, type RewardsWire } from './api/rewards';
import { sessionState, subscribeSession } from './session';

/* Скидка за действия — правда на сервере; здесь только показ. */
let state: RewardsWire | null = null;
const listeners = new Set<() => void>();
export const setRewards = (r: RewardsWire | null) => { state = r; listeners.forEach((l) => l()); };

export function loadRewards(): Promise<void> {
  if (sessionState().status !== 'user') return Promise.resolve();
  return getMyRewards().then(setRewards, () => { /* нет ручки — блок скидок не рисуем */ });
}

export function useRewards(): RewardsWire | null {
  useEffect(() => {
    void loadRewards();
    return subscribeSession(() => { if (sessionState().status === 'user' && !state) void loadRewards(); });
  }, []);
  return useSyncExternalStore((l) => { listeners.add(l); return () => { listeners.delete(l); }; }, () => state, () => state);
}
