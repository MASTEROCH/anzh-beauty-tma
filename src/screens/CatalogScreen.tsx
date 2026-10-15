import { ModelCard } from '../components/ModelProgram';
import { usePriceMode } from '../lib/priceMode';
import { useRate } from '../lib/rates';
import { useMemo, useState } from 'react';
import { durationLabel, plural } from '../lib/plural';
import { ON_REQUEST, askAbout, type OnRequestService } from '../data/onRequest';
import { coverPhotoFor } from '../data/works';
import { openChat } from '../lib/chatBus';
import { tap } from '../lib/haptics';
import { categories, sTitle, sShort, CATEGORY_KEY, servicePhoto, type Service } from '../data/services';
import { catalogNote, useCatalog } from '../lib/catalog';
import { SECOND_PRICE_NOTE, servicePrice, serviceSecondPrice } from '../lib/money';
import { toast } from '../lib/ui';
import { Icon } from '../components/Icon';
import { useLang, t, tr } from '../lib/i18n';

const NBSP = String.fromCharCode(0xa0);

/* Price — the main line in the row's own currency (B1-B, owner's "1-a" 06.10): no currency
   switch; the string comes from lib/money.ts, the same on every screen (K5). A lari row gets
   the second price in brackets in the SAME block — "от 350 ₾ за сеанс (≈ $128)" (K11b; K13
   H-2: the block is one flex item, and a no-break space ties the bracket to the main line,
   so the dollars never wrap away to the length). Once under the list — the note on which
   currency is paid (lib/money.ts SECOND_PRICE_NOTE), only when a second price is shown. */
/* Фаза «дыхания» плитки без фото — по id, чтобы она не прыгала при
   перерисовке и у соседних плиток была разной. Отрицательная задержка
   значит «уже идёт»: плитка не стартует с одной и той же позы. */
const tilePhase = (id: string) => {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % 997;
  return h % 14;
};

const MODEL_MARK = { modelCard: true } as const;

