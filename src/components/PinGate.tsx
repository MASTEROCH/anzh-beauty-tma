import { useState } from 'react';
import { Icon } from './Icon';
import { closeSheet, toast } from '../lib/ui';
import { notify, tap } from '../lib/haptics';
import { hasDefaultPin, signInAs, useTeam, type Staff } from '../lib/staff';
import { asset } from '../lib/asset';

/*
   ВХОД В КАБИНЕТ — В ДВА ШАГА: КТО ТЫ, ПОТОМ КОД.

   Раньше был сразу набор кода, и он искался по ВСЕЙ команде: человек,
   набравший чужой код, входил под чужим именем и не замечал этого.
   Вход — это не «угадай пароль», а «я вот этот человек, вот моё
   подтверждение».

   Второй выигрыш — подсказка. Она больше не общий список кодов на
   экране, а строка под конкретным человеком, и показывается ТОЛЬКО
   пока код заводской. Владелица назначила сотруднику свой — подсказка
   исчезла сама. Это механика, а не надпись «демо», которая переживает
   все переделки и всплывает у клиента.
*/

export function PinGate({ onUnlock }: { onUnlock: () => void }) {
  const team = useTeam().filter((s) => s.active);
  const [who, setWho] = useState<Staff | null>(null);
  const [pin, setPin] = useState('');
  const [shake, setShake] = useState(false);

  const pick = (person: Staff) => {
    tap();
    setWho(person);
    setPin('');
  };

  const back = () => {
    tap();
    setWho(null);
    setPin('');
  };

  const push = (d: string) => {
    if (!who || pin.length >= 4) return;
    tap();
    const next = pin + d;
    setPin(next);
    if (next.length < 4) return;

    const person = signInAs(who.id, next);
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

  /* ── Шаг 1: кто ты ── */
  if (!who) {
    return (
      <div>
        <p className="muted mb-md" style={{ fontSize: 13 }}>
          Расписание, заявки, база клиентов и выручка. Клиенты сюда не заходят.
        </p>

        <div className="gate-people">
          {/* Человек без кода показан, но не нажимается: только что
              заведённый сотрудник не должен выглядеть рабочим входом, а
              исчезать из списка ему тоже нельзя — владелица не поймёт,
              добавился он или нет. */}
          {team.map((s) => (
            <button
              key={s.id}
              className={`gate-person${s.pin ? '' : ' locked'}`}
              disabled={!s.pin}
              onClick={() => pick(s)}
            >
              <span className="gate-person-ph" style={{ background: s.colour }}>
                {s.photo
                  ? <img src={asset(s.photo)} alt="" aria-hidden />
                  : <span className="gate-person-ini">{s.name.slice(0, 1)}</span>}
              </span>
              <span className="gate-person-b">
                <span className="gate-person-n">{s.name}</span>
                <span className="gate-person-r">
                  {s.title ?? (s.role === 'owner' ? 'владелица' : 'мастер')}
                </span>
              </span>
              {!s.pin
                ? <span className="chip chip-quiet">код не назначен</span>
                : s.role === 'owner' && <span className="chip chip-gold">полный доступ</span>}
              <Icon name="chevron-right" size={18} strokeWidth={2} />
            </button>
          ))}
        </div>
      </div>
    );
  }

  /* ── Шаг 2: код выбранного человека ── */
  return (
    <div>
      <button className="gate-back row" onClick={back}>
        <Icon name="chevron-left" size={16} strokeWidth={2.2} />
        <span>{who.name} · сменить</span>
      </button>

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

      {hasDefaultPin(who) && (
        <p className="gate-hint">
          Код ещё заводской: <b>{who.pin}</b>. Назначьте свой в разделе «Команда» —
          эта подсказка исчезнет.
        </p>
      )}
    </div>
  );
}
