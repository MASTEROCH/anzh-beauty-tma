import { useMemo, useState } from 'react';
import { findService, services } from '../data/services';
import { openSheet, toast } from '../lib/ui';
import { Icon } from '../components/Icon';

type Currency = 'usd' | 'gel';

const DAYS_RU = ['ВС', 'ПН', 'ВТ', 'СР', 'ЧТ', 'ПТ', 'СБ'];
const MON_RU = ['ЯНВ', 'ФЕВ', 'МАР', 'АПР', 'МАЙ', 'ИЮН', 'ИЮЛ', 'АВГ', 'СЕН', 'ОКТ', 'НОЯ', 'ДЕК'];

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
            src="/brand/anzhelika.webp"
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
          <div className="eyebrow">запись</div>
          <div className="header-title">Выбор времени</div>
        </div>
        <button className="chip chip-gold" onClick={showMaster} aria-label="О мастере">
          🪷 мастер
        </button>
      </header>

      <div className="booking-stepper">
        <button
          className="step done"
          onClick={onChooseService}
          style={{ background: 'none', border: 0, padding: 0, color: 'inherit', cursor: 'pointer' }}
        >
          <span className="step-dot">✓</span>
          <span>Услуга</span>
        </button>
        <div className="sep" />
        <div className="step active">
          <span className="step-dot">2</span>
          <span>Дата / слот</span>
        </div>
        <div className="sep" />
        <div className="step">
          <span className="step-dot">3</span>
          <span>Подтверждение</span>
        </div>
      </div>

      <section style={{ padding: '14px 20px 0' }}>
        <div className="eyebrow" style={{ marginBottom: 8 }}>выбранная услуга</div>
        <button
          onClick={onChooseService}
          className="card service-card"
          style={{ marginBottom: 4, width: '100%', cursor: 'pointer', textAlign: 'left' }}
        >
          <div className="service-image"><Icon name={service.icon} size={36} strokeWidth={1.6} /></div>
          <div className="service-body">
            <h3 className="service-title">{service.title}</h3>
            <p className="service-desc">{service.short}</p>
            <div className="service-meta">
              <span className="service-price">{price}</span>
              <span className="faint" style={{ fontSize: 12 }}>· {service.duration} мин</span>
            </div>
          </div>
          <span style={{ position: 'absolute', top: '50%', right: 14, transform: 'translateY(-50%)', color: 'var(--tl)', fontSize: 18 }}>›</span>
        </button>
        <div className="row" style={{ gap: 8, overflowX: 'auto', padding: '8px 0 4px', scrollbarWidth: 'none' }}>
          {services.map((s) => (
            <button
              key={s.id}
              className={`chip ${serviceId === s.id ? 'active' : ''}`}
              onClick={() => setServiceId(s.id)}
            >
              <Icon name={s.icon} size={14} strokeWidth={1.8} />
              <span>{s.title.length > 18 ? s.title.slice(0, 16) + '…' : s.title}</span>
            </button>
          ))}
        </div>
      </section>

      <section>
        <div className="eyebrow" style={{ padding: '18px 20px 0' }}>выбери день</div>
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
              <div className="dow">{DAYS_RU[d.getDay()]}</div>
              <div className="day">{d.getDate()}</div>
              <div className="mon">{MON_RU[d.getMonth()]}</div>
            </button>
          ))}
        </div>
      </section>

      <section>
        <div className="eyebrow" style={{ padding: '6px 20px 8px' }}>свободное время</div>
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
          Серые слоты — заняты, можно тапнуть и я подскажу ближайший свободный.
        </div>
      </section>

      <section className="booking-summary">
        <div className="eyebrow" style={{ marginBottom: 10 }}>детали записи</div>
        <div className="summary-row">
          <span className="k">Процедура</span>
          <span className="v">{service.title}</span>
        </div>
        <div className="summary-row">
          <span className="k">Длительность</span>
          <span className="v">{service.duration} мин</span>
        </div>
        <div className="summary-row">
          <span className="k">Дата</span>
          <span className="v">
            {date.getDate()} {MON_RU[date.getMonth()].toLowerCase()} · {DAYS_RU[date.getDay()]}
          </span>
        </div>
        <div className="summary-row">
          <span className="k">Время</span>
          <span className="v">{slot ?? '—'}</span>
        </div>
        <div className="summary-row">
          <span className="k">Адрес</span>
          <span className="v" style={{ textAlign: 'right', fontSize: 13 }}>Чавчавадзе 12 · 3 эт.</span>
        </div>
        <div className="summary-row total">
          <span className="k">К оплате</span>
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
        {submitting ? 'Записываю…' : slot ? `Записаться · ${slot}` : 'Выбери слот'}
      </button>
    </div>
    </>
  );
}
