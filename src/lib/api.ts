// Общие вызовы, нужные многим экранам: «кто я» и его хук.
//
// Раскладка сетевого слоя фронта:
//   · `lib/session.ts`      — вход, пропуск, `apiRequest` (единственный fetch);
//   · `lib/api/<домен>.ts`  — типы провода и тонкие вызовы домена
//                             (образец — `lib/api/me.ts`);
//   · `lib/api.ts` (здесь)  — общее состояние поверх провода: профиль `Me`.
//
// Профиль держится в памяти, не в хранилище: сервер — источник правды, а
// внутри Telegram свежий профиль приезжает при каждом запуске.

import { useSyncExternalStore } from 'react';
import { ApiError, isAbortError, sessionState, subscribeSession } from './session';
import { getMe, patchMe, type Me, type MePatch } from './api/me';

export type { Me, MePatch } from './api/me';

export interface MeState {
  me: Me | null;
  loading: boolean;
  /** Последний отказ загрузки. Ошибка ≠ пустота: экран показывает её, а не «нет данных». */
  error: ApiError | null;
}

let meState: MeState = { me: null, loading: false, error: null };
const listeners = new Set<() => void>();
let inflight: Promise<Me | null> | null = null;

function setMe(next: MeState): void {
  meState = next;
  for (const l of listeners) {
    try { l(); } catch { /* подписчик не вправе уронить остальных */ }
  }
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

// Сессия потеряна насовсем (гость) — профиль прошлого входа больше не наш.
subscribeSession(() => {
  if (sessionState().status === 'guest' && (meState.me || meState.error || meState.loading)) {
    setMe({ me: null, loading: false, error: null });
  }
});

/** Профиль из памяти, без запроса. */
export const currentMe = (): Me | null => meState.me;

/**
 * Перечитать профиль с сервера. Одно обещание на всех одновременных
 * вызывающих (и на двойной маунт StrictMode). Не бросает: отказ ложится в
 * `error`, гостю отвечает `null` без похода в сеть.
 * ⚠️ Присоединяется к уже идущему чтению: если оно началось ДО события, ради
 * которого перечитываем (409 terms_not_accepted у оплаты), придёт снимок
 * старее. Экран оплаты это переживает: «условия обновились» он говорит, когда
 * `Me.legal.terms` реально сменится, каким бы чтением она ни пришла.
 */
export function refreshMe(): Promise<Me | null> {
  if (inflight) return inflight;
  if (sessionState().status === 'guest') {
    if (meState.me || meState.error) setMe({ me: null, loading: false, error: null });
    return Promise.resolve(null);
  }
  setMe({ ...meState, loading: true });
  inflight = getMe()
    .then(
      (me) => {
        setMe({ me, loading: false, error: null });
        return me;
      },
      (e: unknown) => {
        const error = e instanceof ApiError
          ? e
          : new ApiError(0, isAbortError(e) ? 'aborted' : 'network', 'GET /me: сбой');
        // Гость по итогам входа — это не ошибка профиля, а его отсутствие.
        const guest = sessionState().status === 'guest';
        setMe({ me: guest ? null : meState.me, loading: false, error: guest ? null : error });
        return null;
      },
    )
    .finally(() => { inflight = null; });
  return inflight;
}

/**
 * Re-read the profile with a request that STARTS now: waits for a read already in
 * flight (it may have left before the event we re-read for — e.g. Telegram has just let
 * the bot message the user) and only then starts its own. Same contract as `refreshMe`:
 * never throws, `null` on failure.
 */
export async function refreshMeAfterCurrent(): Promise<Me | null> {
  if (inflight) await inflight;
  return refreshMe();
}

/**
 * Сохранить часть профиля (PATCH /me) и положить ответ сервера в состояние.
 * В отличие от `refreshMe` БРОСАЕТ `ApiError`: вызывающий экран обязан
 * сказать человеку, что сохранить не удалось.
 */
export async function updateMe(patch: MePatch): Promise<Me> {
  const me = await patchMe(patch);
  setMe({ me, loading: false, error: null });
  return me;
}

/** Профиль для React: `{me, loading, error}`. Загрузку запускает `refreshMe()`. */
export function useMe(): MeState {
  return useSyncExternalStore(subscribe, () => meState, () => meState);
}
