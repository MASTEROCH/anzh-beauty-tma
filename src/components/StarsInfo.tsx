import { Icon } from './Icon';
import { openSheet, closeSheet, toast } from '../lib/ui';
import { tap } from '../lib/haptics';
import { openExternal, isTelegram } from '../lib/telegram';
import { STAR_USD, starsToUsd } from '../lib/payments';
import type { Lang } from '../lib/i18n';

/* «Что такое Telegram Stars» (Роч 15.10: «открывать покупку звёзд прямо в
   Telegram — или своя страница с описанием и курсом, красиво и правильно»).
   Делаем оба: объяснение + кнопка пополнения.

   Пополнение — официальная ссылка Telegram `tg://stars_topup?balance=N`
   (core.telegram.org/api/links): клиент сам открывает форму покупки, а если
   звёзд уже хватает — говорит об этом. https-аналога у неё нет, поэтому
   открываем её навигацией из WebView; запасной путь — Fragment
   (fragment.com/stars), официальная площадка Telegram. И главное: при
   оплате разбора Telegram сам предлагает докупить недостающие звёзды —
   об этом строка первой, чтобы никто не думал, что покупать надо заранее. */

const EXAMPLES = [670, 2680];

export function openStarsInfo(lang: Lang, need = 670) {
  const ru = lang === 'ru';
  tap();
  const topUp = () => {
    tap();
    if (!isTelegram()) {
      toast(ru ? 'Пополнение открывается внутри Telegram — откройте приложение у бота студии' : 'Top-up opens inside Telegram — open the app from the studio bot');
      return;
    }
    closeSheet();
    try { window.location.href = `tg://stars_topup?balance=${need}`; } catch { openExternal('https://fragment.com/stars'); }
  };
  openSheet({
    title: 'Telegram Stars',
    subtitle: ru ? 'Звёзды — валюта Telegram для цифровых покупок' : 'Stars are Telegram’s currency for digital purchases',
    body: (
      <div className="si">
        <div className="si-hero" aria-hidden>
          <span className="si-star"><Icon name="star" size={44} strokeWidth={1.4} fill="current" /></span>
          <span className="si-orbit" />
        </div>
        <div className="si-rate">
          <div className="si-rate-k">{ru ? 'курс в приложении' : 'rate in the app'}</div>
          <div className="si-rate-v">1 ★ ≈ ${STAR_USD.toFixed(2)}</div>
          <div className="si-rate-ex">
            {EXAMPLES.map((n) => <span key={n}><b>{n} ★</b> ≈ ${starsToUsd(n)}</span>)}
          </div>
        </div>
        <ol className="si-steps">
          <li><b>{ru ? 'Покупать заранее не нужно.' : 'No need to buy in advance.'}</b> {ru ? 'Нажмите «Начать разбор» — если звёзд не хватает, Telegram сам предложит докупить их прямо в окне оплаты.' : 'Tap “Start the analysis” — if you’re short, Telegram offers to top up right in the payment window.'}</li>
          <li>{ru ? 'Или пополните баланс сейчас: Telegram → Настройки → «Мои звёзды» → «Купить».' : 'Or top up now: Telegram → Settings → “My Stars” → “Buy”.'}</li>
          <li>{ru ? 'Звёзды покупаются через App Store / Google Play или Fragment — цена пакета у Telegram может быть чуть выше курса из-за комиссии магазина.' : 'Stars are bought via the App Store / Google Play or Fragment — Telegram’s pack price may be slightly above the rate because of store fees.'}</li>
        </ol>
        <p className="si-fine">{ru ? 'Звёздами оплачивается только цифровое: разборы кожи. Процедуры в студии оплачиваются на месте — картой или наличными.' : 'Stars pay only for digital goods: skin analyses. Studio treatments are paid on site — by card or cash.'}</p>
      </div>
    ),
    actions: (
      <>
        <button className="btn btn-amber btn-block si-go" onClick={topUp}>
          <Icon name="star" size={16} strokeWidth={2} fill="current" /> {ru ? 'Пополнить звёзды в Telegram' : 'Top up Stars in Telegram'}
        </button>
        <button className="btn btn-secondary btn-block" onClick={() => { tap(); openExternal('https://fragment.com/stars'); }}>
          {ru ? 'Купить на Fragment' : 'Buy on Fragment'}
        </button>
      </>
    ),
  });
}
