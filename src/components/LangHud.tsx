import type { Lang } from '../lib/i18n';
import { select } from '../lib/haptics';
import { usePriceMode, setPriceMode } from '../lib/priceMode';

// Переключатель языка жил в шапке профиля — то есть был доступен ровно на
// одном экране из восьми. Язык это глобальная настройка приложения, а не
// свойство профиля, поэтому он переехал в плавающий слой поверх всех экранов.
//
// Живёт в верхней полосе, справа — в той же строке, что логотип и заголовок.
// Над шаром ассистента он был лишней стопкой в углу: шар и язык не связаны
// ничем. Место под него шапка резервирует padding'ом справа, иначе HUD
// ложится поверх экранной кнопки (валюта в каталоге, «Настройки» в кабинете).

export function LangHud({
  lang,
  onLang,
  currency = false,
}: {
  lang: Lang;
  onLang: (l: Lang) => void;
  /** Показать переключатель валюты — только там, где на экране есть цены */
  currency?: boolean;
}) {
  const mode = usePriceMode();
  const pickCur = (m: 'GEL' | 'USD') => {
    if (m === mode) return;
    select();
    setPriceMode(m);
  };
  const pick = (l: Lang) => {
    if (l === lang) return;
    select();
    onLang(l);
  };
  return (
    /* Два элемента, а не один: внешний ловит вертикаль шапки и центрирует,
       внутренний рисует пилюлю. Одним элементом фон и рамка растягивались
       на всю высоту шапки — вокруг двух маленьких кнопок висела плашка
       78×60. Позиция и внешний вид на одном узле не уживаются. */
    <div className="lang-hud" role="group" aria-label="Язык и валюта / Language and currency" data-cur={currency ? '1' : undefined}>
      {/* Валюта слева от языка: две пилюли одного вида, чтобы читались как
          одна панель настроек «как мне показывать». Только там, где есть цены —
          на анкете и в кабинете переключатель ничего бы не менял. */}
      {currency && (
        <div className="lang-hud-pill lang-hud-cur" role="group" aria-label={lang === 'en' ? 'Price currency' : 'Валюта цен'}>
          <button className={mode === 'GEL' ? 'active' : ''} onClick={() => pickCur('GEL')} aria-pressed={mode === 'GEL'} aria-label={lang === 'en' ? 'Lari' : 'Лари'}>₾</button>
          <button className={mode === 'USD' ? 'active' : ''} onClick={() => pickCur('USD')} aria-pressed={mode === 'USD'} aria-label={lang === 'en' ? 'Dollars' : 'Доллары'}>$</button>
        </div>
      )}
      <div className="lang-hud-pill">
        <button
          className={lang === 'ru' ? 'active' : ''}
          onClick={() => pick('ru')}
          aria-pressed={lang === 'ru'}
          lang="ru"
        >
          RU
        </button>
        <button
          className={lang === 'en' ? 'active' : ''}
          onClick={() => pick('en')}
          aria-pressed={lang === 'en'}
          lang="en"
        >
          EN
        </button>
      </div>
    </div>
  );
}
