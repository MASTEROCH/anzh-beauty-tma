import { useMemo, useState } from 'react';
import { findService, services, sTitle, sShort } from '../data/services';
import { openSheet, toast } from '../lib/ui';
import { Icon } from '../components/Icon';
import { useLang, t } from '../lib/i18n';

type Currency = 'usd' | 'gel';

const DAYS_RU = ['ВС', 'ПН', 'ВТ', 'СР', 'ЧТ', 'ПТ', 'СБ'];
const MON_RU = ['ЯНВ', 'ФЕВ', 'МАР', 'АПР', 'МАЙ', 'ИЮН', 'ИЮЛ', 'АВГ', 'СЕН', 'ОКТ', 'НОЯ', 'ДЕК'];
const DAYS_EN = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const MON_EN = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

const SLOTS = ['09:00', '10:30', '12:00', '13:30', '15:00', '16:30', '18:00', '19:30'];
const DISABLED = new Set(['09:00', '15:00']);

function nextDays(n: number) {
  const arr: Date[] = [];
  const today = new Date();
  for (let i = 0; i < n; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    arr.push(d);
  }
  return arr;
}

export function BookingScreen({
  initialServiceId,
  onConfirm,
  onChooseService,
  currency,
}: {
  initialServiceId?: string;
  onConfirm: () => void;
  onChooseService: () => void;
  currency: Currency;
}) {
  const lang = useLang();
  const DAYS = lang === 'ru' ? DAYS_RU : DAYS_EN;
  const MON = lang === 'ru' ? MON_RU : MON_EN;
  const dates = useMemo(() => nextDays(14), []);
  const [serviceId, setServiceId] = useState<string>(initialServiceId ?? services[0].id);
  const [dateIdx, setDateIdx] = useState(1);
  const [slot, setSlot] = useState<string | null>('16:30');
  const [submitting, setSubmitting] = useState(false);

  const service = findService(serviceId)!;
  const date = dates[dateIdx];
  const price = currency === 'usd' ? `$${service.priceUsd}` : `${service.priceGel} GEL`;
  const deposit = currency === 'usd'
    ? `$${Math.round(service.priceUsd * 0.1)}`
    : `${Math.round(service.priceGel * 0.1)} GEL`;

  const showMaster = () =>
    openSheet({
      title: 'Анжелика',
      subtitle: 'Косметолог · 8 лет практики',
      body: (
        <>
          <img
            src="/photos/anjelika.jpg"
            alt=""
            style={{ width: 96, height: 96, borderRadius: '50%', objectFit: 'cover', margin: '0 auto 14px', display: 'block', border: '2px solid var(--border-strong)' }}
          />
          <ul className="info-list">
            <li>Принимает по вт-сб 09:00–20:00</li>
            <li>Выходной — воскресенье</li>
            <li>1 472 завершённые процедуры</li>
            <li>★ 4.9 · 312 отзывов</li>
          </ul>
        </>
      ),
    });

  const onDisabledSlot = (s: string) =>
    toast(`${s} уже занят — попробуй другое время`);

  const submit = () => {
    if (!slot) {
      toast('Выбери время');
      return;
    }
    setSubmitting(true);
    setTimeout(() => {
      setSubmitting(false);
      onConfirm();
    }, 700);
  };

  return (
    <>
    <div className="screen has-cta">
      <header className="header">
        <div className="header-lede">
          <div className="eyebrow">{t('booking.eyebrow', lang)}</div>
          <div className="header-title">{t('booking.title', lang)}</div>
        </div>
        <button className="chip chip-gold" onClick={showMaster} aria-label="О мастере">
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
          <div className="service-image" style={{ backgroundImage: `url(/photos/${service.id}.jpg)` }}>
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
            const disabled = DISABLED.has(s);
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
          <span className="v">
            {date.getDate()} {MON[date.getMonth()].toLowerCase()} · {DAYS[date.getDay()]}
          </span>
        </div>
        <div className="summary-row">
          <span className="k">{t('booking.sum.time', lang)}</span>
          <span className="v">{slot ?? '—'}</span>
        </div>
        <div className="summary-row">
          <span className="k">{t('booking.sum.address', lang)}</span>
          <span className="v" style={{ textAlign: 'right', fontSize: 13 }}>Parnavaz Mepe 92/94 · 3 эт.</span>
        </div>
        <div className="summary-row total">
          <span className="k">{t('booking.sum.total', lang)}</span>
          <span className="v">{price}</span>
        </div>
      </section>

      <button
        onClick={() =>
          openSheet({
            title: 'Депозит и отмена',
            subtitle: 'Прозрачная политика',
            body: (
              <ul className="info-list">
                <li>Депозит {deposit} удерживается при подтверждении</li>
                <li>Возврат 100% — если отменишь больше чем за 24 часа</li>
                <li>Меньше 24 часов — депозит сгорает</li>
                <li>Перенос всегда бесплатный</li>
                <li>3 no-show подряд → потребуем 50% предоплату</li>
              </ul>
            ),
          })
        }
        className="faint"
        style={{ background: 'none', border: 0, fontSize: 12, padding: '12px 20px 0', textAlign: 'center', width: '100%', cursor: 'pointer', textDecoration: 'underline dotted' }}
      >
        Депозит {deposit} · политика отмены
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
          ? (lang === 'ru' ? 'Записываю…' : 'Booking…')
          : slot
            ? `${t('common.book', lang)} · ${slot}`
            : (lang === 'ru' ? 'Выбери слот' : 'Pick a slot')}
      </button>
    </div>
    </>
  );
}
