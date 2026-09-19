// Тактильный отклик Telegram. В мини-аппе он заменяет ощущение «нажалось»:
// без него интерфейс на телефоне читается как картинка, а не как приложение.
// Вне Telegram молча ничего не делает — Vibration API намеренно не трогаем,
// он даёт грубую дрожь вместо короткого щелчка.

type Impact = 'light' | 'medium' | 'heavy' | 'rigid' | 'soft';
type Notify = 'error' | 'success' | 'warning';

interface HapticAPI {
  impactOccurred?: (style: Impact) => void;
  notificationOccurred?: (type: Notify) => void;
  selectionChanged?: () => void;
}

function api(): HapticAPI | undefined {
  if (typeof window === 'undefined') return undefined;
  return (window as unknown as { Telegram?: { WebApp?: { HapticFeedback?: HapticAPI } } })
    .Telegram?.WebApp?.HapticFeedback;
}

/** Обычный тап по кнопке или карточке */
export const tap = (style: Impact = 'light') => { try { api()?.impactOccurred?.(style); } catch { /* ignore */ } };

/** Смена выбора: слот, чип, сегмент */
export const select = () => { try { api()?.selectionChanged?.(); } catch { /* ignore */ } };

/** Итог действия: заявка ушла, оплата прошла, ошибка */
export const notify = (type: Notify) => { try { api()?.notificationOccurred?.(type); } catch { /* ignore */ } };
