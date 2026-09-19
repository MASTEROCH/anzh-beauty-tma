import { Icon } from './Icon';
import { openSheet } from '../lib/ui';
import { formatShort } from '../lib/appointments';
import type { ClientCard } from '../lib/clientCard';

// Карта клиента в кабинете мастера.
//
// В заявке важны ровно четыре вопроса, и они читаются сверху вниз:
//   1. Была ли раньше и сколько раз  — от этого зависит тон разговора
//   2. Что нельзя                     — от этого зависит, можно ли вообще
//   3. Что уже делала                 — от этого зависит, что предложить
//   4. Что показал разбор             — если проходила
//
// Противопоказания стоят ВЫШЕ истории намеренно: пропустить их дороже, чем
// не вспомнить прошлый визит.

/** 1 раз · 2 раза · 5 раз — без этого метка спотыкается на каждом числе */
function plural(n: number): string {
  const d = n % 10, h = n % 100;
  if (d === 1 && h !== 11) return 'раз';
  if (d >= 2 && d <= 4 && (h < 12 || h > 14)) return 'раза';
  return 'раз';
}

export function ClientStrip({ card }: { card: ClientCard }) {
  const stop = card.flags.filter((f) => f.level === 'stop').length;
  const check = card.flags.filter((f) => f.level === 'check').length;

  return (
    <button className="cc-strip" onClick={() => openClientCard(card)}>
      <span className={`cc-badge${card.returning ? ' returning' : ' first'}`}>
        {/* «1-й визит» читалось как «пришла впервые», хотя визит уже был.
            Говорим о прошлом прямо: сколько раз доходила до процедуры. */}
        {card.returning ? `была ${card.visits} ${plural(card.visits)}` : 'впервые'}
      </span>
      {card.noShows > 0 && (
        <span className="cc-badge warn">{card.noShows} не пришла</span>
      )}
      {stop > 0 && <span className="cc-badge stop"><Icon name="warning" size={12} strokeWidth={2.4} />{stop}</span>}
      {stop === 0 && check > 0 && <span className="cc-badge check">уточнить · {check}</span>}
      {card.quizzes.length > 0 && <span className="cc-badge quiz">разборов: {card.quizzes.length}</span>}
      <Icon name="chevron-right" size={15} strokeWidth={2.2} className="cc-strip-go" />
    </button>
  );
}

export function openClientCard(card: ClientCard) {
  openSheet({
    title: card.name,
    subtitle: [
      card.handle ? `@${card.handle}` : null,
      card.returning ? `была ${card.visits} ${plural(card.visits)}` : 'первый визит',
      card.spentUsd > 0 ? `$${card.spentUsd}` : null,
    ].filter(Boolean).join(' · '),
    body: <ClientCardBody card={card} />,
  });
}

function ClientCardBody({ card }: { card: ClientCard }) {
  const p = card.passport;
  return (
    <div className="cc">
      {/* 1. Противопоказания — первыми, до всего остального */}
      {card.flags.length > 0 ? (
        <div className="cc-flags">
          {card.flags.map((f) => (
            <div key={f.from} className={`cc-flag ${f.level}`}>
              <Icon name={f.level === 'stop' ? 'warning' : 'info'} size={15} strokeWidth={2.2} />
              <div>
                <div className="cc-flag-from">{f.from}</div>
                <div className="cc-flag-match">
                  {f.level === 'stop' ? 'противопоказание процедуры: ' : 'сверить: '}{f.matches}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="cc-ok">
          <Icon name="shield-check" size={15} strokeWidth={2} />
          {p ? 'С анкетой процедура не конфликтует' : 'Анкета не заполнена — спросить на приёме'}
        </div>
      )}

      {/* 2. Анкета */}
      {p && (
        <>
          <div className="eyebrow cc-eyebrow">анкета</div>
          <div className="cc-grid">
            <div className="cc-cell"><span>Тип кожи</span><b>{p.skinType || '—'}</b></div>
            <div className="cc-cell"><span>Чувствит.</span><b>{p.sensitivity === 'high' ? 'высокая' : p.sensitivity === 'low' ? 'низкая' : 'средняя'}</b></div>
            <div className="cc-cell"><span>Фототип</span><b>{p.fitzpatrick || '—'}</b></div>
            <div className="cc-cell"><span>Купероз</span><b>{p.couperose ? 'есть' : 'нет'}</b></div>
          </div>
          {p.goal && <div className="cc-line"><span>Запрос</span><b>{p.goal}</b></div>}
          {p.notes && <div className="cc-line"><span>Пометки</span><b>{p.notes}</b></div>}
        </>
      )}

      {/* 3. Что уже делала */}
      <div className="eyebrow cc-eyebrow">что уже делала</div>
      {card.history.length === 0 ? (
        <div className="cc-empty">Процедур ещё не было — это первый визит</div>
      ) : (
        <ul className="cc-history">
          {card.history.map((h, i) => (
            <li key={`${h.dateISO}-${i}`}>
              <span className="cc-history-date">{formatShort(h.dateISO)}</span>
              <span className="cc-history-title">{h.title}</span>
              {h.amount != null && <span className="cc-history-sum">${h.amount}</span>}
            </li>
          ))}
        </ul>
      )}

      {/* 4. Разборы */}
      {card.quizzes.length > 0 && (
        <>
          <div className="eyebrow cc-eyebrow">разборы ANZH</div>
          <ul className="cc-quizzes">
            {card.quizzes.map((q) => (
              <li key={q.quizId}>
                <div>
                  <div className="cc-quiz-title">{q.title}</div>
                  <div className="cc-quiz-sub">{q.quizTitle} · {new Date(q.takenAt).toLocaleDateString('ru-RU')}</div>
                </div>
                {q.secondary && q.secondary.length > 0 && (
                  <span className="cc-quiz-extra">+{q.secondary.length}</span>
                )}
              </li>
            ))}
          </ul>
        </>
      )}

      {card.noShows > 0 && (
        <div className="cc-noshow">
          <Icon name="warning" size={14} strokeWidth={2.2} />
          Не пришла {card.noShows} {plural(card.noShows)} — стоит подтвердить накануне
        </div>
      )}
    </div>
  );
}
