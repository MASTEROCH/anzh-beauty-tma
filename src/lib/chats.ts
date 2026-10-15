import { useEffect, useState } from 'react';

/*
   ПЕРЕПИСКА С КЛИЕНТКОЙ.

   До этого вся связь жила в директе инстаграма: «когда удобно», «можно
   перенести», «что нельзя после процедуры» — всё там, вперемешку с
   рекламой и чужими сообщениями. Найти, что обещали конкретному
   человеку полгода назад, невозможно.

   Здесь переписка привязана к клиентке и стоит рядом с её историей
   процедур. Мастер видит, о чём договаривались, не выходя из кабинета.

   🚨 ЧЕСТНО О ГРАНИЦАХ. Отправить сообщение В TELEGRAM отсюда
   прототип не может: для этого нужен бот на сервере и право писать
   человеку (он должен сам запустить бота). Поэтому написанное здесь
   встаёт в очередь со статусом «ждёт отправки», а рядом есть кнопка,
   открывающая настоящий диалог в Telegram или инстаграме.

   Когда появится сервер — очередь уедет в таблицу `anzh.notifications`,
   она уже описана в миграции 007, и статус станет настоящим. Рисовать
   «отправлено», ничего не отправив, нельзя: мастер решит, что клиентка
   предупреждена, а она не придёт.
*/

export type Author = 'studio' | 'client';
export type Delivery = 'queued' | 'sent' | 'read';

export interface Message {
  id: string;
  author: Author;
  text: string;
  at: number;
  /** Только для сообщений студии */
  delivery?: Delivery;
}

export interface Thread {
  clientKey: string;
  clientName: string;
  clientInstagram?: string;
  clientTgUsername?: string;
  messages: Message[];
}

const KEY = 'anzh_chats_v1';
const listeners = new Set<(items: Thread[]) => void>();

function seed(): Thread[] {
  const h = 3600_000;
  const now = Date.now();
  return [
    {
      clientKey: 'kate_bt',
      clientName: 'Катя',
      clientInstagram: 'kate_bt',
      messages: [
        { id: 'm1', author: 'client', text: 'Здравствуйте! Записалась на чистку на сегодня, можно чуть пораньше, если окно освободится?', at: now - h * 5 },
        { id: 'm2', author: 'studio', text: 'Добрый день! Посмотрю ближе к обеду и напишу — если 14:00 освободится, предложу.', at: now - h * 4, delivery: 'read' },
        { id: 'm3', author: 'client', text: 'Спасибо, буду ждать', at: now - h * 4 },
      ],
    },
    {
      clientKey: 'lena.gr',
      clientName: 'Лена',
      clientInstagram: 'lena.gr',
      messages: [
        { id: 'm4', author: 'studio', text: 'Лена, добрый день. Вы не пришли на RF-лифтинг 18:00 — всё в порядке? Могу перенести на эту неделю.', at: now - h * 30, delivery: 'sent' },
      ],
    },
    {
      clientKey: 'mashab',
      clientName: 'Маша',
      clientInstagram: 'mashab',
      messages: [
        { id: 'm5', author: 'client', text: 'После биоревитализации можно в бассейн через сколько?', at: now - h * 72 },
        { id: 'm6', author: 'studio', text: 'Через 3 дня. И без сауны неделю — иначе отёк держится дольше.', at: now - h * 71, delivery: 'read' },
        { id: 'm7', author: 'client', text: 'Поняла, спасибо!', at: now - h * 70 },
      ],
    },
  ];
}

function load(): Thread[] {
  if (typeof window === 'undefined') return seed();
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) { const s = seed(); localStorage.setItem(KEY, JSON.stringify(s)); return s; }
    return JSON.parse(raw) as Thread[];
  } catch { return seed(); }
}

let items: Thread[] = load();

function persist() {
  try { localStorage.setItem(KEY, JSON.stringify(items)); } catch { /* ignore */ }
  listeners.forEach((l) => l(items));
}

export function useThreads(): Thread[] {
  const [s, setS] = useState(items);
  useEffect(() => {
    listeners.add(setS);
    return () => { listeners.delete(setS); };
  }, []);
  return s;
}

export const findThread = (key: string) => items.find((t) => t.clientKey === key);

/** Последнее сообщение — для строки в списке */
export const lastMessage = (t: Thread): Message | undefined => t.messages[t.messages.length - 1];

/** Ждёт ответа: последнее сообщение от клиентки */
export const needsReply = (t: Thread) => lastMessage(t)?.author === 'client';

/**
 * Написать клиентке.
 *
 * Статус `queued`, а не `sent`: отправлять некуда, пока нет сервера с
 * ботом. Интерфейс показывает это прямо — «ждёт отправки», — потому что
 * ложное «доставлено» опаснее отсутствия функции: мастер решит, что
 * человек предупреждён.
 */
export function sendToClient(
  clientKey: string,
  text: string,
  who: { name: string; instagram?: string; tg?: string },
): void {
  const body = text.trim();
  if (!body) return;
  const msg: Message = {
    id: `m${Date.now()}`,
    author: 'studio',
    text: body,
    at: Date.now(),
    delivery: 'queued',
  };
  const existing = items.find((t) => t.clientKey === clientKey);
  if (existing) {
    items = items.map((t) =>
      t.clientKey === clientKey ? { ...t, messages: [...t.messages, msg] } : t);
  } else {
    items = [
      { clientKey, clientName: who.name, clientInstagram: who.instagram, clientTgUsername: who.tg, messages: [msg] },
      ...items,
    ];
  }
  persist();
}

/** Сколько диалогов ждут ответа — для счётчика на вкладке */
export const unansweredCount = (list: Thread[]) => list.filter(needsReply).length;
