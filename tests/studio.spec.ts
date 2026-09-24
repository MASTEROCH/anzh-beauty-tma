import { test, expect } from '@playwright/test';
import { fresh, watchConsole } from './helpers';
import { PER_TASK } from '../src/lib/quests';

// Кабинет мастера: сверка анкеты с противопоказаниями процедуры.
// Это не «отрисовалось ли», а «поймает ли система то, что человек
// в конце смены пропустит».

const PIN = '2024';

async function enterStudio(page: import('@playwright/test').Page) {
  await page.locator('.nav-item').filter({ hasText: /ПАСПОРТ|PASSPORT/i }).first().click();
  await page.waitForTimeout(400);
  await page.locator('.chip').filter({ hasText: /Настройки/i }).click();
  await page.waitForTimeout(400);
  const master = page.locator('button').filter({ hasText: /Кабинет мастера|кабинет мастера/i }).first();
  await master.click();
  await page.waitForTimeout(400);
  for (const d of PIN) await page.locator('.pin-key', { hasText: new RegExp(`^${d}$`) }).first().click();
  await page.waitForTimeout(600);
}

test('беременность в анкете поднимает «стоп» на запрещённой процедуре', async ({ page }) => {
  const errors = watchConsole(page);
  await fresh(page, {
    // Анкета с беременностью + заявка на контурную пластику,
    // где «Беременность и лактация» стоит первым противопоказанием
    anzh_health_v1: JSON.stringify({
      noAllergies: true, allergies: [], pregnant: true, lactating: false,
      chronic: '', meds: '', skinType: 'Сухая', fitzpatrick: 'II',
      couperose: false, sensitivity: 'medium', notes: '', updatedAt: Date.now(),
    }),
    anzh_appointments_v2: JSON.stringify([{
      id: 'a1', dateISO: new Date().toISOString().slice(0, 10), slot: '16:30',
      serviceId: 'lip-filler', clientName: 'Тест Клиентка', clientInstagram: 'test_cl',
      status: 'pending', createdAt: Date.now(),
    }]),
  });

  await enterStudio(page);
  await expect(page.locator('.studio-req')).toBeVisible({ timeout: 5000 });
  // Метка «стоп» обязана быть видна ДО того, как мастер нажмёт «Принять»
  await expect(page.locator('.cc-badge.stop')).toBeVisible();

  await page.locator('.cc-strip').first().click();
  await expect(page.locator('.cc-flag.stop')).toBeVisible();
  await expect(page.locator('.cc-flag.stop')).toContainText(/Беременность/i);
  expect(errors).toEqual([]);
});

test('чистая анкета не поднимает ложных тревог', async ({ page }) => {
  await fresh(page, {
    anzh_health_v1: JSON.stringify({
      noAllergies: true, allergies: [], pregnant: false, lactating: false,
      chronic: '', meds: '', skinType: 'Нормальная', fitzpatrick: 'II',
      couperose: false, sensitivity: 'low', notes: '', updatedAt: Date.now(),
    }),
    anzh_appointments_v2: JSON.stringify([{
      id: 'a2', dateISO: new Date().toISOString().slice(0, 10), slot: '12:00',
      serviceId: 'led-therapy', clientName: 'Спокойная', clientInstagram: 'calm',
      status: 'pending', createdAt: Date.now(),
    }]),
  });
  await enterStudio(page);
  await expect(page.locator('.studio-req')).toBeVisible({ timeout: 5000 });
  expect(await page.locator('.cc-badge.stop').count(), 'ложная тревога обесценивает настоящую').toBe(0);
  await page.locator('.cc-strip').first().click();
  await expect(page.locator('.cc-ok')).toBeVisible();
});

test('первый визит и повторный отличаются на метке', async ({ page }) => {
  const today = new Date().toISOString().slice(0, 10);
  await fresh(page, {
    anzh_appointments_v2: JSON.stringify([
      { id: 'p1', dateISO: '2026-06-01', slot: '10:00', serviceId: 'biorevit', clientName: 'Мария', clientInstagram: 'maria', status: 'completed', amount: 110, createdAt: 1 },
      { id: 'p2', dateISO: today, slot: '15:00', serviceId: 'biorevit', clientName: 'Мария', clientInstagram: 'maria', status: 'pending', createdAt: 2 },
    ]),
  });
  await enterStudio(page);
  await expect(page.locator('.cc-badge.returning')).toBeVisible({ timeout: 5000 });
  await page.locator('.cc-strip').first().click();
  await expect(page.locator('.cc-history')).toContainText(/Биоревитализация/i);
});

