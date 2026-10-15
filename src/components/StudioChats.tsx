import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from './Icon';
import { tap } from '../lib/haptics';
import { replyChatThread, uploadAttachment, markThreadRead, type ChatThreadWire } from '../lib/api/chat';
import { newIdempotencyKey } from '../lib/session';
import { cabinetDenied } from '../lib/staff';
import { useStaffInbox, setActiveThread, refreshInbox } from '../lib/staffInbox';
import { fromWire, type ChatMsg } from '../lib/clientChat';
import { ChatThread, ChatComposer } from './ChatThread';
import type { PreparedMedia } from '../lib/chatMedia';

/*
   ПЕРЕПИСКА С КЛИЕНТКАМИ — живая.

   Обратная сторона встроенного чата клиентки («Чат» → «Администратор»).
   Сообщения приходят сразу (длинный опрос, lib/staffInbox.ts), история
   хранится на сервере с датой и временем каждого сообщения, вложения —
   фото и видео в обе стороны.

   Список: сначала те, кто ждёт ответа, потом по свежести. Переписка
   открывается на весь экран: отвечать в шторке на пол-экрана неудобно, а
   фото кожи надо видеть крупно.

   Раньше здесь жили три выдуманные переписки «Катя / Лена / Маша» и очередь
   «ждёт отправки» — макет, притворявшийся функцией.
*/

const lastOf = (t: ChatThreadWire) => t.messages[t.messages.length - 1];
const needsReply = (t: ChatThreadWire) => lastOf(t)?.from === 'client';

function whenOf(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) return d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  const y = new Date(now); y.setDate(now.getDate() - 1);
  if (d.toDateString() === y.toDateString()) return 'вчера';
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
}

const preview = (t: ChatThreadWire) => {
  const m = lastOf(t);
  if (!m) return '—';
  const body = m.text || (m.attachment?.kind === 'video' ? '🎬 Видео' : '📷 Фото');
  return m.from === 'studio' ? `Вы: ${body}` : body;
};

