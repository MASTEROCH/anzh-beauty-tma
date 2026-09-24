import { test, expect, type Page } from '@playwright/test';
import { fresh, tab } from './helpers';

/*
   АДАПТИВНОСТЬ — ПО ШИРИНАМ, А НЕ ПО ОДНОМУ ТЕЛЕФОНУ.

   Приложение живёт в Telegram, а Telegram — на всём: от старого
   компактного Android до планшета. Ширины ниже не выдуманы, каждая
   что-то представляет:

     320 — iPhone SE 1-го поколения и дешёвые Android. Самая жестокая:
           здесь первым ломается всё, что свёрстано «на глаз».
     360 — самая массовая ширина Android в мире.
     412 — Pixel и большинство современных Android.
     430 — iPhone Pro Max.
     768 — планшет: здесь включается рамка-телефон по центру.

   Проверяются четыре свойства. Все четыре — про «можно пользоваться»,
   ни одно не про красоту: красоту проверяют глазами, а это должно
   держаться машинно.
*/

const WIDTHS = [320, 360, 412, 430, 768];
const SCREENS: [string, RegExp][] = [
  ['профиль', /О нас|About/i],
  ['услуги', /Услуги/i],
  ['запись', /Запись/i],
  ['паспорт', /Паспорт/i],
];

/** 1. Страницу не должно уводить вбок — это всегда дефект вёрстки */
async function horizontalScroll(page: Page) {
  return page.evaluate(() => {
    const d = document.documentElement;
    return Math.max(d.scrollWidth - d.clientWidth, document.body.scrollWidth - d.clientWidth);
  });
}

/** 2. Ничего не торчит за правый край: обрезанный текст не прочитать */
async function overflowing(page: Page) {
  return page.evaluate(() => {
    const vw = document.documentElement.clientWidth;
    const out: { cls: string; right: number }[] = [];
    for (const el of Array.from(document.querySelectorAll('.screen *'))) {
      const r = el.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) continue;
      const cs = getComputedStyle(el as HTMLElement);
      if (cs.visibility === 'hidden' || cs.display === 'none') continue;
      // Горизонтальные ленты выезжают за край НАМЕРЕННО — их листают.
      // Проверять надо и САМ элемент: `.gallery-filters` выходит за край
      // отрицательным margin, чтобы лента шла от края до края. Первая
      // версия смотрела только на родителей и объявила это дефектом.
      let inStrip = false;
      for (let p = el as HTMLElement | null; p; p = p.parentElement) {
        const o = getComputedStyle(p).overflowX;
        if (o === 'auto' || o === 'scroll' || p.classList.contains('marquee')) { inStrip = true; break; }
      }
      if (inStrip) continue;
      if (r.right > vw + 1) out.push({ cls: (el as HTMLElement).className.toString().slice(0, 50), right: Math.round(r.right) });
    }
    return out.slice(0, 8);
  });
}

/** 3. Мишень меньше 44px пальцем не берётся — правило Apple HIG.

   🚨 Мерить надо РЕАЛЬНУЮ зону, а не сам элемент. В проекте зона растится
   невидимым `::after` поверх элемента — плотные ряды чипов и шапок при
   этом не раздуваются. Первая версия теста про это не знала и угадывала
   прибавку числом: она отчиталась о четырёх «дефектах», три из которых
   давно исправлены именно так. Тест, который не понимает решения
   проекта, находит не дефекты, а сам себя. */
const TARGET_EXCEPTIONS: { cls: string; why: string }[] = [
  {
    cls: 'story-dot',
    why: 'точки пагинации стоят в 12px друг от друга: зона 44px наложилась бы ' +
         'на три соседних и палец попадал бы не в тот кадр. Растят только по ' +
         'вертикали, а листают сторис тапом по половине экрана (.story-tap)',
  },
];

