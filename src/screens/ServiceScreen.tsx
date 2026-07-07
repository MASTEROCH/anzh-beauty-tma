import { findService, services } from '../data/services';
import { openSheet, toast } from '../lib/ui';
import { Icon } from '../components/Icon';

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
            src="/brand/anzhelika.webp"
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

  const showBeforeAfter = () =>
    openSheet({
      title: s.title,
      subtitle: 'Реальный кейс · фото с согласия клиента',
      body: (
        <>
          <div className="beforeafter" style={{ marginTop: 4 }}>
            <div className="beforeafter-tile before" data-label="ДО" />
            <div className="beforeafter-tile after" data-label="ПОСЛЕ" />
          </div>
          <p className="muted" style={{ fontSize: 13, marginTop: 12 }}>
            Срок наблюдения — 14 дней. Окончательный результат виден через 2-3 недели после спадения отёка.
          </p>
        </>
      ),
      actions: <button className="btn btn-primary btn-block" onClick={() => onBook(s.id)}>Записаться</button>,
    });

  return (
    <>
    <div className="screen has-cta">
      <header className="header">
        <button className="header-back" onClick={onBack} aria-label="Назад">‹</button>
        <div className="header-title">Подробнее</div>
        <button className="header-back" onClick={share} aria-label="Поделиться">↗</button>
      </header>

      <div className="service-hero">
        <div className="service-hero-emoji"><Icon name={s.icon} size={96} strokeWidth={1.4} /></div>
        <button
          className="fav-btn"
          aria-pressed={isFav}
          aria-label={isFav ? 'Убрать из избранного' : 'В избранное'}
          onClick={() => {
            onToggleFavorite(s.id);
            toast(isFav ? 'Убрала из избранного' : 'Добавила в избранное', 'success');
          }}
          style={{ position: 'absolute', top: 18, right: 18, width: 40, height: 40, zIndex: 2 }}
        >
          <Icon name={isFav ? 'heart-filled' : 'heart'} size={18} strokeWidth={1.8} />
        </button>
      </div>

      <div className="service-detail-body">
        <h1 className="service-detail-title">{s.title}</h1>
        <div className="service-detail-meta">
          <strong>{price}</strong>
          <span>· {altPrice}</span>
          <span>· ⏱ {s.duration} мин</span>
        </div>
        <p className="service-detail-text">{s.description}</p>

        <div className="info-block">
          <div className="info-block-title">Что входит</div>
          <ul className="info-list">
            {s.includes.map((i) => (
              <li key={i}>{i}</li>
            ))}
          </ul>
        </div>

        <div className="info-block">
          <div className="info-block-title">Противопоказания</div>
          <ul className="info-list contra">
            {s.contraindications.map((i) => (
              <li key={i}>{i}</li>
            ))}
          </ul>
        </div>

        <div className="info-block">
          <div className="info-block-title">Результат до / после</div>
          <button
            onClick={showBeforeAfter}
            style={{ background: 'none', border: 0, padding: 0, width: '100%', cursor: 'pointer' }}
            aria-label="Увеличить"
          >
            <div className="beforeafter">
              <div className="beforeafter-tile before" data-label="ДО" />
              <div className="beforeafter-tile after" data-label="ПОСЛЕ" />
            </div>
          </button>
          <div className="faint" style={{ fontSize: 12, marginTop: 8 }}>
            Тап чтобы увеличить · фото с согласия клиента
          </div>
        </div>

        <div className="info-block">
          <div className="info-block-title">Кабинет</div>
          <button
            onClick={showMaster}
            className="card"
            style={{ padding: 14, width: '100%', textAlign: 'left', cursor: 'pointer' }}
          >
            <div className="row" style={{ gap: 12 }}>
              <img
                src="/brand/anzhelika.webp"
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
        Выбрать время · {price}
      </button>
    </div>
    </>
  );
}
