import { useCallback, useEffect, useState } from 'react';
import { Icon } from './Icon';
import { openSheet, closeSheet, toast } from '../lib/ui';
import { notify, select, tap } from '../lib/haptics';
import {
  getStaffModels, decideModel, getTrainingDays, saveTrainingDay, deleteTrainingDay, saveModelAgreement, getModelProgram,
  type StaffModel, type StaffTrainingDay, type ModelPrice, type ModelAgreement,
} from '../lib/api/models';
import { formatAmount } from '../lib/money';
import { findService, sTitle } from '../data/services';
import { liveServices } from '../lib/catalog';
import { cabinetDenied } from '../lib/staff';
import { openAddToCalendar } from './AddToCalendar';
import type { CalEvent } from '../lib/ics';
import { studioAddress } from '../data/location';
import { SheetSlot, SlotPortal } from './SheetSlot';

/* КАБИНЕТ · МОДЕЛИ (Роч 16.10). Модели нужны только в дни обучения.
   Лист ожидания → одобрить/отказать; дни обучения с местами по процедурам;
   условия соглашения (правит владелица, новая редакция = новая версия).
   Цена для моделей — в карточке процедуры («Цена для моделей»). */

type Sub = 'wait' | 'models' | 'days' | 'terms';
const TZ = 'Asia/Tbilisi';
const dayLabel = (iso: string) => { const t = new Date(iso).toLocaleDateString('ru-RU', { timeZone: TZ, weekday: 'short', day: 'numeric', month: 'long' }); return t.charAt(0).toUpperCase() + t.slice(1); };
const timeLabel = (iso: string) => new Date(iso).toLocaleTimeString('ru-RU', { timeZone: TZ, hour: '2-digit', minute: '2-digit' });
const AVAIL: Record<string, string> = { weekdays: 'будни', weekends: 'выходные', any: 'любой день' };
const titleOf = (slug: string, prices: ModelPrice[]) => prices.find((p) => p.slug === slug)?.title.ru ?? (findService(slug) ? sTitle(findService(slug)!, 'ru') : slug);

