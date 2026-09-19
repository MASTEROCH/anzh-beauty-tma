import { useState } from 'react';
import { Icon } from './Icon';
import { closeSheet, toast } from '../lib/ui';
import { notify, tap } from '../lib/haptics';
import { signIn, useTeam } from '../lib/staff';

// Вход в кабинет. PIN теперь не один на всех: он определяет, КТО вошёл, —
// у Анжелики свой, у каждого мастера свой. От этого зависит, что человек
// увидит внутри: владелица видит деньги салона целиком, мастер — только
// свой день и свой заработок.
//
// ⚠️ Прототип: коды лежат на клиенте. На бою вход — это проверка
// Telegram-ID на сервере, и подсказки с кодами здесь не будет.

export function PinGate({ onUnlock }: { onUnlock: () => void }) {
  const team = useTeam();
  const [pin, setPin] = useState('');
  const [shake, setShake] = useState(false);

  const push = (d: string) => {
    if (pin.length >= 4) return;
    tap();
    const next = pin + d;
    setPin(next);
    if (next.length < 4) return;

    const person = signIn(next);
    if (person) {
      notify('success');
      setTimeout(() => {
        closeSheet();
        onUnlock();
        toast(
          person.role === 'owner'
            ? `${person.name} — полный доступ`
            : `${person.name} — свой день и свои записи`,
          'success',
        );
      }, 180);
      return;
    }

    notify('error');
    setShake(true);
    setTimeout(() => { setPin(''); setShake(false); toast('Неверный код'); }, 400);
  };

  return (
    <div>
      <p className="muted" style={{ fontSize: 13 }}>
        Расписание, заявки, база клиентов и выручка. Клиенты сюда не заходят.
      </p>

      <div className={`pin-dots${shake ? ' shake' : ''}`}>
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className={`pin-dot ${i < pin.length ? 'on' : ''}`} />
        ))}
      </div>

      <div className="pin-pad">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
          <button key={d} className="pin-key" onClick={() => push(d)}>{d}</button>
        ))}
        <button className="pin-key wide" onClick={() => setPin('')}>сброс</button>
        <button className="pin-key" onClick={() => push('0')}>0</button>
        <button className="pin-key wide" onClick={() => setPin((p) => p.slice(0, -1))}>
          <Icon name="chevron-left" size={18} strokeWidth={2.2} />
        </button>
      </div>

      {/* Демо-коды: видно, что вход разный у разных людей — без этого
          проверить разграничение доступа в прототипе нечем */}
      <div className="pin-demo">
        {team.filter((s) => s.active).map((s) => (
          <span key={s.id}>
            <b>{s.pin}</b> {s.name} · {s.role === 'owner' ? 'владелица' : 'мастер'}
          </span>
        ))}
      </div>
    </div>
  );
}
