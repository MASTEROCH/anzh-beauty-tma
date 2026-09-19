import { Icon } from './Icon';
import { toast } from '../lib/ui';
import { t, useLang, type Lang } from '../lib/i18n';
import { useNotifications, toggleNotification, NOTIF_ROWS } from '../lib/notifications';

type Currency = 'usd' | 'gel';

interface Props {
  lang: Lang;
  onLang: (l: Lang) => void;
  currency: Currency;
  onCurrency: (c: Currency) => void;
  onStudio?: () => void;
}

export function SettingsSheet({ onLang, currency, onCurrency, onStudio }: Props) {
  const lang = useLang();
  const notif = useNotifications();

  return (
    <div className="col settings-sheet" style={{ gap: 20 }}>
      {/* Язык */}
      <div>
        <div className="eyebrow set-eyebrow">{t('settings.lang', lang)}</div>
        <div className="seg">
          {(['ru', 'en'] as Lang[]).map((l) => (
            <button
              key={l}
              className={`seg-btn ${lang === l ? 'active' : ''}`}
              onClick={() => { onLang(l); toast(l === 'ru' ? 'Язык: русский' : 'Language: English', 'success'); }}
            >
              <Icon name="globe" size={15} strokeWidth={1.9} />
              <span>{l === 'ru' ? 'Русский' : 'English'}</span>
              {lang === l && <Icon name="check" size={14} strokeWidth={2.6} className="seg-check" />}
            </button>
          ))}
        </div>
      </div>

      {/* Валюта */}
      <div>
        <div className="eyebrow set-eyebrow">{t('settings.currency', lang)}</div>
        <div className="seg">
          {(['usd', 'gel'] as Currency[]).map((c) => (
            <button
              key={c}
              className={`seg-btn ${currency === c ? 'active' : ''}`}
              onClick={() => { onCurrency(c); toast(c === 'usd' ? 'Цены в USD' : 'Цены в GEL', 'success'); }}
            >
              <span style={{ fontWeight: 800 }}>{c === 'usd' ? '$' : '₾'}</span>
              <span>{c.toUpperCase()}</span>
              {currency === c && <Icon name="check" size={14} strokeWidth={2.6} className="seg-check" />}
            </button>
          ))}
        </div>
      </div>

      {/* Уведомления — теперь переживают перезапуск мини-аппа */}
      <div>
        <div className="eyebrow set-eyebrow">{t('settings.notif', lang)}</div>
        <div className="set-rows">
          {NOTIF_ROWS.map((n) => (
            <button
              key={n.key}
              className="set-row"
              onClick={() => toggleNotification(n.key)}
              aria-pressed={notif[n.key]}
            >
              <span className="set-row-icon"><Icon name={n.icon} size={16} strokeWidth={1.8} /></span>
              <span className="set-row-label">
                {n.label[lang]}
                <span className="set-row-sub">{n.sub[lang]}</span>
              </span>
              <span className={`toggle ${notif[n.key] ? 'on' : ''}`}><span className="toggle-knob" /></span>
            </button>
          ))}
        </div>
      </div>

      {/* Кабинет мастера */}
      {onStudio && (
        <button className="set-row set-row-studio" onClick={onStudio}>
          <span className="set-row-icon"><Icon name="lotus" size={16} strokeWidth={1.8} /></span>
          <span className="set-row-label">
            Кабинет мастера
            <span className="set-row-sub">Заявки, расписание, база клиентов</span>
          </span>
          <Icon name="chevron-right" size={18} strokeWidth={2} style={{ color: 'var(--text-hint)' }} />
        </button>
      )}

      <div className="set-footer">
        <div className="set-footer-brand">{t('settings.about', lang)}</div>
        <div className="set-footer-ver">{t('settings.version', lang)}</div>
      </div>
    </div>
  );
}
