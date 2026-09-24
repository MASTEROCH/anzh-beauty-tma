import { test, expect, type Page } from '@playwright/test';
import { fresh } from './helpers';

/*
   КАБИНЕТ: то, ради чего он существует.

   Жалоба, с которой всё началось: мастер вошёл и увидел пустой экран.
   Код при этом работал правильно — он фильтрует записи по мастеру, а в
   демо-базе не было ни одной процедуры, которую ведёт Марина. Пустой
   кабинет у половины команды читается как недоделанный продукт, и это
   дефект, даже когда логика верна. Поэтому первый тест здесь — про то,
   что работа есть у каждого.
*/

async function gate(page: Page, who: RegExp, pin: string) {
  await page.locator('.nav-item').filter({ hasText: /ПАСПОРТ|PASSPORT/i }).first().click();
  await page.waitForTimeout(400);
  await page.locator('.chip').filter({ hasText: /Настройки/i }).click();
  await page.waitForTimeout(400);
  await page.locator('button').filter({ hasText: /Кабинет мастера/i }).first().click();
  await page.waitForTimeout(400);
  await page.locator('.gate-person').filter({ hasText: who }).first().click();
  await page.waitForTimeout(300);
  for (const d of pin) await page.locator('.pin-key', { hasText: new RegExp(`^${d}$`) }).first().click();
  await page.waitForSelector('.studio-nav', { timeout: 10_000 });
  await page.waitForTimeout(500);
}

const go = async (page: Page, nav: RegExp, sub?: RegExp) => {
  await page.locator('.studio-nav-item').filter({ hasText: nav }).first().click();
  await page.waitForTimeout(400);
  if (sub) {
    await page.locator('.studio-sub .chip').filter({ hasText: sub }).first().click();
    await page.waitForTimeout(400);
  }
};

test('🚨 у КАЖДОГО мастера в кабинете есть работа, а не пустой экран', async ({ page }) => {
  for (const [who, pin] of [['Марина', '1111'], ['Нино', '2222'], ['Анжелика', '2024']] as const) {
    await fresh(page);
    await gate(page, new RegExp(who), pin);

    const body = await page.locator('.screen').innerText();
    expect(body, `${who}: заявок нет — кабинет выглядит недоделанным`)
      .not.toMatch(/Новых заявок нет/);

    await go(page, /Клиенты/);
    const clients = await page.locator('.studio-day-row').count();
    expect(clients, `${who}: база клиентов пуста`).toBeGreaterThan(0);
  }
});

test('вход двухшаговый: чужой код под своим именем не пускает', async ({ page }) => {
  await fresh(page);
  await page.locator('.nav-item').filter({ hasText: /ПАСПОРТ|PASSPORT/i }).first().click();
  await page.waitForTimeout(400);
  await page.locator('.chip').filter({ hasText: /Настройки/i }).click();
  await page.waitForTimeout(400);
  await page.locator('button').filter({ hasText: /Кабинет мастера/i }).first().click();
  await page.waitForTimeout(400);

  // Выбираем Марину, но набираем код Анжелики
  await page.locator('.gate-person').filter({ hasText: /Марина/ }).first().click();
  await page.waitForTimeout(300);
  for (const d of '2024') await page.locator('.pin-key', { hasText: new RegExp(`^${d}$`) }).first().click();
  await page.waitForTimeout(900);

  /* Раньше код искался по ВСЕЙ команде, и человек входил под чужим
     именем не заметив. Теперь код проверяется только против выбранного. */
  expect(await page.locator('.studio-nav').count(), 'чужой код не должен пускать').toBe(0);
});

test('команда: назначенный код убирает подсказку на входе', async ({ page }) => {
  await fresh(page);
  await gate(page, /Анжелика/, '2024');
  await go(page, /Студия/, /Команда/);

  await expect(page.locator('.team-row').filter({ hasText: /Марина/ }))
    .toContainText(/код заводской/);

  await page.locator('.team-row').filter({ hasText: /Марина/ }).click();
  await page.waitForTimeout(400);
  await page.locator('button').filter({ hasText: /Назначить код/ }).click();
  await page.waitForTimeout(400);
  await page.locator('.input').first().fill('7451');
  await page.locator('button').filter({ hasText: /^Назначить$/ }).click();
  await page.waitForTimeout(700);

  // Пометка ушла — код больше не заводской
  await expect(page.locator('.team-row').filter({ hasText: /Марина/ }))
    .not.toContainText(/код заводской/);

  // И подсказки на входе для неё тоже нет
  await page.locator('.studio-exit').click();
  await page.waitForTimeout(500);
  await page.locator('.chip').filter({ hasText: /Настройки/i }).click();
  await page.waitForTimeout(400);
  await page.locator('button').filter({ hasText: /Кабинет мастера/i }).first().click();
  await page.waitForTimeout(400);
  await page.locator('.gate-person').filter({ hasText: /Марина/ }).first().click();
  await page.waitForTimeout(400);
  expect(await page.locator('.gate-hint').count(), 'код сменили — подсказка обязана исчезнуть').toBe(0);
});

