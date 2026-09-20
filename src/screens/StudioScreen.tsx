import { useEffect, useMemo, useState } from 'react';
import { instagramUrl } from '../data/location';
import { openExternal } from '../lib/telegram';
import { durationLabel } from '../lib/plural';
import { Icon } from '../components/Icon';
import { StudioAsk } from '../components/StudioAsk';
import { ClientStrip } from '../components/ClientCardView';
import { MoneyBoard } from '../components/MoneyBoard';
import { openServiceEditor, ArchiveButton } from '../components/ServiceEditor';
import { QuestQueue } from '../components/QuestQueue';
import { PromoStudio } from '../components/PromoStudio';
import { TeamEditor } from '../components/TeamEditor';
import { useCatalog } from '../lib/catalog';
import { buildClientCard, flagsFor } from '../lib/clientCard';
import { useSession, accessOf, signOut, staffForService } from '../lib/staff';
import { useQuizResults } from '../lib/quizResults';
import { SECONDARY_LABEL } from '../lib/quizScore';
import { useHealthPassport, passportFlags } from '../lib/healthPassport';
import { openSheet, closeSheet, toast } from '../lib/ui';
import { findService, sTitle, servicePhoto } from '../data/services';
import {
  noShowInsight, revenueByCategory, topServices, shiftSummary,
  usePrices, setPrice, resetPrice, priceOf,
  useClientNotes, setClientNote,
  type CategorySlice,
} from '../lib/studio';
import {
  useAppointments, getPending, getDay, getClients, getPast,
  confirmAppointment, declineAppointment, offerAnotherTime,
  markCompleted, markNoShow, formatShort, fromISODate, toISODate,
  type Appointment,
  apptServiceIds, apptDuration, apptPrice,
} from '../lib/appointments';

// Кабинет мастера. Анжелика сказала прямо: список, который сам всё
// запланировал, ей не нужен — она хочет видеть каждую заявку и решать руками
// (принять / отклонить / предложить другое время), потому что параллельно
// ведёт записи по телефону и из инстаграма.

type Tab = 'requests' | 'day' | 'clients' | 'money' | 'price' | 'promo';

const SLOTS = ['09:00', '10:30', '12:00', '13:30', '15:00', '16:30', '18:00', '19:30'];

