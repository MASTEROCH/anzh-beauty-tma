import { useEffect, useRef } from 'react';
import { telegramUrl } from '../data/location';
import { openTelegram } from '../lib/telegram';
import { Icon } from '../components/Icon';
import { BotWriteAccess } from '../components/BotWriteAccess';
import { toast } from '../lib/ui';
import {
  apptPriceLabel, apptTitle, apptTotal, formatLongDate, formatWhen, fromISODate, useBookingSchedule, useLastCreatedAppointment,
  type ScheduleView,
} from '../lib/appointments';
import { useMe } from '../lib/api';
import { useWriteAccess } from '../lib/writeAccess';
import { SCHEDULE_COPY, canKeyOf, type WriteAccessContext } from '../lib/writeAccessCopy';
import { FROM_SENTENCE } from '../lib/money';
import { eventOfAppointment } from '../lib/ics';
import { openAddToCalendar } from '../components/AddToCalendar';
import { findService, sTitle } from '../data/services';
import { useLang } from '../lib/i18n';

type Lang = 'ru' | 'en';

/** Т1 column by the booking status from the SAME answer as the list: «pending» waits, anything else is decided. */
const contextOf = (view: ScheduleView): WriteAccessContext =>
  view.bookingStatus !== null && view.bookingStatus !== 'pending' ? 'decided' : 'pending';

/**
 * Что пришлёт бот по этой записи — ровно `schedule` из GET /bookings/{id}.
 * Сервер — единственный автор списка: экран не дописывает «утром в день
 * визита», «уход после» и «баллы» — сервер их не шлёт (решение на ночь:
 * только client_24h, master_30min, новая заявка, подтверждено / отклонено).
 *
 * КТ-7 С2: the server builds this list by `Me.can_message` (api/_domain/notify.js
 * scheduleFor), so when the flag rises the list is read again — in every mounted
 * place (поправки 05, С2). Below the list — the block «Получать ответ в Telegram».
 */
export function NotificationSchedule({ view, lang, variant }: { view: ScheduleView; lang: Lang; variant: 'flow' | 'timeline' }) {
  const ru = lang === 'ru';
  const now = Date.now();
  const { me } = useMe();
  const canMessage = me?.can_message;
  const writeAccess = useWriteAccess(canMessage);
  const context = contextOf(view);

  const { retry } = view;
  const lastCan = useRef(canMessage);
  useEffect(() => {
    const was = lastCan.current;
    lastCan.current = canMessage;
    if (was === false && canMessage === true) retry();
  }, [canMessage, retry]);

  const rows: Array<{ key: string; title: string; sub: string; done: boolean }> =
    view.status === 'ready'
      ? view.schedule.map((n, i) => {
          const at = Date.parse(n.when);
          const done = Number.isFinite(at) && at <= now;
          return {
            key: `${n.kind}-${i}`,
            title: n.text?.[lang] || n.text?.ru || '',
            sub: done ? (ru ? `отправлено · ${formatWhen(n.when, lang)}` : `sent · ${formatWhen(n.when, lang)}`) : formatWhen(n.when, lang),
            done,
          };
        })
      : [];

  const can = canKeyOf(canMessage);
  /* Т1 §3 notes: no line where it repeats a neighbour — «pending × yes» while the block
     says «done», and «pending × unknown» in the flow, where the step above already says
     «the answer shows in your account» (:151). */
  const emptyLine =
    (context === 'pending' && can === 'yes' && writeAccess.view === 'ready')
    || (variant === 'flow' && context === 'pending' && can === 'unknown')
      ? null
      : SCHEDULE_COPY.empty[context][can][lang];
  const message =
    view.status === 'loading'
      ? (ru ? 'Загружаю, что пришлёт бот…' : 'Loading what the bot will send…')
      : view.status === 'error'
        ? (ru ? 'Не удалось загрузить уведомления по записи. Статус заявки — в кабинете.' : 'Couldn’t load the notifications for this booking. The status is in your account.')
        : rows.length === 0
          ? emptyLine
          : null;
  /* The block waits for the list's answer: its column (pending / decided) comes from it.
     The answer failed — the block is still drawn (it is the door of the Start fix, Хейтер
     H-1), in the neutral «decided» column: «messages about bookings» is true at any status. */
  const block = view.status === 'loading'
    ? null
    : <BotWriteAccess ui={writeAccess} link={me?.bot_link} lang={lang} context={view.status === 'error' ? 'decided' : context} variant={variant} />;

  if (variant === 'timeline') {
    return (
      <ul className="notif-timeline" data-testid="schedule">
        {rows.map((r) => (
          <li key={r.key}>
            <span className="nt-when">{r.sub}</span>
            <span className="nt-text">{r.title}</span>
          </li>
        ))}
        {message && (
          <li>
            <span className="nt-text" data-testid="schedule-message">{message}</span>
            {view.status === 'error' && (
              <button className="btn btn-quiet btn-sm" onClick={view.retry}>{ru ? 'Повторить' : 'Retry'}</button>
            )}
          </li>
        )}
        {block}
      </ul>
    );
  }

  return (
    <>
      {rows.map((r) => (
        <li key={r.key} className={r.done ? 'done' : undefined}>
          <span className="cf-dot">{r.done && <Icon name="check" size={11} strokeWidth={2.8} />}</span>
          <div>
            <div className="cf-title">{r.title}</div>
            <div className="cf-sub">{r.sub}</div>
          </div>
        </li>
      ))}
      {message && (
        <li>
          <span className="cf-dot" />
          <div>
            <div className="cf-sub" data-testid="schedule-message">{message}</div>
            {view.status === 'error' && (
              <button className="btn btn-quiet btn-sm" onClick={view.retry}>{ru ? 'Повторить' : 'Retry'}</button>
            )}
          </div>
        </li>
      )}
      {block}
    </>
  );
}

