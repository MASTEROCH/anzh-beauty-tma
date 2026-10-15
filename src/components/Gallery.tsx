import { useMemo, useState, useEffect, useRef } from 'react';
import { useReveal } from '../lib/reveal';
import { Icon, type IconName } from './Icon';
import { closeSheet, openSheet, openLightbox, openLightboxSet, toast } from '../lib/ui';
import { select, tap } from '../lib/haptics';
import { useLang, t, type Lang } from '../lib/i18n';
import { isBookable, sTitle } from '../data/services';
import { useCatalog } from '../lib/catalog';
import { asset } from '../lib/asset';
import { telegramUrl } from '../data/location';
import { openTelegram } from '../lib/telegram';
import { MASTERS, WORK_GROUPS, masterPhoto, shownWorks, thumbOf, type MasterId, type ProcedurePhoto, type Work, type WorkDirection } from '../data/works';

// «Работы наших мастеров» (KT-7, K11a, option A of Sanya's brief): the studio's own photos
// instead of the stock "directions". The showcase is not changed — brows and laser stay
// hidden in the catalog (B4-А), so a tile opens a sheet with the photo and:
//   · the service is on the showcase → "Book" and "Full details";
//   · it is not → "Message the studio" with the service title in the first message.
// Collages already hold "before" and "after" in one frame, so there is no slider: the tile
// crops, the badge says what the frame is, a tap shows the whole photo.

const masterName = (id: MasterId, lang: Lang) => MASTERS[id].name[lang];
export const masterLine = (id: MasterId, lang: Lang) => t('works.master', lang).replace('{name}', masterName(id, lang));
const byLine = (id: MasterId, lang: Lang) => t('works.by', lang).replace('{name}', masterName(id, lang));
const shortTitle = (w: Pick<Work, 'slug' | 'sub'>, lang: Lang) => WORK_GROUPS[w.slug].short[lang] + (w.sub ? ` · ${w.sub[lang]}` : '');

const badgeOf = (w: Pick<Work, 'hint'>, lang: Lang) =>
  t(w.hint === 'after' ? 'works.badge.after' : w.hint === 'process' ? 'works.badge.process' : 'works.badge.pair', lang);

export const workAlt = (w: Work, lang: Lang) => {
  const key = w.hint === 'after' ? 'works.alt.after' : w.hint === 'process' ? 'works.alt.process'
    : w.hint === 'threeTb' || w.hint === 'threeLr' || w.hint === 'fourTb' ? 'works.alt.multi' : 'works.alt.pair';
  return t(key, lang).replace('{title}', shortTitle(w, lang)).replace('{by}', byLine(w.master, lang));
};

/** Tiles per page of the "Works" grid (K15: 103 photos) — then "Show more". */
export const WORKS_PAGE = 12;

/** The order hint for the photo ("Top — before, bottom — after"); '' when the frame says it. */
export const workHint = (w: Pick<Work, 'hint'>, lang: Lang) => t(`works.hint.${w.hint}`, lang);

/** The whole photo: title and order hint as the caption; master, consent and "results vary"
    under it — the lightbox is its own path to the eye (the lawyer, K11 §5). */
const workItem = (w: Work, lang: Lang) => {
  const hint = workHint(w, lang);
  return {
    src: asset(w.src),
    caption: hint ? `${shortTitle(w, lang)} · ${hint}` : shortTitle(w, lang),
    note: `${masterLine(w.master, lang)} · ${t('works.note', lang)}`,
    alt: workAlt(w, lang),
  };
};

/** `set` — весь ряд, из которого нажали: соседние фото листаются в просмотре */
export function openWorkPhoto(w: Work, lang: Lang, set?: readonly Work[]) {
  if (set && set.length > 1) { openLightboxSet(set.map((x) => workItem(x, lang)), Math.max(0, set.indexOf(w))); return; }
  const it = workItem(w, lang);
  openLightbox(it.src, it.caption, { note: it.note, alt: it.alt });
}

/** A procedure photo (K15) has no author and no consent on record (Hater K15-H1): its caption is
    the service and its sub-area with the order hint; under it — "results vary" only. */
export const procedureCaption = (p: ProcedurePhoto, lang: Lang) => {
  const hint = workHint(p, lang);
  return hint ? `${shortTitle(p, lang)} · ${hint}` : shortTitle(p, lang);
};

