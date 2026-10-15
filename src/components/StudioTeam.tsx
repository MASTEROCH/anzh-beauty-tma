import { useEffect, useState } from 'react';
import { Icon } from './Icon';
import { asset } from '../lib/asset';
import { openSheet, closeSheet, toast } from '../lib/ui';
import { notify } from '../lib/haptics';
import { ApiError } from '../lib/session';
import { useCabinet, cabinetDenied } from '../lib/staff';
import { staffStats } from '../lib/analytics';
import { formatMoneyParts, useLiveServices, formatShort, loadErrorText, type Visit } from '../lib/studio';
import {
  getTeam, addTeamMember, removeTeamMember, setMemberServices, resetMemberPin,
  type StaffMember, type WireService,
} from '../lib/api/staff';

/*
   ПАНЕЛЬ КОМАНДЫ (только владелица, всё — на сервере).

   Человек — это карточка с живыми счётчиками, а не строка в списке.
   Счётчики считаются из записей (по `staff_id`), а не хранятся полем.

   Что здесь можно сделать — ровно то, что умеет сервер:
     · добавить сотрудника по Telegram ID (POST /team) — ID мастер видит
       сам, открыв «Кабинет мастера»; добавление по ссылке-приглашению
       скрыто — такой ручки нет;
     · назначить процедуры (PUT /team/{id}/services);
     · сбросить PIN мастера (POST /team/{id}/pin/reset) — мастер задаст
       новый сам; владелица чужой PIN не назначает и не видит;
     · снять доступ (DELETE /team/{id}) — мягко: записи остаются в истории.
   Вернуть снятого — снова добавить по тому же Telegram ID.
*/

const COLOURS = ['#12C088', '#C9A52F', '#35E4A6', '#2F767A', '#8FF3D4', '#F5C842'];
const colourOf = (id: number) => COLOURS[Math.abs(id) % COLOURS.length];
const roleWord = (p: StaffMember) => p.title ?? (p.role === 'owner' ? 'владелица' : 'мастер');

function teamErrorText(e: unknown): string {
  const code = e instanceof ApiError ? e.code : 'network';
  switch (code) {
    case 'bad_telegram_id': return 'Telegram ID — целое число. Мастер видит его, открыв «Кабинет мастера»';
    case 'bad_name': return 'Имя — от 1 до 64 символов';
    case 'owner_unique': return 'Владелица в студии уже есть — вторую назначить нельзя';
    case 'self_removal': return 'Снять доступ у себя нельзя';
    case 'self_reset': return 'Свой PIN меняется при входе в кабинет: «Сменить PIN»';
    case 'bad_slugs':
    case 'unknown_service': return 'Одной из процедур больше нет в каталоге — обновите список';
    case 'forbidden': return 'Команду меняет только владелица';
    case 'pin_required': return 'Подтвердите PIN, чтобы продолжить';
    case 'not_found': return 'Такого сотрудника нет';
    case 'network':
    case 'timeout': return 'Нет связи — ничего не изменилось, повторите';
    default: return 'Не получилось — повторите';
  }
}

/* ── Состав команды: GET /team, перечитывается после каждого изменения ──
   Ручка — только для команды (007 M1), с пропуском. Отказ — как у соседних
   ручек кабинета (lib/studio.ts loadList): `pin_required` — кабинет просит
   PIN, 403 `forbidden` — доступ снят, кабинет закрывается; экран при этом не
   пишет «нет связи». Остальное — ошибка с «Повторить». */

/** Отказ, который разобрал сам кабинет (PIN, доступ снят), — не ошибка экрана. */
const handledByCabinet = (e: unknown) => cabinetDenied(e, { accessCheck: true });

let teamCache: StaffMember[] | null = null;
const teamListeners = new Set<() => void>();
function setTeamCache(t: StaffMember[] | null) {
  teamCache = t;
  teamListeners.forEach((l) => l());
}