export function StudioModels({ isOwner }: { isOwner: boolean }) {
  const [sub, setSub] = useState<Sub>('wait');
  const [models, setModels] = useState<StaffModel[] | null>(null);
  const [days, setDays] = useState<StaffTrainingDay[] | null>(null);
  const [prices, setPrices] = useState<ModelPrice[]>([]);
  const [agreement, setAgreement] = useState<ModelAgreement | null>(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(() => {
    setFailed(false);
    Promise.all([getStaffModels(), getTrainingDays(), getModelProgram()]).then(([m, d, p]) => {
      setModels(m); setDays(d); setPrices(p.prices); setAgreement(p.agreement);
    }, (e) => { cabinetDenied(e); setFailed(true); });
  }, []);
  useEffect(load, [load]);

  const waiting = (models ?? []).filter((m) => m.status === 'pending');
  const approved = (models ?? []).filter((m) => m.status === 'approved');
  const SUBS: Array<[Sub, string, number | null]> = [
    ['wait', 'Лист ожидания', waiting.length], ['models', 'Модели', approved.length], ['days', 'Дни обучения', days?.length ?? null],
    ...(isOwner ? [['terms', 'Условия', null] as [Sub, string, null]] : []),
  ];

  const decide = async (m: StaffModel, status: 'approved' | 'declined' | 'none', reason?: string) => {
    try {
      await decideModel(m.telegram_id, status, reason);
      notify('success');
      toast(status === 'approved' ? `${m.name}: одобрена — бот сообщит` : status === 'declined' ? `${m.name}: отказ отправлен` : `${m.name} убрана из моделей`, 'success');
      load();
    } catch (e) { cabinetDenied(e); notify('error'); toast('Не сохранилось — проверьте интернет'); }
  };

  return (
    <section className="section section-tight sm">
      <div className="rv-filters mb-sm">
        {SUBS.map(([id, t, n]) => (
          <button key={id} className={`chip${sub === id ? ' chip-gold' : ''}`} onClick={() => { select(); setSub(id); }}>
            {t}{n ? <span className="chip-count">{n}</span> : null}
          </button>
        ))}
      </div>
      {failed && (
        <div className="card empty-state" role="alert">
          <div className="empty-title">Не загрузилось</div>
          <button className="btn btn-secondary btn-block mt-md" onClick={load}>Повторить</button>
        </div>
      )}
      {!failed && models === null && <div className="card" style={{ padding: 20, textAlign: 'center' }}><div className="muted">Загружаю…</div></div>}

      {sub === 'wait' && models && (
        waiting.length === 0
          ? <div className="card empty-card"><Icon name="check" size={26} strokeWidth={2} /><div className="muted mt-sm">Новых заявок нет</div></div>
          : <div className="stack-tight">{waiting.map((m) => (
            <article key={m.telegram_id} className="card sm-item">
              <div className="sm-top"><b>{m.name}</b><span>{m.applied_at ? new Date(m.applied_at).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }) : ''}</span></div>
              <div className="sm-line">{m.slugs.map((x) => titleOf(x, prices)).join(' · ')}</div>
              <div className="sm-line faint">Удобно: {AVAIL[m.availability ?? 'any']}{m.health_flags.length ? ` · в анкете: ${m.health_flags.join(', ')}` : ' · анкета здоровья не заполнена'}</div>
              <div className="sm-actions">
                <button className="btn btn-primary btn-sm" onClick={() => { void decide(m, 'approved'); }}>Одобрить</button>
                <button className="btn btn-secondary btn-sm studio-decline" onClick={() => openSheet({ title: 'Отказать', subtitle: m.name, body: <ReasonForm onSend={(r) => { closeSheet(); void decide(m, 'declined', r); }} /> })}>Отказать</button>
              </div>
            </article>
          ))}</div>
      )}

      {sub === 'models' && models && (
        approved.length === 0
          ? <div className="card empty-card"><Icon name="user" size={26} strokeWidth={2} /><div className="muted mt-sm">Одобренных моделей пока нет</div></div>
          : <div className="card" style={{ padding: 0, overflow: 'hidden' }}>{approved.map((m) => (
            <div key={m.telegram_id} className="studio-day-row sm-row">
              <div className="studio-client-av">{m.name.slice(0, 1).toUpperCase()}</div>
              <div className="studio-day-body">
                <div className="studio-day-name">{m.name}</div>
                <div className="studio-day-svc">{m.slugs.map((x) => titleOf(x, prices)).join(' · ')} · была моделью: {m.times_model}</div>
              </div>
              <button className="chip" onClick={() => { void decide(m, 'none'); }}>Убрать</button>
            </div>
          ))}</div>
      )}

      {sub === 'days' && days && (
        <>
          <button className="btn btn-primary btn-block mb" onClick={() => openDayEditor(prices, load)}><Icon name="plus" size={16} strokeWidth={2.4} /> День обучения</button>
          {prices.length === 0 && <p className="form-why">Сначала задайте «Цену для моделей» в карточках процедур — без неё процедуру нельзя предложить моделям.</p>}
          {days.length === 0 && <div className="card empty-card"><Icon name="calendar" size={26} strokeWidth={2} /><div className="muted mt-sm">Дней обучения пока нет</div></div>}
          <div className="stack-tight">{days.map((d) => (
            <article key={d.id} className="card sm-item">
              <div className="sm-top"><b>{dayLabel(d.starts_at)}</b><span>{timeLabel(d.starts_at)}–{timeLabel(d.ends_at)}</span></div>
              {d.course_slug && <div className="sm-line faint">{findService(d.course_slug) ? sTitle(findService(d.course_slug)!, 'ru') : d.course_slug}</div>}
              {d.slots.map((x) => (
                <div key={x.slug} className="sm-slot">
                  <span>{titleOf(x.slug, prices)}</span>
                  <b className={x.taken >= x.spots ? 'full' : ''}>{x.taken} / {x.spots}</b>
                </div>
              ))}
              {d.bookings.length > 0 && <div className="sm-line">Модели: {d.bookings.map((b) => `${b.name} (${titleOf(b.slug, prices)})`).join(', ')}</div>}
              <div className="sm-actions">
                <button className="btn btn-secondary btn-sm" onClick={() => openDayEditor(prices, load, d)}>Изменить</button>
                <button className="btn btn-secondary btn-sm studio-decline" onClick={() => {
                  const ev: CalEvent[] = d.bookings.map((b) => ({ uid: `model-${b.id}@anzh.tma`, start: new Date(d.starts_at), durationMin: Math.round((Date.parse(d.ends_at) - Date.parse(d.starts_at)) / 60000), title: `Модель: ${b.name} · ${titleOf(b.slug, prices)}`, location: studioAddress('ru'), description: 'День обучения ANZH', alarmMin: 60 }));
                  openAddToCalendar(ev.length ? ev : [{ uid: `td-${d.id}@anzh.tma`, start: new Date(d.starts_at), durationMin: Math.round((Date.parse(d.ends_at) - Date.parse(d.starts_at)) / 60000), title: 'День обучения ANZH', location: studioAddress('ru'), description: d.slots.map((x) => titleOf(x.slug, prices)).join(', '), alarmMin: 60 }], 'ru', `anzh-training-${d.date}.ics`);
                }}><Icon name="calendar" size={14} strokeWidth={2} /> В календарь</button>
              </div>
            </article>
          ))}</div>
        </>
      )}

      {sub === 'terms' && isOwner && agreement && <TermsEditor agreement={agreement} onSaved={load} />}
    </section>
  );
}

