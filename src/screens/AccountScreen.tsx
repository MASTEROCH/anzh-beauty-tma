import { PER_TASK } from '../lib/quests';
import { useMemo } from 'react';
import { googleMapsUrl } from '../data/location';
import { openExternal } from '../lib/telegram';
import { studioAddress } from '../data/location';
import { openSheet, toast } from '../lib/ui';
import { Icon } from '../components/Icon';
import { ReviewSheet } from '../components/ReviewSheet';
import { SettingsSheet } from '../components/SettingsSheet';
import { HealthPassportSheet } from '../components/HealthPassportSheet';
import { PinGate } from '../components/PinGate';
import { t, pts } from '../lib/i18n';
import { findService, sTitle, servicePhoto } from '../data/services';
import {
  useAppointments, getUpcoming, getPast, getDeclined, getMyAppointments,
  cancelAppointment, acceptOffer, formatLongDate, formatWeekday, formatMonthShort,
  fromISODate, formatShort, STATUS_LABEL, type Appointment,
} from '../lib/appointments';
import { useHealthPassport, passportFlags, SENSITIVITY_LABEL } from '../lib/healthPassport';
import { tierOf, nextTier, tierProgress, pointsToNext, pointsForVisit, TIERS } from '../lib/loyalty';
import { timelineFor } from '../lib/notifications';
import { useBonuses, getActiveBonuses, daysLeft, SOURCE_LABEL } from '../lib/bonuses';
import { useQuizResults } from '../lib/quizResults';
import { findQuiz } from '../data/quizzes';
import { QuizRunner } from '../components/QuizRunner';
import { SECONDARY_LABEL } from '../lib/quizScore';
import { g, useGender } from '../lib/gender';
import type { ClientProfile } from '../App';

type Lang = 'ru' | 'en';
type Currency = 'usd' | 'gel';

