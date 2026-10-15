import { useEffect, useRef, useState } from 'react';
import { Icon } from './Icon';
import { closeSheet, toast } from '../lib/ui';
import { notify, tap } from '../lib/haptics';
import { initSession, useSession } from '../lib/session';
import { useMe } from '../lib/api';
import {
  useCabinet, checkCabinet, enterPin, createPin, changePin,
  pinErrorText, waitMinutes, lockedUntilOf, NEW_PIN_LEN, PIN_MIN, PIN_MAX,
  type StaffRole,
} from '../lib/staff';
import { ApiError } from '../lib/session';

/*
   ВХОД В КАБИНЕТ: КТО ТЫ — ГОВОРИТ TELEGRAM, PIN — ЧТО ЗА ТЕЛЕФОНОМ ТЫ.

   Выбора «кто вы» из списка больше нет: человека узнаёт сервер по подписи
   Telegram, роль берёт из базы (GET /staff/me). PIN подтверждает, что
   телефон в руках того же человека (POST /staff/pin), и живёт на сервере
   хэшем. На устройстве PIN не хранится: он есть только в поле ввода до
   нажатия и уходит в тело одного запроса.

   Три пути, их выбирает ответ сервера, а не экран:
     · PIN не задан  → «придумайте PIN» дважды → /staff/pin/set → /staff/pin;
     · PIN задан     → ввод → /staff/pin;
     · смена своего  → текущий + новый → /staff/pin/set (подтверждения не даёт).

   Отказы — человеческими словами (lib/staff.ts → pinErrorText): неверный
   PIN, PIN уже задан, слишком много попыток (ждать Retry-After), PIN
   заблокирован после 10 неверных подряд (423, до locked_until), проверка
   недоступна, нет связи. Сеть — это не «вы не сотрудник».

   Длина — как у сервера (api/_domain/team.js): НОВЫЙ PIN — ровно 4 цифры,
   больше клавиатура не принимает; ввод и текущий PIN — от 4 до 8 (провод).
*/