export function StudioScreen({ onExit }: { onExit: () => void }) {
  const all = useAppointments();
  const quizResults = useQuizResults();
  const passport = useHealthPassport();
  const me = useSession();
  const can = accessOf(me);
  const [catalogTick, setCatalogTick] = useState(0);
  const catalog = useCatalog();
  void catalogTick; // перерисовка после архивации

  /* Вторая линия: даже если экран как-то оказался открыт без входа, внутри
     показывать нечего. Одной проверки в маршрутизаторе мало — состояние
     приходит из нескольких мест. */
  useEffect(() => {
    if (!me) onExit();
  }, [me, onExit]);
  const [tab, setTab] = useState<Tab>('requests');

  /* Мастер видит только СВОИ процедуры. Фильтруем на входе, а не в каждой
     вкладке по отдельности: один пропущенный фильтр — и чужие записи
     утекают целиком, включая суммы. */
  const mine = useMemo(() => {
    if (!me || can.seeAllAppointments) return all;
    return all.filter((a) => staffForService(a.serviceId).some((p) => p.id === me.id));
  }, [all, me, can.seeAllAppointments]);

  /* Вкладка переживает смену пользователя: мастер, войдя после владелицы,
     оказывался на «Прайсе», которого ему не положено. Возвращаем в начало. */
  useEffect(() => {
    if (tab === 'price' && !can.editPrices) setTab('requests');
  }, [tab, can.editPrices]);

  const pending = useMemo(() => getPending(mine), [mine]);
  const today = useMemo(() => getDay(mine), [mine]);
  const clients = useMemo(() => getClients(mine), [mine]);
  const past = useMemo(() => getPast(mine), [mine]);

  const revenue30 = useMemo(() => {
    const from = new Date();
    from.setDate(from.getDate() - 30);
    const fromISO = toISODate(from);
    return past.filter((a) => a.status === 'completed' && a.dateISO >= fromISO)
      .reduce((s, a) => s + (a.amount ?? 0), 0);
  }, [past]);

  const noShows = past.filter((a) => a.status === 'no-show');
  const insight = useMemo(() => noShowInsight(all), [all]);
  const categories = useMemo(() => revenueByCategory(all), [all]);
  const top = useMemo(() => topServices(all), [all]);

  const showShift = () => {
    const t = new Date(); t.setDate(t.getDate() + 1);
    const tomorrow = getDay(all, toISODate(t));
    const sum = shiftSummary(all, tomorrow);
    openSheet({
      title: 'Смена закрыта',
      subtitle: formatShort(sum.dateISO),
      body: (
        <>
          <div className="studio-client-stats">
            <div className="scs"><span className="scs-v">{sum.done}</span><span className="scs-k">приняла</span></div>
            <div className="scs"><span className="scs-v">${sum.earned}</span><span className="scs-k">заработано</span></div>
            <div className="scs"><span className="scs-v">{sum.noShow}</span><span className="scs-k">не пришли</span></div>
          </div>
          {sum.pending > 0 && (
            <p className="muted" style={{ fontSize: 13, marginTop: 14 }}>
              Осталось незакрытых записей: {sum.pending}. Отметь их как завершённые или как неявку —
              иначе выручка за день будет неполной.
            </p>
          )}
          <div className="eyebrow" style={{ margin: '16px 0 8px' }}>завтра · {sum.nextDay.length}</div>
          {sum.nextDay.length === 0 ? (
            <p className="faint" style={{ fontSize: 13 }}>Завтра записей нет — можно выдохнуть.</p>
          ) : (
            <ul className="notif-timeline">
              {sum.nextDay.map((a) => (
                <li key={a.id}>
                  <span className="nt-when">{a.slot}</span>
                  <span className="nt-text">{a.clientName} · {findService(a.serviceId) ? sTitle(findService(a.serviceId)!, 'ru') : ''}</span>
                </li>
              ))}
            </ul>
          )}
        </>
      ),
    });
  };

  const offerSheet = (a: Appointment) =>
    openSheet({
      title: 'Предложить другое время',
      subtitle: `${a.clientName} · ${formatShort(a.dateISO)} ${a.slot}`,
      body: <OfferForm appt={a} />,
    });

  const completeSheet = (a: Appointment) => {
    const svc = findService(a.serviceId);
    openSheet({
      title: 'Процедура прошла',
      subtitle: `${a.clientName} · ${svc ? sTitle(svc, 'ru') : a.serviceId}`,
      body: (
        <>
          <ClientStrip card={buildClientCard(a, mine, passport, quizResults)} />
          <ul className="info-list" style={{ marginTop: 12 }}>
            <li>Сумма по прайсу: ${apptPrice(a)}{a.extras?.length ? ` · ${apptServiceIds(a).length} процедуры` : ''}</li>
            <li>Визит попадёт в карточку клиента и в выручку</li>
            <li>Через 14 дней клиенту уйдёт запрос отзыва</li>
          </ul>
        </>
      ),
      actions: (
        <>
          <button className="btn btn-primary btn-block" onClick={() => { markCompleted(a.id, apptPrice(a)); closeSheet(); toast('Визит закрыт ✓', 'success'); }}>
            Закрыть визит · ${apptPrice(a)}
          </button>
          <button className="btn btn-ghost btn-block" onClick={() => { markNoShow(a.id); closeSheet(); toast('Отмечено: не пришла'); }}>
            Не пришла
          </button>
        </>
      ),
    });
  };

  const clientSheet = (key: string) => {
    const row = clients.find((c) => c.key === key);
    if (!row) return;
    const visits = all.filter((a) => (a.clientInstagram || a.clientName) === key);
    openSheet({
      title: row.name,
      subtitle: row.instagram ? `@${row.instagram}` : 'без инстаграма',
      body: (
        <>
          <div className="studio-client-stats">
            <div className="scs"><span className="scs-v">{row.visits}</span><span className="scs-k">визитов</span></div>
            <div className="scs"><span className="scs-v">${row.spent}</span><span className="scs-k">потрачено</span></div>
            <div className="scs"><span className="scs-v">{row.noShows}</span><span className="scs-k">неявок</span></div>
          </div>
          <div className="eyebrow" style={{ margin: '16px 0 8px' }}>история процедур</div>
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            {visits.map((v) => {
              const svc = findService(v.serviceId);
              return (
                <div key={v.id} className="history-row" style={{ cursor: 'default' }}>
                  <div className={`history-icon${servicePhoto(v.serviceId) ? '' : ' history-icon--blank'}`} style={servicePhoto(v.serviceId) ? { backgroundImage: `url(${servicePhoto(v.serviceId)})` } : undefined}>{!servicePhoto(v.serviceId) && <Icon name={svc?.icon ?? 'sparkles'} size={16} strokeWidth={1.8} />}</div>
                  <div className="history-body">
                    <div className="history-name">{svc ? sTitle(svc, 'ru') : v.serviceId}</div>
                    <div className="history-when">{formatShort(v.dateISO)} · {v.slot} · {v.status === 'completed' ? 'оплачено' : v.status === 'no-show' ? 'не пришла' : v.status}</div>
                  </div>
                  {v.amount ? <div className="history-amount">${v.amount}</div> : null}
                </div>
              );
            })}
          </div>
          {quizResults.length > 0 && (
            <>
              <div className="eyebrow" style={{ margin: '16px 0 8px' }}>разборы кожи · до визита</div>
              <div className="col" style={{ gap: 6 }}>
                {quizResults.map((r) => (
                  <div key={r.quizId} className="studio-result">
                    <div className="studio-result-title">{r.title}</div>
                    <div className="studio-result-sub">{r.quizTitle}</div>
                    {r.secondary && r.secondary.length > 0 && (
                      <div className="row" style={{ flexWrap: 'wrap', gap: 4, marginTop: 5 }}>
                        {r.secondary.map((sc) => (
                          <span key={sc} className="result-tag">{SECONDARY_LABEL[sc]?.ru ?? sc}</span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}

          <div className="eyebrow" style={{ margin: '16px 0 8px' }}>анкета здоровья</div>
          <div className="patient-flags">
            {passportFlags(passport, true).slice(0, 4).map((f) => (
              <span key={f.text} className={`flag ${f.kind}`}>
                <Icon name={f.kind === 'warn' ? 'warning' : 'check'} size={13} strokeWidth={2.2} /> {f.text}
              </span>
            ))}
          </div>

          <div className="eyebrow" style={{ margin: '16px 0 8px' }}>заметка · видишь только ты</div>
          <ClientNote clientKey={key} />
          <p className="faint" style={{ fontSize: 12, marginTop: 12 }}>
            Остальное собирается само из записей — вести карточку руками не нужно.
          </p>
        </>
      ),
      actions: row.instagram ? (
        <button className="btn btn-ghost btn-block" onClick={() => openExternal(instagramUrl(row.instagram))}>
          Открыть @{row.instagram} в инстаграме
        </button>
      ) : undefined,
    });
  };

  return (
    <div className="screen studio">
      <header className="header">
        <div className="header-lede">
          <div className="eyebrow">{me?.role === 'owner' ? 'кабинет · владелица' : 'кабинет мастера'}</div>
          <div className="header-title">{me?.name ?? 'Кабинет'}</div>
        </div>
        <button className="chip" onClick={() => { signOut(); onExit(); }}>
          <Icon name="x" size={13} strokeWidth={2.2} /> выйти
        </button>
      </header>

      <NextUp today={today} />

      <StudioAsk all={all} />

      <div className="studio-tabs">
        {([
          ['requests', 'Заявки', pending.length],
          ['day', 'Сегодня', today.length],
          ['clients', 'Клиенты', clients.length],
          ['money', can.seeAllMoney ? 'Деньги' : 'Мой доход', 0],
          // Прайс правит только владелица: цена — это её решение, а не
          // мастера, который по этой цене работает
          ...(can.editPrices ? [['price', 'Прайс', 0]] : []),
          ['promo', 'Сторис', 0],
        ] as Array<[Tab, string, number]>).map(([id, label, count]) => (
          <button key={id} className={`studio-tab ${tab === id ? 'active' : ''}`} onClick={() => setTab(id)}>
            {label}
            {count > 0 && <span className="studio-tab-count">{count}</span>}
          </button>
        ))}
      </div>

      {tab === 'requests' && (
        <section className="section" style={{ paddingTop: 10 }}>
          {/* Задания на проверку — такое же входящее, как заявка: требует
              решения мастера и висит, пока его не примут */}
          {can.manageTeam && <QuestQueue />}

          {pending.length === 0 && (
            <div className="card" style={{ padding: 24, textAlign: 'center' }}>
              <Icon name="check" size={28} strokeWidth={2} style={{ color: 'var(--brand-primary)' }} />
              <div className="muted" style={{ marginTop: 8 }}>Новых заявок нет</div>
            </div>
          )}
          {pending.map((a) => {
            const svc = findService(a.serviceId);
            const card = buildClientCard(a, mine, passport, quizResults);
            return (
              <article key={a.id} className="studio-req">
                <div className="studio-req-head">
                  <div className="studio-req-who">
                    <div className="studio-req-name">{a.clientName}</div>
                    {a.clientInstagram && <div className="studio-req-ig">@{a.clientInstagram}</div>}
                  </div>
                  <span className="chip chip-amber">новая</span>
                </div>
                {/* Процедуры списком, а не строкой через «+»: визит из трёх
                    превращал строку в стену текста, а цена повисала по центру
                    четырёх строк с разделителем на отдельной строке. */}
                <ul className="studio-req-list">
                  {apptServiceIds(a).map((id) => {
                    const x = findService(id);
                    return (
                      <li key={id}>
                        <Icon name={x?.icon ?? 'sparkles'} size={14} strokeWidth={1.8} />
                        <span>{x?.title ?? id}</span>
                      </li>
                    );
                  })}
                </ul>
                <div className="studio-req-when">
                  <Icon name="calendar" size={14} strokeWidth={1.8} />
                  {formatShort(a.dateISO)} · {a.slot}
                  <span className="studio-req-sum">{apptDuration(a)} мин · ${apptPrice(a)}</span>
                </div>
                {/* Кто пришёл и что нельзя — до кнопки «Принять», а не после */}
                <ClientStrip card={card} />
                <div className="studio-req-actions">
                  <button className="btn btn-primary btn-sm" onClick={() => { confirmAppointment(a.id); toast(`${a.clientName} — принято ✓`, 'success'); }}>
                    Принять
                  </button>
                  <button className="btn btn-ghost btn-sm" onClick={() => offerSheet(a)}>
                    Другое время
                  </button>
                  <button className="btn btn-ghost btn-sm studio-decline" onClick={() => { declineAppointment(a.id); toast('Заявка отклонена'); }}>
                    Отклонить
                  </button>
                </div>
              </article>
            );
          })}
        </section>
      )}

      {tab === 'day' && (
        <section className="section" style={{ paddingTop: 10 }}>
          <div className="eyebrow" style={{ marginBottom: 8 }}>сегодня · {today.length} записей</div>
          {today.length === 0 && (
            <div className="card" style={{ padding: 24, textAlign: 'center' }}>
              <div className="muted">Сегодня пусто</div>
            </div>
          )}
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            {today.map((a) => {
              const svc = findService(a.serviceId);
              const dayFlags = flagsFor(apptServiceIds(a), passport);
              return (
                <button key={a.id} className="studio-day-row" onClick={() => completeSheet(a)}>
                  <div className="studio-day-time">{a.slot}</div>
                  <div className="studio-day-body">
                    <div className="studio-day-name">
                      {a.clientName}
                      {a.clientInstagram && <span className="faint"> · @{a.clientInstagram}</span>}
                    </div>
                    <div className="studio-day-svc">
                      {apptServiceIds(a).map((id) => findService(id)?.title ?? id).join(' + ')} · {apptDuration(a)} мин
                    </div>
                    {dayFlags.length > 0 && (
                      <span className={`studio-day-flag ${dayFlags[0].level}`}>
                        <Icon name={dayFlags[0].level === 'stop' ? 'warning' : 'info'} size={11} strokeWidth={2.4} />
                        {dayFlags[0].from}
                      </span>
                    )}
                  </div>
                  <span className={`studio-dot ${a.status}`} />
                </button>
              );
            })}
          </div>
          <p className="faint" style={{ fontSize: 12, marginTop: 10 }}>
            За 30 минут до каждой записи придёт напоминание, кто следующий.
          </p>
        </section>
      )}

      {tab === 'clients' && (
        <section className="section" style={{ paddingTop: 10 }}>
          <div className="eyebrow" style={{ marginBottom: 8 }}>база · {clients.length} человек</div>
          {clients.length === 0 && (
            <div className="card empty-state">
              <div className="empty-icon"><Icon name="user" size={26} strokeWidth={1.7} /></div>
              <div className="empty-title">База пустая</div>
              <div className="empty-sub">
                Она соберётся сама: каждая принятая заявка заводит карточку с историей процедур.
                Вести таблицу руками не нужно.
              </div>
            </div>
          )}
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            {clients.map((c) => (
              <button key={c.key} className="studio-day-row" onClick={() => clientSheet(c.key)}>
                <div className="studio-client-av">{c.name.slice(0, 1).toUpperCase()}</div>
                <div className="studio-day-body">
                  <div className="studio-day-name">{c.name}</div>
                  <div className="studio-day-svc">
                    {c.instagram ? `@${c.instagram}` : 'без инстаграма'} · {c.visits} визитов
                    {c.noShows > 0 && <span className="studio-warn"> · {c.noShows} неявк.</span>}
                  </div>
                </div>
                <div className="history-amount">${c.spent}</div>
              </button>
            ))}
          </div>
        </section>
      )}

      {tab === 'money' && (
        <section className="section" style={{ paddingTop: 10 }}>
          {revenue30 === 0 && insight.total === 0 && (
            <div className="card empty-state" style={{ marginBottom: 12 }}>
              <div className="empty-icon"><Icon name="sparkles" size={26} strokeWidth={1.7} /></div>
              <div className="empty-title">Пока не с чего считать</div>
              <div className="empty-sub">
                Закрой первый визит во вкладке «Сегодня» — выручка, категории и топ услуг
                посчитаются сами.
              </div>
            </div>
          )}
          {/* Фиксированные «7 и 30 дней» отвечали на один вопрос. Дашборд
              с периодом и сезоном отвечает на тот, который у мастера
              на самом деле: «стало лучше или хуже, с поправкой на сезон». */}
          <MoneyBoard list={past} showStaff={can.seeAllMoney} />
          <div className="studio-money" style={{ marginTop: 14 }}>
            <div className="studio-money-row">
              <span className="k">Неявки за всё время</span>
              <span className="v">{noShows.length}</span>
            </div>
          </div>
          <RevenueChart list={past} />

          {categories.length > 0 && (
            <>
              <div className="eyebrow" style={{ margin: '20px 0 10px' }}>откуда деньги · 90 дней</div>
              <CategoryDonut slices={categories} />
            </>
          )}

          {top.length > 0 && (
            <>
              <div className="eyebrow" style={{ margin: '20px 0 8px' }}>топ услуг</div>
              <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                {top.map((t) => (
                  <div key={t.service!.id} className="history-row" style={{ cursor: 'default' }}>
                    <div className={`history-icon${servicePhoto(t.service!.id) ? '' : ' history-icon--blank'}`} style={servicePhoto(t.service!.id) ? { backgroundImage: `url(${servicePhoto(t.service!.id)})` } : undefined}>{!servicePhoto(t.service!.id) && <Icon name={t.service!.icon} size={16} strokeWidth={1.8} />}</div>
                    <div className="history-body">
                      <div className="history-name">{sTitle(t.service!, 'ru')}</div>
                      <div className="history-when">{t.count} визитов</div>
                    </div>
                    <div className="history-amount">${t.sum}</div>
                  </div>
                ))}
              </div>
            </>
          )}

          {insight.total > 0 && (
            <div className="insight-card">
              <div className="insight-head">
                <Icon name="warning" size={16} strokeWidth={2} />
                <span>Неявки: {insight.total} · потеряно ${insight.lostUsd}</span>
              </div>
              <ul className="info-list contra" style={{ marginTop: 10 }}>
                {insight.worstWeekday && <li>Чаще всего не приходят в {insight.worstWeekday}</li>}
                {insight.repeatOffenders.map((c) => (
                  <li key={c.name}>
                    {c.name}{c.instagram ? ` (@${c.instagram})` : ''} — {c.count} раза. Стоит просить предоплату
                  </li>
                ))}
                {!insight.worstWeekday && insight.repeatOffenders.length === 0 && <li>Разовые случаи, закономерности нет</li>}
              </ul>
            </div>
          )}

          <button className="btn btn-quiet btn-block" style={{ marginTop: 18 }} onClick={showShift}>
            Закрыть смену
          </button>

          <p className="faint" style={{ fontSize: 12, marginTop: 12 }}>
            Склад и расходники не считаем — заканчивается препарат, заказываешь, и всё.
          </p>
        </section>
      )}
      {tab === 'promo' && (
        <section className="section" style={{ paddingTop: 10 }}>
          <div className="eyebrow" style={{ marginBottom: 10 }}>сторис из своих данных</div>
          <PromoStudio upcoming={mine} />
        </section>
      )}

      {tab === 'price' && (
        <section className="section" style={{ paddingTop: 10 }}>
          <div className="studio-price-head">
            <div className="eyebrow">прайс и состав</div>
            <button className="chip chip-gold" onClick={openServiceEditor}>
              <Icon name="plus" size={13} strokeWidth={2.6} /> процедура
            </button>
          </div>

          <div className="col" style={{ gap: 8 }}>
            {catalog.live.map((svc) => (
              <div key={svc.id} className="studio-price-line">
                <PriceRow serviceId={svc.id} />
                <ArchiveButton service={svc} onDone={() => setCatalogTick((x) => x + 1)} />
              </div>
            ))}
          </div>

          {/* Архив виден мастеру, но не клиенту: услугу можно вернуть,
              а история визитов по ней никуда не делась */}
          {catalog.archived.length > 0 && (
            <>
              <div className="eyebrow" style={{ margin: '20px 0 8px' }}>
                убрано из каталога · {catalog.archived.length}
              </div>
              <div className="col" style={{ gap: 8 }}>
                {catalog.all.filter((s) => catalog.archived.includes(s.id)).map((svc) => (
                  <div key={svc.id} className="studio-price-line archived">
                    <div className="studio-arch-name">
                      <Icon name={svc.icon} size={15} strokeWidth={1.8} />
                      {svc.title}
                      <span className="faint">${svc.priceUsd}</span>
                    </div>
                    <ArchiveButton service={svc} onDone={() => setCatalogTick((x) => x + 1)} />
                  </div>
                ))}
              </div>
            </>
          )}

          <p className="faint" style={{ fontSize: 12, marginTop: 14 }}>
            Новая цена сразу применяется в каталоге и в заявках. Убранная процедура
            исчезает у клиентов, но остаётся в истории и в отчётах.
          </p>

          {/* Команда — там же, где прайс: и то и другое про устройство
              кабинета, и правит их один человек */}
          {can.manageTeam && (
            <div style={{ marginTop: 26 }}>
              <TeamEditor />
            </div>
          )}
        </section>
      )}
    </div>
  );
}

/* ── Приватная заметка о клиенте ──
   Анжелика держит в голове то, что нельзя показывать самому клиенту:
   как переносит боль, о чём просила молчать, чем закончился прошлый раз. */
function ClientNote({ clientKey }: { clientKey: string }) {
  const notes = useClientNotes();
  const [draft, setDraft] = useState(notes[clientKey] ?? '');
  const [saved, setSaved] = useState(false);

  useEffect(() => { setDraft(notes[clientKey] ?? ''); }, [notes, clientKey]);

  return (
    <div>
      <textarea
        className="review-textarea"
        rows={3}
        value={draft}
        onChange={(e) => { setDraft(e.target.value); setSaved(false); }}
        onBlur={() => { setClientNote(clientKey, draft.trim()); setSaved(true); }}
        placeholder="Как переносит боль, о чём просила, чем закончился прошлый раз"
        maxLength={600}
      />
      <div className="faint" style={{ fontSize: 11.5, marginTop: 6 }}>
        {saved ? 'Сохранено ✓' : 'Сохраняется, когда уводишь курсор'}
      </div>
    </div>
  );
}

/* ── Строка прайса: цена правится прямо в кабинете ── */
function PriceRow({ serviceId }: { serviceId: string }) {
  const prices = usePrices();
  const svc = findService(serviceId)!;
  const custom = prices[serviceId];
  const [draft, setDraft] = useState<string>(String(custom ?? svc.priceUsd));

  useEffect(() => { setDraft(String(custom ?? svc.priceUsd)); }, [custom, svc.priceUsd]);

  const changed = Number(draft) !== svc.priceUsd;

  return (
    <div className={`price-row${custom !== undefined ? ' custom' : ''}`}>
      <div className="price-row-icon"><Icon name={svc.icon} size={17} strokeWidth={1.8} /></div>
      <div className="price-row-body">
        <div className="price-row-title">{sTitle(svc, 'ru')}</div>
        <div className="price-row-sub">
          {durationLabel(svc.duration, svc.days)}{custom !== undefined && <span className="price-row-was"> · было ${svc.priceUsd}</span>}
        </div>
      </div>
      <div className="price-row-edit">
        <span className="price-row-cur">$</span>
        <input
          className="price-input"
          type="number"
          inputMode="numeric"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => {
            const v = Number(draft);
            if (!Number.isFinite(v) || v <= 0) { setDraft(String(custom ?? svc.priceUsd)); return; }
            if (v === svc.priceUsd) resetPrice(serviceId);
            else if (v !== custom) { setPrice(serviceId, v); toast(`${sTitle(svc, 'ru')} — $${v}`, 'success'); }
          }}
        />
        {custom !== undefined && (
          <button className="price-reset" onClick={() => { resetPrice(serviceId); toast('Вернула исходную цену'); }} aria-label="Вернуть исходную">
            <Icon name="x" size={13} strokeWidth={2.4} />
          </button>
        )}
      </div>
      {changed && custom === undefined && <span className="price-dirty" aria-hidden />}
    </div>
  );
}

/* ── Донат по категориям: на чём держится кабинет ── */
function CategoryDonut({ slices }: { slices: CategorySlice[] }) {
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
          ${slices.reduce((s, x) => s + x.sum, 0)}
        </text>
        <text x="70" y="84" textAnchor="middle" className="donut-cap">за 90 дней</text>
      </svg>
      <div className="donut-legend">
        {slices.map((s) => (
          <div key={s.category} className="donut-li">
            <span className="donut-dot" style={{ background: s.color }} />
            <span className="donut-label">{s.label}</span>
            <span className="donut-val">${s.sum}</span>
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
function NextUp({ today }: { today: Appointment[] }) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  const minutesNow = now.getHours() * 60 + now.getMinutes();
  const next = today
    .map((a) => {
      const [h, m] = a.slot.split(':').map(Number);
      return { appt: a, at: h * 60 + m };
    })
    .filter((x) => x.at >= minutesNow)
    .sort((a, b) => a.at - b.at)[0];

  if (!next) {
    return (
      <div className="next-up quiet">
        <Icon name="check" size={16} strokeWidth={2.2} />
        <span>На сегодня всё — записей больше нет</span>
      </div>
    );
  }

  const inMin = next.at - minutesNow;
  const svc = findService(next.appt.serviceId);
  const soon = inMin <= 30;

  return (
    <div className={`next-up${soon ? ' soon' : ''}`}>
      <div className="next-up-time">
        <span className="nu-in">{inMin < 60 ? `через ${inMin} мин` : `в ${next.appt.slot}`}</span>
        <span className="nu-slot">{next.appt.slot}</span>
      </div>
      <div className="next-up-body">
        <div className="nu-name">
          {next.appt.clientName}
          {next.appt.clientInstagram && <span className="faint"> · @{next.appt.clientInstagram}</span>}
        </div>
        <div className="nu-svc">{svc ? sTitle(svc, 'ru') : next.appt.serviceId} · {svc ? durationLabel(svc.duration, svc.days) : ''}</div>
      </div>
      {next.appt.status === 'pending' && <span className="chip chip-amber">не подтверждена</span>}
    </div>
  );
}

/* ── Встречное предложение времени ── */
function OfferForm({ appt }: { appt: Appointment }) {
  const [dateIdx, setDateIdx] = useState(0);
  const [slot, setSlot] = useState<string | null>(null);

  const dates = useMemo(() => {
    const base = fromISODate(appt.dateISO);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(base);
      d.setDate(base.getDate() + i);
      return d;
    });
  }, [appt.dateISO]);

  const date = dates[dateIdx];

  return (
    <>
      <p className="muted" style={{ fontSize: 13, marginBottom: 12 }}>
        Клиенту придёт сообщение, что это время занято другой записью, и предложение выбрать новое.
      </p>
      <div className="eyebrow" style={{ marginBottom: 6 }}>день</div>
      <div className="row" style={{ gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
        {dates.map((d, i) => (
          <button key={i} className={`chip ${dateIdx === i ? 'active' : ''}`} onClick={() => setDateIdx(i)}>
            {formatShort(toISODate(d))}
          </button>
        ))}
      </div>
      <div className="eyebrow" style={{ marginBottom: 6 }}>время</div>
      <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
        {SLOTS.map((s) => (
          <button key={s} className={`chip ${slot === s ? 'active' : ''}`} onClick={() => setSlot(s)}>
            {s}
          </button>
        ))}
      </div>
      <div style={{ marginTop: 18 }}>
        <button
          className="btn btn-primary btn-block"
          disabled={!slot}
          onClick={() => {
            if (!slot) return;
            offerAnotherTime(appt.id, toISODate(date), slot);
            closeSheet();
            toast(`${appt.clientName}: предложено ${formatShort(toISODate(date))} ${slot}`, 'success');
          }}
        >
          {slot ? `Предложить ${formatShort(toISODate(date))} · ${slot}` : 'Выбери время'}
        </button>
      </div>
    </>
  );
}

/* ── Выручка по неделям, инлайн-SVG без библиотек ── */
function RevenueChart({ list }: { list: Appointment[] }) {
  const weeks = useMemo(() => {
    const out: Array<{ label: string; sum: number }> = [];
    for (let w = 5; w >= 0; w--) {
      const to = new Date(); to.setDate(to.getDate() - w * 7);
      const from = new Date(to); from.setDate(to.getDate() - 6);
      const fromISO = toISODate(from), toISO = toISODate(to);
      const sum = list
        .filter((a) => a.status === 'completed' && a.dateISO >= fromISO && a.dateISO <= toISO)
        .reduce((s, a) => s + (a.amount ?? 0), 0);
      out.push({ label: formatShort(toISO), sum });
    }
    return out;
  }, [list]);

  const max = Math.max(1, ...weeks.map((w) => w.sum));

  return (
    <div className="studio-chart">
      <div className="eyebrow" style={{ marginBottom: 10 }}>выручка по неделям</div>
      <div className="studio-bars">
        {weeks.map((w, i) => (
          <div key={i} className="studio-bar-col">
            <div className="studio-bar-val">{w.sum > 0 ? `$${w.sum}` : ''}</div>
            <div className="studio-bar" style={{ height: `${Math.max(4, (w.sum / max) * 100)}%` }} />
            <div className="studio-bar-label">{w.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
