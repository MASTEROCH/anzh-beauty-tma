import { Fragment } from 'react';
import { LEGAL, legalUrl, CONTACTS } from '../data/location';
import { openExternal } from '../lib/telegram';
import type { Lang } from '../lib/i18n';

/*
   ПРАВОВОЙ ПОДВАЛ.

   Стоит в самом низу профиля — там, где его ищут и где он никому не
   мешает. Мелкий шрифт здесь не пренебрежение, а иерархия: эти ссылки
   нужны редко, но нужны обязательно, и место у них то же, что на сайте.

   Открывается ВНЕШНЕ через openExternal: внутри Telegram это отдельное
   окно клиента, а не подмена мини-приложения. Открыть такую страницу
   поверх приложения значило бы потерять несохранённую запись.

   Язык ссылки идёт за языком интерфейса — страницы на сайте двуязычные.

   🔴 Это часть ответа на вопрос №9 из §1 контракта: тексты обязаны
   существовать и быть доступны из приложения до первого реального
   клиента. Доступны они теперь отсюда. Покрывают ли они мини-приложение
   и анкету здоровья — вопрос к юристу, см. server/ОТЧЁТ-§1.md.
*/

export function LegalFooter({ lang }: { lang: Lang }) {
  const ru = lang === 'ru';
  const year = new Date().getFullYear();

  return (
    <footer className="legal-footer">
      <nav className="legal-links" aria-label={ru ? 'Правовые документы' : 'Legal'}>
        {/* Разделитель — отдельный элемент ПОСЛЕ ссылки, а не перед
            следующей. Когда он был приклеен к следующей, перенос строки
            уносил его с собой и строка начиналась с точки. */}
        {LEGAL.map((doc, i) => (
          <Fragment key={doc.id}>
            <button
              type="button"
              className="legal-link"
              onClick={() => openExternal(legalUrl(doc.path, lang))}
            >
              {ru ? doc.ru : doc.en}
            </button>
            {i < LEGAL.length - 1 && <span className="legal-sep" aria-hidden>·</span>}
          </Fragment>
        ))}
      </nav>

      <p className="legal-note">
        {ru
          ? 'Приложение не ставит диагнозов и не заменяет очную консультацию. Рекомендации носят справочный характер.'
          : 'This app does not diagnose and does not replace an in-person consultation. All suggestions are informational.'}
      </p>

      <p className="legal-copy">
        © {year} ANZH Cosmetology · Батуми · @{CONTACTS.instagram}
      </p>
    </footer>
  );
}
