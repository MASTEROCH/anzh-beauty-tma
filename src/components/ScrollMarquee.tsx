import { useEffect, useRef, type ReactNode } from 'react';

// Бегущая строка, которую можно взять пальцем.
//
// Была чистой CSS-анимацией (`transform: translateX` по кругу): красиво, но
// строка не подчинялась пальцу — ни остановить, ни потянуть назад, ни
// дочитать то, что уехало. Владелец: «не могу скроллить пальцем бегущую
// строку — почини!».
//
// Теперь это НАСТОЯЩИЙ горизонтальный скролл, который сам медленно едет:
//   · палец берёт строку — автопрокрутка замолкает на всё время касания и
//     инерции, и возвращается через 1.8 с покоя;
//   · бесконечная петля без шва: содержимое стоит три раза подряд, строка
//     живёт в средней копии и тихо переносится на ширину одной копии, когда
//     уходит за её пределы. Содержимое копий одинаково, поэтому перенос
//     невидим;
//   · ПЕРЕНОС ДЕЛАЕТСЯ ТОЛЬКО В ПОКОЕ. Сдвиг scrollLeft во время инерции iOS
//     обрывает её — строка встала бы как вкопанная посреди броска. Пока
//     человек тянет и пока она докатывается, переносим не мы, а позже;
//   · скорость 26 px/с — как была у CSS-версии (26 с на круг);
//   · не крутится вне экрана и на скрытой вкладке — никакого холостого rAF;
//   · «уменьшить движение»: автопрокрутки нет вовсе, остаётся ручной скролл
//     и ОДНА копия — три копии были бы ненужным шумом для читалки.

const IDLE_MS = 1800;

export function ScrollMarquee({
  children,
  label,
  testid,
  speed = 26,
  className = '',
}: {
  children: ReactNode;
  label?: string;
  testid?: string;
  /** Пикселей в секунду */
  speed?: number;
  className?: string;
}) {
  const box = useRef<HTMLDivElement>(null);
  const reduced = typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const copies = reduced ? 1 : 3;

  useEffect(() => {
    const el = box.current;
    if (!el || reduced) return;

    let w = 0;                 // ширина одной копии
    let pos = 0;               // собственная дробная позиция — scrollLeft округляется
    let last = 0;              // метка прошлого кадра
    let raf = 0;
    let visible = true;
    let touching = false;
    let idleAt = 0;            // когда можно возобновить автопрокрутку

    const measure = () => {
      const track = el.firstElementChild as HTMLElement | null;
      w = track ? track.scrollWidth / copies : 0;
    };

    const settle = () => {
      // Живём в средней копии: [w, 2w). Перенос — только когда строка в покое
      if (w <= 0) return;
      if (el.scrollLeft < w * 0.5) el.scrollLeft += w;
      else if (el.scrollLeft >= w * 1.5) el.scrollLeft -= w;
      pos = el.scrollLeft;
    };

    const poke = () => { idleAt = performance.now() + IDLE_MS; };
    const onTouchStart = () => { touching = true; poke(); };
    const onTouchEnd = () => { touching = false; poke(); };
    const onScroll = () => {
      // Любое движение, которое сделали не мы, — это человек или его инерция
      if (Math.abs(el.scrollLeft - pos) > 1.5) { pos = el.scrollLeft; poke(); }
    };

    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      const dt = Math.min(0.05, (now - last) / 1000 || 0);
      last = now;
      if (!visible || document.hidden) return;
      if (touching || now < idleAt) return;
      if (w <= 0) { measure(); return; }
      pos += speed * dt;
      if (pos >= w * 1.5) pos -= w;   // мы одни тут — переносим без оглядки
      el.scrollLeft = pos;
    };

    measure();
    el.scrollLeft = w;               // стартуем в средней копии: влево тоже есть куда
    pos = el.scrollLeft;
    poke();

    const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; }, { threshold: 0.01 });
    io.observe(el);
    const ro = new ResizeObserver(() => { const keep = w ? el.scrollLeft / w : 1; measure(); el.scrollLeft = keep * w; pos = el.scrollLeft; });
    ro.observe(el);
    // Шрифты встают позже первого кадра и меняют ширину копии
    document.fonts?.ready.then(() => { measure(); el.scrollLeft = w; pos = el.scrollLeft; }).catch(() => {});

    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchend', onTouchEnd, { passive: true });
    el.addEventListener('touchcancel', onTouchEnd, { passive: true });
    el.addEventListener('scroll', onScroll, { passive: true });
    // Перенос в покое — после окончания прокрутки (scrollend, а где его нет — по таймеру)
    let endTimer = 0;
    const onEnd = () => { window.clearTimeout(endTimer); endTimer = window.setTimeout(() => { if (!touching) settle(); }, 160); };
    el.addEventListener('scroll', onEnd, { passive: true });

    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(endTimer);
      io.disconnect();
      ro.disconnect();
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchend', onTouchEnd);
      el.removeEventListener('touchcancel', onTouchEnd);
      el.removeEventListener('scroll', onScroll);
      el.removeEventListener('scroll', onEnd);
    };
  }, [reduced, copies, speed]);

  return (
    <div ref={box} className={`trust-row marquee marquee--scroll ${className}`.trim()} aria-label={label} data-testid={testid}>
      <div className="marquee-track">
        {Array.from({ length: copies }, (_, i) => (
          <div className="marquee-group" key={i} aria-hidden={i === 0 ? undefined : true}>
            {children}
          </div>
        ))}
      </div>
    </div>
  );
}