export function CatalogScreen({
  onOpen,
  favorites,
  onToggleFavorite,
  onOpenPlan,
}: {
  onOpen: (id: string) => void;
  favorites: Set<string>;
  onToggleFavorite: (id: string) => void;
  onOpenPlan: () => void;
}) {
  // Витрина — с сервера (GET /services), без сети — из кэша, до первой
  // загрузки — из бандла (lib/catalog.ts). Не свежий ответ — с пометкой.
  const catalog = useCatalog();
  const { live } = catalog;
  const [cat, setCat] = useState<Service['category'] | 'all'>('all');
  const [q, setQ] = useState('');
  const lang = useLang();
  const priceMode = usePriceMode(); // перерисовка при смене валюты показа
  useRate();
  const ru = lang === 'ru';
  const note = catalogNote(catalog);

  // Чипы — только направлений, где есть процедуры: пустой фильтр — обещание,
  // которое интерфейс не выполняет (и так же скрыт «Дерматолог» с витрины).
  // Услуги «по запросу» (data/onRequest.ts) — пока у сервера нет такой же
  // строки с ценой. Появилась цена — карточка уступает место обычной.
  const extra = useMemo(() => ON_REQUEST.filter((x) => !live.some((s) => s.id === x.id)), [live]);
  const present = useMemo(() => new Set([...live.map((s) => s.category), ...extra.map((x) => x.category)]), [live, extra]);
  const chips = categories.filter((c) => c.id === 'all' || present.has(c.id as Service['category']));

  const filtered = useMemo(() => {
    const needle = q.toLowerCase();
    return live.filter((s) => {
      if (cat !== 'all' && s.category !== cat) return false;
      if (needle && !`${s.title} ${s.short} ${sTitle(s, lang)} ${sShort(s, lang)}`.toLowerCase().includes(needle)) return false;
      return true;
    });
  }, [cat, q, live, lang]);

  const extraShown = useMemo(() => {
    const needle = q.toLowerCase();
    return extra.filter((x) => {
      if (cat !== 'all' && x.category !== cat) return false;
      if (needle && !`${x.title} ${x.short} ${x.titleEn} ${x.shortEn} ${x.masterName.ru}`.toLowerCase().includes(needle)) return false;
      return true;
    });
  }, [extra, cat, q]);
  const shownCount = filtered.length + extraShown.length;

  const renderAsk = (x: OnRequestService) => {
          const photo = coverPhotoFor(x.id)?.src ?? null;
          const ask = () => { tap(); openChat('admin', askAbout(x, ru ? 'ru' : 'en')); };
          return (
            <article key={x.id} className="card service-card service-card--ask" data-slug={x.id}>
              <button
                className={`service-image${photo ? '' : ' service-image--blank'}`}
                onClick={ask}
                style={{ border: 0, cursor: 'pointer', ...(photo ? { backgroundImage: `url(${photo})` } : { ['--tile-phase' as string]: `-${tilePhase(x.id)}s` }) }}
                aria-label={ru ? `Узнать цену: ${x.title}` : `Ask the price: ${x.titleEn}`}
              >
                {!photo && <Icon name={x.icon} size={34} strokeWidth={1.5} className="service-image-glyph" />}
              </button>
              <div className="service-body" onClick={ask} style={{ cursor: 'pointer' }}>
                <h3 className="service-title">{ru ? x.title : x.titleEn}</h3>
                <p className="service-desc">{ru ? x.short : x.shortEn}</p>
                <div className="service-master">{x.masterName[ru ? 'ru' : 'en']}</div>
                <div className="service-meta">
                  <span className="service-ask">
                    <Icon name="message" size={12} strokeWidth={2.1} />
                    {ru ? 'Цена у администратора' : 'Price on request'}
                  </span>
                </div>
              </div>
            </article>
          );
        };


  // K11b: the note once per screen, when the list shows a second price (lari rows only — K13, H-1a)
  const priceNote = useMemo(() => filtered.some((s) => serviceSecondPrice(s) !== null), [filtered, priceMode]);
  // K13 (F2): only favorites that are on the showcase count — an id of an archived demo row
  // (kept on the device from the prototype) is not "saved" anywhere the person can see
  const savedCount = useMemo(() => live.filter((s) => favorites.has(s.id)).length, [live, favorites]);

  return (
    <div className="screen">
      <header className="header">
        <div className="header-lede">
          <div className="eyebrow">{t('catalog.eyebrow', lang)}</div>
          <div className="header-title">{t('catalog.title', lang)}</div>
        </div>
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
        {chips.map((c) => (
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

      {note && (
        <p className="faint" data-testid="catalog-note" role="status" style={{ fontSize: 12, padding: '0 20px 8px' }}>{note[lang]}</p>
      )}

      <div className="faint" style={{ fontSize: 12, padding: '0 20px 8px' }}>
        {shownCount} {ru ? plural(shownCount, 'процедура', 'процедуры', 'процедур') : shownCount === 1 ? 'treatment' : 'treatments'}
        {savedCount === 0 && <> · {t('catalog.hintFav', lang)}</>}
      </div>

      {/* Избранное больше не тупик: из него собирается план курса */}
      {savedCount > 0 && (
        <div style={{ padding: '0 20px 10px' }}>
          <button className="plan-cta" onClick={onOpenPlan}>
            <div className="plan-cta-icon"><Icon name="heart-filled" size={19} strokeWidth={1.8} /></div>
            <div className="plan-cta-text">
              <div className="plan-cta-title">
                {lang === 'ru' ? `В избранном: ${savedCount}` : `Saved: ${savedCount}`}
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
        {/* «Стать моделью» — перед обучением: модели нужны именно на курсах */}
        {[...filtered.filter((s) => s.category !== 'training'), ...extraShown, ...((cat === 'all' || cat === 'training') && !q.trim() ? [MODEL_MARK] : []), ...filtered.filter((s) => s.category === 'training')].map((item) => {
          if ('modelCard' in item) return <div key="model-card" className="services-grid-span"><ModelCard lang={lang} /></div>;
          if (!('priceMinor' in item)) return renderAsk(item);
          const s = item;
          const isFav = favorites.has(s.id);
          const price = servicePrice(s, lang);
          const second = price !== null ? serviceSecondPrice(s, lang) : null;
          return (
            <article key={s.id} className="card service-card" data-testid="service-card" data-slug={s.id}>
              <button
                className={`service-image${servicePhoto(s.id) ? '' : ' service-image--blank'}${!servicePhoto(s.id) && s.category === 'training' ? ' service-image--course' : ''}`}
                onClick={() => onOpen(s.id)}
                style={{
                  border: 0,
                  cursor: 'pointer',
                  ...(servicePhoto(s.id)
                    ? { backgroundImage: `url(${servicePhoto(s.id)})` }
                    : { ['--tile-phase' as string]: `-${tilePhase(s.id)}s` }),
                }}
                aria-label={tr(`Открыть ${s.title}`, `Open ${sTitle(s, 'en')}`)}
              >
                {/* Значок поверх фотографии убран: он повторял то, что и так
                    видно на снимке, и отъедал угол кадра. Иконка остаётся
                    только там, где фотографии нет вовсе. */}
                {!servicePhoto(s.id) && <Icon name={s.icon} size={34} strokeWidth={1.5} className="service-image-glyph" />}
                {!servicePhoto(s.id) && s.category === 'training' && (
                  <>
                    <span className="service-image-cap" aria-hidden><Icon name="graduation" size={14} strokeWidth={1.9} /></span>
                    {s.days ? (
                      <span className="service-image-facts" aria-hidden>
                        <span>{durationLabel(s.duration, s.days, lang)}</span>
                        {s.models ? <span>{s.models} {ru ? 'моделей' : 'models'}</span> : null}
                      </span>
                    ) : null}
                  </>
                )}
              </button>
              <div className="service-body" onClick={() => onOpen(s.id)} style={{ cursor: 'pointer' }}>
                <h3 className="service-title">{sTitle(s, lang)}</h3>
                <p className="service-desc">{sShort(s, lang)}</p>
                <div className="service-meta">
                  {price !== null && (
                    <span className="service-price-block" data-testid="price-block">
                      <span className="service-price">{price}</span>
                      {second !== null && <>{NBSP}<span className="service-price-alt" data-testid="price-second">({second})</span></>}
                    </span>
                  )}
                  <span className="service-duration">
                    <Icon name="clock" size={12} strokeWidth={2} />
                    {durationLabel(s.duration, s.days, lang)}
                  </span>
                </div>
              </div>
              <button
                className="fav-btn"
                aria-pressed={isFav}
                aria-label={isFav ? tr('Убрать из избранного', 'Remove from bookmarks') : tr('В избранное', 'Add to bookmarks')}
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
        {shownCount === 0 && (
          <div className="card" style={{ textAlign: 'center', padding: 28 }}>
            <div style={{ marginBottom: 8, color: 'var(--brand-primary)', display: 'flex', justifyContent: 'center' }}>
              <Icon name="lotus" size={32} strokeWidth={1.6} />
            </div>
            {live.length === 0 ? (
              <div className="muted" data-testid="catalog-empty">
                {lang === 'ru' ? 'На витрине пока нет процедур.' : 'No treatments on display yet.'}
              </div>
            ) : (
              <>
                <div className="muted">{t('catalog.emptyTitle', lang)}</div>
                <button className="btn btn-secondary btn-sm mt" onClick={() => { setQ(''); setCat('all'); }}>
                  {t('catalog.reset', lang)}
                </button>
              </>
            )}
          </div>
        )}
      </div>
      {priceNote && (
        <p className="faint" data-testid="price-ref-note" style={{ fontSize: 12, padding: '12px 20px 0' }}>
          {SECOND_PRICE_NOTE[lang]}
        </p>
      )}
    </div>
  );
}
