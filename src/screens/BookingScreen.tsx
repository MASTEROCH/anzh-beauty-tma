import { useEffect, useMemo, useState } from 'react';
import { findService, services, sTitle, sShort } from '../data/services';
import { openSheet, toast } from '../lib/ui';
import { Icon } from '../components/Icon';
import { useLang, t } from '../lib/i18n';
import { clinic } from '../data/clinic';
import { DAYS_SHORT, MON_SHORT, addMinutes, daysFromNow, fmtDateShort, toISODate } from '../lib/date';
import {
  SLOTS,
  createBooking,
  freeSlots as freeSlotsFor,
  money,
  pointsFor,
  rescheduleBooking,
  slotTaken,
  useStore,
  type Currency,
} from '../lib/store';
import { haptic } from '../lib/telegram';
import { asset } from '../lib/asset';


export function BookingScreen({
  initialServiceId,
  rescheduleId,
  onConfirm,
  onChooseService,
  currency,
}: {
  initialServiceId?: string;
  /** When set, the flow moves this booking instead of creating a new one. */
  rescheduleId?: string;
  onConfirm: () => void;
  onChooseService: () => void;
  currency: Currency;
}) {
  const lang = useLang();
  const ru = lang === 'ru';
  const store = useStore();
  const DAYS = DAYS_SHORT[lang];
  const MON = MON_SHORT[lang];
  const dates = useMemo(() => Array.from({ length: 14 }, (_, i) => daysFromNow(i)), []);
  const [serviceId, setServiceId] = useState<string>(initialServiceId ?? services[0].id);
  const [dateIdx, setDateIdx] = useState(1);
  const [slot, setSlot] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const service = findService(serviceId)!;
  const date = dates[dateIdx];
  const dateISO = toISODate(date);
  const price = money(service.priceUsd, service.priceGel, currency);
  const deposit = money(
    Math.round(service.priceUsd * 0.1),
    Math.round(service.priceGel * 0.1),
    currency,
  );
  const earns = pointsFor(service.priceUsd, store.points);
  // store.bookings matters: a slot the user just booked becomes taken
  const freeSlots = useMemo(() => freeSlotsFor(dateISO, store), [dateISO, store]);

  // Pre-select the first free slot whenever the day changes.
  useEffect(() => {
    setSlot((prev) => (prev && freeSlots.includes(prev) ? prev : freeSlots[0] ?? null));
  }, [freeSlots]);

  const showMaster = () =>
    openSheet({
      title: 'Анжелика',
      subtitle: ru ? 'Косметолог · 8 лет практики' : 'Cosmetologist · 8 years of practice',
      body: (
        <>
          <img
            src={asset("photos/anjelika.jpg")}
            alt=""
            style={{ width: 96, height: 96, borderRadius: '50%', objectFit: 'cover', margin: '0 auto 14px', display: 'block', border: '2px solid var(--border-strong)' }}
          />
          <ul className="info-list">
            <li>{ru ? `Принимает ${clinic.hours.ru}` : `Available ${clinic.hours.en}`}</li>
            <li>{ru ? 'Выходной — воскресенье' : 'Closed on Sundays'}</li>
            <li>{ru ? '1 472 завершённые процедуры' : '1,472 completed treatments'}</li>
            <li>{ru ? '★ 4.9 · 312 отзывов' : '★ 4.9 · 312 reviews'}</li>
          </ul>
        </>
      ),
    });

  const onDisabledSlot = (taken: string) => {
    haptic.notify('warning');
    const near = freeSlots.reduce<string | null>((best, cand) => {
      if (!best) return cand;
      const d = (x: string) => Math.abs(Number(x.replace(':', '')) - Number(taken.replace(':', '')));
      return d(cand) < d(best) ? cand : best;
    }, null);
    if (near) {
      setSlot(near);
      toast(ru ? `${taken} занят — поставила ${near}` : `${taken} is taken — moved you to ${near}`);
    } else {
      toast(ru ? `${taken} занят, и день забит — выбери другой` : `${taken} is taken and the day is full`);
    }
  };

  const submit = () => {
    if (!slot) {
      toast(ru ? 'Выбери время' : 'Pick a time');
      return;
    }
    setSubmitting(true);
    setTimeout(() => {
      if (rescheduleId) rescheduleBooking(rescheduleId, dateISO, slot);
      else createBooking(serviceId, dateISO, slot);
      haptic.notify('success');
      setSubmitting(false);
      onConfirm();
    }, 700);
  };

  return (
    <>
    <div className="screen has-cta">
      <header className="header">
        <div className="header-lede">
          <div className="eyebrow">{rescheduleId ? (ru ? 'перенос' : 'reschedule') : t('booking.eyebrow', lang)}</div>
          <div className="header-title">{t('booking.title', lang)}</div>
        </div>
        <button className="chip chip-gold" onClick={showMaster} aria-label={ru ? 'О мастере' : 'About the expert'}>
          <Icon name="lotus" size={13} strokeWidth={1.8} /> {t('common.master', lang)}
        </button>
      </header>

      <div className="booking-stepper">
        <button
          className="step done"
          onClick={onChooseService}
          style={{ background: 'none', border: 0, padding: 0, color: 'inherit', cursor: 'pointer' }}
        >
          <span className="step-dot"><Icon name="check" size={11} strokeWidth={2.6} /></span>
          <span>{t('booking.step.service', lang)}</span>
        </button>
        <div className="sep" />
        <div className="step active">
          <span className="step-dot">2</span>
          <span>{t('booking.step.date', lang)}</span>
        </div>
        <div className="sep" />
        <div className="step">
          <span className="step-dot">3</span>
          <span>{t('booking.step.confirm', lang)}</span>
        </div>
      </div>

      <section style={{ padding: '14px 20px 0' }}>
        <div className="eyebrow" style={{ marginBottom: 8 }}>{t('booking.chosen', lang)}</div>
        <button
          onClick={onChooseService}
          className="card service-card"
          style={{ marginBottom: 4, width: '100%', cursor: 'pointer', textAlign: 'left' }}
        >
          <div className="service-image" style={{ backgroundImage: `url(${asset(`photos/${service.id}.jpg`)})` }}>
            <span className="service-image-badge"><Icon name={service.icon} size={16} strokeWidth={1.9} /></span>
          </div>
          <div className="service-body">
            <h3 className="service-title">{sTitle(service, lang)}</h3>
            <p className="service-desc">{sShort(service, lang)}</p>
            <div className="service-meta">
              <span className="service-price">{price}</span>
              <span className="faint" style={{ fontSize: 12 }}>· {service.duration} {t('common.min', lang)}</span>
            </div>
          </div>
          <span style={{ position: 'absolute', top: '50%', right: 14, transform: 'translateY(-50%)', color: 'var(--tl)', fontSize: 18 }}>›</span>
        </button>
        <div className="trust-row marquee chip-marquee" style={{ marginTop: 8 }} aria-label="Услуги">
          <div className="marquee-track">
            {[0, 1].map((dup) => (
              <div className="marquee-group" key={dup} aria-hidden={dup === 1 ? true : undefined}>
                {services.map((s) => {
                  const title = sTitle(s, lang);
                  return (
                    <button
                      key={s.id}
                      className={`chip ${serviceId === s.id ? 'active' : ''}`}
                      onClick={() => setServiceId(s.id)}
                      tabIndex={dup === 1 ? -1 : undefined}
                    >
                      <Icon name={s.icon} size={14} strokeWidth={1.8} />
                      <span>{title.length > 18 ? title.slice(0, 16) + '…' : title}</span>
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section>
        <div className="eyebrow" style={{ padding: '18px 20px 0' }}>{t('booking.pickDay', lang)}</div>
        <div className="date-strip">
          {dates.map((d, i) => (
            <button
              key={i}
              className={`date-pill ${dateIdx === i ? 'active' : ''}`}
              onClick={() => {
                setDateIdx(i);
                setSlot(null);
              }}
            >
              <div className="dow">{DAYS[d.getDay()]}</div>
              <div className="day">{d.getDate()}</div>
              <div className="mon">{MON[d.getMonth()]}</div>
            </button>
          ))}
        </div>
      </section>

      <section>
        <div className="eyebrow" style={{ padding: '6px 20px 8px' }}>{t('booking.freeTime', lang)}</div>
        <div className="slot-grid">
          {SLOTS.map((s) => {
            const disabled = slotTaken(dateISO, s, store);
            return (
              <button
                key={s}
                className={`slot ${slot === s ? 'active' : ''} ${disabled ? 'disabled' : ''}`}
                onClick={() => (disabled ? onDisabledSlot(s) : setSlot(s))}
                aria-pressed={slot === s}
              >
                {s}
              </button>
            );
          })}
        </div>
        <div className="faint" style={{ fontSize: 12, padding: '10px 20px 0' }}>
          {t('booking.slotsNote', lang)}
        </div>
      </section>

      <section className="booking-summary">
        <div className="eyebrow" style={{ marginBottom: 10 }}>{t('booking.details', lang)}</div>
        <div className="summary-row">
          <span className="k">{t('booking.sum.service', lang)}</span>
          <span className="v">{sTitle(service, lang)}</span>
        </div>
        <div className="summary-row">
          <span className="k">{t('booking.sum.duration', lang)}</span>
          <span className="v">{service.duration} {t('common.min', lang)}</span>
        </div>
        <div className="summary-row">
          <span className="k">{t('booking.sum.date', lang)}</span>
          <span className="v">{fmtDateShort(dateISO, lang)} · {DAYS[date.getDay()]}</span>
        </div>
        <div className="summary-row">
          <span className="k">{t('booking.sum.time', lang)}</span>
          <span className="v">{slot ? `${slot}–${addMinutes(slot, service.duration)}` : '—'}</span>
        </div>
        <div className="summary-row">
          <span className="k">{t('booking.sum.address', lang)}</span>
          <span className="v" style={{ textAlign: 'right', fontSize: 13 }}>
            {clinic.street} · {ru ? '3 эт.' : 'fl. 3'}
          </span>
        </div>
        <div className="summary-row">
          <span className="k">{ru ? 'Баллов за визит' : 'Points earned'}</span>
          <span className="v" style={{ color: 'var(--brand-gold)' }}>+{earns}</span>
        </div>
        <div className="summary-row total">
          <span className="k">{t('booking.sum.total', lang)}</span>
          <span className="v">{price}</span>
        </div>
      </section>

      <button
        onClick={() =>
          openSheet({
            title: ru ? 'Депозит и отмена' : 'Deposit & cancellation',
            subtitle: ru ? 'Прозрачная политика' : 'A transparent policy',
            body: (
              <ul className="info-list">
                <li>{ru ? `Депозит ${deposit} удерживается при подтверждении` : `A ${deposit} deposit is held on confirmation`}</li>
                <li>{ru ? 'Возврат 100% — если отменишь больше чем за 24 часа' : 'Full refund if you cancel more than 24 h ahead'}</li>
                <li>{ru ? 'Меньше 24 часов — депозит сгорает' : 'Under 24 h — the deposit is forfeited'}</li>
                <li>{ru ? 'Перенос всегда бесплатный' : 'Rescheduling is always free'}</li>
                <li>{ru ? '3 no-show подряд → потребуем 50% предоплату' : '3 no-shows in a row → 50% prepayment required'}</li>
              </ul>
            ),
          })
        }
        className="faint"
        style={{ background: 'none', border: 0, fontSize: 12, padding: '12px 20px 0', textAlign: 'center', width: '100%', cursor: 'pointer', textDecoration: 'underline dotted' }}
      >
        {ru ? `Депозит ${deposit} · политика отмены` : `${deposit} deposit · cancellation policy`}
      </button>
    </div>
    <div className="bottom-cta">
      <button
        className="btn btn-primary btn-block"
        data-bottom-cta
        onClick={submit}
        disabled={!slot || submitting}
      >
        {submitting
          ? (ru ? 'Записываю…' : 'Booking…')
          : slot
            ? `${rescheduleId ? (ru ? 'Перенести' : 'Move') : t('common.book', lang)} · ${slot}`
            : (ru ? 'Все слоты заняты' : 'No slots left')}
      </button>
    </div>
    </>
  );
}
