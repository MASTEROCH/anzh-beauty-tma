import { useState } from 'react';
import { Icon } from './Icon';
import { toast } from '../lib/ui';
import { t, useLang, type Lang } from '../lib/i18n';

type Currency = 'usd' | 'gel';

interface Props {
  lang: Lang;
  onLang: (l: Lang) => void;
  currency: Currency;
  onCurrency: (c: Currency) => void;
}

const NOTIF = [
  { key: 'settings.notif.24h', icon: 'clock' as const },
  { key: 'settings.notif.2h', icon: 'bolt' as const },
  { key: 'settings.notif.post', icon: 'heart' as const },
  { key: 'settings.notif.promo', icon: 'gift' as const },
];

export function SettingsSheet({ lang: initialLang, onLang, currency: initialCurrency, onCurrency }: Props) {
  const lang = useLang();                                  // reactive to global language store
  const [currency, setCurrency] = useState<Currency>(initialCurrency);
  const [notif, setNotif] = useState<boolean[]>([true, true, true, false]);
  void initialLang;

  return (
    <div className="col settings-sheet" style={{ gap: 20 }}>
      {/* Language */}
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

      {/* Currency */}
      <div>
        <div className="eyebrow set-eyebrow">{t('settings.currency', lang)}</div>
        <div className="seg">
          {(['usd', 'gel'] as Currency[]).map((c) => (
            <button
              key={c}
              className={`seg-btn ${currency === c ? 'active' : ''}`}
              onClick={() => { setCurrency(c); onCurrency(c); toast(c === 'usd' ? 'Цены в USD' : 'Цены в GEL', 'success'); }}
            >
              <span style={{ fontWeight: 800 }}>{c === 'usd' ? '$' : '₾'}</span>
              <span>{c.toUpperCase()}</span>
              {currency === c && <Icon name="check" size={14} strokeWidth={2.6} className="seg-check" />}
            </button>
          ))}
        </div>
      </div>

      {/* Notifications */}
      <div>
        <div className="eyebrow set-eyebrow">{t('settings.notif', lang)}</div>
        <div className="set-rows">
          {NOTIF.map((n, i) => (
            <button
              key={n.key}
              className="set-row"
              onClick={() => setNotif((prev) => prev.map((v, j) => (j === i ? !v : v)))}
              aria-pressed={notif[i]}
            >
              <span className="set-row-icon"><Icon name={n.icon} size={16} strokeWidth={1.8} /></span>
              <span className="set-row-label">{t(n.key, lang)}</span>
              <span className={`toggle ${notif[i] ? 'on' : ''}`}><span className="toggle-knob" /></span>
            </button>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="set-footer">
        <div className="set-footer-brand">{t('settings.about', lang)}</div>
        <div className="set-footer-ver">{t('settings.version', lang)}</div>
      </div>
    </div>
  );
}
