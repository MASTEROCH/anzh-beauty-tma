import { useState } from 'react';
import { Icon } from './Icon';
import { asset } from '../lib/asset';
import { openSheet, closeSheet, toast } from '../lib/ui';
import { notify } from '../lib/haptics';
import {
  useTeam, addStaff, updateStaff, deactivateStaff, activateStaff,
  removeStaff, setPin, hasDefaultPin, OWNER_ID, type Staff,
} from '../lib/staff';
import { staffStats } from '../lib/analytics';
import { useAppointments } from '../lib/appointments';
import { liveServices } from '../lib/catalog';
import { openExternal } from '../lib/telegram';
import { instagramUrl } from '../data/location';

/*
   ПАНЕЛЬ КОМАНДЫ.

   Приём из EPOCH: человек — это карточка с фотографией и живыми
   счётчиками, а не строка в списке. Владелица держит троих в голове; на
   пятом «кто чем занимается, сколько на нём сейчас висит и как с ним
   связаться» начинает теряться, и вопрос уходит в переписку.

   Счётчики считаются из записей, а не хранятся полем: хранимое число
   разойдётся с правдой на первой отменённой записи, и починить его
   будет нечем — исходного события уже нет.

   Что здесь можно сделать: добавить человека, назначить и сменить его
   код, выключить на время (отпуск) и исключить насовсем. Разница между
   последними двумя существенна: выключенный остаётся в списке, и его
   прошлые записи по-прежнему находятся; исключённый убирается целиком.
*/

