import { useMemo, useState } from 'react';
import { findService, sTitle, sShort, servicePhoto } from '../data/services';
import { useCatalog } from '../lib/catalog';
import { openSheet, toast } from '../lib/ui';
import { Icon } from '../components/Icon';
import { PingPong } from '../components/PingPong';
import { useLang, t } from '../lib/i18n';
import { requestAppointment, isSlotTaken, toISODate, useAppointments } from '../lib/appointments';
import { select } from '../lib/haptics';
import { useHealthPassport, matchContraindications } from '../lib/healthPassport';
import { useBonuses, bestBonus, redeemBonus } from '../lib/bonuses';
import type { ClientProfile } from '../App';

type Currency = 'usd' | 'gel';

const DAYS_RU = ['ВС', 'ПН', 'ВТ', 'СР', 'ЧТ', 'ПТ', 'СБ'];
const MON_RU = ['ЯНВ', 'ФЕВ', 'МАР', 'АПР', 'МАЙ', 'ИЮН', 'ИЮЛ', 'АВГ', 'СЕН', 'ОКТ', 'НОЯ', 'ДЕК'];
const DAYS_EN = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const MON_EN = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

const SLOTS = ['09:00', '10:30', '12:00', '13:30', '15:00', '16:30', '18:00', '19:30'];
/** Анжелика принимает вт–сб; воскресенье и понедельник — выходные */
const WORK_DAYS = [2, 3, 4, 5, 6];

function nextDays(n: number) {
  const today = new Date();
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    return d;
  });
}