export function PinGate({ onUnlock, embedded = false }: { onUnlock: () => void; embedded?: boolean }) {
  const session = useSession();
  const cab = useCabinet();
  const { me: profile } = useMe();
  const done = useRef(false);

  const [changing, setChanging] = useState(false);
  /* PIN задала владелица (временный) — после входа просим придумать свой,
     и только потом открываем кабинет */
  const [forced, setForced] = useState(false);

  // Спросить сервер один раз на показ (одно обещание на двойной маунт).
  useEffect(() => {
    if (session.status === 'guest') return;
    if (cab.phase === 'open' || cab.phase === 'idle' || cab.phase === 'error' || cab.phase === 'not_staff') {
      void checkCabinet();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.status]);

  const finish = () => {
    if (done.current) return;
    done.current = true;
    notify('success');
    const who = cab.me;
    setTimeout(() => {
      if (!embedded) closeSheet();
      onUnlock();
      if (who) {
        toast(who.role === 'owner' ? `${who.name} — полный доступ` : `${who.name} — свой день и свои записи`, 'success');
      }
    }, 180);
  };

  // Сервер помнит подтверждение этой сессии — PIN второй раз не спрашиваем.
  useEffect(() => {
    if (cab.phase === 'open') finish();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cab.phase]);

  /* Временный PIN от владелицы: экран смены держим и после «Войти», когда
     сервер уже подтвердил вход (фаза open), — иначе кабинет открылся бы
     с чужим PIN. После смены перечитываем профиль: флаг снимется. */
  // И после перезагрузки: вход уже подтверждён, а свой PIN ещё не задан
  if ((forced || (cab.phase === 'open' && cab.me?.must_change_pin)) && cab.me) {
    return (
      <div>
        <div className="pin-who"><b>{cab.me.name}</b><span>новый PIN</span></div>
        <p className="gate-hint" style={{ marginBottom: 12 }}>
          Анжелика задала вам временный PIN. Придумайте свой — временный перестанет работать.
        </p>
        <ChangePinForm forced onDone={() => { void checkCabinet().then(() => { setForced(false); finish(); }); }} role={cab.me.role} />
      </div>
    );
  }

  if (session.status === 'guest') {
    const why = session.reason === 'outside_telegram'
      ? 'Кабинет открывается только в Telegram: там подтверждается, кто вы.'
      : session.reason === 'network'
        ? 'Нет связи с сервером — проверьте интернет.'
        : 'Не удалось войти через Telegram. Закройте и откройте приложение заново.';
    return (
      <div>
        <p className="muted mb-md" style={{ fontSize: 13 }}>{why}</p>
        {session.reason === 'network' && (
          <button className="btn btn-secondary btn-block" onClick={() => { void initSession(); }}>
            Повторить
          </button>
        )}
      </div>
    );
  }

  if (cab.phase === 'idle' || cab.phase === 'checking' || session.status === 'pending' || cab.phase === 'open') {
    return (
      <div>
        <p className="muted mb-md" style={{ fontSize: 13 }} aria-live="polite">
          {cab.phase === 'open' ? 'Открываем кабинет…' : 'Проверяем доступ…'}
        </p>
      </div>
    );
  }

  if (cab.phase === 'error') {
    return (
      <div>
        <p className="form-why" role="alert">{pinErrorText(cab.error, 'enter')}</p>
        <button className="btn btn-secondary btn-block mt-md" onClick={() => { void checkCabinet(); }}>
          Повторить
        </button>
      </div>
    );
  }

  if (cab.phase === 'not_staff' || !cab.me) {
    return (
      <div>
        <p className="muted mb-md" style={{ fontSize: 13 }}>
          Кабинет — для команды студии: расписание, заявки, клиентки и выручка.
        </p>
        {profile?.telegram_id ? (
          <p className="gate-hint">
            Если вы мастер студии, передайте Анжелике ваш Telegram ID: <b>{profile.telegram_id}</b>.
            Она добавит вас в разделе «Команда».
          </p>
        ) : null}
      </div>
    );
  }

  const me = cab.me;
  // Почему путь сменился: PIN сбросила владелица (надо задать), его уже
  // задали с другого устройства (надо ввести) или подтверждение умерло
  // посреди работы (сервер ответил pin_required). Без этой строки человек видит
  // другой экран и не понимает, что случилось.
  const switched = cab.error && (cab.error.code === 'pin_not_set' || cab.error.code === 'pin_already_set' || cab.error.code === 'pin_required')
    ? <p className="form-why" role="status">{pinErrorText(cab.error, 'enter')}</p>
    : null;
  const head = (
    <>
      {embedded ? (
        /* Отдельное приложение студии: кто входит — крупно, по центру */
        <div className="pin-who">
          <b>{me.name}</b>
          <span>{me.title ?? (me.role === 'owner' ? 'владелица' : me.role === 'admin' ? 'администратор' : 'мастер')}</span>
        </div>
      ) : (
        <p className="muted mb-md" style={{ fontSize: 13 }}>
          {me.name} · {me.title ?? (me.role === 'owner' ? 'владелица' : 'мастер')}
        </p>
      )}
      {switched}
    </>
  );

  if (changing) {
    return (
      <div>
        {head}
        <ChangePinForm onDone={() => setChanging(false)} role={me.role} />
      </div>
    );
  }

  if (cab.phase === 'need_setup') {
    return (
      <div>
        {head}
        <SetupPin onDone={finish} role={me.role} />
      </div>
    );
  }

  return (
    <div>
      {head}
      <EnterPin onDone={() => (me.must_change_pin ? setForced(true) : finish())} role={me.role} />
      <button className="btn btn-quiet btn-block mt-md" onClick={() => { tap(); setChanging(true); }}>
        Сменить PIN
      </button>
      <p className="gate-hint">
        {me.role === 'owner'
          ? 'Свой PIN владелица меняет здесь, зная текущий.'
          : 'Забыли PIN? Анжелика сбросит его в разделе «Команда», и вы зададите новый.'}
      </p>
    </div>
  );
}

/* ── Клавиатура PIN: точки + цифры. PIN живёт только в её состоянии ── */

function usePinBlock() {
  const [until, setUntil] = useState<number>(0);
  useEffect(() => {
    if (!until) return;
    const left = until - Date.now();
    if (left <= 0) { setUntil(0); return; }
    const id = window.setTimeout(() => setUntil(0), left);
    return () => window.clearTimeout(id);
  }, [until]);
  const block = (e: unknown) => {
    if (e instanceof ApiError && e.code === 'rate_limited') setUntil(Date.now() + waitMinutes(e) * 60_000);
    // 423: PIN заперт до locked_until — пока заперт, сервер его не сверяет
    // вовсе, и клавиатура не должна обещать, что попытка что-то решит.
    const locked = lockedUntilOf(e);
    if (locked !== null && locked > Date.now()) setUntil(locked);
  };
  return { blocked: until > 0, block };
}

function PinPad({
  value, onChange, disabled, shake, max = PIN_MAX,
}: { value: string; onChange: (v: string) => void; disabled?: boolean; shake?: boolean; max?: number }) {
  const push = (d: string) => {
    if (disabled || value.length >= max) return;
    tap();
    onChange(value + d);
  };
  const dots = Math.max(PIN_MIN, value.length);
  return (
    <>
      <div className={`pin-dots${shake ? ' shake' : ''}`} aria-label={`Введено цифр: ${value.length}`}>
        {Array.from({ length: dots }, (_, i) => (
          <span key={i} className={`pin-dot ${i < value.length ? 'on' : ''}`} />
        ))}
      </div>
      <div className="pin-pad">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
          <button key={d} className="pin-key" disabled={disabled} onClick={() => push(d)}>{d}</button>
        ))}
        <button className="pin-key wide" disabled={disabled} onClick={() => onChange('')}>сброс</button>
        <button className="pin-key" disabled={disabled} onClick={() => push('0')}>0</button>
        <button
          className="pin-key wide"
          disabled={disabled}
          aria-label="Стереть цифру"
          onClick={() => onChange(value.slice(0, -1))}
        >
          <Icon name="chevron-left" size={18} strokeWidth={2.2} />
        </button>
      </div>
    </>
  );
}

