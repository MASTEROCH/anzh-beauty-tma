import { profile, gallery, reviews } from '../data/profile';
import { openSheet, openLightbox, toast } from '../lib/ui';
import { ReviewSheet } from '../components/ReviewSheet';
import { Icon } from '../components/Icon';
import { t } from '../lib/i18n';

const TRUST_KEYS = ['trust.certified', 'trust.mdcodes', 'trust.clients', 'trust.lidocaine'];
const GALLERY_KEYS = ['gal.contour', 'gal.biorevit', 'gal.cleaning', 'gal.meso', 'gal.peel', 'gal.care'];

type Lang = 'ru' | 'en';

export function ProfileScreen({
  onBook,
  onCatalog,
  lang,
  onLang,
  onAwardPoints,
}: {
  onBook: () => void;
  onCatalog: () => void;
  lang: Lang;
  onLang: (l: Lang) => void;
  onAwardPoints: (points: number) => void;
}) {
  const openReview = () =>
    openSheet({
      title: 'Оставить отзыв',
      subtitle: 'Anjelika Club · копится в кабинете',
      body: <ReviewSheet onAwardPoints={onAwardPoints} />,
    });
  const showAllReviews = () =>
    openSheet({
      title: 'Все отзывы · 312',
      subtitle: 'Отсортировано от свежих',
      body: (
        <div className="col" style={{ gap: 12 }}>
          {[...reviews, ...reviews].map((r, i) => (
            <article key={i} className="card review-card" style={{ flex: 'unset' }}>
              <div className="review-stars">{'★'.repeat(r.stars)}</div>
              <p className="review-text">{r.text}</p>
              <div className="review-author">{r.author}</div>
            </article>
          ))}
        </div>
      ),
    });

  const showAllGallery = () =>
    openSheet({
      title: lang === 'ru' ? 'Галерея работ' : 'Full gallery',
      subtitle: lang === 'ru' ? '54 кейса · 2022–2026' : '54 cases · 2022–2026',
      body: (
        <div className="gallery">
          {[...gallery, ...gallery, ...gallery].map((g, i) => (
            <button key={i} className="gallery-tile" style={{ border: 0, backgroundImage: `url(${g.photo})`, cursor: 'zoom-in' }} onClick={() => openLightbox(g.photo, t(GALLERY_KEYS[i % GALLERY_KEYS.length], lang))}>
              <span className="gallery-tag">{t(GALLERY_KEYS[i % GALLERY_KEYS.length], lang)}</span>
            </button>
          ))}
        </div>
      ),
    });

  const showAddress = () =>
    openSheet({
      title: 'Кабинет Анжелики',
      subtitle: 'Батуми · ул. Parnavaz Mepe 92/94, 3 этаж',
      body: (
        <>
          <div className="map-embed">
            <iframe
              title="Кабинет Анжелики на карте"
              loading="lazy"
              src="https://www.openstreetmap.org/export/embed.html?bbox=41.6264%2C41.6422%2C41.6384%2C41.6502&layer=mapnik&marker=41.6462%2C41.6324"
            />
            <div className="map-pin"><Icon name="pin" size={20} strokeWidth={2} /></div>
            <a
              className="map-addr"
              href="https://www.google.com/maps/search/?api=1&query=41.6462,41.6324"
              target="_blank"
              rel="noreferrer"
            >
              92/94 Parnavaz Mepe St · Batumi
            </a>
          </div>
          <ul className="info-list" style={{ marginTop: 14 }}>
            <li>Район Руставели · центр Батуми</li>
            <li>5 минут пешком от Boulevard</li>
            <li>Парковка прямо у входа · лифт на 3 этаж</li>
            <li>Домофон 12</li>
          </ul>
        </>
      ),
      actions: (
        <>
          <button
            className="btn btn-primary btn-block"
            onClick={() => {
              window.open('https://www.google.com/maps/search/?api=1&query=41.6462,41.6324', '_blank');
              toast('Открываю в Google Maps', 'success');
            }}
          >
            Открыть в Google Maps
          </button>
          <button
            className="btn btn-ghost btn-block"
            onClick={() => {
              navigator.clipboard?.writeText('Батуми, ул. Parnavaz Mepe 92/94, 3 этаж');
              toast('Адрес скопирован', 'success');
            }}
          >
            Скопировать адрес
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
      actions: <button className="btn btn-primary btn-block" onClick={onBook}>Записаться</button>,
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
          <img src="/brand/anzh-logo.svg" alt="ANZH" style={{ height: 24 }} />
        </button>
        <div className="header-lang">
          <button className={lang === 'ru' ? 'active' : ''} onClick={() => onLang('ru')}>RU</button>
          <button className={lang === 'en' ? 'active' : ''} onClick={() => onLang('en')}>EN</button>
        </div>
      </header>

      <section className="profile-hero">
        <div className="profile-avatar-wrap">
          <img src="/photos/anjelika.jpg" alt="Anjelika" className="profile-avatar" />
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
            <span style={{ color: 'var(--accent)' }}>★</span>
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
        <button className="btn btn-primary" onClick={onBook}>
          <Icon name="calendar" size={17} strokeWidth={2} /> {t('common.book', lang)}
        </button>
        <button className="btn btn-ghost" onClick={onCatalog}>
          <Icon name="sparkles" size={17} strokeWidth={2} /> {t('common.catalog', lang)}
        </button>
      </div>

      <section className="section">
        <div className="section-head">
          <div>
            <div className="eyebrow">{t('profile.gallery.eyebrow', lang)}</div>
            <h2 className="section-title">{t('profile.gallery.title', lang)}</h2>
          </div>
          <button className="section-link" onClick={showAllGallery} style={{ background: 'none', border: 0 }}>
            {t('common.all', lang)} →
          </button>
        </div>
        <div className="gallery">
          {gallery.map((g, i) => (
            <button
              key={g.label}
              className="gallery-tile"
              onClick={() => openLightbox(g.photo, t(GALLERY_KEYS[i], lang))}
              style={{ border: 0, backgroundImage: `url(${g.photo})`, cursor: 'zoom-in' }}
            >
              <span className="gallery-tag">{t(GALLERY_KEYS[i], lang)}</span>
            </button>
          ))}
        </div>
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
                    <div className="review-author">{r.author}</div>
                  </article>
                ))}
              </div>
            ))}
          </div>
        </div>

        <button className="review-cta" onClick={openReview}>
          <div className="review-cta-icon"><Icon name="gift" size={22} strokeWidth={1.8} /></div>
          <div className="review-cta-text">
            <div className="review-cta-title">Поделись впечатлением</div>
            <div className="review-cta-sub">+200 баллов в Anjelika Club за отзыв · +100 за фото</div>
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
        <button className="card" onClick={showAddress} style={{ padding: 16, width: '100%', textAlign: 'left', border: '0.5px solid var(--border)', cursor: 'pointer' }}>
          <div className="row" style={{ gap: 14 }}>
            <div
              style={{
                flex: '0 0 56px',
                height: 56,
                borderRadius: 16,
                background: 'linear-gradient(135deg, var(--t), var(--tm))',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 22,
              }}
            >
              <Icon name="pin" size={22} strokeWidth={1.8} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600 }}>Батуми · ул. Parnavaz Mepe 92/94, 3 этаж</div>
              <div className="faint" style={{ fontSize: 13, marginTop: 2 }}>10 мин от Boulevard · парковка у входа</div>
            </div>
            <div style={{ color: 'var(--tl)', fontSize: 18 }}>›</div>
          </div>
        </button>
      </section>
    </div>
  );
}
