import { Icon } from './Icon';
import { toast } from '../lib/ui';
import { notify, tap } from '../lib/haptics';
import { useQuests, completeQuest, rejectQuest, pendingQuests, PER_TASK, type QuestId } from '../lib/quests';

// Очередь проверки заданий в кабинете.
//
// Механика заданий устроена честно: сторис автоматически не проверить
// НИКАК, поэтому она уходит человеку. Но до этого экрана «уходит человеку»
// было обещанием в пустоту — подтверждать оказалось негде, и задание висело
// бы в «ждём» вечно. Незакрытая петля хуже её отсутствия: клиентка сделала
// то, что просили, и ничего не получила.
//
// Отклонение возвращает задание в исходное, а не блокирует: человек мог
// прислать не ту ссылку, и запрещать вторую попытку не за что.

const TITLES: Record<QuestId, { title: string; what: string }> = {
  review: { title: 'Отзыв', what: 'засчитывается приложением' },
  invite: { title: 'Приглашение подруги', what: 'ждём, когда она откроет приложение' },
  story: { title: 'Сторис с отметкой', what: 'проверь, что отметка стоит' },
};

function ago(ts: number): string {
  const h = Math.floor((Date.now() - ts) / 3_600_000);
  if (h < 1) return 'только что';
  if (h < 24) return `${h} ч назад`;
  const d = Math.floor(h / 24);
  return `${d} ${d === 1 ? 'день' : d < 5 ? 'дня' : 'дней'} назад`;
}

export function QuestQueue() {
  const quests = useQuests();
  const queue = pendingQuests(quests).filter((q) => q.id !== 'invite');

  // Приглашение проверяет сервер по переходу, а не человек глазами —
  // показывать его мастеру значит просить подтвердить то, чего он не видит
  if (queue.length === 0) return null;

  return (
    <div className="qq">
      <div className="eyebrow" style={{ marginBottom: 8 }}>
        задания на проверку · {queue.length}
      </div>
      {queue.map((q) => (
        <div key={q.id} className="qq-row">
          <div className="qq-body">
            <div className="qq-title">{TITLES[q.id].title}</div>
            <div className="qq-what">{TITLES[q.id].what} · {ago(q.sentAt)}</div>
            {q.proof && <div className="qq-proof">{q.proof}</div>}
          </div>
          <div className="qq-actions">
            <button
              className="qq-yes"
              aria-label="Засчитать"
              onClick={() => {
                tap('medium');
                completeQuest(q.id);
                notify('success');
                toast(`Засчитано · клиентке +${PER_TASK}% скидки`, 'success');
              }}
            >
              <Icon name="check" size={15} strokeWidth={3} />
            </button>
            <button
              className="qq-no"
              aria-label="Вернуть на доработку"
              onClick={() => {
                tap();
                rejectQuest(q.id);
                toast('Задание вернулось клиентке — можно прислать заново');
              }}
            >
              <Icon name="x" size={15} strokeWidth={2.6} />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
