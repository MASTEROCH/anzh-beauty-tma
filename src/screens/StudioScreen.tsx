import { StudioModels } from '../components/StudioModels';
import { StudioExport } from '../components/StudioExport';
import { openAddToCalendar } from '../components/AddToCalendar';
import { eventOfVisit } from '../lib/calendarStaff';
import { useEffect, useMemo, useState } from 'react';
import { durationLabel, plural } from '../lib/plural';
import { Icon, type IconName } from '../components/Icon';
import { StudioAsk } from '../components/StudioAsk';
import { ClientStrip, clientNameOf, openClientCard } from '../components/ClientCardView';
import { MoneyBoard } from '../components/MoneyBoard';
import { StudioProcedures } from '../components/StudioProcedures';
import { StudioAbout } from '../components/StudioAbout';
import { PromoStudio } from '../components/PromoStudio';
import { StudioTeam } from '../components/StudioTeam';
import { StudioPassportRules } from '../components/StudioPassportRules';
import { StudioPromos } from '../components/StudioPromos';
import { StudioReviews } from '../components/StudioReviews';
import { StoryQueue } from '../components/StoryQueue';
import { useStaffInbox } from '../lib/staffInbox';
import { StudioChats } from '../components/StudioChats';
import { ClientRevenue } from '../components/ClientRevenue';
import { PinGate } from '../components/PinGate';
import { useCabinet, accessOf, lockCabinet, cabinetDenied } from '../lib/staff';
import { openSheet, closeSheet, toast } from '../lib/ui';
import { notify, tap } from '../lib/haptics';
import { findService, servicePhoto } from '../data/services';
import { ApiError } from '../lib/session';
import { patchService, type WireService } from '../lib/api/staff';
import type { ClientSummary } from '../lib/api/clients';
import { applyOwnerEdit } from '../lib/catalog';
import {
  useStaffList, useClientsList, loadList, loadClients,
  useLiveServices, useArchivedServices, loadLiveServices, applyService,
  decideVisit, decisionErrorText, loadErrorText,
  pendingOf, dayOf, shiftSummary, noShowInsight, revenueByCategory, topServices,
  formatMoney, formatShort, minorToInput, parseMoneyInput, revenueMinor, visitTitle, salonTodayISO, STATUS_WORD, serviceBySlug,
  byCurrency, formatMoneyParts, currencyTitle,
  type Visit, type ListState, type CategorySlice,
} from '../lib/studio';
import { currencySign } from '../lib/money';
import { addDaysISO } from '../lib/appointments';

// Кабинет мастера. Анжелика сказала прямо: список, который сам всё
// запланировал, ей не нужен — она хочет видеть каждую заявку и решать руками
// (принять / отклонить), потому что параллельно ведёт записи по телефону и
// из инстаграма.
//
// Всё — с сервера: заявки и день (GET /staff/bookings), решения
// (PATCH /bookings/{id}), клиентки (GET /clients), прайс и команда. Роль —
// из GET /staff/me. Мастер видит СВОИ записи и свой доход: сервер отдаёт
// ему только их, а `scope=all` фронт просит лишь у владелицы.

/* Пять пунктов нижней навигации — первичные места, куда мастер ходит
   каждый день. Всё, что настраивают раз в месяц (прайс, команда), живёт под
   «Студией» — она только у владелицы: ни одной её ручки сервер мастеру
   не откроет. */
type Tab = 'requests' | 'day' | 'clients' | 'money' | 'studio';
type StudioTab = 'price' | 'team' | 'about' | 'promo' | 'reviews' | 'stories' | 'export';
type ClientsTab = 'base' | 'money' | 'chats' | 'models';

/* ВТОРОЙ РЯД (решение ночи 24.09): чаты, акции, сторис, отзывы и задания
   скрыты — сервер их сегодня не ведёт, а экран не обещает того, чего сервер
   не даст. Код не удалён: включить — поднять флаг, когда появятся ручки.
   «Предложить другое время» тоже скрыто: статуса `offered` в проводе нет. */
const SECOND_ROW = false;

const SEGMENTS: Array<['all' | 'due' | 'lapsed' | 'new', string]> = [
  ['all', 'Все'], ['due', 'Пора вернуть'], ['lapsed', 'Давно не была'], ['new', 'Новые'],
];
const daysAgo = (iso?: string | null) => (iso ? Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 86_400_000)) : 0);
/** Причина одной строкой: зачем писать этой клиентке сегодня */
function segmentWhy(c: ClientSummary): string | null {
  const d = c.due?.[0];
  if (d) return `пора повторить: ${serviceBySlug(d.slug)?.title.ru ?? d.title_ru ?? d.slug} — была ${daysAgo(d.last_at)} дн. назад`;
  if (c.segments?.includes('lapsed')) return `не была ${daysAgo(c.last_visit)} дн.`;
  return null;
}

