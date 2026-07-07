import { useState } from 'react';
import { closeSheet, toast } from '../lib/ui';
import { Icon } from './Icon';
import { services, sTitle } from '../data/services';
import { useLang } from '../lib/i18n';

interface Props {
  defaultServiceId?: string;
  onAwardPoints: (points: number) => void;
}

const DISCOUNT_REVIEW = 10; // % off next procedure for a review
const DISCOUNT_PHOTO = 5;   // extra % for a before/after photo

export function ReviewSheet({ defaultServiceId, onAwardPoints }: Props) {
  void onAwardPoints; // reward is now a discount, not points
  const lang = useLang();
  const ru = lang === 'ru';
  const [stars, setStars] = useState(0);
  const [hover, setHover] = useState(0);
  const [text, setText] = useState('');
  const [serviceId, setServiceId] = useState<string>(defaultServiceId ?? services[0].id);
  const [withPhoto, setWithPhoto] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const minChars = 20;
  const totalDiscount = DISCOUNT_REVIEW + (withPhoto ? DISCOUNT_PHOTO : 0);
  const code = `ANZH${totalDiscount}`;
  const ready = stars > 0 && text.trim().length >= minChars;

  const submit = () => {
    if (!ready || submitting) return;
    setSubmitting(true);
    setTimeout(() => {
      try { navigator.clipboard?.writeText(code); } catch { /* ignore */ }
      toast(
        ru
          ? `Готово! −${totalDiscount}% на следующую процедуру · промокод ${code} скопирован`
          : `Done! −${totalDiscount}% off your next treatment · promo ${code} copied`,
        'success',
      );
      closeSheet();
    }, 600);
  };

  return (
    <div className="review-form">
      {/* Incentive banner — discount, not points */}
      <div className="review-incentive">
        <div className="review-incentive-glow" aria-hidden />
        <Icon name="gift" size={20} strokeWidth={1.8} />
        <div className="review-incentive-text">
          <strong>−{DISCOUNT_REVIEW}%</strong> {ru ? 'на следующую процедуру за честный отзыв' : 'off your next treatment for an honest review'}
          <span className="faint" style={{ display: 'block', fontSize: 12, marginTop: 2 }}>
            {ru ? `+${DISCOUNT_PHOTO}% к скидке, если приложишь фото результата` : `+${DISCOUNT_PHOTO}% more if you attach a result photo`}
          </span>
        </div>
      </div>

      {/* Service picker */}
      <div className="review-section">
        <div className="eyebrow" style={{ marginBottom: 8 }}>{ru ? 'процедура' : 'treatment'}</div>
        <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
          {services.slice(0, 5).map((s) => {
            const title = sTitle(s, lang);
            return (
              <button
                key={s.id}
                className={`chip ${serviceId === s.id ? 'active' : ''}`}
                onClick={() => setServiceId(s.id)}
              >
                <Icon name={s.icon} size={13} strokeWidth={1.8} />
                <span>{title.length > 18 ? title.slice(0, 16) + '…' : title}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Stars */}
      <div className="review-section">
        <div className="eyebrow" style={{ marginBottom: 8 }}>{ru ? 'оценка' : 'rating'}</div>
        <div
          className="review-stars"
          onMouseLeave={() => setHover(0)}
          role="radiogroup"
          aria-label="Оценка"
        >
          {[1, 2, 3, 4, 5].map((i) => {
            const active = i <= (hover || stars);
            return (
              <button
                key={i}
                className={`review-star ${active ? 'active' : ''}`}
                onClick={() => setStars(i)}
                onMouseEnter={() => setHover(i)}
                aria-label={`${i} звёзд`}
                role="radio"
                aria-checked={stars === i}
              >
                <Icon name="star" size={32} strokeWidth={1.4} fill={active ? 'current' : 'none'} />
              </button>
            );
          })}
        </div>
        <div className="review-star-label">
          {stars === 0 && (hover === 0 ? (ru ? 'Поставь оценку — от 1 до 5' : 'Rate from 1 to 5') : starLabel(hover, ru))}
          {stars > 0 && starLabel(hover || stars, ru)}
        </div>
      </div>

      {/* Text */}
      <div className="review-section">
        <div className="eyebrow" style={{ marginBottom: 8 }}>{ru ? 'отзыв' : 'review'}</div>
        <textarea
          className="review-textarea"
          placeholder={ru
            ? 'Расскажи о процедуре и результате — что понравилось, что бы улучшила, кому посоветуешь.'
            : 'Tell us about the treatment and result — what you loved, what to improve, who you’d recommend it to.'}
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={500}
          rows={5}
        />
        <div className="review-counter">
          <span className={text.length >= minChars ? 'ok' : 'low'}>
            {text.length} / {minChars}+ {ru ? 'символов' : 'chars'}
          </span>
          <span className="faint">{500 - text.length} {ru ? 'осталось' : 'left'}</span>
        </div>
      </div>

      {/* Photo toggle */}
      <button
        className={`review-photo ${withPhoto ? 'on' : ''}`}
        onClick={() => setWithPhoto((p) => !p)}
        aria-pressed={withPhoto}
      >
        <Icon name={withPhoto ? 'check' : 'plus'} size={18} strokeWidth={2.2} />
        <div style={{ flex: 1, textAlign: 'left' }}>
          <div style={{ fontWeight: 600 }}>{withPhoto ? (ru ? 'Фото приложено' : 'Photo attached') : (ru ? 'Приложить фото «до / после»' : 'Attach a before / after photo')}</div>
          <div className="faint" style={{ fontSize: 12, marginTop: 2 }}>
            +{DISCOUNT_PHOTO}% {ru ? 'к скидке · публикуется только с твоего согласия' : 'more off · published only with your consent'}
          </div>
        </div>
        {withPhoto && <span className="chip-gold" style={{ padding: '4px 10px', fontSize: 11 }}>+{DISCOUNT_PHOTO}%</span>}
      </button>

      {/* Submit */}
      <div className="review-submit-row">
        <button
          className="btn btn-primary btn-block"
          onClick={submit}
          disabled={!ready || submitting}
        >
          {submitting
            ? (ru ? 'Отправляю…' : 'Sending…')
            : ready
              ? `${ru ? 'Отправить' : 'Send'} · −${totalDiscount}%`
              : stars === 0
                ? (ru ? 'Поставь оценку' : 'Add a rating')
                : `${ru ? 'Ещё' : 'Add'} ${minChars - text.trim().length} ${ru ? 'символов' : 'chars'}`}
        </button>
        <button className="btn btn-ghost btn-block" onClick={closeSheet} disabled={submitting}>
          {ru ? 'Отмена' : 'Cancel'}
        </button>
      </div>
    </div>
  );
}

function starLabel(n: number, ru: boolean) {
  const rus = ['', 'Скорее нет', 'Так себе', 'Норм', 'Хорошо', 'Бомба!'];
  const eng = ['', 'Not really', 'So-so', 'OK', 'Good', 'Amazing!'];
  return (ru ? rus : eng)[n] ?? '';
}