export function BookingScreen({
  initialServiceId,
  onConfirm,
  onChooseService,
  currency,
  client,
  onClientChange,
}: {
  initialServiceId?: string;
  onConfirm: () => void;
  onChooseService: () => void;
  currency: Currency;
  client: ClientProfile;
  onClientChange: (patch: Partial<ClientProfile>) => void;
}) {
  const lang = useLang();
  const ru = lang === 'ru';
  const all = useAppointments();
  const passport = useHealthPassport();
  const DAYS = lang === 'ru' ? DAYS_RU : DAYS_EN;
  const MON = lang === 'ru' ? MON_RU : MON_EN;
  const dates = useMemo(() => nextDays(21), []);
  const { live } = useCatalog();
  const [serviceId, setServiceId] = useState<string>(initialServiceId ?? live[0].id);
  /* Дополнительные процедуры того же визита. Анжелика часто делает две-три
     за один приход — раньше это была отдельная заявка на каждую, и в её
     расписании они вставали как разные люди. */
  const [extras, setExtras] = useState<string[]>([]);
  const [dateIdx, setDateIdx] = useState(() => dates.findIndex((d) => WORK_DAYS.includes(d.getDay())));
  const [slot, setSlot] = useState<string | null>(null);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const service = findService(serviceId)!;
  const chosen = [service, ...extras.map((id) => findService(id)!).filter(Boolean)];
  const totalMin = chosen.reduce((n, x) => n + x.duration, 0);
  const totalUsd = chosen.reduce((n, x) => n + x.priceUsd, 0);
  const totalGel = chosen.reduce((n, x) => n + x.priceGel, 0);

  const toggleExtra = (id: string) => {
    select();
    setExtras((x) => (x.includes(id) ? x.filter((i) => i !== id) : [...x, id]));
  };
  // Бонус из кабинета применяется сам — за него не надо просить на месте
  const bonuses = useBonuses();
  const bonus = useMemo(() => bestBonus(bonuses), [bonuses]);
  const date = dates[dateIdx] ?? dates[0];
  const dateISO = toISODate(date);
  const dayOff = !WORK_DAYS.includes(date.getDay());
  const price = currency === 'usd' ? `$${totalUsd}` : `${totalGel} GEL`;
  const withBonus = (v: number) => (bonus ? Math.round(v * (1 - bonus.percent / 100)) : v);
  const finalPrice = currency === 'usd'
    ? `$${withBonus(totalUsd)}`
    : `${withBonus(totalGel)} GEL`;

  // Реальная занятость: слот закрыт, только если на него уже есть ПОДТВЕРЖДЁННАЯ
  // запись. Заявки друг друга не блокируют — решает Анжелика.
  const taken = useMemo(() => {
    void all;
    return new Set(SLOTS.filter((s) => isSlotTaken(dateISO, s)));
  }, [dateISO, all]);

  const contraHits = matchContraindications(passport, service.contraindications);

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
            <li>Принимает по вт–сб 09:00–20:00</li>
            <li>Воскресенье и понедельник — выходные</li>
            <li>Каждую заявку подтверждает лично</li>
            <li>★ 4.9 · 312 отзывов</li>
          </ul>
        </>
      ),
    });

  const submit = () => {
    if (!slot) {
      toast(ru ? 'Выбери время' : 'Pick a time');
      return;
    }
    setSubmitting(true);
    const appt = requestAppointment({
      dateISO,
      slot,
      serviceId,
      extras: extras.length ? extras : undefined,
      clientName: client.name,
      clientInstagram: client.instagram || undefined,
      clientTgUsername: client.tgUsername,
      clientPhone: client.phone || undefined,
      comment: comment.trim() || undefined,
    });
    // Бонус уходит вместе с заявкой; если её отклонят — вернётся человеку
    if (bonus) redeemBonus(bonus.id, appt.id);
    setTimeout(() => {
      setSubmitting(false);
      onConfirm();
    }, 650);
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
            <span>{ru ? 'заявка' : 'request'}</span>
          </div>
        </div>

        <section style={{ padding: '14px 20px 0' }}>
          <div className="eyebrow" style={{ marginBottom: 8 }}>{t('booking.chosen', lang)}</div>
          <button
            onClick={onChooseService}
            className="card service-card"
            style={{ marginBottom: 4, width: '100%', cursor: 'pointer', textAlign: 'left' }}
          >
            <div
              className={`service-image${servicePhoto(service.id) ? '' : ' service-image--blank'}`}
              style={servicePhoto(service.id) ? { backgroundImage: `url(${servicePhoto(service.id)})` } : undefined}
            >
              {servicePhoto(service.id)
                ? <span className="service-image-badge"><Icon name={service.icon} size={16} strokeWidth={1.9} /></span>
                : <Icon name={service.icon} size={28} strokeWidth={1.5} className="service-image-glyph" />}
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
          {/* Добавленные к визиту — списком, а не чипами: их надо видеть
              целиком и уметь снять одним тапом */}
          {extras.length > 0 && (
            <div className="bk-extras">
              {extras.map((id) => {
                const x = findService(id);
                if (!x) return null;
                return (
                  <div key={id} className="bk-extra">
                    <Icon name={x.icon} size={15} strokeWidth={1.9} />
                    <span className="bk-extra-title">{sTitle(x, lang)}</span>
                    <span className="bk-extra-meta">+{x.duration} {t('common.min', lang)} · ${x.priceUsd}</span>
                    <button
                      className="bk-extra-off"
                      aria-label={ru ? `Убрать: ${sTitle(x, lang)}` : `Remove ${sTitle(x, lang)}`}
                      onClick={() => toggleExtra(id)}
                    >
                      <Icon name="x" size={13} strokeWidth={2.6} />
                    </button>
                  </div>
                );
              })}
              <div className="bk-extra-total">
                {ru ? 'Визит целиком' : 'Whole visit'} · {totalMin} {t('common.min', lang)} · {price}
              </div>
            </div>
          )}

          <div className="eyebrow" style={{ margin: '14px 0 6px' }}>
            {ru ? 'добавить к этому визиту' : 'add to this visit'}
          </div>
          <div className="trust-row marquee chip-marquee" style={{ marginTop: 8 }} aria-label="Услуги">
            <div className="marquee-track">
              {[0, 1].map((dup) => (
                <div className="marquee-group" key={dup} aria-hidden={dup === 1 ? true : undefined}>
                  {live.map((s) => {
                    const title = sTitle(s, lang);
                    return (
                      <button
                        key={s.id}
                        className={`chip ${serviceId === s.id ? 'active' : ''}${extras.includes(s.id) ? ' extra' : ''}`}
                        onClick={() => {
                          if (s.id === serviceId) return;
                          // Уже выбранная основной — не трогаем; остальные
                          // добавляются к визиту, а не заменяют его
                          toggleExtra(s.id);
                        }}
                        tabIndex={dup === 1 ? -1 : undefined}
                      >
                        <Icon name={s.icon} size={14} strokeWidth={1.8} />
                        <PingPong className="chip-pp">{title}</PingPong>
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </section>

        {contraHits.length > 0 && (
          <section style={{ padding: '14px 20px 0' }}>
            <div className="contra-alert">
              <Icon name="warning" size={18} strokeWidth={2} />
              <div>
                <div className="contra-alert-title">{ru ? 'Сверила с твоей анкетой' : 'Checked against your questionnaire'}</div>
                <div className="contra-alert-text">
                  {contraHits.join(' · ')}{ru ? '. Заявку отправить можно — Анжелика посмотрит и решит.' : '. You can still send the request — Anjelika will review and decide.'}
                </div>
              </div>
            </div>
          </section>
        )}

        <section>
          <div className="eyebrow" style={{ padding: '18px 20px 0' }}>{t('booking.pickDay', lang)}</div>
          <div className="date-strip">
            {dates.map((d, i) => {
              const off = !WORK_DAYS.includes(d.getDay());
              return (
                <button
                  key={i}
                  className={`date-pill ${dateIdx === i ? 'active' : ''} ${off ? 'off' : ''}`}
                  onClick={() => {
                    if (off) { toast(ru ? 'Вт–сб · воскресенье и понедельник выходные' : 'Tue–Sat · closed Sunday and Monday'); return; }
                    setDateIdx(i);
                    setSlot(null);
                  }}
                >
                  <div className="dow">{DAYS[d.getDay()]}</div>
                  <div className="day">{d.getDate()}</div>
                  <div className="mon">{MON[d.getMonth()]}</div>
                </button>
              );
            })}
          </div>
        </section>

        <section>
          <div className="eyebrow" style={{ padding: '6px 20px 8px' }}>{t('booking.freeTime', lang)}</div>
          {dayOff ? (
            <div className="card" style={{ margin: '0 20px', padding: 18, textAlign: 'center' }}>
              <div className="muted">{ru ? 'В этот день Анжелика не принимает' : 'Anjelika doesn’t work this day'}</div>
            </div>
          ) : (
            <div className="slot-grid">
              {SLOTS.map((s) => {
                const busy = taken.has(s);
                return (
                  <button
                    key={s}
                    className={`slot ${slot === s ? 'active' : ''} ${busy ? 'disabled' : ''}`}
                    onClick={() => (busy ? toast(`${s} уже занято — выбери другое время`) : setSlot(s))}
                    aria-pressed={slot === s}
                  >
                    {s}
                  </button>
                );
              })}
            </div>
          )}
          <div className="faint" style={{ fontSize: 12, padding: '10px 20px 0' }}>
            {ru
              ? 'Зачёркнутое — уже занято. Свободное время подтверждает Анжелика: она ведёт записи ещё и по телефону.'
              : 'Crossed out means taken. Anjelika confirms free slots — she also books by phone.'}
          </div>
        </section>

        <section style={{ padding: '18px 20px 0' }}>
          <div className="eyebrow" style={{ marginBottom: 8 }}>{ru ? 'как с тобой связаться' : 'how to reach you'}</div>
          <div className="onb-form">
            <label className="onb-field">
              <span className="onb-label">{ru ? 'имя' : 'name'}</span>
              <input
                className="onb-input"
                type="text"
                value={client.name}
                onChange={(e) => onClientChange({ name: e.target.value })}
                placeholder={ru ? 'Как тебя зовут' : 'Your name'}
              />
            </label>
            <label className="onb-field">
              <span className="onb-label">{ru ? 'инстаграм' : 'instagram'} <span className="faint">· {ru ? 'так Анжелика тебя узнает' : 'how Anjelika recognises you'}</span></span>
              <input
                className="onb-input"
                type="text"
                value={client.instagram}
                onChange={(e) => onClientChange({ instagram: e.target.value.replace(/^@/, '') })}
                placeholder="@nickname"
                autoCapitalize="none"
                autoCorrect="off"
              />
            </label>
            <label className="onb-field">
              <span className="onb-label">{ru ? 'комментарий' : 'comment'} <span className="faint">· {ru ? 'опционально' : 'optional'}</span></span>
              <textarea
                className="review-textarea"
                rows={2}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder={ru ? 'Что беспокоит, пожелания по времени' : 'What bothers you, preferred time'}
                maxLength={300}
              />
            </label>
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
            <span className="v">{totalMin} {t('common.min', lang)}</span>
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
            <span className="v" style={{ textAlign: 'right', fontSize: 13 }}>Parnavaz Mepe 92/94 · 1 эт.</span>
          </div>
          {bonus && (
            <div className="summary-row">
              <span className="k">{ru ? 'Бонус' : 'Bonus'} · {bonus.code}</span>
              <span className="v" style={{ color: 'var(--brand-gold-bright)' }}>−{bonus.percent}%</span>
            </div>
          )}
          <div className="summary-row total">
            <span className="k">{t('booking.sum.total', lang)}</span>
            <span className="v">
              {bonus && <span className="price-was">{price}</span>}
              {finalPrice}
            </span>
          </div>
        </section>

        <p className="faint" style={{ fontSize: 12, padding: '12px 20px 0', textAlign: 'center' }}>
          {ru
            ? 'Это заявка, а не бронь. Анжелика подтвердит или предложит другое время — придёт уведомление.'
            : 'This is a request, not a booking. Anjelika will confirm or offer another time — you’ll be notified.'}
        </p>
      </div>

      <div className="bottom-cta">
        <button
          className="btn btn-primary btn-block"
          data-bottom-cta
          onClick={submit}
          disabled={!slot || submitting || dayOff}
        >
          {submitting
            ? (ru ? 'Отправляю…' : 'Sending…')
            : slot
              ? `${ru ? 'Отправить заявку' : 'Send request'} · ${slot}`
              : (ru ? 'Выбери время' : 'Pick a time')}
        </button>
      </div>
    </>
  );
}
