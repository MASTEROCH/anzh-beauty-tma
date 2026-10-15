import { useEffect, useRef, useState } from 'react';
import { closeSheet, closeLightbox, useLightbox, useSheet, useToasts, type SheetContent } from '../lib/ui';
import { pushOverlay } from '../lib/gestures';
import { tap } from '../lib/haptics';
import { getLang } from '../lib/i18n';

const closeWord = () => (getLang() === 'en' ? 'Close' : 'Закрыть');

export function LightboxHost() {
  const lb = useLightbox();
  const open = !!lb;
  const closeRef = useRef<HTMLButtonElement>(null);
  const items = lb?.items;
  const [i, setI] = useState(0);
  const [dx, setDx] = useState(0);
  const drag = useRef<{ x: number; y: number; moved: boolean } | null>(null);
  /* Отпускание после свайпа браузер досылает кликом по фону — он не должен закрыть просмотр */
  const swiped = useRef(false);
  const many = !!items && items.length > 1;
  const dxRef = useRef(0);
  const boxRef = useRef<HTMLDivElement>(null);
  /* Обработчики меняются каждый рендер (i, items) — слушатели держат ссылку
     на свежие через ref, а вешаются один раз на открытие (passive: false,
     иначе preventDefault в touchmove игнорируется). */
  const touch = useRef<{ start: (x: number, y: number) => void; move: (x: number, y: number) => boolean; end: () => void } | null>(null);
  useEffect(() => {
    const el = boxRef.current;
    if (!open || !el) return;
    const ts = (e: TouchEvent) => { if (e.touches.length === 1) touch.current?.start(e.touches[0].clientX, e.touches[0].clientY); };
    const tm = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      if (touch.current?.move(e.touches[0].clientX, e.touches[0].clientY) && e.cancelable) e.preventDefault();
    };
    const te = () => touch.current?.end();
    el.addEventListener('touchstart', ts, { passive: true });
    el.addEventListener('touchmove', tm, { passive: false });
    el.addEventListener('touchend', te);
    el.addEventListener('touchcancel', te);
    return () => {
      el.removeEventListener('touchstart', ts);
      el.removeEventListener('touchmove', tm);
      el.removeEventListener('touchend', te);
      el.removeEventListener('touchcancel', te);
    };
  }, [open]);

  // Новый показ — с того фото, на которое нажали
  useEffect(() => { setI(lb?.index ?? 0); setDx(0); }, [lb]);

  /* K13 (F11): on open the focus goes to "Close" (a keyboard or screen-reader user lands inside
     the dialog, Esc and Enter both close it); on close it returns to what opened the view. */
  useEffect(() => {
    if (!open) return;
    const back = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeRef.current?.focus({ preventScroll: true });
    return () => { if (back?.isConnected) back.focus({ preventScroll: true }); };
  }, [open]);

  const go = (step: number) => {
    if (!items) return;
    setI((cur) => {
      const n = cur + step;
      if (n < 0 || n >= items.length) return cur;
      tap();
      return n;
    });
  };

  /* Зависимость — факт открытости, как у SheetHost ниже: смена фото в уже
     открытом просмотре не должна снимать и заново ставить запись истории
     (это та же гонка шторок — лишний свой history.back() в полёте). */
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeLightbox();
      if (e.key === 'ArrowRight') go(1);
      if (e.key === 'ArrowLeft') go(-1);
    };
    window.addEventListener('keydown', onKey);
    // Системная «назад» закрывает просмотр фото, а не всё приложение
    const unregister = pushOverlay(closeLightbox);
    return () => { window.removeEventListener('keydown', onKey); unregister(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, items]);
  if (!lb) return null;
  const cur = items ? items[i] ?? lb : lb;
  /* The dialog is named by the caption; the picture's alt only when it says something else —
     the same words twice made a screen reader read them twice (K13, F11). */
  const name = cur.caption ?? cur.alt ?? 'Фото';
  const alt = cur.alt && cur.alt !== cur.caption ? cur.alt : '';

  /* Свайп: фото едет за пальцем; дальше 56 px — соседнее. У края ряда —
     резина (треть хода), чтобы было видно, что дальше фото нет.

     Палец — TOUCH-события с preventDefault на горизонтали (Роч 16.10:
     «свайпы влево-вправо не работают»): во WebView iOS/Telegram pointer-жест
     по горизонтали перехватывала система и присылала pointercancel — фото
     не ехало. Мышь (десктоп, превью) — pointer-события, как раньше. */
  const start = (x: number, y: number) => { if (many) drag.current = { x, y, moved: false }; };
  const move = (x: number, y: number): boolean => {
    const d = drag.current;
    if (!d || !items) return false;
    const mx = x - d.x;
    if (!d.moved && Math.abs(mx) < 8) return false;
    if (!d.moved && Math.abs(y - d.y) > Math.abs(mx)) { drag.current = null; return false; }
    d.moved = true;
    const edge = (mx > 0 && i === 0) || (mx < 0 && i === items.length - 1);
    const v = edge ? mx / 3 : mx;
    dxRef.current = v;
    setDx(v);
    return true;
  };
  const end = () => {
    const d = drag.current;
    drag.current = null;
    if (!d?.moved) return;
    swiped.current = true;
    window.setTimeout(() => { swiped.current = false; }, 50);
    const v = dxRef.current;
    dxRef.current = 0;
    if (v < -56) go(1);
    else if (v > 56) go(-1);
    setDx(0);
  };
  touch.current = { start, move, end };
  const onDown = (e: React.PointerEvent) => { if (e.pointerType === 'mouse') start(e.clientX, e.clientY); };
  const onMove = (e: React.PointerEvent) => { if (e.pointerType === 'mouse') move(e.clientX, e.clientY); };
  const onUp = (e: React.PointerEvent) => { if (e.pointerType === 'mouse') end(); };

  return (
    <div
      className="lightbox"
      role="dialog"
      aria-modal="true"
      aria-label={name}
      onClick={() => { if (!swiped.current) closeLightbox(); }}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={(e) => { if (e.pointerType === 'mouse') { drag.current = null; dxRef.current = 0; setDx(0); } }}
      ref={boxRef}
    >
      <button ref={closeRef} className="lightbox-close" aria-label={closeWord()} onClick={closeLightbox}>✕</button>
      {many && <div className="lightbox-count" aria-live="polite">{i + 1} / {items!.length}</div>}
      <img
        key={cur.src}
        className={`lightbox-img${dx ? ' dragging' : ''}`}
        src={cur.src}
        alt={alt}
        draggable={false}
        style={dx ? { transform: `translate3d(${dx}px,0,0)` } : undefined}
        onClick={(e) => e.stopPropagation()}
      />
      {cur.caption && <div className="lightbox-caption">{cur.caption}</div>}
      {cur.note && <div className="lightbox-note" data-testid="lightbox-note">{cur.note}</div>}
      {many && (
        <>
          <button className="lightbox-arrow prev" aria-label={getLang() === 'en' ? 'Previous photo' : 'Предыдущее фото'} disabled={i === 0} onClick={(e) => { e.stopPropagation(); go(-1); }}>‹</button>
          <button className="lightbox-arrow next" aria-label={getLang() === 'en' ? 'Next photo' : 'Следующее фото'} disabled={i === items!.length - 1} onClick={(e) => { e.stopPropagation(); go(1); }}>›</button>
        </>
      )}
    </div>
  );
}


