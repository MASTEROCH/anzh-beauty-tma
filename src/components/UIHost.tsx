import { useEffect } from 'react';
import { closeSheet, closeLightbox, useLightbox, useSheet, useToasts } from '../lib/ui';

export function LightboxHost() {
  const lb = useLightbox();
  useEffect(() => {
    if (!lb) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closeLightbox(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [lb]);
  if (!lb) return null;
  return (
    <div className="lightbox" role="dialog" aria-modal="true" onClick={closeLightbox}>
      <button className="lightbox-close" aria-label="Закрыть" onClick={closeLightbox}>✕</button>
      <img className="lightbox-img" src={lb.src} alt={lb.caption ?? ''} onClick={(e) => e.stopPropagation()} />
      {lb.caption && <div className="lightbox-caption">{lb.caption}</div>}
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
  useEffect(() => {
    if (s) {
      document.body.setAttribute('data-sheet-open', '');
      return () => document.body.removeAttribute('data-sheet-open');
    }
  }, [s]);
  if (!s) return null;
  return (
    <>
      <div className="sheet-overlay" onClick={closeSheet} />
      <div className="sheet sheet-host" role="dialog" aria-modal="true">
        <div className="sheet-handle" onClick={closeSheet} />
        <h3>{s.title}</h3>
        {s.subtitle && <div className="faint" style={{ fontSize: 12, marginBottom: 6 }}>{s.subtitle}</div>}
        <div style={{ marginTop: 12 }}>{s.body}</div>
        {s.actions ? (
          <div className="sheet-actions" style={{ marginTop: 16 }}>{s.actions}</div>
        ) : (
          <div style={{ marginTop: 16 }}>
            <button className="btn btn-ghost btn-block" onClick={closeSheet}>Закрыть</button>
          </div>
        )}
      </div>
    </>
  );
}
