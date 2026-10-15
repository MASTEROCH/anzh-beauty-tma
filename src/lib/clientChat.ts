import { useCallback, useEffect, useRef, useState } from 'react';
import {
  getMyChat, sendMyChat, uploadAttachment, type ChatMessageWire, type AttachmentWire,
} from './api/chat';
import { newIdempotencyKey, useSessionStatus } from './session';
import type { PreparedMedia } from './chatMedia';

// Переписка клиентки с администратором внутри приложения.
//
//   · «вживую»: длинный опрос (api/chat.ts) — ответ администратора приходит,
//     как только он нажал «Отправить», а не через N секунд;
//   · отправка оптимистична: сообщение (и снимок — по локальному адресу)
//     появляется сразу со статусом «отправляется»; не ушло — остаётся с
//     пометкой и «повторить», а не исчезает: потерянное молча сообщение хуже
//     сообщения с ошибкой. Повтор — с тем же Idempotency-Key, без дублей;
//   · вне Telegram (гость) чата нет — экран показывает каналы связи.

export interface ChatMsg {
  id: string;
  from: 'client' | 'studio';
  text: string;
  at: number;
  read?: boolean;
  attachment?: { kind: 'image' | 'video'; url: string; local?: boolean };
  state?: 'sending' | 'failed';
  /** Для повтора: ключи и то, что отправляем */
  retry?: { key: string; uploadKey: string; media?: PreparedMedia; uploaded?: AttachmentWire };
}

const WAIT = 25;

export const fromWire = (m: ChatMessageWire): ChatMsg => ({
  id: m.id,
  from: m.from,
  text: m.text,
  at: Date.parse(m.at) || Date.now(),
  read: m.read,
  attachment: m.attachment ? { kind: m.attachment.kind, url: m.attachment.url } : undefined,
});

export function useClientChat(active: boolean) {
  const status = useSessionStatus();
  const enabled = status === 'user';
  const [msgs, setMsgs] = useState<ChatMsg[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [offline, setOffline] = useState(false);
  const alive = useRef(true);
  const seq = useRef(-1);

  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);

  const merge = useCallback((server: ChatMsg[]) => {
    setMsgs((cur) => {
      const known = new Set(server.map((m) => m.id));
      const pending = cur.filter((m) => m.state && !known.has(m.id));
      return [...server, ...pending];
    });
  }, []);

  // Цикл длинного опроса, пока окно открыто
  useEffect(() => {
    if (!active || !enabled) return;
    const ctrl = new AbortController();
    let stop = false;
    (async () => {
      let backoff = 1000;
      while (!stop) {
        try {
          const first = seq.current < 0;
          const r = await getMyChat(seq.current, first ? 0 : WAIT, ctrl.signal);
          if (stop) return;
          seq.current = r.seq;
          merge(r.messages.map(fromWire));
          setOffline(false);
          setLoaded(true);
          backoff = 1000;
        } catch {
          if (stop || ctrl.signal.aborted) return;
          setOffline(true);
          setLoaded(true);
          await new Promise((ok) => setTimeout(ok, backoff));
          backoff = Math.min(backoff * 2, 15000);
        }
      }
    })();
    return () => { stop = true; ctrl.abort(); seq.current = -1; };
  }, [active, enabled, merge]);

  const deliver = useCallback(async (local: ChatMsg) => {
    const r = local.retry!;
    try {
      let uploaded = r.uploaded;
      if (r.media && !uploaded) {
        uploaded = await uploadAttachment(r.media.blob, r.uploadKey);
        r.uploaded = uploaded; // повтор не грузит файл второй раз
      }
      const saved = fromWire(await sendMyChat({ text: local.text || undefined, attachment_id: uploaded?.id }, r.key));
      if (!alive.current) return;
      setMsgs((cur) => {
        const rest = cur.filter((m) => m.id !== local.id && m.id !== saved.id);
        return [...rest, saved].sort((a, b) => a.at - b.at);
      });
      if (r.media) setTimeout(() => URL.revokeObjectURL(r.media!.preview), 60_000);
    } catch {
      if (alive.current) setMsgs((cur) => cur.map((m) => (m.id === local.id ? { ...m, state: 'failed' } : m)));
    }
  }, []);

  const send = useCallback((text: string, media?: PreparedMedia) => {
    const body = text.trim();
    if (!body && !media) return;
    const key = newIdempotencyKey();
    const local: ChatMsg = {
      id: `local-${key}`,
      from: 'client',
      text: body,
      at: Date.now(),
      state: 'sending',
      attachment: media ? { kind: media.kind, url: media.preview, local: true } : undefined,
      retry: { key, uploadKey: newIdempotencyKey(), media },
    };
    setMsgs((cur) => [...cur, local]);
    void deliver(local);
  }, [deliver]);

  const retry = useCallback((id: string) => {
    const m = msgs.find((x) => x.id === id);
    if (!m?.retry) return;
    const again = { ...m, state: 'sending' as const };
    setMsgs((cur) => cur.map((x) => (x.id === id ? again : x)));
    void deliver(again);
  }, [msgs, deliver]);

  return { enabled, msgs, loaded, offline, send, retry };
}
