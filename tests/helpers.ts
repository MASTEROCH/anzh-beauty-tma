import { type Page, expect } from '@playwright/test';

/** Приложение с чистого листа: онбординг пройден, ничего не куплено */
export async function fresh(page: Page, seed: Record<string, string> = {}) {
  /* Чистим ОДИН раз за сессию. addInitScript выполняется при КАЖДОЙ
     загрузке страницы, включая reload, — а тест на «язык пережил
     перезагрузку» тогда проверял бы работу самого стирания, а не продукта. */
  await page.addInitScript((s) => {
    try {
      if (!sessionStorage.getItem('__seeded')) {
        localStorage.clear();
        localStorage.setItem('anzh_onboarded', '1');
        for (const [k, v] of Object.entries(s as Record<string, string>)) localStorage.setItem(k, v);
        sessionStorage.setItem('__seeded', '1');
      }
    } catch { /* приватный режим */ }
  }, seed);
  await page.goto('/');
  await page.waitForSelector('.bottom-nav', { timeout: 10_000 });
}

/** Ошибки консоли собираем с первой секунды, а не после падения */
export function watchConsole(page: Page) {
  const errors: string[] = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(String(e)));
  return errors;
}

export async function tab(page: Page, name: RegExp) {
  await page.locator('.nav-item').filter({ hasText: name }).first().click();
  await page.waitForTimeout(450);
}

/** Горизонтальной прокрутки быть не должно нигде: это всегда вёрстка */
export async function noHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(() => {
    const d = document.documentElement;
    return d.scrollWidth - d.clientWidth;
  });
  expect(overflow, 'страница не должна прокручиваться вбок').toBeLessThanOrEqual(1);
}

/** Мишень меньше 44px на телефоне — это промах, а не нажатие.
 *  Меряем ЭФФЕКТИВНУЮ зону: у части контролов она расширена невидимым
 *  ::after, и по габаритам самого элемента этого не увидеть. */
export async function tapTargets(page: Page, selector: string, min = 40) {
  const boxes = await page.locator(selector).evaluateAll((els) =>
    els.map((e) => {
      const r = e.getBoundingClientRect();
      const after = getComputedStyle(e, '::after');
      const aw = after.content !== 'none' ? parseFloat(after.width) || 0 : 0;
      const ah = after.content !== 'none' ? parseFloat(after.height) || 0 : 0;
      return {
        w: Math.round(Math.max(r.width, aw)),
        h: Math.round(Math.max(r.height, ah)),
        t: (e.textContent || '').trim().slice(0, 24),
        cls: String(e.className).split(' ')[0],
      };
    }),
  );
  return boxes.filter((b) => b.w > 0 && (b.h < min || b.w < min));
}
