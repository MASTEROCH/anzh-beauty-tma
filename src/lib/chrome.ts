import { useEffect, useState } from 'react';

// Шапка, таббар и шар ассистента прячутся при прокрутке вниз и возвращаются
// при прокрутке вверх. Контент получает весь экран, а управление — на
// расстоянии одного движения пальцем вверх.
//
// Наивная версия («идём вниз — прячем») дёргается и бесит. Здесь закрыты
// пять ловушек, каждая из которых ломает ощущение:
//
//  1. ДРОЖЬ. Палец никогда не ведёт ровно: микродвижения в 1–2px меняли бы
//     состояние по десять раз в секунду. Копим смещение в одну сторону и
//     переключаемся только после порога.
//  2. ВЕРХ СПИСКА. У самого верха шапка обязана быть видна всегда, иначе
//     человек, вернувшись наверх, видит обрезанный экран без заголовка.
//  3. КОРОТКАЯ СТРАНИЦА. Если прокручивать почти нечего, прятать нечего:
//     панели дёргались бы на пустом месте.
//  4. РЕЗИНКА iOS. На отскоке у края координата уходит за пределы и даёт
//     ложные дельты в обе стороны. Края игнорируем.
//  5. КОНЕЦ СПИСКА. Доскроллив донизу, человек чаще всего хочет действие —
//     там панели показываем принудительно.
//  6. ПУСТОЕ СОБЫТИЕ. scroll приходит и без смещения — и отменял уже
//     принятое решение. Нашлось тестом, глазами такое не поймать.
//
// Возврат быстрее скрытия: «вернуть» — это ответ на намерение, он должен
// быть мгновенным, а уход может быть плавным.

const THRESHOLD = 10;   // сколько пройти в одну сторону, чтобы переключиться
const TOP_ZONE = 72;    // у верха всегда показываем
const MIN_SCROLLABLE = 240; // короче — не прячем вовсе
const BOTTOM_ZONE = 48;

export interface ChromeState {
  /** Панели спрятаны */
  hidden: boolean;
  /** Идёт прокрутка прямо сейчас — для шара ассистента */
  scrolling: boolean;
}

export function useChrome(): ChromeState {
  const [state, setState] = useState<ChromeState>({ hidden: false, scrolling: false });

  useEffect(() => {
    let last = 0;
    let travel = 0;
    let hidden = false;
    let scrolling = false;
    let idleTimer: number | undefined;
    let frame = 0;

    const apply = (h: boolean, s: boolean) => {
      if (h === hidden && s === scrolling) return;
      hidden = h; scrolling = s;
      setState({ hidden: h, scrolling: s });
    };

    const onScroll = (e: Event) => {
      const el = e.target as HTMLElement | Document;
      const node = el instanceof Document ? document.scrollingElement : el;
      if (!node || !(node instanceof HTMLElement)) return;

      // Шторка открыта — панели ей не мешают, состояние не трогаем
      if (document.body.hasAttribute('data-sheet-open')) return;

      const y = node.scrollTop;
      const max = node.scrollHeight - node.clientHeight;
      if (max < MIN_SCROLLABLE) { apply(false, false); return; }

      // Резинка: за пределами диапазона дельты врут
      if (y < 0 || y > max) return;

      const delta = y - last;
      last = y;

      /*  6. ПУСТОЕ СОБЫТИЕ. Браузер шлёт scroll и при нулевом смещении —
          в конце инерции, при программной установке scrollTop, при
          возврате фокуса. Такое событие обнуляло накопленный ход и
          отменяло уже принятое решение через cancelAnimationFrame:
          панель успевала решить «прячусь» и тут же передумывала.
          Нет движения — нет решения. */
      if (delta === 0) return;

      scrolling = true;
      if (idleTimer) window.clearTimeout(idleTimer);
      idleTimer = window.setTimeout(() => {
        scrolling = false;
        setState({ hidden, scrolling: false });
      }, 380);

      // Копим ход в одну сторону; смена направления обнуляет счётчик
      travel = Math.sign(delta) === Math.sign(travel) ? travel + delta : delta;

      let next = hidden;
      if (y <= TOP_ZONE) next = false;
      else if (y >= max - BOTTOM_ZONE) next = false;
      else if (travel > THRESHOLD) next = true;
      else if (travel < -THRESHOLD) next = false;

      if (frame) cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => apply(next, true));
    };

    document.addEventListener('scroll', onScroll, { capture: true, passive: true });
    return () => {
      document.removeEventListener('scroll', onScroll, { capture: true });
      if (idleTimer) window.clearTimeout(idleTimer);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  return state;
}
