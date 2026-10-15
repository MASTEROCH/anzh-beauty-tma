import { useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

/* Главная кнопка формы — в подвал шторки, а не в конец прокрутки
   (Роч 16.10: кнопка уезжала вниз, в подвале висело «Закрыть»).
   Шторка открывается с `actions: <SheetSlot name="…" />`, форма в теле
   рендерит кнопку через <SlotPortal name="…">. Пока слот не найден —
   кнопка остаётся в теле, ничего не теряется. */
export function SheetSlot({ name }: { name: string }) {
  return <div className="sheet-slot" data-sheet-slot={name} />;
}

export function SlotPortal({ name, children }: { name: string; children: ReactNode }) {
  const [el, setEl] = useState<Element | null>(null);
  useEffect(() => {
    const find = () => document.querySelector(`[data-sheet-slot="${name}"]`);
    const node = find();
    if (node) { setEl(node); return; }
    const t = window.setTimeout(() => setEl(find()), 0);
    return () => window.clearTimeout(t);
  }, [name]);
  return el ? createPortal(children, el) : <>{children}</>;
}
