import { test, expect } from '@playwright/test';
import { watchConsole, noHorizontalScroll } from './helpers';

// Мини-апп внутри Telegram: свой webview, свои отступы safe-area и свой
// initData. Проверить это на устройстве у меня нет возможности, но подменить
// то, что отдаёт SDK, — есть. Тест ловит главное: инициализацию, вставки
// в CSS-переменные и то, что нижний контент не уезжает под панель.

const INSET_BOTTOM = 34; // жестовая полоса iPhone
const INSET_TOP = 54;

async function asTelegram(page: import('@playwright/test').Page) {
  await page.addInitScript(({ top, bottom }) => {
    try { localStorage.clear(); localStorage.setItem('anzh_onboarded', '1'); } catch { /* ignore */ }
    const events: Record<string, Array<() => void>> = {};
    /* Настоящий telegram-web-app.js подключён в index.html и выполняется
       ПОСЛЕ этого скрипта — он перетирал подмену своим пустым объектом.
       Запираем свойство: SDK попробует присвоить и не сможет. */
    const fake = {
      WebApp: {
        initData: 'query_id=AAE&user=%7B%22id%22%3A42%7D&auth_date=1',
        initDataUnsafe: { user: { id: 42, first_name: 'Маша', username: 'masha', language_code: 'ru' } },
        platform: 'ios',
        version: '7.0',
        viewportStableHeight: 780,
        safeAreaInset: { top, bottom, left: 0, right: 0 },
        contentSafeAreaInset: { top, bottom: 0, left: 0, right: 0 },
        ready() {}, expand() {}, disableVerticalSwipes() {},
        setHeaderColor() {}, setBackgroundColor() {},
        openLink(url: string) { (window as unknown as { __opened: string }).__opened = url; },
        onEvent(name: string, cb: () => void) { (events[name] ??= []).push(cb); },
        HapticFeedback: { impactOccurred() {}, notificationOccurred() {}, selectionChanged() {} },
      },
    };
    Object.freeze(fake.WebApp);
    Object.defineProperty(window, 'Telegram', {
      value: Object.freeze(fake), writable: false, configurable: false,
    });
  }, { top: INSET_TOP, bottom: INSET_BOTTOM });
}

test('внутри Telegram: вставки доезжают до CSS и низ не обрезан', async ({ page }) => {
  const errors = watchConsole(page);
  await asTelegram(page);
  await page.goto('/');
  await page.waitForSelector('.bottom-nav', { timeout: 10_000 });

  const vars = await page.evaluate(() => {
    const cs = getComputedStyle(document.documentElement);
    return {
      top: cs.getPropertyValue('--tg-inset-top').trim(),
      bottom: cs.getPropertyValue('--tg-inset-bottom').trim(),
      platform: document.documentElement.getAttribute('data-tg'),
    };
  });
  expect(vars.platform, 'платформа не проставлена').toBe('ios');
  expect(vars.bottom, 'нижняя вставка не доехала до CSS').toBe(`${INSET_BOTTOM}px`);
  expect(vars.top).toBe(`${INSET_TOP}px`);

  // Последний элемент списка обязан быть выше панели, а не под ней
  for (const re of [/ПРОФИЛЬ|PROFILE/i, /УСЛУГИ|SERVICES/i, /ПАСПОРТ|PASSPORT/i]) {
    await page.locator('.nav-item').filter({ hasText: re }).first().click();
    await page.waitForTimeout(450);
    await noHorizontalScroll(page);

    const clear = await page.evaluate(() => {
      const screen = document.querySelector('.screen');
      const nav = document.querySelector('.bottom-nav');
      if (!screen || !nav) return null;
      screen.scrollTop = screen.scrollHeight;
      const pad = parseFloat(getComputedStyle(screen).paddingBottom);
      return { pad, navH: nav.getBoundingClientRect().height };
    });
    expect(clear, 'нет экрана или панели').not.toBe(null);
    // Отступ обязан перекрывать панель ВМЕСТЕ с жестовой полосой
    expect(clear!.pad, 'нижний отступ меньше панели + safe-area')
      .toBeGreaterThanOrEqual(clear!.navH + INSET_BOTTOM);
  }
  /* Единственное исключение — и оно про стенд, а не про продукт: настоящий
     telegram-web-app.js не может инициализироваться, потому что мы заперли
     window.Telegram своей подменой. Глушим ровно это сообщение, остальные
     ошибки по-прежнему валят тест. */
  expect(errors.filter((e) => !e.includes('WebView.initParams'))).toEqual([]);
});

test('внутри Telegram: имя и язык берутся из клиента, ссылки открываются им же', async ({ page }) => {
  await asTelegram(page);
  await page.goto('/');
  await page.waitForSelector('.bottom-nav');

  // Внешняя ссылка должна уйти в openLink Telegram, а не в новое окно
  const opened = await page.evaluate(async () => {
    const mod = await import('/src/lib/telegram.ts');
    (mod as { openExternal: (u: string) => void }).openExternal('https://instagram.com/dr.domnich');
    return (window as unknown as { __opened?: string }).__opened;
  });
  expect(opened, 'ссылка ушла мимо Telegram').toBe('https://instagram.com/dr.domnich');
});
