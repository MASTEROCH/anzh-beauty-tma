import { usePriceMode } from '../lib/priceMode';
import { useRate } from '../lib/rates';
import { findService, sTitle, servicePhoto } from '../data/services';
import { procedurePhotosFor, worksFor } from '../data/works';
import { useCatalog } from '../lib/catalog';
import { FROM_SENTENCE, SECOND_PRICE_NOTE, servicePrice, serviceSecondPrice } from '../lib/money';
import { useMe } from '../lib/api';
import { telegramUrl } from '../data/location';
import { openTelegram } from '../lib/telegram';
import { durationLabel } from '../lib/plural';
import { openSheet, openLightbox, toast } from '../lib/ui';
import { LiveAnjelika } from '../components/LiveAvatar';
import { Icon } from '../components/Icon';
import { WorkImg, masterLine, openProcedurePhoto, openWorkPhoto, procedureCaption, workAlt } from '../components/Gallery';
import { useLang, t, tr } from '../lib/i18n';

const NBSP = String.fromCharCode(0xa0);
import { isBookable } from '../lib/appointments';
import { PROFILE_TEXTS_SHOWN } from '../data/profile';

/* Regalia in the master sheet — T2 ed. 2 §2.5, the lawyer's wording "before documents";
   shown only under PROFILE_TEXTS_SHOWN (her "yes", data/profile.ts). No brands. */
const MASTER_REGALIA: ReadonlyArray<{ ru: string; en: string }> = [
  { ru: 'ХНМУ (Харьков), высшее медицинское образование, 2020', en: 'Kharkiv National Medical University, higher medical education (MD), 2020' },
  { ru: 'Школа косметологов, 2018', en: 'Cosmetology school, 2018' },
  { ru: 'Больше 50 сертификатов конгрессов и семинаров, кадавер-курсы', en: '50+ certificates from congresses and seminars, cadaver courses' },
];

