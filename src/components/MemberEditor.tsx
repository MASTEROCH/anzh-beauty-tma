import { useRef, useState } from 'react';
import { Icon } from './Icon';
import { ListEditor } from './ServiceEditor';
import { asset } from '../lib/asset';
import { openSheet, closeSheet, toast } from '../lib/ui';
import { notify, tap, select } from '../lib/haptics';
import { cabinetDenied } from '../lib/staff';
import { uploadFile, PhotoError } from '../lib/photoLibrary';
import {
  patchTeamMember, setMemberServices, setMemberPin, resetMemberPin, setTeamOrder,
  type StaffMember, type WireService, type MemberProfile, type Bi,
} from '../lib/api/staff';

/*
   КАРТОЧКА СОТРУДНИКА — всё, что владелица меняет о человеке (Роч 15.10):
   фото, имя и должность на двух языках, роль доступа, регалии и «чем
   занимается», процедуры, контакты, показ в «Команде» на сайте и порядок,
   PIN (задать — человек сменит его при входе; сбросить — задаст сам).
   Сохраняется одной кнопкой; порядок и PIN — сразу, отдельными действиями.
   Цены живут у процедур (одна цена на студию) — здесь только ссылка-подсказка.
*/

const EMPTY_BI: Bi = { ru: '', en: '' };
const bi = (v: Partial<Bi> | null | undefined): Bi => ({ ru: v?.ru ?? '', en: v?.en ?? '' });

const ROLE_HELP: Record<'staff' | 'admin', string> = {
  staff: 'Видит свои записи, своих клиенток и свой доход.',
  admin: 'Видит записи всех мастеров и клиенток, отвечает в чате. Без денег студии и без настроек.',
};

export function openMemberEditor(person: StaffMember, ctx: {
  services: WireService[];
  teamOrder: number[];
  isSelf: boolean;
  onChanged: () => void;
}) {
  openSheet({
    title: 'Карточка сотрудника',
    subtitle: person.name,
    body: <MemberForm person={person} {...ctx} />,
  });
}