function EnterPin({ onDone, role }: { onDone: () => void; role: StaffRole }) {
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);
  const [why, setWhy] = useState<string | null>(null);
  const [shake, setShake] = useState(false);
  const { blocked, block } = usePinBlock();

  const submit = async () => {
    if (pin.length < PIN_MIN || busy || blocked) return;
    setBusy(true);
    setWhy(null);
    const value = pin;
    try {
      await enterPin(value);
      setPin('');
      onDone();
    } catch (e) {
      block(e);
      notify('error');
      setWhy(pinErrorText(e, 'enter', role));
      setShake(true);
      setTimeout(() => { setPin(''); setShake(false); }, 400);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PinPad value={pin} onChange={(v) => { setPin(v); setWhy(null); }} disabled={busy || blocked || shake} shake={shake} />
      {why && <p className="form-why" role="alert">{why}</p>}
      <button
        className="btn btn-primary btn-block mt-md"
        disabled={pin.length < PIN_MIN || busy || blocked}
        onClick={() => { void submit(); }}
      >
        {busy ? 'Проверяем…' : 'Войти'}
      </button>
    </>
  );
}

function SetupPin({ onDone, role }: { onDone: () => void; role: StaffRole }) {
  const [first, setFirst] = useState<string | null>(null);
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);
  const [why, setWhy] = useState<string | null>(null);
  const [shake, setShake] = useState(false);
  const { blocked, block } = usePinBlock();

  const next = async () => {
    if (pin.length !== NEW_PIN_LEN || busy || blocked) return;
    if (first === null) {
      setFirst(pin);
      setPin('');
      setWhy(null);
      return;
    }
    if (pin !== first) {
      notify('error');
      setWhy('PIN не совпал с первым — придумайте заново');
      setShake(true);
      setTimeout(() => { setPin(''); setFirst(null); setShake(false); }, 400);
      return;
    }
    setBusy(true);
    setWhy(null);
    try {
      await createPin(pin);
      setPin('');
      setFirst(null);
      onDone();
    } catch (e) {
      block(e);
      notify('error');
      setWhy(pinErrorText(e, 'setup', role));
      setPin('');
      setFirst(null);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <p className="muted" style={{ fontSize: 13 }}>
        {first === null
          ? `Придумайте PIN для кабинета: ${NEW_PIN_LEN} цифры. Его знаете только вы.`
          : 'Повторите PIN'}
      </p>
      <PinPad value={pin} onChange={(v) => { setPin(v); setWhy(null); }} disabled={busy || blocked || shake} shake={shake} max={NEW_PIN_LEN} />
      {why && <p className="form-why" role="alert">{why}</p>}
      <button
        className="btn btn-primary btn-block mt-md"
        disabled={pin.length !== NEW_PIN_LEN || busy || blocked}
        onClick={() => { void next(); }}
      >
        {busy ? 'Сохраняем…' : first === null ? 'Дальше' : 'Сохранить PIN'}
      </button>
    </>
  );
}

