import { useState } from 'react';
import { Icon } from './Icon';
import { openSheet, closeSheet, toast } from '../lib/ui';
import { notify } from '../lib/haptics';
import {
  useReviews, filterReviews, reviewCounts, setReviewState, replyToReview,
  REVIEW_FILTERS, type Review, type ReviewFilter,
} from '../lib/reviews';
import { findService } from '../data/services';
import { openExternal } from '../lib/telegram';
import { instagramUrl } from '../data/location';

/*
   ОТЗЫВЫ С ФИЛЬТРОМ.

   Фильтр здесь не украшение. Отзывов со временем сотни, а нужны из них
   ровно два вида: новые, которых ещё никто не видел, и низкие оценки,
   на которые надо ответить сегодня. Всё остальное — архив, и открывать
   его по делу приходится редко.

   «Низкие» — отдельный срез, а не состояние: тройка, уже стоящая на
   витрине, всё равно требует ответа. Если бы это было состояние, такой
   отзыв исчезал бы из поля зрения ровно в тот момент, когда им надо
   заняться.
*/

export function StudioReviews() {
  const all = useReviews();
  const [f, setF] = useState<ReviewFilter>('new');
  const counts = reviewCounts(all);
  const list = filterReviews(all, f);

  return (
    <div>
      <div className="eyebrow mb-sm">отзывы · {counts.all}</div>

      <div className="rv-filters">
        {REVIEW_FILTERS.map((x) => (
          <button
            key={x.id}
            className={`chip${f === x.id ? ' chip-gold' : ''}`}
            onClick={() => setF(x.id)}
          >
            {x.label}
            {counts[x.id] > 0 && <span className="chip-count">{counts[x.id]}</span>}
          </button>
        ))}
      </div>

      {list.length === 0 && (
        <div className="card empty-card">
          <Icon name="check" size={26} strokeWidth={2} />
          <div className="muted mt-sm">
            {f === 'new' ? 'Новых отзывов нет — все разобраны' : 'В этом срезе пусто'}
          </div>
        </div>
      )}

      <div className="stack-tight">
        {list.map((r) => (
          <article key={r.id} className={`rv${r.stars <= 3 ? ' low' : ''}`}>
            <div className="rv-head row row-between">
              <div className="row" style={{ gap: 'var(--sp-sm)' }}>
                <span className="rv-stars">{'★'.repeat(r.stars)}<span className="rv-stars-off">{'★'.repeat(5 - r.stars)}</span></span>
                <span className="rv-who">{r.clientName}</span>
              </div>
              {r.state === 'new' && <span className="chip chip-amber">новый</span>}
              {r.state === 'hidden' && <span className="chip chip-quiet">скрыт</span>}
            </div>

            <div className="rv-svc">{findService(r.serviceId)?.title ?? r.serviceId}</div>
            <p className="rv-text">{r.text}</p>

            {r.reply && (
              <div className="rv-reply">
                <span className="rv-reply-k">Ответ студии</span>
                {r.reply}
              </div>
            )}

            <div className="rv-actions">
              {r.state !== 'published' && (
                <button
                  className="chip chip-gold"
                  onClick={() => { setReviewState(r.id, 'published'); notify('success'); toast('Отзыв на витрине', 'success'); }}
                >
                  На витрину
                </button>
              )}
              {r.state !== 'hidden' && (
                <button className="chip" onClick={() => { setReviewState(r.id, 'hidden'); toast('Отзыв скрыт'); }}>
                  Скрыть
                </button>
              )}
              <button className="chip" onClick={() => openReply(r)}>
                {r.reply ? 'Изменить ответ' : 'Ответить'}
              </button>
              {r.clientInstagram && (
                <button className="chip" onClick={() => openExternal(instagramUrl(r.clientInstagram))}>
                  @{r.clientInstagram}
                </button>
              )}
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

function openReply(r: Review) {
  openSheet({
    title: 'Ответ на отзыв',
    subtitle: `${r.clientName} · ${'★'.repeat(r.stars)}`,
    body: <ReplyForm review={r} />,
  });
}

function ReplyForm({ review }: { review: Review }) {
  const [text, setText] = useState(review.reply ?? '');

  return (
    <>
      <p className="rv-quote">«{review.text}»</p>

      <p className="muted mb-sm" style={{ fontSize: 13 }}>
        Ответ виден рядом с отзывом на витрине. На низкую оценку отвечают
        по существу: что случилось и что с этим сделали.
      </p>

      <textarea
        className="input"
        rows={4}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Катя, спасибо — покраснение после карбона держится до двух суток, в следующий раз предупрежу заранее и дам уход в подарок."
      />

      <button
        className="btn btn-primary btn-block mt-md"
        disabled={text.trim().length < 3}
        onClick={() => {
          replyToReview(review.id, text);
          notify('success');
          closeSheet();
          toast('Ответ сохранён', 'success');
        }}
      >
        Сохранить ответ
      </button>
    </>
  );
}