export function StudioScreen({ onExit }: { onExit: () => void }) {
  const cab = useCabinet();
  const me = cab.me;
  const can = accessOf(me);
  const open = cab.phase === 'open';

  /* Вторая линия: экран открыт без подтверждённого кабинета — внутри
     показывать нечего. PIN умер посреди работы (перевход дал новую
     сессию) — просим PIN прямо здесь, не выкидывая из кабинета. */
  const relock = cab.phase === 'need_pin' || cab.phase === 'need_setup' || cab.phase === 'checking';
  useEffect(() => {
    if (open || relock) return;
    // Сервер перестал считать человека сотрудником (доступ снят) — сказать, а не молча выкинуть
    if (cab.phase === 'not_staff') toast('Доступ к кабинету закрыт');
    onExit();
  }, [open, relock, onExit, cab.phase]);

  const [tab, setTab] = useState<Tab>('requests');
  const [studioTab, setStudioTab] = useState<StudioTab>('price');
  const [clientsTab, setClientsTab] = useState<ClientsTab>('base');

  /* Вкладка переживает смену пользователя: мастер, войдя после владелицы,
     оказывался в «Студии», которой ему не положено. Возвращаем в начало. */
  useEffect(() => {
    if (tab === 'studio' && !can.manageTeam) setTab('requests');
  }, [tab, can.manageTeam]);

  const needHistory = open && (
    tab === 'money'
    || (tab === 'clients' && clientsTab === 'money')
    || (tab === 'studio' && studioTab === 'team')
    || tab === 'requests'
  );
  const queue = useStaffList('queue', open);
  const day = useStaffList('day', open);
  const history = useStaffList('history', needHistory);
  const clients = useClientsList(open);
  const [segment, setSegment] = useState<'all' | 'due' | 'lapsed' | 'new'>('all');
  useLiveServices();
  // Живые входящие: держим соединение весь кабинет, чтобы новое сообщение
  // клиентки было видно на любой вкладке (счётчик + всплывающая строка)
  const inbox = useStaffInbox(open && can.chats);
  /* Владелица — ещё и мастер: «Мои» оставляет только её записи. Админу —
     чтобы видеть записи всех и не путать со своими (своих у неё нет). */
  const [mine, setMine] = useState(false);
  const ownOnly = mine && can.seeAllAppointments;

  const myId = me?.telegram_id;
  const pending = useMemo(() => pendingOf(queue.visits).filter((v) => !ownOnly || v.staffId === myId), [queue.visits, ownOnly, myId]);
  const today = useMemo(() => dayOf(day.visits).filter((v) => !ownOnly || v.staffId === myId), [day.visits, ownOnly, myId]);
  const summaries = useMemo(() => {
    const m = new Map<number, ClientSummary>();
    for (const c of clients.list) m.set(c.telegram_id, c);
    return m;
  }, [clients.list]);

  // Деньги — только по списку, который сервер отдал смотрящему.
  const past = history.visits;
  const noShows = past.filter((v) => v.status === 'no_show');
  const insight = useMemo(() => noShowInsight(past), [past]);
  // Charts, donut and top — per currency: lari and dollars are never added (B1-B)
  const doneByCurrency = useMemo(() => byCurrency(past.filter((v) => v.status === 'done')), [past]);

  if (!open) {
    return (
      <div className="screen studio">
        <header className="header">
          <div className="header-lede">
            <div className="eyebrow">кабинет</div>
            <div className="header-title">{me?.name ?? 'Кабинет'}</div>
          </div>
        </header>
        <section className="section" style={{ paddingTop: 10 }}>
          {/* Списки стёрты при запирании и перечитаются сами, когда кабинет снова откроется */}
          {relock && <PinGate embedded onUnlock={() => { /* данные грузит useStaffList */ }} />}
        </section>
      </div>
    );
  }

  const showShift = () => {
    const sum = shiftSummary(day.visits);
    openSheet({
      title: 'Смена закрыта',
      subtitle: formatShort(sum.dateISO),
      body: (
        <>
          <div className="studio-client-stats">
            <div className="scs"><span className="scs-v">{sum.done}</span><span className="scs-k">приняла</span></div>
            <div className="scs"><span className="scs-v">{formatMoneyParts(sum.earned)}</span><span className="scs-k">заработано</span></div>
            <div className="scs"><span className="scs-v">{sum.noShow}</span><span className="scs-k">не пришли</span></div>
          </div>
          {sum.open > 0 && (
            <p className="muted" style={{ fontSize: 13, marginTop: 14 }}>
              Осталось незакрытых записей: {sum.open}. Отметь их как завершённые или как неявку —
              иначе выручка за день будет неполной.
            </p>
          )}
          <div className="eyebrow sub-head">завтра · {sum.nextDay.length}</div>
          {sum.nextDay.length === 0 ? (
            <p className="faint" style={{ fontSize: 13 }}>Завтра записей нет — можно выдохнуть.</p>
          ) : (
            <ul className="notif-timeline">
              {sum.nextDay.map((v) => (
                <li key={v.id}>
                  <span className="nt-when">{v.slot}</span>
                  <span className="nt-text">{v.clientName} · {visitTitle(v)}</span>
                </li>
              ))}
            </ul>
          )}
        </>
      ),
    });
  };

  const accept = async (v: Visit) => {
    try {
      await decideVisit(v.id, { status: 'confirmed' });
      notify('success');
      toast(`${v.clientName} — принято ✓`, 'success');
    } catch (e) {
      notify('error');
      toast(decisionErrorText(e));
    }
  };

  const declineSheet = (v: Visit) =>
    openSheet({
      title: 'Отклонить заявку',
      subtitle: `${v.clientName} · ${formatShort(v.dateISO)} ${v.slot}`,
      body: <DeclineForm visit={v} />,
    });

  const visitSheet = (v: Visit) => {
    if (v.status === 'confirmed') {
      openSheet({
        title: 'Процедура прошла',
        subtitle: `${v.clientName} · ${visitTitle(v)}`,
        body: <CompleteForm visit={v} summary={summaries.get(v.clientId)} />,
        actions: (
          <button className="btn btn-secondary btn-block" onClick={() => openAddToCalendar([eventOfVisit(v)], 'ru', `anzh-${v.dateISO}-${v.slot.replace(':', '')}.ics`)}>
            <Icon name="calendar" size={16} strokeWidth={1.9} /> В календарь
          </button>
        ),
      });
      return;
    }
    if (v.status === 'pending') {
      openSheet({
        title: 'Заявка ждёт решения',
        subtitle: `${v.clientName} · ${formatShort(v.dateISO)} ${v.slot}`,
        body: (
          <>
            <ClientStrip clientId={v.clientId} name={v.clientName} summary={summaries.get(v.clientId)} slugs={v.slugs} />
            <ul className="info-list mt"><li>{visitTitle(v)} · {v.durationMin} мин · {formatMoney(v.totalMinor, v.currency)}</li></ul>
          </>
        ),
        actions: (
          <>
            <button className="btn btn-primary btn-block" onClick={() => { closeSheet(); void accept(v); }}>Принять</button>
            <button className="btn btn-secondary btn-block" onClick={() => declineSheet(v)}>Отклонить</button>
            <button className="btn btn-secondary btn-block studio-decline" onClick={() => openAddToCalendar([eventOfVisit(v)], 'ru', `anzh-${v.dateISO}.ics`)}>
              <Icon name="calendar" size={16} strokeWidth={1.9} /> В календарь
            </button>
          </>
        ),
      });
      return;
    }
    openClientCard({ clientId: v.clientId, name: v.clientName, slugs: v.slugs });
  };

  return (
    /* 🚨 Навигация, вуаль и кнопка выхода — СНАРУЖИ `.screen`.

       `.screen` это прокручиваемый элемент. Абсолютно позиционированный
       ребёнок внутри него едет вместе с содержимым: после прокрутки
       навигация кабинета оказывалась посреди экрана, а «Выйти» уезжал
       за верхний край.

       `position: fixed` здесь не помог бы: `.screen` задаёт свой
       контекст наложения (z-index: 1), и фиксированный потомок остался
       бы внутри него. */
    <>
    <div className="screen studio">
      <header className="header">
        <div className="header-lede">
          <div className="eyebrow">{me?.role === 'owner' ? 'кабинет · владелица' : me?.role === 'admin' ? 'кабинет · администратор' : 'кабинет мастера'}</div>
          <div className="header-title">{me?.name ?? 'Кабинет'}</div>
        </div>
      </header>

      {/* Контекст дня — только в заявках и в расписании. */}
      {(tab === 'requests' || tab === 'day') && (
        <>
          {can.seeAllAppointments && me?.role === 'owner' && (
            <div className="studio-sub mine-switch" role="radiogroup" aria-label="Чьи записи">
              {([[false, 'Все мастера'], [true, 'Мои']] as Array<[boolean, string]>).map(([v, label]) => (
                <button key={label} role="radio" aria-checked={mine === v} className={`chip${mine === v ? ' chip-gold' : ''}`} onClick={() => setMine(v)}>
                  {label}
                </button>
              ))}
            </div>
          )}
          <NextUp today={today} />
          <StudioAsk queue={queue.visits} day={day.visits} history={history.visits} />
        </>
      )}

      {tab === 'requests' && (
        <section className="section" style={{ paddingTop: 10 }}>
          {/* Сторис на проверку — скидка −5 % за действие (владелица и администратор) */}
          {(can.manageTeam || can.chats) && <StoryQueue />}

          <ListNotice state={queue} kind="queue" />
          {queue.loaded && !queue.error && pending.length === 0 && (
            <div className="card" style={{ padding: 24, textAlign: 'center' }}>
              <Icon name="check" size={28} strokeWidth={2} style={{ color: 'var(--brand-primary)' }} />
              <div className="muted mt-sm">Новых заявок нет</div>
            </div>
          )}
          {pending.map((v) => (
            <article key={v.id} className="studio-req" data-booking={v.id}>
              <div className="studio-req-head">
                <div className="studio-req-who">
                  <div className="studio-req-name">{v.clientName}{v.isModel && <span className="sm-model-tag">модель · день обучения</span>}</div>
                  {can.seeAllAppointments && v.staffName && (
                    <div className="studio-req-ig">к мастеру: {v.staffName}</div>
                  )}
                </div>
                <span className="chip chip-amber">новая</span>
              </div>
              {/* Процедуры списком, а не строкой через «+» */}
              <ul className="studio-req-list">
                {v.titles.map((title, i) => (
                  <li key={`${v.slugs[i] ?? title}-${i}`}>
                    <Icon name={findService(v.slugs[i] ?? '')?.icon ?? 'sparkles'} size={14} strokeWidth={1.8} />
                    <span>{title}</span>
                  </li>
                ))}
              </ul>
              <div className="studio-req-when">
                <Icon name="calendar" size={14} strokeWidth={1.8} />
                {formatShort(v.dateISO)} · {v.slot}
                <span className="studio-req-sum">{v.durationMin} мин · {formatMoney(v.totalMinor, v.currency)}</span>
              </div>
              {v.note && <div className="studio-req-what">{v.note}</div>}
              {/* Кто пришёл — до кнопки «Принять», а не после */}
              <ClientStrip clientId={v.clientId} name={v.clientName} summary={summaries.get(v.clientId)} slugs={v.slugs} />
              <div className="studio-req-actions">
                <button className="btn btn-primary btn-sm" onClick={() => { void accept(v); }}>
                  Принять
                </button>
                <button className="btn btn-secondary btn-sm studio-decline" onClick={() => declineSheet(v)}>
                  Отклонить
                </button>
              </div>
            </article>
          ))}
        </section>
      )}

      {tab === 'day' && (
        <section className="section" style={{ paddingTop: 10 }}>
          <div className="row row-between mb-sm" style={{ alignItems: 'center' }}>
            <div className="eyebrow">сегодня · {today.length} {today.length === 1 ? 'запись' : 'записей'}</div>
            {today.some((v) => v.status === 'confirmed' || v.status === 'pending') && (
              <button className="section-link" onClick={() => openAddToCalendar(
                today.filter((v) => v.status === 'confirmed' || v.status === 'pending').map(eventOfVisit), 'ru', `anzh-day-${today[0]?.dateISO ?? 'today'}.ics`)}>
                <Icon name="calendar" size={13} strokeWidth={2} /> весь день в календарь
              </button>
            )}
          </div>
          <ListNotice state={day} kind="day" />
          {day.loaded && !day.error && today.length === 0 && (
            <div className="card" style={{ padding: 24, textAlign: 'center' }}>
              <div className="muted">Сегодня пусто</div>
            </div>
          )}
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            {today.map((v) => (
              <button key={v.id} className="studio-day-row" data-booking={v.id} onClick={() => visitSheet(v)}>
                <div className="studio-day-time">{v.slot}</div>
                <div className="studio-day-body">
                  <div className="studio-day-name">
                    {v.clientName}{v.isModel && <span className="sm-model-tag">модель</span>}
                    {can.seeAllAppointments && v.staffName && <span className="faint"> · {v.staffName}</span>}
                  </div>
                  <div className="studio-day-svc">
                    {visitTitle(v)} · {v.durationMin} мин
                    {v.status !== 'confirmed' && <span className="faint"> · {STATUS_WORD[v.status]}</span>}
                  </div>
                </div>
                <span className={`studio-dot ${v.status}`} style={v.status === 'no_show' ? { opacity: 0.35 } : undefined} />
              </button>
            ))}
          </div>
          <p className="faint" style={{ fontSize: 12, marginTop: 10 }}>
            Перед каждой записью придёт напоминание, кто следующий.
          </p>
        </section>
      )}

      {tab === 'clients' && (
        <section className="section section-tight">
          {/* Два взгляда на одних и тех же людей: список для работы и
              разрез по деньгам — «кто это» и «кто приносит». */}
          <div className="studio-sub">
            {([
              ['base', 'База'],
              ...(can.money ? [['money', 'По выручке']] : []),
              ...(can.chats ? [['chats', 'Переписка']] : []),
              ...(can.manageTeam || can.chats ? [['models', 'Модели']] : []),
            ] as Array<[ClientsTab, string]>)
              .map(([id, label]) => (
                <button
                  key={id}
                  className={`chip${clientsTab === id ? ' chip-gold' : ''}`}
                  onClick={() => setClientsTab(id)}
                >
                  {label}
                  {id === 'chats' && inbox.unread > 0 && <span className="chip-count">{inbox.unread}</span>}
                </button>
              ))}
          </div>

          {clientsTab === 'chats' && <StudioChats />}
          {/* Модели — тоже клиентки: лист ожидания, одобренные, дни обучения */}
          {clientsTab === 'models' && <StudioModels isOwner={can.editPrices} />}

          {clientsTab === 'money' && (
            <>
              <ListNotice state={history} kind="history" />
              {history.loaded && <ClientRevenue list={past} />}
            </>
          )}

          {clientsTab === 'base' && (
            <>
              <div className="eyebrow mb-sm">база · {clients.list.length} человек</div>
              {/* CRM-срезы: кого вернуть сегодня. Считает сервер (интервал
                  повтора — в карточке процедуры), здесь только фильтр. */}
              {clients.list.some((c) => (c.segments ?? []).length > 0) && (
                <div className="rv-filters mb-sm">
                  {SEGMENTS.map(([id, label]) => {
                    const n = id === 'all' ? clients.list.length : clients.list.filter((c) => c.segments?.includes(id)).length;
                    if (id !== 'all' && n === 0) return null;
                    return (
                      <button key={id} className={`chip${segment === id ? ' chip-gold' : ''}`} onClick={() => setSegment(id)}>
                        {label}<span className="chip-count">{n}</span>
                      </button>
                    );
                  })}
                </div>
              )}
              {clients.loading && !clients.loaded && (
                <div className="card empty-state"><div className="empty-sub">Загружаем клиенток…</div></div>
              )}
              {clients.error && (
                <div className="card empty-state" role="alert">
                  <div className="empty-title">Базу не загрузили</div>
                  <div className="empty-sub">{loadErrorText(clients.error)} — проверьте интернет.</div>
                  <button className="btn btn-secondary btn-block mt-md" onClick={() => { void loadClients(true); }}>Повторить</button>
                </div>
              )}
              {clients.loaded && !clients.error && clients.list.length === 0 && (
                <div className="card empty-state">
                  <div className="empty-icon"><Icon name="user" size={26} strokeWidth={1.7} /></div>
                  <div className="empty-title">База пустая</div>
                  <div className="empty-sub">
                    Она соберётся сама: каждая заявка заводит карточку с историей процедур.
                    Вести таблицу руками не нужно.
                  </div>
                </div>
              )}
              <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                {clients.list.filter((c) => segment === 'all' || c.segments?.includes(segment)).map((c) => {
                  const name = clientNameOf(c);
                  const why = segmentWhy(c);
                  return (
                    <button key={c.telegram_id} className="studio-day-row" onClick={() => openClientCard({ clientId: c.telegram_id, name })}>
                      <div className="studio-client-av">{name.replace(/^@/, '').slice(0, 1).toUpperCase()}</div>
                      <div className="studio-day-body">
                        <div className="studio-day-name">{name}</div>
                        <div className="studio-day-svc">
                          {c.username ? `@${c.username}` : 'без ника'} · {c.visits ?? 0} {plural(c.visits ?? 0, 'визит', 'визита', 'визитов')}
                          {(c.no_shows ?? 0) > 0 && <span className="studio-warn"> · {c.no_shows} неявк.</span>}
                        </div>
                        {why && <div className="studio-client-why">{why}</div>}
                      </div>
                      {/* No sum in the list (K13, F4; John's decision): the server's spent_minor adds up
                          every currency of her visits under one sign — lari and dollars mixed (B1-B forbids
                          it). The client card shows the sum by currency; the list waits for the server to
                          send it by currency (queued for the server side). */}
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </section>
      )}

      {tab === 'money' && (
        <section className="section" style={{ paddingTop: 10 }}>
          <ListNotice state={history} kind="history" />
          {history.loaded && !history.error && (
            <>
              {past.filter((v) => v.status === 'done').length === 0 && insight.total === 0 && (
                <div className="card empty-state mb">
                  <div className="empty-icon"><Icon name="sparkles" size={26} strokeWidth={1.7} /></div>
                  <div className="empty-title">Пока не с чего считать</div>
                  <div className="empty-sub">
                    Закрой первый визит во вкладке «День» — выручка, категории и топ услуг
                    посчитаются сами.
                  </div>
                </div>
              )}
              {/* Дашборд с периодом и сезоном: «стало лучше или хуже, с
                  поправкой на сезон». Разрез по мастерам — только владелице. */}
              <MoneyBoard list={past} showStaff={can.seeAllMoney} />
              <div className="studio-money mt">
                <div className="studio-money-row">
                  <span className="k">Неявки за два года</span>
                  <span className="v">{noShows.length}</span>
                </div>
              </div>
              {doneByCurrency.map((g) => (
                <CurrencyMoney key={g.currency ?? ''} list={g.list} currency={g.currency} titled={doneByCurrency.length > 1} />
              ))}

              {insight.total > 0 && (
                <div className="insight-card">
                  <div className="insight-head">
                    <Icon name="warning" size={16} strokeWidth={2} />
                    <span>Неявки: {insight.total} · потеряно {formatMoneyParts(insight.lost)}</span>
                  </div>
                  <ul className="info-list contra mt-sm">
                    {insight.worstWeekday && <li>Чаще всего не приходят в {insight.worstWeekday}</li>}
                    {insight.repeatOffenders.map((c) => (
                      <li key={c.name}>{c.name} — {c.count} раза. Стоит просить предоплату</li>
                    ))}
                    {!insight.worstWeekday && insight.repeatOffenders.length === 0 && <li>Разовые случаи, закономерности нет</li>}
                  </ul>
                </div>
              )}
            </>
          )}

          <button className="btn btn-quiet btn-block mt-md" onClick={showShift} disabled={!day.loaded}>
            Закрыть смену
          </button>

          <p className="faint" style={{ fontSize: 12, marginTop: 12 }}>
            Склад и расходники не считаем — заканчивается препарат, заказываешь, и всё.
          </p>
        </section>
      )}

      {tab === 'studio' && can.manageTeam && (
        <div className="studio-sub">
          {([
            ...(can.editPrices ? [['price', 'Процедуры']] : []),
            ...(can.manageTeam ? [['team', 'Команда'], ['about', 'О студии']] : []),
            ...(can.moderateReviews ? [['reviews', 'Отзывы']] : []),
            ...(can.seeAllMoney ? [['export', 'Выгрузка']] : []),
            ...(SECOND_ROW ? [['promo', 'Акции'], ['stories', 'Сторис']] : []),
          ] as Array<[StudioTab, string]>).map(([id, label]) => (
            <button
              key={id}
              className={`chip${studioTab === id ? ' chip-gold' : ''}`}
              onClick={() => setStudioTab(id)}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {SECOND_ROW && tab === 'studio' && studioTab === 'stories' && (
        <section className="section section-tight">
          <div className="eyebrow mb-sm">сторис из своих данных</div>
          <PromoStudio upcoming={[]} />
        </section>
      )}

      {tab === 'studio' && studioTab === 'team' && can.manageTeam && (
        <section className="section section-tight">
          <StudioTeam lists={[queue.visits, day.visits, history.visits]} />
        </section>
      )}

      {SECOND_ROW && tab === 'studio' && studioTab === 'promo' && (
        <section className="section section-tight"><StudioPromos /></section>
      )}

      {tab === 'studio' && studioTab === 'reviews' && can.moderateReviews && (
        <section className="section section-tight"><StudioReviews /></section>
      )}

      {tab === 'studio' && studioTab === 'price' && can.editPrices && <StudioProcedures />}
      {tab === 'studio' && studioTab === 'export' && can.seeAllMoney && <StudioExport />}
      {tab === 'studio' && studioTab === 'about' && can.manageTeam && <><StudioAbout /><StudioPassportRules /></>}
    </div>

      {/* «Выйти» в правом верхнем углу. Выход закрывает кабинет: следующий
          вход — снова с PIN, даже если сервер ещё помнит подтверждение. */}
      <button className="studio-exit" onClick={() => { lockCabinet(); onExit(); }}>
        <span className="studio-exit-pill">
          <Icon name="x" size={13} strokeWidth={2.2} />
          выйти
        </span>
      </button>

      <div className="studio-veil" aria-hidden />

      <nav className="studio-nav" aria-label="Разделы кабинета">
        {([
          ['requests', 'Заявки', 'message', pending.length],
          ['day', 'День', 'calendar', today.length],
          ['clients', 'Клиенты', 'user', inbox.unread],
          ...(can.money ? [['money', can.seeAllMoney ? 'Деньги' : 'Доход', 'star', 0]] : []),
          ...(can.manageTeam ? [['studio', 'Студия', 'menu', 0]] : []),
        ] as Array<[Tab, string, IconName, number]>).map(([id, label, icon, count]) => (
          <button
            key={id}
            className={`studio-nav-item${tab === id ? ' active' : ''}`}
            onClick={() => setTab(id)}
            aria-current={tab === id ? 'page' : undefined}
          >
            <span className="studio-nav-ic">
              <Icon name={icon} size={20} strokeWidth={1.8} />
              {count > 0 && <span className="studio-nav-dot">{count > 9 ? '9+' : count}</span>}
            </span>
            <span className="studio-nav-label">{label}</span>
          </button>
        ))}
      </nav>
    </>
  );
}

/* ── Загрузка и отказ списка: ошибка ≠ пустота ── */
function ListNotice({ state, kind }: { state: ListState; kind: 'queue' | 'day' | 'history' }) {
  if (state.loading && !state.loaded) {
    return (
      <div className="card" style={{ padding: 20, textAlign: 'center' }}>
        <div className="muted" aria-live="polite">Загружаем…</div>
      </div>
    );
  }
  if (state.error) {
    return (
      <div className="card empty-state mb" role="alert">
        <div className="empty-title">Не загрузилось</div>
        <div className="empty-sub">{loadErrorText(state.error)} — список может быть неполным. Проверьте интернет.</div>
        <button className="btn btn-secondary btn-block mt-md" onClick={() => { void loadList(kind, true); }}>
          Повторить
        </button>
      </div>
    );
  }
  return null;
}

/* ── Отклонение: причина обязательна, её увидит клиентка ── */
const DECLINE_PRESETS = ['Это время уже занято', 'Процедуру сейчас не проводим', 'Нужна консультация перед процедурой'];

function DeclineForm({ visit }: { visit: Visit }) {
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [why, setWhy] = useState<string | null>(null);

  const send = async () => {
    const text = reason.trim();
    if (!text || busy) return;
    setBusy(true);
    setWhy(null);
    try {
      await decideVisit(visit.id, { status: 'declined', reason: text });
      closeSheet();
      toast('Заявка отклонена');
    } catch (e) {
      notify('error');
      setWhy(decisionErrorText(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <p className="muted" style={{ fontSize: 13, marginBottom: 10 }}>
        Клиентка увидит причину в своих записях.
      </p>
      <div className="chips-wrap" style={{ marginBottom: 10 }}>
        {DECLINE_PRESETS.map((p) => (
          <button key={p} className={`chip${reason === p ? ' chip-gold' : ''}`} onClick={() => { setReason(p); setWhy(null); }}>{p}</button>
        ))}
      </div>
      <textarea
        className="review-textarea"
        rows={3}
        value={reason}
        maxLength={500}
        onChange={(e) => { setReason(e.target.value); setWhy(null); }}
        placeholder="Причина отказа"
      />
      {why && <p className="form-why" role="alert">{why}</p>}
      <button className="btn btn-primary btn-block mt-md" disabled={!reason.trim() || busy} onClick={() => { void send(); }}>
        {busy ? 'Отправляем…' : 'Отклонить заявку'}
      </button>
    </>
  );
}

/* ── Визит прошёл: сколько взяли — или не пришла ── */
function CompleteForm({ visit, summary }: { visit: Visit; summary?: ClientSummary }) {
  const [amount, setAmount] = useState(minorToInput(visit.totalMinor));
  const [busy, setBusy] = useState(false);
  const [why, setWhy] = useState<string | null>(null);
  const paid = parseMoneyInput(amount);

  const decide = async (status: 'done' | 'no_show') => {
    if (busy) return;
    if (status === 'done' && paid === null) { setWhy('Сумма — число, например 45 или 45.50'); return; }
    setBusy(true);
    setWhy(null);
    try {
      await decideVisit(visit.id, status === 'done' ? { status, paid_minor: paid } : { status });
      closeSheet();
      notify('success');
      toast(status === 'done' ? 'Визит закрыт ✓' : 'Отмечено: не пришла', status === 'done' ? 'success' : 'info');
    } catch (e) {
      notify('error');
      setWhy(decisionErrorText(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <ClientStrip clientId={visit.clientId} name={visit.clientName} summary={summary} slugs={visit.slugs} />
      <ul className="info-list mt">
        <li>Сумма по записи: {formatMoney(visit.totalMinor, visit.currency)}{visit.slugs.length > 1 ? ` · ${visit.slugs.length} процедуры` : ''}</li>
        <li>Визит попадёт в карточку клиентки и в выручку</li>
      </ul>
      <label className="field mt-md">
        <span className="field-k">Сколько взяли</span>
        <span className="money-field">
          <input
            className="input input--money"
            inputMode="decimal"
            value={amount}
            onChange={(e) => { setAmount(e.target.value); setWhy(null); }}
            aria-label="Сколько взяли"
            aria-invalid={amount.trim() !== '' && paid === null ? true : undefined}
          />
          {currencySign(visit.currency) && <span className="money-sign" aria-hidden>{currencySign(visit.currency)}</span>}
        </span>
      </label>
      {/* Чаще всего берут ровно по прайсу — одним нажатием, а не набором цифр.
          Если сумма уже другая (врач назвала после осмотра), кнопка вернёт прайс. */}
      {visit.totalMinor > 0 && minorToInput(visit.totalMinor) !== amount && (
        <div className="money-quick">
          <button className="chip" onClick={() => { setAmount(minorToInput(visit.totalMinor)); setWhy(null); tap(); }}>
            по прайсу · {formatMoney(visit.totalMinor, visit.currency)}
          </button>
        </div>
      )}
      {why && <p className="form-why" role="alert">{why}</p>}
      <div className="stack-tight mt-md">
        <button className="btn btn-primary btn-block" disabled={busy || paid === null} onClick={() => { void decide('done'); }}>
          {paid !== null ? `Закрыть визит · ${formatMoney(paid, visit.currency)}` : 'Закрыть визит'}
        </button>
        <button className="btn btn-secondary btn-block" disabled={busy} onClick={() => { void decide('no_show'); }}>
          Не пришла
        </button>
      </div>
    </>
  );
}

/* ── Weekly chart, donut and top services of ONE currency (B1-B: no conversion).
   One currency — the same blocks as before; with two, each gets its own
   group and the headings say which currency. ── */
function CurrencyMoney({ list, currency, titled }: { list: Visit[]; currency: string | null; titled: boolean }) {
  const categories = useMemo(() => revenueByCategory(list), [list]);
  const top = useMemo(() => topServices(list), [list]);
  const tag = titled ? ` · ${currencyTitle(currency)}` : '';

  return (
    <div className="studio-cur" data-currency={currency ?? ''}>
      <RevenueChart list={list} currency={currency} tag={tag} />

      {categories.length > 0 && (
        <>
          <div className="eyebrow" style={{ margin: '20px 0 10px' }}>откуда деньги · 90 дней{tag}</div>
          <CategoryDonut slices={categories} currency={currency} />
        </>
      )}

      {top.length > 0 && (
        <>
          <div className="eyebrow" style={{ margin: '20px 0 8px' }}>топ услуг{tag}</div>
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            {top.map((t) => {
              const photo = servicePhoto(t.slug);
              return (
                <div key={t.slug} className="history-row" style={{ cursor: 'default' }}>
                  <div className={`history-icon${photo ? '' : ' history-icon--blank'}`} style={photo ? { backgroundImage: `url(${photo})` } : undefined}>
                    {!photo && <Icon name={findService(t.slug)?.icon ?? 'sparkles'} size={16} strokeWidth={1.8} />}
                  </div>
                  <div className="history-body">
                    <div className="history-name">{t.title}</div>
                    <div className="history-when">{t.count} {plural(t.count, 'визит', 'визита', 'визитов')}</div>
                  </div>
                  <div className="history-amount">{formatMoney(t.sum, currency)}</div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

/* ── Донат по категориям: на чём держится кабинет ── */
function CategoryDonut({ slices, currency }: { slices: CategorySlice[]; currency: string | null }) {
  const R = 54, C = 2 * Math.PI * R;
  let offset = 0;
  return (
    <div className="donut-wrap">
      <svg viewBox="0 0 140 140" className="donut">
        {slices.map((s) => {
          const len = s.share * C;
          const el = (
            <circle
              key={s.category}
              cx="70" cy="70" r={R}
              fill="none"
              stroke={s.color}
              strokeWidth="16"
              strokeDasharray={`${len} ${C - len}`}
              strokeDashoffset={-offset}
              transform="rotate(-90 70 70)"
            />
          );
          offset += len;
          return el;
        })}
        <text x="70" y="66" textAnchor="middle" className="donut-total">
          {formatMoney(slices.reduce((s, x) => s + x.sum, 0), currency)}
        </text>
        <text x="70" y="84" textAnchor="middle" className="donut-cap">за 90 дней</text>
      </svg>
      <div className="donut-legend">
        {slices.map((s) => (
          <div key={s.category} className="donut-li">
            <span className="donut-dot" style={{ background: s.color }} />
            <span className="donut-label">{s.label}</span>
            <span className="donut-val">{formatMoney(s.sum, currency)}</span>
            <span className="donut-share">{Math.round(s.share * 100)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Кто следующий ──
   Анжелика: «когда у тебя поток постоянных людей — надо, чтобы приходило
   напоминание, что через полчаса у тебя следующий такой-то человек». */
function NextUp({ today }: { today: Visit[] }) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  const next = today
    .filter((v) => (v.status === 'confirmed' || v.status === 'pending') && new Date(v.startsAt).getTime() >= now.getTime())
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt))[0];

  if (!next) {
    return (
      <div className="next-up quiet">
        <Icon name="check" size={16} strokeWidth={2.2} />
        <span>На сегодня всё — записей больше нет</span>
      </div>
    );
  }

  const inMin = Math.round((new Date(next.startsAt).getTime() - now.getTime()) / 60_000);
  const soon = inMin <= 30;

  return (
    <div className={`next-up${soon ? ' soon' : ''}`}>
      {/* Одно время, не два: слово нужно только пока идёт обратный отсчёт */}
      <div className="next-up-time">
        {inMin < 60
          ? <>
              <span className="nu-in">через {inMin} мин</span>
              <span className="nu-slot">{next.slot}</span>
            </>
          : <span className="nu-slot">{next.slot}</span>}
      </div>
      <div className="next-up-body">
        <div className="nu-name">{next.clientName}</div>
        <div className="nu-svc">{visitTitle(next)} · {durationLabel(next.durationMin)}</div>
      </div>
      {next.status === 'pending' && <span className="chip chip-amber">не подтверждена</span>}
    </div>
  );
}

/* ── Выручка по неделям, инлайн-SVG без библиотек ── */
function RevenueChart({ list, currency, tag }: { list: Visit[]; currency: string | null; tag: string }) {
  const weeks = useMemo(() => {
    const out: Array<{ label: string; sum: number }> = [];
    // Недели — от «сегодня» САЛОНА: v.dateISO посчитан в его поясе (ЦФ1).
    const today = salonTodayISO();
    for (let w = 5; w >= 0; w--) {
      const toISO = addDaysISO(today, -w * 7);
      const fromISO = addDaysISO(toISO, -6);
      const sum = list
        .filter((v) => v.status === 'done' && v.dateISO >= fromISO && v.dateISO <= toISO)
        .reduce((s, v) => s + revenueMinor(v), 0);
      out.push({ label: formatShort(toISO), sum });
    }
    return out;
  }, [list]);

  const max = Math.max(1, ...weeks.map((w) => w.sum));
  const total = weeks.reduce((n, w) => n + w.sum, 0);
  const now = weeks[weeks.length - 1];

  /* Было: столбики «висели» от верха колонки, а дата ехала вслед за ними —
     у каждого своя высота подписи, и график читался вверх ногами (Роч 15.10).
     Теперь как у Apple Health/Stocks: общая базовая линия, сумма над
     столбиком, даты одним ровным рядом под линией; пустая неделя — тонкая
     черта на линии, без «0 ₾». Текущая неделя — золотом и подписана словами. */
  return (
    <div className="studio-chart">
      <div className="rv-head">
        <div>
          <div className="eyebrow">выручка по неделям{tag}</div>
          <div className="rv-now">{formatMoney(now.sum, currency)}<span> эта неделя</span></div>
        </div>
        <div className="rv-total">
          <b>{formatMoney(total, currency)}</b>
          <span>за 6 недель</span>
        </div>
      </div>
      <div className="rv-plot" role="img" aria-label={`Выручка по неделям: ${weeks.map((w) => `${w.label} — ${formatMoney(w.sum, currency)}`).join(', ')}`}>
        {weeks.map((w, i) => {
          const last = i === weeks.length - 1;
          return (
            <div key={i} className={`rv-col${last ? ' now' : ''}${w.sum === 0 ? ' zero' : ''}`}>
              {w.sum > 0 && <span className="rv-val">{formatMoney(w.sum, currency)}</span>}
              <span className="rv-bar" style={{ height: w.sum > 0 ? `${Math.max(8, (w.sum / max) * 100)}%` : undefined, animationDelay: `${i * 40}ms` }} />
            </div>
          );
        })}
      </div>
      <div className="rv-labels" aria-hidden>
        {weeks.map((w, i) => (
          <span key={i} className={i === weeks.length - 1 ? 'now' : undefined}>{i === weeks.length - 1 ? 'сейчас' : w.label}</span>
        ))}
      </div>
    </div>
  );
}
