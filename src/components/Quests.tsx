import { Icon } from './Icon';
import { instagramUrl } from '../data/location';
import { closeSheet, openSheet, toast } from '../lib/ui';
import { notify, tap } from '../lib/haptics';
import { useLang } from '../lib/i18n';
import {
  useQuests, sendForReview, discountActive, discountPercent, remainingPercent,
  doneCount, PER_TASK, MAX_PERCENT, TASK_COUNT,
  type QuestId, type Quests as QuestMap,
} from '../lib/quests';
import { getTgUser, openExternal } from '../lib/telegram';

// Скидка за задание, а не за нажатие.
//
// Три задания намеренно РАЗНОЙ проверяемости, и интерфейс это не прячет:
// человек должен понимать, почему одно засчиталось сразу, а другое ждёт.
// Обещать мгновенную скидку за «поделиться» нельзя — поделиться можно в
// пустоту, и тогда скидку получает тот, кто ничего не сделал.

interface Task {
  id: QuestId;
  icon: 'pencil' | 'send' | 'instagram';
  title: { ru: string; en: string };
  what: { ru: string; en: string };
  /** Почему засчитывается так, а не иначе — это снимает половину вопросов */
  how: { ru: string; en: string };
  cta: { ru: string; en: string };
}

const TASKS: Task[] = [
  {
    id: 'review',
    icon: 'pencil',
    title: { ru: 'Написать отзыв', en: 'Write a review' },
    what: { ru: 'О процедуре, на которой уже была', en: 'About a treatment you have had' },
    how: { ru: 'Засчитается сразу — отзыв виден приложению', en: 'Counts instantly — the app sees it' },
    cta: { ru: 'Написать', en: 'Write' },
  },
  {
    id: 'story',
    icon: 'instagram',
    title: { ru: 'Сторис с отметкой', en: 'A Story with a tag' },
    what: { ru: 'Отметь @dr.domnich — и пришли ссылку', en: 'Tag @dr.domnich — then send the link' },
    how: { ru: 'Сторис проверяет Анжелика — обычно в тот же день', en: 'Anjelika checks it — usually the same day' },
    cta: { ru: 'Отправить на проверку', en: 'Send for review' },
  },
];

/* ── Шильдик на витрине ── */

export function QuestBadge({ onOpen }: { onOpen: () => void }) {
  const ru = useLang() === 'ru';
  const quests = useQuests();
  const done = doneCount(quests);
  const got = discountPercent(quests);
  const left = remainingPercent(quests);
  const active = discountActive(quests);
  const waiting = (Object.keys(quests) as QuestId[]).some((k) => quests[k].state === 'pending');

  return (
    <button className={`quest-badge${active ? ' is-on' : ''}`} onClick={() => { tap(); onOpen(); }}>
      <div className="quest-badge-glow" aria-hidden />
      {/* Орб на подложке: иконка без опоры висела в воздухе рядом с текстом */}
      <span className="quest-badge-orb" aria-hidden>
        {active
          ? <span className="quest-badge-pct">−{got}%</span>
          : <Icon name="gift" size={20} strokeWidth={1.9} />}
      </span>

      <div className="quest-badge-text">
        <strong>
          {active
            ? (ru ? `−${got}% уже твои` : `−${got}% is yours`)
            : (ru ? `До −${MAX_PERCENT}% на все разборы` : `Up to −${MAX_PERCENT}% on every analysis`)}
        </strong>
        <span>
          {active
            ? left > 0
              ? (ru
                  ? `${done} из ${TASK_COUNT} заданий · можно добрать ещё ${left}%`
                  : `${done} of ${TASK_COUNT} tasks · ${left}% more available`)
              : (ru ? 'Все три задания выполнены — максимум скидки' : 'All three tasks done — maximum discount')
            : waiting
              ? (ru ? 'Задание на проверке у Анжелики' : 'Anjelika is checking your task')
              : (ru ? `По ${PER_TASK}% за каждое из ${TASK_COUNT} заданий` : `${PER_TASK}% for each of ${TASK_COUNT} tasks`)}
        </span>
        {/* Полоса прогресса: «сколько осталось» видно, а не считается в уме */}
        <span className="quest-badge-bar" aria-hidden>
          {Array.from({ length: TASK_COUNT }, (_, i) => (
            <i key={i} className={i < done ? 'on' : ''} />
          ))}
        </span>
      </div>
      <Icon name="chevron-right" size={18} strokeWidth={2} />
    </button>
  );
}

/* ── Список заданий ── */