function ReasonForm({ onSend }: { onSend: (reason: string) => void }) {
  const [t, setT] = useState('');
  return (
    <>
      <p className="muted mb-sm" style={{ fontSize: 13 }}>Причину увидит клиентка — коротко и по делу. Можно оставить пустым.</p>
      <textarea className="input" rows={3} maxLength={300} value={t} onChange={(e) => setT(e.target.value)} placeholder="Например: на эту процедуру модели набраны до конца года" />
      <button className="btn btn-primary btn-block mt-md" onClick={() => onSend(t.trim())}>Отправить отказ</button>
    </>
  );
}

function openDayEditor(prices: ModelPrice[], onSaved: () => void, day?: StaffTrainingDay) {
  tap();
  openSheet({ title: day ? 'День обучения' : 'Новый день обучения', subtitle: 'Модели увидят его и смогут записаться', body: <DayForm prices={prices} day={day} onSaved={onSaved} />, actions: <SheetSlot name="training-day" /> });
}

function DayForm({ prices, day, onSaved }: { prices: ModelPrice[]; day?: StaffTrainingDay; onSaved: () => void }) {
  const courses = liveServices().filter((x) => x.category === 'training');
  const [date, setDate] = useState(day?.date ?? new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10));
  const [from, setFrom] = useState(day ? timeLabel(day.starts_at) : '10:00');
  const [to, setTo] = useState(day ? timeLabel(day.ends_at) : '16:00');
  const [course, setCourse] = useState<string | null>(day?.course_slug ?? courses[0]?.id ?? null);
  const [spots, setSpots] = useState<Record<string, number>>(() => Object.fromEntries((day?.slots ?? []).map((x) => [x.slug, x.spots])));
  const [busy, setBusy] = useState(false);
  const [why, setWhy] = useState<string | null>(null);
  const slots = Object.entries(spots).filter(([, n]) => n > 0).map(([slug, n]) => ({ slug, spots: n }));
  const save = async () => {
    setBusy(true); setWhy(null);
    try {
      await saveTrainingDay({ date, from, to, course_slug: course, slots }, day?.id);
      notify('success'); closeSheet(); toast(day ? 'День обучения сохранён' : 'День обучения создан — модели его видят', 'success'); onSaved();
    } catch (e) {
      cabinetDenied(e); notify('error');
      setWhy(e instanceof Error && e.message ? e.message : 'Не сохранилось — проверьте интернет');
    } finally { setBusy(false); }
  };
  const remove = async () => {
    if (!day) return;
    try { await deleteTrainingDay(day.id); notify('success'); closeSheet(); toast('День удалён'); onSaved(); }
    catch (e) { notify('error'); setWhy(e instanceof Error && e.message ? e.message : 'Не удалось удалить'); }
  };
  return (
    <div className="mdl-form">
      <div className="se-two">
        <label className="se-field"><span>Дата</span><input type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} /></label>
        <label className="se-field"><span>Курс</span>
          <select className="input" value={course ?? ''} onChange={(e) => setCourse(e.target.value || null)}>
            <option value="">— без курса —</option>
            {courses.map((c) => <option key={c.id} value={c.id}>{sTitle(c, 'ru')}</option>)}
          </select>
        </label>
      </div>
      <div className="se-two">
        <label className="se-field"><span>С</span><input type="time" className="input" value={from} onChange={(e) => setFrom(e.target.value)} /></label>
        <label className="se-field"><span>До</span><input type="time" className="input" value={to} onChange={(e) => setTo(e.target.value)} /></label>
      </div>
      <div className="eyebrow">сколько моделей на каждую процедуру</div>
      <div className="sm-steppers">
        {prices.map((p) => {
          const n = spots[p.slug] ?? 0;
          return (
            <div key={p.slug} className="sm-stepper">
              <span><b>{p.title.ru}</b><span>{formatAmount(p.model_price_minor, p.currency, 'ru')} для модели</span></span>
              <div className="sm-step">
                <button className="chip" aria-label={`Меньше: ${p.title.ru}`} disabled={n === 0} onClick={() => { select(); setSpots((x) => ({ ...x, [p.slug]: Math.max(0, n - 1) })); }}>−</button>
                <b>{n}</b>
                <button className="chip" aria-label={`Больше: ${p.title.ru}`} disabled={n >= 20} onClick={() => { select(); setSpots((x) => ({ ...x, [p.slug]: Math.min(20, n + 1) })); }}>+</button>
              </div>
            </div>
          );
        })}
      </div>
      {why && <p className="form-why" role="alert">{why}</p>}
      <SlotPortal name="training-day">
        <button className="btn btn-primary btn-block" disabled={busy || slots.length === 0 || from >= to} onClick={() => { void save(); }}>
          {busy ? 'Сохраняю…' : slots.length === 0 ? 'Добавьте хотя бы одно место' : day ? 'Сохранить день' : 'Создать день обучения'}
        </button>
        {day && <button className="btn btn-quiet btn-block" onClick={() => { void remove(); }}>Удалить день</button>}
      </SlotPortal>
    </div>
  );
}

