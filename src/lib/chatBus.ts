// Открыть чат из любого места приложения: каталог («Цена у администратора»),
// карточка услуги, помощник. Одна точка входа, App держит само окно.

export interface ChatRequest {
  tab: 'admin' | 'ai';
  /** Готовый текст в поле ввода (человек может поправить и отправить) */
  draft?: string;
  /** Номер запроса — чтобы повторный одинаковый запрос тоже сработал */
  n: number;
}

let n = 0;
const listeners = new Set<(r: ChatRequest) => void>();

export function openChat(tab: ChatRequest['tab'], draft?: string): void {
  const r = { tab, draft, n: ++n };
  listeners.forEach((l) => l(r));
}

export function onOpenChat(fn: (r: ChatRequest) => void): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}
