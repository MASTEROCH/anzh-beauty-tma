import { Icon } from './Icon';
import { SwipeRow } from './SwipeRow';
import { findService, isBookable, servicePhoto, sTitle } from '../data/services';
import { servicePrice } from '../lib/money';
import { durationLabel } from '../lib/plural';
import { tap } from '../lib/haptics';
import { toast } from '../lib/ui';
import type { Lang } from '../lib/i18n';

/* МОИ ЗАКЛАДКИ (Роч 15.10): «добавить процедуру, чтобы потом сделать, и
   зайти посмотреть свои закладки». Сердечко в каталоге было — входа в
   список не было, кроме «Плана процедур». Теперь закладки — свой блок в
   «Паспорте»: фото, цена, время и запись в один тап. Убрать — потянуть
   влево. Пусто — говорим, где ставить сердечко, а не прячем блок. */

export function Bookmarks({ favorites, lang, onBook, onToggle, onPlan, onCatalog }: {
  favorites: Set<string>;
  lang: Lang;
  onBook: (id: string) => void;
  onToggle: (id: string) => void;
  onPlan: () => void;
  onCatalog: () => void;
}) {
  const ru = lang === 'ru';
  const list = [...favorites].map((id) => findService(id)).filter((s): s is NonNullable<typeof s> => !!s && isBookable(s));
  return (
    <section className="section" data-testid="bookmarks">
      <div className="row row-between mb-sm" style={{ alignItems: 'center' }}>
        <div className="eyebrow">{ru ? 'мои закладки' : 'my bookmarks'}{list.length > 0 ? ` · ${list.length}` : ''}</div>
        {list.length > 1 && (
          <button className="section-link" onClick={onPlan}>{ru ? 'собрать курс' : 'build a course'}</button>
        )}
      </div>
      {list.length === 0 ? (
        <button className="card bm-empty" onClick={() => { tap(); onCatalog(); }}>
          <span className="bm-empty-ic"><Icon name="heart" size={20} strokeWidth={1.8} /></span>
          <span className="bm-empty-body">
            <b>{ru ? 'Пока пусто' : 'Nothing saved yet'}</b>
            <span>{ru ? 'Нажмите ♡ на процедуре в каталоге — она появится здесь, а бот напомнит, когда будет окно.' : 'Tap ♡ on a treatment — it shows up here, and the bot tells you when there is a free slot.'}</span>
          </span>
          <Icon name="chevron-right" size={16} strokeWidth={2.2} className="bm-go" />
        </button>
      ) : (
        <div className="bm-list">
          {list.map((s) => {
            const ph = servicePhoto(s.id);
            const price = servicePrice(s, lang);
            return (
              <SwipeRow key={s.id} label={ru ? 'Убрать' : 'Remove'} instant onCommit={() => { onToggle(s.id); toast(ru ? 'Убрано из закладок' : 'Removed from bookmarks'); }}>
                <div className="bm-row">
                  <span className="bm-ph" style={ph ? { backgroundImage: `url(${ph})` } : undefined}>
                    {!ph && <Icon name={s.icon} size={18} strokeWidth={1.6} />}
                  </span>
                  <span className="bm-body">
                    <b>{sTitle(s, lang)}</b>
                    <span>{price && <i>{price}</i>}{price && s.duration ? ' · ' : ''}{s.duration ? <i>{durationLabel(s.duration, undefined, lang)}</i> : null}</span>
                  </span>
                  <button className="btn btn-primary btn-sm bm-book" onClick={() => { tap(); onBook(s.id); }}>
                    {ru ? 'Записаться' : 'Book'}
                  </button>
                </div>
              </SwipeRow>
            );
          })}
        </div>
      )}
    </section>
  );
}
