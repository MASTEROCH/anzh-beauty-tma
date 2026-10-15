import { useEffect, useSyncExternalStore } from 'react';
import { getChatThreads, type ChatThreadWire } from './api/chat';
import { cabinetDenied } from './staff';
import { toast } from './ui';
import { notify } from './haptics';

// Входящие студии — живые, пока открыт кабинет.
//
// Один цикл длинного опроса на весь кабинет (а не на каждый экран): им
// питаются и счётчик на вкладке «Клиенты», и список переписок, и открытая
// переписка. Новое сообщение клиентки приходит, как только она нажала
// «Отправить»: тактильный сигнал и всплывающая строка «Имя: текст», если эта
// переписка сейчас не открыта. Так администратор отвечает быстро, не сидя
// на вкладке «Переписка».

export interface InboxState {
  threads: ChatThreadWire[];
  loaded: boolean;
  failed: boolean;
  unread: number;
}

let state: InboxState = { threads: [], loaded: false, failed: false, unread: 0 };
const listeners = new Set<() => void>();
const set = (patch: Partial<InboxState>) => {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
};
const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };

let users = 0;
let ctrl: AbortController | null = null;
let seq = -1;
let known = new Set<string>();
/** Какая переписка сейчас открыта — о ней не сигналим. */
let activeClient: number | null = null;

export const setActiveThread = (id: number | null) => { activeClient = id; };

function absorb(threads: ChatThreadWire[], first: boolean) {
  const unread = threads.reduce((n, t) => n + (t.client_id === activeClient ? 0 : (t.unread ?? 0)), 0);
  if (!first) {
    for (const t of threads) {
      for (const m of t.messages) {
        if (m.from !== 'client' || known.has(m.id) || t.client_id === activeClient) continue;
        notify('success');
        toast(`${t.name}: ${m.text || (m.attachment?.kind === 'video' ? 'видео' : 'фото')}`);
      }
    }
  }
  known = new Set(threads.flatMap((t) => t.messages.map((m) => m.id)));
  set({ threads, loaded: true, failed: false, unread });
}

async function loop(c: AbortController) {
  let backoff = 1000;
  while (!c.signal.aborted) {
    try {
      const first = seq < 0;
      const r = await getChatThreads(seq, first ? 0 : 25, c.signal);
      if (c.signal.aborted) return;
      seq = r.seq;
      absorb(r.threads, first);
      backoff = 1000;
    } catch (e) {
      if (c.signal.aborted) return;
      cabinetDenied(e);
      set({ failed: true, loaded: true });
      await new Promise((ok) => setTimeout(ok, backoff));
      backoff = Math.min(backoff * 2, 30_000);
    }
  }
}

/** Подтолкнуть цикл: после своего ответа не ждать конца текущего ожидания. */
export function refreshInbox() {
  if (!ctrl) return;
  ctrl.abort();
  ctrl = new AbortController();
  const c = ctrl;
  void (async () => {
    try {
      const r = await getChatThreads();
      if (!c.signal.aborted) { seq = r.seq; absorb(r.threads, false); }
    } catch { /* цикл ниже повторит */ }
    void loop(c);
  })();
}

export function useStaffInbox(enabled: boolean): InboxState {
  useEffect(() => {
    if (!enabled) return;
    users += 1;
    if (users === 1) {
      ctrl = new AbortController();
      seq = -1;
      void loop(ctrl);
    }
    return () => {
      users -= 1;
      if (users === 0) { ctrl?.abort(); ctrl = null; }
    };
  }, [enabled]);
  return useSyncExternalStore(subscribe, () => state, () => state);
}
