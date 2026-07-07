import type { Screen } from '../App';
import { Icon, type IconName } from './Icon';

type Tab = { id: Screen; label: string; icon: IconName };

const tabs: Tab[] = [
  { id: 'profile', label: 'Профиль', icon: 'lotus' },
  { id: 'catalog', label: 'Каталог', icon: 'sparkles' },
  { id: 'booking', label: 'Запись',  icon: 'calendar' },
  { id: 'account', label: 'Кабинет', icon: 'user' },
  { id: 'anzh',    label: 'ANZH',    icon: 'shopping-bag' },
];

export function BottomNav({ current, onChange }: { current: Screen; onChange: (s: Screen) => void }) {
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
          <span className="nav-label">{tab.label}</span>
        </button>
      ))}
    </nav>
  );
}