export function StudioChats() {
  const inbox = useStaffInbox(true);
  const [openId, setOpenId] = useState<number | null>(null);
  const sorted = useMemo(() => [...inbox.threads].sort((a, b) => {
    const wa = needsReply(a) ? 1 : 0;
    const wb = needsReply(b) ? 1 : 0;
    if (wa !== wb) return wb - wa;
    return Date.parse(lastOf(b)?.at ?? '') - Date.parse(lastOf(a)?.at ?? '');
  }), [inbox.threads]);
  const waiting = sorted.filter(needsReply).length;
  const current = inbox.threads.find((t) => t.client_id === openId) ?? null;

  return (
    <div>
      <div className="eyebrow mb-sm">
        переписка · {inbox.threads.length}
        {waiting > 0 && <b> · {waiting} ждут ответа</b>}
      </div>

      {!inbox.loaded && <div className="card empty-card"><div className="muted">Загружаем переписку…</div></div>}
      {inbox.loaded && inbox.failed && inbox.threads.length === 0 && (
        <div className="card empty-state" role="alert">
          <div className="empty-title">Переписка не загрузилась</div>
          <div className="empty-sub">Проверьте интернет — повторим сами, как только появится связь.</div>
        </div>
      )}
      {inbox.loaded && !inbox.failed && inbox.threads.length === 0 && (
        <div className="card empty-card">
          <Icon name="message" size={26} strokeWidth={1.8} />
          <div className="muted mt-sm">Клиентки пока не писали</div>
          <div className="faint mt-sm" style={{ fontSize: 13 }}>Сообщения из «Чат → Администратор» появятся здесь сразу.</div>
        </div>
      )}

      <div className="sc-list">
        {sorted.map((t) => {
          const last = lastOf(t);
          const unread = t.unread ?? 0;
          return (
            <button key={t.client_id} className={`sc-row${unread ? ' unread' : ''}`} onClick={() => { tap(); setOpenId(t.client_id); }}>
              <span className="sc-ava" aria-hidden>{t.name.slice(0, 1).toUpperCase()}</span>
              <span className="sc-body">
                <span className="sc-top">
                  <span className="sc-name">{t.name}</span>
                  {last && <span className="sc-when">{whenOf(last.at)}</span>}
                </span>
                <span className="sc-bottom">
                  <span className="sc-last">{preview(t)}</span>
                  {unread > 0 && <span className="sc-badge">{unread}</span>}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      {current && <StaffThread thread={current} onClose={() => setOpenId(null)} />}
    </div>
  );
}

function StaffThread({ thread, onClose }: { thread: ChatThreadWire; onClose: () => void }) {
  const [pending, setPending] = useState<ChatMsg[]>([]);
  const [draft, setDraft] = useState('');
  const id = thread.client_id;
  const unread = thread.unread ?? 0;

  useEffect(() => {
    setActiveThread(id);
    document.body.setAttribute('data-sheet-open', '');
    // Escape закрывает переписку, а не весь кабинет: ловим первыми и дальше не пускаем
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopImmediatePropagation(); onClose(); } };
    window.addEventListener('keydown', onKey, true);
    return () => { setActiveThread(null); document.body.removeAttribute('data-sheet-open'); window.removeEventListener('keydown', onKey, true); };
  }, [id, onClose]);

  // Открыла — значит прочитала: клиентка увидит «прочитано»
  useEffect(() => {
    if (unread > 0) markThreadRead(id).then(refreshInbox).catch(cabinetDenied);
  }, [id, unread]);

  const deliver = useCallback(async (local: ChatMsg) => {
    const r = local.retry!;
    try {
      let uploaded = r.uploaded;
      if (r.media && !uploaded) { uploaded = await uploadAttachment(r.media.blob, r.uploadKey); r.uploaded = uploaded; }
      await replyChatThread(id, { text: local.text || undefined, attachment_id: uploaded?.id }, r.key);
      setPending((p) => p.filter((m) => m.id !== local.id));
      refreshInbox();
    } catch (e) {
      cabinetDenied(e);
      setPending((p) => p.map((m) => (m.id === local.id ? { ...m, state: 'failed' } : m)));
    }
  }, [id]);

  const send = (text: string, media?: PreparedMedia) => {
    const key = newIdempotencyKey();
    const local: ChatMsg = {
      id: `local-${key}`, from: 'studio', text: text.trim(), at: Date.now(), state: 'sending',
      attachment: media ? { kind: media.kind, url: media.preview, local: true } : undefined,
      retry: { key, uploadKey: newIdempotencyKey(), media },
    };
    setPending((p) => [...p, local]);
    void deliver(local);
  };

  const retry = (mid: string) => {
    const m = pending.find((x) => x.id === mid);
    if (!m) return;
    const again = { ...m, state: 'sending' as const };
    setPending((p) => p.map((x) => (x.id === mid ? again : x)));
    void deliver(again);
  };

  const msgs = useMemo(() => [...thread.messages.map(fromWire), ...pending], [thread.messages, pending]);
  const since = thread.messages[0] ? new Date(thread.messages[0].at).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' }) : null;

  // Порталом в body: внутри кабинета панель оказывалась под его навигацией
  // и кнопкой «выйти» (свой контекст наложения у экрана), и поле ответа
  // пряталось за нижней панелью.
  return createPortal(
    <>
      <div className="ai-chat-overlay" onClick={onClose} />
      <div className="ai-chat-panel cp sc-panel" role="dialog" aria-label={`Переписка: ${thread.name}`}>
        <div className="sc-head">
          <button className="sc-back" onClick={onClose} aria-label="Назад к списку">
            <Icon name="chevron-left" size={22} strokeWidth={2.2} />
          </button>
          <span className="sc-ava sm" aria-hidden>{thread.name.slice(0, 1).toUpperCase()}</span>
          <span className="sc-head-t">
            <b>{thread.name}</b>
            {since && <i>переписка с {since}</i>}
          </span>
        </div>
        <ChatThread msgs={msgs} mine="studio" onRetry={retry} />
        <ChatComposer draft={draft} setDraft={setDraft} onSend={send} placeholder={`Ответить: ${thread.name}`} label="Ответ клиентке" />
      </div>
    </>,
    document.body,
  );
}
