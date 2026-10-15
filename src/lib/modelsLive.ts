import { useEffect, useSyncExternalStore } from 'react';
import { getModelProgram, getMyModel, type ModelProgram, type MyModel } from './api/models';
import { sessionState, subscribeSession } from './session';

/* Программа моделей: что предлагает студия (публично) и мой статус (с сессией).
   Правда — на сервере; экран только показывает и перечитывает после действий. */
let program: ModelProgram | null = null;
let mine: MyModel | null = null;
let failed = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
type Snap = { program: ModelProgram | null; mine: MyModel | null; failed: boolean };
let snap: Snap = { program, mine, failed };
const refreshSnap = () => { snap = { program, mine, failed }; emit(); };

export function loadModels(): Promise<void> {
  const a = getModelProgram().then((p) => { program = p; failed = false; }, () => { failed = true; });
  const b = sessionState().status === 'user' ? getMyModel().then((m) => { mine = m; }, () => { /* нет ручки — статуса нет */ }) : Promise.resolve();
  return Promise.all([a, b]).then(refreshSnap);
}
export const setMyModel = (m: MyModel) => { mine = m; refreshSnap(); };

export function useModels(): Snap {
  useEffect(() => {
    if (!program) void loadModels();
    return subscribeSession(() => { if (sessionState().status === 'user' && !mine) void loadModels(); });
  }, []);
  return useSyncExternalStore((l) => { listeners.add(l); return () => { listeners.delete(l); }; }, () => snap, () => snap);
}
