import { useEffect, useSyncExternalStore } from 'react';
import { getMyPassport, unlockChapter, type PassportWire } from './api/passport';
import { sessionState, subscribeSession } from './session';

/* Главы паспорта — в памяти запуска, правда на сервере. Нет входа или ручки —
   null: экран показывает только путь через Stars, как раньше. */

let state: PassportWire | null = null;
const listeners = new Set<() => void>();
const set = (p: PassportWire | null) => { state = p; listeners.forEach((l) => l()); };
let loading: Promise<void> | null = null;

export function loadPassport(force = false): Promise<void> {
  if (sessionState().status !== 'user') return Promise.resolve();
  if (loading && !force) return loading;
  loading = getMyPassport().then(set, () => { /* ручки нет — остаётся путь через Stars */ }).finally(() => { loading = null; });
  return loading;
}

/** Открыть главу подарком. Бросает ApiError — экран скажет почему. */
export async function openChapter(quizId: string): Promise<void> {
  set(await unlockChapter(quizId));
}

export const chapterOpen = (p: PassportWire | null, quizId: string) => !!p?.unlocked.includes(quizId);

export function usePassport(): PassportWire | null {
  useEffect(() => {
    void loadPassport();
    return subscribeSession(() => { if (sessionState().status === 'user' && !state) void loadPassport(); });
  }, []);
  return useSyncExternalStore((l) => { listeners.add(l); return () => { listeners.delete(l); }; }, () => state, () => state);
}