export function ToastHost() {
  const items = useToasts();
  if (items.length === 0) return null;
  return (
    <div className="toast-host" role="status" aria-live="polite">
      {items.map((t) => (
        <div key={t.id} className={`toast toast-${t.kind ?? 'info'}`}>
          <span>{t.text}</span>
        </div>
      ))}
    </div>
  );
}

export function SheetHost() {
  const s = useSheet();
  const open = !!s;

  /* Зависимость — ФАКТ открытости, а не конкретное содержимое. Раньше здесь
     стоял [s]: при замене одной шторки другой React сначала чистил эффект
     старой, а тот снимал свою запись истории через history.back(); popstate
     приходил асинхронно и закрывал уже НОВУЮ шторку. Из-за этого по всему
     коду приходилось писать closeSheet() + setTimeout вместо простого
     openSheet. Одна запись в истории на всё время, пока шторка открыта, —
     и замена содержимого больше не трогает историю вообще. */
  useEffect(() => {
    if (!open) return;
    document.body.setAttribute('data-sheet-open', '');
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closeSheet(); };
    window.addEventListener('keydown', onKey);
    // Третий способ закрытия: системная «назад». Без него на Android она
    // закрывает всё приложение вместе с несохранённой формой.
    const unregister = pushOverlay(closeSheet);
    return () => {
      document.body.removeAttribute('data-sheet-open');
      window.removeEventListener('keydown', onKey);
      unregister();
    };
  }, [open]);

  if (!s) return null;
  return (
    <>
      <div className="sheet-overlay" onClick={closeSheet} />
      <DraggableSheet content={s} />
    </>
  );
}

