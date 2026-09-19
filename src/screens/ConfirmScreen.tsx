import { useEffect, useMemo } from 'react';
import { Icon } from '../components/Icon';
import { toast } from '../lib/ui';
import { useAppointments, formatLongDate, fromISODate } from '../lib/appointments';
import { downloadIcs } from '../lib/ics';
import { findService, sTitle } from '../data/services';
import { useLang } from '../lib/i18n';

export function ConfirmScreen({ onDone, onAccount }: { onDone: () => void; onAccount: () => void }) {
  const lang = useLang();
  const ru = lang === 'ru';
  const all = useAppointments();
  // Показываем именно ту заявку, которую человек только что отправил, а не
  // ближайшую по дате — иначе на экране оказывается чужая запись из базы.
  const appt = useMemo(
    () => [...all].sort((a, b) => b.createdAt - a.createdAt)[0],
    [all],
  );
  const service = appt ? findService(appt.serviceId) : undefined;

  useEffect(() => {
    const t = setTimeout(() => toast(ru ? 'Заявка у Анжелики — ответит в течение дня' : 'Anjelika has your request — she replies within the day', 'success'), 600);
    return () => clearTimeout(t);
  }, []);

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
        <p className="muted" style={{ marginTop: 8, maxWidth: 330, marginInline: 'auto' }}>
          {appt && (
            <>
              {service ? sTitle(service, lang) : ''} · {formatLongDate(fromISODate(appt.dateISO), lang)} · {appt.slot}.{' '}
            </>
          )}
          {ru
            ? 'Она подтвердит время или предложит другое — у неё параллельно идут записи по телефону.'
            : 'She’ll confirm the time or offer another — she also takes bookings by phone.'}
        </p>
      </section>

      <section style={{ padding: 20 }}>
        <div className="card" style={{ padding: 18 }}>
          <div className="eyebrow" style={{ marginBottom: 10 }}>{ru ? 'что дальше' : 'what happens next'}</div>
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
                <div className="cf-sub">{ru ? 'Придёт уведомление: принято или другое время' : 'You’ll get a notification: accepted or a new time'}</div>
              </div>
            </li>
            <li>
              <span className="cf-dot" />
              <div>
                <div className="cf-title">{ru ? 'Напоминание за сутки и утром' : 'Reminder a day before and in the morning'}</div>
                <div className="cf-sub">{ru ? 'Плюс подготовка к процедуре' : 'Plus how to prepare'}</div>
              </div>
            </li>
            <li>
              <span className="cf-dot" />
              <div>
                <div className="cf-title">{ru ? 'После — уход и баллы' : 'After — care and points'}</div>
                <div className="cf-sub">{ru ? 'Post-care, кэшбэк баллами, через 2 недели спрошу результат' : 'Post-care, points cashback, a result check-in in two weeks'}</div>
              </div>
            </li>
          </ol>
        </div>
      </section>

      <section style={{ padding: '0 20px 20px' }}>
        <div className="row" style={{ gap: 10, marginBottom: 10 }}>
          <button
            className="btn btn-ghost"
            style={{ flex: 1 }}
            onClick={() => toast(ru ? 'Добавлю в календарь, как только Анжелика подтвердит' : 'I’ll add it to your calendar once Anjelika confirms')}
          >
            <Icon name="calendar" size={16} strokeWidth={1.9} /> {ru ? 'В календарь' : 'Calendar'}
          </button>
          <button
            className="btn btn-ghost"
            style={{ flex: 1 }}
            onClick={() => {
              window.open('https://t.me/anzh_cosmetology', '_blank');
              toast(ru ? 'Открываю чат с Анжеликой' : 'Opening the chat with Anjelika', 'success');
            }}
          >
            <Icon name="message" size={16} strokeWidth={1.9} /> {ru ? 'Написать' : 'Message'}
          </button>
        </div>
        {/* Календарь с напоминанием за два часа: до этого «мы напомним»
            было обещанием, которое приложение не могло сдержать — пушей нет */}
        <button
          className="btn btn-secondary btn-block"
          style={{ marginBottom: 10 }}
          onClick={() => {
            const ok = downloadIcs(appt, lang);
            toast(
              ok
                ? (ru ? 'Визит добавлен в календарь' : 'Added to your calendar')
                : (ru ? 'Календарь не открылся — время есть в кабинете' : 'Calendar blocked — the time is in your passport'),
              ok ? 'success' : 'info',
            );
          }}
        >
          <Icon name="calendar" size={16} strokeWidth={1.9} /> {ru ? 'Добавить в календарь' : 'Add to calendar'}
        </button>

        <div className="row" style={{ gap: 10 }}>
          <button className="btn btn-quiet" style={{ flex: 1 }} onClick={onDone}>{ru ? 'На главную' : 'Home'}</button>
          <button className="btn btn-primary" style={{ flex: 1 }} onClick={onAccount}>{ru ? 'В кабинет →' : 'My account →'}</button>
        </div>
      </section>

      <p className="faint" style={{ fontSize: 12, textAlign: 'center', padding: '0 20px 14px' }}>
        {ru ? 'Если время не подойдёт — перенесём одним сообщением' : 'If the time doesn’t work — we’ll move it in one message'} 💛
      </p>
    </div>
  );
}
