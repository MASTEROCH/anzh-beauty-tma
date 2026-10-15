import { useMemo } from 'react';
import { Icon } from '../components/Icon';
import { toast } from '../lib/ui';
import { sTitle, sShort } from '../data/services';
import { useLang, t } from '../lib/i18n';
import { buildPlan, courseNotes, planMessage } from '../lib/plan';
import { formatLongDate, formatMonthShort } from '../lib/appointments';
import { useCatalog } from '../lib/catalog';
import { displayPrice, servicePrice } from '../lib/money';
import { usePriceMode } from '../lib/priceMode';
import { useRate } from '../lib/rates';
import { telegramUrl } from '../data/location';
import { openTelegram } from '../lib/telegram';

export function PlanScreen({
  favorites,
  onBack,
  onBook,
  onCatalog,
}: {
  favorites: Set<string>;
  onBack: () => void;
  onBook: (id: string) => void;
  onCatalog: () => void;
}) {
  const lang = useLang();
  const priceMode = usePriceMode(); // перерисовка при смене валюты показа
  useRate();
  const ru = lang === 'ru';
  // Каталог с сервера: цены плана — те, что на витрине (а не из бандла).
  const { live } = useCatalog();
  // Only favorites on the showcase (K13, F2): the catalog's "Saved: N" counts the same set
  const plan = useMemo(() => {
    const liveIds = new Set(live.map((s) => s.id));
    return buildPlan([...favorites].filter((id) => liveIds.has(id)));
  }, [favorites, live]);

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
              {/* K14 (Censor R1): no promise of "the right order, intervals and courses" — the
                  gaps are a rough draft and the clinic gave no course numbers (lib/plan.ts) */}
              {ru
                ? 'Отмечай сердечком процедуры в каталоге — план покажет их по порядку.'
                : 'Heart treatments in the catalog — the plan will show them in order.'}
            </p>
            <button className="btn btn-primary btn-block mt-md" onClick={onCatalog}>
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
        <span className="chip">{ru ? 'черновик' : 'draft'}</span>
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
          {/* Prices in their own currency (B1-B); no single currency — no sum, a dash */}
          <span className="v" data-testid="plan-total">{(plan.total && displayPrice(plan.total, lang)) ?? '—'}</span>
          <span className="k">{ru ? 'итого' : 'total'}</span>
        </div>
      </section>
      {/* K14 (Hater H-9): the total counts a course procedure as one session — said under it */}
      {courseNotes(plan, lang).map((note) => (
        <p key={note} className="faint" data-testid="plan-course-note" style={{ fontSize: 12, lineHeight: 1.5, margin: '8px 20px 0' }}>
          {note}
        </p>
      ))}

      <section className="section" style={{ paddingTop: 14 }}>
        <div className="eyebrow mb-sm">{ru ? 'порядок и даты' : 'order and dates'}</div>
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
                  {s.service.duration != null && <><Icon name="clock" size={12} strokeWidth={2} /> {s.service.duration} {t('common.min', lang)}</>}
                  {servicePrice(s.service, lang) !== null && <span data-testid="plan-step-price">· {servicePrice(s.service, lang)}</span>}
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

      <section className="section section-tight">
        <div className="eyebrow mb-sm">{ru ? 'что важно знать' : 'worth knowing'}</div>
        <ul className="info-list">
          {plan.warnings.map((w) => <li key={w}>{w}</li>)}
        </ul>
      </section>

      <div className="bottom-cta">
        <button
          className="btn btn-primary btn-block"
          data-bottom-cta
          data-testid="plan-message"
          onClick={() => {
            openTelegram(telegramUrl(planMessage(plan, lang)));
            toast(ru ? 'Открываю чат с Анжеликой — план уже в сообщении' : 'Opening the chat with Anjelika — the plan is in the message', 'success');
          }}
        >
          <Icon name="message" size={16} strokeWidth={1.9} /> {ru ? 'Написать Анжелике' : 'Message Anjelika'}
        </button>
      </div>
    </div>
  );
}
