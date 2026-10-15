import { JourneyHero } from '../components/JourneyHero';
import { nextStep } from '../lib/journey';
import { useRewards } from '../lib/rewardsLive';
import { openWriteReview } from '../components/WriteReview';
import { Bookmarks } from '../components/Bookmarks';
import { openAddToCalendar } from '../components/AddToCalendar';
import { eventOfAppointment } from '../lib/ics';
import { useMemo } from 'react';
import { googleMapsUrl, studioAddress, telegramUrl } from '../data/location';
import { openExternal, openTelegram } from '../lib/telegram';
import { closeSheet, openSheet, toast } from '../lib/ui';
import { Icon } from '../components/Icon';
import { SettingsSheet } from '../components/SettingsSheet';
import { HealthPassportSheet } from '../components/HealthPassportSheet';
import { t, tr } from '../lib/i18n';
import { findService, sTitle, servicePhoto } from '../data/services';
import {
  apptDuration, apptPaidLabel, apptPriceLabel, apptServiceIds, apptTitle, cancelAppointment, formatLongDate, formatMonthShort,
  formatShort, formatWeekday, fromISODate, getDeclined, getPast, getUpcoming, loadMyBookings,
  STATUS_LABEL, useBookingSchedule, useMyBookings, type Appointment,
} from '../lib/appointments';
import { ApiError, useSession, type GuestReason } from '../lib/session';
import { useMe } from '../lib/api';
import { useHealthPassport, passportFlags, SENSITIVITY_LABEL } from '../lib/healthPassport';
import { useQuizResults } from '../lib/quizResults';
import { findQuiz } from '../data/quizzes';
import { QuizRunner } from '../components/QuizRunner';
import { SECONDARY_LABEL } from '../lib/quizScore';
import { g, useGender } from '../lib/gender';
import { NotificationSchedule } from './ConfirmScreen';
import type { ClientProfile } from '../App';

/* Время «моих записей» — в поясе САЛОНА из ответа GET /bookings: пояс
   ставит сам lib/appointments.ts (loadMyBookings), экрану подписка не нужна. */

type Lang = 'ru' | 'en';

/* ВТОРОЙ РЯД СКРЫТ (решение на ночь): баллы и уровни Anjelika Club, бонусы-
   промокоды, «отзыв · −5%», «+1000 баллов за подругу». Их механику сервер
   не исполняет — экран не обещает того, чего сервер не даст. Ссылка
   приглашения осталась: она настоящая и приходит готовой (Me.referral_link). */

const GUEST_BOOKINGS: Record<GuestReason, { ru: string; en: string }> = {
  outside_telegram: {
    ru: 'Твои записи видны в приложении внутри Telegram.',
    en: 'Your bookings are visible in the app inside Telegram.',
  },
  network: {
    ru: 'Нет связи с сервером — записи не загрузить. Проверь интернет.',
    en: 'Can’t reach the server — bookings can’t load. Check your connection.',
  },
  refused: {
    ru: 'Не удалось войти — перезапусти приложение из Telegram.',
    en: 'Sign-in failed — restart the app from Telegram.',
  },
  server: {
    ru: 'Сервер сейчас не отвечает — записи загрузятся позже.',
    en: 'The server isn’t responding — bookings will load later.',
  },
};

function cancelErrorText(e: unknown, ru: boolean): string {
  const code = e instanceof ApiError ? e.code : 'network';
  if (code === 'bad_transition' || code === 'forbidden') {
    return ru ? 'Эту запись уже нельзя отменить в приложении — напиши Анжелике.' : 'This booking can’t be cancelled in the app anymore — message Anjelika.';
  }
  if (code === 'stale') return ru ? 'Статус записи только что изменился — открой её заново.' : 'The status just changed — open the booking again.';
  if (code === 'not_found') return ru ? 'Запись не найдена — обнови список.' : 'Booking not found — refresh the list.';
  if (code === 'network' || code === 'timeout') {
    return ru ? 'Нет связи — запись не отменена. Попробуй ещё раз.' : 'No connection — the booking wasn’t cancelled. Try again.';
  }
  return ru ? 'Не получилось отменить — попробуй позже или напиши Анжелике.' : 'Couldn’t cancel — try later or message Anjelika.';
}

