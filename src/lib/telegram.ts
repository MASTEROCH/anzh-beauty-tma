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
  onEvent?: (evt: string, cb: () => void) => void;
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

/* Проверяем ПОДПИСАННУЮ строку, а не наличие объекта: скрипт
   telegram-web-app.js создаёт `initDataUnsafe` даже в обычном браузере —
   пустым объектом, который в JS истинный. На этом легко построить проверку,
   которая всегда возвращает true. */
export const isTelegram = () => Boolean(webApp()?.initData) || Boolean(webApp()?.initDataUnsafe?.user);

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

/** Вызывать один раз при монтировании. Повторный вызов безвреден. */
export function initTelegram() {
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