async function tinyTargets(page: Page) {
  return page.evaluate((exceptions) => {
    const out: { cls: string; w: number; h: number; txt: string }[] = [];
    for (const el of Array.from(document.querySelectorAll('button, a[href], [role="button"]'))) {
      const r = el.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) continue;
      const cs = getComputedStyle(el as HTMLElement);
      if (cs.visibility === 'hidden' || cs.display === 'none') continue;
      if (Number(cs.opacity) < 0.05) continue;

      const cls = (el as HTMLElement).className.toString();
      if (exceptions.some((e) => cls.split(/\s+/).includes(e))) continue;

      // Реальная зона: объединение самого элемента и его ::after,
      // если тот выращен абсолютным позиционированием поверх.
      let w = r.width, h = r.height;
      const after = getComputedStyle(el as HTMLElement, '::after');
      if (after.content !== 'none' && after.position === 'absolute') {
        w = Math.max(w, parseFloat(after.width) || 0);
        h = Math.max(h, parseFloat(after.height) || 0);
      }

      if (w < 44 || h < 44) {
        out.push({
          cls: cls.slice(0, 40),
          w: Math.round(w), h: Math.round(h),
          txt: (el.textContent ?? '').trim().slice(0, 18),
        });
      }
    }
    return out.slice(0, 8);
  }, TARGET_EXCEPTIONS.map((e) => e.cls));
}

/** 4. Плавающий шар не лежит на ПЕРВИЧНОМ действии.

   Правило сознательно уже, чем «не пересекается ни с чем». Шар — это
   плавающая кнопка в углу; требование не пересекаться ни с одним
   нажимаемым элементом запрещает саму идею плавающей кнопки, потому
   что под ней рано или поздно окажется любой длинный список.

   Что принято как есть: шар может накрыть вторичное — сердечко на
   карточке, карточку-подсказку. Это смягчено поведением, которое уже
   есть: шар прячется при прокрутке и у конца списка, то есть ровно
   тогда, когда человек до этих элементов и добирается.

   Что недопустимо: шар поверх первичной кнопки — «Записаться»,
   «Каталог», липкой кнопки экрана. Такую кнопку человек ищет глазами и
   бьёт по ней сразу, а попадает в ассистента. Для этого случая сделана
   уступка: блок помечается `data-fab-yield`, и шар уходит, пока блок
   виден (см. lib/fabYield.ts). */
const PRIMARY = '.btn-primary, .btn-secondary, .bottom-cta button, .bottom-cta a, [data-fab-yield] button';

async function fabCollisions(page: Page) {
  return page.evaluate((sel) => {
    const fab = document.querySelector('.ai-bubble');
    if (!fab) return [];
    // Спрятанный шар ничего не накрывает. Без этой проверки тест ругался
    // на столкновение с элементом, которого человек не видит и не может
    // нажать, — то есть на пустом месте.
    const fs = getComputedStyle(fab as HTMLElement);
    if (Number(fs.opacity) < 0.05 || fs.visibility === 'hidden' || fs.pointerEvents === 'none') {
      return [];
    }
    const f = fab.getBoundingClientRect();
    const out: { cls: string; txt: string }[] = [];
    for (const el of Array.from(document.querySelectorAll(sel))) {
      const r = el.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) continue;
      const cs = getComputedStyle(el as HTMLElement);
      if (cs.visibility === 'hidden' || Number(cs.opacity) < 0.05) continue;
      const overlap =
        !(r.right < f.left || r.left > f.right || r.bottom < f.top || r.top > f.bottom);
      if (overlap) {
        out.push({
          cls: (el as HTMLElement).className.toString().slice(0, 40),
          txt: (el.textContent ?? '').trim().slice(0, 24),
        });
      }
    }
    return out.slice(0, 6);
  }, PRIMARY);
}

for (const width of WIDTHS) {
  test(`${width}px — вёрстка держится`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await fresh(page);

    for (const [name, re] of SCREENS) {
      await tab(page, re);
      await page.waitForTimeout(250);

      expect(await horizontalScroll(page), `${name}: страницу уводит вбок`).toBeLessThanOrEqual(1);
      expect(await overflowing(page), `${name}: торчит за правый край`).toEqual([]);
      expect(await tinyTargets(page), `${name}: мишень меньше 44px`).toEqual([]);
      expect(await fabCollisions(page), `${name}: шар ассистента лежит на первичной кнопке`).toEqual([]);
    }
  });
}
