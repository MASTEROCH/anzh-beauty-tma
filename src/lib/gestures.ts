// Краевой свайп и системная «назад» — два жеста, которые молча закрывают
// мини-апп вместе с несохранённым вводом. Канон ROCH: в iOS WebKit (а это
// встроенный браузер Telegram и любой WKWebView) свайп от края = «назад»,
// то есть для веб-страницы «закрыть». Официального API нет, работает только
// перехват первого горизонтального touchmove в краевой зоне.

const EDGE = 26; // системная зона iOS ~20px, берём с запасом

function scrollableX(el: Element | null): boolean {
  for (let n = el; n && n !== document.body; n = n.parentElement) {
    try {
      if (n.scrollWidth - n.clientWidth > 4) {
        const ov = getComputedStyle(n).overflowX;
        if (ov === 'auto' || ov === 'scroll') return true;
      }
    } catch { /* ignore */ }
  }
  return false;
}

export function installEdgeSwipeGuard(): () => void {
  let st: { x: number; y: number; armed: boolean } | null = null;

  const onStart = (e: TouchEvent) => {
    st = null;
    if (e.touches.length !== 1) return;
    const t = e.touches[0];
    const w = window.innerWidth;
    if (t.clientX > EDGE && t.clientX < w - EDGE) return;   // не край — не наше дело
    if (scrollableX(e.target as Element)) return;           // лента у края должна листаться
    st = { x: t.clientX, y: t.clientY, armed: true };
  };

  const onMove = (e: TouchEvent) => {
    if (!st || !st.armed || e.touches.length !== 1) return;
    const t = e.touches[0];
    const dx = t.clientX - st.x;
    const dy = t.clientY - st.y;
    if (Math.abs(dx) < 4 && Math.abs(dy) < 4) return;
    if (Math.abs(dy) > Math.abs(dx)) { st.armed = false; return; } // вертикальная прокрутка законна
    if (e.cancelable) e.preventDefault();
  };

  const clear = () => { st = null; };

  document.addEventListener('touchstart', onStart, { passive: false });
  document.addEventListener('touchmove', onMove, { passive: false });
  document.addEventListener('touchend', clear, { passive: true });
  document.addEventListener('touchcancel', clear, { passive: true });

  return () => {
    document.removeEventListener('touchstart', onStart);
    document.removeEventListener('touchmove', onMove);
    document.removeEventListener('touchend', clear);
    document.removeEventListener('touchcancel', clear);
  };
}

/* ── Закон модального окна ──
   Любое окно поверх экрана закрывается ТРЕМЯ способами: крестик, тап по
   затемнению и системная «назад». Третий забывают чаще всего: на Android
   аппаратная кнопка есть всегда, и без перехвата она закрывает всё
   приложение. В Telegram BackButton в шапке — ДРУГАЯ кнопка, и обе обязаны
   идти через один общий closeTop(), иначе появится вторая копия порядка
   закрытия. */

type Closer = () => void;
const stack: Array<{ id: number; close: Closer }> = [];
let seq = 0;
let installed = false;

interface TgBackButton {
  show?: () => void;
  hide?: () => void;
  onClick?: (cb: () => void) => void;
  offClick?: (cb: () => void) => void;
}

function backButton(): TgBackButton | undefined {
  if (typeof window === 'undefined') return undefined;
  return (window as unknown as { Telegram?: { WebApp?: { BackButton?: TgBackButton } } })
    .Telegram?.WebApp?.BackButton;
}

/** Закрыть верхнее окно. Единственная точка закрытия для обеих кнопок. */
export function closeTop(): boolean {
  const top = stack.pop();
  if (!top) return false;
  syncBackButton();
  top.close();
  return true;
}

function syncBackButton() {
  const bb = backButton();
  if (!bb) return;
  if (stack.length > 0) bb.show?.();
  else bb.hide?.();
}

function ensureInstalled() {
  if (installed || typeof window === 'undefined') return;
  installed = true;

  window.addEventListener('popstate', () => {
    // Запись в истории уже снята браузером — закрываем без своего history.back()
    const top = stack.pop();
    syncBackButton();
    top?.close();
  });

  backButton()?.onClick?.(() => {
    if (stack.length > 0) {
      // Уходим через popstate, чтобы не рассинхронить историю
      history.back();
    }
  });
}

/** Зарегистрировать открытое окно. Возвращает функцию снятия регистрации. */
export function pushOverlay(close: Closer): () => void {
  ensureInstalled();
  const id = ++seq;
  stack.push({ id, close });
  history.pushState({ overlay: id }, '');
  syncBackButton();

  return () => {
    const idx = stack.findIndex((x) => x.id === id);
    if (idx === -1) return;            // уже снято через popstate/closeTop
    stack.splice(idx, 1);
    syncBackButton();
    // Закрыли изнутри — снимаем свою запись, иначе следующий «назад» уйдёт в пустоту
    history.back();
  };
}

