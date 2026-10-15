import { useEffect } from 'react';

// Высота шапки в CSS-переменную.
//
// Плавающий переключатель языка стоит поверх шапки и должен быть с ней на
// одной линии. Повторить её геометрию формулой в CSS нельзя: шапка растёт
// от содержимого (у одних экранов заголовок в одну строку, у других
// надзаголовок плюс имя) и от safe-area устройства. Замеренные 67px на
// одном экране превращаются в 60 на другом — и HUD уезжает на четыре
// пикселя, что и видно глазом как «лестницу».
//
// Меряем и публикуем `--header-h`, дальше выравнивает обычный CSS. Это тот
// же приём, что с отступами Telegram: JS отдаёт вёрстке число, которое она
// сама вычислить не может.

export function useHeaderHeight() {
  useEffect(() => {
    const root = document.documentElement;

    const measure = () => {
      const header = document.querySelector('.header');
      if (!header) return;
      /* --header-h — высота (по ней центрируются HUD и «выйти»);
         --header-bottom — низ шапки относительно .app: над шапкой бывает
         отступ (safe area Telegram), и вуаль по высоте вставала на 5–8 px
         выше настоящего края — второй «стык» поверх фото (кадр Роча 16.10).
         Дробная часть не округляется: 0.5 px давали видимую полоску. */
      const app = header.closest('.app') ?? document.body;
      const r = header.getBoundingClientRect();
      const bottom = r.bottom - app.getBoundingClientRect().top;
      if (r.height > 0) root.style.setProperty('--header-h', `${r.height.toFixed(2)}px`);
      if (bottom > 0) root.style.setProperty('--header-bottom', `${bottom.toFixed(2)}px`);
    };

    measure();

    // Шапка меняется при смене экрана и при повороте телефона
    const ro = new ResizeObserver(measure);
    const header = document.querySelector('.header');
    if (header) ro.observe(header);

    // Экран сменился — шапка стала другим узлом, наблюдателя надо перевесить
    const mo = new MutationObserver(() => {
      const next = document.querySelector('.header');
      if (next) { ro.disconnect(); ro.observe(next); measure(); }
    });
    mo.observe(document.body, { childList: true, subtree: true });

    return () => { ro.disconnect(); mo.disconnect(); };
  }, []);
}