function MemberForm({ person, services, teamOrder, isSelf, onChanged }: {
  person: StaffMember; services: WireService[]; teamOrder: number[]; isSelf: boolean; onChanged: () => void;
}) {
  const p: Partial<MemberProfile> = person.profile ?? {};
  const owner = person.role === 'owner';
  const [L, setL] = useState<'ru' | 'en'>('ru');
  const [name, setName] = useState<Bi>({ ru: p.name?.ru || person.name, en: p.name?.en ?? '' });
  const [surname, setSurname] = useState<Bi>(bi(p.surname));
  const [roleTxt, setRoleTxt] = useState<Bi>({ ru: p.role?.ru || (person.title ?? ''), en: p.role?.en ?? '' });
  const [short, setShort] = useState<Bi>(bi(p.short));
  const [cred, setCred] = useState<Bi>(bi(p.cred));
  const [does, setDoes] = useState<{ ru: string[]; en: string[] }>({ ru: p.does?.ru ?? [], en: p.does?.en ?? [] });
  const [access, setAccess] = useState<'staff' | 'admin'>(person.role === 'admin' ? 'admin' : 'staff');
  const [slugs, setSlugs] = useState<string[]>(person.services ?? []);
  const [photo, setPhoto] = useState<string | null>(person.photo_url ?? null);
  const [instagram, setInstagram] = useState(p.instagram ?? '');
  const [telegram, setTelegram] = useState(p.telegram ?? '');
  const [phone, setPhone] = useState(p.phone ?? '');
  const [contactsPublic, setContactsPublic] = useState(!!p.contacts_public);
  const [visible, setVisible] = useState(p.visible ?? false);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [why, setWhy] = useState<string | null>(null);
  const file = useRef<HTMLInputElement>(null);

  const ready = name.ru.trim().length > 0 && !uploading;

  const pickPhoto = async (f: File | undefined) => {
    if (!f) return;
    setUploading(true);
    setWhy(null);
    try {
      setPhoto(await uploadFile(f));
      select();
    } catch (e) {
      setWhy(e instanceof PhotoError ? e.message : 'Фото не загрузилось — проверьте связь');
    } finally {
      setUploading(false);
      if (file.current) file.current.value = '';
    }
  };

  const save = async () => {
    if (!ready || busy) return;
    setBusy(true);
    setWhy(null);
    try {
      const profile: Partial<MemberProfile> = {
        name: { ru: name.ru.trim(), en: name.en.trim() || name.ru.trim() },
        surname: surname.ru.trim() ? { ru: surname.ru.trim(), en: surname.en.trim() || surname.ru.trim() } : null,
        role: { ru: roleTxt.ru.trim(), en: roleTxt.en.trim() || roleTxt.ru.trim() },
        short: short.ru.trim() ? { ru: short.ru.trim(), en: short.en.trim() || short.ru.trim() } : null,
        cred: cred.ru.trim() ? { ru: cred.ru.trim(), en: cred.en.trim() || cred.ru.trim() } : null,
        does: { ru: does.ru, en: does.en.length ? does.en : does.ru },
        instagram: instagram.trim().replace(/^@/, '') || null,
        telegram: telegram.trim().replace(/^@/, '') || null,
        phone: phone.trim() || null,
        contacts_public: contactsPublic,
        visible,
      };
      await patchTeamMember(person.telegram_id, {
        name: name.ru.trim(),
        title: roleTxt.ru.trim() || null,
        ...(owner || isSelf ? {} : { role: access }),
        photo_url: photo,
        profile,
      });
      const before = [...(person.services ?? [])].sort().join(',');
      if (!owner && [...slugs].sort().join(',') !== before) await setMemberServices(person.telegram_id, slugs);
      notify('success');
      closeSheet();
      toast(`${name.ru.trim()}: карточка сохранена`, 'success');
      onChanged();
    } catch (e) {
      cabinetDenied(e);
      notify('error');
      setWhy('Не сохранилось — проверьте связь и повторите');
    } finally {
      setBusy(false);
    }
  };

  const move = async (step: -1 | 1) => {
    const order = [...teamOrder];
    const i = order.indexOf(person.telegram_id);
    const j = i + step;
    if (i < 0 || j < 0 || j >= order.length) return;
    [order[i], order[j]] = [order[j], order[i]];
    tap();
    try {
      await setTeamOrder(order);
      toast(step < 0 ? 'Поднят выше в «Команде»' : 'Опущен ниже в «Команде»', 'success');
      onChanged();
      teamOrder.splice(0, teamOrder.length, ...order);
    } catch (e) {
      cabinetDenied(e);
      toast('Порядок не сохранился — повторите');
    }
  };
  const pos = teamOrder.indexOf(person.telegram_id);

  return (
    <div className="me">
      {/* ── Фото ── */}
      <div className="me-photo">
        <span className="me-photo-ph">
          {photo ? <img src={asset(photo)} alt="" /> : <span>{name.ru.slice(0, 1) || '?'}</span>}
          {uploading && <span className="me-photo-wait"><span className="ct-spin" /></span>}
        </span>
        <div className="me-photo-acts">
          <button className="chip chip-gold" onClick={() => { tap(); file.current?.click(); }} disabled={uploading}>
            <Icon name="upload" size={13} strokeWidth={2.2} /> {photo ? 'Заменить фото' : 'Загрузить фото'}
          </button>
          {photo && <button className="chip" onClick={() => { tap(); setPhoto(null); }}>Убрать</button>}
          <input ref={file} type="file" accept="image/*" hidden onChange={(e) => { void pickPhoto(e.target.files?.[0]); }} />
        </div>
        <p className="faint pe-hint">Квадратное фото, лицо по центру. Так оно встанет в кружок «Команды».</p>
      </div>

      {/* ── Имя и должность ── */}
      <div className="pe-sect">
        <div className="pe-sect-head">
          <span className="eyebrow">Как подписан на сайте</span>
          <div className="pe-lang" role="tablist" aria-label="Язык текстов">
            {(['ru', 'en'] as const).map((l) => (
              <button key={l} role="tab" aria-selected={L === l} className={L === l ? 'on' : ''} onClick={() => setL(l)}>{l.toUpperCase()}</button>
            ))}
          </div>
        </div>
        <div className="se-two">
          <label className="se-field"><span>Имя{L === 'en' ? ' · EN' : ''}</span>
            <input value={name[L]} maxLength={40} onChange={(e) => setName({ ...name, [L]: e.target.value })} placeholder={L === 'ru' ? 'Мария' : 'Maria'} />
          </label>
          <label className="se-field"><span>Фамилия</span>
            <input value={surname[L]} maxLength={40} onChange={(e) => setSurname({ ...surname, [L]: e.target.value })} placeholder={L === 'ru' ? 'необязательно' : 'optional'} />
          </label>
        </div>
        <label className="se-field"><span>Должность</span>
          <input value={roleTxt[L]} maxLength={60} onChange={(e) => setRoleTxt({ ...roleTxt, [L]: e.target.value })} placeholder={L === 'ru' ? 'Врач-дерматолог' : 'Dermatologist'} />
        </label>
        <label className="se-field"><span>Подпись под фото (коротко)</span>
          <input value={short[L]} maxLength={16} onChange={(e) => setShort({ ...short, [L]: e.target.value })} placeholder={L === 'ru' ? 'Дерматолог' : 'Dermatologist'} />
        </label>
      </div>

      {/* ── Роль доступа ── */}
      {!owner && !isSelf && (
        <div className="pe-sect">
          <div className="pe-sect-head"><span className="eyebrow">Доступ в кабинет</span></div>
          <div className="seg" role="radiogroup" aria-label="Роль">
            {([['staff', 'Мастер'], ['admin', 'Администратор']] as const).map(([v, label]) => (
              <button key={v} role="radio" aria-checked={access === v} className={`seg-btn${access === v ? ' active' : ''}`} onClick={() => { select(); setAccess(v); }}>
                {label}
              </button>
            ))}
          </div>
          <p className="faint pe-hint">{ROLE_HELP[access]}</p>
        </div>
      )}

      {/* ── О специалисте ── */}
      <div className="pe-sect">
        <div className="pe-sect-head"><span className="eyebrow">О специалисте · {L.toUpperCase()}</span></div>
        <label className="se-field"><span>Регалии одной строкой</span>
          <input value={cred[L]} maxLength={160} onChange={(e) => setCred({ ...cred, [L]: e.target.value })} placeholder={L === 'ru' ? 'Образование, стаж, сертификаты' : 'Education, experience, certificates'} />
        </label>
        <div className="se-field"><span>Чем занимается</span></div>
        <ListEditor
          items={does[L]}
          onChange={(next) => setDoes({ ...does, [L]: next })}
          placeholder={L === 'ru' ? 'Например: лечение акне' : 'For example: acne treatment'}
          addLabel="Добавить пункт"
          max={8}
        />
      </div>

      {/* ── Процедуры ── */}
      {!owner && access === 'staff' && (
        <div className="pe-sect">
          <div className="pe-sect-head"><span className="eyebrow">Какие процедуры ведёт · {slugs.length}</span></div>
          <div className="chips-wrap">
            {services.map((s) => (
              <button key={s.slug} className={`chip${slugs.includes(s.slug) ? ' chip-gold' : ''}`} aria-pressed={slugs.includes(s.slug)}
                onClick={() => { tap(); setSlugs((prev) => (prev.includes(s.slug) ? prev.filter((x) => x !== s.slug) : [...prev, s.slug])); }}>
                {s.title.ru}
              </button>
            ))}
          </div>
          <p className="faint pe-hint">Заявки на эти процедуры уходят ему. Цены — в «Студия → Процедуры»: цена одна для всей студии.</p>
        </div>
      )}

      {/* ── Контакты ── */}
      <div className="pe-sect">
        <div className="pe-sect-head"><span className="eyebrow">Контакты</span></div>
        <div className="se-two">
          <label className="se-field"><span>Telegram</span>
            <input value={telegram} onChange={(e) => setTelegram(e.target.value)} placeholder="@username" autoCapitalize="none" />
          </label>
          <label className="se-field"><span>Instagram</span>
            <input value={instagram} onChange={(e) => setInstagram(e.target.value)} placeholder="@nickname" autoCapitalize="none" />
          </label>
        </div>
        <label className="se-field"><span>Телефон</span>
          <input value={phone} inputMode="tel" onChange={(e) => setPhone(e.target.value)} placeholder="+995 5XX XXX XXX" />
        </label>
        <label className="pe-toggle">
          <input type="checkbox" checked={contactsPublic} onChange={(e) => { select(); setContactsPublic(e.target.checked); }} />
          <span className="pe-toggle-box" aria-hidden />
          <span className="pe-toggle-text">Показывать клиенткам<small>В карточке специалиста на сайте появятся кнопки связи</small></span>
        </label>
      </div>

      {/* ── На сайте ── */}
      <div className="pe-sect">
        <div className="pe-sect-head"><span className="eyebrow">На сайте</span></div>
        <label className="pe-toggle">
          <input type="checkbox" checked={visible} onChange={(e) => { select(); setVisible(e.target.checked); }} />
          <span className="pe-toggle-box" aria-hidden />
          <span className="pe-toggle-text">Показывать в «Команде»<small>{photo ? 'В «О нас», кружком с подписью' : 'Без фото покажем инициал — лучше загрузить фото'}</small></span>
        </label>
        {pos >= 0 && teamOrder.length > 1 && (
          <div className="me-order">
            <span className="faint">Место в «Команде»: {pos + 1} из {teamOrder.length}</span>
            <button className="chip" disabled={pos === 0} onClick={() => { void move(-1); }} aria-label="Выше">↑ выше</button>
            <button className="chip" disabled={pos === teamOrder.length - 1} onClick={() => { void move(1); }} aria-label="Ниже">↓ ниже</button>
          </div>
        )}
      </div>

      {/* ── PIN ── */}
      <PinBlock person={person} isSelf={isSelf} />

      {why && <p className="form-why" role="alert">{why}</p>}
      <div className="pe-save">
        <button className="btn btn-primary btn-block" disabled={!ready || busy} onClick={() => { void save(); }}>
          {busy ? 'Сохраняем…' : uploading ? 'Загружаем фото…' : !name.ru.trim() ? 'Впишите имя' : 'Сохранить'}
        </button>
      </div>
    </div>
  );
}

