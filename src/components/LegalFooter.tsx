import { tr } from '../lib/i18n';
import { Fragment, type ReactNode } from 'react';
import { useStudio } from '../lib/studioProfile';
import { openExternal } from '../lib/telegram';
import { asset } from '../lib/asset';
import type { Lang } from '../lib/i18n';

/*
   ПРАВОВОЙ ПОДВАЛ + общие правовые кирпичи приложения.

   Стоит в самом низу профиля — там, где его ищут и где он никому не
   мешает. Мелкий шрифт здесь не пренебрежение, а иерархия: эти ссылки
   нужны редко, но нужны обязательно, и место у них то же, что на сайте.

   Открывается ВНЕШНЕ через openExternal: внутри Telegram это отдельное
   окно клиента, а не подмена мини-приложения. Открыть такую страницу
   поверх приложения значило бы потерять несохранённую запись.

   Тексты лежат у нас же, в `public/legal/*.html` (кладёт John): тексты
   anzh.store написаны для сайта и не покрывают мини-приложение, анкету
   здоровья и Stars (разбор Законника, вопрос №9). Адрес собирается от
   адреса приложения — `openLink` в Telegram принимает только полный URL.

   Отсюда же берут ссылки онбординг (политика), анкета (согласие на
   данные о здоровье) и оплата (условия, возврат): один список — одно
   место, где адрес может разойтись с файлом.
*/

export type LegalDoc = 'privacy' | 'terms' | 'refunds' | 'health-consent';

const DOCS: Array<{ id: LegalDoc; ru: string; en: string }> = [
  { id: 'privacy',        ru: 'Политика конфиденциальности',   en: 'Privacy Policy' },
  // Подпись = заголовок документа: terms.html — условия покупки разборов, не «использования»
  { id: 'terms',          ru: 'Условия покупки',               en: 'Purchase terms' },
  { id: 'refunds',        ru: 'Условия возврата',              en: 'Refund Policy' },
  { id: 'health-consent', ru: 'Согласие на данные о здоровье', en: 'Health data consent' },
];

/**
 * Полный адрес правового текста: `/legal/<doc>.html` от адреса приложения.
 * С версией (`Me.legal[kind]`) — `?v=<версия>`: после 409 `version_mismatch`
 * человек открывает текст новой редакции, а не копию из кэша WebView.
 */
export function legalDocUrl(doc: LegalDoc, version?: string | null): string {
  const path = asset(`legal/${doc}.html`) + (version ? `?v=${encodeURIComponent(version)}` : '');
  if (typeof window === 'undefined') return path;
  return new URL(path, window.location.href).href;
}

/* Ссылка внутри фразы. Настоящий <a href> — чтобы читалась как ссылка и
   открывалась средней кнопкой в браузере; нажатие уводит в openExternal,
   иначе в Telegram страница заменила бы собой мини-приложение.
   stopPropagation — ссылка часто стоит рядом с галочкой согласия, и
   прочитать текст не должно значить отметить её. */
const INLINE_LINK = {
  color: 'inherit',
  textDecoration: 'underline',
  textUnderlineOffset: 2,
  textDecorationColor: 'var(--border-strong)',
} as const;

/* `hitArea` — дать ссылке зону нажатия 44px (класс .legal-link, та же
   ступень 11px, что у подвала). Только там, где в 14px над и под строкой
   нет другой кнопки: под галочкой согласия зона накрыла бы саму галочку. */
export function LegalLink({
  doc, children, hitArea = false, version,
}: { doc: LegalDoc; children: ReactNode; hitArea?: boolean; version?: string | null }) {
  const url = legalDocUrl(doc, version);
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={hitArea ? 'legal-link' : undefined}
      style={INLINE_LINK}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        openExternal(url);
      }}
    >
      {children}
    </a>
  );
}

/* Оговорка «не диагноз» — юридически несущий текст (разбор Законника А.7).
   Одна строка на всё приложение, чтобы подвал, пейвол и шторка разбора
   не разошлись в формулировке. */
export const NOT_A_DIAGNOSIS = {
  ru: 'Информационный разбор, не медицинская консультация и не диагноз.',
  en: 'Informational analysis — not medical advice and not a diagnosis.',
} as const;

/* Экран результата разбора (ui-line result.disclaimer, на «ты»). */
export const RESULT_DISCLAIMER = {
  ru: 'Это информационный разбор по твоим ответам, не диагноз и не медицинская консультация. При жалобах на кожу — к дерматологу.',
  en: 'This is an informational analysis of your answers, not a diagnosis or medical advice. For skin complaints, see a dermatologist.',
} as const;

/* Приложение целиком и ИИ-ассистент (ui-line footer.disclaimer). */
export const APP_NOT_A_DIAGNOSIS = {
  ru: 'ANZH Beauty не ставит диагнозов и не назначает лечение. Разборы и подсказки — справочная информация.',
  en: 'ANZH Beauty does not diagnose or prescribe treatment. Analyses and tips are for information only.',
} as const;

export function AnalysisDisclaimer({ lang }: { lang: Lang }) {
  return (
    <p className="legal-note" data-disclaimer="result" style={{ marginTop: 'var(--sp-md)', maxWidth: 'none' }}>
      {RESULT_DISCLAIMER[lang]}
    </p>
  );
}

export function LegalFooter({ lang }: { lang: Lang }) {
  const ru = lang === 'ru';
  const year = new Date().getFullYear();
  const studio = useStudio();

  return (
    <footer className="legal-footer">
      {/* Четыре ссылки не влезают в строку и переносятся. У .legal-link
          невидимая зона нажатия 44px по высоте, а строки стоят через 19px:
          зона нижней ссылки накрывала верхнюю, и «Политика» открывала
          «Условия возврата» (поймано прогоном). Межстрочный зазор --sp-xl:
          строка 17px + 28px > 44px — зоны больше не пересекаются. */}
      <nav
        className="legal-links"
        aria-label={ru ? 'Правовые документы' : 'Legal'}
        style={{ rowGap: 'var(--sp-xl)' }}
      >
        {/* Разделитель — отдельный элемент ПОСЛЕ ссылки, а не перед
            следующей. Когда он был приклеен к следующей, перенос строки
            уносил его с собой и строка начиналась с точки. */}
        {DOCS.map((doc, i) => (
          <Fragment key={doc.id}>
            <button
              type="button"
              className="legal-link"
              onClick={() => openExternal(legalDocUrl(doc.id))}
            >
              {ru ? doc.ru : doc.en}
            </button>
            {i < DOCS.length - 1 && <span className="legal-sep" aria-hidden>·</span>}
          </Fragment>
        ))}
      </nav>

      <p className="legal-note">{APP_NOT_A_DIAGNOSIS[lang]}</p>

      <p className="legal-copy">
        © {year} ANZH Cosmetology · {tr('Батуми', 'Batumi')} · {studio.instagram ? `@${studio.instagram}` : ''}
      </p>
    </footer>
  );
}