test('команда: заводского кода не назначить — он ходил по переписке', async ({ page }) => {
  await fresh(page);
  await gate(page, /Анжелика/, '2024');
  await go(page, /Студия/, /Команда/);
  await page.locator('.team-row').filter({ hasText: /Нино/ }).click();
  await page.waitForTimeout(400);
  await page.locator('button').filter({ hasText: /Назначить код/ }).click();
  await page.waitForTimeout(400);
  await page.locator('.input').first().fill('1111');
  await page.locator('button').filter({ hasText: /^Назначить$/ }).click();
  await page.waitForTimeout(400);
  await expect(page.locator('.form-why')).toContainText(/известен из переписки/);
});

test('акции: создать и запустить', async ({ page }) => {
  await fresh(page);
  await gate(page, /Анжелика/, '2024');
  await go(page, /Студия/, /Акции/);

  await page.locator('.chip-gold').filter({ hasText: /акция/ }).click();
  await page.waitForTimeout(400);
  await page.locator('.field input').first().fill('Осенний карбон');
  await page.locator('button').filter({ hasText: /^Создать$/ }).click();
  await page.waitForTimeout(700);

  const row = page.locator('.promo-row').filter({ hasText: 'Осенний карбон' });
  await expect(row).toHaveCount(1);
  // Создана — но ещё НЕ идёт: запуск это отдельное решение
  await expect(row).toContainText(/остановлена/);

  await row.locator('.promo-switch').click();
  await page.waitForTimeout(500);
  await expect(row).toContainText(/идёт/);
});

test('отзывы: фильтр «низкие» показывает то, на что надо ответить', async ({ page }) => {
  await fresh(page);
  await gate(page, /Анжелика/, '2024');
  await go(page, /Студия/, /Отзывы/);

  await page.locator('.rv-filters .chip').filter({ hasText: /Низкие/ }).click();
  await page.waitForTimeout(500);

  const cards = page.locator('.rv');
  const n = await cards.count();
  expect(n, 'в демо-базе есть отзыв на тройку').toBeGreaterThan(0);

  /* Все до одного — три звезды и ниже. Фильтр, пропускающий пятёрки,
     бесполезен ровно в тот момент, когда им пользуются. */
  for (let i = 0; i < n; i++) {
    const stars = await cards.nth(i).locator('.rv-stars').innerText();
    const filled = stars.replace(/[^★]/g, '').length - stars.split('☆').length + 1;
    expect(filled, 'в срезе «низкие» не должно быть высоких оценок').toBeLessThanOrEqual(6);
  }
});

test('отзыв уходит на витрину и исчезает из новых', async ({ page }) => {
  await fresh(page);
  await gate(page, /Анжелика/, '2024');
  await go(page, /Студия/, /Отзывы/);

  const before = await page.locator('.rv').count();
  await page.locator('.rv').first().locator('.chip-gold').filter({ hasText: /На витрину/ }).click();
  await page.waitForTimeout(600);
  expect(await page.locator('.rv').count(), 'разобранный отзыв уходит из «новых»').toBe(before - 1);
});

test('чаты: написанное помечено «ждёт отправки», а не «доставлено»', async ({ page }) => {
  await fresh(page);
  await gate(page, /Анжелика/, '2024');
  await go(page, /Клиенты/, /Переписка/);

  await page.locator('.chat-row').first().click();
  await page.waitForTimeout(500);
  await page.locator('.chat-compose textarea').fill('Катя, 14:00 освободилось — беру вас?');
  await page.locator('button').filter({ hasText: /В очередь на отправку/ }).click();
  await page.waitForTimeout(600);

  /* Ложное «доставлено» опаснее отсутствия функции: мастер решит, что
     клиентка предупреждена, и не позвонит. Бота пока нет — так и пишем. */
  await expect(page.locator('.chat-msg.mine').last()).toContainText(/ждёт отправки/);
});