export function ServiceScreen({
  serviceId,
  onBack,
  onBook,
  favorites,
  onToggleFavorite,
}: {
  serviceId: string;
  onBack: () => void;
  onBook: (id: string) => void;
  favorites: Set<string>;
  onToggleFavorite: (id: string) => void;
}) {
  const lang = useLang();
  const priceMode = usePriceMode(); // перерисовка при смене валюты показа
  useRate();
  const ru = lang === 'ru';
  const catalog = useCatalog();
  const { me } = useMe();
  // Только то, что есть на витрине. Раньше неизвестный id молча показывал
  // губы — человек записывался не на то, что открыл.
  const onShowcase = catalog.live.some((x) => x.id === serviceId);
  const found = onShowcase ? findService(serviceId) : undefined;

  if (!found) {
    const waiting = catalog.status === 'idle' || catalog.status === 'loading';
    return (
      <div className="screen">
        <header className="header">
          <button className="header-back" onClick={onBack} aria-label={tr('Назад', 'Back')}><Icon name="chevron-left" size={20} strokeWidth={2} /></button>
          <div className="header-title">{t('service.details', lang)}</div>
          <div style={{ width: 36 }} />
        </header>
        <section className="section">
          <div className="card" style={{ padding: 20, textAlign: 'center' }} data-testid={waiting ? 'service-loading' : 'service-missing'}>
            <div className="muted">
              {waiting
                ? (ru ? 'Загружаю процедуру…' : 'Loading the treatment…')
                : (ru ? 'Этой процедуры сейчас нет на витрине.' : 'This treatment isn’t on display right now.')}
            </div>
            {!waiting && (
              <button className="btn btn-primary btn-sm mt" onClick={onBack}>{ru ? 'В каталог' : 'To the catalog'}</button>
            )}
          </div>
        </section>
      </div>
    );
  }

  const s = found;
  const isFav = favorites.has(s.id);
  const photo = servicePhoto(s.id);
  // The studio's own work photos for this service (only those that may be shown, K11a)
  const works = worksFor(s.id);
  // K15 procedure photos of this service: their own block, no author, no consent line (H1)
  const procs = procedurePhotosFor(s.id);
  // The main line in the row's own currency — the same string as the catalog card (K5);
  // a lari row: in the same block the second price "(≈ $128)" and, under the price, its note
  // (K11b; K13 H-1a, H-2 — a dollar row has neither).
  const price = servicePrice(s, lang);
  const second = price !== null ? serviceSecondPrice(s, lang) : null;
  const priceNote = second !== null ? SECOND_PRICE_NOTE[lang] : null;
  const description = lang === 'en' ? s.descriptionEn || s.description : s.description;

  /* Поделиться — готовой ссылкой сервера на приложение (Me.referral_link).
     Прежний адрес anzh.tma/service/… не существовал: ссылка вела в никуда.
     Нет ссылки (гость, профиль не загружен) — нет и кнопки. */
  /* Курс обучения онлайн не записывается: сервер отвечает 422 not_bookable
     и на /slots, и на заявку (Хейтер №11). Вместо «Записаться» — чат с
     Анжеликой с названием курса в первом сообщении. */
  const course = !isBookable(s);
  const writeAboutCourse = () => {
    openTelegram(telegramUrl(ru
      ? `Здравствуйте! Хочу на курс «${sTitle(s, lang)}»`
      : `Hi! I’d like to join the course “${sTitle(s, lang)}”`));
    toast(ru ? 'Открываю чат в Telegram' : 'Opening the Telegram chat', 'success');
  };

  const shareLink = typeof me?.referral_link === 'string' ? me.referral_link : '';
  const share = () => {
    if (!shareLink) return;
    const text = ru ? `«${sTitle(s, lang)}» у Анжелики в ANZH Cosmetology` : `“${sTitle(s, lang)}” with Anjelika at ANZH Cosmetology`;
    openTelegram(`https://t.me/share/url?url=${encodeURIComponent(shareLink)}&text=${encodeURIComponent(text)}`);
  };

  const showMaster = () =>
    openSheet({
      title: 'Анжелика',
      subtitle: ru ? 'Врач-косметолог · Батуми' : 'Medical cosmetologist · Batumi',
      body: (
        <>
          <LiveAnjelika
            alt="Anjelika"
            style={{
              width: 96,
              height: 96,
              borderRadius: '50%',
              objectFit: 'cover',
              margin: '0 auto 14px',
              display: 'block',
              border: '2px solid var(--border-strong)',
            }}
          />
          {PROFILE_TEXTS_SHOWN && (
            <ul className="info-list" data-testid="master-regalia">
              {MASTER_REGALIA.map((r) => <li key={r.ru}>{ru ? r.ru : r.en}</li>)}
            </ul>
          )}
        </>
      ),
      actions: course ? (
        <button className="btn btn-primary btn-block" onClick={writeAboutCourse}>
          {ru ? 'Написать Анжелике' : 'Message Anjelika'}
        </button>
      ) : (
        <>
          <button className="btn btn-primary btn-block" onClick={() => onBook(s.id)}>
            Записаться к Анжелике
          </button>
          <button
            className="btn btn-secondary btn-block"
            onClick={() => {
              openTelegram(telegramUrl());
              toast('Открываю чат в Telegram', 'success');
            }}
          >
            Написать в Telegram
          </button>
        </>
      ),
    });

  return (
    <>
    <div className="screen has-cta">
      <header className="header">
        <button className="header-back" onClick={onBack} aria-label={tr('Назад', 'Back')}><Icon name="chevron-left" size={20} strokeWidth={2} /></button>
        <div className="header-title">{t('service.details', lang)}</div>
        {/* «Поделиться» переехал на снимок к сердечку: справа в шапке
            его накрывал переключатель валюты и языка (кадр 15.10). Пустышка
            справа держит заголовок по центру между «назад» и ней — без неё
            space-between прижимал «Подробнее» вправо, под переключатели. */}
        <div style={{ width: 36, flex: '0 0 36px' }} aria-hidden />
      </header>

      <div
        className={`service-hero${photo ? ' service-hero--zoom' : ' service-hero--blank'}`}
        style={photo ? { backgroundImage: `url(${photo})` } : undefined}
        onClick={() => { if (photo) openLightbox(photo, s.title); }}
        role={photo ? 'button' : undefined}
        aria-label={photo ? tr(`Открыть фото: ${s.title}`, `Open photo: ${sTitle(s, 'en')}`) : undefined}
      >
        {photo
          ? <div className="service-hero-badge"><Icon name={s.icon} size={20} strokeWidth={1.8} /></div>
          : <Icon name={s.icon} size={56} strokeWidth={1.3} className="service-image-glyph" />}
        <button
          className="fav-btn"
          aria-pressed={isFav}
          aria-label={isFav ? tr('Убрать из избранного', 'Remove from bookmarks') : tr('В избранное', 'Add to bookmarks')}
          onClick={(e) => {
            e.stopPropagation();
            onToggleFavorite(s.id);
            toast(isFav ? 'Убрала из избранного' : 'Добавила в избранное', 'success');
          }}
          style={{ position: 'absolute', top: 18, right: 18, width: 40, height: 40, zIndex: 2 }}
        >
          <Icon name={isFav ? 'heart-filled' : 'heart'} size={18} strokeWidth={1.8} />
        </button>
        {shareLink && (
          <button
            className="fav-btn"
            aria-label={lang === 'ru' ? 'Поделиться' : 'Share'}
            onClick={(e) => { e.stopPropagation(); share(); }}
            style={{ position: 'absolute', top: 18, right: 68, width: 40, height: 40, zIndex: 2 }}
          >
            <Icon name="share" size={17} strokeWidth={1.9} />
          </button>
        )}
      </div>

      <div className="service-detail-body">
        <h1 className="service-detail-title">{sTitle(s, lang)}</h1>
        <div className="service-detail-meta">
          {price !== null && (
            <span className="service-price-block" data-testid="price-block">
              <strong data-testid="service-price">{price}</strong>
              {second !== null && <>{NBSP}<span className="service-price-alt" data-testid="price-second">({second})</span></>}
            </span>
          )}
          <span className="svc-dur"><Icon name="clock" size={13} strokeWidth={2} /> {durationLabel(s.duration, s.days, lang)}</span>
        </div>
        {/* T2 ed. 2 §4.2: only for a "from" price, never for a course */}
        {s.priceFrom === true && !course && (
          <p className="faint" data-testid="price-from-note" style={{ fontSize: 13, margin: '6px 0 0' }}>{FROM_SENTENCE[lang]}</p>
        )}
        {priceNote !== null && (
          <p className="faint" data-testid="price-ref-note" style={{ fontSize: 13, margin: '6px 0 12px' }}>{priceNote}</p>
        )}
        <p className="service-detail-text">{description}</p>

        {/* An empty "what's included" is not shown: a heading over nothing promises a list. */}
        {s.includes.length > 0 && (
          <div className="info-block" data-testid="service-includes">
            <div className="info-block-title">{t('service.includes', lang)}</div>
            <ul className="info-list">
              {s.includes.map((i) => (
                <li key={i}>{i}</li>
              ))}
            </ul>
          </div>
        )}

        {/* B6-V (decision John 06.10, the lawyer's block 1): a procedure card shows ONE line
            instead of the list — on EVERY procedure, an empty list included (a heading over
            nothing reads as "no contraindications"). The list itself stays in the data: the
            warning at booking and the flag in the client card read it. A course's list is its
            requirements for the student — shown as is, under its own heading. */}
        {course ? (
          s.contraindications.length > 0 && (
            <div className="info-block" data-testid="service-requirements">
              <div className="info-block-title">{t('service.requirements', lang)}</div>
              <ul className="info-list">
                {s.contraindications.map((i) => (
                  <li key={i}>{i}</li>
                ))}
              </ul>
            </div>
          )
        ) : (
          <div className="info-block" data-testid="service-contra">
            <div className="info-block-title">{t('service.contra', lang)}</div>
            <p className="muted" style={{ fontSize: 13.5, lineHeight: 1.55 }}>{t('service.contraLine', lang)}</p>
          </div>
        )}

        {/* "Examples of work": procedures only. The studio's own photos of this service (K11a,
            data/works.ts); a tap opens the whole photo. Consent and "results vary" stand under
            the strip — this screen is its own path to the eye (the lawyer, K11 §5). No shown
            photo — the block says so, without pointing at the picture above; unless the
            "Treatment photos" block below has some (a "no photos yet" over photos contradicts them). */}
        {!course && (works.length > 0 || procs.length === 0) && (
          <div className="info-block" data-testid="service-result">
            <div className="info-block-title">{t('service.result', lang)}</div>
            {works.length > 0 ? (
              <>
                <div className="works-strip" data-testid="service-works">
                  {works.map((w) => (
                    <button key={w.id} className="works-thumb" data-work={w.id} onClick={() => openWorkPhoto(w, lang, works)} aria-label={`${t('works.open', lang)}: ${workAlt(w, lang)}`}>
                      <WorkImg w={w} lang={lang} className="works-thumb-img" />
                    </button>
                  ))}
                </div>
                <div className="faint" style={{ fontSize: 12, marginTop: 8 }}>
                  {[...new Set(works.map((w) => masterLine(w.master, lang)))].join(', ')} · {t('service.tapZoom', lang)}
                </div>
                <div className="case-note" data-testid="service-works-note">
                  <Icon name="shield-check" size={14} strokeWidth={1.9} />
                  <span>{t('works.note', lang)}</span>
                </div>
              </>
            ) : (
              <p className="muted" style={{ fontSize: 13.5, lineHeight: 1.55 }}>{t('service.noPairs', lang)}</p>
            )}
          </div>
        )}

        {/* K15 "Treatment photos" (John 07.10, Hater K15-H1): the procedure folders' frames of THIS
            service. Whose they are and the clients' consent are not confirmed, so no master, no
            studio credit, no consent line — each frame is captioned by its sub-area; under the
            strip only "results vary" (the lawyer, K11 §5). data/works.ts, PROCEDURE_AUTHOR. */}
        {!course && procs.length > 0 && (
          <div className="info-block" data-testid="service-proc">
            <div className="info-block-title">{t('proc.title', lang)}</div>
            <div className="works-strip" data-testid="service-proc-photos">
              {procs.map((p) => (
                <button key={p.id} className="works-thumb" data-work={p.id} onClick={() => openProcedurePhoto(p, lang, procs)} aria-label={`${t('works.open', lang)}: ${procedureCaption(p, lang)}`}>
                  <WorkImg w={p} lang={lang} className="works-thumb-img" />
                  {p.sub && <span className="works-thumb-sub" aria-hidden>{p.sub[lang]}</span>}
                </button>
              ))}
            </div>
            <div className="faint" style={{ fontSize: 12, marginTop: 8 }}>{t('service.tapZoom', lang)}</div>
            <div className="case-note" data-testid="service-proc-note">
              <Icon name="info" size={14} strokeWidth={1.9} />
              <span>{t('proc.note', lang)}</span>
            </div>
          </div>
        )}

        <div className="info-block">
          <div className="info-block-title">{t('service.cabinet', lang)}</div>
          <button
            onClick={showMaster}
            className="card"
            style={{ padding: 14, width: '100%', textAlign: 'left', cursor: 'pointer' }}
          >
            <div className="row" style={{ gap: 12 }}>
              <img
                src="/photos/anjelika.webp"
                alt=""
                style={{
                  flex: '0 0 44px',
                  width: 44,
                  height: 44,
                  borderRadius: '50%',
                  objectFit: 'cover',
                  border: '0.5px solid var(--border-strong)',
                }}
              />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600 }}>{tr('Анжелика · врач-косметолог', 'Anjelika · medical cosmetologist')}</div>
                <div className="faint" style={{ fontSize: 13 }}>{ru ? 'Врач-косметолог · Батуми' : 'Medical cosmetologist · Batumi'}</div>
              </div>
              <span style={{ color: 'var(--tl)', fontSize: 18 }}>›</span>
            </div>
          </button>
        </div>
      </div>
    </div>
    <div className="bottom-cta">
      {course ? (
        <button className="btn btn-primary btn-block" data-bottom-cta data-testid="course-write" onClick={writeAboutCourse}>
          {ru ? 'Написать Анжелике' : 'Message Anjelika'} · {price}
        </button>
      ) : (
        <button className="btn btn-primary btn-block" data-bottom-cta onClick={() => onBook(s.id)}>
          {t('service.pickTime', lang)} · {price}
        </button>
      )}
    </div>
    </>
  );
}
