import { test } from '@playwright/test';

// Снимки для арт-дирекции: одни и те же экраны до и после правки палитры.
test('@probe палитра', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const tag = process.env.SHOT_TAG ?? 'x';
  await page.addInitScript(() => {
    try { localStorage.clear(); localStorage.setItem('anzh_onboarded', '1'); } catch { /* ignore */ }
  });
  await page.goto('/');
  await page.waitForSelector('.bottom-nav');
  await page.waitForTimeout(900);
  await page.screenshot({ path: `test-results/look-${tag}-profile.png` });

  await page.locator('.nav-item').filter({ hasText: /УСЛУГИ/i }).first().click();
  await page.waitForTimeout(800);
  await page.screenshot({ path: `test-results/look-${tag}-catalog.png` });

  await page.locator('.nav-item').filter({ hasText: /ПАСПОРТ/i }).first().click();
  await page.waitForTimeout(800);
  await page.screenshot({ path: `test-results/look-${tag}-passport.png` });
});
