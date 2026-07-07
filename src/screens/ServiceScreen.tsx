import { findService, services, sTitle } from '../data/services';
import { openSheet, openLightbox, toast } from '../lib/ui';
import { Icon } from '../components/Icon';
import { useLang, t } from '../lib/i18n';

type Currency = 'usd' | 'gel';

export function ServiceScreen({
  serviceId,
  onBack,
  onBook,
  currency,
  favorites,
  onToggleFavorite,
}: {
  serviceId: string;
  onBack: () => void;
  onBook: (id: string) => void;
  currency: Currency;
  favorites: Set<string>;
  onToggleFavorite: (id: string) => void;
}) {
  const lang = useLang();
  const s = findService(serviceId) ?? services[0];
  const isFav = favorites.has(s.id);
  const price = currency === 'usd' ? `$${s.priceUsd}` : `${s.priceGel} GEL`;
  const altPrice = currency === 'usd' ? `${s.priceGel} GEL` : `$${s.priceUsd}`;

  const share = () => {
    const url = `https://anzh.tma/service/${s.id}`;
    if (navigator.share) {
      navigator.share({ title: s.title, url }).catch(() => {});
    } else {
      navigator.clipboard?.writeText(url);
      toast('Ссылка на услугу скопирована', 'success');
    }
  };

  const showMaster = () =>
    openSheet({
      title: 'Анжелика',
      subtitle: 'Косметолог · 8 лет практики · MD-Codes',
      body: (
        <>
          <img
            src="/photos/anjelika.jpg"
            alt="Anjelika"
            style={{
              width: 96,
              height: 96,
              borderRadius: '50%',
              objectFit: 'cover',
              margin: '0 auto 14px',
              display: 'block',
              border: '2px solid var(--border-strong)',
            }}
          />
          <ul className="info-list">
            <li>1 472 завершённые процедуры</li>
            <li>Restylane Academy · сертификат</li>
            <li>Курс PDRN-терапии (Корея, 2025)</li>
            <li>Авторская техника MD-Codes</li>
            <li>4.9★ — 312 отзывов</li>
          </ul>
        </>
      ),
      actions: (
        <>
          <button className="btn btn-primary btn-block" onClick={() => onBook(s.id)}>
            Записаться к Анжелике
          </button>
          <button
            className="btn btn-ghost btn-block"
            onClick={() => {
              toast('Открываю чат в Telegram', 'success');
            }}
          >
            Написать в Telegram
          </button>
        </>
      ),
    });

  return (
    <>
    <div className="screen has-cta">
      <header className="header">
        <button className="header-back" onClick={onBack} aria-label="Назад"><Icon name="chevron-left" size={20} strokeWidth={2} /></button>
        <div className="header-title">{t('service.details', lang)}</div>
        <button className="header-back" onClick={share} aria-label="Поделиться"><Icon name="share" size={17} strokeWidth={1.9} /></button>
      </header>

      <div
        className="service-hero service-hero--zoom"
        style={{ backgroundImage: `url(/photos/${s.id}.jpg)` }}
        onClick={() => openLightbox(`/photos/${s.id}.jpg`, s.title)}
        role="button"
        aria-label={`Открыть фото: ${s.title}`}
      >
        <div className="service-hero-badge"><Icon name={s.icon} size={20} strokeWidth={1.8} /></div>
        <button
          className="fav-btn"
          aria-pressed={isFav}
          aria-label={isFav ? 'Убрать из избранного' : 'В избранное'}
          onClick={(e) => {
            e.stopPropagation();
            onToggleFavorite(s.id);
            toast(isFav ? 'Убрала из избранного' : 'Добавила в избранное', 'success');
          }}
          style={{ position: 'absolute', top: 18, right: 18, width: 40, height: 40, zIndex: 2 }}
        >
          <Icon name={isFav ? 'heart-filled' : 'heart'} size={18} strokeWidth={1.8} />
        </button>
      </div>

      <div className="service-detail-body">
        <h1 className="service-detail-title">{sTitle(s, lang)}</h1>
        <div className="service-detail-meta">
          <strong>{price}</strong>
          <span>· {altPrice}</span>
          <span className="svc-dur"><Icon name="clock" size={13} strokeWidth={2} /> {s.duration} {t('common.min', lang)}</span>
        </div>
        <p className="service-detail-text">{s.description}</p>

        <div className="info-block">
          <div className="info-block-title">{t('service.includes', lang)}</div>
          <ul className="info-list">
            {s.includes.map((i) => (
              <li key={i}>{i}</li>
            ))}
          </ul>
        </div>

        <div className="info-block">
          <div className="info-block-title">{t('service.contra', lang)}</div>
          <ul className="info-list contra">
            {s.contraindications.map((i) => (
              <li key={i}>{i}</li>
            ))}
          </ul>
        </div>

        <div className="info-block">
          <div className="info-block-title">{t('service.result', lang)}</div>
          <div className="beforeafter">
            <button className="beforeafter-tile before" data-label="ДО" style={{ backgroundImage: `url(/photos/${s.id}.jpg)`, border: 0, padding: 0, cursor: 'zoom-in' }} onClick={() => openLightbox(`/photos/${s.id}.jpg`, `${s.title} · до`)} aria-label="Увеличить: до" />
            <button className="beforeafter-tile after" data-label="ПОСЛЕ" style={{ backgroundImage: `url(/photos/${s.id}.jpg)`, border: 0, padding: 0, cursor: 'zoom-in' }} onClick={() => openLightbox(`/photos/${s.id}.jpg`, `${s.title} · после`)} aria-label="Увеличить: после" />
          </div>
          <div className="faint" style={{ fontSize: 12, marginTop: 8 }}>
            {t('service.tapZoom', lang)}
          </div>
        </div>

        <div className="info-block">
          <div className="info-block-title">{t('service.cabinet', lang)}</div>
          <button
            onClick={showMaster}
            className="card"
            style={{ padding: 14, width: '100%', textAlign: 'left', cursor: 'pointer' }}
          >
            <div className="row" style={{ gap: 12 }}>
              <img
                src="/photos/anjelika.jpg"
                alt=""
                style={{
                  flex: '0 0 44px',
                  width: 44,
                  height: 44,
                  borderRadius: '50%',
                  objectFit: 'cover',
                  border: '0.5px solid var(--border-strong)',
                }}
              />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600 }}>Анжелика · косметолог</div>
                <div className="faint" style={{ fontSize: 13 }}>8 лет практики · MD-Codes · ★ 4.9</div>
              </div>
              <span style={{ color: 'var(--tl)', fontSize: 18 }}>›</span>
            </div>
          </button>
        </div>
      </div>
    </div>
    <div className="bottom-cta">
      <button className="btn btn-primary btn-block" data-bottom-cta onClick={() => onBook(s.id)}>
        {t('service.pickTime', lang)} · {price}
      </button>
    </div>
    </>
  );
}
