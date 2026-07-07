import { openSheet, toast } from '../lib/ui';
import { ReviewSheet } from '../components/ReviewSheet';

type Lang = 'ru' | 'en';
type Currency = 'usd' | 'gel';

type HistoryItem = { id: string; icon: string; name: string; when: string; sub: string; amount: number };

const HISTORY: HistoryItem[] = [
  { id: 'h1', icon: '✨', name: 'Биоревитализация', when: '12 апр', sub: 'IAL-System · оплачено', amount: 110 },
  { id: 'h2', icon: '🌿', name: 'Глубокая чистка лица', when: '8 мар', sub: 'оплачено', amount: 80 },
  { id: 'h3', icon: '💋', name: 'Контурная пластика губ', when: '21 фев', sub: 'Restylane Kysse', amount: 150 },
  { id: 'h4', icon: '💧', name: 'PDRN · ДНК-терапия', when: '14 янв', sub: 'оплачено', amount: 180 },
];

export function AccountScreen({
  onBook,
  onReschedule,
  lang,
  onLang,
  currency,
  onCurrency,
  points,
  onAwardPoints,
  userName,
}: {
  onBook: () => void;
  onReschedule: () => void;
  lang: Lang;
  onLang: (l: Lang) => void;
  currency: Currency;
  onCurrency: (c: Currency) => void;
  points: number;
  onAwardPoints: (p: number) => void;
  userName: string;
}) {
  const openReview = (defaultServiceId?: string) =>
    openSheet({
      title: 'Оставить отзыв',
      subtitle: 'Anjelika Club · копится в кабинете',
      body: <ReviewSheet defaultServiceId={defaultServiceId} onAwardPoints={onAwardPoints} />,
    });
  const showSettings = () =>
    openSheet({
      title: 'Настройки',
      subtitle: 'ANZH Cosmetology',
      body: (
        <div className="col" style={{ gap: 18 }}>
          <div>
            <div className="eyebrow" style={{ marginBottom: 8 }}>язык</div>
            <div className="row" style={{ gap: 8 }}>
              <button
                className={`chip ${lang === 'ru' ? 'active' : ''}`}
                onClick={() => {
                  onLang('ru');
                  toast('Язык: русский', 'success');
                }}
              >🇷🇺 Русский</button>
              <button
                className={`chip ${lang === 'en' ? 'active' : ''}`}
                onClick={() => {
                  onLang('en');
                  toast('Language: English', 'success');
                }}
              >🇬🇧 English</button>
            </div>
          </div>

          <div>
            <div className="eyebrow" style={{ marginBottom: 8 }}>валюта</div>
            <div className="row" style={{ gap: 8 }}>
              <button
                className={`chip ${currency === 'usd' ? 'active' : ''}`}
                onClick={() => {
                  onCurrency('usd');
                  toast('Цены в USD', 'success');
                }}
              >$ USD</button>
              <button
                className={`chip ${currency === 'gel' ? 'active' : ''}`}
                onClick={() => {
                  onCurrency('gel');
                  toast('Цены в GEL', 'success');
                }}
              >₾ GEL</button>
            </div>
          </div>

          <div>
            <div className="eyebrow" style={{ marginBottom: 8 }}>уведомления</div>
            <ul className="info-list">
              <li>Напоминание за 24 ч — ✓</li>
              <li>Напоминание за 2 ч — ✓</li>
              <li>Post-care после процедуры — ✓</li>
              <li>Акции и подарки — ✓</li>
            </ul>
          </div>
        </div>
      ),
    });

  const showLoyalty = () =>
    openSheet({
      title: 'Anjelika Club',
      subtitle: 'Программа лояльности',
      body: (
        <>
          <div className="loyalty-card" style={{ margin: 0 }}>
            <div className="loyalty-tier">★ Silver · сейчас твой тир</div>
            <div className="loyalty-points">380<small> баллов</small></div>
            <div className="loyalty-progress"><div className="loyalty-progress-fill" style={{ width: '64%' }} /></div>
            <div className="loyalty-hint">До Gold-тира ещё 220 баллов.</div>
          </div>
          <div style={{ marginTop: 16 }}>
            <div className="eyebrow" style={{ marginBottom: 8 }}>как зарабатывать</div>
            <ul className="info-list">
              <li>5% от чека возвращается баллами</li>
              <li>Отзыв 5★ → +200 баллов</li>
              <li>День рождения → +500 баллов</li>
              <li>Приведи подругу → +1000 баллов обоим</li>
            </ul>
          </div>
          <div style={{ marginTop: 16 }}>
            <div className="eyebrow" style={{ marginBottom: 8 }}>тиры и привилегии</div>
            <ul className="info-list">
              <li>Bronze · 5% кэшбэк</li>
              <li>Silver · 7% + приоритетная запись</li>
              <li>Gold · 10% + закрытые акции</li>
              <li>Diamond · 15% + персональный визажист</li>
            </ul>
          </div>
        </>
      ),
      actions: (
        <button
          className="btn btn-primary btn-block"
          onClick={() => {
            navigator.clipboard?.writeText('https://anzh.tma/ref/masha');
            toast('Реферальная ссылка скопирована', 'success');
          }}
        >
          Скопировать реферальную ссылку
        </button>
      ),
    });

  const showAppointment = () =>
    openSheet({
      title: 'Контурная пластика губ',
      subtitle: 'Пятница 24 мая · 16:30',
      body: (
        <>
          <ul className="info-list">
            <li>Restylane Kysse · 1 мл</li>
            <li>Длительность 90 мин</li>
            <li>Чавчавадзе 12, 3 этаж · домофон 12</li>
            <li>Депозит $15 удержан, к оплате на месте $135</li>
          </ul>
          <p className="muted" style={{ fontSize: 13, marginTop: 12 }}>
            Подготовка: 24 часа без алкоголя и аспирина. За 2 часа я пришлю финальный пинг.
          </p>
        </>
      ),
      actions: (
        <>
          <button className="btn btn-primary btn-block" onClick={onReschedule}>
            Перенести
          </button>
          <button
            className="btn btn-ghost btn-block"
            onClick={() => {
              window.open('https://maps.google.com/?q=Chavchavadze+12+Batumi', '_blank');
              toast('Открываю маршрут', 'success');
            }}
          >
            Маршрут в Maps
          </button>
          <button
            className="btn btn-ghost btn-block"
            onClick={() => {
              if (confirm('Отменить запись? Депозит сгорит — до 24 часов до процедуры.')) {
                toast('Запись отменена', 'success');
              }
            }}
          >
            Отменить запись
          </button>
        </>
      ),
    });

  const showHistory = (h: HistoryItem) =>
    openSheet({
      title: `${h.icon} ${h.name}`,
      subtitle: `${h.when} 2026 · оплачено`,
      body: (
        <>
          <div className="beforeafter">
            <div className="beforeafter-tile before" data-label="ДО" />
            <div className="beforeafter-tile after" data-label="ПОСЛЕ" />
          </div>
          <ul className="info-list" style={{ marginTop: 14 }}>
            <li>{h.sub}</li>
            <li>Сумма: ${h.amount}</li>
            <li>Начислено баллов: +{Math.round(h.amount * 0.05)}</li>
            <li>Заметка мастера приватна</li>
          </ul>
        </>
      ),
      actions: (
        <>
          <button className="btn btn-primary btn-block" onClick={() => { toast('Повторно записываю на эту процедуру…'); setTimeout(onBook, 600); }}>
            Записаться повторно
          </button>
          <button
            className="btn btn-ghost btn-block"
            onClick={() => openReview(h.id.startsWith('h') ? undefined : h.id)}
          >
            Оставить отзыв · +200 баллов
          </button>
        </>
      ),
    });

  const showAllHistory = () =>
    openSheet({
      title: 'История · 7 процедур',
      subtitle: 'Полная история визитов',
      body: (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          {HISTORY.map((h) => (
            <button
              key={h.id}
              className="history-row"
              onClick={() => showHistory(h)}
            >
              <div className="history-icon">{h.icon}</div>
              <div className="history-body">
                <div className="history-name">{h.name}</div>
                <div className="history-when">{h.when} · {h.sub}</div>
              </div>
              <div className="history-amount">${h.amount}</div>
            </button>
          ))}
        </div>
      ),
    });

  const showHealth = () =>
    openSheet({
      title: 'Паспорт здоровья',
      subtitle: 'Анкета · видит только Анжелика',
      body: (
        <>
          <div className="col" style={{ gap: 12 }}>
            <div>
              <div className="eyebrow" style={{ marginBottom: 6 }}>аллергии</div>
              <div className="row" style={{ flexWrap: 'wrap', gap: 6 }}>
                <span className="chip chip-gold">Без аллергий</span>
                <span className="chip chip-amber">⚠ Лидокаин — слабая реакция</span>
              </div>
            </div>
            <div>
              <div className="eyebrow" style={{ marginBottom: 6 }}>состояние</div>
              <div className="row" style={{ flexWrap: 'wrap', gap: 6 }}>
                <span className="chip">Не беременна</span>
                <span className="chip">Без хроник</span>
                <span className="chip">Не курит</span>
              </div>
            </div>
            <div>
              <div className="eyebrow" style={{ marginBottom: 6 }}>кожа</div>
              <div className="row" style={{ flexWrap: 'wrap', gap: 6 }}>
                <span className="chip">Тип II</span>
                <span className="chip">Без купероза</span>
                <span className="chip">Чувствительность · средняя</span>
              </div>
            </div>
          </div>
          <p className="muted" style={{ fontSize: 13, marginTop: 14 }}>
            Анкета синхронизирована с записями. Перед каждой процедурой я проверяю противопоказания автоматически.
          </p>
        </>
      ),
      actions: (
        <button
          className="btn btn-primary btn-block"
          onClick={() => toast('Открываю полную форму редактирования…')}
        >
          Редактировать анкету
        </button>
      ),
    });

  return (
    <div className="screen">
      <header className="header">
        <div className="header-lede">
          <div className="eyebrow">кабинет</div>
          <div className="header-title">{userName}</div>
        </div>
        <button className="chip" onClick={showSettings} aria-label="Настройки">⚙ Настройки</button>
      </header>

      <section className="account-hero">
        <h1 className="account-hello">Привет, {userName} 💛</h1>
        <div className="account-sub">Клиент с 2024 · 7 процедур · VIP</div>
      </section>

      <button className="loyalty-card" onClick={showLoyalty}>
        <div className="loyalty-tier">★ Silver · Anjelika Club</div>
        <div className="loyalty-points">{points}<small> баллов</small></div>
        <div className="loyalty-progress"><div className="loyalty-progress-fill" style={{ width: `${Math.min(100, Math.round((points / 600) * 100))}%` }} /></div>
        <div className="loyalty-hint">До Gold-тира ещё {Math.max(0, 600 - points)} баллов — отзыв даёт +200, фото +100.</div>
      </button>

      <button className="next-appt" onClick={showAppointment}>
        <div className="next-appt-day">
          <span className="d">24</span>
          <span className="m">МАЙ</span>
        </div>
        <div className="next-appt-body">
          <div className="t">Ближайшая запись</div>
          <div className="what">Контурная пластика губ</div>
          <div className="when">пятница · 16:30 · Чавчавадзе 12</div>
        </div>
        <div style={{ color: 'var(--tl)', fontSize: 18, paddingRight: 4 }}>›</div>
      </button>

      <section className="section">
        <div className="section-head">
          <div>
            <div className="eyebrow">История</div>
            <h2 className="section-title">Что было</h2>
          </div>
          <button className="section-link" onClick={showAllHistory} style={{ background: 'none', border: 0 }}>
            все 7 →
          </button>
        </div>
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          {HISTORY.slice(0, 3).map((h) => (
            <button
              key={h.id}
              className="history-row"
              onClick={() => showHistory(h)}
            >
              <div className="history-icon">{h.icon}</div>
              <div className="history-body">
                <div className="history-name">{h.name}</div>
                <div className="history-when">{h.when} · {h.sub}</div>
              </div>
              <div className="history-amount">${h.amount}</div>
            </button>
          ))}
        </div>
      </section>

      <section className="section" style={{ paddingTop: 0 }}>
        <div className="section-head">
          <div>
            <div className="eyebrow">Паспорт здоровья</div>
            <h2 className="section-title">Анкета</h2>
          </div>
          <button className="section-link" onClick={showHealth} style={{ background: 'none', border: 0 }}>
            правка
          </button>
        </div>
        <button
          onClick={showHealth}
          className="card"
          style={{ padding: 18, width: '100%', textAlign: 'left', cursor: 'pointer' }}
        >
          <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
            <span className="chip chip-gold">Без аллергий</span>
            <span className="chip">Не беременна</span>
            <span className="chip chip-amber">⚠ Лидокаин — слабая реакция</span>
            <span className="chip">Тип кожи II</span>
            <span className="chip">Без хроник</span>
          </div>
          <div className="faint" style={{ fontSize: 12, marginTop: 12 }}>
            Анжелика видит флаги перед каждой записью.
          </div>
        </button>
      </section>

      <div style={{ padding: '0 20px 8px' }}>
        <button className="btn btn-primary btn-block" onClick={onBook}>
          Записаться снова
        </button>
      </div>
      <div style={{ padding: '0 20px 20px' }}>
        <button
          className="btn btn-ghost btn-block"
          onClick={() => openReview()}
        >
          Оставить отзыв · +200 баллов
        </button>
      </div>
    </div>
  );
}
