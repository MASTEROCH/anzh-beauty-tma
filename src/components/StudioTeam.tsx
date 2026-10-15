import { useEffect, useState } from 'react';
import { Icon } from './Icon';
import { asset } from '../lib/asset';
import { openSheet, closeSheet, toast } from '../lib/ui';
import { notify } from '../lib/haptics';
import { ApiError } from '../lib/session';
import { useCabinet, cabinetDenied } from '../lib/staff';
import { staffStats } from '../lib/analytics';
import { useLiveServices, loadErrorText, type Visit } from '../lib/studio';
import {
  getTeam, addTeamMember, removeTeamMember, setMemberPin,
  type StaffMember,
} from '../lib/api/staff';
import { SwipeRow } from './SwipeRow';
import { openMemberEditor } from './MemberEditor';
import { tap, select } from '../lib/haptics';

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
const ACCESS: Record<StaffMember['role'], string> = { owner: 'владелица', admin: 'администратор', staff: 'мастер' };
// Должность и роль доступа; роль не повторяем, если она уже есть в должности
const roleWord = (p: StaffMember) => {
  const access = ACCESS[p.role];
  if (!p.title) return access;
  return p.title.toLowerCase().includes(access) ? p.title : `${p.title} · ${access}`;
};

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
  const cab = useCabinet();
  const [gone, setGone] = useState<ReadonlySet<number>>(new Set());
  const order = (team ?? []).map((p) => p.telegram_id);

  const edit = (person: StaffMember) => {
    tap();
    openMemberEditor(person, {
      services: services.list,
      teamOrder: order,
      isSelf: cab.me?.telegram_id === person.telegram_id,
      onChanged: reloadTeam,
    });
  };

  return (
    <div>
      <div className="row row-between mb-md">
        <div className="eyebrow">команда{team ? ` · ${team.length}` : ''}</div>
        <button className="chip chip-gold" onClick={() => { tap(); openAddForm(); }}>
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

      <div className="pr-list">
        {(team ?? []).map((person) => {
          const st = staffStats(lists, person.telegram_id);
          const hidden = person.profile ? !person.profile.visible : false;
          const row = (
            <button className="pr-row tm-row" onClick={() => edit(person)} aria-label={`Карточка: ${person.name}`}>
              <span className="tm-ph" style={{ background: colourOf(person.telegram_id) }}>
                {person.photo_url
                  ? <img src={asset(person.photo_url)} alt="" aria-hidden />
                  : <span className="team-ini">{person.name.slice(0, 1)}</span>}
              </span>
              <span className="pr-body">
                <span className="pr-title">{person.name}</span>
                <span className="pr-meta">{roleWord(person)}</span>
                <span className="tm-tags">
                  <span className="tm-load">сейчас {st.upcoming} · выполнено {st.done}</span>
                  {st.pending > 0 && <span className="tm-tag warn">{st.pending} ждут решения</span>}
                  {hidden && <span className="tm-tag">скрыт на сайте</span>}
                  {person.must_change_pin && <span className="tm-tag">сменит PIN</span>}
                </span>
              </span>
              <Icon name="chevron-right" size={16} strokeWidth={2.2} className="pr-go" />
            </button>
          );
          const protectedRow = person.role === 'owner' || cab.me?.telegram_id === person.telegram_id;
          return protectedRow ? <div key={person.telegram_id}>{row}</div> : (
            <SwipeRow key={person.telegram_id} label="Убрать" onCommit={() => openRemoveConfirm(person, () => {
              setGone((g) => new Set(g).add(person.telegram_id));
            })} collapsing={gone.has(person.telegram_id)}>
              {row}
            </SwipeRow>
          );
        })}
      </div>
      <p className="faint pr-help">Нажмите на человека — фото, описание, процедуры, контакты, PIN. Потяните влево, чтобы убрать из команды.</p>

      <StaffAccessCard />
    </div>
  );
}

