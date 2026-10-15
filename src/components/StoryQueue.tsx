import { useCallback, useEffect, useState } from 'react';
import { Icon } from './Icon';
import { toast } from '../lib/ui';
import { notify } from '../lib/haptics';
import { openExternal } from '../lib/telegram';
import { getPendingRewards, decideReward, type PendingReward } from '../lib/api/rewards';
import { cabinetDenied } from '../lib/staff';

/* СТОРИС НА ПРОВЕРКУ — единственное действие из «скидок за действия»,
   которое машина засчитать не может: Telegram не сообщает, вышла ли
   сторис. Администратор смотрит ссылку/ник и включает −5 % одним тапом.
   Пустая очередь не рисуется совсем — заявки важнее. */

const when = (iso?: string) => iso ? new Date(iso).toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '';
const linkOf = (proof?: string | null) => {
  const p = (proof ?? '').trim();
  if (/^https?:\/\//i.test(p)) return p;
  if (/^@?[a-z0-9._]{2,30}$/i.test(p)) return `https://instagram.com/${p.replace(/^@/, '')}`;
  return null;
};

export function StoryQueue() {
  const [list, setList] = useState<PendingReward[]>([]);
  const [busy, setBusy] = useState<number | null>(null);
  const load = useCallback(() => { getPendingRewards().then(setList, () => { /* нет ручки — очереди нет */ }); }, []);
  useEffect(load, [load]);

  const decide = async (p: PendingReward, v: 'approve' | 'reject') => {
    setBusy(p.client_id);
    try {
      await decideReward(p.client_id, v);
      setList((l) => l.filter((x) => x.client_id !== p.client_id));
      notify(v === 'approve' ? 'success' : 'warning');
      toast(v === 'approve' ? `${p.name}: скидка −5 % включена` : `${p.name}: сторис не засчитана`, v === 'approve' ? 'success' : undefined);
    } catch (e) {
      cabinetDenied(e); notify('error'); toast('Не сохранилось — проверьте интернет');
    } finally { setBusy(null); }
  };

  if (list.length === 0) return null;
  return (
    <div className="sq mb">
      <div className="eyebrow mb-sm">сторис на проверку · {list.length}</div>
      <div className="stack-tight">
        {list.map((p) => {
          const href = linkOf(p.proof);
          return (
            <article key={p.client_id} className="card sq-item">
              <div className="sq-top">
                <span className="sq-ic"><Icon name="camera" size={17} strokeWidth={1.9} /></span>
                <div className="sq-body">
                  <b>{p.name}</b>
                  <span>{p.proof || 'без ссылки'}{p.sent_at ? ` · ${when(p.sent_at)}` : ''}</span>
                </div>
                {href && <button className="chip" onClick={() => openExternal(href)}>Открыть</button>}
              </div>
              <div className="sq-actions">
                <button className="btn btn-primary" disabled={busy === p.client_id} onClick={() => decide(p, 'approve')}>Засчитать −5 %</button>
                <button className="btn btn-secondary" disabled={busy === p.client_id} onClick={() => decide(p, 'reject')}>Не нашли</button>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
