import { useEffect, useMemo } from 'react';
import { Icon } from '../components/Icon';
import { toast } from '../lib/ui';
import { pts, useLang } from '../lib/i18n';
import { clinic, clinicAddress, mapsUrl } from '../data/clinic';
import { findService, sTitle } from '../data/services';
import { addMinutes, fmtDateLong, fmtRelative } from '../lib/date';
import { money, nextBooking, useStore } from '../lib/store';
import { downloadIcs } from '../lib/ics';
import { haptic, openExternal } from '../lib/telegram';

export function ConfirmScreen({ onDone, onAccount }: { onDone: () => void; onAccount: () => void }) {
  const lang = useLang();
  const ru = lang === 'ru';
  const store = useStore();
  const booking = useMemo(() => nextBooking(store), [store]);
  const service = booking ? findService(booking.serviceId) : undefined;

  useEffect(() => {
    const id = setTimeout(
      () => toast(ru ? 'Запись подтверждена 💛 .ics отправил в Telegram' : 'Booking confirmed 💛 .ics sent to Telegram', 'success'),
      600,
    );
    return () => clearTimeout(id);
  }, [ru]);

  const when = booking
    ? `${fmtDateLong(booking.date, lang)} · ${booking.slot}`
    : ru ? 'ближайший свободный слот' : 'the next free slot';
  const shareText = booking && service
    ? ru
      ? `Записалась к Анжелике · ${sTitle(service, lang)} · ${fmtDateLong(booking.date, lang)} в ${booking.slot}`
      : `Booked with Anjelika · ${sTitle(service, lang)} · ${fmtDateLong(booking.date, lang)} at ${booking.slot}`
    : 'ANZH Cosmetology';

  return (
    <div className="screen">
      <header className="header">
        <div className="header-lede">
          <div className="eyebrow">{ru ? 'подтверждение' : 'confirmation'}</div>
          <div className="header-title">{ru ? 'Готово' : 'All set'}</div>
        </div>
        <span className="chip chip-gold">
          <Icon name="check" size={12} strokeWidth={2.4} /> {ru ? 'записано' : 'booked'}
        </span>
      </header>

      <section style={{ padding: '36px 20px 0', textAlign: 'center' }}>
        <div className="confirm-icon"><Icon name="check" size={42} strokeWidth={2.6} /></div>
        <h1 style={{ fontFamily: 'Space Grotesk, system-ui, sans-serif', fontSize: 30, fontWeight: 600, letterSpacing: '-0.015em' }}>
          {ru ? 'Записала тебя 💛' : 'You’re booked 💛'}
        </h1>
        <p className="muted" style={{ marginTop: 8, maxWidth: 320, marginInline: 'auto' }}>
          {when} · {clinic.street}, {clinic.floor[lang]}.{' '}
          {ru
            ? 'За 24 часа я пришлю напоминание и подготовку, за 2 часа — финальный пинг.'
            : 'I’ll send prep and a reminder 24 h ahead, and a final ping 2 h before.'}
        </p>
        {booking && (
          <div className="confirm-badges">
            <span className="chip chip-gold">+{booking.points} {pts(booking.points, lang)}</span>
            <span className="chip">{fmtRelative(booking.date, lang)}</span>
            {service && (
              <span className="chip">
                {booking.slot}–{addMinutes(booking.slot, service.duration)}
              </span>
            )}
          </div>
        )}
      </section>

      <section style={{ padding: 20 }}>
        <div className="card" style={{ padding: 18 }}>
          <div className="eyebrow" style={{ marginBottom: 10 }}>{ru ? 'детали' : 'details'}</div>
          {booking && service && (
            <>
              <div className="summary-row">
                <span className="k">{ru ? 'Процедура' : 'Treatment'}</span>
                <span className="v">{sTitle(service, lang)}</span>
              </div>
              <div className="summary-row">
                <span className="k">{ru ? 'Когда' : 'When'}</span>
                <span className="v">{fmtDateLong(booking.date, lang)} · {booking.slot}</span>
              </div>
              <div className="summary-row">
                <span className="k">{ru ? 'К оплате' : 'Total'}</span>
                <span className="v">{money(booking.priceUsd, booking.priceGel, store.currency)}</span>
              </div>
            </>
          )}
          <div className="eyebrow" style={{ margin: '14px 0 10px' }}>{ru ? 'что дальше' : "what's next"}</div>
          <ul className="info-list">
            <li>{ru ? 'Пуш-напоминание за 24 ч и за 2 ч' : 'Push reminders 24 h and 2 h before'}</li>
            <li>{ru ? 'Подготовка: не алкоголь, не аспирин' : 'Prep: no alcohol, no aspirin'}</li>
            <li>{ru ? 'После — post-care в личном кабинете' : 'Post-care lands in your account afterwards'}</li>
            <li>{ru ? 'Чек и баллы лояльности — автоматически' : 'Receipt and loyalty points are automatic'}</li>
          </ul>
        </div>
      </section>

      <section style={{ padding: '0 20px 20px' }}>
        <div className="row" style={{ gap: 10, marginBottom: 10 }}>
          <button
            className="btn btn-ghost"
            style={{ flex: 1 }}
            disabled={!booking}
            onClick={() => {
              if (!booking) return;
              const ok = downloadIcs(booking, lang);
              haptic.notify(ok ? 'success' : 'warning');
              toast(
                ok
                  ? (ru ? 'Календарь обновлён ✓' : 'Added to your calendar ✓')
                  : (ru ? 'Не удалось скачать .ics' : 'Could not download the .ics'),
                ok ? 'success' : 'info',
              );
            }}
          >
            <Icon name="calendar" size={16} strokeWidth={1.9} /> {ru ? 'В календарь' : 'Add to calendar'}
          </button>
          <button
            className="btn btn-ghost"
            style={{ flex: 1 }}
            onClick={() => {
              const nav = navigator as Navigator & { share?: (d: { text?: string; url?: string }) => Promise<void> };
              if (nav.share) nav.share({ text: shareText, url: clinic.instagram }).catch(() => {});
              else navigator.clipboard?.writeText(shareText);
              toast(ru ? 'Скопировано — можно поделиться' : 'Copied — ready to share', 'success');
            }}
          >
            <Icon name="share" size={16} strokeWidth={1.9} /> {ru ? 'Поделиться' : 'Share'}
          </button>
        </div>
        <button
          className="btn btn-ghost btn-block"
          style={{ marginBottom: 10 }}
          onClick={() => { openExternal(mapsUrl); toast(ru ? 'Открываю маршрут' : 'Opening directions', 'success'); }}
        >
          <Icon name="pin" size={16} strokeWidth={1.9} /> {clinicAddress(lang)}
        </button>
        <div className="row" style={{ gap: 10 }}>
          <button className="btn btn-ghost" style={{ flex: 1 }} onClick={onDone}>
            {ru ? 'На главную' : 'Home'}
          </button>
          <button className="btn btn-primary" style={{ flex: 1 }} onClick={onAccount}>
            {ru ? 'В кабинет →' : 'To account →'}
          </button>
        </div>
      </section>

      <p className="faint" style={{ fontSize: 12, textAlign: 'center', padding: '0 20px 14px' }}>
        {ru ? 'Если что-то изменится — я перенесу одним сообщением 💛' : 'If plans change, one message and I’ll move it 💛'}
      </p>
    </div>
  );
}