export function StudioTeam() {
  const team = useTeam();
  const all = useAppointments();
  const [tick, setTick] = useState(0);

  const openCard = (person: Staff) => openSheet({
    title: person.name,
    subtitle: person.title ?? (person.role === 'owner' ? 'владелица' : 'мастер'),
    body: <StaffCard person={person} onChange={() => setTick((x) => x + 1)} />,
  });

  return (
    <div key={tick}>
      <div className="row row-between mb-md">
        <div className="eyebrow">команда · {team.filter((s) => s.active).length}</div>
        <button className="chip chip-gold" onClick={() => openForm()}>
          <Icon name="plus" size={13} strokeWidth={2.6} /> сотрудник
        </button>
      </div>

      <div className="stack-tight">
        {team.map((person) => {
          const st = staffStats(all, person.id);
          return (
            <button
              key={person.id}
              className={`team-row${person.active ? '' : ' off'}`}
              onClick={() => openCard(person)}
            >
              <span className="team-ph" style={{ background: person.colour }}>
                {person.photo
                  ? <img src={asset(person.photo)} alt="" aria-hidden />
                  : <span className="team-ini">{person.name.slice(0, 1)}</span>}
              </span>

              <span className="team-b">
                <span className="team-n">
                  {person.name}
                  {!person.active && <span className="chip chip-quiet">не работает</span>}
                  {hasDefaultPin(person) && person.active && (
                    <span className="chip chip-amber">код заводской</span>
                  )}
                </span>
                <span className="team-r">
                  {person.title ?? (person.role === 'owner' ? 'владелица' : 'мастер')}
                </span>
                <span className="team-load">
                  сейчас {st.upcoming} · выполнено {st.done}
                  {st.pending > 0 && <b> · {st.pending} ждут решения</b>}
                </span>
              </span>

              <Icon name="chevron-right" size={18} strokeWidth={2} />
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ── Карточка одного человека ── */

function StaffCard({ person, onChange }: { person: Staff; onChange: () => void }) {
  const all = useAppointments();
  const st = staffStats(all, person.id);
  const services = liveServices();
  const leads = person.role === 'owner'
    ? 'все процедуры'
    : services.filter((s) => person.serviceIds.includes(s.id)).map((s) => s.title).join(', ') || '—';

  return (
    <>
      <div className="staff-hero row">
        <span className="staff-hero-ph" style={{ background: person.colour }}>
          {person.photo
            ? <img src={asset(person.photo)} alt="" aria-hidden />
            : <span className="team-ini">{person.name.slice(0, 1)}</span>}
        </span>
        <div className="row-fill">
          <div className="staff-hero-n">{person.name}</div>
          <div className="staff-hero-r">
            {person.title ?? (person.role === 'owner' ? 'владелица' : 'мастер')}
          </div>
          {person.joinedISO && (
            <div className="staff-hero-since">в команде с {person.joinedISO.slice(0, 7).replace('-', '.')}</div>
          )}
        </div>
      </div>

      {/* Счётчики: сейчас и за всё время. Первый отвечает на «можно ли
          дать ему ещё», второй — на «сколько он вообще сделал». */}
      <div className="staff-grid">
        <Stat v={st.upcoming} k="записей сейчас" />
        <Stat v={st.pending} k="ждут решения" warn={st.pending > 0} />
        <Stat v={st.done} k="выполнено всего" />
        <Stat v={st.clients} k="клиенток" />
      </div>

      <dl className="about-doc-facts">
        <div className="about-doc-fact">
          <dt>Ведёт</dt>
          <dd>{leads}</dd>
        </div>
        <div className="about-doc-fact">
          <dt>Выручка</dt>
          <dd>${st.revenue.toLocaleString('ru-RU')} за всё время</dd>
        </div>
        {st.lastISO && (
          <div className="about-doc-fact">
            <dt>Последний приём</dt>
            <dd>{st.lastISO}</dd>
          </div>
        )}
        {person.phone && (
          <div className="about-doc-fact">
            <dt>Телефон</dt>
            <dd>{person.phone}</dd>
          </div>
        )}
        {person.instagram && (
          <div className="about-doc-fact">
            <dt>Инстаграм</dt>
            <dd>@{person.instagram}</dd>
          </div>
        )}
      </dl>

      {person.instagram && (
        <button
          className="btn btn-secondary btn-block mt-md"
          onClick={() => openExternal(instagramUrl(person.instagram))}
        >
          Открыть @{person.instagram}
        </button>
      )}

      <div className="stack-tight mt-md">
        <button className="btn btn-quiet btn-block" onClick={() => openForm(person)}>
          Редактировать карточку
        </button>
        {/* У только что заведённого сотрудника кода нет вовсе — менять
            нечего, его назначают. Заводской код тоже назначают заново:
            он ходил по переписке и способом входа быть не должен. */}
        <button className="btn btn-quiet btn-block" onClick={() => openPinForm(person, onChange)}>
          {!person.pin || hasDefaultPin(person) ? 'Назначить код' : 'Сменить код'}
        </button>

        {person.id !== OWNER_ID && (
          <>
            <button
              className="btn btn-quiet btn-block"
              onClick={() => {
                person.active ? deactivateStaff(person.id) : activateStaff(person.id);
                onChange();
                closeSheet();
                toast(person.active ? `${person.name} — доступ снят` : `${person.name} снова в команде`);
              }}
            >
              {person.active ? 'Временно отключить' : 'Вернуть в команду'}
            </button>

            {/* Исключение — отдельно и с подтверждением: это единственное
                действие здесь, которое нельзя отменить одной кнопкой. */}
            <button
              className="btn btn-quiet btn-block danger"
              onClick={() => openRemoveConfirm(person, onChange)}
            >
              Исключить из команды
            </button>
          </>
        )}
      </div>
    </>
  );
}

function Stat({ v, k, warn }: { v: number; k: string; warn?: boolean }) {
  return (
    <div className="staff-stat">
      <span className={`staff-stat-v${warn ? ' warn' : ''}`}>{v}</span>
      <span className="staff-stat-k">{k}</span>
    </div>
  );
}

/* ── Смена кода ── */

function openPinForm(person: Staff, onChange: () => void) {
  openSheet({
    title: !person.pin || hasDefaultPin(person) ? 'Назначить код' : 'Сменить код',
    subtitle: person.name,
    body: <PinForm person={person} onChange={onChange} />,
  });
}

function PinForm({ person, onChange }: { person: Staff; onChange: () => void }) {
  const [value, setValue] = useState('');
  const [why, setWhy] = useState<string | null>(null);

  const save = () => {
    const res = setPin(person.id, value);
    if (!res.ok) { setWhy(res.why); notify('error'); return; }
    notify('success');
    onChange();
    closeSheet();
    toast(`${person.name} — код назначен`, 'success');
  };

  return (
    <>
      <p className="muted mb-md" style={{ fontSize: 13 }}>
        Четыре цифры. Этим кодом {person.name} входит в кабинет — он определяет,
        что человек внутри увидит.
      </p>

      <input
        className="input"
        inputMode="numeric"
        maxLength={4}
        value={value}
        placeholder="••••"
        onChange={(e) => { setValue(e.target.value.replace(/\D/g, '')); setWhy(null); }}
      />

      {why && <p className="form-why">{why}</p>}

      <button
        className="btn btn-primary btn-block mt-md"
        disabled={value.length !== 4}
        onClick={save}
      >
        Назначить
      </button>
    </>
  );
}

/* ── Исключение ── */

function openRemoveConfirm(person: Staff, onChange: () => void) {
  openSheet({
    title: 'Исключить из команды?',
    subtitle: person.name,
    body: (
      <p className="muted" style={{ fontSize: 14, lineHeight: 1.55 }}>
        Человек исчезнет из списка и из выбора мастера при записи.
        Прошлые записи останутся в истории и в выручке — они уже случились.
        <br /><br />
        Если это отпуск или пауза, лучше «Временно отключить»: тогда он
        вернётся одной кнопкой, и записи продолжат находиться по нему.
      </p>
    ),
    actions: (
      <button
        className="btn btn-primary btn-block danger"
        onClick={() => {
          const res = removeStaff(person.id);
          closeSheet();
          if (!res.ok) { toast(res.why); notify('error'); return; }
          onChange();
          notify('success');
          toast(`${person.name} исключён из команды`);
        }}
      >
        Да, исключить
      </button>
    ),
  });
}

/* ── Добавление и правка карточки ── */

function openForm(person?: Staff) {
  openSheet({
    title: person ? 'Карточка сотрудника' : 'Новый сотрудник',
    subtitle: person?.name,
    body: <StaffForm person={person} />,
  });
}

function StaffForm({ person }: { person?: Staff }) {
  const services = liveServices();
  const [name, setName] = useState(person?.name ?? '');
  const [title, setTitle] = useState(person?.title ?? '');
  const [phone, setPhone] = useState(person?.phone ?? '');
  const [instagram, setInstagram] = useState(person?.instagram ?? '');
  const [ids, setIds] = useState<string[]>(person?.serviceIds ?? []);

  const toggle = (id: string) =>
    setIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const ready = name.trim().length > 1;

  const save = () => {
    const patch = {
      name: name.trim(),
      title: title.trim() || undefined,
      phone: phone.trim() || undefined,
      instagram: instagram.trim().replace(/^@/, '') || undefined,
      serviceIds: ids,
    };
    if (person) updateStaff(person.id, patch);
    else addStaff({ ...patch, role: 'master', pin: '', colour: '#35E4A6', serviceIds: ids });
    notify('success');
    closeSheet();
    toast(person ? 'Карточка обновлена' : `${patch.name} в команде — назначьте код`, 'success');
  };

  return (
    <>
      <label className="field">
        <span className="field-k">Имя</span>
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Как обращаются клиентки" />
      </label>

      <label className="field">
        <span className="field-k">Должность</span>
        <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Мастер по бровям" />
      </label>

      <label className="field">
        <span className="field-k">Телефон</span>
        <input className="input" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+995 …" />
      </label>

      <label className="field">
        <span className="field-k">Инстаграм</span>
        <input className="input" value={instagram} onChange={(e) => setInstagram(e.target.value)} placeholder="@ник" />
      </label>

      {person?.role !== 'owner' && (
        <>
          <div className="eyebrow sub-head">какие процедуры ведёт</div>
          {/* По этому списку заявки маршрутизируются: процедура без
              закреплённого мастера уходит владелице. */}
          <div className="chips-wrap">
            {services.map((s) => (
              <button
                key={s.id}
                className={`chip${ids.includes(s.id) ? ' chip-gold' : ''}`}
                onClick={() => toggle(s.id)}
              >
                {s.title}
              </button>
            ))}
          </div>
        </>
      )}

      <button className="btn btn-primary btn-block mt-md" disabled={!ready} onClick={save}>
        {person ? 'Сохранить' : 'Добавить в команду'}
      </button>
    </>
  );
}
