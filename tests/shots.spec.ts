import { test } from '@playwright/test';

// Снимки кабинета мастера для показа. @probe — вне обычного прогона.
test('@probe админка в кадрах', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const d = (n: number) => { const x = new Date(); x.setDate(x.getDate() - n); return x.toLocaleDateString('sv'); };
  const today = new Date().toLocaleDateString('sv');

  await page.addInitScript(({ today, mk }) => {
    try {
      localStorage.clear();
      localStorage.setItem('anzh_onboarded', '1');
      localStorage.setItem('anzh_health_v1', JSON.stringify({
        noAllergies: false, allergies: ['Лидокаин — слабая реакция'], pregnant: true,
        lactating: false, chronic: '', meds: '', skinType: 'Сухая', fitzpatrick: 'II',
        couperose: true, sensitivity: 'high', notes: 'Просит мягкую анестезию',
        goal: 'Овал и морщины', updatedAt: Date.now(),
      }));
      localStorage.setItem('anzh_quests_v1', JSON.stringify({
        review: { state: 'done', doneAt: Date.now() },
        invite: { state: 'idle' },
        story: { state: 'pending', sentAt: Date.now() - 7_200_000 },
      }));
      localStorage.setItem('anzh_appointments_v2', JSON.stringify(mk));
      void today;
    } catch { /* ignore */ }
  }, {
    today,
    mk: [
      { id: 'n1', dateISO: today, slot: '16:30', serviceId: 'lip-filler', extras: ['led-therapy'], clientName: 'Мария', clientInstagram: 'maria_b', status: 'pending', createdAt: Date.now() },
      { id: 'n2', dateISO: today, slot: '11:00', serviceId: 'brow-lamination', clientName: 'Нино', clientInstagram: 'nino.k', status: 'confirmed', createdAt: Date.now() - 1 },
      { id: 'h1', dateISO: d(6), slot: '12:00', serviceId: 'biorevit', clientName: 'Мария', clientInstagram: 'maria_b', status: 'completed', amount: 110, createdAt: 1 },
      { id: 'h2', dateISO: d(20), slot: '15:00', serviceId: 'carbon-peel', clientName: 'Света', clientInstagram: 'sveta', status: 'completed', amount: 95, createdAt: 2 },
      { id: 'h3', dateISO: d(44), slot: '10:00', serviceId: 'deep-cleansing', clientName: 'Катя', clientInstagram: 'katya', status: 'completed', amount: 80, createdAt: 3 },
      { id: 'h4', dateISO: d(70), slot: '18:00', serviceId: 'lip-filler', clientName: 'Ира', clientInstagram: 'ira', status: 'completed', amount: 150, createdAt: 4 },
      { id: 'h5', dateISO: d(12), slot: '14:00', serviceId: 'rf-lifting', clientName: 'Лена', clientInstagram: 'lena', status: 'no-show', createdAt: 5 },
    ],
  });

  await page.goto('/');
  await page.waitForSelector('.bottom-nav');
  await page.locator('.nav-item').filter({ hasText: /ПАСПОРТ/i }).first().click();
  await page.waitForTimeout(400);
  await page.locator('.chip').filter({ hasText: /Настройки/i }).click();
  await page.waitForTimeout(400);
  await page.locator('button').filter({ hasText: /Кабинет мастера/i }).first().click();
  await page.waitForTimeout(400);
  for (const c of '2024') await page.locator('.pin-key', { hasText: new RegExp(`^${c}$`) }).first().click();
  await page.waitForTimeout(2600);

  await page.screenshot({ path: 'test-results/adm-1-requests.png' });

  await page.locator('.cc-strip').first().click();
  await page.waitForTimeout(900);
  await page.screenshot({ path: 'test-results/adm-2-client.png' });
  await page.locator('.sheet-close').click();
  await page.waitForTimeout(500);

  for (const [tab, file] of [['Деньги', 'adm-3-money'], ['Прайс', 'adm-4-price'], ['Сторис', 'adm-5-promo']] as const) {
    const t = page.locator('.studio-tab').filter({ hasText: tab });
    await t.scrollIntoViewIfNeeded();
    await t.click();
    await page.waitForTimeout(900);
    await page.screenshot({ path: `test-results/${file}.png` });
  }

  // Команда — внизу вкладки «Прайс»
  await page.locator('.studio-tab').filter({ hasText: 'Прайс' }).click();
  await page.waitForTimeout(600);
  await page.locator('.te-row').first().scrollIntoViewIfNeeded();
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'test-results/adm-6-team.png' });
});
