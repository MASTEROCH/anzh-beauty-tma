import { profile, gallery, reviews, story } from '../data/profile';
import { openSheet, closeSheet, openLightbox, toast } from '../lib/ui';
import { ReviewSheet } from '../components/ReviewSheet';
import { StoryCarousel } from '../components/StoryCarousel';
import { StudioMap } from '../components/StudioMap';
import { Gallery } from '../components/Gallery';
import { Icon } from '../components/Icon';
import { t } from '../lib/i18n';
import { asset } from '../lib/asset';

const TRUST_KEYS = ['trust.certified', 'trust.mdcodes', 'trust.clients', 'trust.lidocaine'];

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
  const openReview = () =>
    openSheet({
      title: ru ? 'Оставить отзыв' : 'Leave a review',
      subtitle: ru ? 'Скидка на следующую процедуру' : 'Discount on your next treatment',
      body: <ReviewSheet onAwardPoints={onAwardPoints} />,
    });

  const showStoriesShare = () =>
    openSheet({
      title: ru ? '−15% на первое посещение' : '−15% off your first visit',
      subtitle: ru ? 'За сторис с отметкой @dr.domnich' : 'For a Story tagging @dr.domnich',
      body: (
        <>
          <div className="stories-hero">
            <div className="stories-hero-glow" aria-hidden />
            <svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2.5" y="2.5" width="19" height="19" rx="5.5" />
              <circle cx="12" cy="12" r="4.2" />
              <circle cx="17.4" cy="6.6" r="1.1" fill="currentColor" stroke="none" />
            </svg>
            <div className="stories-discount">−15%</div>
          </div>
          <ol className="stories-steps">
            <li><span>1</span>{ru ? 'Сними сторис в кабинете или с результатом' : 'Post a Story at the studio or of your result'}</li>
            <li><span>2</span>{ru ? 'Отметь @dr.domnich и поставь геометку' : 'Tag @dr.domnich and add the location'}</li>
            <li><span>3</span>{ru ? 'Покажи сторис на ресепшене — скидка твоя' : 'Show the Story at the desk — the discount is yours'}</li>
          </ol>
          <button
            className="promo-code"
            onClick={() => {
              navigator.clipboard?.writeText('STORIES15');
              toast(ru ? 'Промокод STORIES15 скопирован' : 'Promo STORIES15 copied', 'success');
            }}
          >
            <span className="promo-code-label">{ru ? 'Промокод' : 'Promo code'}</span>
            <span className="promo-code-value">STORIES15</span>
            <Icon name="share" size={16} strokeWidth={1.9} />
          </button>
          <p className="faint" style={{ fontSize: 12, marginTop: 10, textAlign: 'center' }}>
            {ru ? 'Действует на первую процедуру · нельзя суммировать с другими акциями' : 'Valid on your first treatment · not combinable with other offers'}
          </p>
        </>
      ),
      actions: (
        <button
          className="btn btn-primary btn-block"
          onClick={() => {
            const url = 'https://instagram.com/dr.domnich';
            const nav = navigator as Navigator & { share?: (d: { title?: string; text?: string; url?: string }) => Promise<void> };
            if (nav.share) nav.share({ title: 'ANZH Cosmetology', text: ru ? 'Косметолог Анжелика · Батуми' : 'Cosmetologist Anjelika · Batumi', url }).catch(() => {});
            else window.open(url, '_blank');
            toast(ru ? 'Открываю Instagram Анжелики' : 'Opening Anjelika’s Instagram', 'success');
          }}
        >
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <Icon name="share" size={17} strokeWidth={2} /> {ru ? 'Открыть Instagram' : 'Open Instagram'}
          </span>
        </button>
      ),
    });
  /* Читать чужие отзывы и написать свой — один и тот же порыв. Раньше шторка
     со всеми отзывами была тупиком: 312 карточек и ни одного действия, а
     кнопка «поделись впечатлением» осталась на экране под каруселью, за
     краем видимости. Теперь выход в свой отзыв есть прямо отсюда. */
  const showAllReviews = () =>
    openSheet({
      title: ru ? 'Все отзывы · 312' : 'All reviews · 312',
      subtitle: ru ? 'Отсортировано от свежих' : 'Newest first',
      body: (
        <div className="col" style={{ gap: 12 }}>
          {[...reviews, ...reviews].map((r, i) => (
            <article key={i} className="card review-card" style={{ flex: 'unset' }}>
              <div className="review-stars">{'★'.repeat(r.stars)}</div>
              <p className="review-text">{r.text}</p>
              <div className="review-author">{r.author} · {r.role[lang]}</div>
            </article>
          ))}
        </div>
      ),
      actions: (
        <>
          <button className="btn btn-primary btn-block" onClick={openReview}>
            <Icon name="gift" size={16} strokeWidth={2} />
            {ru ? 'Написать свой · −10%' : 'Write yours · −10%'}
          </button>
          <button className="btn btn-quiet btn-block" onClick={closeSheet}>
            {ru ? 'Закрыть' : 'Close'}
          </button>
        </>
      ),
    });

  const showTrust = (text: string) =>
    openSheet({
      title: 'Подтверждение',
      subtitle: text,
      body: (
        <>
          <div
            style={{
              height: 220,
              borderRadius: 16,
              border: '0.5px solid var(--border)',
              background: 'linear-gradient(135deg, rgba(196,168,130,0.18), rgba(47,118,122,0.15))',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 72,
            }}
          >
            <Icon name="shield-check" size={22} strokeWidth={1.8} />
          </div>
          <p className="muted" style={{ fontSize: 13, marginTop: 12 }}>
            Сертификат можно посмотреть в полном размере или запросить копию у Анжелики.
          </p>
        </>
      ),
      actions: <button className="btn btn-primary btn-block" onClick={() => onBook()}>Записаться</button>,
    });

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

      <section className="profile-hero">
        <div className="profile-avatar-wrap">
          <img src={asset("photos/anjelika.jpg")} alt="Anjelika" className="profile-avatar" />
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
          <span className="ig-followers">11.5K</span>
        </a>
        <p className="profile-bio">{t('profile.bio', lang)}</p>
      </section>

      <div className="profile-stats">
        <div className="stat" onClick={() => toast('8 лет частной практики')}>
          <span className="stat-value">{profile.stats.years}</span>
          <span className="stat-label">{t('profile.stat.years', lang)}</span>
        </div>
        <div className="stat" onClick={() => toast('1 472 завершённые процедуры')}>
          <span className="stat-value">{profile.stats.procedures.toLocaleString(lang === 'ru' ? 'ru-RU' : 'en-US')}</span>
          <span className="stat-label">{t('profile.stat.procedures', lang)}</span>
        </div>
        <div className="stat" onClick={showAllReviews}>
          <span className="stat-value">
            {profile.stats.rating}
            <span className="stat-star">★</span>
          </span>
          <span className="stat-label">{t('profile.stat.rating', lang)}</span>
        </div>
      </div>

      <div className="trust-row marquee" aria-label="Регалии">
        <div className="marquee-track">
          {[0, 1].map((dup) => (
            <div className="marquee-group" key={dup} aria-hidden={dup === 1 ? true : undefined}>
              {TRUST_KEYS.map((key) => (
                <button key={key} className="chip chip-gold" onClick={() => showTrust(t(key, lang))} tabIndex={dup === 1 ? -1 : undefined}>
                  {t(key, lang)}
                </button>
              ))}
            </div>
          ))}
        </div>
      </div>

      <div className="profile-cta-row">
        <button className="btn btn-primary" onClick={() => onBook()}>
          <Icon name="calendar" size={17} strokeWidth={2} /> {t('common.book', lang)}
        </button>
        <button className="btn btn-ghost" onClick={onCatalog}>
          <Icon name="sparkles" size={17} strokeWidth={2} /> {t('common.catalog', lang)}
        </button>
      </div>

      <section className="section">
        <div className="section-head">
          <div>
            <div className="eyebrow">{ru ? 'о нас' : 'about'}</div>
            <h2 className="section-title">{ru ? 'Как здесь всё устроено' : 'How it works here'}</h2>
          </div>
        </div>
        <StoryCarousel stories={story} />
        <div className="about-facts">
          <div className="about-fact">
            <span className="about-fact-v">{profile.stats.years}</span>
            <span className="about-fact-k">{ru ? 'лет практики' : 'years'}</span>
          </div>
          <div className="about-fact">
            <span className="about-fact-v">1</span>
            <span className="about-fact-k">{ru ? 'клиент в моменте' : 'client at a time'}</span>
          </div>
          <div className="about-fact">
            <span className="about-fact-v">{profile.stats.procedures.toLocaleString('ru-RU')}</span>
            <span className="about-fact-k">{ru ? 'процедур' : 'treatments'}</span>
          </div>
        </div>
        <p className="about-text">
          {ru ? (
            <>
              Анжелика ведёт приём в Батуми одна — <strong>без администраторов и потока</strong>.
              Каждую заявку подтверждает лично, протокол собирает после осмотра, а историю
              процедур помнит приложение, а не переписка в директе.
            </>
          ) : (
            <>
              Anjelika works solo in Batumi — <strong>no front desk, no conveyor</strong>. She
              confirms every request herself, builds the protocol after seeing your skin, and the
              app remembers your treatment history instead of a DM thread.
            </>
          )}
        </p>
      </section>

      <section className="section" style={{ paddingTop: 0 }}>
        <div className="section-head">
          <div>
            <div className="eyebrow">{t('profile.gallery.eyebrow', lang)}</div>
            <h2 className="section-title">{t('profile.gallery.title', lang)}</h2>
          </div>
        </div>
        <Gallery onBook={onBook} onOpenService={onOpenService} />
      </section>

      <section className="section" style={{ paddingTop: 0 }}>
        <div className="section-head">
          <div>
            <div className="eyebrow">{t('profile.reviews.eyebrow', lang)}</div>
            <h2 className="section-title">{t('profile.reviews.title', lang)}</h2>
          </div>
          <button className="section-link" onClick={showAllReviews} style={{ background: 'none', border: 0 }}>
            312 →
          </button>
        </div>
        <div className="reviews-row marquee marquee--slow" aria-label="Отзывы">
          <div className="marquee-track">
            {[0, 1].map((dup) => (
              <div className="marquee-group reviews-group" key={dup} aria-hidden={dup === 1 ? true : undefined}>
                {reviews.map((r, i) => (
                  <article key={`${dup}-${i}`} className="card review-card" onClick={showAllReviews}>
                    <div className="review-stars">{'★'.repeat(r.stars)}</div>
                    <p className="review-text">{r.text}</p>
                    <div className="review-author">{r.author} · {r.role[lang]}</div>
                  </article>
                ))}
              </div>
            ))}
          </div>
        </div>

        <button className="review-cta" onClick={openReview}>
          <div className="review-cta-icon"><Icon name="gift" size={22} strokeWidth={1.8} /></div>
          <div className="review-cta-text">
            <div className="review-cta-title">{lang === 'ru' ? 'Поделись впечатлением' : 'Share your experience'}</div>
            <div className="review-cta-sub">{lang === 'ru' ? '−10% на следующую процедуру за отзыв · −15% с фото' : '−10% off your next treatment for a review · −15% with a photo'}</div>
          </div>
          <Icon name="chevron-right" size={20} strokeWidth={2} className="review-cta-arrow" />
        </button>

        <button className="review-cta stories-cta" onClick={showStoriesShare}>
          <div className="review-cta-icon stories-icon">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2.5" y="2.5" width="19" height="19" rx="5.5" />
              <circle cx="12" cy="12" r="4.2" />
              <circle cx="17.4" cy="6.6" r="1.1" fill="currentColor" stroke="none" />
            </svg>
          </div>
          <div className="review-cta-text">
            <div className="review-cta-title">{lang === 'ru' ? 'Отметь в сторис' : 'Tag us in Stories'}</div>
            <div className="review-cta-sub">{lang === 'ru' ? '−15% на первое посещение за сторис с @dr.domnich' : '−15% off your first visit for a Story with @dr.domnich'}</div>
          </div>
          <Icon name="chevron-right" size={20} strokeWidth={2} className="review-cta-arrow" />
        </button>
      </section>

      <section className="section" style={{ paddingTop: 0 }}>
        <div className="section-head">
          <div>
            <div className="eyebrow">{t('profile.addr.eyebrow', lang)}</div>
            <h2 className="section-title">{t('profile.addr.title', lang)}</h2>
          </div>
        </div>
        <StudioMap />
      </section>
    </div>
  );
}