/** The caption names the dialog; an alt equal to it would be read twice (UIHost drops it). */
export function openProcedurePhoto(p: ProcedurePhoto, lang: Lang, set?: readonly ProcedurePhoto[]) {
  if (set && set.length > 1) {
    openLightboxSet(set.map((x) => ({ src: asset(x.src), caption: procedureCaption(x, lang), note: t('proc.note', lang) })), Math.max(0, set.indexOf(p)));
    return;
  }
  openLightbox(asset(p.src), procedureCaption(p, lang), { note: t('proc.note', lang) });
}

/** One photo of a work — the tile, the sheet and the service screen draw the same element.
    Tiles and strips take the 480 px copy (K15); the sheet takes the full file. */
export function WorkImg({ w, lang, className, full = false }: { w: Pick<Work, 'src' | 'w' | 'h' | 'hint'>; lang: Lang; className: string; full?: boolean }) {
  /* 🚨 ЗАГРУЗКА ВИДНА, А НЕ ПРОСТО ДОЛГА.
     Плитка ждала фотографию пустым тёмным прямоугольником: сетка уже
     построена, подписи стоят, а кадров нет — и это читается как «висит».
     Движение отвечает на вопрос «что сейчас происходит»: пока кадр летит,
     по плитке идёт мягкая волна; пришёл — проявляется, волна уходит под
     ним. Выход быстрее входа (закон пары), 260 → 170 мс.
     `decode()` вместо `onLoad`: браузер сообщает о загрузке ДО того, как
     картинка готова к рисованию, и кадр успевал мигнуть недодекодированным. */
  const [ready, setReady] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    const el = imgRef.current;
    if (!el) return;
    let alive = true;
    const done = () => { if (alive) setReady(true); };
    if (el.complete && el.naturalWidth > 0) {
      // Кадр уже в кэше — показываем без волны, иначе она мигнёт на ровном месте
      done();
      return;
    }
    el.decode?.().then(done).catch(done);
    el.addEventListener('load', done);
    el.addEventListener('error', done);
    return () => { alive = false; el.removeEventListener('load', done); el.removeEventListener('error', done); };
  }, [w.src, full]);

  return (
    <>
      <span className={`shot-wait${ready ? ' off' : ''}`} aria-hidden />
      <img
        ref={imgRef}
        className={`${className} shot${ready ? ' in' : ''}`}
        src={asset(full ? w.src : thumbOf(w))}
        width={w.w}
        height={w.h}
        loading="lazy"
        decoding="async"
        alt=""
      />
      <span className="work-badge">{badgeOf(w, lang)}</span>
    </>
  );
}

const DIRECTIONS: ReadonlyArray<{ id: 'all' | WorkDirection; key: string; icon: IconName }> = [
  { id: 'all', key: 'cat.all', icon: 'sparkles' },
  { id: 'inj', key: 'cat.inj', icon: 'syringe' },
  { id: 'apparatus', key: 'cat.apparatus', icon: 'wave' },
  { id: 'clean', key: 'cat.clean', icon: 'droplet' },
  { id: 'brows', key: 'cat.brows', icon: 'lash' },
  { id: 'laser', key: 'works.laser', icon: 'bolt' },
];

/* Витрина не должна начинаться шестью одинаковыми кадрами одной процедуры:
   раньше первые ряды были сплошь «Контурная пластика». Раскладываем по
   очереди — по одному кадру каждой процедуры за круг. Порядок мастеров
   сохраняется: работы Анжелики идут первыми (решение Роча), за ними —
   команда, и внутри каждой части процедуры чередуются. */
function interleave(list: Work[]): Work[] {
  const parts: Work[][] = [];
  for (const w of list) {
    const key = w.master === 'anzhelika' ? 0 : 1;
    (parts[key] ??= []).push(w);
  }
  return parts.filter(Boolean).flatMap((part) => {
    const groups = new Map<string, Work[]>();
    for (const w of part) {
      const g = groups.get(w.slug);
      if (g) g.push(w); else groups.set(w.slug, [w]);
    }
    const out: Work[] = [];
    const queues = [...groups.values()];
    for (let i = 0; out.length < part.length; i++) {
      for (const q of queues) if (q[i]) out.push(q[i]);
    }
    return out;
  });
}