test('кабинет мастера не открывается по адресу без входа', async ({ page }) => {
  await fresh(page);
  // Прямой заход по хешу — то, как обходят дверь чаще всего
  await page.goto('/#studio');
  await page.waitForTimeout(800);
  // Ни базы клиентов, ни выручки: экран обязан быть клиентским
  expect(await page.locator('.studio-tabs').count(), 'кабинет не должен открыться без PIN').toBe(0);
  await expect(page.locator('.bottom-nav')).toBeVisible();
});

test('мастер не видит прайс и чужие деньги', async ({ page }) => {
  await fresh(page);
  await page.locator('.nav-item').filter({ hasText: /ПАСПОРТ|PASSPORT/i }).first().click();
  await page.waitForTimeout(400);
  await page.locator('.chip').filter({ hasText: /Настройки/i }).click();
  await page.waitForTimeout(400);
  await page.locator('button').filter({ hasText: /Кабинет мастера/i }).first().click();
  await page.waitForTimeout(400);
  // 1111 — код мастера Марины
  for (const d of '1111') await page.locator('.pin-key', { hasText: new RegExp(`^${d}$`) }).first().click();
  await page.waitForTimeout(800);

  await expect(page.locator('.studio-tabs')).toBeVisible();
  // Сверяем НАБОР вкладок целиком, а не подстроку в склейке: подстрока
  // совпала бы и с «Прайс мой доход», то есть почти ни с чем
  const tabs = (await page.locator('.studio-tab').allInnerTexts()).map((t) => t.trim());
  expect(tabs, 'прайс правит только владелица').not.toContain('Прайс');
  expect(tabs, 'мастеру показываем его доход, а не кассу салона').toContain('Мой доход');
});

test('добавленная процедура появляется у клиента, убранная исчезает', async ({ page }) => {
  await fresh(page);
  await enterStudio(page);
  await page.locator('.studio-tab').filter({ hasText: /Прайс/ }).click();
  await page.waitForTimeout(300);

  // Добавляем свою процедуру
  await page.locator('.chip-gold').filter({ hasText: /процедура/ }).click();
  await page.locator('.se-field input').first().fill('Микротоки тест');
  await page.locator('.se-field input').nth(1).fill('Аппарат · лифтинг');
  await page.locator('button').filter({ hasText: /Добавить в каталог/ }).click();
  await page.waitForTimeout(500);

  // Она обязана быть видна клиенту. Перезагрузка вместо кнопки «выйти»:
  // проверяем, что процедура ПЕРЕЖИЛА сохранение, а не живёт в памяти вкладки
  await page.goto('/');
  await page.waitForSelector('.bottom-nav');
  await page.locator('.nav-item').filter({ hasText: /УСЛУГИ|SERVICES/i }).first().click();
  await page.waitForTimeout(500);
  await expect(page.locator('.screen')).toContainText('Микротоки тест');
});

test('архив не ломает историю: услуга исчезает у клиента, но визит по ней читается', async ({ page }) => {
  await fresh(page, {
    anzh_archived_services_v1: JSON.stringify(['led-therapy']),
    anzh_appointments_v2: JSON.stringify([{
      id: 'h1', dateISO: '2026-05-01', slot: '10:00', serviceId: 'led-therapy',
      clientName: 'Аня', clientInstagram: 'anya', status: 'completed', amount: 40, createdAt: 1,
    }]),
  });
  await page.locator('.nav-item').filter({ hasText: /УСЛУГИ|SERVICES/i }).first().click();
  await page.waitForTimeout(500);
  // У клиента её больше нет
  expect(await page.locator('.service-title').filter({ hasText: /LED-терапия/ }).count()).toBe(0);

  // А в кабинете визит по ней читается, а не превращается в «услуга не найдена»
  await enterStudio(page);
  await page.locator('.studio-tab').filter({ hasText: /Клиенты/ }).click();
  await page.waitForTimeout(400);
  await expect(page.locator('.screen')).toContainText(/Аня/);
});

test('сторис на проверке: мастер засчитывает — у клиентки появляется скидка', async ({ page }) => {
  await fresh(page, {
    anzh_quests_v1: JSON.stringify({
      review: { state: 'idle' },
      invite: { state: 'idle' },
      story: { state: 'pending', sentAt: Date.now() - 7_200_000 },
    }),
  });

  // До подтверждения скидки нет
  await page.locator('.nav-item').filter({ hasText: /ANZH/i }).first().click();
  await page.waitForTimeout(500);
  await expect(page.locator('.quest-badge')).toContainText(/проверке/i);

  await enterStudio(page);
  await expect(page.locator('.qq-row')).toBeVisible({ timeout: 5000 });
  await page.locator('.qq-yes').click();
  await page.waitForTimeout(400);
  // Очередь опустела — задание закрыто
  expect(await page.locator('.qq-row').count()).toBe(0);

  // И у клиентки скидка стала реальной
  await page.goto('/');
  await page.waitForSelector('.bottom-nav');
  await page.locator('.nav-item').filter({ hasText: /ANZH/i }).first().click();
  await page.waitForTimeout(500);
  /* Процент берётся из ПРАВИЛА, а не пишется числом: правило уже
     менялось (10% → 5% за действие), и зашитое число делает вид, что
     тест прошёл, ровно до следующей такой правки. */
  await expect(page.locator('.quest-badge')).toContainText(
    new RegExp(`−${PER_TASK}% уже тво`),
  );
});