function ChangePinForm({ onDone, role, forced = false }: { onDone: () => void; role: StaffRole; forced?: boolean }) {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [again, setAgain] = useState('');
  const [busy, setBusy] = useState(false);
  const [why, setWhy] = useState<string | null>(null);
  const { blocked, block } = usePinBlock();

  // Текущий — как его примет сервер (4–8); новый — ровно 4, лишнего поле не берёт.
  const digits = (v: string, max: number) => v.replace(/\D/g, '').slice(0, max);
  const ready = current.length >= PIN_MIN && next.length === NEW_PIN_LEN && again.length === NEW_PIN_LEN;

  const save = async () => {
    if (!ready || busy || blocked) return;
    if (next !== again) { setWhy('Новый PIN не совпал с повтором'); notify('error'); return; }
    setBusy(true);
    setWhy(null);
    try {
      await changePin(current, next);
      setCurrent(''); setNext(''); setAgain('');
      notify('success');
      toast(forced ? 'Ваш PIN сохранён' : 'PIN изменён — войдите новым', 'success');
      onDone();
    } catch (e) {
      block(e);
      notify('error');
      setWhy(pinErrorText(e, 'change', role));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      {!forced && (
        <button className="gate-back row" onClick={() => { tap(); onDone(); }}>
          <Icon name="chevron-left" size={16} strokeWidth={2.2} />
          <span>Назад к вводу PIN</span>
        </button>
      )}
      <label className="field">
        <span className="field-k">{forced ? 'Временный PIN от Анжелики' : 'Текущий PIN'}</span>
        <input className="input" type="password" inputMode="numeric" autoComplete="off"
          value={current} onChange={(e) => { setCurrent(digits(e.target.value, PIN_MAX)); setWhy(null); }} />
      </label>
      <label className="field">
        <span className="field-k">Новый PIN, {NEW_PIN_LEN} цифры</span>
        <input className="input" type="password" inputMode="numeric" autoComplete="off" maxLength={NEW_PIN_LEN}
          value={next} onChange={(e) => { setNext(digits(e.target.value, NEW_PIN_LEN)); setWhy(null); }} />
      </label>
      <label className="field">
        <span className="field-k">Новый PIN ещё раз</span>
        <input className="input" type="password" inputMode="numeric" autoComplete="off"
          maxLength={NEW_PIN_LEN}
          value={again} onChange={(e) => { setAgain(digits(e.target.value, NEW_PIN_LEN)); setWhy(null); }} />
      </label>
      {why && <p className="form-why" role="alert">{why}</p>}
      <button className="btn btn-primary btn-block mt-md" disabled={!ready || busy || blocked} onClick={() => { void save(); }}>
        {busy ? 'Сохраняем…' : 'Сменить PIN'}
      </button>
    </>
  );
}
