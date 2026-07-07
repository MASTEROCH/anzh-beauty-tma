import type { Screen } from '../App';
import { Icon, type IconName } from './Icon';
import { useLang, t } from '../lib/i18n';

type Tab = { id: Screen; key: string; icon: IconName };

const tabs: Tab[] = [
  { id: 'profile', key: 'nav.profile', icon: 'lotus' },
  { id: 'catalog', key: 'nav.catalog', icon: 'sparkles' },
  { id: 'booking', key: 'nav.booking', icon: 'calendar' },
  { id: 'account', key: 'nav.account', icon: 'user' },
  { id: 'anzh',    key: 'nav.anzh',    icon: 'shopping-bag' },
];

export function BottomNav({ current, onChange }: { current: Screen; onChange: (s: Screen) => void }) {
  const lang = useLang();
  return (
    <nav className="bottom-nav" aria-label="Навигация">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          className={`nav-item ${current === tab.id ? 'active' : ''}`}
          onClick={() => onChange(tab.id)}
          aria-current={current === tab.id ? 'page' : undefined}
        >
          <span className="nav-icon"><Icon name={tab.icon} size={22} strokeWidth={1.7} /></span>
          <span className="nav-label">{t(tab.key, lang)}</span>
        </button>
      ))}
    </nav>
  );
}
