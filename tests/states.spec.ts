import { test, expect } from '@playwright/test';
import { fresh, watchConsole, tab, noHorizontalScroll, tapTargets } from './helpers';

// ── Пустые состояния ───────────────────────────────────────
// Чистый аккаунт — это ПЕРВОЕ, что видит человек, и единственное
// состояние, которое нельзя проверить на своих же тестовых данных.

test('чистый аккаунт: ни один экран не пустой и не падает', async ({ page }) => {
  const errors = watchConsole(page);
  await fresh(page);

  for (const [name, re] of [
    ['профиль', /О НАС|ABOUT/i],
    ['услуги', /УСЛУГИ|SERVICES/i],
    ['запись', /ЗАПИСЬ|BOOKING/i],
    ['паспорт', /ПАСПОРТ|PASSPORT/i],
    ['ANZH', /ANZH/i],
  ] as const) {
    await tab(page, re);
    const text = (await page.locator('.screen').first().innerText()).trim();
    expect(text.length, `экран «${name}» не должен быть пустым`).toBeGreaterThan(40);
    await noHorizontalScroll(page);
  }
  expect(errors, 'консоль должна быть чистой').toEqual([]);
});

test('паспорт не заполнен: экран зовёт заполнить, а не показывает прочерки', async ({ page }) => {
  await fresh(page);
  await tab(page, /ПАСПОРТ|PASSPORT/i);
  const body = await page.locator('.screen').first().innerText();
  // Пустое состояние обязано давать ДЕЙСТВИЕ, а не сочувствие
  expect(body).not.toMatch(/^\s*$/);
  const cta = page.locator('.screen button, .screen a').filter({ hasText: /заполн|пройти|начать|записаться|Fill|Take|Book/i });
  expect(await cta.count(), 'на пустом паспорте должен быть выход в действие').toBeGreaterThan(0);
});

test('нет купленных разборов: цены видны, результатов не обещаем', async ({ page }) => {
  await fresh(page);
  await tab(page, /ANZH/i);
  await expect(page.locator('.digital-card').first()).toBeVisible();
  expect(await page.locator('.digital-result').count(), 'без прохождения не может быть «результата»').toBe(0);
  expect(await page.locator('.star-price').count()).toBeGreaterThan(0);
});

// ── Нажатия и мишени ───────────────────────────────────────

test('мишени не меньше 40px на всех вкладках', async ({ page }) => {
  await fresh(page);
  const bad: string[] = [];
  for (const re of [/О НАС|ABOUT/i, /УСЛУГИ|SERVICES/i, /ЗАПИСЬ|BOOKING/i, /ПАСПОРТ|PASSPORT/i, /ANZH/i]) {
    await tab(page, re);
    // .story-dot исключена намеренно: шаг между точками 12px, зона в 44px
    // накладывалась бы на соседей и уводила бы палец не в тот кадр.
    // Листают сторис большим тапом по половине экрана (.story-tap).
    const small = (await tapTargets(page, 'button:visible')).filter((s) => s.cls !== 'story-dot');
    for (const s of small) bad.push(`.${s.cls} «${s.t || '—'}» ${s.w}×${s.h}`);
  }
  expect(bad, 'мелкие мишени').toEqual([]);
});

// ── Модальный закон ────────────────────────────────────────

test('шторка закрывается тремя способами', async ({ page }) => {
  await fresh(page);
  await tab(page, /ANZH/i);

  await page.locator('.quiz-hero').click();
  await expect(page.locator('.sheet-host')).toBeVisible();
  await page.locator('.sheet-close').click();
  await expect(page.locator('.sheet-host')).toHaveCount(0);

  await page.locator('.quiz-hero').click();
  await expect(page.locator('.sheet-host')).toBeVisible();
  await page.locator('.sheet-overlay').click({ position: { x: 10, y: 10 } });
  await expect(page.locator('.sheet-host')).toHaveCount(0);

  await page.locator('.quiz-hero').click();
  await expect(page.locator('.sheet-host')).toBeVisible();
  await page.goBack();
  await expect(page.locator('.sheet-host')).toHaveCount(0);
});

// ── Адаптивность ───────────────────────────────────────────

test('320px: ничего не уезжает вбок', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 720 });
  await fresh(page);
  for (const re of [/О НАС|ABOUT/i, /УСЛУГИ|SERVICES/i, /ЗАПИСЬ|BOOKING/i, /ПАСПОРТ|PASSPORT/i, /ANZH/i]) {
    await tab(page, re);
    await noHorizontalScroll(page);
  }
});
