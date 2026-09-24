import { test, expect, devices, type Page } from '@playwright/test';
import { fresh, tab } from './helpers';

/*
   БЕЗОПАСНАЯ ЗОНА НА ANDROID.
   
   Жалоба звучала так: «кнопки улетают под системную панель и нажать
   невозможно». Дефект живёт в двадцати пикселях у нижнего края и только
   на устройстве с панелью навигации — глазами его ловить ненадёжно, а
   на симуляторе без панели он не воспроизводится вовсе.

   Поэтому панель воспроизводится честно: Telegram сообщает высоту
   безопасной зоны числом (`safeAreaInset`, Bot API 8.0+), и приложение
   кладёт её в `--tg-inset-bottom`. Тест выставляет эту переменную и
   проверяет ОДНО свойство, которое и есть суть жалобы:

     ни один элемент, на который человек должен нажать, не заходит
     нижним краем в безопасную зону.

   Всё остальное — размеры, отступы, красота — проверяется в другом
   месте. Здесь только «можно ли нажать».
*/

const NAV_BAR = 48;   // трёхкнопочная панель Android, типичная высота
const GESTURE = 24;   // жестовая полоса

/** Telegram сообщил про системную панель — как на настоящем Android.

   🚨 Ставится ПОСЛЕ загрузки приложения, а не в addInitScript.
   Причина найдена замером: `telegram-web-app.js` подключён в index.html
   и в обычном браузере тоже создаёт `Telegram.WebApp` — только все
   отступы в нём нулевые. `initTelegram()` послушно переписывает
   `--tg-inset-bottom` в `0px`, затирая всё, что тест выставил раньше.
   Тест при этом продолжал бы утверждать, что панель есть, и мерил бы
   телефон без панели. */
async function withNavBar(page: Page, inset: number) {
  await page.evaluate((px) => {
    document.documentElement.style.setProperty('--tg-inset-bottom', `${px}px`);
  }, inset);
  // Даём кадр на пересчёт позиций от новой переменной.
  await page.waitForTimeout(80);
}

/** Всё, на что человек нажимает: кнопки, поля, элементы навигации */
const TAPPABLE = 'button, a[href], input, textarea, [role="button"], .nav-item';

/* Докручиваем КАЖДЫЙ прокручиваемый контейнер до конца.

   Без этого правило получается неверным в обе стороны. Элемент внутри
   прокрутки может лежать ниже сгиба — это не дефект, до него доедут
   пальцем; первая версия теста ругалась на невидимые зоны карусели,
   уходящие на 427px вниз. И наоборот: настоящий дефект — это когда
   доскроллил до упора, а кнопка ВСЁ РАВНО под панелью. Именно про это
   жалоба, и проверять надо именно это. */
async function scrollEverythingToEnd(page: Page) {
  await page.evaluate(() => {
    const all = [document.scrollingElement, ...Array.from(document.querySelectorAll('*'))];
    for (const el of all) {
      if (!(el instanceof HTMLElement)) continue;
      if (el.scrollHeight - el.clientHeight > 4) el.scrollTop = el.scrollHeight;
    }
  });
  await page.waitForTimeout(250);
}

async function offenders(page: Page, inset: number) {
  return page.evaluate(
    ({ sel, inset }) => {
      const limit = window.innerHeight - inset;
      const out: { text: string; cls: string; bottom: number; over: number }[] = [];
      for (const el of Array.from(document.querySelectorAll(sel))) {
        const r = el.getBoundingClientRect();
        // Невидимое и свёрнутое не считаем: спрятанная панель уезжает за
        // край намеренно, и это не дефект.
        if (r.width < 2 || r.height < 2) continue;
        const style = getComputedStyle(el as HTMLElement);
        if (style.visibility === 'hidden' || style.display === 'none') continue;
        if (Number(style.opacity) < 0.05) continue;
        if ((el as HTMLElement).closest('[aria-hidden="true"]')) continue;
        // Элемент целиком за нижним краем — он просто не на экране.
        if (r.top >= window.innerHeight) continue;
        if (r.bottom > limit + 0.5) {
          out.push({
            text: (el.textContent ?? '').trim().slice(0, 40),
            cls: (el as HTMLElement).className?.toString().slice(0, 60) ?? '',
            bottom: Math.round(r.bottom),
            over: Math.round(r.bottom - limit),
          });
        }
      }
      return { limit: Math.round(limit), out };
    },
    { sel: TAPPABLE, inset },
  );
}

test.use({ ...devices['Pixel 7'] });

for (const inset of [NAV_BAR, GESTURE]) {
  test(`панель ${inset}px: ни одна кнопка не уходит под неё`, async ({ page }) => {
    await fresh(page);
    await withNavBar(page, inset);

    for (const screen of [/О нас|About/i, /Услуги/i, /Запись/i, /Паспорт/i]) {
      await tab(page, screen);
      await scrollEverythingToEnd(page);
      const { limit, out } = await offenders(page, inset);
      expect(
        out,
        `экран ${screen}: за безопасной зоной (низ ≤ ${limit}px)\n` +
          out.map((o) => `  «${o.text}» .${o.cls} — на ${o.over}px ниже`).join('\n'),
      ).toEqual([]);
    }
  });
}

