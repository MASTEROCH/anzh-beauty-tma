import { useState } from 'react';
import { Icon } from './Icon';
import { select } from '../lib/haptics';
import { useLang } from '../lib/i18n';
import { routineFor, ROUTINE_LABEL, type RoutineGroup } from '../data/routines';

// Протокол домашнего ухода из результата разбора.
//
// Короткий список `prods` отвечал «что купить». Этого мало: человек выходит
// из разбора с шестью названиями и не знает, что из этого утром, что вечером
// и почему аптечная полка и профессиональная — разные вещи. За «в каком
// порядке этим пользоваться» он и платил.
//
// Две вкладки, а не один общий список: аптечное и профессиональное решают
// одну задачу разными деньгами, и выбор между ними человек делает ОДИН раз,
// а не перед каждым средством.

export function Routine({ quizId, resultKey }: { quizId: string; resultKey: string }) {
  const lang = useLang();
  const ru = lang === 'ru';
  const groups = routineFor(quizId, resultKey, lang);
  const [tab, setTab] = useState<RoutineGroup['type']>('pharmacy');

  if (!groups || groups.length === 0) return null;

  const active = groups.find((g) => g.type === tab) ?? groups[0];

  return (
    <div className="routine">
      <div className="eyebrow" style={{ margin: '18px 0 8px' }}>
        {ru ? 'домашний уход · протокол' : 'home care · protocol'}
      </div>

      {groups.length > 1 && (
        <div className="routine-tabs" role="tablist">
          {groups.map((g) => (
            <button
              key={g.type}
              role="tab"
              aria-selected={active.type === g.type}
              className={`routine-tab${active.type === g.type ? ' active' : ''}`}
              onClick={() => { select(); setTab(g.type); }}
            >
              {ROUTINE_LABEL[g.type][lang]}
            </button>
          ))}
        </div>
      )}

      {active.sub.map((slot) => (
        <div key={slot.type} className="routine-slot">
          <div className="routine-slot-head">
            <Icon name={slot.type === 'morning' ? 'sun' : 'moon'} size={14} strokeWidth={2} />
            {ROUTINE_LABEL[slot.type][lang]}
            <span className="routine-slot-count">{slot.items.length}</span>
          </div>
          <ol className="routine-steps">
            {slot.items.map((item, i) => (
              <li key={item.n}>
                {/* Номер шага, а не маркер: порядок нанесения — это и есть
                    половина ответа, ради которой разбор покупали */}
                <span className="routine-step-n">{i + 1}</span>
                <span className="routine-step-body">
                  <b>{item.n}</b>
                  <span>{item.d}</span>
                </span>
              </li>
            ))}
          </ol>
        </div>
      ))}

      <p className="routine-note">
        {ru
          ? 'Названия оставлены как на упаковке — так их проще найти в аптеке. Подбор можно уточнить у Анжелики на приёме.'
          : 'Product names are left as printed on the packaging so they are easy to find. Anjelika can refine the picks at your visit.'}
      </p>
    </div>
  );
}