export function QuestList({ onWriteReview }: { onWriteReview: () => void }) {
  const lang = useLang();
  const ru = lang === 'ru';
  const quests = useQuests();
  const active = discountActive(quests);

  const run = (task: Task) => {
    tap();
    if (task.id === 'review') {
      closeSheet();
      setTimeout(onWriteReview, 220);
      return;
    }

    /* Задание «позвать подругу» убрано вместе со скидкой за него.
       Отдельно стоит отметить, ПОЧЕМУ его нельзя было просто оставить:
       ссылка-приглашение собиралась здесь, на клиенте, из telegram_id
       (`?start=ref<id>`). Контракт бэкенда §4.2 и §4.3 это запрещают —
       числовой идентификатор в ссылке утекает получателю, и отозвать
       это нельзя. Приглашения теперь целиком на стороне сервера. */

    // Сторис: открываем инстаграм и ставим в очередь на подтверждение
    openExternal(instagramUrl());
    sendForReview('story');
    notify('success');
    toast(ru ? 'Отправлено Анжелике на проверку' : 'Sent to Anjelika for review', 'success');
  };

  return (
    <div className="quest-list">
      <div className={`quest-meter${active ? ' is-on' : ''}`}>
        <div className="quest-meter-head">
          <span className="quest-meter-now">−{discountPercent(quests)}%</span>
          <span className="quest-meter-of">
            {ru ? `из ${MAX_PERCENT}% · ${doneCount(quests)} из ${TASK_COUNT} заданий` : `of ${MAX_PERCENT}% · ${doneCount(quests)} of ${TASK_COUNT} tasks`}
          </span>
        </div>
        <div className="quest-meter-bar" aria-hidden>
          {Array.from({ length: TASK_COUNT }, (_, i) => (
            <i key={i} className={i < doneCount(quests) ? 'on' : ''} />
          ))}
        </div>
        <div className="quest-meter-note">
          {remainingPercent(quests) > 0
            ? (ru ? `Ещё ${remainingPercent(quests)}% можно добрать — по ${PER_TASK}% за задание` : `${remainingPercent(quests)}% more to earn — ${PER_TASK}% per task`)
            : (ru ? 'Максимум набран — скидка остаётся навсегда' : 'Maxed out — the discount is permanent')}
        </div>
      </div>

      {TASKS.map((task, i) => {
        const rec = quests[task.id];
        return (
          <div
            key={task.id}
            className={`quest-row quest-${rec.state}`}
            style={{ animationDelay: `${60 + i * 70}ms` }}
          >
            <div className="quest-row-head">
            <span className="quest-row-orb" aria-hidden>
              <Icon
                name={rec.state === 'done' ? 'check' : task.icon === 'instagram' ? 'share' : task.icon}
                size={17}
                strokeWidth={rec.state === 'done' ? 2.8 : 1.9}
              />
            </span>
            <div className="quest-row-body">
              <div className="quest-row-title">{task.title[lang]}</div>
              <div className="quest-row-what">{task.what[lang]}</div>
              <div className="quest-row-how">
                {rec.state === 'pending'
                  ? (ru ? 'На проверке у Анжелики' : 'Anjelika is checking it')
                  : task.how[lang]}
              </div>
            </div>
            <span className="quest-row-gain">+{PER_TASK}%</span>
            </div>

            {/* Кнопка всегда внизу и всегда во всю ширину: три карточки с
                кнопками разной длины в разных местах читались как три разных
                интерфейса. Одинаковая мишень — одинаковое усилие. */}
            {rec.state === 'done' ? (
              <div className="quest-row-foot state done">
                <Icon name="check" size={15} strokeWidth={2.8} />
                {ru ? 'Засчитано · +' : 'Counted · +'}{PER_TASK}%
              </div>
            ) : rec.state === 'pending' ? (
              <div className="quest-row-foot state pending">
                <Icon name="clock" size={15} strokeWidth={2.2} />
                {ru ? 'Ждём подтверждения' : 'Awaiting confirmation'}
              </div>
            ) : (
              <button className="btn btn-primary btn-block quest-row-foot" onClick={() => run(task)}>
                {task.cta[lang]}
              </button>
            )}
          </div>
        );
      })}

      <p className="quest-note">
        {ru
          ? 'Скидка остаётся навсегда и складывается с набором из шести разборов.'
          : 'The discount is permanent and stacks with the six-analysis bundle.'}
      </p>
    </div>
  );
}

export function openQuests(onWriteReview: () => void, ru: boolean) {
  openSheet({
    title: ru ? `Задания на скидку` : 'Tasks for a discount',
    subtitle: ru ? `По ${PER_TASK}% за каждое · до −${MAX_PERCENT}%` : `${PER_TASK}% each · up to −${MAX_PERCENT}%`,
    body: <QuestList onWriteReview={onWriteReview} />,
  });
}

export type { QuestMap };
