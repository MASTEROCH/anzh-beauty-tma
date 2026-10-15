import { tr } from '../lib/i18n';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from './Icon';
import { ScrollMarquee } from './ScrollMarquee';
import { openSheet } from '../lib/ui';
import { tap } from '../lib/haptics';
import { useReviewsLive } from '../lib/reviewsLive';
import { findService, sTitle } from '../data/services';
import { openWriteReview } from './WriteReview';
import type { ReviewWire } from '../lib/api/reviews';
import type { Lang } from '../lib/i18n';

/* ОТЗЫВЫ — только из приложения (сервер), публикует владелица.
   Движение — механики ROCH Motion, повторённые своим кодом (лицензия набора
   «только для команды AppHUB» не позволяет вкладывать движок в продукт клиента):
   · rating count-up + каскад звёзд — рейтинг становится событием;
   · tldr-morph — «в двух словах» по темам, по тапу раскрываются цитаты;
     негатив не выбрасываем — у тем с оценкой ниже пяти своя строка;
   · testimonials-flow — две ленты с наклоном и бликом. Едут медленно,
     встают под пальцем и листаются им; тап открывает отзыв целиком —
     длинный текст не уезжает на середине фразы. */

const THEMES: Array<{ id: string; ru: string; en: string; re: RegExp }> = [
  { id: 'result', ru: 'Результат', en: 'Results', re: /результат|эффект|свеж|естествен|сиян|кожа стала|result|glow|natural/i },
  { id: 'care', ru: 'Объясняет и заботится', en: 'Explains and cares', re: /объясн|рассказ|написал|подсказ|уход|explain|care/i },
  { id: 'pain', ru: 'Без боли', en: 'Painless', re: /без боли|не больно|безболезн|комфорт|painless|comfort/i },
  { id: 'vibe', ru: 'Атмосфера', en: 'Atmosphere', re: /атмосфер|уют|кофе|встрет|cozy|atmosphere/i },
];

const dateOf = (iso: string, lang: Lang) => new Date(iso).toLocaleDateString(lang === 'ru' ? 'ru-RU' : 'en-US', { day: 'numeric', month: 'short', year: 'numeric' });

function useInView<T extends Element>(): [React.RefObject<T | null>, boolean] {
  const ref = useRef<T>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || seen) return;
    if (typeof IntersectionObserver === 'undefined') { setSeen(true); return; }
    const io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) { setSeen(true); io.disconnect(); } }, { threshold: 0.35 });
    io.observe(el);
    return () => io.disconnect();
  }, [seen]);
  return [ref, seen];
}