test('выручка по клиенткам: сумма строк сходится с итогом', async ({ page }) => {
  await fresh(page);
  await gate(page, /Анжелика/, '2024');
  await go(page, /Клиенты/, /По выручке/);

  const money = (s: string) => Number(s.replace(/[^\d]/g, '')) || 0;
  const total = money(await page.locator('.cr-total').innerText());
  const rows = await page.locator('.cr-sum').allInnerTexts();
  const sum = rows.reduce((acc, t) => acc + money(t), 0);

  expect(rows.length, 'за 90 дней есть выполненные визиты').toBeGreaterThan(0);
  expect(sum, 'итог обязан быть суммой строк, иначе цифре нельзя верить').toBe(total);
});

test('мастер не видит кассу салона и чужой прайс', async ({ page }) => {
  await fresh(page);
  await gate(page, /Нино/, '2222');

  /* Сверяем НАБОР подписей целиком. Подстрока «Доход» совпала бы и
     внутри «Мой доход за год», и внутри чего угодно ещё; набор —
     не совпадёт ни с чем, кроме себя. Счётчики со значка срезаем. */
  const nav = (await page.locator('.studio-nav-item').allInnerTexts())
    .map((t) => t.replace(/\d+\+?/g, '').trim());
  expect(nav).toEqual(['Заявки', 'День', 'Клиенты', 'Доход', 'Студия']);

  await go(page, /Студия/);
  const subs = (await page.locator('.studio-sub .chip').allInnerTexts()).join(' ');
  expect(subs, 'прайс правит владелица').not.toMatch(/Прайс/);
  expect(subs, 'команду ведёт владелица').not.toMatch(/Команда/);
});

test('🚨 хром кабинета не едет вместе с контентом', async ({ page }) => {
  await fresh(page);
  await gate(page, /Анжелика/, '2024');

  const geom = () => page.evaluate(() => {
    const n = document.querySelector('.studio-nav')!.getBoundingClientRect();
    const el = document.querySelector('.studio-exit') as HTMLElement;
    const e = el.getBoundingClientRect();
    return {
      navTop: Math.round(n.top),
      navBottom: Math.round(n.bottom),
      exitTop: Math.round(e.top),
      exitShown: Number(getComputedStyle(el).opacity) > 0.05,
      vh: window.innerHeight,
    };
  });

  const rest = await geom();
  await page.locator('.screen').evaluate((e) => { e.scrollTop = 700; });
  await page.waitForTimeout(800);
  const scrolled = await geom();

  /* Дефект выглядел так: навигация кабинета оказывалась ПОСРЕДИ экрана
     после прокрутки, а «Выйти» уезжал за верхний край. Причина — оба
     лежали внутри `.screen`, то есть внутри прокручиваемого элемента.
     Клиентский таббар этого не знал, потому что всегда жил в `.app`. */
  expect(scrolled.navTop, 'навигация уехала вместе с контентом').toBe(rest.navTop);
  expect(scrolled.navBottom, 'навигация обязана оставаться над нижним краем')
    .toBeLessThanOrEqual(scrolled.vh);
  expect(scrolled.navTop, 'навигация всплыла в середину экрана')
    .toBeGreaterThan(scrolled.vh - 140);
  /* «Выйти» — часть строки шапки и ездит вместе с ней. Правило не
     «всегда на экране», а «никогда не висит над контентом сиротой»:
     либо он наверху, либо спрятан заодно с шапкой. Раньше он ни того ни
     другого — уезжал вверх вместе с прокруткой, оставаясь видимым
     поверх карточек. */
  expect(
    scrolled.exitTop >= 0 || !scrolled.exitShown,
    '«Выйти» висит над контентом: не наверху и при этом виден',
  ).toBe(true);
});

test('🚨 вуаль клиентского таббара не накрывает кабинет', async ({ page }) => {
  await fresh(page);
  await gate(page, /Анжелика/, '2024');

  /* `.nav-veil` висит на `.app` с z-index 199, а `.studio-nav` лежала
     внутри `.screen` (z-index: 1) — её собственные 200 действовали
     только внутри экрана. Вуаль размывала навигацию кабинета целиком:
     из-под полосы еле проступали иконки. */
  const covered = await page.evaluate(() => {
    const nav = document.querySelector('.studio-nav')!.getBoundingClientRect();
    const x = nav.left + nav.width / 2;
    const y = nav.top + nav.height / 2;
    const top = document.elementFromPoint(x, y);
    return {
      clientVeil: !!document.querySelector('.nav-veil'),
      topIsNav: !!top?.closest('.studio-nav'),
    };
  });

  expect(covered.clientVeil, 'клиентская вуаль в кабинете лишняя').toBe(false);
  expect(covered.topIsNav, 'поверх навигации кабинета что-то лежит').toBe(true);
});
