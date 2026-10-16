import { useCallback, useEffect, useState } from 'react';
import { Icon } from './Icon';
import { openSheet, closeSheet, toast } from '../lib/ui';
import { notify } from '../lib/haptics';
import { getStaffReviews, patchReview, reviewText, reviewName, type ReviewWire } from '../lib/api/reviews';
import { loadReviews } from '../lib/reviewsLive';
import { findService, sTitle } from '../data/services';
import { cabinetDenied } from '../lib/staff';

/*
   ОТЗЫВЫ В КАБИНЕТЕ — с сервера (Роч 15.10: «хранятся только в приложении»).

   Фильтр здесь не украшение. Отзывов со временем сотни, а нужны из них
   ровно два вида: новые, которых ещё никто не видел, и низкие оценки,
   на которые надо ответить сегодня. «Низкие» — срез, а не состояние:
   тройка, уже стоящая на витрине, всё равно требует ответа.

   Скидка −5 % за отзыв клиентке уже начислена в момент отправки — от
   решения «на витрину / скрыть» она не зависит. Иначе модерация стала бы
   торгом за оценку.
*/

type Filter = 'new' | 'low' | 'published' | 'hidden' | 'all';
const FILTERS: Array<{ id: Filter; label: string }> = [
  { id: 'new', label: 'Новые' }, { id: 'low', label: 'Низкие' },
  { id: 'published', label: 'На витрине' }, { id: 'hidden', label: 'Скрытые' }, { id: 'all', label: 'Все' },
];
const pass = (r: ReviewWire, f: Filter) =>
  f === 'all' ? true : f === 'low' ? r.rating <= 3 : (r.state ?? 'new') === f;

const when = (iso: string) => new Date(iso).toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

export function StudioReviews() {
  const [all, setAll] = useState<ReviewWire[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [f, setF] = useState<Filter>('new');
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(() => {
    setFailed(false);
    getStaffReviews().then(setAll, (e) => { cabinetDenied(e); setFailed(true); });
  }, []);
  useEffect(load, [load]);

  const apply = async (r: ReviewWire, patch: { state?: 'published' | 'hidden'; reply?: string | null }, ok: string) => {
    setBusy(r.id);
    try {
      const next = await patchReview(r.id, patch);
      setAll((l) => (l ?? []).map((x) => (x.id === r.id ? { ...x, ...next } : x)));
      void loadReviews(true);
      notify('success'); toast(ok, 'success');
    } catch (e) {
      cabinetDenied(e); notify('error'); toast('Не сохранилось — проверьте интернет');
    } finally { setBusy(null); }
  };

  const list = (all ?? []).filter((r) => pass(r, f));
  const count = (x: Filter) => (all ?? []).filter((r) => pass(r, x)).length;

  return (
    <div>
      <div className="eyebrow mb-sm">отзывы · {all?.length ?? '…'}</div>
      <div className="rv-filters">
        {FILTERS.map((x) => (
          <button key={x.id} className={`chip${f === x.id ? ' chip-gold' : ''}`} onClick={() => setF(x.id)}>
            {x.label}{count(x.id) > 0 && <span className="chip-count">{count(x.id)}</span>}
          </button>
        ))}
      </div>

      {all === null && !failed && <div className="card" style={{ padding: 20, textAlign: 'center' }}><div className="muted">Загружаем отзывы…</div></div>}
      {failed && (
        <div className="card empty-state" role="alert">
          <div className="empty-title">Отзывы не загрузились</div>
          <div className="empty-sub">Проверьте интернет.</div>
          <button className="btn btn-secondary btn-block mt-md" onClick={load}>Повторить</button>
        </div>
      )}
      {all !== null && list.length === 0 && (
        <div className="card empty-card">
          <Icon name="check" size={26} strokeWidth={2} />
          <div className="muted mt-sm">{f === 'new' ? 'Новых отзывов нет — все разобраны' : 'В этом срезе пусто'}</div>
        </div>
      )}

      <div className="stack-tight">
        {list.map((r) => {
          const svc = r.service_slug ? findService(r.service_slug) : undefined;
          const st = r.state ?? 'new';
          return (
            <article key={r.id} className={`rv${r.rating <= 3 ? ' low' : ''}`}>
              <div className="rv-head row row-between">
                <div className="row" style={{ gap: 'var(--sp-sm)' }}>
                  <span className="rv-stars">{'★'.repeat(r.rating)}<span className="rv-stars-off">{'★'.repeat(5 - r.rating)}</span></span>
                  <span className="rv-who">{reviewName(r, 'ru')}</span>
                </div>
                {st === 'new' && <span className="chip chip-amber">новый</span>}
                {st === 'hidden' && <span className="chip chip-quiet">скрыт</span>}
              </div>
              <div className="rv-svc">
                {[svc ? sTitle(svc, 'ru') : null, when(r.created_at), r.verified ? 'была на процедуре' : null, r.publish_consent === false ? 'только для студии' : null].filter(Boolean).join(' · ')}
              </div>
              <p className="rv-text">{reviewText(r, 'ru').text}{reviewText(r, 'ru').translated && <span className="faint"> · перевод, оригинал: «{r.text}»</span>}</p>
              {r.reply && <div className="rv-reply"><span className="rv-reply-k">Ответ студии</span>{r.reply}</div>}
              <div className="rv-actions">
                {st !== 'published' && r.publish_consent !== false && (
                  <button className="chip chip-gold" disabled={busy === r.id} onClick={() => apply(r, { state: 'published' }, 'Отзыв на витрине')}>На витрину</button>
                )}
                {st !== 'hidden' && (
                  <button className="chip" disabled={busy === r.id} onClick={() => apply(r, { state: 'hidden' }, 'Отзыв скрыт')}>Скрыть</button>
                )}
                <button className="chip" onClick={() => openSheet({
                  title: 'Ответ на отзыв', subtitle: `${reviewName(r, 'ru')} · ${'★'.repeat(r.rating)}`,
                  body: <ReplyForm review={r} onSave={(text) => { closeSheet(); void apply(r, { reply: text || null }, text ? 'Ответ сохранён' : 'Ответ убран'); }} />,
                })}>
                  {r.reply ? 'Изменить ответ' : 'Ответить'}
                </button>
              </div>
            </article>
          );
        })}
      </div>
      <p className="faint" style={{ fontSize: 12, marginTop: 12 }}>
        Скидка −5 % за отзыв начисляется клиентке сразу и не зависит от оценки и от того, попадёт ли отзыв на витрину.
      </p>
    </div>
  );
}

function ReplyForm({ review, onSave }: { review: ReviewWire; onSave: (text: string) => void }) {
  const [text, setText] = useState(review.reply ?? '');
  return (
    <>
      <p className="rv-quote">«{review.text}»</p>
      <p className="muted mb-sm" style={{ fontSize: 13 }}>
        Ответ виден рядом с отзывом на витрине. На низкую оценку отвечают по существу: что случилось и что с этим сделали.
      </p>
      <textarea className="input" rows={4} value={text} maxLength={600} onChange={(e) => setText(e.target.value)}
        placeholder="Катя, спасибо — покраснение после карбона держится до двух суток, в следующий раз предупрежу заранее." />
      <button className="btn btn-primary btn-block mt-md" disabled={text.trim().length > 0 && text.trim().length < 3} onClick={() => onSave(text.trim())}>
        {text.trim() ? 'Сохранить ответ' : review.reply ? 'Убрать ответ' : 'Сохранить ответ'}
      </button>
    </>
  );
}
