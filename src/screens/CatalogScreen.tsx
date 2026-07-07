import { useMemo, useState } from 'react';
import { categories, services, type Service } from '../data/services';
import { toast } from '../lib/ui';
import { Icon } from '../components/Icon';

type Currency = 'usd' | 'gel';

export function CatalogScreen({
  onOpen,
  favorites,
  onToggleFavorite,
  currency,
  onCurrency,
}: {
  onOpen: (id: string) => void;
  favorites: Set<string>;
  onToggleFavorite: (id: string) => void;
  currency: Currency;
  onCurrency: (c: Currency) => void;
}) {
  const [cat, setCat] = useState<Service['category'] | 'all'>('all');
  const [q, setQ] = useState('');

  const filtered = useMemo(() => {
    return services.filter((s) => {
      if (cat !== 'all' && s.category !== cat) return false;
      if (q && !`${s.title} ${s.short}`.toLowerCase().includes(q.toLowerCase())) return false;
      return true;
    });
  }, [cat, q]);

  return (
    <div className="screen">
      <header className="header">
        <div className="header-lede">
          <div className="eyebrow">каталог</div>
          <div className="header-title">Услуги Анжелики</div>
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

      <div className="catalog-search" style={{ marginTop: 14 }}>
        <input
          type="text"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Поиск процедуры…"
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
            <span>{c.label}</span>
          </button>
        ))}
      </div>

      <div className="faint" style={{ fontSize: 12, padding: '0 20px 8px' }}>
        {filtered.length} {filtered.length === 1 ? 'процедура' : 'процедур'} ·{' '}
        {favorites.size > 0 && (
          <button
            style={{ background: 'none', border: 0, color: 'var(--accent-light)', cursor: 'pointer', font: 'inherit' }}
            onClick={() => toast(`В избранном: ${favorites.size}`)}
          >
            ♡ избранное {favorites.size}
          </button>
        )}
        {favorites.size === 0 && <span>нажми ♡ чтобы добавить в избранное</span>}
      </div>

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
                className="service-image"
                onClick={() => onOpen(s.id)}
                style={{ border: 0, cursor: 'pointer' }}
                aria-label={`Открыть ${s.title}`}
              >
                <Icon name={s.icon} size={36} strokeWidth={1.6} />
              </button>
              <div className="service-body" onClick={() => onOpen(s.id)} style={{ cursor: 'pointer' }}>
                <h3 className="service-title">{s.title}</h3>
                <p className="service-desc">{s.short}</p>
                <div className="service-meta">
                  <span className="service-price">{price.main}</span>
                  <span className="faint" style={{ fontSize: 12 }}>· {price.sub}</span>
                  <span className="service-duration">
                    <Icon name="clock" size={12} strokeWidth={2} />
                    {s.duration} мин
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
            <div style={{ fontSize: 32, marginBottom: 8 }}>🪷</div>
            <div className="muted">Ничего не нашли — попробуйте другой запрос или категорию.</div>
            <button className="btn btn-ghost btn-sm" style={{ marginTop: 14 }} onClick={() => { setQ(''); setCat('all'); }}>
              Сбросить фильтр
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
