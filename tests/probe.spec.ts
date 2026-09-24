import { test } from '@playwright/test';
import { fresh, tab } from './helpers';

// Разведочный прогон: показывает, КАКИЕ именно контролы мелкие.
// Не утверждение — инструмент, поэтому в общий набор не входит (@probe).
test('@probe мелкие мишени по классам', async ({ page }) => {
  await fresh(page);
  for (const [name, re] of [
    ['ПРОФИЛЬ', /О НАС|ABOUT/i], ['УСЛУГИ', /УСЛУГИ|SERVICES/i],
    ['ЗАПИСЬ', /ЗАПИСЬ|BOOKING/i], ['ПАСПОРТ', /ПАСПОРТ|PASSPORT/i], ['ANZH', /ANZH/i],
  ] as const) {
    await tab(page, re);
    const small = await page.locator('button:visible').evaluateAll((els) =>
      els.map((e) => {
        const r = e.getBoundingClientRect();
        return { cls: e.className, w: Math.round(r.width), h: Math.round(r.height), t: (e.textContent || '').trim().slice(0, 16) };
      }).filter((x) => x.w > 0 && (x.h < 40 || x.w < 40)),
    );
    const uniq = [...new Map(small.map((s) => [String(s.cls) + s.h, s])).values()];
    console.log(`— ${name}`);
    for (const s of uniq) console.log(`   ${s.w}×${s.h}  .${String(s.cls).split(' ').slice(0, 2).join('.')}  «${s.t}»`);
  }
});
