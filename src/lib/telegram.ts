/* ════════════════════════════════════════════════════════════════════
   Telegram Mini App bridge.
   Everything degrades to a no-op in a plain browser, so the prototype
   keeps working on localhost / in screenshot tests.
   ════════════════════════════════════════════════════════════════════ */

type HapticStyle = 'light' | 'medium' | 'heavy' | 'rigid' | 'soft';
type NotifyType = 'error' | 'success' | 'warning';

type TgWebApp = {
  ready?: () => void;
  expand?: () => void;
  close?: () => void;
  disableVerticalSwipes?: () => void;
  setHeaderColor?: (c: string) => void;
  setBackgroundColor?: (c: string) => void;
  enableClosingConfirmation?: () => void;
  openLink?: (url: string, opts?: { try_instant_view?: boolean }) => void;
  openTelegramLink?: (url: string) => void;
  shareToStory?: (media: string, params?: { text?: string }) => void;
  colorScheme?: 'light' | 'dark';
  viewportStableHeight?: number;
  safeAreaInset?: { top: number; bottom: number; left: number; right: number };
  contentSafeAreaInset?: { top: number; bottom: number; left: number; right: number };
  initDataUnsafe?: { user?: { first_name?: string; last_name?: string; username?: string; language_code?: string } };
  version?: string;
  platform?: string;
  onEvent?: (evt: string, cb: () => void) => void;
  offEvent?: (evt: string, cb: () => void) => void;
  BackButton?: { show: () => void; hide: () => void; onClick: (cb: () => void) => void; offClick: (cb: () => void) => void };
  HapticFeedback?: {
    impactOccurred: (style: HapticStyle) => void;
    notificationOccurred: (type: NotifyType) => void;
    selectionChanged: () => void;
  };
};

function wa(): TgWebApp | undefined {
  if (typeof window === 'undefined') return undefined;
  return (window as unknown as { Telegram?: { WebApp?: TgWebApp } }).Telegram?.WebApp;
}

export function isTelegram(): boolean {
  return Boolean(wa()?.initDataUnsafe);
}

export function tgPlatform(): string {
  return wa()?.platform ?? 'web';
}

/** First name from initData — falls back to `undefined` outside Telegram. */
export function tgUserName(): string | undefined {
  const n = wa()?.initDataUnsafe?.user?.first_name?.trim();
  return n || undefined;
}

/** `ru` if the Telegram client is Russian-speaking, otherwise `en`. */
export function tgLang(): 'ru' | 'en' | undefined {
  const code = wa()?.initDataUnsafe?.user?.language_code;
  if (!code) return undefined;
  return code.startsWith('ru') ? 'ru' : 'en';
}

/* ── Haptics ─────────────────────────────────────────────── */
export const haptic = {
  tap(style: HapticStyle = 'light') {
    try { wa()?.HapticFeedback?.impactOccurred(style); } catch { /* older client */ }
  },
  select() {
    try { wa()?.HapticFeedback?.selectionChanged(); } catch { /* older client */ }
  },
  notify(type: NotifyType = 'success') {
    try { wa()?.HapticFeedback?.notificationOccurred(type); } catch { /* older client */ }
  },
};

/* Selector → haptic strength. One delegated listener beats sprinkling
   haptic() calls through every onClick in the app. */
const HAPTIC_MAP: Array<{ sel: string; run: () => void }> = [
  { sel: '.btn-primary, [data-bottom-cta]', run: () => haptic.tap('medium') },
  { sel: '.nav-item', run: () => haptic.select() },
  { sel: '.slot, .date-pill, .chip, .seg-btn, .set-row', run: () => haptic.select() },
  { sel: '.fav-btn', run: () => haptic.tap('soft') },
  { sel: 'button', run: () => haptic.tap('light') },
];

export function installGlobalHaptics() {
  if (typeof document === 'undefined') return () => {};
  const onDown = (e: Event) => {
    const el = (e.target as HTMLElement | null)?.closest?.('button, a, [role="button"]');
    if (!el || (el as HTMLButtonElement).disabled) return;
    for (const { sel, run } of HAPTIC_MAP) {
      if (el.matches(sel)) { run(); return; }
    }
  };
  document.addEventListener('pointerdown', onDown, { capture: true, passive: true });
  return () => document.removeEventListener('pointerdown', onDown, { capture: true });
}

/* ── Back button ─────────────────────────────────────────── */
let backHandler: (() => void) | null = null;

function runBack() {
  backHandler?.();
}

/** Show the native BackButton and route it to `handler`; `null` hides it. */
export function setBackButton(handler: (() => void) | null) {
  const bb = wa()?.BackButton;
  backHandler = handler;
  if (!bb) return;
  if (handler) {
    bb.onClick(runBack);
    bb.show();
  } else {
    bb.offClick(runBack);
    bb.hide();
  }
}

/* ── Links ───────────────────────────────────────────────── */
/** Opens outside the Mini App — Telegram's in-app browser when available. */
export function openExternal(url: string) {
  const app = wa();
  if (app?.openLink) app.openLink(url);
  else window.open(url, '_blank', 'noopener');
}

/* ── Viewport / safe area ────────────────────────────────── */
function applyInsets() {
  const app = wa();
  const root = document.documentElement;
  const top = app?.contentSafeAreaInset?.top ?? app?.safeAreaInset?.top;
  const bottom = app?.safeAreaInset?.bottom;
  if (typeof top === 'number') root.style.setProperty('--tg-inset-top', `${top}px`);
  if (typeof bottom === 'number') root.style.setProperty('--tg-inset-bottom', `${bottom}px`);
  if (typeof app?.viewportStableHeight === 'number' && app.viewportStableHeight > 0) {
    root.style.setProperty('--tg-viewport', `${app.viewportStableHeight}px`);
  }
}

/** Call once on mount. Idempotent. */
export function initTelegram() {
  const app = wa();
  if (!app) return;
  try {
    app.ready?.();
    app.expand?.();
    app.disableVerticalSwipes?.();       // stop the sheet-drag from eating vertical scroll
    app.setHeaderColor?.('#061417');
    app.setBackgroundColor?.('#061417');
    document.documentElement.setAttribute('data-tg', app.platform ?? 'tg');
    applyInsets();
    app.onEvent?.('viewportChanged', applyInsets);
    app.onEvent?.('safeAreaChanged', applyInsets);
    app.onEvent?.('contentSafeAreaChanged', applyInsets);
  } catch {
    /* an old client missing half the API is still a usable web page */
  }
}
