import { useMemo } from 'react';
import { Icon } from '../components/Icon';
import { toast } from '../lib/ui';
import { sTitle, sShort } from '../data/services';
import { useLang, t } from '../lib/i18n';
import { buildPlan, sendPlanForApproval, usePlanStatus } from '../lib/plan';
import { formatLongDate, formatMonthShort } from '../lib/appointments';

type Currency = 'usd' | 'gel';

export function PlanScreen({
  favorites,
  currency,
  onBack,
  onBook,
  onCatalog,
}: {
  favorites: Set<string>;
  currency: Currency;
  onBack: () => void;
  onBook: (id: string) => void;
  onCatalog: () => void;
}) {
  const lang = useLang();
  const ru = lang === 'ru';
  const status = usePlanStatus();
  const plan = useMemo(() => buildPlan([...favorites]), [favorites]);

  const money = (usd: number, gel: number) => (currency === 'usd' ? `$${usd}` : `${gel} GEL`);

  if (!plan) {
    return (
      <div className="screen">
        <header className="header">
          <button className="header-back" onClick={onBack} aria-label="Назад">
            <Icon name="chevron-left" size={20} strokeWidth={2} />
          </button>
          <div className="header-title">{ru ? 'План процедур' : 'Treatment plan'}</div>
          <div style={{ width: 36 }} />
        </header>
        <section className="section">
          <div className="card plan-empty">
            <div className="plan-empty-icon"><Icon name="sparkles" size={30} strokeWidth={1.6} /></div>
            <h2 className="plan-empty-title">{ru ? 'План собирается из избранного' : 'The plan builds from your favourites'}</h2>
            <p className="muted" style={{ fontSize: 14, lineHeight: 1.6 }}>
              {ru
                ? 'Отмечай сердечком процедуры, которые хочешь — я выстрою их в правильном порядке, с интервалами и курсами, и посчитаю сроки и сумму.'
                : 'Heart the treatments you want — I’ll put them in the right order with intervals and courses, and work out the timeline and total.'}
            </p>
            <button className="btn btn-primary btn-block" style={{ marginTop: 18 }} onClick={onCatalog}>
              {ru ? 'Открыть каталог' : 'Open the catalog'}
            </button>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="screen has-cta">
      <header className="header">
        <button className="header-back" onClick={onBack} aria-label="Назад">
          <Icon name="chevron-left" size={20} strokeWidth={2} />
        </button>
        <div className="header-lede">
          <div className="eyebrow">{ru ? 'твой курс' : 'your course'}</div>
          <div className="header-title">{ru ? 'План процедур' : 'Treatment plan'}</div>
        </div>
        <span className={`chip ${status === 'approved' ? 'chip-gold' : ''}`}>
          {status === 'draft' && (ru ? 'черновик' : 'draft')}
          {status === 'sent' && (ru ? 'на согласовании' : 'under review')}
          {status === 'approved' && <><Icon name="check" size={12} strokeWidth={2.6} /> {ru ? 'одобрен' : 'approved'}</>}
        </span>
      </header>

      <section className="plan-summary">
        <div className="plan-summary-cell">
          <span className="v">{plan.steps.length}</span>
          <span className="k">{ru ? 'процедур' : 'treatments'}</span>
        </div>
        <div className="plan-summary-cell">
          <span className="v">{plan.weeks}</span>
          <span className="k">{ru ? 'недель' : 'weeks'}</span>
        </div>
        <div className="plan-summary-cell">
          <span className="v">{money(plan.totalUsd, plan.totalGel)}</span>
          <span className="k">{ru ? 'за курс' : 'total'}</span>
        </div>
      </section>

      <section className="section" style={{ paddingTop: 14 }}>
        <div className="eyebrow" style={{ marginBottom: 10 }}>{ru ? 'порядок и даты' : 'order and dates'}</div>
        <ol className="plan-steps">
          {plan.steps.map((s, i) => {
            // Шаги разных зон могут совпасть по дате — это один визит, а не
            // ошибка расписания; без подписи три одинаковые даты читаются как сбой
            const prev = plan.steps[i - 1];
            const sameDay = prev && prev.date.getTime() === s.date.getTime();
            return (
            <li
              key={`${s.service.id}-${s.session}`}
              className={`plan-step${sameDay ? ' plan-step--same-day' : ''}`}
              style={{ animationDelay: `${Math.min(i, 8) * 45}ms` }}
            >
              <div className="plan-step-date">
                {sameDay ? (
                  <span className="plan-step-same">{ru ? 'в тот же\nвизит' : 'same\nvisit'}</span>
                ) : (
                  <>
                    <span className="d">{s.date.getDate()}</span>
                    <span className="m">{formatMonthShort(s.date, lang)}</span>
                  </>
                )}
              </div>
              <div className="plan-step-line" aria-hidden />
              <div className="plan-step-body">
                <div className="plan-step-title">
                  {sTitle(s.service, lang)}
                  {s.ofSessions > 1 && <span className="plan-step-session">{s.session}/{s.ofSessions}</span>}
                </div>
                <div className="plan-step-sub">{sShort(s.service, lang)}</div>
                <div className="plan-step-meta">
                  <Icon name="clock" size={12} strokeWidth={2} /> {s.service.duration} {t('common.min', lang)}
                  <span>· {money(s.service.priceUsd, s.service.priceGel)}</span>
                  <span className="faint">· {formatLongDate(s.date, lang).toLowerCase()}</span>
                </div>
              </div>
              <button className="plan-step-book" onClick={() => onBook(s.service.id)} aria-label="Записаться">
                <Icon name="calendar" size={16} strokeWidth={1.9} />
              </button>
            </li>
            );
          })}
        </ol>
      </section>

      <section className="section" style={{ paddingTop: 0 }}>
        <div className="eyebrow" style={{ marginBottom: 8 }}>{ru ? 'что важно знать' : 'worth knowing'}</div>
        <ul className="info-list">
          {plan.warnings.map((w) => <li key={w}>{w}</li>)}
        </ul>
      </section>

      <div className="bottom-cta">
        {status === 'draft' && (
          <button
            className="btn btn-primary btn-block"
            data-bottom-cta
            onClick={() => { sendPlanForApproval(); toast(ru ? 'План ушёл Анжелике — ответит после осмотра' : 'Plan sent to Anjelika — she’ll reply after seeing your skin', 'success'); }}
          >
            {ru ? 'Отправить Анжелике на согласование' : 'Send to Anjelika for review'}
          </button>
        )}
        {status === 'sent' && (
          <button className="btn btn-ghost btn-block" data-bottom-cta disabled>
            {ru ? 'Анжелика смотрит план…' : 'Anjelika is reviewing…'}
          </button>
        )}
        {status === 'approved' && (
          <button className="btn btn-primary btn-block" data-bottom-cta onClick={() => onBook(plan.steps[0].service.id)}>
            {ru ? 'План одобрен · записаться на первый шаг' : 'Approved · book the first step'}
          </button>
        )}
      </div>
    </div>
  );
}
