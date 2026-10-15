// Мост к Telegram Mini App.
//
// Две половины, собранные из двух веток:
//   · личность клиента (`getTgUser`) — главный якорь Анжелики: телефонов у
//     неё почти ни у кого нет, в контактах ник из инстаграма, который может
//     слететь. Telegram-ID не слетает.
//   · инициализация окна (`initTelegram`) — то, без чего мини-апп ведёт себя
//     как страница в браузере, а не как приложение.
//
// Хаптика живёт в `lib/haptics.ts`, а системная «назад» — в `lib/gestures.ts`
// вместе со стеком оверлеев: обе вещи нужны шире, чем Telegram, и завязывать
// их на этот модуль значит тянуть его в каждый компонент.
//
// Вне Telegram всё молча ничего не делает — прототип должен открываться
// в обычном браузере и в тестах.

export interface TgUser {
  id: number;
  firstName: string;
  lastName?: string;
  username?: string;
  languageCode?: string;
  photoUrl?: string;
}

interface TgWebApp {
  /** Подписанная строка. Вне Telegram — пустая */
  initData?: string;
  initDataUnsafe?: {
    user?: {
      id: number;
      first_name: string;
      last_name?: string;
      username?: string;
      language_code?: string;
      photo_url?: string;
    };
  };
  ready?: () => void;
  expand?: () => void;
  disableVerticalSwipes?: () => void;
  setHeaderColor?: (c: string) => void;
  setBackgroundColor?: (c: string) => void;
  openLink?: (url: string, opts?: { try_instant_view?: boolean }) => void;
  openTelegramLink?: (url: string) => void;
  viewportStableHeight?: number;
  safeAreaInset?: { top: number; bottom: number; left: number; right: number };
  contentSafeAreaInset?: { top: number; bottom: number; left: number; right: number };
  platform?: string;
  /** Client version, e.g. '8.0'. */
  version?: string;
  isVersionAtLeast?: (version: string) => boolean;
  /** Bot API 6.9+: asks the user to let the bot message them; the callback gets `true` when allowed. */
  requestWriteAccess?: (cb?: (allowed: boolean) => void) => void;
  onEvent?: (evt: string, cb: () => void) => void;
  offEvent?: (evt: string, cb: () => void) => void;
}

function webApp(): TgWebApp | undefined {
  if (typeof window === 'undefined') return undefined;
  return (window as unknown as { Telegram?: { WebApp?: TgWebApp } }).Telegram?.WebApp;
}

/* ── Кто открыл приложение ── */

export function getTgUser(): TgUser | null {
  const u = webApp()?.initDataUnsafe?.user;
  if (!u) return null;
  return {
    id: u.id,
    firstName: u.first_name,
    lastName: u.last_name,
    username: u.username,
    languageCode: u.language_code,
    photoUrl: u.photo_url,
  };
}

/** @username или имя — то, как мастер найдёт человека в своей базе */
export function tgHandle(u: TgUser | null): string {
  if (!u) return '';
  return u.username ? `@${u.username}` : u.firstName;
}

/* ── Подписанная строка запуска ──

   `initData` — единственное, что умеет доказать СЕРВЕРУ, кто открыл
   приложение: её подписывает Telegram токеном бота, проверяет только
   сервер (`POST /auth/telegram`). Строка уходит на сервер как есть, сырой:
   ни разбирать, ни пересобирать её на клиенте нельзя — подпись считается
   по исходным парам, и любая «нормализация» ломает вход у всех.

   Поэтому здесь НЕТ разбора `start_param`: метку приглашения сервер
   достаёт из той же подписанной строки сам. Клиентская копия была бы
   вторым источником одного факта — и неподписанным. */
export function rawInitData(): string | null {
  const value = webApp()?.initData;
  return typeof value === 'string' && value.length > 0 ? value : null;
}

