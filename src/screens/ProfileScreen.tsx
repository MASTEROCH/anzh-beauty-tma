import { profile, gallery, reviews } from '../data/profile';
import { openSheet, toast } from '../lib/ui';
import { ReviewSheet } from '../components/ReviewSheet';
import { Icon } from '../components/Icon';

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

  const showGallery = (label: string, emoji: string) =>
    openSheet({
      title: `${emoji} ${label}`,
      subtitle: 'До / после · фото публикуется с согласия клиента',
      body: (
        <>
          <div className="beforeafter">
            <div className="beforeafter-tile before" data-label="ДО" />
            <div className="beforeafter-tile after" data-label="ПОСЛЕ" />
          </div>
          <p className="muted" style={{ fontSize: 13, marginTop: 12, lineHeight: 1.55 }}>
            Каждая работа — индивидуальный протокол. Анжелика покажет похожие кейсы на консультации
            и подберёт препарат под кожу и образ жизни.
          </p>
        </>
      ),
      actions: (
        <button className="btn btn-primary btn-block" onClick={onBook}>
          Записаться на консультацию
        </button>
      ),
    });

  const showAllGallery = () =>
    openSheet({
      title: 'Галерея работ',
      subtitle: '54 кейса · 2022–2026',
      body: (
        <div className="gallery">
          {[...gallery, ...gallery, ...gallery].map((g, i) => (
            <div key={i} className="gallery-tile">
              <span style={{ position: 'absolute', top: 8, right: 8, fontSize: 18 }}>{g.emoji}</span>
              {g.label}
            </div>
          ))}
        </div>
      ),
    });

  const showAddress = () =>
    openSheet({
      title: 'Кабинет Анжелики',
      subtitle: 'Батуми · ул. Чавчавадзе 12, 3 этаж',
      body: (
        <>
          <div
            style={{
              height: 160,
              borderRadius: 16,
              background:
                'linear-gradient(135deg, var(--dk2), var(--t)), repeating-linear-gradient(45deg, rgba(255,255,255,0.04) 0 12px, transparent 12px 24px)',
              backgroundBlendMode: 'overlay',
              position: 'relative',
              overflow: 'hidden',
              border: '0.5px solid var(--border)',
            }}
          >
            <div
              style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                width: 44,
                height: 44,
                borderRadius: '50%',
                background: 'var(--accent)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 22,
                boxShadow: 'var(--glow-amber)',
              }}
            >
              📍
            </div>
          </div>
          <ul className="info-list" style={{ marginTop: 14 }}>
            <li>10 минут пешком от Boulevard</li>
            <li>Парковка прямо у входа</li>
            <li>Лифт на 3 этаж · домофон 12</li>
            <li>Ближайший Bolt 5 мин</li>
          </ul>
        </>
      ),
      actions: (
        <>
          <button
            className="btn btn-primary btn-block"
            onClick={() => {
              window.open('https://maps.google.com/?q=Chavchavadze+12+Batumi', '_blank');
              toast('Открываю в Google Maps', 'success');
            }}
          >
            Открыть в Google Maps
          </button>
          <button
            className="btn btn-ghost btn-block"
            onClick={() => {
              navigator.clipboard?.writeText('Батуми, ул. Чавчавадзе 12, 3 этаж');
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
            📜
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
          onClick={() => toast('Это публичный профиль Анжелики')}
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
          <img src="/brand/anzhelika.webp" alt="Anjelika" className="profile-avatar" />
          <span className="profile-status" aria-label="принимает записи" />
        </div>
        <h1 className="profile-name">{profile.name}</h1>
        <p className="profile-role">{profile.role}</p>
        <p className="profile-bio">{profile.bio}</p>
      </section>

      <div className="profile-stats">
        <div className="stat" onClick={() => toast('8 лет частной практики')}>
          <span className="stat-value">{profile.stats.years}</span>
          <span className="stat-label">лет практики</span>
        </div>
        <div className="stat" onClick={() => toast('1 472 завершённые процедуры')}>
          <span className="stat-value">{profile.stats.procedures.toLocaleString('ru-RU')}</span>
          <span className="stat-label">процедур</span>
        </div>
        <div className="stat" onClick={showAllReviews}>
          <span className="stat-value">
            {profile.stats.rating}
            <span style={{ color: 'var(--accent)' }}>★</span>
          </span>
          <span className="stat-label">рейтинг</span>
        </div>
      </div>

      <div className="trust-row">
        {profile.trust.map((t) => (
          <button key={t} className="chip chip-gold" onClick={() => showTrust(t)}>
            {t}
          </button>
        ))}
      </div>

      <div className="profile-cta-row">
        <button className="btn btn-primary" onClick={onBook}>
          📅 Записаться
        </button>
        <button className="btn btn-ghost" onClick={onCatalog}>
          ✨ Каталог
        </button>
      </div>

      <section className="section">
        <div className="section-head">
          <div>
            <div className="eyebrow">Галерея до/после</div>
            <h2 className="section-title">Работы Анжелики</h2>
          </div>
          <button className="section-link" onClick={showAllGallery} style={{ background: 'none', border: 0 }}>
            все →
          </button>
        </div>
        <div className="gallery">
          {gallery.map((g) => (
            <button
              key={g.label}
              className="gallery-tile"
              onClick={() => showGallery(g.label, g.emoji)}
              style={{ border: 0, color: 'inherit', font: 'inherit' }}
            >
              <span style={{ position: 'absolute', top: 8, right: 8, fontSize: 18 }}>{g.emoji}</span>
              {g.label}
            </button>
          ))}
        </div>
      </section>

      <section className="section" style={{ paddingTop: 0 }}>
        <div className="section-head">
          <div>
            <div className="eyebrow">Отзывы</div>
            <h2 className="section-title">Говорят клиенты</h2>
          </div>
          <button className="section-link" onClick={showAllReviews} style={{ background: 'none', border: 0 }}>
            312 →
          </button>
        </div>
        <div className="reviews-row">
          {reviews.map((r, i) => (
            <article key={i} className="card review-card" onClick={showAllReviews}>
              <div className="review-stars">{'★'.repeat(r.stars)}</div>
              <p className="review-text">{r.text}</p>
              <div className="review-author">{r.author}</div>
            </article>
          ))}
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
            <div className="eyebrow">Адрес</div>
            <h2 className="section-title">Где найти</h2>
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
              📍
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600 }}>Батуми · ул. Чавчавадзе 12, 3 этаж</div>
              <div className="faint" style={{ fontSize: 13, marginTop: 2 }}>10 мин от Boulevard · парковка у входа</div>
            </div>
            <div style={{ color: 'var(--tl)', fontSize: 18 }}>›</div>
          </div>
        </button>
      </section>
    </div>
  );
}