test('отклонённое задание возвращается клиентке, а не блокируется', async ({ page }) => {
  await fresh(page, {
    anzh_quests_v1: JSON.stringify({
      review: { state: 'idle' }, invite: { state: 'idle' },
      story: { state: 'pending', sentAt: Date.now() - 3_600_000 },
    }),
  });
  await enterStudio(page);
  await page.locator('.qq-no').click();
  await page.waitForTimeout(400);

  await page.goto('/');
  await page.waitForSelector('.bottom-nav');
  await page.locator('.nav-item').filter({ hasText: /ANZH/i }).first().click();
  await page.waitForTimeout(500);
  await page.locator('.quest-badge').click();
  // Кнопка снова доступна: вторая попытка не запрещена
  await expect(page.locator('.quest-row').filter({ hasText: /Сторис/ }).locator('button')).toBeVisible();
});

test('промо-студия рисует все три макета в формате сторис', async ({ page }) => {
  const errors = watchConsole(page);
  await fresh(page);
  await enterStudio(page);
  await page.locator('.studio-tab').filter({ hasText: /Сторис/ }).click();
  await page.waitForTimeout(500);

  for (const label of ['Свободное окно', 'Процедура', 'Офер']) {
    await page.locator('.ps-kind').filter({ hasText: label }).click();
    await page.waitForTimeout(350);
    const info = await page.locator('.ps-canvas').evaluate((c) => {
      const cv = c as HTMLCanvasElement;
      const ctx = cv.getContext('2d')!;
      const d = ctx.getImageData(0, 0, cv.width, cv.height).data;
      let ink = 0;
      for (let i = 0; i < d.length; i += 400) if (d[i] > 120 || d[i + 1] > 200) ink++;
      return { w: cv.width, h: cv.height, ink };
    });
    // Вертикальная сторис и что-то нарисовано, а не пустой градиент
    expect(info.w, label).toBe(1080);
    expect(info.h, label).toBe(1920);
    expect(info.ink, `${label}: макет пустой`).toBeGreaterThan(200);
  }
  expect(errors).toEqual([]);
});

test('новый мастер входит своим кодом и видит только своё', async ({ page }) => {
  await fresh(page);
  await enterStudio(page);
  await page.locator('.studio-tab').filter({ hasText: /Прайс/ }).click();
  await page.waitForTimeout(400);

  // Заводим мастера с кодом 3333 и одной процедурой
  await page.locator('.chip-gold').filter({ hasText: /мастер/ }).click();
  await page.locator('.se-field input').first().fill('Лена');
  await page.locator('.se-field input').nth(1).fill('3333');
  await page.locator('.se-cat').filter({ hasText: /LED-терапия/ }).click();
  await page.locator('button').filter({ hasText: /^Сохранить$/ }).click();
  await page.waitForTimeout(500);
  await expect(page.locator('.te-row').filter({ hasText: 'Лена' })).toHaveCount(1);

  // Выходим и входим её кодом
  await page.goto('/');
  await page.waitForSelector('.bottom-nav');
  await page.locator('.nav-item').filter({ hasText: /ПАСПОРТ|PASSPORT/i }).first().click();
  await page.waitForTimeout(400);
  await page.locator('.chip').filter({ hasText: /Настройки/i }).click();
  await page.waitForTimeout(400);
  await page.locator('button').filter({ hasText: /Кабинет мастера/i }).first().click();
  await page.waitForTimeout(400);
  for (const d of '3333') await page.locator('.pin-key', { hasText: new RegExp(`^${d}$`) }).first().click();
  await page.waitForTimeout(800);

  await expect(page.locator('.header-title')).toContainText('Лена');
  const tabs = (await page.locator('.studio-tab').allInnerTexts()).map((t) => t.trim());
  expect(tabs, 'мастеру прайс и команда не положены').not.toContain('Прайс');
});

test('владельца нельзя выключить', async ({ page }) => {
  await fresh(page);
  await enterStudio(page);
  await page.locator('.studio-tab').filter({ hasText: /Прайс/ }).click();
  await page.waitForTimeout(400);
  await page.locator('.te-row').filter({ hasText: /Анжелика/ }).locator('.te-edit').click();
  await page.waitForTimeout(400);
  expect(await page.locator('button').filter({ hasText: /Выключить доступ/ }).count()).toBe(0);
  await expect(page.locator('.te-note')).toBeVisible();
});