/* «Мы внутри Telegram» = есть НЕПУСТАЯ подписанная строка. И только она.

   Раньше сюда же засчитывался `initDataUnsafe.user` — это грабли из
   ДЕНИСУ.md §6: скрипт telegram-web-app.js создаёт `Telegram.WebApp` и в
   обычном браузере, а `initDataUnsafe` — неподписанная половина, которую
   любой заполнит из консоли. Признак, по которому решается «входить ли на
   сервер» и «можно ли платить», обязан совпадать с тем, что сервер
   примет, — иначе экран пустит туда, где вход заведомо не состоится. */
export const isTelegram = (): boolean => rawInitData() !== null;

/** Открыть наружу: внутри Telegram — его собственным браузером */
export function openExternal(url: string) {
  const app = webApp();
  if (app?.openLink) app.openLink(url);
  else window.open(url, '_blank', 'noopener,noreferrer');
}

/* Ссылка на сам Telegram — отдельный метод. Через openLink мини-апп
   выкидывает человека во внешний браузер, который тут же пытается
   вернуть его обратно в Telegram: лишний прыжок и потерянный контекст. */
export function openTelegram(url: string) {
  const app = webApp();
  if (app?.openTelegramLink) app.openTelegramLink(url);
  else if (app?.openLink) app.openLink(url);
  else window.open(url, '_blank', 'noopener,noreferrer');
}

/** Subscribe to a Telegram client event; returns the unsubscribe. Outside Telegram — a no-op. */
export function onTelegramEvent(evt: string, cb: () => void): () => void {
  const app = webApp();
  try {
    app?.onEvent?.(evt, cb);
  } catch {
    return () => {};
  }
  return () => {
    try { app?.offEvent?.(evt, cb); } catch { /* an old client without offEvent */ }
  };
}

/* ── Permission for the bot to message the user (КТ-7 С2) ──

   `requestWriteAccess` (Bot API 6.9+) shows Telegram's own «allow the bot to message
   you?» prompt. Its answer is NOT the truth — only a reason to re-read the profile:
   the truth is `Me.can_message`, which the server sets when Telegram delivers
   `write_access_allowed` to the webhook (КТ-7 С1). Called only on a press, never when
   a screen opens. */

export type WriteAccessAnswer = 'allowed' | 'refused' | 'unavailable' | 'timeout';

/** No callback this long → 'timeout': the screen stops waiting; a late answer is still handled. */
export const WRITE_ACCESS_TIMEOUT_MS = 15_000;

/* Telegram's request in flight. Cleared ONLY by Telegram's callback or by an exception,
   never by our timer (КТ-7 поправки 05, С2): the SDK keeps its own «already requested»
   lock until the answer comes. While it is set, nobody calls the method a second time —
   a repeated ask joins this one. */
let writeAccessRequest: Promise<boolean> | null = null;

/** Can this client ask at all. No call is made: no `isVersionAtLeast`, a version below 6.9
 *  or no method → false. */
export function canAskWriteAccess(): boolean {
  const app = webApp();
  if (!app || typeof app.isVersionAtLeast !== 'function' || typeof app.requestWriteAccess !== 'function') return false;
  try {
    return app.isVersionAtLeast('6.9') === true;
  } catch {
    return false;
  }
}

/**
 * Ask Telegram to let the bot message the user. Never throws:
 *   · 'unavailable' — the client can't ask (see canAskWriteAccess) or the call threw;
 *   · 'allowed' / 'refused' — Telegram's answer;
 *   · 'timeout' — no answer in `timeoutMs`. If Telegram answers later, `onLateAnswer`
 *     gets it (a late «allowed» is still allowed).
 * ⚠️ Joins a request already in flight instead of calling the method again.
 */
