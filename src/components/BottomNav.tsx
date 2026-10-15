import type { Screen } from '../App';
import { Icon, type IconName } from './Icon';
import { useLang, t, tr } from '../lib/i18n';

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

export function BottomNav({
  current,
  onChange,
  collapsed = false,
  onExpand,
  onChat,
}: {
  current: Screen;
  onChange: (s: Screen) => void;
  /** Панель сжата в пилюлю вокруг текущей вкладки */
  collapsed?: boolean;
  /** Тап по сжатой панели раскрывает её, а не переключает экран */
  onExpand?: () => void;
  /** Левая кнопка: чат со студией (администратор / ANZH AI) */
  onChat?: () => void;
}) {
  const lang = useLang();
  return (
    <>
    {/* 🚨 Быстрая запись — ОТДЕЛЬНОЙ кнопкой справа от панели.
        Видна только когда панель свёрнута: в развёрнутой «Запись» стоит
        вкладкой, и две записи на одном экране — это выбор там, где его нет.
        Свёрнутая панель оставляет одну вкладку, и запись должна остаться
        рядом с ней: ради неё сюда и приходят. */}
    <button
      className="nav-chat"
      onClick={onChat}
      aria-label={tr('Чат: администратор и помощник ANZH AI', 'Chat: admin and ANZH AI assistant')}
      tabIndex={-1}
    >
      <Icon name="chat-ai" size={24} strokeWidth={1.8} />
    </button>
    <button
      className="nav-quick"
      onClick={() => onChange('booking')}
      aria-label={t('nav.booking', lang)}
      tabIndex={-1}
    >
      <Icon name="calendar" size={24} strokeWidth={1.8} />
    </button>
    <nav className="bottom-nav" aria-label={tr('Навигация', 'Navigation')}>
      {tabs.map((tab) => (
        <button
          key={tab.id}
          className={`nav-item ${current === tab.id ? 'active' : ''}`}
          onClick={() => {
            /* Сжатая панель: первый тап — «покажи остальные», и только
               потом выбор. Иначе человек тыкает в единственную видимую
               вкладку и остаётся на том же экране, не понимая, как уйти. */
            if (collapsed) { onExpand?.(); return; }
            onChange(tab.id);
          }}
          aria-current={current === tab.id ? 'page' : undefined}
          aria-expanded={collapsed ? false : undefined}
          tabIndex={collapsed && current !== tab.id ? -1 : undefined}
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
    </>
  );
}
