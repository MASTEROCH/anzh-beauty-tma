import { useEffect, useState } from 'react';

// Прокручивает человек или читает.
//
// Плавающий шар ассистента перекрывает то, что под ним, — на 320px это
// оказывается сердечко избранного у соседней карточки. Уменьшать шар
// бессмысленно: мишень станет хуже, а перекрытие останется. Правильнее
// убирать его на время прокрутки: пока человек листает, ассистент ему
// не нужен, а как только остановился — возвращается на место.
//
// Слушаем в фазе захвата: прокручивается вложенный .screen, а не window,
// и обычный слушатель на документе такое событие не увидит.

export function useScrolling(idleMs = 420): boolean {
  const [scrolling, setScrolling] = useState(false);

  useEffect(() => {
    let timer: number | undefined;
    const onScroll = () => {
      setScrolling(true);
      if (timer) window.clearTimeout(timer);
      timer = window.setTimeout(() => setScrolling(false), idleMs);
    };
    document.addEventListener('scroll', onScroll, { capture: true, passive: true });
    return () => {
      document.removeEventListener('scroll', onScroll, { capture: true });
      if (timer) window.clearTimeout(timer);
    };
  }, [idleMs]);

  return scrolling;
}
