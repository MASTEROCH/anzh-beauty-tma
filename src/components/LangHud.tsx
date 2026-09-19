import type { Lang } from '../lib/i18n';
import { select } from '../lib/haptics';

// Переключатель языка жил в шапке профиля — то есть был доступен ровно на
// одном экране из восьми. Язык это глобальная настройка приложения, а не
// свойство профиля, поэтому он переехал в плавающий слой поверх всех экранов.
//
// Почему нижний правый угол, а не верхний: верх справа на каждом экране уже
// занят своим (валюта в каталоге, «Настройки» в кабинете, «поделиться» в
// услуге) — глобальная кнопка там столкнулась бы с экранной. Внизу справа
// уже живёт шар ассистента: это готовый плавающий слой, и язык встаёт
// над ним в ту же колонку, а не открывает вторую точку внимания.

export function LangHud({ lang, onLang }: { lang: Lang; onLang: (l: Lang) => void }) {
  const pick = (l: Lang) => {
    if (l === lang) return;
    select();
    onLang(l);
  };
  return (
    <div className="lang-hud" role="group" aria-label="Язык / Language">
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
  );
}
