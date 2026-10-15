import { profile, reviews, story, PROFILE_TEXTS_SHOWN } from '../data/profile';
import { openSheet, closeSheet, toast } from '../lib/ui';
import { StoryCarousel } from '../components/StoryCarousel';
import { StudioMap } from '../components/StudioMap';
import { LegalFooter } from '../components/LegalFooter';
import { AboutDoctor } from '../components/AboutDoctor';
import { Gallery } from '../components/Gallery';
import { StudioCover, StudioSection } from '../components/StudioCover';
import { TeamSection } from '../components/TeamSection';
import { Icon } from '../components/Icon';
import { t } from '../lib/i18n';
import { asset } from '../lib/asset';
import { shownWorks } from '../data/works';

/* Регалия с числом постоянных клиентов отсюда убрана: цифра-заготовка, не
   подтверждена Анжеликой (разбор Законника А.7, решение владельца —
   выдуманное убирать). Formulations — the lawyer's "before documents" (T2 ed. 2 §2.4). */
const TRUST_KEYS = ['trust.certified', 'trust.certs', 'trust.cadaver'];

type Lang = 'ru' | 'en';

export function ProfileScreen({
  onBook,
  onCatalog,
  onOpenService,
  lang,
  onAwardPoints,
}: {
  onBook: (serviceId?: string) => void;
  onCatalog: () => void;
  /** Из галереи можно уйти в полную карточку услуги, а не только записаться */
  onOpenService: (id: string) => void;
  lang: Lang;
  onAwardPoints: (points: number) => void;
}) {
  const ru = lang === 'ru';
  /* «Работы наших мастеров» — the studio's own photos (K11a), not stock illustrations: drawn
     while at least one photo may be shown (data/works.ts, `published`). */
  const worksShown = shownWorks().length;
  /* Вход в «оставить отзыв» и сторис-скидку отсюда снят: отзывы и задания
     на запуск — второй ряд (в openapi `x-status: planned`, решение John
     перед волной 2), а скидки за них не начисляются. Чужие отзывы, когда
     они появятся в данных, читать можно — писать свой пока негде. */
  void onAwardPoints;
  /* Число в заголовке — СЧЁТ показанных отзывов. Здесь стояло число из
     прототипа при трёх отзывах, выведенных дважды подряд. */
  const showAllReviews = () =>
    openSheet({
      title: ru ? `Все отзывы · ${reviews.length}` : `All reviews · ${reviews.length}`,
      subtitle: ru ? 'Отсортировано от свежих' : 'Newest first',
      body: (
        <div className="col" style={{ gap: 12 }}>
          {reviews.map((r, i) => (
            <article key={i} className="card review-card" style={{ flex: 'unset' }}>
              <div className="review-stars">{'★'.repeat(r.stars)}</div>
              <p className="review-text">{r.text}</p>
              <div className="review-author">{r.author} · {r.role[lang]}</div>
            </article>
          ))}
        </div>
      ),
      actions: (
        <button className="btn btn-quiet btn-block" onClick={closeSheet}>
          {ru ? 'Закрыть' : 'Close'}
        </button>
      ),
    });

  /* Здесь была шторка «Подтверждение»: пустая плашка со значком вместо скана
     и фраза, что сертификат можно открыть целиком. Скана нет —
     шторка обещала документ, которого никто не видел. Регалии остаются
     подписями; шторка вернётся вместе с настоящим сканом. */

  return (
    <div className="screen">
      <header className="header">
        <button
          className="header-back"
          onClick={() => toast(t('profile.publicNote', lang))}
          aria-label="ANZH"
          style={{ background: 'none', border: 0, padding: 0, width: 'auto', height: 'auto' }}
        >
          <img src={asset("brand/anzh-logo.svg")} alt="ANZH" style={{ height: 24 }} />
        </button>
      </header>

      {/* K15 (owner 07.10: "the video on the main screen as a cover"), K15b (Hater K15-H4,
          John 07.10): the route video is the top block — above the avatar, the name and the
          buttons; 16:9 at the screen's width, the hero right under it. */}
      <StudioCover lang={lang} />

      <section className="profile-hero">
        <div className="profile-avatar-wrap">
          <img src={asset("photos/anjelika.webp")} alt="Anjelika" className="profile-avatar" />
          <span className="profile-status" aria-label="принимает записи" />
        </div>
        <h1 className="profile-name">{profile.name}</h1>
        <p className="profile-role">{t('profile.role', lang)}</p>
        <a
          className="ig-link"
          href="https://instagram.com/dr.domnich"
          target="_blank"
          rel="noreferrer"
          onClick={() => toast('Открываю Instagram @dr.domnich', 'success')}
        >
          <span className="ig-glyph">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2.5" y="2.5" width="19" height="19" rx="5.5" />
              <circle cx="12" cy="12" r="4.2" />
              <circle cx="17.4" cy="6.6" r="1.1" fill="currentColor" stroke="none" />
            </svg>
          </span>
          <span>@dr.domnich</span>
          {/* Число подписчиков было из прототипа, живым счётчиком не было */}
        </a>
        {PROFILE_TEXTS_SHOWN && <p className="profile-bio" data-testid="profile-bio">{t('profile.bio', lang)}</p>}
      </section>

      {/* Здесь стояли стаж, число процедур и рейтинг — цифры-заготовки.
          Вернутся, когда Анжелика их подтвердит, а рейтинг — когда будут
          настоящие отзывы, из которых его можно посчитать. */}

      {PROFILE_TEXTS_SHOWN && (
      <div className="trust-row marquee" aria-label="Регалии" data-testid="profile-trust">
        <div className="marquee-track">
          {[0, 1].map((dup) => (
            <div className="marquee-group" key={dup} aria-hidden={dup === 1 ? true : undefined}>
              {TRUST_KEYS.map((key) => (
                <span key={key} className="chip chip-gold" style={{ cursor: 'default' }}>
                  {t(key, lang)}
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>
      )}

      <div className="profile-cta-row">
        <button className="btn btn-primary" onClick={() => onBook()}>
          <Icon name="calendar" size={17} strokeWidth={2} /> {t('common.book', lang)}
        </button>
        <button className="btn btn-secondary" onClick={onCatalog}>
          <Icon name="sparkles" size={17} strokeWidth={2} /> {t('common.catalog', lang)}
        </button>
      </div>

      {/* K15: the studio photos. Not behind PROFILE_TEXTS_SHOWN: no claims about the studio,
          only what it looks like. */}
      <StudioSection lang={lang} />

      {/* "About" — T2 ed. 2 §2.2–2.3, under PROFILE_TEXTS_SHOWN (her "yes", data/profile.ts).
          The administrator line is gone (m-4): nobody confirmed one; revisit when Maria,
          Ekaterina and Roman are linked. */}
      {PROFILE_TEXTS_SHOWN && (
      <section className="section" data-testid="profile-about">
        <div className="section-head">
          <div>
            <div className="eyebrow">{ru ? 'о нас' : 'about'}</div>
            <h2 className="section-title">{ru ? 'История студии' : 'The studio’s story'}</h2>
          </div>
        </div>
        <StoryCarousel stories={story} />
        {/* Плашки «лет практики / процедур» убраны вместе с цифрами-заготовками */}
        <p className="about-text">
          {ru ? (
            <>
              Заявку подтверждает Анжелика, а
              <strong> процедуры подбирает сама</strong> — по состоянию твоей кожи.
              История записей — в приложении, а не в переписке в директе.
            </>
          ) : (
            <>
              Anjelika confirms your request and
              <strong> chooses the treatments herself</strong>, based on the condition
              of your skin. Your booking history lives in the app, not in a DM thread.
            </>
          )}
        </p>
      </section>
      )}

      {PROFILE_TEXTS_SHOWN && <AboutDoctor lang={lang} />}

      {/* K15: the team — names and roles from the team folder, no surnames, no buttons */}
      <TeamSection lang={lang} />

      {worksShown > 0 && (
      <section className="section section-tight" data-testid="profile-gallery">
        <div className="section-head">
          <div>
            <div className="eyebrow">{t('profile.gallery.eyebrow', lang)}</div>
            <h2 className="section-title">{t('profile.gallery.title', lang)}</h2>
          </div>
        </div>
        <Gallery onBook={onBook} onOpenService={onOpenService} />
      </section>
      )}

      {/* Отзывы скрыты, пока нет настоящих: прежние три были выдуманы
          (ЗАПРОС-ДАННЫХ §7). Блок вернётся сам, когда в данных появятся
          отзывы, — вместе с ним и кнопки «оставить отзыв / сторис». */}
      {reviews.length > 0 && (
      <section className="section section-tight">
        <div className="section-head">
          <div>
            <div className="eyebrow">{t('profile.reviews.eyebrow', lang)}</div>
            <h2 className="section-title">{t('profile.reviews.title', lang)}</h2>
          </div>
          <button className="section-link" onClick={showAllReviews} style={{ background: 'none', border: 0 }}>
            {reviews.length} →
          </button>
        </div>
        {/* Лента листается ПАЛЬЦЕМ, а не едет сама.

            Была бегущая строка с продублированным набором карточек: она
            обрезала отзывы с обоих краёв, уезжала из-под пальца и не
            давала дочитать длинный текст — его увозило на середине
            предложения. Для отзыва это прямой вред: его читают, а не
            разглядывают. Обычная горизонтальная прокрутка со снапом
            оставляет управление человеку. */}
        <div className="reviews-row" aria-label="Отзывы">
          {reviews.map((r, i) => (
            <article key={i} className="card review-card" onClick={showAllReviews}>
              <div className="review-stars">{'★'.repeat(r.stars)}</div>
              <p className="review-text">{r.text}</p>
              <div className="review-author">{r.author} · {r.role[lang]}</div>
            </article>
          ))}
        </div>

      </section>
      )}

      <section className="section section-tight">
        <div className="section-head">
          <div>
            <div className="eyebrow">{t('profile.addr.eyebrow', lang)}</div>
            <h2 className="section-title">{t('profile.addr.title', lang)}</h2>
          </div>
        </div>
        <StudioMap />
      </section>

      <LegalFooter lang={lang} />
    </div>
  );
}
