import { useState } from 'react';
import { Icon } from './Icon';
import { closeSheet, openSheet, toast } from '../lib/ui';
import { notify, select } from '../lib/haptics';
import { liveServices } from '../lib/catalog';
import {
  useTeam, addStaff, updateStaff, deactivateStaff, activateStaff, OWNER_ID, type Staff,
} from '../lib/staff';

// Команда кабинета. У Анжелики работает ещё два-три человека на своих
// процедурах, и каждому нужен свой вход: мастер видит свой день и свой
// заработок, но не кассу салона и не чужие записи.
//
// Мастера НЕ удаляются, а выключаются: на человеке висит история визитов и
// выручка за прошлые месяцы. Удалить его — значит обнулить отчёт задним
// числом, тот же закон, что и у процедур в каталоге.
//
// Владелицу нельзя ни выключить, ни лишить прав: кабинет без владельца —
// это кабинет, в который некому войти.

const COLOURS = ['#12C088', '#C9A52F', '#35E4A6', '#2F767A', '#F5C842'];

export function TeamEditor() {
  const team = useTeam();

  return (
    <div className="te">
      <div className="studio-price-head">
        <div className="eyebrow">команда · {team.filter((s) => s.active).length}</div>
        <button className="chip chip-gold" onClick={() => openStaffForm()}>
          <Icon name="plus" size={13} strokeWidth={2.6} /> мастер
        </button>
      </div>

      <div className="col" style={{ gap: 8 }}>
        {team.map((p) => (
          <div key={p.id} className={`te-row${p.active ? '' : ' off'}`}>
            <span className="te-dot" style={{ background: p.colour }} aria-hidden />
            <div className="te-body">
              <div className="te-name">
                {p.name}
                {p.role === 'owner' && <span className="te-role">владелица</span>}
              </div>
              <div className="te-what">
                {p.role === 'owner'
                  ? 'все процедуры · полный доступ'
                  : p.serviceIds.length === 0
                    ? 'процедуры не назначены — записи не придут'
                    : p.serviceIds
                        .map((id) => liveServices().find((s) => s.id === id)?.title ?? id)
                        .join(' · ')}
              </div>
            </div>
            <button
              className="te-edit"
              aria-label={`Настроить: ${p.name}`}
              onClick={() => openStaffForm(p)}
            >
              <Icon name="pencil" size={14} strokeWidth={2} />
            </button>
          </div>
        ))}
      </div>

      <p className="faint" style={{ fontSize: 11, marginTop: 10, lineHeight: 1.5 }}>
        У каждого мастера свой код входа. Выключённый мастер не видит кабинет,
        но его прошлые визиты остаются в отчётах.
      </p>
    </div>
  );
}

function openStaffForm(person?: Staff) {
  openSheet({
    title: person ? person.name : 'Новый мастер',
    subtitle: person ? 'Что ведёт и как входит' : 'Свой код входа и свои процедуры',
    body: <StaffForm person={person} />,
  });
}

function StaffForm({ person }: { person?: Staff }) {
  const [name, setName] = useState(person?.name ?? '');
  const [pin, setPin] = useState(person?.pin ?? '');
  const [ids, setIds] = useState<string[]>(person?.serviceIds ?? []);
  const isOwner = person?.id === OWNER_ID;
  const ready = name.trim().length > 1 && /^\d{4}$/.test(pin);

  const toggle = (id: string) => {
    select();
    setIds((x) => (x.includes(id) ? x.filter((i) => i !== id) : [...x, id]));
  };

  const save = () => {
    if (!ready) return;
    if (person) updateStaff(person.id, { name: name.trim(), pin, serviceIds: ids });
    else addStaff({ name: name.trim(), pin, role: 'master', serviceIds: ids, colour: COLOURS[Math.floor(Math.random() * COLOURS.length)] });
    notify('success');
    closeSheet();
    toast(person ? 'Сохранено' : `${name.trim()} — в команде`, 'success');
  };

  return (
    <div className="se">
      <label className="se-field">
        <span>Имя</span>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Марина" />
      </label>

      <label className="se-field">
        <span>Код входа · 4 цифры</span>
        <input
          value={pin}
          inputMode="numeric"
          maxLength={4}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
          placeholder="1111"
        />
      </label>

      {isOwner ? (
        <div className="te-note">
          <Icon name="shield-check" size={14} strokeWidth={2} />
          Владелица ведёт все процедуры и видит кабинет целиком — это не меняется.
        </div>
      ) : (
        <div className="se-field">
          <span>Что ведёт</span>
          <div className="se-cats">
            {liveServices().map((s) => (
              <button
                key={s.id}
                className={`se-cat${ids.includes(s.id) ? ' active' : ''}`}
                onClick={() => toggle(s.id)}
              >
                {ids.includes(s.id) && <Icon name="check" size={12} strokeWidth={3} />}
                {s.title}
              </button>
            ))}
          </div>
        </div>
      )}

      <button className="btn btn-primary btn-block" disabled={!ready} onClick={save}>
        {ready ? 'Сохранить' : 'Имя и код из 4 цифр'}
      </button>

      {person && !isOwner && (
        person.active ? (
          <button
            className="btn btn-quiet btn-block"
            onClick={() => {
              deactivateStaff(person.id);
              closeSheet();
              toast(`${person.name} больше не входит в кабинет`);
            }}
          >
            Выключить доступ
          </button>
        ) : (
          <button
            className="btn btn-secondary btn-block"
            onClick={() => {
              activateStaff(person.id);
              closeSheet();
              toast(`${person.name} снова в команде`, 'success');
            }}
          >
            Вернуть доступ
          </button>
        )
      )}
    </div>
  );
}