export function askWriteAccess(
  onLateAnswer?: (allowed: boolean) => void,
  timeoutMs: number = WRITE_ACCESS_TIMEOUT_MS,
): Promise<WriteAccessAnswer> {
  let request = writeAccessRequest;
  if (!request) {
    if (!canAskWriteAccess()) return Promise.resolve('unavailable');
    const app = webApp()!;
    const fresh = new Promise<boolean>((resolve, reject) => {
      try {
        app.requestWriteAccess!((allowed) => resolve(allowed === true));
      } catch (e) {
        reject(e);
      }
    });
    // Cleared in a reaction, not inside the callback: a client may call back synchronously,
    // before `fresh` is even assigned — the lock would then stick forever.
    const release = () => { if (writeAccessRequest === fresh) writeAccessRequest = null; };
    fresh.then(release, release);
    writeAccessRequest = fresh;
    request = fresh;
  }
  return new Promise<WriteAccessAnswer>((resolve) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      resolve('timeout');
    }, timeoutMs);
    request.then(
      (allowed) => {
        if (settled) {
          onLateAnswer?.(allowed);
          return;
        }
        settled = true;
        clearTimeout(timer);
        resolve(allowed ? 'allowed' : 'refused');
      },
      () => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve('unavailable');
      },
    );
  });
}

/* ── Окно ── */

/* Безопасные отступы Telegram отдаёт числами и меняет их на лету (свернули
   клавиатуру, повернули телефон). Кладём их в CSS-переменные, чтобы вёрстка
   читала их как обычный env() и не пересчитывалась в JS. */
function applyInsets() {
  const app = webApp();
  const root = document.documentElement;
  const top = app?.contentSafeAreaInset?.top ?? app?.safeAreaInset?.top;
  const bottom = app?.safeAreaInset?.bottom;
  if (typeof top === 'number') root.style.setProperty('--tg-inset-top', `${top}px`);
  if (typeof bottom === 'number') root.style.setProperty('--tg-inset-bottom', `${bottom}px`);
  if (typeof app?.viewportStableHeight === 'number' && app.viewportStableHeight > 0) {
    root.style.setProperty('--tg-viewport', `${app.viewportStableHeight}px`);
  }
}

/* КЛАВИАТУРА НА ANDROID.

   `position: fixed; bottom: 0` прижимает элемент к низу СЛОЯ ВЁРСТКИ, а
   не к низу видимой области. На iOS слой сжимается вместе с клавиатурой
   и всё сходится само; на Android — нет: клавиатура просто ложится
   сверху, и поле ввода вместе с кнопкой отправки оказывается за ней.
   Нажать нельзя, и со стороны это выглядит как «кнопка пропала».

   `visualViewport` — единственное место, где браузер честно говорит,
   сколько у него отняли. Считаем разницу и отдаём вёрстке числом.
   `offsetTop` нужен потому, что Android при открытии клавиатуры ещё и
   сдвигает видимую область вверх. */
function applyKeyboardInset() {
  const vv = window.visualViewport;
  if (!vv) return;
  const hidden = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
  // Порог: мелкие расхождения дают адресная строка и округление
  // масштаба. Меньше 120px клавиатурой не бывает — а дёрганье панели на
  // каждый пиксель заметно сильнее, чем польза от точности.
  document.documentElement.style.setProperty(
    '--kb-inset',
    hidden > 120 ? `${Math.round(hidden)}px` : '0px',
  );
}

/** Вызывать один раз при монтировании. Повторный вызов безвреден. */
export function initTelegram() {
  // Клавиатуру меряем ВСЕГДА, даже вне Telegram: это свойство браузера,
  // а не клиента. Подписка идёт до раннего выхода ниже — иначе обычный
  // Android-браузер остался бы без неё.
  applyKeyboardInset();
  window.visualViewport?.addEventListener('resize', applyKeyboardInset);
  window.visualViewport?.addEventListener('scroll', applyKeyboardInset);

  const app = webApp();
  if (!app) return;
  try {
    app.ready?.();
    app.expand?.();
    // Иначе жест протяжки самого Telegram съедает вертикальную прокрутку
    // внутри шторок — список «залипает» на середине
    app.disableVerticalSwipes?.();
    app.setHeaderColor?.('#061417');
    app.setBackgroundColor?.('#061417');
    document.documentElement.setAttribute('data-tg', app.platform ?? 'tg');
    applyInsets();
    app.onEvent?.('viewportChanged', applyInsets);
    app.onEvent?.('safeAreaChanged', applyInsets);
    app.onEvent?.('contentSafeAreaChanged', applyInsets);
  } catch {
    // Старый клиент без половины API — это всё ещё работающая веб-страница
  }
}
