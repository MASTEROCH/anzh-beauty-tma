import { useMemo, useState } from 'react';
import { durationLabel } from '../lib/plural';
import { categories, sTitle, sShort, CATEGORY_KEY, servicePhoto, type Service } from '../data/services';
import { useCatalog } from '../lib/catalog';
import { toast } from '../lib/ui';
import { Icon } from '../components/Icon';
import { useLang, t } from '../lib/i18n';

type Currency = 'usd' | 'gel';

export function CatalogScreen({
  onOpen,
  favorites,
  onToggleFavorite,
  currency,
  onCurrency,
  onOpenPlan,
}: {
  onOpen: (id: string) => void;
  favorites: Set<string>;
  onToggleFavorite: (id: string) => void;
  currency: Currency;
  onCurrency: (c: Currency) => void;
  onOpenPlan: () => void;
}) {
  const { live } = useCatalog();
  const [cat, setCat] = useState<Service['category'] | 'all'>('all');
  const [q, setQ] = useState('');
  const lang = useLang();

  const filtered = useMemo(() => {
    return live.filter((s) => {
      if (cat !== 'all' && s.category !== cat) return false;
      if (q && !`${s.title} ${s.short}`.toLowerCase().includes(q.toLowerCase())) return false;
      return true;
    });
  }, [cat, q]);

  return (
    <div className="screen">
      <header className="header">
        <div className="header-lede">
          <div className="eyebrow">{t('catalog.eyebrow', lang)}</div>
          <div className="header-title">{t('catalog.title', lang)}</div>
        </div>
        <button
          className="chip chip-amber"
          onClick={() => {
            const next = currency === 'usd' ? 'gel' : 'usd';
            onCurrency(next);
            toast(`Цены в ${next.toUpperCase()}`);
          }}
          aria-label="Сменить валюту"
        >
          {currency === 'usd' ? '$ USD' : '₾ GEL'}
        </button>
      </header>

      <div className="catalog-search mt">
        <input
          type="text"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t('catalog.search', lang)}
        />
        {q && (
          <button
            onClick={() => setQ('')}
            className="search-clear"
            aria-label="Очистить"
          >
            <Icon name="x" size={16} strokeWidth={2.2} />
          </button>
        )}
      </div>

      <div className="category-row">
        {categories.map((c) => (
          <button
            key={c.id}
            className={`chip ${cat === c.id ? 'active' : ''}`}
            onClick={() => setCat(c.id)}
          >
            <Icon name={c.icon} size={14} strokeWidth={1.8} />
            <span>{t(CATEGORY_KEY[c.id], lang)}</span>
          </button>
        ))}
      </div>

      <div className="faint" style={{ fontSize: 12, padding: '0 20px 8px' }}>
        {filtered.length} {filtered.length === 1 ? t('catalog.procedures.one', lang) : t('catalog.procedures.many', lang)}
        {favorites.size === 0 && <> · {t('catalog.hintFav', lang)}</>}
      </div>

      {/* Избранное больше не тупик: из него собирается план курса */}
      {favorites.size > 0 && (
        <div style={{ padding: '0 20px 10px' }}>
          <button className="plan-cta" onClick={onOpenPlan}>
            <div className="plan-cta-icon"><Icon name="heart-filled" size={19} strokeWidth={1.8} /></div>
            <div className="plan-cta-text">
              <div className="plan-cta-title">
                {lang === 'ru' ? `В избранном: ${favorites.size}` : `Saved: ${favorites.size}`}
              </div>
              <div className="plan-cta-sub">
                {lang === 'ru' ? 'Собрать план — порядок, интервалы и сроки' : 'Build a plan — order, intervals, timeline'}
              </div>
            </div>
            <Icon name="chevron-right" size={20} strokeWidth={2} className="review-cta-arrow" />
          </button>
        </div>
      )}

      <div className="services-grid">
        {filtered.map((s) => {
          const isFav = favorites.has(s.id);
          const price =
            currency === 'usd'
              ? { main: `$${s.priceUsd}`, sub: `${s.priceGel} GEL` }
              : { main: `${s.priceGel} GEL`, sub: `$${s.priceUsd}` };
          return (
            <article key={s.id} className="card service-card">
              <button
                className={`service-image${servicePhoto(s.id) ? '' : ' service-image--blank'}`}
                onClick={() => onOpen(s.id)}
                style={{
                  border: 0,
                  cursor: 'pointer',
                  ...(servicePhoto(s.id) ? { backgroundImage: `url(${servicePhoto(s.id)})` } : {}),
                }}
                aria-label={`Открыть ${s.title}`}
              >
                {servicePhoto(s.id)
                  ? <span className="service-image-badge"><Icon name={s.icon} size={16} strokeWidth={1.9} /></span>
                  : <Icon name={s.icon} size={30} strokeWidth={1.5} className="service-image-glyph" />}
              </button>
              <div className="service-body" onClick={() => onOpen(s.id)} style={{ cursor: 'pointer' }}>
                <h3 className="service-title">{sTitle(s, lang)}</h3>
                <p className="service-desc">{sShort(s, lang)}</p>
                <div className="service-meta">
                  <span className="service-price">{price.main}</span>
                  <span className="faint" style={{ fontSize: 12 }}>· {price.sub}</span>
                  <span className="service-duration">
                    <Icon name="clock" size={12} strokeWidth={2} />
                    {durationLabel(s.duration, s.days)}
                  </span>
                </div>
              </div>
              <button
                className="fav-btn"
                aria-pressed={isFav}
                aria-label={isFav ? 'Убрать из избранного' : 'В избранное'}
                onClick={() => {
                  onToggleFavorite(s.id);
                  toast(isFav ? 'Убрала из избранного' : 'Добавила в избранное', 'success');
                }}
              >
                <Icon name={isFav ? 'heart-filled' : 'heart'} size={16} strokeWidth={1.8} />
              </button>
            </article>
          );
        })}
        {filtered.length === 0 && (
          <div className="card" style={{ textAlign: 'center', padding: 28 }}>
            <div style={{ marginBottom: 8, color: 'var(--brand-primary)', display: 'flex', justifyContent: 'center' }}>
              <Icon name="lotus" size={32} strokeWidth={1.6} />
            </div>
            <div className="muted">{t('catalog.emptyTitle', lang)}</div>
            <button className="btn btn-secondary btn-sm mt" onClick={() => { setQ(''); setCat('all'); }}>
              {t('catalog.reset', lang)}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
