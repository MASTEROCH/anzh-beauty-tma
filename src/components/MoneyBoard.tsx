import { useMemo, useState } from 'react';
import { Icon } from './Icon';
import { visits, people } from '../lib/plural';
import { select } from '../lib/haptics';
import { byCurrency, currencyTitle, formatMoney, type Visit } from '../lib/studio';
import {
  PERIODS, SEASONS, inScope, totals, byService, byStaff, previousYear, revenueOf,
  type Filter,
} from '../lib/analytics';

// Дашборд выручки. Два фильтра, а не один: период отвечает «за сколько»,
// сезон — «за какую часть года». Вместе они дают единственное честное
// сравнение в этом деле: лето к лету, а не июль к декабрю.
//
// Мастеру показываем ТОЛЬКО его цифры: список — ответ сервера смотрящему
// (мастеру GET /staff/bookings отдаёт только его записи, `scope=all` фронт
// просит лишь у владелицы). Разрез «по мастерам» — только владелице.
// Деньги — минорные единицы, в строку их переводит formatMoney.
//
// Each currency is its own board (owner's decision 06.10, B1-B: no conversion):
// lari and dollars are never added, averaged or compared with each other. One
// currency — one board, exactly as before; the heading appears only with two or more.

export function MoneyBoard({ list, showStaff }: { list: Visit[]; showStaff: boolean }) {
  const [f, setF] = useState<Filter>({ period: '30d', season: 'all' });

  const scope = useMemo(() => inScope(list, f), [list, f]);
  const lastYear = useMemo(() => previousYear(list, f), [list, f]);
  const groups = useMemo(() => byCurrency(scope), [scope]);

  return (
    <div className="mb">
      <div className="mb-filters">
        <div className="mb-row" role="tablist" aria-label="Период">
          {PERIODS.map((p) => (
            <button
              key={p.id}
              role="tab"
              aria-selected={f.period === p.id}
              className={`mb-chip${f.period === p.id ? ' active' : ''}`}
              onClick={() => { select(); setF((x) => ({ ...x, period: p.id })); }}
            >
              {p.label}
            </button>
          ))}
        </div>
        <div className="mb-row" role="tablist" aria-label="Сезон">
          {SEASONS.map((s) => (
            <button
              key={s.id}
              role="tab"
              aria-selected={f.season === s.id}
              className={`mb-chip season${f.season === s.id ? ' active' : ''}`}
              onClick={() => { select(); setF((x) => ({ ...x, season: s.id })); }}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {groups.length === 0 ? (
        <div className="card empty-state">
          <div className="empty-icon"><Icon name="calendar" size={26} strokeWidth={1.7} /></div>
          <div className="empty-title">В этом срезе визитов нет</div>
          <div className="empty-sub">
            {f.season === 'all'
              ? 'Смени период — или закрой первый визит во вкладке «День».'
              : 'В этом сезоне закрытых визитов пока не было. Попробуй «Весь год».'}
          </div>
        </div>
      ) : (
        groups.map((g) => (
          <CurrencyBoard
            key={g.currency ?? ''}
            currency={g.currency}
            scope={g.list}
            lastYear={lastYear.filter((v) => v.currency === g.currency)}
            showStaff={showStaff}
            titled={groups.length > 1}
          />
        ))
      )}
    </div>
  );
}

function CurrencyBoard({ currency, scope, lastYear, showStaff, titled }: {
  currency: string | null;
  scope: Visit[];
  lastYear: Visit[];
  showStaff: boolean;
  titled: boolean;
}) {
  const t = useMemo(() => totals(scope), [scope]);
  const services = useMemo(() => byService(scope), [scope]);
  const staff = useMemo(() => byStaff(scope), [scope]);

  const prev = revenueOf(lastYear);
  const delta = prev > 0 ? Math.round(((t.revenue - prev) / prev) * 100) : null;

  return (
    <div className="mb-cur" data-currency={currency ?? ''}>
      {titled && <div className="eyebrow mb-eyebrow">выручка {currencyTitle(currency)}</div>}
      <div className="mb-hero">
        <div className="mb-hero-sum">{formatMoney(t.revenue, currency)}</div>
        <div className="mb-hero-sub">
          {visits(t.visits)} · {people(t.clients)} · средний чек {formatMoney(t.average, currency)}
        </div>
        {/* Сравнение с тем же куском прошлого года. Нет данных — молчим,
            а не рисуем «+100%» от нуля */}
        {delta !== null && (
          <div className={`mb-delta${delta >= 0 ? ' up' : ' down'}`}>
            <Icon name={delta >= 0 ? 'chevron-right' : 'chevron-right'} size={12} strokeWidth={3} />
            {delta >= 0 ? '+' : ''}{delta}% к тому же периоду год назад ({formatMoney(prev, currency)})
          </div>
        )}
      </div>

      <div className="eyebrow mb-eyebrow">по процедурам</div>
      <div className="mb-bars">
        {services.map((r) => (
          <div key={r.id} className="mb-bar">
            <div className="mb-bar-head">
              <span className="mb-bar-label">{r.label}</span>
              <span className="mb-bar-sum">{formatMoney(r.revenue, currency)}</span>
            </div>
            <div className="mb-bar-track">
              <i style={{ width: `${Math.max(3, r.share * 100)}%` }} />
            </div>
            <div className="mb-bar-foot">{visits(r.visits)} · {Math.round(r.share * 100)}%</div>
          </div>
        ))}
      </div>

      {showStaff && staff.length > 0 && (
        <>
          <div className="eyebrow mb-eyebrow">по мастерам</div>
          <div className="mb-bars">
            {staff.map((r) => (
              <div key={r.id} className="mb-bar">
                <div className="mb-bar-head">
                  <span className="mb-bar-label">{r.label}</span>
                  <span className="mb-bar-sum">{formatMoney(r.revenue, currency)}</span>
                </div>
                <div className="mb-bar-track">
                  <i className="staff" style={{ width: `${Math.max(3, r.share * 100)}%` }} />
                </div>
                <div className="mb-bar-foot">{visits(r.visits)} · {Math.round(r.share * 100)}%</div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