/* ── Как войти сотрудникам ── */
function StaffAccessCard() {
  const link = typeof window !== 'undefined' ? `${window.location.origin}/studio` : '/studio';
  const copy = () => {
    tap();
    const done = () => toast('Ссылка скопирована', 'success');
    try { void navigator.clipboard?.writeText(link).then(done, () => toast('Не скопировалось — выделите ссылку вручную')); } catch { toast('Не скопировалось — выделите ссылку вручную'); }
  };
  return (
    <div className="tm-access">
      <div className="eyebrow">как войти сотрудникам</div>
      <ol className="tm-steps">
        <li>Добавьте человека: «+ сотрудник», его Telegram ID и роль.</li>
        <li>Задайте PIN в его карточке и передайте лично — или он задаст свой при первом входе.</li>
        <li>Отправьте ему приложение студии: в Telegram — «ANZH Студия» у бота студии, в браузере — ссылка ниже.</li>
      </ol>
      <button className="tm-link" onClick={copy}>
        <span>{link.replace(/^https?:\/\//, '')}</span>
        <Icon name="share" size={15} strokeWidth={2} />
      </button>
    </div>
  );
}

/* ── Снятие доступа ── */

function openRemoveConfirm(person: StaffMember, onGone?: () => void) {
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
        after={() => { onGone?.(); window.setTimeout(reloadTeam, 400); }}
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

/* ── Добавление: Telegram ID, имя, роль, PIN сразу (по желанию) ── */

function openAddForm() {
  openSheet({ title: 'Новый сотрудник', subtitle: 'по Telegram ID', body: <AddForm /> });
}

function AddForm() {
  const [tid, setTid] = useState('');
  const [name, setName] = useState('');
  const [title, setTitle] = useState('');
  const [role, setRole] = useState<'staff' | 'admin'>('staff');
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);
  const [why, setWhy] = useState<string | null>(null);

  const idNum = Number(tid);
  const ready = /^\d{1,15}$/.test(tid) && idNum > 0 && name.trim().length > 0 && (pin === '' || /^\d{4}$/.test(pin));

  const save = async () => {
    if (!ready || busy) return;
    setBusy(true);
    setWhy(null);
    try {
      await addTeamMember({ telegram_id: idNum, name: name.trim(), title: title.trim() || null, role });
      if (pin) await setMemberPin(idNum, pin);
      notify('success');
      closeSheet();
      toast(pin ? `${name.trim()} в команде — передайте PIN лично` : `${name.trim()} в команде — PIN задаст сам(а) при первом входе`, 'success');
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
      <p className="muted mb-md" style={{ fontSize: 14, lineHeight: 1.5 }}>
        Человек открывает приложение студии и видит свой Telegram ID на экране входа. Впишите его сюда —
        после этого он войдёт с PIN. Фото, описание и процедуры — в его карточке после добавления.
      </p>
      <label className="se-field">
        <span>Telegram ID</span>
        <input inputMode="numeric" value={tid} onChange={(e) => { setTid(e.target.value.replace(/\D/g, '').slice(0, 15)); setWhy(null); }} placeholder="например, 123456789" />
      </label>
      <div className="se-two">
        <label className="se-field">
          <span>Имя</span>
          <input value={name} maxLength={64} onChange={(e) => { setName(e.target.value); setWhy(null); }} placeholder="Как обращаются клиентки" />
        </label>
        <label className="se-field">
          <span>Должность</span>
          <input value={title} maxLength={64} onChange={(e) => setTitle(e.target.value)} placeholder="Мастер по бровям" />
        </label>
      </div>
      <div className="se-field"><span>Роль в кабинете</span></div>
      <div className="seg" role="radiogroup" aria-label="Роль">
        {([['staff', 'Мастер'], ['admin', 'Администратор']] as const).map(([v, label]) => (
          <button key={v} role="radio" aria-checked={role === v} className={`seg-btn${role === v ? ' active' : ''}`} onClick={() => { select(); setRole(v); }}>{label}</button>
        ))}
      </div>
      <label className="se-field mt-md">
        <span>PIN сразу (необязательно)</span>
        <input inputMode="numeric" value={pin} maxLength={4} autoComplete="off" onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))} placeholder="4 цифры — или задаст сам" />
      </label>
      {why && <p className="form-why" role="alert">{why}</p>}
      <button className="btn btn-primary btn-block mt-md" disabled={!ready || busy} onClick={() => { void save(); }}>
        {busy ? 'Добавляем…' : 'Добавить в команду'}
      </button>
    </>
  );
}
