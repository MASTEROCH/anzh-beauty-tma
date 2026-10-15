import { useState } from 'react';
import { byClient, inScope, PERIODS, type PeriodId } from '../lib/analytics';
import { byCurrency, currencyTitle, formatMoney, formatShort, type Visit } from '../lib/studio';

/*
   ВЫРУЧКА ПО КЛИЕНТКАМ.

   Разрез, которого не было ни в одном другом месте. По услугам видно,
   что продаётся; по мастерам — кто работает; а вопрос «на ком салон
   держится» не отвечал никто.

   Салон живёт повторными визитами, и разница между «сто клиенток по
   разу» и «двадцать по пять» видна только здесь. Поэтому в строке не
   только сумма, но и число визитов со средним чеком.

   Неявки показаны рядом с деньгами намеренно: клиентка, приносящая
   много и не приходящая через раз, — не то же самое, что просто
   хорошая клиентка.

   Список — ответ сервера смотрящему: мастер видит своих клиенток и свой
   доход с них, владелица — всю студию.

   Each currency is its own list (owner's decision 06.10, B1-B): a client who
   paid in lari and in dollars appears in both, and her two sums are never added.
*/

export function ClientRevenue({ list }: { list: Visit[] }) {
  const [period, setPeriod] = useState<PeriodId>('90d');

  const scoped = inScope(list, { period, season: 'all' });
  const groups = byCurrency(scoped);

  return (
    <div>
      <div className="studio-sub">
        {PERIODS.map((p) => (
          <button
            key={p.id}
            className={`chip${period === p.id ? ' chip-gold' : ''}`}
            onClick={() => setPeriod(p.id)}
          >
            {p.label}
          </button>
        ))}
      </div>

      {groups.length === 0 && (
        <>
          <div className="row row-between mb-sm">
            <span className="eyebrow">кто приносит · 0</span>
            <span className="cr-total">—</span>
          </div>
          <div className="card empty-card">
            <div className="muted">За этот период выполненных визитов нет</div>
          </div>
        </>
      )}

      {groups.map((g) => (
        <ClientRows
          key={g.currency ?? ''}
          currency={g.currency}
          scoped={g.list}
          all={list}
          titled={groups.length > 1}
        />
      ))}
    </div>
  );
}

function ClientRows({ currency, scoped, all, titled }: {
  currency: string | null;
  scoped: Visit[];
  all: Visit[];
  titled: boolean;
}) {
  // No-shows are counted over ALL of her records, whatever the currency: they are about the person
  const rows = byClient(scoped, all);
  const total = rows.reduce((s, r) => s + r.revenue, 0);

  return (
    <div className="cr-cur" data-currency={currency ?? ''}>
      <div className="row row-between mb-sm">
        <span className="eyebrow">кто приносит{titled ? ` ${currencyTitle(currency)}` : ''} · {rows.length}</span>
        <span className="cr-total">{formatMoney(total, currency)}</span>
      </div>

      <div className="stack-xs">
        {rows.map((r, i) => (
          <div key={r.id} className="cr-row">
            <span className="cr-rank">{i + 1}</span>

            <span className="cr-b">
              <span className="cr-n">
                {r.label}
                {r.noShows > 0 && <span className="chip chip-quiet">{r.noShows} неявк.</span>}
              </span>
              <span className="cr-meta">
                {r.visits} визит{r.visits === 1 ? '' : r.visits < 5 ? 'а' : 'ов'} · средний {formatMoney(r.average, currency)}
                {r.lastVisit && ` · последний ${formatShort(r.lastVisit)}`}
              </span>
              {/* Доля в выручке полоской: список из чисел не показывает,
                  что первые три человека дают половину кассы. */}
              <span className="cr-bar">
                <span className="cr-bar-fill" style={{ width: `${Math.max(2, r.share * 100)}%` }} />
              </span>
            </span>

            <span className="cr-sum">{formatMoney(r.revenue, currency)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