test('липкая кнопка экрана стоит НАД таббаром, а не на нём', async ({ page }) => {
  await fresh(page);
  await withNavBar(page, NAV_BAR);
  await tab(page, /Услуги/i);
  await page.locator('.service-card, .cat-card').first().click();
  await page.waitForTimeout(500);

  const cta = page.locator('.bottom-cta');
  if ((await cta.count()) === 0) test.skip(true, 'на этом экране липкой кнопки нет');

  const gap = await page.evaluate(() => {
    const c = document.querySelector('.bottom-cta')!.getBoundingClientRect();
    const n = document.querySelector('.bottom-nav')!.getBoundingClientRect();
    return Math.round(n.top - c.bottom);
  });
  // Ноль и меньше — кнопка лежит на таббаре: именно так выглядел дефект
  // на телефоне с жестовой полосой.
  expect(gap, 'зазор между липкой кнопкой и таббаром').toBeGreaterThanOrEqual(0);
});

test('шторка с кнопкой подтверждения не уходит под панель', async ({ page }) => {
  await fresh(page);
  await withNavBar(page, NAV_BAR);
  await tab(page, /Запись/i);
  await page.waitForTimeout(600);
  await scrollEverythingToEnd(page);

  const { limit, out } = await offenders(page, NAV_BAR);
  expect(out, `шторка записи: за безопасной зоной (низ ≤ ${limit}px)`).toEqual([]);
});

test('оболочка не меряется в vh — иначе Android уедет под панель', async ({ page }) => {
  await fresh(page);
  await withNavBar(page, NAV_BAR);

  /* 🚨 Здесь проверяется ПРИЧИНА, а не следствие.

     Следствие — «оболочка выше видимой области» — в headless не
     воспроизводится: системной панели нет, и 100vh равен innerHeight.
     Тест на него проходил бы и на сломанной вёрстке, то есть не
     значил бы ничего. Проверено прогоном на старой версии файла.

     Причина воспроизводится всегда: `100vh` — «большой» вьюпорт, он
     включает полосу под системной панелью. Правило простое: высоту
     оболочки задаёт динамический вьюпорт либо число от Telegram. */
  const rule = await page.evaluate(() => {
    for (const sheet of Array.from(document.styleSheets)) {
      let rules: CSSRule[];
      try { rules = Array.from(sheet.cssRules); } catch { continue; }
      for (const r of rules) {
        if (!(r instanceof CSSStyleRule)) continue;
        if (r.selectorText?.trim() !== '#root') continue;
        const h = r.style.getPropertyValue('height');
        if (h) return h;
      }
    }
    return null;
  });

  // Утверждаем содержимое, а не факт находки: пустая строка прошла бы
  // `not.toBeNull()` и правило осталось бы непроверенным.
  expect(rule ?? '', 'правило высоты #root не найдено').not.toBe('');
  /* Список допустимых значений целиком, а не поиск подстроки.
     `getPropertyValue` отдаёт ПОСЛЕДНЮЮ объявленную высоту — ту, что
     победит в каскаде, — и вариантов у неё ровно два. Подстрока «dvh»
     нашлась бы и в мусоре; перечисление не оставляет места догадкам. */
  const ALLOWED = ['100dvh', 'var(--tg-viewport, 100dvh)'];
  expect(
    ALLOWED,
    `высота оболочки обязана приходить из dvh или от Telegram, получено «${rule}»`,
  ).toContain(rule!.trim());

  // И заодно: по факту она не выше видимой области.
  const over = await page.evaluate(
    () => document.getElementById('root')!.getBoundingClientRect().height - window.innerHeight,
  );
  expect(Math.round(over), '#root выше видимой области').toBeLessThanOrEqual(1);
});

/* ─── Точечно: три места, которые считали отступ сами ──────────────

   Общий обход экранов их не ловит: онбординг показывается только новому
   человеку, чат ассистента и шторка — это наложения поверх. А именно
   они и брали голый `env(safe-area-inset-bottom)`, который на Android
   равен нулю. Проверено прогоном на старой версии файла: без этих трёх
   тестов правка выглядела бы проверенной, не будучи ею. */

/** Низ элемента обязан остаться над панелью */
async function bottomOf(page: Page, selector: string) {
  return page.evaluate(
    (sel) => {
      const el = document.querySelector(sel);
      if (!el) return null;
      return Math.round(el.getBoundingClientRect().bottom);
    },
    selector,
  );
}

