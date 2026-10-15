import type { Screen } from '../App';
import { Icon, type IconName } from './Icon';
import { useLang, t } from '../lib/i18n';

type Tab = { id: Screen; key: string; icon: IconName | 'anzh' };

const tabs: Tab[] = [
  { id: 'profile', key: 'nav.profile', icon: 'flower' },
  { id: 'catalog', key: 'nav.catalog', icon: 'sparkles' },
  { id: 'booking', key: 'nav.booking', icon: 'calendar' },
  { id: 'account', key: 'nav.account', icon: 'user' },
  /* ANZH — не иконка, а знак бренда. Корзина здесь врала: вкладка ведёт
     не в магазин, а к разборам кожи, и покупка там побочна. Из
     функциональных иконок ни одна не подошла: капля и лист уже заняты
     внутри самих разборов, стетоскоп читается как приём врача. Знак
     решает точнее любой метафоры — вкладка так и называется, ANZH, и
     это отдельный продукт внутри приложения.

     Рисуется маской, а не картинкой: так он берёт currentColor и
     подсвечивается активным состоянием наравне со штриховыми соседями,
     а не остаётся белым пятном. */
  { id: 'anzh',    key: 'nav.anzh',    icon: 'anzh' },
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
          <span className="nav-icon">
            {tab.icon === 'anzh'
              ? <span className="nav-mark" aria-hidden />
              : <Icon name={tab.icon as IconName} size={22} strokeWidth={1.7} />}
          </span>
          <span className="nav-label">{t(tab.key, lang)}</span>
        </button>
      ))}
    </nav>
  );
}
