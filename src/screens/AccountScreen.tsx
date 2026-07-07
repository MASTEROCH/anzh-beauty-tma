import { openSheet, toast } from '../lib/ui';
import { Icon } from '../components/Icon';
import { ReviewSheet } from '../components/ReviewSheet';
import { SettingsSheet } from '../components/SettingsSheet';
import { t } from '../lib/i18n';

type Lang = 'ru' | 'en';
type Currency = 'usd' | 'gel';

type HistoryItem = { id: string; photo: string; name: string; when: string; sub: string; amount: number };

const HISTORY: HistoryItem[] = [
  { id: 'h1', photo: '/photos/biorevit.jpg', name: 'Биоревитализация', when: '12 апр', sub: 'IAL-System · оплачено', amount: 110 },
  { id: 'h2', photo: '/photos/deep-cleansing.jpg', name: 'Глубокая чистка лица', when: '8 мар', sub: 'оплачено', amount: 80 },
  { id: 'h3', photo: '/photos/lip-filler.jpg', name: 'Контурная пластика губ', when: '21 фев', sub: 'Restylane Kysse', amount: 150 },
  { id: 'h4', photo: '/photos/pdrn.jpg', name: 'PDRN · ДНК-терапия', when: '14 янв', sub: 'оплачено', amount: 180 },
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
      subtitle: 'Скидка на следующую процедуру',
      body: <ReviewSheet defaultServiceId={defaultServiceId} onAwardPoints={onAwardPoints} />,
    });
  const showSettings = () =>
    openSheet({
      title: t('settings.title', lang),
      subtitle: 'ANZH Cosmetology',
      body: <SettingsSheet lang={lang} onLang={onLang} currency={currency} onCurrency={onCurrency} />,
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
              <li>Отзыв → −10% на следующую процедуру</li>
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
            <li>Parnavaz Mepe 92/94, 3 этаж · домофон 12</li>
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
              window.open('https://www.google.com/maps/search/?api=1&query=41.6462,41.6324', '_blank');
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
      title: h.name,
      subtitle: `${h.when} 2026 · оплачено`,
      body: (
        <>
          <div className="beforeafter">
            <div className="beforeafter-tile before" data-label="ДО" style={{ backgroundImage: `url(${h.photo})` }} />
            <div className="beforeafter-tile after" data-label="ПОСЛЕ" style={{ backgroundImage: `url(${h.photo})` }} />
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
            Оставить отзыв · −10%
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
              <div className="history-icon" style={{ backgroundImage: `url(${h.photo})` }} />
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
          <div className="eyebrow">{t('account.title', lang)}</div>
          <div className="header-title">{userName}</div>
        </div>
        <button className="chip" onClick={showSettings} aria-label="Настройки"><Icon name="settings" size={14} strokeWidth={1.8} /> {t('settings.title', lang)}</button>
      </header>

      <section className="account-hero">
        <h1 className="account-hello">{t('account.hello', lang)}, {userName} <Icon name="heart-filled" size={22} strokeWidth={0} style={{ color: 'var(--brand-gold)', verticalAlign: '-2px' }} /></h1>
        <div className="account-sub">{t('account.clientSince', lang)} 2024 · 7 {t('account.procs', lang)} · VIP</div>
      </section>

      <button className="loyalty-card" onClick={showLoyalty}>
        <div className="loyalty-tier">★ Silver · Anjelika Club</div>
        <div className="loyalty-points">{points}<small> баллов</small></div>
        <div className="loyalty-progress"><div className="loyalty-progress-fill" style={{ width: `${Math.min(100, Math.round((points / 600) * 100))}%` }} /></div>
        <div className="loyalty-hint">До Gold-тира ещё {Math.max(0, 600 - points)} баллов · отзыв и сторис — скидки на процедуры.</div>
      </button>

      <button className="next-appt" onClick={showAppointment}>
        <div className="next-appt-day">
          <span className="d">24</span>
          <span className="m">МАЙ</span>
        </div>
        <div className="next-appt-body">
          <div className="t">{t('account.next', lang)}</div>
          <div className="what">{lang === 'ru' ? 'Контурная пластика губ' : 'Lip contouring'}</div>
          <div className="when">{lang === 'ru' ? 'пятница' : 'Friday'} · 16:30 · Parnavaz Mepe 92/94</div>
        </div>
        <div style={{ color: 'var(--tl)', fontSize: 18, paddingRight: 4 }}>›</div>
      </button>

      <section className="section">
        <div className="section-head">
          <div>
            <div className="eyebrow">{t('account.history', lang)}</div>
            <h2 className="section-title">{t('account.historyTitle', lang)}</h2>
          </div>
          <button className="section-link" onClick={showAllHistory} style={{ background: 'none', border: 0 }}>
            {t('account.allN', lang)} 7 →
          </button>
        </div>
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          {HISTORY.slice(0, 3).map((h) => (
            <button
              key={h.id}
              className="history-row"
              onClick={() => showHistory(h)}
            >
              <div className="history-icon" style={{ backgroundImage: `url(${h.photo})` }} />
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
            <div className="eyebrow">{t('account.passport', lang)}</div>
            <h2 className="section-title">{t('account.form', lang)}</h2>
          </div>
          <button className="section-link" onClick={showHealth} style={{ background: 'none', border: 0 }}>
            {lang === 'ru' ? 'правка' : 'edit'}
          </button>
        </div>
        <button onClick={showHealth} className="patient-card">
          <div className="patient-head">
            <div className="patient-avatar">{userName.slice(0, 1).toUpperCase()}</div>
            <div className="patient-id">
              <div className="patient-name">{userName}</div>
              <div className="patient-meta">ID ANZH-0342 · {lang === 'ru' ? 'клиент с 2024' : 'client since 2024'}</div>
            </div>
            <div className="patient-badge">Fitzpatrick II</div>
          </div>
          <div className="patient-vitals">
            <div className="pv"><span className="pv-label">{lang === 'ru' ? 'Тип кожи' : 'Skin type'}</span><span className="pv-val">{lang === 'ru' ? 'Комбинированная' : 'Combination'}</span></div>
            <div className="pv"><span className="pv-label">{lang === 'ru' ? 'Чувствит.' : 'Sensitivity'}</span><span className="pv-val">{lang === 'ru' ? 'Средняя' : 'Medium'}</span></div>
            <div className="pv"><span className="pv-label">{lang === 'ru' ? 'Купероз' : 'Couperose'}</span><span className="pv-val">{lang === 'ru' ? 'Нет' : 'No'}</span></div>
          </div>
          <div className="patient-flags">
            <span className="flag warn"><Icon name="warning" size={13} strokeWidth={2} /> {lang === 'ru' ? 'Лидокаин — слабая реакция' : 'Lidocaine — mild reaction'}</span>
            <span className="flag ok"><Icon name="check" size={13} strokeWidth={2.4} /> {lang === 'ru' ? 'Без аллергий' : 'No allergies'}</span>
            <span className="flag ok"><Icon name="check" size={13} strokeWidth={2.4} /> {lang === 'ru' ? 'Не беременна · без хроник' : 'Not pregnant · no chronic'}</span>
          </div>
          <div className="patient-foot">
            <Icon name="shield-check" size={14} strokeWidth={1.8} />
            {lang === 'ru' ? 'Анжелика проверяет флаги перед каждой записью' : 'Anjelika reviews these flags before every visit'}
          </div>
        </button>
      </section>

      <div style={{ padding: '0 20px 8px' }}>
        <button className="btn btn-primary btn-block" onClick={onBook}>
          {t('account.rebook', lang)}
        </button>
      </div>
      <div style={{ padding: '0 20px 20px' }}>
        <button
          className="btn btn-ghost btn-block"
          onClick={() => openReview()}
        >
          Оставить отзыв · −10%
        </button>
      </div>
    </div>
  );
}