export function AccountScreen({
  onBook,
  onBookAgain,
  onReschedule,
  lang,
  onLang,
  currency,
  onCurrency,
  points,
  onAwardPoints,
  client,
  onPlan,
  onStudio,
}: {
  onBook: () => void;
  /** Повторная запись на конкретную процедуру — из отклонённой заявки */
  onBookAgain: (serviceId: string) => void;
  onReschedule: () => void;
  lang: Lang;
  onLang: (l: Lang) => void;
  currency: Currency;
  onCurrency: (c: Currency) => void;
  points: number;
  onAwardPoints: (p: number) => void;
  client: ClientProfile;
  onPlan: () => void;
  onStudio: () => void;
}) {
  const all = useAppointments();
  const passport = useHealthPassport();
  const gender = useGender();
  const bonuses = useBonuses();
  const quizResults = useQuizResults();
  const activeBonuses = useMemo(() => getActiveBonuses(bonuses), [bonuses]);
  const userName = client.name;

  const mine = useMemo(
    () => getMyAppointments(all, client.instagram || undefined, client.name),
    [all, client.instagram, client.name],
  );
  const upcoming = useMemo(() => getUpcoming(mine), [mine]);
  const history = useMemo(() => getPast(mine).filter((a) => a.status === 'completed'), [mine]);
  const declined = useMemo(() => getDeclined(mine), [mine]);

  const tier = tierOf(points);
  const nTier = nextTier(points);
  const flags = passportFlags(passport, lang === 'ru');

  const openReview = (serviceId?: string) =>
    openSheet({
      title: 'Оставить отзыв',
      subtitle: 'Скидка на следующую процедуру',
      body: <ReviewSheet defaultServiceId={serviceId} onAwardPoints={onAwardPoints} />,
    });

  const showSettings = () =>
    openSheet({
      title: t('settings.title', lang),
      subtitle: 'ANZH Cosmetology',
      body: <SettingsSheet lang={lang} onLang={onLang} currency={currency} onCurrency={onCurrency} onStudio={openStudioGate} />,
    });

  const openStudioGate = () =>
    openSheet({
      title: 'Кабинет мастера',
      subtitle: 'Только для Анжелики',
      body: <PinGate onUnlock={onStudio} />,
    });

  const showLoyalty = () =>
    openSheet({
      title: 'Anjelika Club',
      subtitle: `${tier.label} · ${tier.cashback}% кэшбэк`,
      body: (
        <>
          <div className="loyalty-card" style={{ margin: 0, width: '100%' }}>
            <div className="loyalty-tier">★ {tier.label} · сейчас твой тир</div>
            <div className="loyalty-points">{points}<small> {pts(points, lang)}</small></div>
            <div className="loyalty-progress"><div className="loyalty-progress-fill" style={{ width: `${tierProgress(points)}%` }} /></div>
            <div className="loyalty-hint">
              {nTier ? `До ${nTier.label} ещё ${pointsToNext(points)} ${pts(pointsToNext(points), lang)}.` : 'Максимальный тир — спасибо, что ты с Анжеликой 💛'}
            </div>
          </div>
          <div style={{ marginTop: 16 }}>
            <div className="eyebrow mb-sm">как зарабатывать</div>
            <ul className="info-list">
              <li>{tier.cashback}% от чека возвращается баллами — по твоему тиру</li>
              <li>Отзыв → −{PER_TASK}% на следующую процедуру</li>
              <li>Отзыв с фото через месяц → бонус на следующий визит</li>
              <li>Приведи подругу → +1000 баллов обоим</li>
            </ul>
          </div>
          <div style={{ marginTop: 16 }}>
            <div className="eyebrow mb-sm">тиры и привилегии</div>
            <div className="tier-list">
              {TIERS.map((x) => (
                <div key={x.key} className={`tier-row ${x.key === tier.key ? 'now' : ''} ${points >= x.min ? 'reached' : ''}`}>
                  <span className="tier-name">{x.label}</span>
                  <span className="tier-perk">{x.perk[lang]}</span>
                  <span className="tier-min">{x.min}+</span>
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
            navigator.clipboard?.writeText(`https://t.me/anzh_bot?start=ref_${client.tgId ?? client.instagram ?? 'me'}`);
            toast('Реферальная ссылка скопирована', 'success');
          }}
        >
          Скопировать реферальную ссылку
        </button>
      ),
    });

  const showAppointment = (a: Appointment) => {
    const svc = findService(a.serviceId);
    const st = STATUS_LABEL[a.status];
    openSheet({
      title: svc ? sTitle(svc, lang) : a.serviceId,
      subtitle: `${formatLongDate(fromISODate(a.dateISO), lang)} · ${a.slot}`,
      body: (
        <>
          <div className={`appt-status ${st.tone}`}>
            <Icon name={a.status === 'confirmed' ? 'check' : a.status === 'pending' ? 'clock' : 'info'} size={15} strokeWidth={2.2} />
            {st[lang]}
          </div>

          {a.status === 'offered' && a.offeredDateISO && (
            <div className="offer-box">
              <div className="offer-box-title">Анжелика предложила другое время</div>
              <div className="offer-box-time">
                {formatLongDate(fromISODate(a.offeredDateISO), lang)} · {a.offeredSlot}
              </div>
              <p className="faint" style={{ fontSize: 12, marginTop: 6 }}>
                Твой слот заняли по телефону — бывает. Подходит новое время?
              </p>
            </div>
          )}

          <ul className="info-list mt">
            <li>{svc?.short}</li>
            <li>Длительность {svc?.duration} мин</li>
            <li>{studioAddress(lang)}</li>
            <li>К оплате на месте ${svc?.priceUsd}</li>
          </ul>
          {a.comment && <p className="muted" style={{ fontSize: 13, marginTop: 10 }}>Твой комментарий: «{a.comment}»</p>}

          <div className="eyebrow sub-head">что я пришлю</div>
          <ul className="notif-timeline">
            {timelineFor(svc ? sTitle(svc, lang) : 'процедуру')
              .filter((n) => n.to === 'client')
              .map((n) => (
                <li key={n.when}>
                  <span className="nt-when">{n.when}</span>
                  <span className="nt-text">{n.text}</span>
                </li>
              ))}
          </ul>
        </>
      ),
      actions: (
        <>
          {a.status === 'offered' && (
            <button className="btn btn-primary btn-block" onClick={() => { acceptOffer(a.id); toast('Новое время принято ✓', 'success'); }}>
              Подходит · подтвердить
            </button>
          )}
          <button className="btn btn-secondary btn-block" onClick={onReschedule}>Перенести</button>
          <button
            className="btn btn-secondary btn-block"
            onClick={() => {
              openExternal(googleMapsUrl());
              toast('Открываю маршрут', 'success');
            }}
          >
            Маршрут в Maps
          </button>
          <button
            className="btn btn-secondary btn-block"
            onClick={() => {
              if (confirm('Отменить запись?')) { cancelAppointment(a.id); toast('Запись отменена'); }
            }}
          >
            Отменить запись
          </button>
        </>
      ),
    });
  };

  const showHistory = (a: Appointment) => {
    const svc = findService(a.serviceId);
    const photo = servicePhoto(a.serviceId);
    openSheet({
      title: svc ? sTitle(svc, lang) : a.serviceId,
      subtitle: `${formatShort(a.dateISO, lang)} · ${lang === 'ru' ? 'оплачено' : 'paid'}`,
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
            <li>{svc?.short}</li>
            <li>Сумма: ${a.amount ?? svc?.priceUsd}</li>
            <li>{lang === 'ru' ? 'Начислено баллов' : 'Points earned'}: +{pointsForVisit(a.amount ?? svc?.priceUsd ?? 0, points)}</li>
            <li>Заметка мастера приватна</li>
          </ul>
        </>
      ),
      actions: (
        <>
          <button className="btn btn-primary btn-block" onClick={() => { toast('Открываю запись на эту процедуру'); setTimeout(onBook, 500); }}>
            Записаться повторно
          </button>
          <button className="btn btn-secondary btn-block" onClick={() => openReview(a.serviceId)}>
            Оставить отзыв · −{PER_TASK}%
          </button>
        </>
      ),
    });
  };

  const showHealth = () =>
    openSheet({
      title: 'Паспорт здоровья',
      subtitle: 'Анкета · видит только Анжелика',
      body: <HealthPassportSheet onBook={() => onBook()} />,
    });

  return (
    <div className="screen">
      <header className="header">
        <div className="header-lede">
          <div className="eyebrow">{t('account.title', lang)}</div>
          <div className="header-title">{userName}</div>
        </div>
        <button className="chip" onClick={showSettings} aria-label="Настройки">
          <Icon name="settings" size={14} strokeWidth={1.8} /> {t('settings.title', lang)}
        </button>
      </header>

      <section className="account-hero">
        <h1 className="account-hello">
          {t('account.hello', lang)}, {userName}{' '}
          <Icon name="heart-filled" size={22} strokeWidth={0} style={{ color: 'var(--brand-gold)', verticalAlign: '-2px' }} />
        </h1>
        <div className="account-sub">
          {t('account.clientSince', lang)} 2024 · {history.length} {t('account.procs', lang)} · {tier.label}
        </div>
      </section>

      <button className="loyalty-card" onClick={showLoyalty}>
        <div className="loyalty-tier">★ {tier.label} · Anjelika Club</div>
        <div className="loyalty-points">{points}<small> {pts(points, lang)}</small></div>
        <div className="loyalty-progress"><div className="loyalty-progress-fill" style={{ width: `${tierProgress(points)}%` }} /></div>
        <div className="loyalty-hint">
          {nTier
            ? (lang === 'ru'
                ? `До ${nTier.label} ещё ${pointsToNext(points)} баллов · кэшбэк ${tier.cashback}%`
                : `${pointsToNext(points)} points to ${nTier.label} · ${tier.cashback}% cashback`)
            : (lang === 'ru'
                ? `Максимальный тир · кэшбэк ${tier.cashback}%`
                : `Top tier · ${tier.cashback}% cashback`)}
        </div>
      </button>

      {/* Ответ мастера на отклонённую заявку. Без этого блока отказ
          просто исчезал: человек ждал ответа, которого не будет. */}
      {declined.length > 0 && (
        <section className="section section-flush">
          <div className="eyebrow mb-sm">
            {lang === 'ru' ? 'ответ на заявку' : 'reply to your request'}
          </div>
          <div className="col" style={{ gap: 10 }}>
            {declined.map((a) => {
              const svc = findService(a.serviceId);
              return (
                <div key={a.id} className="declined-card">
                  <div className="declined-head">
                    <Icon name="info" size={15} strokeWidth={2.2} />
                    {lang === 'ru' ? 'Это время не получилось' : 'This time did not work out'}
                  </div>
                  <div className="declined-what">
                    {svc ? sTitle(svc, lang) : a.serviceId} · {formatShort(a.dateISO, lang)} · {a.slot}
                  </div>
                  {a.declineReason && (
                    <p className="declined-why">«{a.declineReason}»</p>
                  )}
                  <button
                    className="btn btn-primary btn-block mt"
                    onClick={() => onBookAgain(a.serviceId)}
                  >
                    {lang === 'ru' ? 'Выбрать другое время' : 'Pick another time'}
                  </button>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {upcoming.length > 0 ? (
        <section className="section section-flush">
          <div className="eyebrow mb-sm">
            {upcoming.length > 1 ? `записи · ${upcoming.length}` : t('account.next', lang)}
          </div>
          <div className="col" style={{ gap: 10 }}>
            {upcoming.map((a) => {
              const svc = findService(a.serviceId);
              const st = STATUS_LABEL[a.status];
              const d = fromISODate(a.dateISO);
              return (
                <button key={a.id} className={`next-appt status-${st.tone}`} onClick={() => showAppointment(a)}>
                  <div className="next-appt-day">
                    <span className="d">{d.getDate()}</span>
                    <span className="m">{formatMonthShort(d, lang)}</span>
                  </div>
                  <div className="next-appt-body">
                    <div className="t">{st[lang]}</div>
                    <div className="what">{svc ? sTitle(svc, lang) : a.serviceId}</div>
                    <div className="when">{formatWeekday(d, lang)} · {a.slot} · Parnavaz Mepe 92/94</div>
                  </div>
                  <div style={{ color: 'var(--tl)', fontSize: 18, paddingRight: 4 }}>›</div>
                </button>
              );
            })}
          </div>
        </section>
      ) : (
        <section className="section section-flush">
          <div className="card" style={{ padding: 20, textAlign: 'center' }}>
            <div className="muted">Записей пока нет</div>
            <button className="btn btn-primary btn-sm mt" onClick={onBook}>
              Выбрать время
            </button>
          </div>
        </section>
      )}

      {activeBonuses.length > 0 && (
        <section className="section section-flush">
          <div className="eyebrow mb-sm">{lang === 'ru' ? 'мои бонусы' : 'my bonuses'} · {activeBonuses.length}</div>
          <div className="col" style={{ gap: 8 }}>
            {activeBonuses.map((b, i) => (
              <div key={b.id} className="bonus-card reveal" style={{ animationDelay: `${i * 50}ms` }}>
                <div className="bonus-percent">−{b.percent}%</div>
                <div className="bonus-body">
                  <div className="bonus-title">{b.title}</div>
                  <div className="bonus-note">{SOURCE_LABEL[b.source][lang]} · {b.note}</div>
                </div>
                <div className="bonus-left">
                  <span className="bonus-days">{daysLeft(b)} {lang === 'ru' ? 'дн.' : 'days'}</span>
                  <button
                    className="bonus-code"
                    onClick={() => { navigator.clipboard?.writeText(b.code); toast(`Промокод ${b.code} скопирован`, 'success'); }}
                  >
                    {b.code}
                  </button>
                </div>
              </div>
            ))}
          </div>
          <p className="faint" style={{ fontSize: 12, marginTop: 8 }}>
            {lang === 'ru'
              ? 'Бонус применяется при записи — говорить о нём не нужно, Анжелика видит его у себя.'
              : 'The bonus applies when you book — no need to mention it, Anjelika sees it on her side.'}
          </p>
        </section>
      )}

      <section className="section">
        <button className="plan-cta" onClick={onPlan}>
          <div className="plan-cta-icon"><Icon name="sparkles" size={20} strokeWidth={1.8} /></div>
          <div className="plan-cta-text">
            <div className="plan-cta-title">{lang === 'ru' ? 'План процедур' : 'Treatment plan'}</div>
            <div className="plan-cta-sub">{lang === 'ru' ? 'Соберу курс из избранного — с порядком, интервалами и сроком' : 'I’ll build a course from your favourites — order, intervals, timeline'}</div>
          </div>
          <Icon name="chevron-right" size={20} strokeWidth={2} className="review-cta-arrow" />
        </button>
      </section>

      {history.length === 0 && (
        <section className="section section-tight">
          <div className="card empty-state">
            <div className="empty-icon"><Icon name="clock" size={26} strokeWidth={1.7} /></div>
            <div className="empty-title">История пока пустая</div>
            <div className="empty-sub">
              Здесь появятся процедуры с фото «до / после», суммой и начисленными баллами —
              всё собирается само после визита.
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
              return (
                <button key={a.id} className="history-row reveal" style={{ animationDelay: `${Math.min(i, 8) * 45}ms` }} onClick={() => showHistory(a)}>
                  <div className={`history-icon${servicePhoto(a.serviceId) ? '' : ' history-icon--blank'}`} style={servicePhoto(a.serviceId) ? { backgroundImage: `url(${servicePhoto(a.serviceId)})` } : undefined}>{!servicePhoto(a.serviceId) && <Icon name={svc?.icon ?? 'sparkles'} size={17} strokeWidth={1.8} />}</div>
                  <div className="history-body">
                    <div className="history-name">{svc ? sTitle(svc, lang) : a.serviceId}</div>
                    <div className="history-when">{formatShort(a.dateISO, lang)} · {lang === 'ru' ? 'оплачено' : 'paid'}</div>
                  </div>
                  <div className="history-amount">${a.amount ?? svc?.priceUsd}</div>
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
              <div className="eyebrow">{lang === 'ru' ? 'разборы кожи' : 'skin analyses'}</div>
              <h2 className="section-title">{lang === 'ru' ? 'Что известно о коже' : 'What we know'}</h2>
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
                    subtitle: `${lang === 'ru' ? 'пройден' : 'taken'} ${new Date(r.takenAt).toLocaleDateString(lang === 'ru' ? 'ru-RU' : 'en-US', { day: 'numeric', month: 'long' })}`,
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
            {lang === 'ru'
              ? 'Анжелика видит эти разборы до визита — рассказывать заново не нужно.'
              : 'Anjelika sees these before your visit — no need to repeat yourself.'}
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
            {lang === 'ru' ? 'правка' : 'edit'}
          </button>
        </div>
        <button onClick={showHealth} className="patient-card">
          <div className="patient-head">
            <div className="patient-avatar">{userName.slice(0, 1).toUpperCase()}</div>
            <div className="patient-id">
              <div className="patient-name">{userName}</div>
              <div className="patient-meta">
                {client.instagram ? `@${client.instagram}` : 'ID ANZH-0342'} · {lang === 'ru' ? 'клиент с 2024' : 'client since 2024'}
              </div>
            </div>
            <div className="patient-badge">Fitzpatrick {passport.fitzpatrick}</div>
          </div>
          <div className="patient-vitals">
            <div className="pv"><span className="pv-label">{lang === 'ru' ? 'Тип кожи' : 'Skin type'}</span><span className="pv-val">{passport.skinType}</span></div>
            <div className="pv"><span className="pv-label">{lang === 'ru' ? 'Чувствит.' : 'Sensitivity'}</span><span className="pv-val">{SENSITIVITY_LABEL[passport.sensitivity][lang]}</span></div>
            <div className="pv"><span className="pv-label">{lang === 'ru' ? 'Купероз' : 'Couperose'}</span><span className="pv-val">{passport.couperose ? (lang === 'ru' ? 'Есть' : 'Yes') : (lang === 'ru' ? 'Нет' : 'No')}</span></div>
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
              ? `Обновлено ${new Date(passport.updatedAt).toLocaleDateString('ru-RU')} · Анжелика сверяет перед каждой записью`
              : 'Анжелика сверяет флаги перед каждой записью'}
          </div>
        </button>
      </section>

      <div style={{ padding: '0 20px 8px' }}>
        <button className="btn btn-primary btn-block" onClick={onBook}>
          {t('account.rebook', lang)}
        </button>
      </div>
      <div style={{ padding: '0 20px 20px' }}>
        <button className="btn btn-secondary btn-block" onClick={() => openReview()}>
          {lang === 'ru' ? `Оставить отзыв · −${PER_TASK}%` : `Leave a review · −${PER_TASK}%`}
        </button>
      </div>

      <p className="faint" style={{ fontSize: 12, textAlign: 'center', padding: '0 20px 20px' }}>
        {lang === 'ru'
          ? `${g('Записалась', 'Записался', gender)} и передумал${g('а', '', gender)}? Перенос бесплатный в любой момент`
          : 'Changed your mind? Rescheduling is free, any time'} 💛
      </p>
    </div>
  );
}