function PinBlock({ person, isSelf }: { person: StaffMember; isSelf: boolean }) {
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);
  if (isSelf) {
    return (
      <div className="pe-sect">
        <div className="pe-sect-head"><span className="eyebrow">PIN</span></div>
        <p className="faint pe-hint">Свой PIN вы меняете на экране входа: «Сменить PIN». Чужой здесь не виден никому.</p>
      </div>
    );
  }
  const setIt = async () => {
    if (!/^\d{4}$/.test(pin) || busy) return;
    setBusy(true);
    try {
      await setMemberPin(person.telegram_id, pin);
      notify('success');
      toast(`${person.name}: PIN задан — при входе предложим сменить`, 'success');
      setPin('');
    } catch (e) {
      cabinetDenied(e);
      notify('error');
      toast('PIN не сохранился — повторите');
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="pe-sect">
      <div className="pe-sect-head"><span className="eyebrow">PIN для входа</span>{person.must_change_pin && <span className="chip chip-amber">сменит при входе</span>}</div>
      <div className="me-pin">
        <input
          className="me-pin-input"
          value={pin}
          inputMode="numeric"
          autoComplete="off"
          maxLength={4}
          placeholder="••••"
          aria-label={`Новый PIN для ${person.name}`}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
        />
        <button className="btn btn-secondary" disabled={pin.length !== 4 || busy} onClick={() => { void setIt(); }}>
          {busy ? '…' : 'Задать PIN'}
        </button>
      </div>
      <p className="faint pe-hint">Передайте PIN человеку лично. При первом входе он задаст свой — ваш перестанет работать.</p>
      <button className="btn btn-quiet btn-block" onClick={() => openPinReset(person)}>Сбросить PIN — задаст сам</button>
    </div>
  );
}

function openPinReset(person: StaffMember) {
  tap();
  openSheet({
    title: 'Сбросить PIN?',
    subtitle: person.name,
    body: (
      <p className="muted" style={{ fontSize: 14, lineHeight: 1.55 }}>
        Прежний PIN перестанет работать, открытый кабинет у {person.name} закроется. При следующем входе
        {' '}{person.name} задаст новый PIN сам(а) — вы его не узнаете.
      </p>
    ),
    actions: (
      <button className="btn btn-primary btn-block" onClick={async () => {
        try { await resetMemberPin(person.telegram_id); notify('success'); closeSheet(); toast(`${person.name}: PIN сброшен`, 'success'); }
        catch (e) { cabinetDenied(e); notify('error'); toast('Не получилось — повторите'); }
      }}>Да, сбросить PIN</button>
    ),
  });
}

export { EMPTY_BI };