const still = () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/** Рейтинг набирается от 0 до среднего, звёзды загораются каскадом */
function RatingHero({ avg, count, verified, lang }: { avg: number; count: number; verified: number; lang: Lang }) {
  const [ref, seen] = useInView<HTMLDivElement>();
  const [v, setV] = useState(still() ? avg : 0);
  useEffect(() => {
    if (!seen || still()) { if (seen) setV(avg); return; }
    let raf = 0;
    const t0 = performance.now();
    const step = (t: number) => {
      const k = Math.min(1, (t - t0) / 1100);
      setV(avg * (1 - Math.pow(1 - k, 3)));
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    // Скрытая вкладка морозит rAF — финальное число страхуем таймером
    const done = window.setTimeout(() => setV(avg), 1300);
    return () => { cancelAnimationFrame(raf); window.clearTimeout(done); };
  }, [seen, avg]);
  const ru = lang === 'ru';
  return (
    <div className={`rb-hero${seen ? ' lit' : ''}`} ref={ref}>
      <div className="rb-num" aria-label={`${avg.toFixed(1)} ${tr('из', 'of')} 5`}>{v.toFixed(1).replace('.', ru ? ',' : '.')}</div>
      <div className="rb-hero-side">
        <div className="rb-stars" aria-hidden>
          {[0, 1, 2, 3, 4].map((i) => {
            const fill = Math.max(0, Math.min(1, avg - i));
            return (
              <span key={i} className="rb-star" style={{ transitionDelay: `${300 + i * 110}ms` }}>
                <Icon name="star" size={22} strokeWidth={1.4} />
                <span className="rb-star-fill" style={{ width: `${fill * 100}%` }}><Icon name="star" size={22} strokeWidth={1.4} fill="current" /></span>
              </span>
            );
          })}
        </div>
        <div className="rb-meta">
          {ru ? `${count} ${count % 10 === 1 && count % 100 !== 11 ? 'отзыв' : count % 10 >= 2 && count % 10 <= 4 && (count % 100 < 12 || count % 100 > 14) ? 'отзыва' : 'отзывов'}` : `${count} review${count === 1 ? '' : 's'}`}
          {verified > 0 && <> · {ru ? `${verified} после визита` : `${verified} after a visit`}</>}
        </div>
      </div>
    </div>
  );
}

function openFull(r: ReviewWire, lang: Lang) {
  tap();
  const svc = r.service_slug ? findService(r.service_slug) : undefined;
  openSheet({
    title: r.name,
    subtitle: [svc ? sTitle(svc, lang) : null, dateOf(r.created_at, lang)].filter(Boolean).join(' · '),
    body: (
      <div className="rb-full">
        <div className="rb-card-stars" aria-label={`${r.rating} ${tr('из', 'of')} 5`}>{'★'.repeat(r.rating)}<span>{'★'.repeat(5 - r.rating)}</span></div>
        <p>{r.text}</p>
        {r.verified && <div className="rb-verified"><Icon name="check" size={13} strokeWidth={2.6} /> {lang === 'ru' ? 'Была на процедуре в студии' : 'Had a treatment at the studio'}</div>}
        {r.reply && <div className="rb-reply"><b>{lang === 'ru' ? 'Ответ студии' : 'Studio reply'}</b>{r.reply}</div>}
      </div>
    ),
  });
}

function ReviewCardLive({ r, lang, i }: { r: ReviewWire; lang: Lang; i: number }) {
  const svc = r.service_slug ? findService(r.service_slug) : undefined;
  return (
    <button className="rb-card" style={{ ['--tilt' as string]: `${i % 2 ? 1.2 : -1.2}deg`, ['--glint-d' as string]: `${(i % 5) * 1.3}s` }} onClick={() => openFull(r, lang)}>
      <span className="rb-card-stars" aria-label={`${r.rating} ${tr('из', 'of')} 5`}>{'★'.repeat(r.rating)}<span>{'★'.repeat(5 - r.rating)}</span></span>
      <span className="rb-card-text">{r.text}</span>
      <span className="rb-card-who">
        <b>{r.name}</b>
        {svc && <i>{sTitle(svc, lang)}</i>}
        {r.verified && <Icon name="check" size={12} strokeWidth={2.8} className="rb-card-ok" />}
      </span>
    </button>
  );
}

function Tldr({ list, lang }: { list: ReviewWire[]; lang: Lang }) {
  const [ref, seen] = useInView<HTMLDivElement>();
  const [open, setOpen] = useState<string | null>(null);
  const ru = lang === 'ru';
  const groups = useMemo(() => {
    const g = THEMES.map((t) => ({ ...t, items: list.filter((r) => t.re.test(r.text)) })).filter((t) => t.items.length > 0);
    const low = list.filter((r) => r.rating < 5);
    if (low.length) g.push({ id: 'low', ru: 'Что можно лучше', en: 'What could be better', re: /.^/, items: low });
    return g;
  }, [list]);
  if (groups.length === 0) return null;
  const cur = groups.find((g) => g.id === open);
  return (
    <div className={`rb-tldr${seen ? ' scan' : ''}`} ref={ref}>
      <div className="eyebrow">{ru ? 'в двух словах' : 'in a nutshell'}</div>
      <div className="rb-chips">
        {groups.map((g, i) => (
          <button key={g.id} className={`rb-chip${open === g.id ? ' on' : ''}${g.id === 'low' ? ' low' : ''}`} style={{ animationDelay: `${i * 70}ms` }}
            onClick={() => { tap(); setOpen(open === g.id ? null : g.id); }} aria-expanded={open === g.id}>
            {ru ? g.ru : g.en}<b>{g.items.length}</b>
          </button>
        ))}
      </div>
      {cur && (
        <div className="rb-quotes" key={cur.id}>
          {cur.items.slice(0, 4).map((r, i) => (
            <blockquote key={r.id} style={{ animationDelay: `${i * 70}ms` }} onClick={() => openFull(r, lang)}>
              «{r.text.length > 160 ? `${r.text.slice(0, 157)}…` : r.text}» <cite>{r.name}</cite>
            </blockquote>
          ))}
        </div>
      )}
    </div>
  );
}

export function ReviewsBlock({ lang }: { lang: Lang }) {
  const { list, avg, count, loaded } = useReviewsLive();
  const ru = lang === 'ru';
  // Две ленты — только когда отзывов хватает на обе; иначе одна, без пустот
  const two = list.length >= 6;
  const rowA = two ? list.filter((_, i) => i % 2 === 0) : list;
  const rowB = two ? list.filter((_, i) => i % 2 === 1) : [];
  const verified = list.filter((r) => r.verified).length;

  return (
    <section className="section section-tight rb-block" data-testid="reviews-block">
      <div className="section-head">
        <div>
          <div className="eyebrow">{ru ? 'отзывы' : 'reviews'}</div>
          <h2 className="section-title">{ru ? 'Что говорят клиентки' : 'What clients say'}</h2>
        </div>
      </div>

      {loaded && list.length === 0 && (
        <div className="card rb-empty">
          <Icon name="star" size={24} strokeWidth={1.6} />
          <b>{ru ? 'Отзывов пока нет' : 'No reviews yet'}</b>
          <span>{ru ? 'Были у Анжелики? Расскажите, как прошло, — первые отзывы помогут другим решиться.' : 'Been to Anjelika? Tell us how it went — first reviews help others decide.'}</span>
        </div>
      )}

      {avg !== null && list.length > 0 && <RatingHero avg={avg} count={count} verified={verified} lang={lang} />}
      {list.length >= 2 && <Tldr list={list} lang={lang} />}

      {list.length > 0 && (
        <div className="rb-ribbons">
          {list.length < 3
            ? <div className="rb-row-static">{list.map((r, i) => <ReviewCardLive key={r.id} r={r} lang={lang} i={i} />)}</div>
            : (
              <>
                <ScrollMarquee label={ru ? 'Отзывы' : 'Reviews'} speed={18} className="rb-marquee">
                  {rowA.map((r, i) => <ReviewCardLive key={r.id} r={r} lang={lang} i={i} />)}
                </ScrollMarquee>
                {rowB.length > 0 && (
                  <ScrollMarquee label={ru ? 'Ещё отзывы' : 'More reviews'} speed={13} className="rb-marquee rb-marquee--b">
                    {rowB.map((r, i) => <ReviewCardLive key={r.id} r={r} lang={lang} i={i + 1} />)}
                  </ScrollMarquee>
                )}
              </>
            )}
        </div>
      )}

      <button className="btn btn-secondary btn-block rb-write" onClick={() => openWriteReview(lang)}>
        <Icon name="edit" size={15} strokeWidth={2} /> {ru ? 'Написать отзыв' : 'Write a review'}
      </button>
    </section>
  );
}
