import { useEffect, useRef, useState } from 'react';
import { closeSheet, closeLightbox, useLightbox, useSheet, useToasts, type SheetContent } from '../lib/ui';
import { pushOverlay } from '../lib/gestures';

export function LightboxHost() {
  const lb = useLightbox();
  const open = !!lb;
  const closeRef = useRef<HTMLButtonElement>(null);
  /* K13 (F11): on open the focus goes to "Close" (a keyboard or screen-reader user lands inside
     the dialog, Esc and Enter both close it); on close it returns to what opened the view. */
  useEffect(() => {
    if (!open) return;
    const back = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeRef.current?.focus({ preventScroll: true });
    return () => { if (back?.isConnected) back.focus({ preventScroll: true }); };
  }, [open]);
  /* Зависимость — факт открытости, как у SheetHost ниже: смена фото в уже
     открытом просмотре не должна снимать и заново ставить запись истории
     (это та же гонка шторок — лишний свой history.back() в полёте). */
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closeLightbox(); };
    window.addEventListener('keydown', onKey);
    // Системная «назад» закрывает просмотр фото, а не всё приложение
    const unregister = pushOverlay(closeLightbox);
    return () => { window.removeEventListener('keydown', onKey); unregister(); };
  }, [open]);
  if (!lb) return null;
  /* The dialog is named by the caption; the picture's alt only when it says something else —
     the same words twice made a screen reader read them twice (K13, F11). */
  const name = lb.caption ?? lb.alt ?? 'Фото';
  const alt = lb.alt && lb.alt !== lb.caption ? lb.alt : '';
  return (
    <div className="lightbox" role="dialog" aria-modal="true" aria-label={name} onClick={closeLightbox}>
      <button ref={closeRef} className="lightbox-close" aria-label="Закрыть" onClick={closeLightbox}>✕</button>
      <img className="lightbox-img" src={lb.src} alt={alt} onClick={(e) => e.stopPropagation()} />
      {lb.caption && <div className="lightbox-caption">{lb.caption}</div>}
      {lb.note && <div className="lightbox-note" data-testid="lightbox-note">{lb.note}</div>}
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
      className={`sheet sheet-host${dragging ? ' dragging' : ''}`}
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
        <button className="sheet-close" onClick={closeSheet} aria-label="Закрыть">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
            <path d="M6 6l12 12M6 18L18 6" />
          </svg>
        </button>
      {/* Каскад: шторка приезжает, содержимое догоняет волной */}
      <div className="sheet-cascade" ref={bodyRef}>
        <h3>{s.title}</h3>
        {s.subtitle && <div className="faint" style={{ fontSize: 12, marginBottom: 6 }}>{s.subtitle}</div>}
        <div style={{ marginTop: 12 }}>{s.body}</div>
        {s.actions ? (
          <div className="sheet-actions mt-md">{s.actions}</div>
        ) : (
          <div style={{ marginTop: 16 }}>
            <button className="btn btn-quiet btn-block" onClick={closeSheet}>Закрыть</button>
          </div>
        )}
      </div>
    </div>
  );
}
