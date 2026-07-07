import { useEffect } from 'react';
import { Icon } from '../components/Icon';
import { toast } from '../lib/ui';

export function ConfirmScreen({ onDone, onAccount }: { onDone: () => void; onAccount: () => void }) {
  useEffect(() => {
    const t = setTimeout(() => toast('Запись подтверждена 💛 .ics отправил в Telegram', 'success'), 600);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="screen">
      <header className="header">
        <div className="header-lede">
          <div className="eyebrow">подтверждение</div>
          <div className="header-title">Готово</div>
        </div>
        <span className="chip chip-gold"><Icon name="check" size={12} strokeWidth={2.4} /> записано</span>
      </header>

      <section style={{ padding: '36px 20px 0', textAlign: 'center' }}>
        <div className="confirm-icon"><Icon name="check" size={42} strokeWidth={2.6} /></div>
        <h1 style={{ fontFamily: 'Space Grotesk, system-ui, sans-serif', fontSize: 30, fontWeight: 600, letterSpacing: '-0.015em' }}>
          Записала тебя 💛
        </h1>
        <p className="muted" style={{ marginTop: 8, maxWidth: 320, marginInline: 'auto' }}>
          Пятница 24 мая · 16:30 · Parnavaz Mepe 92/94, 3 этаж.
          За 24 часа я пришлю напоминание и подготовку, за 2 часа — финальный пинг.
        </p>
      </section>

      <section style={{ padding: 20 }}>
        <div className="card" style={{ padding: 18 }}>
          <div className="eyebrow" style={{ marginBottom: 10 }}>что дальше</div>
          <ul className="info-list">
            <li>Пуш-напоминание за 24 ч и за 2 ч</li>
            <li>Подготовка: не алкоголь, не аспирин</li>
            <li>После — post-care в личном кабинете</li>
            <li>Чек и баллы лояльности — автоматически</li>
          </ul>
        </div>
      </section>

      <section style={{ padding: '0 20px 20px' }}>
        <div className="row" style={{ gap: 10, marginBottom: 10 }}>
          <button
            className="btn btn-ghost"
            style={{ flex: 1 }}
            onClick={() => {
              toast('Календарь обновлён ✓', 'success');
            }}
          >
            <Icon name="calendar" size={16} strokeWidth={1.9} /> В календарь
          </button>
          <button
            className="btn btn-ghost"
            style={{ flex: 1 }}
            onClick={() => {
              navigator.clipboard?.writeText('Записалась к Анжелике на пятницу 16:30');
              toast('Ссылка скопирована — можно поделиться', 'success');
            }}
          >
            <Icon name="share" size={16} strokeWidth={1.9} /> Поделиться
          </button>
        </div>
        <div className="row" style={{ gap: 10 }}>
          <button className="btn btn-ghost" style={{ flex: 1 }} onClick={onDone}>На главную</button>
          <button className="btn btn-primary" style={{ flex: 1 }} onClick={onAccount}>В кабинет →</button>
        </div>
      </section>

      <p className="faint" style={{ fontSize: 12, textAlign: 'center', padding: '0 20px 14px' }}>
        Если что-то изменится — я перенесу одним сообщением 💛
      </p>
    </div>
  );
}
