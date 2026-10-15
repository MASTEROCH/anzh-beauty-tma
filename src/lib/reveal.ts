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

export function useReveal<T extends HTMLElement>(deps: unknown[] = []) {
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
        for (const e of entries) {
          const el = e.target as HTMLElement;
          if (e.isIntersecting) {
            const col = items.indexOf(el) % 2;
            el.style.setProperty('--reveal-delay', `${col * 70}ms`);
            el.classList.add('in');
          } else if (e.boundingClientRect.top > 0) {
            // Снимаем только у тех, кто ушёл ВНИЗ за край: элемент, уехавший
            // вверх, человек уже видел — пересобирать его при возврате значит
            // моргать содержимым, которое никуда не девалось
            el.classList.remove('in');
          }
        }
      },
      { rootMargin: '0px 0px -12% 0px', threshold: 0.12 },
    );

    items.forEach((el) => io.observe(el));
    return () => io.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return ref;
}