export function ConfirmScreen({ onDone, onAccount }: { onDone: () => void; onAccount: () => void }) {
  const lang = useLang() as Lang;
  const ru = lang === 'ru';
  // Именно та заявка, которую человек только что отправил (ответ POST
  // /bookings), а не «последняя по дате» из списка.
  const appt = useLastCreatedAppointment();
  const schedule = useBookingSchedule(appt?.id ?? null);
  const title = appt ? apptTitle(appt, lang, (id) => { const s = findService(id); return s ? sTitle(s, lang) : undefined; }) : '';
  /* The server's total in the visit's own currency (K5, B1-B) — not only USD any more;
     no currency — no sign. "from" — T2 ed. 2 §4.2 sentence after it. */
  const totalLabel = appt ? apptPriceLabel(appt, lang) : null;
  const totalFrom = appt ? apptTotal(appt)?.priceFrom === true : false;

  return (
    <div className="screen">
      <header className="header">
        <div className="header-lede">
          <div className="eyebrow">{ru ? 'заявка отправлена' : 'request sent'}</div>
          <div className="header-title">{ru ? 'Почти готово' : 'Almost there'}</div>
        </div>
        <span className="chip chip-amber"><Icon name="clock" size={12} strokeWidth={2.2} /> {ru ? 'ждёт ответа' : 'awaiting reply'}</span>
      </header>

      <section style={{ padding: '30px 20px 0', textAlign: 'center' }}>
        <div className="confirm-icon confirm-icon--wait">
          <Icon name="send" size={34} strokeWidth={2.2} />
        </div>
        <h1 style={{ fontFamily: 'Space Grotesk, system-ui, sans-serif', fontSize: 30, fontWeight: 600, letterSpacing: '-0.015em' }}>
          {ru ? 'Заявка у Анжелики' : 'Request sent'} 💛
        </h1>
        <p className="muted" data-testid="confirm-what" style={{ marginTop: 8, maxWidth: 330, marginInline: 'auto' }}>
          {appt && appt.dateISO && (
            <>
              {title} · {formatLongDate(fromISODate(appt.dateISO), lang)} · {appt.slot}.{' '}
              {totalLabel !== null && (
                <>
                  <span data-testid="confirm-total">{ru ? 'По прайсу' : 'Price list total'}: {totalLabel}.</span>{' '}
                  {totalFrom && <><span data-testid="confirm-from-note">{FROM_SENTENCE[lang]}</span>{' '}</>}
                </>
              )}
            </>
          )}
          {ru
            ? 'Она подтвердит или отклонит заявку — у неё параллельно идут записи по телефону.'
            : 'She’ll confirm or decline the request — she also takes bookings by phone.'}
        </p>
      </section>

      <section style={{ padding: 20 }}>
        <div className="card" style={{ padding: 18 }}>
          <div className="eyebrow mb-sm">{ru ? 'что дальше' : 'what happens next'}</div>
          <ol className="confirm-flow">
            <li className="done">
              <span className="cf-dot"><Icon name="check" size={11} strokeWidth={2.8} /></span>
              <div>
                <div className="cf-title">{ru ? 'Заявка отправлена' : 'Request sent'}</div>
                <div className="cf-sub">{ru ? 'Анжелика видит её в своём кабинете' : 'Anjelika sees it in her studio panel'}</div>
              </div>
            </li>
            <li className="active">
              <span className="cf-dot" />
              <div>
                <div className="cf-title">{ru ? 'Анжелика подтверждает' : 'Anjelika confirms'}</div>
                <div className="cf-sub">{ru ? 'Ответ появится в кабинете' : 'The answer shows in your account'}</div>
              </div>
            </li>
            {appt && <NotificationSchedule view={schedule} lang={lang} variant="flow" />}
          </ol>
        </div>
      </section>

      <section style={{ padding: '0 20px 20px' }}>
        <div className="row" style={{ gap: 10, marginBottom: 10 }}>
          <button
            className="btn btn-secondary row-fill"
            onClick={() => {
              openTelegram(telegramUrl());
              toast(ru ? 'Открываю чат с Анжеликой' : 'Opening the chat with Anjelika', 'success');
            }}
          >
            <Icon name="message" size={16} strokeWidth={1.9} /> {ru ? 'Написать' : 'Message'}
          </button>
        </div>
        {/* Календарь с напоминанием за два часа — настоящий файл .ics, а не
            обещание «добавлю, когда подтвердят»: такого механизма нет. */}
        {appt && (
          <button
            className="btn btn-secondary btn-block mb-sm"
            onClick={() => {
              const e = eventOfAppointment(appt, lang);
              openAddToCalendar(e ? [e] : [], lang, `anzh-${appt.dateISO}.ics`);
            }}
          >
            <Icon name="calendar" size={16} strokeWidth={1.9} /> {ru ? 'Добавить в календарь' : 'Add to calendar'}
          </button>
        )}

        <div className="row" style={{ gap: 10 }}>
          <button className="btn btn-quiet row-fill" onClick={onDone}>{ru ? 'На главную' : 'Home'}</button>
          <button className="btn btn-primary row-fill" onClick={onAccount}>{ru ? 'В кабинет →' : 'My account →'}</button>
        </div>
      </section>

      {/* Т1 §4: by the booking status from the same answer as the list; the path is the
          «Написать» button above, not the bot (it has no «reschedule» message). */}
      <p className="faint" data-testid="confirm-footer" style={{ fontSize: 12, textAlign: 'center', padding: '0 20px 14px' }}>
        {SCHEDULE_COPY.footer[contextOf(schedule)][lang]} 💛
      </p>
    </div>
  );
}
