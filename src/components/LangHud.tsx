import type { Lang } from '../lib/i18n';
import { select } from '../lib/haptics';

// Переключатель языка жил в шапке профиля — то есть был доступен ровно на
// одном экране из восьми. Язык это глобальная настройка приложения, а не
// свойство профиля, поэтому он переехал в плавающий слой поверх всех экранов.
//
// Живёт в верхней полосе, справа — в той же строке, что логотип и заголовок.
// Над шаром ассистента он был лишней стопкой в углу: шар и язык не связаны
// ничем. Место под него шапка резервирует padding'ом справа, иначе HUD
// ложится поверх экранной кнопки (валюта в каталоге, «Настройки» в кабинете).

export function LangHud({ lang, onLang }: { lang: Lang; onLang: (l: Lang) => void }) {
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
    <div className="lang-hud" role="group" aria-label="Язык / Language">
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