function useTeam() {
  const [, force] = useState(0);
  const [state, setState] = useState<{ loading: boolean; error: ApiError | null }>({ loading: teamCache === null, error: null });
  const load = () => {
    setState({ loading: true, error: null });
    getTeam().then(
      (t) => { setTeamCache(t); setState({ loading: false, error: null }); },
      (e: unknown) => {
        if (handledByCabinet(e)) { setState({ loading: false, error: null }); return; }
        setState({ loading: false, error: e instanceof ApiError ? e : new ApiError(0, 'network', 'сбой') });
      },
    );
  };
  useEffect(() => {
    const l = () => force((x) => x + 1);
    teamListeners.add(l);
    if (teamCache === null) load();
    return () => { teamListeners.delete(l); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return { team: teamCache, ...state, reload: load };
}

function reloadTeam() {
  getTeam().then(
    (t) => setTeamCache(t),
    // Останется прежний список — экран не врёт о новом; PIN и снятый доступ
    // разбирает кабинет, как у первой загрузки
    (e: unknown) => { handledByCabinet(e); },
  );
}

export function StudioTeam({ lists }: { lists: Visit[][] }) {
  const { team, loading, error, reload } = useTeam();
  const services = useLiveServices();

  const openCard = (person: StaffMember) => openSheet({
    title: person.name,
    subtitle: roleWord(person),
    body: <StaffCard person={person} lists={lists} services={services.list} />,
  });

  return (
    <div>
      <div className="row row-between mb-md">
        <div className="eyebrow">команда{team ? ` · ${team.length}` : ''}</div>
        <button className="chip chip-gold" onClick={() => openAddForm()}>
          <Icon name="plus" size={13} strokeWidth={2.6} /> сотрудник
        </button>
      </div>

      {loading && !team && <div className="card empty-card"><div className="muted">Загружаем команду…</div></div>}
      {error && (
        <div className="card empty-card" role="alert">
          {/* Как у списков кабинета (loadErrorText): «нет связи» — только когда её нет */}
          <div className="muted">Команду не загрузили — {loadErrorText(error).toLowerCase()}</div>
          <button className="btn btn-secondary btn-block mt-md" onClick={reload}>Повторить</button>
        </div>
      )}

      <div className="stack-tight">
        {(team ?? []).map((person) => {
          const st = staffStats(lists, person.telegram_id);
          return (
            <button key={person.telegram_id} className="team-row" onClick={() => openCard(person)}>
              <span className="team-ph" style={{ background: colourOf(person.telegram_id) }}>
                {person.photo_url
                  ? <img src={asset(person.photo_url)} alt="" aria-hidden />
                  : <span className="team-ini">{person.name.slice(0, 1)}</span>}
              </span>
              <span className="team-b">
                <span className="team-n">{person.name}</span>
                <span className="team-r">{roleWord(person)}</span>
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

function StaffCard({ person, lists, services }: { person: StaffMember; lists: Visit[][]; services: WireService[] }) {
  const cab = useCabinet();
  const self = cab.me?.telegram_id === person.telegram_id;
  const st = staffStats(lists, person.telegram_id);
  const leads = person.role === 'owner'
    ? 'все процедуры'
    : (person.services ?? [])
      .map((slug) => services.find((s) => s.slug === slug)?.title.ru ?? slug)
      .join(', ') || '—';

  return (
    <>
      <div className="staff-hero row">
        <span className="staff-hero-ph" style={{ background: colourOf(person.telegram_id) }}>
          {person.photo_url
            ? <img src={asset(person.photo_url)} alt="" aria-hidden />
            : <span className="team-ini">{person.name.slice(0, 1)}</span>}
        </span>
        <div className="row-fill">
          <div className="staff-hero-n">{person.name}</div>
          <div className="staff-hero-r">{roleWord(person)}</div>
          <div className="staff-hero-since">Telegram ID {person.telegram_id}</div>
        </div>
      </div>

      <div className="staff-grid">
        <Stat v={st.upcoming} k="записей сейчас" />
        <Stat v={st.pending} k="ждут решения" warn={st.pending > 0} />
        <Stat v={st.done} k="выполнено" />
        <Stat v={st.clients} k="клиенток" />
      </div>

      <dl className="about-doc-facts">
        <div className="about-doc-fact">
          <dt>Ведёт</dt>
          <dd>{leads}</dd>
        </div>
        <div className="about-doc-fact">
          <dt>Выручка</dt>
          <dd>{st.revenue.length ? `${formatMoneyParts(st.revenue)} за два года` : '—'}</dd>
        </div>
        {st.lastISO && (
          <div className="about-doc-fact">
            <dt>Последний приём</dt>
            <dd>{formatShort(st.lastISO)}</dd>
          </div>
        )}
      </dl>

      {!self && person.role !== 'owner' && (
        <div className="stack-tight mt-md">
          <button className="btn btn-quiet btn-block" onClick={() => openServicesForm(person, services)}>
            Какие процедуры ведёт
          </button>
          <button className="btn btn-quiet btn-block" onClick={() => openEditForm(person)}>
            Имя и должность
          </button>
          <button className="btn btn-quiet btn-block" onClick={() => openPinResetConfirm(person)}>
            Сбросить PIN
          </button>
          {/* Снятие доступа — отдельно и с подтверждением */}
          <button className="btn btn-quiet btn-block danger" onClick={() => openRemoveConfirm(person)}>
            Снять доступ
          </button>
        </div>
      )}
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

/* ── Сброс PIN мастера ── */

function openPinResetConfirm(person: StaffMember) {
  openSheet({
    title: 'Сбросить PIN?',
    subtitle: person.name,
    body: (
      <p className="muted" style={{ fontSize: 14, lineHeight: 1.55 }}>
        Прежний PIN перестанет работать, а открытый кабинет у {person.name} закроется.
        Если PIN был заблокирован после неверных вводов, блокировка тоже снимется.
        При следующем входе {person.name} сам(а) задаст новый PIN — вы его не узнаете.
      </p>
    ),
    actions: <ConfirmButton label="Да, сбросить PIN" run={() => resetMemberPin(person.telegram_id)} done={`${person.name}: PIN сброшен`} />,
  });
}

/* ── Снятие доступа ── */

function openRemoveConfirm(person: StaffMember) {
  openSheet({
    title: 'Снять доступ?',
    subtitle: person.name,
    body: (
      <p className="muted" style={{ fontSize: 14, lineHeight: 1.55 }}>
        {person.name} больше не войдёт в кабинет и пропадёт из выбора мастера при записи.
        Прошлые записи останутся в истории и в выручке — они уже случились.
        <br /><br />
        Вернуть — добавить снова по тому же Telegram ID: {person.telegram_id}.
      </p>
    ),
    actions: (
      <ConfirmButton
        label="Да, снять доступ"
        danger
        run={() => removeTeamMember(person.telegram_id)}
        done={`${person.name} — доступ снят`}
        after={reloadTeam}
      />
    ),
  });
}

function ConfirmButton({
  label, run, done, after, danger,
}: { label: string; run: () => Promise<unknown>; done: string; after?: () => void; danger?: boolean }) {
  const [busy, setBusy] = useState(false);
  return (
    <button
      className={`btn btn-primary btn-block${danger ? ' danger' : ''}`}
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          await run();
          closeSheet();
          notify('success');
          toast(done, 'success');
          after?.();
        } catch (e) {
          cabinetDenied(e);
          notify('error');
          closeSheet();
          toast(teamErrorText(e));
        } finally {
          setBusy(false);
        }
      }}
    >
      {busy ? 'Минуту…' : label}
    </button>
  );
}

/* ── Добавление по Telegram ID и правка имени ── */

function openAddForm() {
  openSheet({ title: 'Новый сотрудник', subtitle: 'по Telegram ID', body: <MemberForm /> });
}

function openEditForm(person: StaffMember) {
  openSheet({ title: 'Имя и должность', subtitle: person.name, body: <MemberForm person={person} /> });
}

function MemberForm({ person }: { person?: StaffMember }) {
  const [tid, setTid] = useState(person ? String(person.telegram_id) : '');
  const [name, setName] = useState(person?.name ?? '');
  const [title, setTitle] = useState(person?.title ?? '');
  const [busy, setBusy] = useState(false);
  const [why, setWhy] = useState<string | null>(null);

  const idNum = Number(tid);
  const ready = /^\d{1,15}$/.test(tid) && idNum > 0 && name.trim().length > 0;

  const save = async () => {
    if (!ready || busy) return;
    setBusy(true);
    setWhy(null);
    try {
      // Роль всегда `staff`: вторую владелицу сервер не даст (owner_unique),
      // а понизить действующую владелицу этим вызовом нельзя.
      await addTeamMember({ telegram_id: idNum, name: name.trim(), title: title.trim() || null, role: 'staff' });
      notify('success');
      closeSheet();
      toast(person ? 'Карточка обновлена' : `${name.trim()} в команде — PIN задаст сам(а) при первом входе`, 'success');
      reloadTeam();
    } catch (e) {
      cabinetDenied(e);
      notify('error');
      setWhy(teamErrorText(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      {!person && (
        <>
          <p className="muted mb-md" style={{ fontSize: 13 }}>
            Мастер открывает приложение в Telegram → «Кабинет мастера» и видит свой Telegram ID.
            Впишите его сюда — после этого мастер задаст себе PIN и войдёт.
          </p>
          <label className="field">
            <span className="field-k">Telegram ID</span>
            <input className="input" inputMode="numeric" value={tid}
              onChange={(e) => { setTid(e.target.value.replace(/\D/g, '').slice(0, 15)); setWhy(null); }}
              placeholder="например, 123456789" />
          </label>
        </>
      )}

      <label className="field">
        <span className="field-k">Имя</span>
        <input className="input" value={name} maxLength={64}
          onChange={(e) => { setName(e.target.value); setWhy(null); }} placeholder="Как обращаются клиентки" />
      </label>

      <label className="field">
        <span className="field-k">Должность</span>
        <input className="input" value={title} maxLength={64}
          onChange={(e) => setTitle(e.target.value)} placeholder="Мастер по бровям" />
      </label>

      {why && <p className="form-why" role="alert">{why}</p>}

      <button className="btn btn-primary btn-block mt-md" disabled={!ready || busy} onClick={() => { void save(); }}>
        {busy ? 'Сохраняем…' : person ? 'Сохранить' : 'Добавить в команду'}
      </button>
    </>
  );
}

/* ── Какие процедуры ведёт ── */

function openServicesForm(person: StaffMember, services: WireService[]) {
  openSheet({ title: 'Какие процедуры ведёт', subtitle: person.name, body: <ServicesForm person={person} services={services} /> });
}

function ServicesForm({ person, services }: { person: StaffMember; services: WireService[] }) {
  const [slugs, setSlugs] = useState<string[]>(person.services ?? []);
  const [busy, setBusy] = useState(false);
  const [why, setWhy] = useState<string | null>(null);

  const toggle = (slug: string) =>
    setSlugs((prev) => (prev.includes(slug) ? prev.filter((x) => x !== slug) : [...prev, slug]));

  const save = async () => {
    setBusy(true);
    setWhy(null);
    try {
      await setMemberServices(person.telegram_id, slugs);
      notify('success');
      closeSheet();
      toast(`${person.name}: процедуры сохранены`, 'success');
      reloadTeam();
    } catch (e) {
      cabinetDenied(e);
      notify('error');
      setWhy(teamErrorText(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      {/* По этому списку заявки уходят мастеру: процедура без
          закреплённого мастера уходит владелице. */}
      {services.length === 0 && <p className="muted">Каталог не загрузился — откройте ещё раз</p>}
      <div className="chips-wrap">
        {services.map((s) => (
          <button
            key={s.slug}
            className={`chip${slugs.includes(s.slug) ? ' chip-gold' : ''}`}
            aria-pressed={slugs.includes(s.slug)}
            onClick={() => toggle(s.slug)}
          >
            {s.title.ru}
          </button>
        ))}
      </div>
      {why && <p className="form-why" role="alert">{why}</p>}
      <button className="btn btn-primary btn-block mt-md" disabled={busy || services.length === 0} onClick={() => { void save(); }}>
        {busy ? 'Сохраняем…' : 'Сохранить'}
      </button>
    </>
  );
}