test('кнопка онбординга — первая кнопка человека — не под панелью', async ({ page }) => {
  // Онбординг видит только новый человек: флаг не ставим.
  await page.addInitScript(() => {
    try { localStorage.clear(); sessionStorage.setItem('__seeded', '1'); } catch { /* приватный режим */ }
  });
  await page.goto('/');
  await page.waitForSelector('.onb-cta', { timeout: 10_000 });
  await withNavBar(page, NAV_BAR);

  const limit = await page.evaluate(() => window.innerHeight - 48);
  const btn = await bottomOf(page, '.onb-cta .btn');
  expect(btn ?? 0, 'кнопки онбординга нет на экране').toBeGreaterThan(0);
  expect(btn!, `низ кнопки онбординга (панель на ${limit}px)`).toBeLessThanOrEqual(limit);
});

test('поле ввода ассистента и кнопка отправки — не под панелью', async ({ page }) => {
  await fresh(page);
  await withNavBar(page, NAV_BAR);

  /* force: шар пульсирует непрерывно, и Playwright ждёт «стабильности»
     элемента, которой не наступает никогда — клик отваливался по
     таймауту. Видимость и доступность шара при этом проверены отдельно
     строкой ниже, так что force здесь ничего не прячет. */
  const bubble = page.locator('.ai-bubble').first();
  await expect(bubble).toBeVisible();
  await expect(bubble).toBeEnabled();
  await bubble.click({ force: true });
  await page.waitForSelector('.ai-input-area', { timeout: 10_000 });
  await page.waitForTimeout(400);

  /* Меряем САМИ элементы управления, а не полосу ввода вокруг них.

     Полоса — наложение во весь экран, её нижний край и должен доходить
     до низа: она закрывает собой область под панелью, чтобы сквозь неё
     не просвечивал контент. Человек нажимает не на полосу, а на поле и
     на кнопку отправки — отступ внутри полосы поднимает именно их.
     Первая версия теста ругалась на полосу и была неправа. */
  const limit = await page.evaluate(() => window.innerHeight - 48);
  for (const sel of ['.ai-input-area textarea, .ai-input-area input', '.ai-send-btn']) {
    const b = await bottomOf(page, sel);
    /* Утверждаем ЗНАЧЕНИЕ, а не существование: `not.toBeNull()` проходит
       и на нуле, то есть на элементе, схлопнутом в точку у верхнего края
       — а это и есть «кнопки нет». Поймано jsguard. */
    expect(b, `${sel} не найден или схлопнут`).toBeGreaterThan(0);
    expect(b!, `низ ${sel} (панель на ${limit}px)`).toBeLessThanOrEqual(limit);
  }
});

/* Тест «кнопки в футере шторки» удалён намеренно: замером установлено,
   что карточка услуги открывает ЭКРАН с липкой кнопкой, а не шторку —
   этот путь уже проверяет тест «липкая кнопка стоит НАД таббаром».
   Дубль, который ничего не добавлял, но выглядел как покрытие. */

/* Низкий экран — Android-браузер с адресной строкой.

   Жалоба «внизу не видно строку» пришла со скриншота обычного Chrome:
   адресная строка сверху съедает высоту, и при `height: 100vh` оболочка
   оказывалась выше видимой области ровно на неё. Нижняя кнопка уходила
   за край, и доскроллить до неё было нельзя — она не в потоке, она
   прижата к низу оболочки.

   ⚠️ ЧЕСТНО О ГРАНИЦАХ ЭТОЙ ПРОВЕРКИ. Саму адресную строку в headless
   воспроизвести нельзя: там `100vh` равен высоте окна, и прогон на
   старой вёрстке этот тест ПРОХОДИТ. То есть настоящую причину он не
   ловит — её ловит тест «оболочка не меряется в vh» выше, и он на
   старой вёрстке падает.

   Здесь остаётся регрессия вёрстки: кнопка обязана помещаться целиком
   на низком экране, каким бы образом высота ни была получена. */
for (const height of [640, 720]) {
  test(`низкий экран ${height}px: кнопка онбординга видна целиком`, async ({ page }) => {
    await page.setViewportSize({ width: 412, height });
    await page.addInitScript(() => {
      try { localStorage.clear(); sessionStorage.setItem('__seeded', '1'); } catch { /* приватный режим */ }
    });
    await page.goto('/');
    await page.waitForSelector('.onb-cta .btn', { timeout: 10_000 });

    const box = await page.locator('.onb-cta .btn').first().boundingBox();
    // Тот же случай: нулевая коробка — это отсутствующая кнопка.
    expect(box?.height ?? 0, 'кнопки нет на экране').toBeGreaterThan(0);
    expect(
      Math.round(box!.y + box!.height),
      `низ кнопки при высоте экрана ${height}px`,
    ).toBeLessThanOrEqual(height);
    // И видна не полоской: кнопка должна помещаться целиком.
    expect(Math.round(box!.height), 'высота кнопки').toBeGreaterThanOrEqual(40);
  });
}