/** Уведомления вокруг визита — из GET /bookings/{id} (сервер — единственный автор). */
function AppointmentSchedule({ id, lang }: { id: string; lang: Lang }) {
  const view = useBookingSchedule(id);
  return <NotificationSchedule view={view} lang={lang} variant="timeline" />;
}

export function AccountScreen({
  onBook,
  onBookAgain,
  lang,
  onLang,
  points,
  onAwardPoints,
  client,
  onPlan,
  favorites,
  onToggleFavorite,
  onCatalog,
  onOpenProfile,
}: {
  onBook: () => void;
  /** Повторная запись на конкретную процедуру — из отклонённой заявки */
  onBookAgain: (serviceId: string) => void;
  lang: Lang;
  onLang: (l: Lang) => void;
  points: number;
  onAwardPoints: (p: number) => void;
  client: ClientProfile;
  onPlan: () => void;
  favorites: Set<string>;
  onToggleFavorite: (id: string) => void;
  onCatalog: () => void;
  onOpenProfile: () => void;
}) {
  const healthPassport = useHealthPassport();
  const rewards = useRewards();
  // Баллы скрыты (второй ряд); перенос — сообщением Анжелике (статуса
  // «перенос» на сервере нет).
  void points; void onAwardPoints;
  const ru = lang === 'ru';
  const bookings = useMyBookings();
  const session = useSession();
  const { me } = useMe();
  const passport = useHealthPassport();
  const gender = useGender();
  const quizResults = useQuizResults();
  const userName = client.name;
  /* Первая буква имени для монограммы. Вне Telegram имени нет — и пустая
     строка здесь рисовала пустой квадрат вместо лица. */
  const initial = userName.trim().slice(0, 1).toUpperCase();

  // Список — только мои записи с сервера (GET /bookings): поиск «своих» по
  // имени или инстаграму на телефоне показывал человеку чужую историю.
  const all = bookings.items;
  const upcoming = useMemo(() => getUpcoming(all), [all]);
  const history = useMemo(() => getPast(all).filter((a) => a.status === 'completed'), [all]);
  const declined = useMemo(() => getDeclined(all), [all]);

  const flags = passportFlags(passport, ru);
  const titleOf = (id: string) => {
    const s = findService(id);
    return s ? sTitle(s, lang) : undefined;
  };
  const referralLink = typeof me?.referral_link === 'string' ? me.referral_link : '';

  const showSettings = () =>
    openSheet({
      title: t('settings.title', lang),
      subtitle: 'ANZH Cosmetology',
      /* Входа в кабинет здесь нет (Роч 15.10): кабинет — отдельное
         приложение по адресу /studio (второй Mini App того же бота). */
      body: <SettingsSheet lang={lang} onLang={onLang} />,
    });


  /* Ссылка приглашения — ТОЛЬКО готовая строка сервера (Me.referral_link).
     Собирать её из telegram_id нельзя: это внутренний ключ человека, и
     атрибуция на сервере идёт по коду, а не по id. */
  const copyInvite = () => {
    if (!referralLink) return;
    const done = () => toast(ru ? 'Ссылка скопирована' : 'Link copied', 'success');
    const fail = () => toast(ru ? 'Не скопировалось — выдели ссылку вручную' : 'Couldn’t copy — select the link manually', 'info');
    try {
      const p = navigator.clipboard?.writeText(referralLink);
      if (p) p.then(done, fail);
      else fail();
    } catch {
      fail();
    }
  };
  const shareInvite = () => {
    if (!referralLink) return;
    const text = ru ? 'Записываюсь к Анжелике в ANZH Cosmetology — вот приложение:' : 'I book with Anjelika at ANZH Cosmetology — here’s the app:';
    openTelegram(`https://t.me/share/url?url=${encodeURIComponent(referralLink)}&text=${encodeURIComponent(text)}`);
  };

  const cancel = async (a: Appointment) => {
    if (!confirm(ru ? 'Отменить запись?' : 'Cancel this booking?')) return;
    try {
      await cancelAppointment(a.id);
      closeSheet();
      toast(ru ? 'Запись отменена' : 'Booking cancelled', 'success');
    } catch (e) {
      toast(cancelErrorText(e, ru), 'info');
    }
  };

  const showAppointment = (a: Appointment) => {
    const svc = findService(a.serviceId);
    const st = STATUS_LABEL[a.status];
    const canCancel = a.status === 'pending' || a.status === 'confirmed';
    // Visit total in its own currency (K5); nothing honest to show — no line
    const priceLabel = apptPriceLabel(a, lang);
    openSheet({
      title: apptTitle(a, lang, titleOf) || a.serviceId,
      subtitle: `${formatLongDate(fromISODate(a.dateISO), lang)} · ${a.slot}`,
      body: (
        <>
          <div className={`appt-status ${st.tone}`}>
            <Icon name={a.status === 'confirmed' ? 'check' : a.status === 'pending' ? 'clock' : 'info'} size={15} strokeWidth={2.2} />
            {st[lang]}
          </div>

          <ul className="info-list mt">
            {svc?.short && apptServiceIds(a).length === 1 && <li>{svc.short}</li>}
            <li>{ru ? 'Длительность' : 'Duration'} {apptDuration(a)} {ru ? 'мин' : 'min'}</li>
            <li>{studioAddress(lang)}</li>
            {priceLabel !== null && <li data-testid="appt-price">{ru ? 'По прайсу' : 'Price list total'}: {priceLabel}</li>}
          </ul>
          {a.comment && <p className="muted" style={{ fontSize: 13, marginTop: 10 }}>{ru ? 'Твой комментарий' : 'Your comment'}: «{a.comment}»</p>}

          <div className="eyebrow sub-head">{ru ? 'что пришлёт бот' : 'what the bot will send'}</div>
          <AppointmentSchedule id={a.id} lang={lang} />
        </>
      ),
      actions: (
        <>
          {canCancel && (
            <button className="btn btn-primary btn-block" onClick={() => {
              const e = eventOfAppointment(a, lang);
              openAddToCalendar(e ? [e] : [], lang, `anzh-${a.dateISO}.ics`);
            }}>
              <Icon name="calendar" size={16} strokeWidth={1.9} /> {ru ? 'В календарь' : 'Add to calendar'}
            </button>
          )}
          <button
            className="btn btn-secondary btn-block"
            onClick={() => openTelegram(telegramUrl())}
          >
            {ru ? 'Перенести — написать Анжелике' : 'Reschedule — message Anjelika'}
          </button>
          <button
            className="btn btn-secondary btn-block"
            onClick={() => {
              openExternal(googleMapsUrl());
              toast(ru ? 'Открываю маршрут' : 'Opening directions', 'success');
            }}
          >
            {ru ? 'Маршрут в Maps' : 'Directions in Maps'}
          </button>
          {canCancel && (
            <button className="btn btn-secondary btn-block" data-testid="cancel-booking" onClick={() => { void cancel(a); }}>
              {ru ? 'Отменить запись' : 'Cancel booking'}
            </button>
          )}
        </>
      ),
    });
  };

  const showHistory = (a: Appointment) => {
    const svc = findService(a.serviceId);
    const photo = servicePhoto(a.serviceId);
    const paid = typeof a.amount === 'number';
    const amountLabel = paid ? apptPaidLabel(a, lang) : apptPriceLabel(a, lang);
    openSheet({
      title: apptTitle(a, lang, titleOf) || a.serviceId,
      subtitle: `${formatShort(a.dateISO, lang)} · ${paid ? (ru ? 'оплачено' : 'paid') : (ru ? 'визит завершён' : 'visit completed')}`,
      body: (
        <>
          {photo && (
            <img
              src={photo}
              alt=""
              style={{ width: '100%', height: 200, objectFit: 'cover', borderRadius: 14, display: 'block' }}
            />
          )}
          <ul className="info-list mt">
            {svc?.short && <li>{svc.short}</li>}
            {amountLabel !== null && (
              <li>
                {paid ? (ru ? 'Оплачено' : 'Paid') : (ru ? 'По прайсу' : 'Price list total')}: {amountLabel}
              </li>
            )}
            <li>{ru ? 'Заметка мастера приватна' : 'The master’s note is private'}</li>
          </ul>
        </>
      ),
      actions: (
        <button className="btn btn-primary btn-block" onClick={() => { closeSheet(); onBookAgain(a.serviceId); }}>
          {ru ? 'Записаться повторно' : 'Book again'}
        </button>
      ),
    });
  };

  const showHealth = () =>
    openSheet({
      title: 'Паспорт здоровья',
      subtitle: 'Анкета · видит только Анжелика',
      body: <HealthPassportSheet onBook={() => onBook()} />,
    });

  const guestReason: GuestReason | null = session.status === 'guest' ? session.reason ?? 'outside_telegram' : null;
  const firstLoad = bookings.status === 'loading' && bookings.loadedAt === null && all.length === 0;

  return (
    <div className="screen">
      <header className="header">
        <div className="header-lede">
          <div className="eyebrow">{t('account.title', lang)}</div>
          <div className="header-title">{userName}</div>
        </div>
        <button className="chip" onClick={showSettings} aria-label={tr('Настройки', 'Settings')}>
          <Icon name="settings" size={14} strokeWidth={1.8} /> {t('settings.title', lang)}
        </button>
      </header>

      {/* Проводник вместо «Привет ♥»: где человек на пути и что дальше — одной кнопкой */}
      <JourneyHero
        name={userName}
        lang={lang}
        step={nextStep({
          guest: session.status === 'guest',
          upcoming,
          historyCount: history.length,
          lastDone: history[0],
          profileDone: !!healthPassport.quizAt,
          reviewDone: rewards?.actions.review === 'done',
          favorites: [...favorites],
        })}
        act={{
          onProfile: onOpenProfile,
          onBook: (slug) => (slug ? onBookAgain(slug) : onBook()),
          onOpenVisit: showAppointment,
          onCalendar: (ap) => { const e = eventOfAppointment(ap, lang); openAddToCalendar(e ? [e] : [], lang, `anzh-${ap.dateISO}.ics`); },
          onReview: () => openWriteReview(lang, history[0]?.serviceId),
          onPlan,
          onCatalog,
        }}
      />
      {history.length > 0 && (
        <div className="account-sub" style={{ textAlign: 'center', marginBottom: 6 }}>
          {history.length} {t('account.procs', lang)}
        </div>
      )}

      {referralLink && (
        <section className="section section-flush" data-testid="invite">
          <div className="card" style={{ padding: 16 }}>
            <div className="eyebrow mb-sm">{ru ? 'пригласить подругу' : 'invite a friend'}</div>
            <p className="muted" style={{ fontSize: 13, lineHeight: 1.5 }}>
              {ru ? 'Твоя личная ссылка на приложение ANZH.' : 'Your personal link to the ANZH app.'}
              {typeof me?.invited_count === 'number' && me.invited_count > 0 && (
                <> {ru ? `По ней пришли: ${me.invited_count}.` : `Joined via it: ${me.invited_count}.`}</>
              )}
            </p>
            <div className="faint" data-testid="invite-link" style={{ fontSize: 12, wordBreak: 'break-all', marginTop: 6, userSelect: 'all' }}>
              {referralLink}
            </div>
            <div className="row" style={{ gap: 10, marginTop: 12 }}>
              <button className="btn btn-secondary row-fill" data-testid="invite-copy" onClick={copyInvite}>
                {ru ? 'Скопировать' : 'Copy'}
              </button>
              <button className="btn btn-primary row-fill" data-testid="invite-share" onClick={shareInvite}>
                {ru ? 'Поделиться' : 'Share'}
              </button>
            </div>
          </div>
        </section>
      )}

      {/* Ответ мастера на отклонённую заявку. Без этого блока отказ
          просто исчезал: человек ждал ответа, которого не будет. */}
      {declined.length > 0 && (
        <section className="section section-flush">
          <div className="eyebrow mb-sm">
            {ru ? 'ответ на заявку' : 'reply to your request'}
          </div>
          <div className="col" style={{ gap: 10 }}>
            {declined.map((a) => (
              <div key={a.id} className="declined-card">
                <div className="declined-head">
                  <Icon name="info" size={15} strokeWidth={2.2} />
                  {ru ? 'Это время не получилось' : 'This time did not work out'}
                </div>
                <div className="declined-what">
                  {apptTitle(a, lang, titleOf) || a.serviceId} · {formatShort(a.dateISO, lang)} · {a.slot}
                </div>
                {a.declineReason && (
                  <p className="declined-why">«{a.declineReason}»</p>
                )}
                <button
                  className="btn btn-primary btn-block mt"
                  onClick={() => onBookAgain(a.serviceId)}
                >
                  {ru ? 'Выбрать другое время' : 'Pick another time'}
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="section section-flush" data-testid="my-bookings">
        {bookings.status === 'error' && !guestReason && (
          <div className="card" role="alert" data-testid="bookings-error" style={{ padding: 16, textAlign: 'center', marginBottom: upcoming.length ? 10 : 0 }}>
            <div className="muted">
              {all.length
                ? (ru ? 'Не удалось обновить записи — показан последний загруженный список.' : 'Couldn’t refresh — showing the last loaded list.')
                : bookings.error?.isNetwork
                  ? (ru ? 'Не удалось загрузить записи. Это сбой связи, а не пустой список.' : 'Couldn’t load your bookings. This is a connection failure, not an empty list.')
                  : (ru ? 'Сервер не отдал записи. Это сбой, а не пустой список.' : 'The server didn’t return your bookings. This is a failure, not an empty list.')}
            </div>
            <button className="btn btn-secondary btn-sm mt" onClick={() => { void loadMyBookings(); }}>
              {ru ? 'Повторить' : 'Retry'}
            </button>
          </div>
        )}
        {guestReason ? (
          <div className="card" style={{ padding: 20, textAlign: 'center' }} data-testid="bookings-guest">
            <div className="muted">{GUEST_BOOKINGS[guestReason][lang]}</div>
          </div>
        ) : firstLoad ? (
          <div className="card" style={{ padding: 20, textAlign: 'center' }} data-testid="bookings-loading">
            <div className="muted">{ru ? 'Загружаю записи…' : 'Loading bookings…'}</div>
          </div>
        ) : upcoming.length > 0 ? (
          <>
            <div className="row row-between mb-sm" style={{ alignItems: 'center' }}>
              <div className="eyebrow">
                {upcoming.length > 1 ? `${ru ? 'записи' : 'bookings'} · ${upcoming.length}` : t('account.next', lang)}
              </div>
              {/* Все будущие визиты — одним файлом, одной командой */}
              <button className="section-link" onClick={() => {
                const evs = upcoming.map((x) => eventOfAppointment(x, lang)).filter((x): x is NonNullable<typeof x> => !!x);
                openAddToCalendar(evs, lang, 'anzh-visits.ics');
              }}>
                <Icon name="calendar" size={13} strokeWidth={2} /> {upcoming.length > 1 ? (ru ? 'все в календарь' : 'all to calendar') : (ru ? 'в календарь' : 'to calendar')}
              </button>
            </div>
            <div className="col" style={{ gap: 10 }}>
              {upcoming.map((a) => {
                const st = STATUS_LABEL[a.status];
                const d = fromISODate(a.dateISO);
                return (
                  <button key={a.id} className={`next-appt status-${st.tone}`} data-testid="upcoming" onClick={() => showAppointment(a)}>
                    <div className="next-appt-day">
                      <span className="d">{d.getDate()}</span>
                      <span className="m">{formatMonthShort(d, lang)}</span>
                    </div>
                    <div className="next-appt-body">
                      <div className="t">{st[lang]}</div>
                      <div className="what">{apptTitle(a, lang, titleOf) || a.serviceId}</div>
                      <div className="when">{formatWeekday(d, lang)} · {a.slot} · Parnavaz Mepe 92/94</div>
                    </div>
                    <div style={{ color: 'var(--tl)', fontSize: 18, paddingRight: 4 }}>›</div>
                  </button>
                );
              })}
            </div>
          </>
        ) : bookings.status === 'ready' ? (
          <div className="card" style={{ padding: 20, textAlign: 'center' }} data-testid="bookings-empty">
            <div className="muted">{ru ? 'Предстоящих записей нет' : 'No upcoming bookings'}</div>
            <button className="btn btn-primary btn-sm mt" onClick={onBook}>
              {ru ? 'Выбрать время' : 'Pick a time'}
            </button>
          </div>
        ) : null}
      </section>

      <Bookmarks favorites={favorites} lang={lang} onBook={onBookAgain} onToggle={onToggleFavorite} onPlan={onPlan} onCatalog={onCatalog} />

      <section className="section">
        <button className="plan-cta" onClick={onPlan}>
          <div className="plan-cta-icon"><Icon name="sparkles" size={20} strokeWidth={1.8} /></div>
          <div className="plan-cta-text">
            <div className="plan-cta-title">{ru ? 'План процедур' : 'Treatment plan'}</div>
            <div className="plan-cta-sub">{ru ? 'Соберу курс из избранного — с порядком, интервалами и сроком' : 'I’ll build a course from your favourites — order, intervals, timeline'}</div>
          </div>
          <Icon name="chevron-right" size={20} strokeWidth={2} className="review-cta-arrow" />
        </button>
      </section>

      {history.length === 0 && bookings.status === 'ready' && (
        <section className="section section-tight">
          <div className="card empty-state">
            <div className="empty-icon"><Icon name="clock" size={26} strokeWidth={1.7} /></div>
            <div className="empty-title">{ru ? 'История пока пустая' : 'No history yet'}</div>
            <div className="empty-sub">
              {ru
                ? 'Здесь появятся прошедшие визиты — после того, как мастер закроет запись.'
                : 'Past visits appear here once the master closes the booking.'}
            </div>
          </div>
        </section>
      )}

      {history.length > 0 && (
        <section className="section section-tight">
          <div className="section-head">
            <div>
              <div className="eyebrow">{t('account.history', lang)}</div>
              <h2 className="section-title">{t('account.historyTitle', lang)}</h2>
            </div>
            <span className="faint" style={{ fontSize: 13 }}>{history.length}</span>
          </div>
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            {history.map((a, i) => {
              const svc = findService(a.serviceId);
              const photo = servicePhoto(a.serviceId);
              const paid = typeof a.amount === 'number';
              return (
                <button key={a.id} className="history-row reveal" style={{ animationDelay: `${Math.min(i, 8) * 45}ms` }} onClick={() => showHistory(a)}>
                  <div className={`history-icon${photo ? '' : ' history-icon--blank'}`} style={photo ? { backgroundImage: `url(${photo})` } : undefined}>{!photo && <Icon name={svc?.icon ?? 'sparkles'} size={17} strokeWidth={1.8} />}</div>
                  <div className="history-body">
                    <div className="history-name">{apptTitle(a, lang, titleOf) || a.serviceId}</div>
                    <div className="history-when">{formatShort(a.dateISO, lang)} · {paid ? (ru ? 'оплачено' : 'paid') : (ru ? 'по прайсу' : 'list price')}</div>
                  </div>
                  <div className="history-amount">{(paid ? apptPaidLabel(a, lang) : apptPriceLabel(a, lang)) ?? '—'}</div>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {quizResults.length > 0 && (
        <section className="section section-tight">
          <div className="section-head">
            <div>
              <div className="eyebrow">{ru ? 'разборы кожи' : 'skin analyses'}</div>
              <h2 className="section-title">{ru ? 'Что известно о коже' : 'What we know'}</h2>
            </div>
            <span className="faint" style={{ fontSize: 13 }}>{quizResults.length}</span>
          </div>
          <div className="col" style={{ gap: 8 }}>
            {quizResults.map((r, i) => {
              const quiz = findQuiz(r.quizId);
              return (
                <button
                  key={r.quizId}
                  className="result-row reveal"
                  style={{ animationDelay: `${i * 45}ms` }}
                  onClick={() => openSheet({
                    title: r.quizTitle,
                    subtitle: `${ru ? 'пройден' : 'taken'} ${new Date(r.takenAt).toLocaleDateString(ru ? 'ru-RU' : 'en-US', { day: 'numeric', month: 'long' })}`,
                    /* Оговорка «не диагноз» — внутри QuizRunner, над итогом
                       (Законник, result.disclaimer): второй раз под ним не нужна. */
                    body: quiz
                      ? <QuizRunner quiz={quiz} onBook={(id) => { onBook(); void id; }} />
                      : <p className="muted">{r.title}</p>,
                  })}
                >
                  <div className="result-row-icon"><Icon name={quiz?.icon ?? 'sparkles'} size={17} strokeWidth={1.8} /></div>
                  <div className="result-row-body">
                    <div className="result-row-title">{r.title}</div>
                    <div className="result-row-sub">{r.quizTitle} · {r.sub}</div>
                    {r.secondary && r.secondary.length > 0 && (
                      <div className="row" style={{ flexWrap: 'wrap', gap: 4, marginTop: 6 }}>
                        {r.secondary.map((sc) => (
                          <span key={sc} className="result-tag">{SECONDARY_LABEL[sc]?.[lang] ?? sc}</span>
                        ))}
                      </div>
                    )}
                  </div>
                  <Icon name="chevron-right" size={18} strokeWidth={2} style={{ color: 'var(--text-hint)', flexShrink: 0 }} />
                </button>
              );
            })}
          </div>
          <p className="faint" style={{ fontSize: 12, marginTop: 8 }}>
            {/* Разборы на сервер этой ночью не уходят (второй ряд) — мастер их
                не видит. Прежняя строка «Анжелика видит эти разборы до визита»
                обещала то, чего нет. */}
            {ru
              ? 'Разборы сохранены на этом устройстве — Анжелика их не видит. Покажи их на приёме.'
              : 'Analyses are saved on this device — Anjelika doesn’t see them. Show them at the visit.'}
          </p>
        </section>
      )}

      <section className="section section-tight">
        <div className="section-head">
          <div>
            <div className="eyebrow">{t('account.passport', lang)}</div>
            <h2 className="section-title">{t('account.form', lang)}</h2>
          </div>
          <button className="section-link" onClick={showHealth} style={{ background: 'none', border: 0 }}>
            {ru ? 'правка' : 'edit'}
          </button>
        </div>
        {/* Первая буква имени; вне Telegram её нет — тогда значок */}
        <button onClick={showHealth} className="patient-card">
          {/* 🚨 Монограмма и имя берутся у человека, а вне Telegram человека нет:
              карточка показывала пустой зелёный квадрат и пустоту справа от него —
              подложку без единого слова. Безымянная анкета остаётся анкетой, и
              говорить она должна то же: что это и зачем её заполнять. */}
          <div className="patient-head">
            <div className="patient-avatar">
              {initial || <Icon name="user" size={22} strokeWidth={1.9} />}
            </div>
            <div className="patient-id">
              <div className="patient-name">{userName.trim() || (ru ? 'Паспорт кожи' : 'Skin passport')}</div>
              <div className="patient-meta">
                {client.instagram
                  ? `@${client.instagram}`
                  : passport.updatedAt
                    ? (ru ? 'анкета заполнена' : 'questionnaire filled in')
                    : (ru ? 'две минуты — и Анжелика видит её до записи' : 'two minutes — and Anjelika sees it before the visit')}
              </div>
            </div>
            {passport.fitzpatrick && <div className="patient-badge">Fitzpatrick {passport.fitzpatrick}</div>}
          </div>
          <div className="patient-vitals">
            <div className="pv"><span className="pv-label">{ru ? 'Тип кожи' : 'Skin type'}</span><span className="pv-val">{passport.skinType || (ru ? 'Не указан' : 'Not set')}</span></div>
            <div className="pv"><span className="pv-label">{ru ? 'Чувствит.' : 'Sensitivity'}</span><span className="pv-val">{(SENSITIVITY_LABEL[passport.sensitivity] ?? SENSITIVITY_LABEL[''])[lang]}</span></div>
            <div className="pv"><span className="pv-label">{ru ? 'Купероз' : 'Couperose'}</span><span className="pv-val">{passport.couperose ? (ru ? 'Есть' : 'Yes') : (ru ? 'Нет' : 'No')}</span></div>
          </div>
          <div className="patient-flags">
            {flags.slice(0, 4).map((f) => (
              <span key={f.text} className={`flag ${f.kind}`}>
                <Icon name={f.kind === 'warn' ? 'warning' : 'check'} size={13} strokeWidth={2.2} /> {f.text}
              </span>
            ))}
          </div>
          <div className="patient-foot">
            <Icon name="shield-check" size={14} strokeWidth={1.8} />
            {passport.updatedAt
              ? `${ru ? 'Обновлено' : 'Updated'} ${new Date(passport.updatedAt).toLocaleDateString(ru ? 'ru-RU' : 'en-US')} · ${ru ? 'Анжелика смотрит анкету перед процедурой' : 'Anjelika reviews it before the procedure'}`
              : (ru ? 'Анжелика смотрит анкету перед процедурой' : 'Anjelika reviews the questionnaire before the procedure')}
          </div>
        </button>
      </section>

      <div style={{ padding: '0 20px 20px' }}>
        <button className="btn btn-primary btn-block" onClick={onBook}>
          {t('account.rebook', lang)}
        </button>
      </div>

      <p className="faint" style={{ fontSize: 12, textAlign: 'center', padding: '0 20px 20px' }}>
        {ru
          ? `${g('Записалась', 'Записался', gender)} и передумал${g('а', '', gender)}? Перенос бесплатный в любой момент`
          : 'Changed your mind? Rescheduling is free, any time'} 💛
      </p>
    </div>
  );
}
