import { useEffect } from 'react';
import { closeSheet, useSheet, useToasts } from '../lib/ui';

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
