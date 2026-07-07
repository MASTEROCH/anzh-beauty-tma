import { useState } from 'react';
import { closeSheet, toast } from '../lib/ui';
import { Icon } from './Icon';
import { services } from '../data/services';

interface Props {
  defaultServiceId?: string;
  onAwardPoints: (points: number) => void;
}

const POINTS_FOR_REVIEW = 200;
const POINTS_FOR_PHOTO = 100;

export function ReviewSheet({ defaultServiceId, onAwardPoints }: Props) {
  const [stars, setStars] = useState(0);
  const [hover, setHover] = useState(0);
  const [text, setText] = useState('');
  const [serviceId, setServiceId] = useState<string>(defaultServiceId ?? services[0].id);
  const [withPhoto, setWithPhoto] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const minChars = 20;
  const totalPoints = POINTS_FOR_REVIEW + (withPhoto ? POINTS_FOR_PHOTO : 0);
  const ready = stars > 0 && text.trim().length >= minChars;

  const submit = () => {
    if (!ready || submitting) return;
    setSubmitting(true);
    setTimeout(() => {
      onAwardPoints(totalPoints);
      toast(`Спасибо! +${totalPoints} баллов · отзыв на модерации`, 'success');
      closeSheet();
    }, 600);
  };

  return (
    <div className="review-form">
      {/* Incentive banner */}
      <div className="review-incentive">
        <div className="review-incentive-glow" aria-hidden />
        <Icon name="gift" size={20} strokeWidth={1.8} />
        <div className="review-incentive-text">
          <strong>+{POINTS_FOR_REVIEW} баллов</strong> за честный отзыв
          <span className="faint" style={{ display: 'block', fontSize: 12, marginTop: 2 }}>
            +{POINTS_FOR_PHOTO} баллов если приложишь фото результата
          </span>
        </div>
      </div>

      {/* Service picker */}
      <div className="review-section">
        <div className="eyebrow" style={{ marginBottom: 8 }}>процедура</div>
        <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
          {services.slice(0, 5).map((s) => (
            <button
              key={s.id}
              className={`chip ${serviceId === s.id ? 'active' : ''}`}
              onClick={() => setServiceId(s.id)}
            >
              <Icon name={s.icon} size={13} strokeWidth={1.8} />
              <span>{s.title.length > 18 ? s.title.slice(0, 16) + '…' : s.title}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Stars */}
      <div className="review-section">
        <div className="eyebrow" style={{ marginBottom: 8 }}>оценка</div>
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
          {stars === 0 && (hover === 0 ? 'Поставь оценку — от 1 до 5' : starLabel(hover))}
          {stars > 0 && (hover === 0 ? starLabel(stars) : starLabel(hover))}
        </div>
      </div>

      {/* Text */}
      <div className="review-section">
        <div className="eyebrow" style={{ marginBottom: 8 }}>отзыв</div>
        <textarea
          className="review-textarea"
          placeholder="Расскажи о процедуре и результате — что понравилось, что бы улучшила, к кому ещё посоветуешь сходить."
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={500}
          rows={5}
        />
        <div className="review-counter">
          <span className={text.length >= minChars ? 'ok' : 'low'}>
            {text.length} / {minChars}+ символов
          </span>
          <span className="faint">{500 - text.length} осталось</span>
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
          <div style={{ fontWeight: 600 }}>{withPhoto ? 'Фото приложено' : 'Приложить фото «до / после»'}</div>
          <div className="faint" style={{ fontSize: 12, marginTop: 2 }}>
            +{POINTS_FOR_PHOTO} баллов · публикуется только с твоего согласия
          </div>
        </div>
        {withPhoto && <span className="chip-gold" style={{ padding: '4px 10px', fontSize: 11 }}>+100</span>}
      </button>

      {/* Submit */}
      <div className="review-submit-row">
        <button
          className="btn btn-primary btn-block"
          onClick={submit}
          disabled={!ready || submitting}
        >
          {submitting
            ? 'Отправляю…'
            : ready
              ? `Отправить · +${totalPoints} баллов`
              : stars === 0
                ? 'Поставь оценку'
                : `Ещё ${minChars - text.trim().length} символов`}
        </button>
        <button className="btn btn-ghost btn-block" onClick={closeSheet} disabled={submitting}>
          Отмена
        </button>
      </div>
    </div>
  );
}

function starLabel(n: number) {
  return ['', '😕 Скорее нет', '🙁 Так себе', '🙂 Норм', '😊 Хорошо', '🤩 Бомба!'][n] ?? '';
}
