import { useState } from 'react';
import { openSheet, closeSheet } from '../lib/ui';
import { Icon } from './Icon';
import { PingPong } from './PingPong';
import { ReviewCard } from './ReviewCard';
import { sTitle } from '../data/services';
import { useCatalog } from '../lib/catalog';
import { telegramUrl } from '../data/location';
import { openTelegram } from '../lib/telegram';
import { useLang } from '../lib/i18n';

interface Props {
  defaultServiceId?: string;
  onAwardPoints: (points: number) => void;
}

/* ОТЗЫВЫ В ПРИЛОЖЕНИИ — ВТОРОЙ РЯД (решение на ночь): сервер отзывов не
   принимает, скидок за отзыв нет. Что было здесь и почему убрано:
     · «−10% за отзыв, +5% за фото» и промокод ANZH10/15 — скидку не
       применял никто, кроме этого телефона;
     · «приложить фото» подставляло СТОКОВУЮ иллюстрацию процедуры в
       карточку как «твоё фото» — чужой снимок под именем клиентки;
     · «Отправить» не отправляло никуда.
   Теперь отзыв уходит настоящим путём — сообщением Анжелике в Telegram, а
   карточка остаётся, чтобы сохранить её себе или показать подруге. */

export function ReviewSheet({ defaultServiceId, onAwardPoints }: Props) {
  void onAwardPoints; // баллов за отзыв нет (второй ряд)
  const lang = useLang();
  const ru = lang === 'ru';
  const { live } = useCatalog();
  const [stars, setStars] = useState(0);
  const [hover, setHover] = useState(0);
  const [text, setText] = useState('');
  const [serviceId, setServiceId] = useState<string | undefined>(defaultServiceId ?? live[0]?.id);
  const [submitting, setSubmitting] = useState(false);

  const minChars = 20;
  const ready = stars > 0 && text.trim().length >= minChars;
  const service = live.find((s) => s.id === serviceId);
  const pickable = service && !live.slice(0, 5).some((s) => s.id === service.id)
    ? [service, ...live.slice(0, 4)]
    : live.slice(0, 5);

  const submit = () => {
    if (!ready || submitting) return;
    setSubmitting(true);
    const title = service ? sTitle(service, lang) : '';
    const message = [
      ru ? 'Анжелика, мой отзыв' : 'Anjelika, my review',
      title ? `${ru ? 'Процедура' : 'Treatment'}: ${title}` : '',
      '★'.repeat(stars) + '☆'.repeat(5 - stars),
      text.trim(),
    ].filter(Boolean).join('\n');
    // Текст отзыва может касаться здоровья — в адрес ссылки он не идёт
    // (правило ночи: медданные не пишутся в URL). Кладём его в буфер обмена
    // и открываем чат: человек вставляет и отправляет сам.
    let copied = false;
    try {
      const p = navigator.clipboard?.writeText(message);
      copied = !!p;
      p?.catch(() => { /* не скопировалось — текст виден в карточке ниже */ });
    } catch { copied = false; }
    openTelegram(telegramUrl());
    setSubmitting(false);
    // Карточка отзыва — только текст и оценка; фото не подставляем.
    openSheet({
      title: ru ? 'Спасибо 💛' : 'Thank you 💛',
      subtitle: copied
        ? (ru ? 'Текст скопирован — вставь его в чат с Анжеликой' : 'Text copied — paste it into the chat with Anjelika')
        : (ru ? 'Перепиши отзыв в чат с Анжеликой — текст ниже' : 'Send the review to Anjelika in the chat — the text is below'),
      body: (
        <ReviewCard
          data={{
            author: ru ? 'Твой отзыв' : 'Your review',
            stars,
            text: text.trim(),
            service: title,
            date: new Date().toLocaleDateString(ru ? 'ru-RU' : 'en-US', { day: 'numeric', month: 'long' }),
          }}
        />
      ),
    });
  };

  return (
    <div className="review-form">
      <p className="faint" style={{ fontSize: 12.5, lineHeight: 1.5, marginBottom: 12 }}>
        {ru
          ? 'Отзыв уйдёт Анжелике сообщением в Telegram. Скидок и баллов за отзыв сейчас нет.'
          : 'The review goes to Anjelika as a Telegram message. There are no discounts or points for reviews right now.'}
      </p>

      {/* Service picker */}
      <div className="review-section">
        <div className="eyebrow mb-sm">{ru ? 'процедура' : 'treatment'}</div>
        <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
          {pickable.map((s) => {
            const title = sTitle(s, lang);
            return (
              <button
                key={s.id}
                className={`chip ${serviceId === s.id ? 'active' : ''}`}
                onClick={() => setServiceId(s.id)}
              >
                <Icon name={s.icon} size={13} strokeWidth={1.8} />
                <PingPong className="chip-pp">{title}</PingPong>
              </button>
            );
          })}
        </div>
      </div>

      {/* Stars */}
      <div className="review-section">
        <div className="eyebrow mb-sm">{ru ? 'оценка' : 'rating'}</div>
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
        <div className="eyebrow mb-sm">{ru ? 'отзыв' : 'review'}</div>
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
              ? (ru ? 'Отправить Анжелике в Telegram' : 'Send to Anjelika in Telegram')
              : stars === 0
                ? (ru ? 'Поставь оценку' : 'Add a rating')
                : `${ru ? 'Ещё' : 'Add'} ${minChars - text.trim().length} ${ru ? 'символов' : 'chars'}`}
        </button>
        <button className="btn btn-quiet btn-block" onClick={closeSheet} disabled={submitting}>
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