function TermsEditor({ agreement, onSaved }: { agreement: ModelAgreement; onSaved: () => void }) {
  const [ru, setRu] = useState(agreement.ru);
  const [en, setEn] = useState(agreement.en);
  const [busy, setBusy] = useState(false);
  const changed = ru.trim() !== agreement.ru || en.trim() !== agreement.en;
  const save = async () => {
    setBusy(true);
    try { await saveModelAgreement(ru.trim(), en.trim()); notify('success'); toast('Условия обновлены — новые заявки примут новую редакцию', 'success'); onSaved(); }
    catch (e) { cabinetDenied(e); notify('error'); toast('Не сохранилось — проверьте интернет'); }
    finally { setBusy(false); }
  };
  return (
    <div className="mdl-form">
      <p className="faint" style={{ fontSize: 13, margin: 0 }}>Каждая строка — отдельный пункт. Редакция {agreement.version}: после сохранения появится новая, и заявки будут подаваться на неё.</p>
      <label className="se-field"><span>Условия · RU</span><textarea className="input" rows={8} value={ru} onChange={(e) => setRu(e.target.value)} /></label>
      <label className="se-field"><span>Условия · EN</span><textarea className="input" rows={6} value={en} onChange={(e) => setEn(e.target.value)} /></label>
      <button className="btn btn-primary btn-block" disabled={!changed || busy || ru.trim().length < 20} onClick={() => { void save(); }}>{busy ? 'Сохраняю…' : 'Сохранить условия'}</button>
    </div>
  );
}
