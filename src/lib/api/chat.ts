// Провод «встроенный чат»: клиентка ↔ администратор студии.
//
// 🔴 [ПРЕДЛОЖЕНИЕ БЭКЕНДУ] Этих ручек в серверном контракте ещё нет; описаны
// здесь так, как их ждут экраны, и реализованы в tools/dev-stand.mjs.
//
//   GET  /chat?since&wait            своя переписка (клиентка, по сессии)
//   POST /chat {text?, attachment_id?}
//   GET  /chat/threads?since&wait    все переписки (студия, за PIN)
//   POST /chat/threads/:id/reply {text?, attachment_id?}
//   POST /chat/threads/:id/read      студия прочитала
//   POST /chat/attachments           сырой файл телом, Content-Type = тип файла
//   GET  /chat/files/:id?exp&sig     отдача вложения по подписанной ссылке
//
// «Вживую» = длинный опрос: запрос с `since` (seq последнего увиденного
// события) и `wait` (сек) висит на сервере, пока не появится новое. Обычный
// fetch с заголовком авторизации — без WebSocket и без токена в адресе.
// Повтор отправки на плохой сети не задваивает сообщение: Idempotency-Key.

import { apiRequest } from '../session';

export type AttachmentKind = 'image' | 'video';

export interface AttachmentWire {
  id: string;
  kind: AttachmentKind;
  mime: string;
  size: number;
  /** Подписанный относительный адрес; живёт ограниченное время — брать из свежего ответа. */
  url: string;
}

export interface ChatMessageWire {
  id: string;
  seq: number;
  from: 'client' | 'studio';
  text: string;
  /** ISO */
  at: string;
  /** Для своих сообщений: собеседник прочитал. */
  read?: boolean;
  attachment?: AttachmentWire;
}

export interface ChatThreadWire {
  client_id: number;
  name: string;
  unread?: number;
  messages: ChatMessageWire[];
}

/** Длинный опрос держит соединение до `wait` секунд: срок ожидания запроса — с запасом. */
const LONG = (wait: number) => (wait + 10) * 1000;

export async function getMyChat(since = -1, wait = 0, signal?: AbortSignal): Promise<{ messages: ChatMessageWire[]; seq: number }> {
  const r = await apiRequest<{ messages: ChatMessageWire[]; seq: number }>('GET', '/chat', {
    query: since >= 0 && wait > 0 ? { since, wait } : undefined, signal, timeoutMs: LONG(wait),
  });
  return { messages: Array.isArray(r?.messages) ? r.messages : [], seq: Number(r?.seq) || 0 };
}

export interface OutgoingMessage { text?: string; attachment_id?: string }

export async function sendMyChat(msg: OutgoingMessage, idempotencyKey: string): Promise<ChatMessageWire> {
  const r = await apiRequest<{ message: ChatMessageWire }>('POST', '/chat', { body: msg, idempotencyKey });
  return r.message;
}

export async function getChatThreads(since = -1, wait = 0, signal?: AbortSignal): Promise<{ threads: ChatThreadWire[]; seq: number }> {
  const r = await apiRequest<{ threads: ChatThreadWire[]; seq: number }>('GET', '/chat/threads', {
    query: since >= 0 && wait > 0 ? { since, wait } : undefined, signal, timeoutMs: LONG(wait),
  });
  return { threads: Array.isArray(r?.threads) ? r.threads : [], seq: Number(r?.seq) || 0 };
}

export async function replyChatThread(clientId: number, msg: OutgoingMessage, idempotencyKey: string): Promise<ChatMessageWire> {
  const r = await apiRequest<{ message: ChatMessageWire }>('POST', `/chat/threads/${clientId}/reply`, { body: msg, idempotencyKey });
  return r.message;
}

export function markThreadRead(clientId: number): Promise<unknown> {
  return apiRequest('POST', `/chat/threads/${clientId}/read`);
}

/** Загрузить вложение. Фото сжимаются на устройстве заранее (chatMedia.ts), видео уходит как есть. */
export async function uploadAttachment(file: Blob, idempotencyKey: string): Promise<AttachmentWire> {
  const r = await apiRequest<{ attachment: AttachmentWire }>('POST', '/chat/attachments', {
    raw: file, idempotencyKey, timeoutMs: 120_000,
  });
  return r.attachment;
}
