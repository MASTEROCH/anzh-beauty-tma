import { useState } from 'react';
import { Icon } from './Icon';
import { openSheet, closeSheet, toast } from '../lib/ui';
import { notify } from '../lib/haptics';
import {
  useThreads, sendToClient, lastMessage, needsReply, type Thread,
} from '../lib/chats';
import { openExternal, openTelegram } from '../lib/telegram';
import { instagramUrl } from '../data/location';

/*
   ПЕРЕПИСКА С КЛИЕНТКАМИ.

   Сортировка: сначала те, кто ждёт ответа. Список переписок, где
   непрочитанное лежит вперемешку с законченным, требует читать его
   целиком — а именно этого у мастера между приёмами нет.

   🚨 ЧЕСТНО О ГРАНИЦАХ ПРОТОТИПА. Отправить сообщение в Telegram
   отсюда нельзя: нужен бот на сервере и право писать человеку.
   Написанное встаёт в очередь и помечено «ждёт отправки» — прямо, а не
   галочкой «доставлено». Ложное «доставлено» опаснее отсутствия
   функции: мастер решит, что клиентка предупреждена, и не позвонит.

   Рядом — кнопка, открывающая настоящий диалог там, где он и идёт
   сегодня: в инстаграме или в Telegram.
*/

export function StudioChats() {
  const threads = useThreads();
  const sorted = [...threads].sort((a, b) => {
    const wa = needsReply(a) ? 1 : 0;
    const wb = needsReply(b) ? 1 : 0;
    if (wa !== wb) return wb - wa;
    return (lastMessage(b)?.at ?? 0) - (lastMessage(a)?.at ?? 0);
  });
  const waiting = sorted.filter(needsReply).length;

  return (
    <div>
      <div className="eyebrow mb-sm">
        переписка · {threads.length}
        {waiting > 0 && <b> · {waiting} ждут ответа</b>}
      </div>

      {threads.length === 0 && (
        <div className="card empty-card">
          <Icon name="message" size={26} strokeWidth={1.8} />
          <div className="muted mt-sm">Переписки пока нет</div>
        </div>
      )}

      <div className="stack-tight">
        {sorted.map((t) => {
          const last = lastMessage(t);
          return (
            <button key={t.clientKey} className="chat-row" onClick={() => openThread(t)}>
              <span className="chat-b">
                <span className="chat-n">
                  {t.clientName}
                  {needsReply(t) && <span className="chip chip-amber">ждёт ответа</span>}
                </span>
                <span className="chat-last">
                  {last?.author === 'studio' && <span className="chat-me">вы: </span>}
                  {last?.text ?? '—'}
                </span>
              </span>
              <Icon name="chevron-right" size={18} strokeWidth={2} />
            </button>
          );
        })}
      </div>
    </div>
  );
}

function openThread(t: Thread) {
  openSheet({
    title: t.clientName,
    subtitle: t.clientInstagram ? `@${t.clientInstagram}` : undefined,
    body: <ThreadView thread={t} />,
  });
}

const timeOf = (at: number) =>
  new Date(at).toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

function ThreadView({ thread }: { thread: Thread }) {
  const threads = useThreads();
  const live = threads.find((t) => t.clientKey === thread.clientKey) ?? thread;
  const [text, setText] = useState('');

  const send = () => {
    sendToClient(live.clientKey, text, {
      name: live.clientName,
      instagram: live.clientInstagram,
      tg: live.clientTgUsername,
    });
    setText('');
    notify('success');
    toast('В очереди на отправку');
  };

  return (
    <>
      <div className="chat-thread">
        {live.messages.map((m) => (
          <div key={m.id} className={`chat-msg ${m.author === 'studio' ? 'mine' : 'theirs'}`}>
            <div className="chat-msg-text">{m.text}</div>
            <div className="chat-msg-meta">
              {timeOf(m.at)}
              {m.delivery === 'queued' && <span className="chat-queued"> · ждёт отправки</span>}
              {m.delivery === 'sent' && ' · отправлено'}
              {m.delivery === 'read' && ' · прочитано'}
            </div>
          </div>
        ))}
      </div>

      <div className="chat-compose">
        <textarea
          className="input"
          rows={2}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Написать клиентке…"
        />
        <button className="btn btn-primary btn-block mt-sm" disabled={!text.trim()} onClick={send}>
          В очередь на отправку
        </button>
      </div>

      {/* Пока бота нет, настоящий разговор идёт там же, где и раньше */}
      <p className="faint mt-sm" style={{ fontSize: 12, lineHeight: 1.5 }}>
        Сообщение уйдёт из приложения, когда подключим бота. Сейчас диалог
        живёт в инстаграме — откройте его здесь:
      </p>
      <div className="row mt-sm" style={{ gap: 'var(--sp-sm)' }}>
        {live.clientInstagram && (
          <button
            className="btn btn-secondary row-fill"
            onClick={() => openExternal(instagramUrl(live.clientInstagram))}
          >
            Инстаграм
          </button>
        )}
        {live.clientTgUsername && (
          <button
            className="btn btn-secondary row-fill"
            onClick={() => openTelegram(`https://t.me/${live.clientTgUsername}`)}
          >
            Telegram
          </button>
        )}
      </div>

      <button className="btn btn-quiet btn-block mt-md" onClick={closeSheet}>
        Закрыть
      </button>
    </>
  );
}
