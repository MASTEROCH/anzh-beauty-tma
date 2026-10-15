import { useState } from 'react';
import { Icon } from './Icon';
import { openSheet } from '../lib/ui';
import { notify, select, tap } from '../lib/haptics';
import { postReview } from '../lib/api/reviews';
import { setRewards } from '../lib/rewardsLive';
import { loadReviews } from '../lib/reviewsLive';
import { liveServices } from '../lib/catalog';
import { isBookable, sTitle } from '../data/services';
import { ApiError, useSessionStatus } from '../lib/session';
import type { Lang } from '../lib/i18n';

/* Отзыв — только в приложении, хранится на сервере, публикует владелица.
   Награда (−5% на следующую процедуру, разово) — за сам отзыв при ЛЮБОЙ
   оценке. Награда за высокие звёзды покупала бы оценки: отзывы стали бы
   нечестными, а это запрещено правилами о рекламе и защите потребителей. */

const LABELS = {
  ru: ['', 'Плохо', 'Так себе', 'Нормально', 'Хорошо', 'Отлично'],
  en: ['', 'Poor', 'Fair', 'Okay', 'Good', 'Excellent'],
};

export function openWriteReview(lang: Lang, serviceSlug?: string) {
  tap();
  openSheet({
    title: lang === 'ru' ? 'Ваш отзыв' : 'Your review',
    subtitle: lang === 'ru' ? 'Его прочитает Анжелика и опубликует в приложении' : 'Anjelika will read and publish it in the app',
    body: <ReviewForm lang={lang} serviceSlug={serviceSlug} />,
  });
}

function ReviewForm({ lang, serviceSlug }: { lang: Lang; serviceSlug?: string }) {
  const ru = lang === 'ru';
  const status = useSessionStatus();
  const [rating, setRating] = useState(0);
  const [text, setText] = useState('');
  const [slug, setSlug] = useState<string | null>(serviceSlug ?? null);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [why, setWhy] = useState<string | null>(null);
  const [done, setDone] = useState<null | { reward: number; open: boolean }>(null);
  const services = liveServices().filter(isBookable).slice(0, 14);
  const ready = rating > 0 && text.trim().length >= 10 && !busy;
  // Кнопка не молчит, почему неактивна: говорим, чего не хватает
  const need = !rating ? (ru ? 'Поставьте оценку звёздами' : 'Tap the stars to rate')
    : text.trim().length < 10 ? (ru ? 'Ещё пару слов — от 10 знаков' : 'A few more words — 10 characters minimum') : null;

  if (status !== 'user') {
    return <p className="muted" style={{ lineHeight: 1.55 }}>{ru ? 'Отзыв оставляется в Telegram: откройте приложение у бота студии.' : 'Reviews are left in Telegram: open the app from the studio bot.'}</p>;
  }

  if (done) {
    return (
      <div className="wr-done">
        <span className="wr-done-ic"><Icon name="heart-filled" size={26} strokeWidth={1.8} /></span>
        <b>{ru ? 'Спасибо!' : 'Thank you!'}</b>
        <p>{done.open
          ? (ru ? 'Отзыв появится в приложении после проверки студией.' : 'Your review will appear after the studio checks it.')
          : (ru ? 'Отзыв прочитает только студия — публиковать его не будем.' : 'Only the studio will read it — we won’t publish it.')}</p>
        {done.reward > 0 && (
          <div className="wr-reward"><Icon name="gift" size={16} strokeWidth={2} />
            {ru ? `−${done.reward}% на следующую процедуру — за отзыв` : `−${done.reward}% off your next treatment — for the review`}
          </div>
        )}
      </div>
    );
  }

  const send = async () => {
    if (!ready) return;
    setBusy(true);
    setWhy(null);
    try {
      const r = await postReview({ rating, text: text.trim(), service_slug: slug, publish_consent: consent });
      if (r.rewards) setRewards(r.rewards);
      notify('success');
      void loadReviews(true);
      setDone({ reward: r.rewards?.actions.review === 'done' ? r.rewards.per_action : 0, open: consent });
    } catch (e) {
      notify('error');
      setWhy(e instanceof ApiError && e.message && e.status === 422 ? e.message : (ru ? 'Не отправилось — проверьте связь' : 'Not sent — check your connection'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="wr">
      <div className="wr-stars" role="radiogroup" aria-label={ru ? 'Оценка' : 'Rating'}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} role="radio" aria-checked={rating === n} aria-label={`${n}`}
            className={`wr-star${n <= rating ? ' on' : ''}`} style={{ transitionDelay: `${(n - 1) * 40}ms` }}
            onClick={() => { select(); setRating(n); }}>
            <Icon name="star" size={34} strokeWidth={1.5} fill={n <= rating ? 'current' : 'none'} />
          </button>
        ))}
      </div>
      <div className="wr-label" aria-live="polite">{rating ? LABELS[lang][rating] : (ru ? 'Поставьте оценку' : 'Tap to rate')}</div>

      {services.length > 0 && (
        <div className="wr-procs">
          {services.map((s) => (
            <button key={s.id} className={`chip${slug === s.id ? ' chip-gold' : ''}`} onClick={() => { tap(); setSlug(slug === s.id ? null : s.id); }}>
              {sTitle(s, lang)}
            </button>
          ))}
        </div>
      )}

      <textarea
        className="pe-area wr-text"
        rows={5}
        maxLength={1200}
        value={text}
        onChange={(e) => { setText(e.target.value); setWhy(null); }}
        placeholder={ru ? 'Как прошла процедура, что понравилось, что можно лучше' : 'How it went, what you liked, what could be better'}
        aria-label={ru ? 'Текст отзыва' : 'Review text'}
      />

      <label className="pe-toggle">
        <input type="checkbox" checked={consent} onChange={(e) => { select(); setConsent(e.target.checked); }} />
        <span className="pe-toggle-box" aria-hidden />
        <span className="pe-toggle-text">{ru ? 'Можно опубликовать' : 'OK to publish'}<small>{ru ? 'Покажем имя и текст в приложении. Без галочки отзыв прочитает только студия' : 'We show your first name and the text in the app. Unchecked — only the studio reads it'}</small></span>
      </label>

      <p className="faint pe-hint">{ru ? 'За отзыв — −5% на следующую процедуру, один раз. Скидка не зависит от оценки.' : 'A review gets you −5% off your next treatment, once. The discount does not depend on the rating.'}</p>
      {why && <p className="form-why" role="alert">{why}</p>}
      {!why && need && <p className="faint wr-need" aria-live="polite">{need}</p>}
      <button className="btn btn-primary btn-block" disabled={!ready} onClick={() => { void send(); }}>
        {busy ? (ru ? 'Отправляем…' : 'Sending…') : (ru ? 'Отправить отзыв' : 'Send review')}
      </button>
    </div>
  );
}
