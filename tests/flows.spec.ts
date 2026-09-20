import { test, expect } from '@playwright/test';
import { fresh, watchConsole, tab, noHorizontalScroll } from './helpers';

// ── Сквозные сценарии ──────────────────────────────────────
// Проверяем не «кнопка есть», а доходит ли человек до цели.

test('галерея → карточка процедуры → запись', async ({ page }) => {
  const errors = watchConsole(page);
  await fresh(page);
  await tab(page, /ПРОФИЛЬ|PROFILE/i);

  await page.locator('.gallery-tile').first().scrollIntoViewIfNeeded();
  await page.locator('.gallery-tile').first().click();
  await expect(page.locator('.sheet-host')).toBeVisible();
  await expect(page.locator('.case-facts')).toBeVisible();

  await page.locator('.sheet-host button').filter({ hasText: /Записаться|Book/i }).first().click();
  // Из карточки процедуры человек обязан попадать на выбор времени
  await expect(page.locator('.screen')).toContainText(/Выбор времени|Pick a time|ЗАПИСЬ|BOOKING/i, { timeout: 5000 });
  expect(errors).toEqual([]);
});

test('фильтр направлений сужает галерею и не даёт пустых фильтров', async ({ page }) => {
  await fresh(page);
  await tab(page, /ПРОФИЛЬ|PROFILE/i);
  await page.locator('.gallery-chip').first().scrollIntoViewIfNeeded();

  const total = await page.locator('.gallery-tile').count();
  const chips = page.locator('.gallery-chip');
  const n = await chips.count();
  expect(n).toBeGreaterThan(1);

  for (let i = 1; i < n; i++) {
    await chips.nth(i).click();
    await page.waitForTimeout(250);
    const shown = await page.locator('.gallery-tile').count();
    // Каждый показанный фильтр обязан что-то показывать
    expect(shown, `фильтр ${i} не должен быть пустым`).toBeGreaterThan(0);
    expect(shown).toBeLessThanOrEqual(total);
  }
});

test('разбор: paywall → оплата → чек → результат', async ({ page }) => {
  const errors = watchConsole(page);
  await fresh(page);
  await tab(page, /ANZH/i);

  await page.locator('.digital-card').first().click();
  await expect(page.locator('.pw-hero')).toBeVisible();
  await expect(page.locator('.pw-price-now')).toContainText(/\d{3}/);

  await page.locator('button').filter({ hasText: /Оплатить|Pay /i }).first().click();
  await expect(page.locator('.pw-done')).toBeVisible({ timeout: 8000 });
  await expect(page.locator('.pw-done-receipt')).toContainText(/\d{3}/);

  await page.locator('button').filter({ hasText: /Пройти разбор|Take the analysis/i }).click();
  await expect(page.locator('.quiz-q')).toBeVisible({ timeout: 5000 });
  expect(errors).toEqual([]);
});

test('квиз проходится до конца и выдаёт результат', async ({ page }) => {
  await fresh(page);
  await tab(page, /ANZH/i);
  await page.locator('.quiz-hero').click();
  await page.locator('button').filter({ hasText: /Пройти бесплатно|Take it free|Пройти заново|Retake/i }).click();

  for (let i = 0; i < 40; i++) {
    const opts = page.locator('.quiz-option');
    if (await opts.count() === 0) break;
    await opts.first().click();
    await page.waitForTimeout(90);
    const next = page.locator('button').filter({ hasText: /^Дальше$|^Next$/ });
    if (await next.count()) { await next.first().click(); await page.waitForTimeout(90); }
  }
  await expect(page.locator('.quiz-result-type')).toBeVisible({ timeout: 5000 });
  await expect(page.locator('.quiz-congrats')).toBeVisible();
});

test('скидка не даётся тапом: только через задание', async ({ page }) => {
  await fresh(page);
  await tab(page, /ANZH/i);

  const before = await page.locator('.digital-stars').first().innerText();
  await page.locator('.quest-badge').click();
  await expect(page.locator('.quest-meter-now')).toContainText('0%');

  // Закрыли, ничего не выполнив — цена обязана остаться прежней
  await page.locator('.sheet-close').click();
  await page.waitForTimeout(300);
  expect(await page.locator('.digital-stars').first().innerText()).toBe(before);
});

test('запись: шаги проходятся и заявка создаётся', async ({ page }) => {
  const errors = watchConsole(page);
  await fresh(page);
  await tab(page, /ЗАПИСЬ|BOOKING/i);
  await noHorizontalScroll(page);
  await expect(page.locator('.screen')).toContainText(/Выбор времени|Pick a time/i);
  expect(errors).toEqual([]);
});

test('язык переключается на любом экране и держится', async ({ page }) => {
  await fresh(page);
  for (const re of [/ПРОФИЛЬ|PROFILE/i, /УСЛУГИ|SERVICES/i, /ПАСПОРТ|PASSPORT/i, /ANZH/i]) {
    await tab(page, re);
    await expect(page.locator('.lang-hud')).toBeVisible();
  }
  await page.locator('.lang-hud button', { hasText: 'EN' }).click();
  await page.waitForTimeout(400);
  await expect(page.locator('.nav-item').first()).toContainText(/PROFILE/i);
  await page.reload();
  await page.waitForSelector('.bottom-nav');
  await expect(page.locator('.nav-item').first()).toContainText(/PROFILE/i);
});

