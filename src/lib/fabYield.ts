import { useEffect } from 'react';

/*
   ШАР АССИСТЕНТА УСТУПАЕТ ТОМУ, ЧТО ПОД НИМ.

   Плавающая кнопка в углу рано или поздно накрывает что-нибудь
   нажимаемое: пару «Записаться / Каталог» на профиле, «+» у карточки
   процедуры, сердечко на карточке услуги. Человек бьёт по тому, что
   видит, а попадает в ассистента.

   Разобраны и отвергнуты три решения:

   · Поднять шар выше. Он переезжает на ряд регалий — столкновение не
     исчезает, а меняет жертву.
   · Освободить полосу справа отступом. На 320px кнопке «Записаться»
     нужен 121px, а остаётся 73: текст обрезается. Чинить одно, ломая
     другое, нельзя.
   · Помечать такие блоки в разметке вручную. Работает, но только для
     тех мест, которые вспомнили. «+» у карточек не вспомнили бы —
     нашлось глазами на снимке уже после того, как разметка была
     расставлена.

   Осталось правило без списка исключений: смотрим, что лежит ПОД шаром,
   и если это нажимаемое — шар уходит. Проверяется геометрией, поэтому
   работает и на экранах, которых ещё нет.

   Уход — та же анимация, что при скрытии панелей (body[data-near-bottom]),
   так что ощущается как одно поведение, а не как отдельный трюк.
*/

/** Что считается нажимаемым. Таббар и сам шар — не в счёт. */
const TAPPABLE = 'button, a[href], [role="button"], input, textarea, select';
const CHROME = '.bottom-nav, .ai-bubble, .header, .lang-hud';

function overlapsTappable(): boolean {
  const fab = document.querySelector('.ai-bubble');
  if (!fab) return false;

  const r = fab.getBoundingClientRect();
  if (r.width < 2) return false;

  /* Пять точек, а не одна: угол шара наезжает на кнопку раньше центра, и
     проверка по центру пропускала бы ровно тот случай, ради которого всё
     затевалось — край «+» под краем шара. */
  const inset = 6;
  const points: [number, number][] = [
    [r.left + inset, r.top + inset],
    [r.right - inset, r.top + inset],
    [r.left + inset, r.bottom - inset],
    [r.right - inset, r.bottom - inset],
    [r.left + r.width / 2, r.top + r.height / 2],
  ];

  for (const [x, y] of points) {
    for (const el of document.elementsFromPoint(x, y)) {
      if (fab.contains(el) || el.contains(fab)) continue;
      if (el.closest(CHROME)) continue;
      if (el.closest(TAPPABLE)) return true;
    }
  }
  return false;
}

export function useFabYield() {
  useEffect(() => {
    let frame = 0;

    const check = () => {
      if (frame) cancelAnimationFrame(frame);
      /* Через кадр: elementsFromPoint читает разложенный документ, а во
         время самой прокрутки он ещё меняется. Заодно схлопывает пачку
         событий в один замер. */
      frame = requestAnimationFrame(() => {
        document.body.toggleAttribute('data-fab-away', overlapsTappable());
      });
    };

    check();

    // Прокрутка внутри экрана — основной источник изменений.
    document.addEventListener('scroll', check, { capture: true, passive: true });
    window.addEventListener('resize', check);

    // Смена экрана: узлы другие, шар остаётся на месте.
    const mo = new MutationObserver(check);
    mo.observe(document.body, { childList: true, subtree: true });

    return () => {
      document.removeEventListener('scroll', check, { capture: true });
      window.removeEventListener('resize', check);
      mo.disconnect();
      if (frame) cancelAnimationFrame(frame);
      document.body.removeAttribute('data-fab-away');
    };
  }, []);
}
