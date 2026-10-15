import { useEffect, useRef } from 'react';

// Появление при прокрутке. CSS-анимация с `both` отыгрывает ОДИН раз на
// монтировании — то есть для всего, что ниже первого экрана, она успевает
// закончиться, пока человек до неё не доскроллил, и он видит статичную
// сетку. Наблюдатель включает анимацию в тот момент, когда ряд реально
// входит в кадр, и снимает её, когда ряд ушёл, — тогда появление работает
// и вниз, и вверх.
//
// Ступенька задержки — по КОЛОНКЕ, а не по индексу в списке: иначе на
// длинной сетке последняя плитка ждёт своей очереди полсекунды после того,
// как уже попала в кадр.

export function useReveal<T extends HTMLElement>(deps: unknown[] = [], opts: { once?: boolean } = {}) {
  const ref = useRef<T>(null);

  useEffect(() => {
    const root = ref.current;
    if (!root) return;

    const items = Array.from(root.children) as HTMLElement[];

    // Движение выключено в системе — показываем сразу, без наблюдателя
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      items.forEach((el) => el.classList.add('in'));
      return;
    }

    const io = new IntersectionObserver(
      (entries) => {
        // Ступенька внутри одной «пачки» вошедших (PEONIA): +70 мс на
        // карточку, правая колонка ещё +90 — ряд поднимается волной
        let k = 0;
        for (const e of entries) {
          const el = e.target as HTMLElement;
          if (e.isIntersecting) {
            if (el.classList.contains('in')) continue;
            const col = items.indexOf(el) % 2;
            el.style.setProperty('--reveal-delay', `${Math.min(k++, 5) * 70 + col * 90}ms`);
            el.classList.add('in');
            if (opts.once) io.unobserve(el);
          } else if (!opts.once && e.boundingClientRect.top > 0) {
            // Снимаем только у тех, кто ушёл ВНИЗ за край: элемент, уехавший
            // вверх, человек уже видел — пересобирать его при возврате значит
            // моргать содержимым, которое никуда не девалось
            el.classList.remove('in');
          }
        }
      },
      { rootMargin: '0px 0px -12% 0px', threshold: 0.12 },
    );

    /* 🚨 Сначала СВОЙ замер, потом наблюдатель.
       IntersectionObserver сообщает о пересечении в своём кадре, и на
       мгновенном переходе — восстановленная позиция прокрутки, переход по
       якорю, программный scrollIntoView — первый отчёт приходит уже после
       того, как человек посмотрел на экран. Он видел пустую сетку: плитки
       лежат с opacity 0 и ждут класса. Замерить то, что уже в кадре, можно
       сразу — и это дешевле, чем надеяться на порядок событий. */
    const vh = window.innerHeight || document.documentElement.clientHeight;
    items.forEach((el, i) => {
      const r = el.getBoundingClientRect();
      if (r.top < vh * 0.88 && r.bottom > 0) {
        el.style.setProperty('--reveal-delay', `${(i % 2) * 70}ms`);
        el.classList.add('in');
      }
    });

    items.forEach((el) => io.observe(el));
    return () => io.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return ref;
}