export function Gallery({ onBook, onOpenService }: { onBook: (id: string) => void; onOpenService: (id: string) => void }) {
  const lang = useLang();
  const [dir, setDir] = useState<'all' | WorkDirection>('all');
  const [shown, setShown] = useState(WORKS_PAGE);
  const { live } = useCatalog();

  const all = shownWorks();
  // A direction without a shown photo gets no chip: an empty filter promises what it can't show
  const present = new Set(all.map((w) => WORK_GROUPS[w.slug].direction));
  const chips = DIRECTIONS.filter((d) => d.id === 'all' || present.has(d.id));
  const list = useMemo(() => interleave(dir === 'all' ? all : all.filter((w) => WORK_GROUPS[w.slug].direction === dir)), [all.length, dir]); // eslint-disable-line react-hooks/exhaustive-deps
  const page = list.slice(0, shown);
  const rest = list.length - page.length;
  // Rebuild the observer on a filter change and on "Show more": new tiles must get `in`
  // Один раз, как витрина PEONIA: поднявшаяся карточка не прячется обратно
  const gridRef = useReveal<HTMLDivElement>([dir, shown], { once: true });

  const openCase = (w: Work) => {
    tap();
    // On the showcase → the row's own title and the booking path; otherwise the full title
    // from the work data and the studio chat (the service can't be booked in the app yet).
    const row = live.find((x) => x.id === w.slug);
    const title = row ? sTitle(row, lang) : WORK_GROUPS[w.slug].full[lang];
    const hint = workHint(w, lang);
    const avatar = masterPhoto(w.master);
    const write = () => {
      const withLine = t('works.with', lang).replace('{name}', masterName(w.master, lang));
      openTelegram(telegramUrl(t('works.message', lang).replace('{title}', title).replace('{with}', withLine)));
      toast(lang === 'ru' ? 'Открываю чат в Telegram' : 'Opening the Telegram chat', 'success');
    };
    openSheet({
      title,
      subtitle: masterLine(w.master, lang),
      body: (
        <>
          {avatar && <img className="work-master-avatar" src={asset(avatar.src)} width={avatar.w} height={avatar.h} alt="" />}
          <button
            className="case-photo case-photo--work"
            data-work={w.id}
            onClick={() => openWorkPhoto(w, lang, list)}
            aria-label={`${t('works.open', lang)}: ${workAlt(w, lang)}`}
          >
            <WorkImg w={w} lang={lang} className="case-photo-img" full />
            <span className="case-photo-zoom"><Icon name="search" size={15} strokeWidth={2.2} /></span>
          </button>
          {hint && <p className="case-desc" data-testid="work-hint">{hint}</p>}
          <div className="case-note" data-testid="work-note">
            <Icon name="shield-check" size={14} strokeWidth={1.9} />
            <span>{t('works.note', lang)}</span>
          </div>
        </>
      ),
      actions: row ? (
        <>
          {isBookable(row) && (
            <button className="btn btn-primary btn-block" onClick={() => { closeSheet(); setTimeout(() => onBook(row.id), 200); }}>
              {t('works.book', lang)}
            </button>
          )}
          <button className="btn btn-quiet btn-block" onClick={() => { closeSheet(); setTimeout(() => onOpenService(row.id), 200); }}>
            {t('works.details', lang)}
          </button>
        </>
      ) : (
        <button className="btn btn-primary btn-block" data-testid="work-write" onClick={write}>
          {t('works.write', lang)}
        </button>
      ),
    });
  };

  return (
    <div className="gallery">
      {chips.length > 2 && (
        <div className="gallery-filters category-row" role="tablist">
          {chips.map((c) => (
            <button
              key={c.id}
              role="tab"
              aria-selected={dir === c.id}
              className={`gallery-chip${dir === c.id ? ' active' : ''}`}
              onClick={() => { select(); setDir(c.id); setShown(WORKS_PAGE); }}
            >
              <Icon name={c.icon} size={13} strokeWidth={2} />
              {t(c.key, lang)}
            </button>
          ))}
        </div>
      )}

      <div className="gallery-grid" ref={gridRef}>
        {page.map((w) => (
          <button key={w.id} data-work={w.id} data-slug={w.slug} className="gallery-tile gallery-tile--work" onClick={() => openCase(w)}>
            <WorkImg w={w} lang={lang} className="gallery-tile-img" />
            <span className="gallery-tile-scrim" aria-hidden />
            <span className="gallery-tile-meta">
              <span className="gallery-tile-title">{shortTitle(w, lang)}</span>
              <span className="gallery-tile-sub">{masterLine(w.master, lang)}</span>
            </span>
            <span className="gallery-tile-go" aria-hidden><Icon name="chevron-right" size={14} strokeWidth={2.6} /></span>
          </button>
        ))}
      </div>
      {rest > 0 && (
        <button className="btn btn-quiet btn-block gallery-more" data-testid="works-more" onClick={() => { tap(); setShown((n) => n + WORKS_PAGE); }}>
          {t('works.more', lang).replace('{n}', String(rest))}
        </button>
      )}
    </div>
  );
}
