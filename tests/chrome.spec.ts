import { test, expect, type Page } from '@playwright/test';
import { fresh } from './helpers';

// Верхняя полоса — шапка, вуаль размытия под ней и переключатель языка —
// для глаза одна деталь, а в разметке три элемента в трёх родителях.
//
// Именно поэтому она однажды и разъехалась: у шапки был свой уход
// (`translateY(-100%)`), у HUD свой, а у вуали — только `opacity`. При
// прокрутке шапка уезжала вверх, а полоса размытия оставалась висеть на
// прежнем месте и читалась как оторванная тень.
//
// Глазами это ловится плохо: дефект живёт доли секунды и только в
// движении. Поэтому проверка машинная и проверяет не «красиво ли», а
// одно свойство: верх вуали совпадает с низом шапки в КАЖДОМ состоянии.

/**
 * Прокрутка шагами, как в остальных тестах проекта.
 *
 * Колесо здесь не годится: движок — mobile WebKit, там `mouse.wheel` не
 * поддерживается вовсе. А один прыжок `scrollTop = 700` контроллер
 * хрома не убедит: он копит ход в одну сторону и переключается только
 * после порога, поэтому шагов должно быть несколько.
 */
async function scroll(page: import('@playwright/test').Page, dy: number) {
  const steps = 8;
  await page.locator('.screen').first().evaluate(
    async (el, { dy, steps }) => {
      const from = el.scrollTop;
      for (let i = 1; i <= steps; i++) {
        el.scrollTop = Math.max(0, from + (dy * i) / steps);
        el.dispatchEvent(new Event('scroll', { bubbles: true }));
        await new Promise((r) => setTimeout(r, 24));
      }
    },
    { dy, steps },
  );
}

interface Band {
  away: boolean;
  headerTop: number;
  headerBottom: number;
  veilTop: number;
  hudTop: number;
}

async function band(page: import('@playwright/test').Page): Promise<Band> {
  return page.evaluate(() => {
    const box = (s: string) => {
      const el = document.querySelector(s);
      if (!el) throw new Error(`нет элемента ${s}`);
      const b = el.getBoundingClientRect();
      return { top: Math.round(b.top), bottom: Math.round(b.bottom) };
    };
    const header = box('.header');
    return {
      away: document.querySelector('.app')!.classList.contains('chrome-away'),
      headerTop: header.top,
      headerBottom: header.bottom,
      veilTop: box('.header-veil').top,
      hudTop: box('.lang-hud').top,
    };
  });
}

test('вуаль не отрывается от шапки ни в одном состоянии', async ({ page }) => {
  await fresh(page);
  await page.waitForTimeout(500);

  const shown = await band(page);
  expect(shown.away, 'у верха страницы панели должны быть видны').toBe(false);
  expect(shown.veilTop, 'вуаль начинается ровно под шапкой').toBe(shown.headerBottom);
  expect(shown.hudTop, 'HUD стоит в полосе шапки').toBe(shown.headerTop);

  // Уходим вниз — панели прячутся.
  await scroll(page, 700);
  await page.waitForTimeout(700);

  const hidden = await band(page);
  expect(hidden.away, 'после прокрутки вниз панели прячутся').toBe(true);

  // 🚨 Главное. Шапка уехала — вуаль обязана уехать ровно с ней.
  expect(hidden.veilTop, 'верх вуали держится за низ шапки').toBe(hidden.headerBottom);
  expect(hidden.hudTop, 'HUD уезжает вместе с шапкой').toBe(hidden.headerTop);

  // И уехали они на одну и ту же величину.
  const shift = shown.headerTop - hidden.headerTop;
  expect(shift, 'шапка действительно сдвинулась вверх').toBeGreaterThan(20);
  expect(shown.veilTop - hidden.veilTop, 'вуаль сдвинулась на столько же').toBe(shift);
  expect(shown.hudTop - hidden.hudTop, 'HUD сдвинулся на столько же').toBe(shift);

  // Возврат: всё встаёт на место и снова сходится.
  await scroll(page, -700);
  await page.waitForTimeout(700);

  const back = await band(page);
  expect(back.away).toBe(false);
  expect(back.veilTop).toBe(back.headerBottom);
  expect(back.headerTop).toBe(shown.headerTop);
});

test('в середине перехода вуаль тоже держится за шапку', async ({ page }) => {
  await fresh(page);
  await page.waitForTimeout(500);

  await scroll(page, 700);
  // Переход длится 260 мс. Смотрим НА ЕГО СЕРЕДИНЕ: именно там жил
  // дефект — в покое оба состояния выглядели правильно.
  await page.waitForTimeout(120);

  const mid = await band(page);
  expect(mid.veilTop, 'на середине ухода вуаль не отстаёт от шапки').toBe(mid.headerBottom);
  expect(mid.hudTop).toBe(mid.headerTop);
});

/* Ждём, пока геометрия ЗАСТЫНЕТ.

   `--header-h` публикует JS после замера шапки, то есть на кадр позже
   самой шапки. В покое это незаметно, но под параллельной нагрузкой
   прогон успевал измерить промежуточное состояние: шапка уже 75px,
   переменная ещё 67 — тест падал на разнице в 8px, которой в продукте
   не существует дольше одного кадра.

   Ждём совпадения, а не фиксированной паузы: пауза «подлиннее» прячет
   такие вещи ровно до следующей медленной машины. */
async function settled(page: Page) {
  await page.waitForFunction(
    () => {
      const h = document.querySelector('.header');
      const v = document.querySelector('.header-veil');
      if (!h || !v) return false;
      return Math.abs(v.getBoundingClientRect().top - h.getBoundingClientRect().bottom) < 0.5;
    },
    undefined,
    { timeout: 4000 },
  );
}

test('шапка и вуаль уходят и возвращаются как одно целое на всех экранах', async ({ page }) => {
  await fresh(page);

  for (const name of [/Услуги/i, /Паспорт/i, /ANZH/i]) {
    await page.locator('.nav-item').filter({ hasText: name }).first().click();
    await page.waitForTimeout(500);
    await settled(page);

    const top = await band(page);
    expect(top.veilTop, `${name}: у верха вуаль под шапкой`).toBe(top.headerBottom);

    await scroll(page, 700);
    await page.waitForTimeout(700);

    const away = await band(page);
    // Экран может оказаться коротким — тогда панели не прячутся, и это
    // правильное поведение, а не дефект. Проверяем то, что верно всегда.
    expect(away.veilTop, `${name}: вуаль держится за шапку`).toBe(away.headerBottom);

    await scroll(page, -700);
    await page.waitForTimeout(600);
  }
});