/* Шторка тянется вниз. Закрывается по расстоянию ИЛИ по скорости — короткий
   резкий свайп должен закрывать так же, как медленное долгое движение; без
   второго условия жест ощущается тугим. Вверх — резиновое сопротивление. */
function DraggableSheet({ content: s }: { content: NonNullable<SheetContent> }) {
  const [dy, setDy] = useState(0);
  const [dragging, setDragging] = useState(false);
  const start = useRef<{ y: number; t: number } | null>(null);
  const bodyRef = useRef<HTMLDivElement>(null);

  const onDown = (e: React.PointerEvent) => {
    // Тянем только за шапку: иначе жест отбирает прокрутку у содержимого
    start.current = { y: e.clientY, t: Date.now() };
    setDragging(true);
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onMove = (e: React.PointerEvent) => {
    if (!start.current) return;
    const raw = e.clientY - start.current.y;
    setDy(raw > 0 ? raw : raw * 0.26);
  };
  const onUp = () => {
    const st = start.current;
    start.current = null;
    setDragging(false);
    if (!st) return;
    const dt = Math.max(1, Date.now() - st.t);
    const velocity = dy / dt;
    if (dy > 92 || velocity > 0.55) closeSheet();
    else setDy(0);
  };

  return (
    <div
      className={`sheet sheet-frame${dragging ? ' dragging' : ''}`}
      role="dialog"
      aria-modal="true"
      aria-label={s.title}
      style={dy !== 0 ? { transform: `translateY(${dy}px)` } : undefined}
    >
      <div
        className="sheet-grab"
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
      >
        <div className="sheet-handle" onClick={closeSheet} />
      </div>
        {/* Крестик липкий: у длинной шторки он не должен уезжать со скроллом */}
        <button className="sheet-close" onClick={closeSheet} aria-label={closeWord()}>
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
            <path d="M6 6l12 12M6 18L18 6" />
          </svg>
        </button>
      {/* Прокручивается только содержимое; кнопки — подвал, всегда на виду
          (Роч 16.10: на iPhone кнопка уезжала вниз прокрутки, под ней — «дыра»).
          Каскад: шторка приезжает, содержимое догоняет волной. */}
      <div className="sheet-scroll">
        <div className="sheet-cascade" ref={bodyRef}>
          <h3>{s.title}</h3>
          {s.subtitle && <div className="faint" style={{ fontSize: 12, marginBottom: 6 }}>{s.subtitle}</div>}
          <div style={{ marginTop: 12 }}>{s.body}</div>
        </div>
      </div>
      <div className="sheet-actions">
        {s.actions ?? <button className="btn btn-quiet btn-block" onClick={closeSheet}>{closeWord()}</button>}
      </div>
    </div>
  );
}
