import { useEffect, useRef, useState } from 'react';

// Текст, не влезший в контейнер, не обрезается «…» намертво: едет влево,
// замирает, едет обратно, замирает. Многоточие прячет ровно то, по чему
// выбирают — «Контурная пластика губ» и «Контурная пластика подбородка» на
// карточке выглядят одинаково.
//
// Условия из канона ROCH, без которых лечение хуже болезни:
//  · едет только если реально не влезло (порог 8px — иначе нервный тик);
//  · паузы на концах, без них читается как брак;
//  · prefers-reduced-motion → обратно многоточие;
//  · 🚨 наблюдатель ОДИН на все строки: своя ResizeObserver на каждую при
//    сотне карточек глушит часть уведомлений, и треть строк молча остаётся
//    с многоточием — дефект выглядит как «работает через раз».

const THRESHOLD = 8;
const SPEED = 34;      // px/сек
const PAUSE = 1100;    // мс на концах

type Entry = { el: HTMLElement; apply: (overflow: number) => void };
const entries = new Map<HTMLElement, Entry>();
let observer: ResizeObserver | null = null;
let frame = 0;

function measureAll() {
  if (frame) return;
  frame = requestAnimationFrame(() => {
    frame = 0;
    // Замеры пачкой в одном кадре: чтение и запись не чередуются
    const reads: Array<[Entry, number]> = [];
    entries.forEach((entry) => {
      const inner = entry.el.firstElementChild as HTMLElement | null;
      if (!inner) return;
      reads.push([entry, inner.scrollWidth - entry.el.clientWidth]);
    });
    reads.forEach(([entry, overflow]) => entry.apply(overflow));
  });
}

function observe(el: HTMLElement, apply: (overflow: number) => void) {
  if (!observer && typeof ResizeObserver !== 'undefined') {
    observer = new ResizeObserver(measureAll);
  }
  entries.set(el, { el, apply });
  observer?.observe(el);
  measureAll();
  // Шрифты доезжают позже разметки — без пересчёта половина строк меряется
  // системным фолбэком и «влезает», хотя в бренд-шрифте не влезет
  document.fonts?.ready?.then(measureAll).catch(() => {});
  return () => {
    entries.delete(el);
    observer?.unobserve(el);
  };
}

export function PingPong({ children, className }: { children: string; className?: string }) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [overflow, setOverflow] = useState(0);

  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    return observe(el, setOverflow);
  }, [children]);

  const reduced = typeof window !== 'undefined'
    && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const moving = overflow > THRESHOLD && !reduced;
  const duration = moving ? (overflow / SPEED) * 1000 : 0;

  return (
    <div
      ref={boxRef}
      className={['pp', moving ? 'moving' : '', className].filter(Boolean).join(' ')}
      style={moving ? ({
        '--pp-shift': `${-overflow}px`,
        '--pp-travel': `${duration}ms`,
        '--pp-cycle': `${duration * 2 + PAUSE * 2}ms`,
      } as React.CSSProperties) : undefined}
      title={children}
    >
      <span className="pp-inner">{children}</span>
    </div>
  );
}
