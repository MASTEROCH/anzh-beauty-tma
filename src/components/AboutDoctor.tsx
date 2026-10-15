import { about, profile } from '../data/profile';
import { asset } from '../lib/asset';
import { Icon } from '../components/Icon';
import { openSheet } from '../lib/ui';
import type { Lang } from '../lib/i18n';

/*
   О ВРАЧЕ — карточка на профиле, подробности в шторке.

   Приём из AntiAge (блок об основателе): на экране стоит компактная
   карточка — портрет, имя, одна фраза и «Подробнее», — а весь текст
   живёт за нажатием.

   Почему не развернули прямо на профиле, как было в первой версии:
   профиль и так несёт героя, статистику, регалии, две кнопки, сторис,
   галерею, отзывы, два оффера, карту и подвал. Ещё один длинный
   текстовый блок посреди этого превращает экран в свалку — человек
   перестаёт видеть, что здесь главное. Правило простое: на экране —
   приглашение прочитать, за нажатием — чтение.
*/

function AboutSheet({ lang }: { lang: Lang }) {
  const ru = lang === 'ru';
  return (
    <>
      <figure className="about-doc-figure">
        <img
          className="about-doc-photo"
          src={asset(about.photo)}
          alt={ru ? `${profile.name} — косметолог` : `${profile.name} — cosmetologist`}
          loading="lazy"
          decoding="async"
        />
      </figure>

      <blockquote className="about-doc-credo">
        «{ru ? about.credo.ru : about.credo.en}»
      </blockquote>

      <div className="about-doc-body stack">
        {(ru ? about.body.ru : about.body.en).map((para) => (
          <p key={para.slice(0, 24)}>{para}</p>
        ))}
      </div>

      <dl className="about-doc-facts">
        {about.facts.map((f) => (
          <div className="about-doc-fact" key={f.ru}>
            <dt>{ru ? f.ru : f.en}</dt>
            <dd>{ru ? f.v.ru : f.v.en}</dd>
          </div>
        ))}
      </dl>

      {/* 🚨 Факт, а не красивая фраза. Администратора в тексте нет: он не
          подтверждён (T2 ed. 2 §2.1, m-4; the lawyer: «верно»). Пересмотреть,
          когда к записи привяжутся другие мастера. В разделе о человеке
          выдуманный факт дороже любой формулировки. */}
      <p className="about-doc-sign row">
        <Icon name="check" size={15} strokeWidth={2.2} />
        <span>
          {ru
            ? 'Заявку подтверждает Анжелика, процедуры она подбирает сама.'
            : 'Anjelika confirms your request and chooses the treatments herself.'}
        </span>
      </p>
    </>
  );
}

export function AboutDoctor({ lang }: { lang: Lang }) {
  const ru = lang === 'ru';

  const open = () =>
    openSheet({
      title: profile.name,
      subtitle: ru ? 'Косметолог · Батуми' : 'Cosmetologist · Batumi',
      body: <AboutSheet lang={lang} />,
    });

  return (
    <button className="doc-card" onClick={open}>
      <span className="doc-card-ph">
        <img
          src={asset(about.photo)}
          alt=""
          aria-hidden
          loading="lazy"
          decoding="async"
        />
      </span>
      <span className="doc-card-b">
        <span className="eyebrow">{ru ? 'о враче' : 'about the doctor'}</span>
        <span className="doc-card-n">{profile.name}</span>
        {/* Одна фраза, не весь абзац: карточка обещает, а не пересказывает */}
        <span className="doc-card-q">«{ru ? about.credo.ru : about.credo.en}»</span>
        <span className="doc-card-more">
          {ru ? 'Подробнее' : 'Read more'}
          <Icon name="chevron-right" size={15} strokeWidth={2.2} />
        </span>
      </span>
    </button>
  );
}