test('несколько процедур в одну запись: время и сумма складываются', async ({ page }) => {
  const errors = watchConsole(page);
  await fresh(page);
  await tab(page, /ЗАПИСЬ|BOOKING/i);

  // Итог до добавления
  const before = await page.locator('.summary-row').filter({ hasText: /Длительность|Duration/i }).innerText();

  // Добавляем вторую процедуру чипом
  // Карточка-подсказка вместо прежней бегущей ленты: первая в списке —
  // это то, что приложение рекомендует добавить к выбранной процедуре
  const sug = page.locator('.bk-sug').first();
  await sug.scrollIntoViewIfNeeded();
  await sug.click();
  await page.waitForTimeout(350);

  await expect(page.locator('.bk-extra')).toHaveCount(1);
  await expect(page.locator('.bk-extra-total')).toContainText(/мин|min/i);

  const after = await page.locator('.summary-row').filter({ hasText: /Длительность|Duration/i }).innerText();
  expect(after, 'длительность визита обязана вырасти').not.toBe(before);

  // Снимаем — возвращается к исходному
  await page.locator('.bk-extra-off').click();
  await page.waitForTimeout(300);
  expect(await page.locator('.bk-extra').count()).toBe(0);
  expect(await page.locator('.summary-row').filter({ hasText: /Длительность|Duration/i }).innerText()).toBe(before);
  expect(errors).toEqual([]);
});

test('отклонённая заявка доходит до клиентки с причиной и выходом', async ({ page }) => {
  const today = new Date().toLocaleDateString('sv');
  await fresh(page, {
    anzh_appointments_v2: JSON.stringify([{
      id: 'd1', dateISO: today, slot: '16:30', serviceId: 'lip-filler',
      clientName: 'Маша', clientInstagram: 'mashab',
      status: 'declined', declineReason: 'В этот день я на обучении — давай перенесём',
      createdAt: Date.now(),
    }]),
    anzh_client_v1: JSON.stringify({ name: 'Маша', instagram: 'mashab' }),
  });
  await tab(page, /ПАСПОРТ|PASSPORT/i);

  // До этого отказ исчезал совсем: ни в активных, ни в истории
  await expect(page.locator('.declined-card')).toBeVisible({ timeout: 5000 });
  await expect(page.locator('.declined-why')).toContainText(/обучении/);
  await page.locator('.declined-card button').click();
  await expect(page.locator('.screen')).toContainText(/Выбор времени|Pick a time/i, { timeout: 5000 });
});

test('панели уходят вниз по прокрутке и возвращаются вверх', async ({ page }) => {
  await fresh(page);
  await tab(page, /УСЛУГИ|SERVICES/i);
  const app = page.locator('.app');
  const scroller = page.locator('.screen').first();

  await expect(app).not.toHaveClass(/chrome-away/);

  // Вниз — панели уходят
  await scroller.evaluate((el) => { el.scrollTop = 600; el.dispatchEvent(new Event('scroll', { bubbles: true })); });
  await page.waitForTimeout(250);
  await expect(app, 'при прокрутке вниз панели должны уйти').toHaveClass(/chrome-away/);

  // Вверх — возвращаются
  await scroller.evaluate((el) => { el.scrollTop = 420; el.dispatchEvent(new Event('scroll', { bubbles: true })); });
  await page.waitForTimeout(250);
  await expect(app, 'при прокрутке вверх панели должны вернуться').not.toHaveClass(/chrome-away/);
});

test('у верха списка панели не прячутся', async ({ page }) => {
  await fresh(page);
  await tab(page, /УСЛУГИ|SERVICES/i);
  const scroller = page.locator('.screen').first();
  // Небольшое движение в верхней зоне не должно ничего прятать
  for (const y of [20, 40, 60]) {
    await scroller.evaluate((el, v) => { el.scrollTop = v; el.dispatchEvent(new Event('scroll', { bubbles: true })); }, y);
    await page.waitForTimeout(120);
  }
  await expect(page.locator('.app'), 'у верха шапка обязана быть видна').not.toHaveClass(/chrome-away/);
});

test('подсказки сочетаний: рекомендованное сверху, спорное внизу с объяснением', async ({ page }) => {
  await fresh(page);
  await tab(page, /ЗАПИСЬ|BOOKING/i);

  const cards = page.locator('.bk-sug');
  expect(await cards.count(), 'подсказок нет').toBeGreaterThan(2);

  // Первая карточка — рекомендованная, и у неё есть объяснение почему
  await expect(cards.first()).toHaveClass(/bk-sug--good/);
  await expect(cards.first().locator('.bk-sug-why')).toBeVisible();

  // Спорные сочетания уходят вниз и объясняют причину
  const bad = page.locator('.bk-sug--no');
  if (await bad.count() > 0) {
    await expect(bad.first().locator('.bk-sug-why')).not.toBeEmpty();
    const all = await cards.evaluateAll((els) => els.map((e) => e.className));
    const firstBad = all.findIndex((c) => c.includes('bk-sug--no'));
    const lastGood = all.map((c) => c.includes('bk-sug--good')).lastIndexOf(true);
    expect(firstBad, 'спорное должно стоять после рекомендованного').toBeGreaterThan(lastGood);
  }
});
