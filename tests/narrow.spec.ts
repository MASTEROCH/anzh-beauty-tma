import { test, expect, type Page } from '@playwright/test';
import { watchConsole, noHorizontalScroll } from './helpers';

// Узкие и низкие экраны. Android-парк — это не один iPhone: 360×640 всё ещё
// массовый размер, и на нём ломается то, что на 390×844 выглядит нормально.

const SIZES = [
  { name: '360×640', width: 360, height: 640 },
  { name: '320×568', width: 320, height: 568 },
];

/** Обрезанный текст — настоящий дефект вёрстки.
 *  Ленты (marquee), прокручиваемые ряды и элементы с невидимой зоной
 *  нажатия `::after` намеренно шире своего бокса — их исключаем, иначе
 *  проверка ловит собственные приёмы проекта и перестаёт читаться. */
async function clippedText(page: Page) {
  return page.evaluate(() => {
    const bad: string[] = [];
    for (const el of Array.from(document.querySelectorAll<HTMLElement>('body *'))) {
      if (!el.offsetParent) continue;
      if (el.closest('.marquee, .marquee-track, [class*="-row"], [class*="-filters"], .slot-grid')) continue;
      const cs = getComputedStyle(el);
      if (cs.overflowX !== 'hidden') continue;
      if (cs.textOverflow === 'ellipsis') continue;
      if (getComputedStyle(el, '::after').content !== 'none') continue;
      // Только узлы с собственным текстом: у контейнеров ширину задаёт ребёнок
      const own = Array.from(el.childNodes).some(
        (n) => n.nodeType === 3 && (n.textContent ?? '').trim().length > 0,
      );
      if (!own) continue;
      if (el.scrollWidth > el.clientWidth + 2 && el.clientWidth > 0) {
        bad.push(`${el.tagName.toLowerCase()}.${String(el.className).split(' ')[0]} «${(el.textContent ?? '').trim().slice(0, 24)}» ${el.scrollWidth}>${el.clientWidth}`);
      }
    }
    return [...new Set(bad)];
  });
}

for (const s of SIZES) {
  test(`онбординг на ${s.name}: доходит до конца, ничего не обрезано`, async ({ page }) => {
    const errors = watchConsole(page);
    await page.setViewportSize({ width: s.width, height: s.height });
    await page.addInitScript(() => { try { localStorage.clear(); } catch { /* ignore */ } });
    await page.goto('/');
    await page.waitForSelector('.onb-screen', { timeout: 10_000 });

    for (let step = 0; step < 6; step++) {
      await noHorizontalScroll(page);
      expect(await clippedText(page), `онбординг шаг ${step} · ${s.name}`).toEqual([]);

      // Кнопка шага обязана быть видна целиком, а не наполовину под краем
      const cta = page.locator('.onb-cta, .onb-foot button').first();
      if (await cta.count() === 0) break;
      // Утверждаем размер, а не «не null»: кнопка нулевой высоты тоже
      // объект, и проверка на существование её пропустит
      const box = await cta.boundingBox();
      expect(box?.height ?? 0, `шаг ${step}: кнопки нет или она нулевая`).toBeGreaterThan(30);
      expect(box!.y + box!.height, `шаг ${step} · ${s.name}: кнопка за краем`).toBeLessThanOrEqual(s.height + 1);

      if (await cta.isDisabled()) break;
      await cta.click();
      await page.waitForTimeout(450);
      if (await page.locator('.onb-screen').count() === 0) break;
    }
    expect(errors).toEqual([]);
  });

  test(`экраны на ${s.name}: ничего не вылезает`, async ({ page }) => {
    await page.setViewportSize({ width: s.width, height: s.height });
    await page.addInitScript(() => {
      try { localStorage.clear(); localStorage.setItem('anzh_onboarded', '1'); } catch { /* ignore */ }
    });
    await page.goto('/');
    await page.waitForSelector('.bottom-nav', { timeout: 10_000 });

    for (const re of [/О НАС|ABOUT/i, /УСЛУГИ|SERVICES/i, /ЗАПИСЬ|BOOKING/i, /ПАСПОРТ|PASSPORT/i, /ANZH/i]) {
      await page.locator('.nav-item').filter({ hasText: re }).first().click();
      await page.waitForTimeout(450);
      await noHorizontalScroll(page);
      expect(await clippedText(page), `${re} · ${s.name}`).toEqual([]);
    }
  });
}

test('кабинет мастера на 320: визит из трёх процедур не ломает строку', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.addInitScript(() => {
    try {
      localStorage.clear();
      localStorage.setItem('anzh_onboarded', '1');
      localStorage.setItem('anzh_appointments_v2', JSON.stringify([{
        id: 'long', dateISO: new Date().toISOString().slice(0, 10), slot: '15:00',
        serviceId: 'brow-lamination',
        extras: ['tattoo-removal', 'dermatology'],
        clientName: 'Александра', clientInstagram: 'alexandra_batumi',
        status: 'pending', createdAt: Date.now(),
      }]));
    } catch { /* ignore */ }
  });
  await page.goto('/');
  await page.waitForSelector('.bottom-nav');
  await page.locator('.nav-item').filter({ hasText: /ПАСПОРТ|PASSPORT/i }).first().click();
  await page.waitForTimeout(400);
  await page.locator('.chip').filter({ hasText: /Настройки/i }).click();
  await page.waitForTimeout(400);
  await page.locator('button').filter({ hasText: /Кабинет мастера/i }).first().click();
  await page.waitForTimeout(400);
  for (const d of '2024') await page.locator('.pin-key', { hasText: new RegExp(`^${d}$`) }).first().click();
  await page.waitForTimeout(800);

  await expect(page.locator('.studio-req')).toBeVisible();
  await noHorizontalScroll(page);
  expect(await clippedText(page), 'кабинет · 320px').toEqual([]);
});
