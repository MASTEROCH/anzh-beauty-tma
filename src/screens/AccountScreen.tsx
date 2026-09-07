import { useMemo } from 'react';
import { closeSheet, openSheet, toast } from '../lib/ui';
import { Icon } from '../components/Icon';
import { ReviewSheet } from '../components/ReviewSheet';
import { SettingsSheet } from '../components/SettingsSheet';
import { procs, pts, t } from '../lib/i18n';
import { clinic, clinicAddress, mapsUrl } from '../data/clinic';
import { findService, sShort, sTitle } from '../data/services';
import { addMinutes, fmtDateLong, fmtDateShort, fmtRelative, fromISODate } from '../lib/date';
import {
  TIERS,
  cancelBooking,
  markReviewed,
  money,
  nextBooking,
  nextTierFor,
  pastBookings,
  tierFor,
  useStore,
  type Booking,
  type Currency,
} from '../lib/store';
import { downloadIcs } from '../lib/ics';
import { haptic, openExternal } from '../lib/telegram';
import { asset } from '../lib/asset';

type Lang = 'ru' | 'en';

export function AccountScreen({
  onBook,
  onReschedule,
  lang,
  onLang,
  currency,
  onCurrency,
  points,
  onAwardPoints,
  userName,
}: {
  onBook: (serviceId?: string) => void;
  onReschedule: (bookingId: string, serviceId: string) => void;
  lang: Lang;
  onLang: (l: Lang) => void;
  currency: Currency;
  onCurrency: (c: Currency) => void;
  points: number;
  onAwardPoints: (p: number) => void;
  userName: string;
}) {
  const ru = lang === 'ru';
  const store = useStore();
  const upcoming = useMemo(() => nextBooking(store), [store]);
  const history = useMemo(() => pastBookings(store), [store]);
  const tier = tierFor(points);
  const next = nextTierFor(points);
  const progress = next
    ? Math.round(((points - tier.min) / (next.min - tier.min)) * 100)
    : 100;

  const openReview = (b?: Booking) =>
    openSheet({
      title: ru ? 'Оставить отзыв' : 'Leave a review',
      subtitle: ru ? 'Скидка на следующую процедуру' : 'A discount on your next treatment',
      body: (
        <ReviewSheet
          defaultServiceId={b?.serviceId}
          onAwardPoints={(p) => { onAwardPoints(p); if (b) markReviewed(b.id); }}
        />
      ),
    });

  const showSettings = () =>
    openSheet({
      title: (l) => t('settings.title', l),
      subtitle: 'ANZH Cosmetology',
      body: <SettingsSheet lang={lang} onLang={onLang} currency={currency} onCurrency={onCurrency} />,
    });

  const showLoyalty = () =>
    openSheet({
      title: 'Anjelika Club',
      subtitle: ru ? 'Программа лояльности' : 'Loyalty programme',
      body: (
        <>
          <div className="loyalty-card" style={{ margin: 0 }}>
            <div className="loyalty-tier">★ {tier.label} · {ru ? 'сейчас твой тир' : 'your current tier'}</div>
            <div className="loyalty-points">{points}<small> {pts(points, lang)}</small></div>
            <div className="loyalty-progress"><div className="loyalty-progress-fill" style={{ width: `${progress}%` }} /></div>
            <div className="loyalty-hint">
              {next
                ? ru ? `До ${next.label}-тира ещё ${next.min - points} ${pts(next.min - points, lang)}.` : `${next.min - points} points to ${next.label}.`
                : ru ? 'Максимальный тир — спасибо, что ты с нами.' : 'Top tier reached — thank you for being here.'}
            </div>
          </div>
          <div style={{ marginTop: 16 }}>
            <div className="eyebrow" style={{ marginBottom: 8 }}>{ru ? 'как зарабатывать' : 'how to earn'}</div>
            <ul className="info-list">
              <li>{ru ? `${tier.cashback}% от чека возвращается баллами` : `${tier.cashback}% of every bill back in points`}</li>
              <li>{ru ? 'Отзыв → −10% на следующую процедуру' : 'A review → −10% off your next treatment'}</li>
              <li>{ru ? 'День рождения → +500 баллов' : 'Birthday → +500 points'}</li>
              <li>{ru ? 'Приведи подругу → +1000 баллов обоим' : 'Refer a friend → +1000 points each'}</li>
            </ul>
          </div>
          <div style={{ marginTop: 16 }}>
            <div className="eyebrow" style={{ marginBottom: 8 }}>{ru ? 'тиры и привилегии' : 'tiers & perks'}</div>
            <div className="tier-list">
              {TIERS.map((tr) => (
                <div key={tr.id} className={`tier-row ${tr.id === tier.id ? 'active' : ''}`}>
                  <span className="tier-name">{tr.label}</span>
                  <span className="tier-req">{tr.min}+ {ru ? 'баллов' : 'pts'}</span>
                  <span className="tier-perk">{tr.cashback}% {ru ? 'кэшбэк' : 'cashback'}</span>
                  {tr.id === tier.id && <Icon name="check" size={14} strokeWidth={2.6} />}
                </div>
              ))}
            </div>
          </div>
        </>
      ),
      actions: (
        <button
          className="btn btn-primary btn-block"
          onClick={() => {
            navigator.clipboard?.writeText('https://anzh.tma/ref/masha');
            toast(ru ? 'Реферальная ссылка скопирована' : 'Referral link copied', 'success');
          }}
        >
          {ru ? 'Скопировать реферальную ссылку' : 'Copy referral link'}
        </button>
      ),
    });

  const showAppointment = (b: Booking) => {
    const svc = findService(b.serviceId);
    if (!svc) return;
    const deposit = money(Math.round(b.priceUsd * 0.1), Math.round(b.priceGel * 0.1), currency);
    const rest = money(b.priceUsd - Math.round(b.priceUsd * 0.1), b.priceGel - Math.round(b.priceGel * 0.1), currency);
    openSheet({
      title: sTitle(svc, lang),
      subtitle: `${fmtDateLong(b.date, lang)} · ${b.slot}`,
      body: (
        <>
          <ul className="info-list">
            <li>{sShort(svc, lang)}</li>
            <li>{ru ? 'Длительность' : 'Duration'} {svc.duration} {t('common.min', lang)} · {b.slot}–{addMinutes(b.slot, svc.duration)}</li>
            <li>{clinicAddress(lang)}</li>
            <li>{ru ? `Депозит ${deposit} удержан, к оплате на месте ${rest}` : `${deposit} deposit held, ${rest} due on site`}</li>
            <li>{ru ? `Начислено ${b.points} ${pts(b.points, lang)}` : `${b.points} points credited`}</li>
          </ul>
          <p className="muted" style={{ fontSize: 13, marginTop: 12 }}>
            {ru
              ? 'Подготовка: 24 часа без алкоголя и аспирина. За 2 часа я пришлю финальный пинг.'
              : 'Prep: no alcohol or aspirin for 24 hours. I’ll send a final ping 2 hours before.'}
          </p>
        </>
      ),
      actions: (
        <>
          <button
            className="btn btn-primary btn-block"
            onClick={() => { closeSheet(); onReschedule(b.id, b.serviceId); }}
          >
            {ru ? 'Перенести' : 'Reschedule'}
          </button>
          <button
            className="btn btn-ghost btn-block"
            onClick={() => {
              const ok = downloadIcs(b, lang);
              toast(
                ok ? (ru ? 'Календарь обновлён ✓' : 'Added to your calendar ✓')
                   : (ru ? 'Не удалось скачать .ics' : 'Could not download the .ics'),
                ok ? 'success' : 'info',
              );
            }}
          >
            <Icon name="calendar" size={16} strokeWidth={1.9} /> {ru ? 'В календарь' : 'Add to calendar'}
          </button>
          <button
            className="btn btn-ghost btn-block"
            onClick={() => { openExternal(mapsUrl); toast(ru ? 'Открываю маршрут' : 'Opening directions', 'success'); }}
          >
            {t('common.map', lang)}
          </button>
          <button
            className="btn btn-ghost btn-block"
            onClick={() => {
              const msg = ru
                ? 'Отменить запись? Депозит сгорит — до 24 часов до процедуры.'
                : 'Cancel this booking? The deposit is forfeited within 24 hours of the visit.';
              if (!confirm(msg)) return;
              cancelBooking(b.id);
              haptic.notify('warning');
              closeSheet();
              toast(ru ? 'Запись отменена' : 'Booking cancelled', 'success');
            }}
          >
            {ru ? 'Отменить запись' : 'Cancel booking'}
          </button>
        </>
      ),
    });
  };

  const showHistory = (b: Booking) => {
    const svc = findService(b.serviceId);
    if (!svc) return;
    openSheet({
      title: sTitle(svc, lang),
      subtitle: `${fmtDateLong(b.date, lang)} · ${ru ? 'оплачено' : 'paid'}`,
      body: (
        <>
          <div className="beforeafter">
            <div className="beforeafter-tile before" data-label={ru ? 'ДО' : 'BEFORE'} style={{ backgroundImage: `url(${asset(`photos/${svc.id}.jpg`)})` }} />
            <div className="beforeafter-tile after" data-label={ru ? 'ПОСЛЕ' : 'AFTER'} style={{ backgroundImage: `url(${asset(`photos/${svc.id}.jpg`)})` }} />
          </div>
          <ul className="info-list" style={{ marginTop: 14 }}>
            <li>{sShort(svc, lang)}</li>
            <li>{ru ? 'Сумма' : 'Total'}: {money(b.priceUsd, b.priceGel, currency)}</li>
            <li>{ru ? 'Начислено баллов' : 'Points earned'}: +{b.points}</li>
            <li>{ru ? 'Заметка мастера приватна' : 'The practitioner’s note stays private'}</li>
          </ul>
        </>
      ),
      actions: (
        <>
          <button
            className="btn btn-primary btn-block"
            onClick={() => {
              closeSheet();
              toast(ru ? 'Повторно записываю на эту процедуру…' : 'Booking this treatment again…');
              setTimeout(() => onBook(b.serviceId), 500);
            }}
          >
            {ru ? 'Записаться повторно' : 'Book again'}
          </button>
          <button
            className="btn btn-ghost btn-block"
            disabled={b.reviewed}
            onClick={() => openReview(b)}
          >
            {b.reviewed
              ? (ru ? 'Отзыв уже оставлен ✓' : 'Review already left ✓')
              : (ru ? 'Оставить отзыв · −10%' : 'Leave a review · −10%')}
          </button>
        </>
      ),
    });
  };

  const historyRow = (b: Booking) => {
    const svc = findService(b.serviceId);
    if (!svc) return null;
    return (
      <button key={b.id} className="history-row" onClick={() => showHistory(b)}>
        <div className="history-icon" style={{ backgroundImage: `url(${asset(`photos/${svc.id}.jpg`)})` }} />
        <div className="history-body">
          <div className="history-name">{sTitle(svc, lang)}</div>
          <div className="history-when">
            {fmtDateShort(b.date, lang)} {fromISODate(b.date).getFullYear()} · {ru ? 'оплачено' : 'paid'}
          </div>
        </div>
        <div className="history-amount">{money(b.priceUsd, b.priceGel, currency)}</div>
      </button>
    );
  };

  const showAllHistory = () =>
    openSheet({
      title: ru ? `История · ${history.length} ${procs(history.length, lang)}` : `History · ${history.length} treatments`,
      subtitle: ru ? 'Полная история визитов' : 'Every visit so far',
      body: (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          {history.map(historyRow)}
        </div>
      ),
    });

  const showHealth = () =>
    openSheet({
      title: ru ? 'Паспорт здоровья' : 'Health passport',
      subtitle: ru ? 'Анкета · видит только Анжелика' : 'Questionnaire · visible to Anjelika only',
      body: (
        <>
          <div className="col" style={{ gap: 12 }}>
            <div>
              <div className="eyebrow" style={{ marginBottom: 6 }}>{ru ? 'аллергии' : 'allergies'}</div>
              <div className="row" style={{ flexWrap: 'wrap', gap: 6 }}>
                <span className="chip chip-gold">{ru ? 'Без аллергий' : 'No allergies'}</span>
                <span className="chip chip-amber">⚠ {ru ? 'Лидокаин — слабая реакция' : 'Lidocaine — mild reaction'}</span>
              </div>
            </div>
            <div>
              <div className="eyebrow" style={{ marginBottom: 6 }}>{ru ? 'состояние' : 'condition'}</div>
              <div className="row" style={{ flexWrap: 'wrap', gap: 6 }}>
                <span className="chip">{ru ? 'Не беременна' : 'Not pregnant'}</span>
                <span className="chip">{ru ? 'Без хроник' : 'No chronic conditions'}</span>
                <span className="chip">{ru ? 'Не курит' : 'Non-smoker'}</span>
              </div>
            </div>
            <div>
              <div className="eyebrow" style={{ marginBottom: 6 }}>{ru ? 'кожа' : 'skin'}</div>
              <div className="row" style={{ flexWrap: 'wrap', gap: 6 }}>
                <span className="chip">{ru ? 'Тип II' : 'Type II'}</span>
                <span className="chip">{ru ? 'Без купероза' : 'No couperose'}</span>
                <span className="chip">{ru ? 'Чувствительность · средняя' : 'Sensitivity · medium'}</span>
              </div>
            </div>
          </div>
          <p className="muted" style={{ fontSize: 13, marginTop: 14 }}>
            {ru
              ? 'Анкета синхронизирована с записями. Перед каждой процедурой я проверяю противопоказания автоматически.'
              : 'The questionnaire syncs with your bookings — contraindications are checked automatically before every visit.'}
          </p>
        </>
      ),
      actions: (
        <button
          className="btn btn-primary btn-block"
          onClick={() => toast(ru ? 'Открываю полную форму редактирования…' : 'Opening the full edit form…')}
        >
          {ru ? 'Редактировать анкету' : 'Edit questionnaire'}
        </button>
      ),
    });

  const upcomingSvc = upcoming ? findService(upcoming.serviceId) : undefined;

  return (
    <div className="screen">
      <header className="header">
        <div className="header-lede">
          <div className="eyebrow">{t('account.title', lang)}</div>
          <div className="header-title">{userName}</div>
        </div>
        <button className="chip" onClick={showSettings} aria-label={t('settings.title', lang)}>
          <Icon name="settings" size={14} strokeWidth={1.8} /> {t('settings.title', lang)}
        </button>
      </header>

      <section className="account-hero">
        <h1 className="account-hello">
          {t('account.hello', lang)}, {userName}{' '}
          <Icon name="heart-filled" size={22} strokeWidth={0} style={{ color: 'var(--brand-gold)', verticalAlign: '-2px' }} />
        </h1>
        <div className="account-sub">
          {t('account.clientSince', lang)} 2024 · {history.length} {procs(history.length, lang)} · {tier.label}
        </div>
      </section>

      <button className="loyalty-card" onClick={showLoyalty}>
        <div className="loyalty-tier">★ {tier.label} · Anjelika Club</div>
        <div className="loyalty-points">{points}<small> {pts(points, lang)}</small></div>
        <div className="loyalty-progress"><div className="loyalty-progress-fill" style={{ width: `${progress}%` }} /></div>
        <div className="loyalty-hint">
          {next
            ? ru
              ? `До ${next.label}-тира ещё ${next.min - points} ${pts(next.min - points, lang)} · отзыв и сторис — скидки на процедуры.`
              : `${next.min - points} points to ${next.label} · reviews and Stories earn discounts.`
            : ru ? 'Максимальный тир · 15% кэшбэк и персональный визажист.' : 'Top tier · 15% cashback and a personal makeup artist.'}
        </div>
      </button>

      {upcoming && upcomingSvc ? (
        <button className="next-appt" onClick={() => showAppointment(upcoming)}>
          <div className="next-appt-day">
            <span className="d">{fromISODate(upcoming.date).getDate()}</span>
            <span className="m">{fmtDateShort(upcoming.date, lang).split(' ')[1].toUpperCase()}</span>
          </div>
          <div className="next-appt-body">
            <div className="t">{t('account.next', lang)} · {fmtRelative(upcoming.date, lang)}</div>
            <div className="what">{sTitle(upcomingSvc, lang)}</div>
            <div className="when">{fmtDateLong(upcoming.date, lang)} · {upcoming.slot} · {clinic.street}</div>
          </div>
          <div style={{ color: 'var(--tl)', fontSize: 18, paddingRight: 4 }}>›</div>
        </button>
      ) : (
        <button className="next-appt next-appt-empty" onClick={() => onBook()}>
          <div className="next-appt-day empty"><Icon name="calendar" size={22} strokeWidth={1.7} /></div>
          <div className="next-appt-body">
            <div className="t">{t('account.next', lang)}</div>
            <div className="what">{ru ? 'Пока ничего не запланировано' : 'Nothing planned yet'}</div>
            <div className="when">{ru ? 'Выбери время — я подстроюсь' : 'Pick a time — I’ll fit you in'}</div>
          </div>
          <div style={{ color: 'var(--tl)', fontSize: 18, paddingRight: 4 }}>›</div>
        </button>
      )}

      {history.length > 0 && (
        <section className="section">
          <div className="section-head">
            <div>
              <div className="eyebrow">{t('account.history', lang)}</div>
              <h2 className="section-title">{t('account.historyTitle', lang)}</h2>
            </div>
            <button className="section-link" onClick={showAllHistory} style={{ background: 'none', border: 0 }}>
              {t('account.allN', lang)} {history.length} →
            </button>
          </div>
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            {history.slice(0, 3).map(historyRow)}
          </div>
        </section>
      )}

      <section className="section" style={{ paddingTop: history.length > 0 ? 0 : 20 }}>
        <div className="section-head">
          <div>
            <div className="eyebrow">{t('account.passport', lang)}</div>
            <h2 className="section-title">{t('account.form', lang)}</h2>
          </div>
          <button className="section-link" onClick={showHealth} style={{ background: 'none', border: 0 }}>
            {ru ? 'правка' : 'edit'}
          </button>
        </div>
        <button onClick={showHealth} className="patient-card">
          <div className="patient-head">
            <div className="patient-avatar">{userName.slice(0, 1).toUpperCase()}</div>
            <div className="patient-id">
              <div className="patient-name">{userName}</div>
              <div className="patient-meta">ID ANZH-0342 · {ru ? 'клиент с 2024' : 'client since 2024'}</div>
            </div>
            <div className="patient-badge">Fitzpatrick II</div>
          </div>
          <div className="patient-vitals">
            <div className="pv"><span className="pv-label">{ru ? 'Тип кожи' : 'Skin type'}</span><span className="pv-val">{ru ? 'Комбинированная' : 'Combination'}</span></div>
            <div className="pv"><span className="pv-label">{ru ? 'Чувствит.' : 'Sensitivity'}</span><span className="pv-val">{ru ? 'Средняя' : 'Medium'}</span></div>
            <div className="pv"><span className="pv-label">{ru ? 'Купероз' : 'Couperose'}</span><span className="pv-val">{ru ? 'Нет' : 'No'}</span></div>
          </div>
          <div className="patient-flags">
            <span className="flag warn"><Icon name="warning" size={13} strokeWidth={2} /> {ru ? 'Лидокаин — слабая реакция' : 'Lidocaine — mild reaction'}</span>
            <span className="flag ok"><Icon name="check" size={13} strokeWidth={2.4} /> {ru ? 'Без аллергий' : 'No allergies'}</span>
            <span className="flag ok"><Icon name="check" size={13} strokeWidth={2.4} /> {ru ? 'Не беременна · без хроник' : 'Not pregnant · no chronic'}</span>
          </div>
          <div className="patient-foot">
            <Icon name="shield-check" size={14} strokeWidth={1.8} />
            {ru ? 'Анжелика проверяет флаги перед каждой записью' : 'Anjelika reviews these flags before every visit'}
          </div>
        </button>
      </section>

      <div style={{ padding: '0 20px 8px' }}>
        <button className="btn btn-primary btn-block" onClick={() => onBook()}>
          {t('account.rebook', lang)}
        </button>
      </div>
      <div style={{ padding: '0 20px 20px' }}>
        <button className="btn btn-ghost btn-block" onClick={() => openReview(history.find((b) => !b.reviewed))}>
          {ru ? 'Оставить отзыв · −10%' : 'Leave a review · −10%'}
        </button>
      </div>
    </div>
  );
}
