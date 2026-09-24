import { useState } from 'react';
import { byClient, inScope, PERIODS, type PeriodId } from '../lib/analytics';
import type { Appointment } from '../lib/appointments';

/*
   ВЫРУЧКА ПО КЛИЕНТКАМ.

   Разрез, которого не было ни в одном другом месте. По услугам видно,
   что продаётся; по мастерам — кто работает; а вопрос «на ком салон
   держится» не отвечал никто.

   Салон живёт повторными визитами, и разница между «сто клиенток по
   разу» и «двадцать по пять» видна только здесь. Поэтому в строке не
   только сумма, но и число визитов со средним чеком: сто долларов за
   один визит и сто за пять — это два разных человека, и работать с
   ними надо по-разному.

   Неявки показаны рядом с деньгами намеренно. Клиентка, приносящая
   много и не приходящая через раз, — не то же самое, что просто
   хорошая клиентка, и решение по её следующей заявке другое.
*/

export function ClientRevenue({ list, all }: { list: Appointment[]; all: Appointment[] }) {
  const [period, setPeriod] = useState<PeriodId>('90d');

  const scoped = inScope(list, { period, season: 'all' }).filter((a) => a.status === 'completed');
  const rows = byClient(scoped, all);
  const total = rows.reduce((s, r) => s + r.revenue, 0);

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

      <div className="row row-between mb-sm">
        <span className="eyebrow">кто приносит · {rows.length}</span>
        <span className="cr-total">${total.toLocaleString('ru-RU')}</span>
      </div>

      {rows.length === 0 && (
        <div className="card empty-card">
          <div className="muted">За этот период выполненных визитов нет</div>
        </div>
      )}

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
                {r.visits} визит{r.visits === 1 ? '' : r.visits < 5 ? 'а' : 'ов'} · средний ${r.average}
                {r.lastVisit && ` · последний ${r.lastVisit.slice(5).replace('-', '.')}`}
              </span>
              {/* Доля в выручке полоской: список из чисел не показывает,
                  что первые три человека дают половину кассы. */}
              <span className="cr-bar">
                <span className="cr-bar-fill" style={{ width: `${Math.max(2, r.share * 100)}%` }} />
              </span>
            </span>

            <span className="cr-sum">${r.revenue.toLocaleString('ru-RU')}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
