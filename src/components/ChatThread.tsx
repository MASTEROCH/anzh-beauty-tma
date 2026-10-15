import { useEffect, useRef, useState } from 'react';
import { Icon } from './Icon';
import { openLightbox, toast } from '../lib/ui';
import { tap } from '../lib/haptics';
import { apiUrl } from '../lib/session';
import { prepareMedia, MediaError, MEDIA_ACCEPT, type PreparedMedia } from '../lib/chatMedia';
import type { ChatMsg } from '../lib/clientChat';

// Общие кирпичи переписки — у клиентки («Чат → Администратор») и у студии
// (кабинет → Клиенты → Переписка) они ОДНИ: одинаковые пузыри, даты,
// вложения и статусы, чтобы обе стороны видели один и тот же разговор.

const DAY = 86_400_000;
const dayKey = (at: number) => new Date(at).toDateString();

function dayLabel(at: number): string {
  const d = new Date(at);
  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  if (at >= start) return 'Сегодня';
  if (at >= start - DAY) return 'Вчера';
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', ...(d.getFullYear() !== today.getFullYear() ? { year: 'numeric' } : {}) });
}
const timeOf = (at: number) => new Date(at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
const srcOf = (a: NonNullable<ChatMsg['attachment']>) => (a.local ? a.url : apiUrl(a.url));

function Attachment({ a }: { a: NonNullable<ChatMsg['attachment']> }) {
  const [ready, setReady] = useState(false);
  if (a.kind === 'video') {
    return (
      <video className="ct-media ct-video" src={srcOf(a)} controls playsInline preload="metadata" />
    );
  }
  return (
    <button
      type="button"
      className={`ct-media ct-photo${ready ? ' ready' : ''}`}
      onClick={() => { tap(); openLightbox(srcOf(a), undefined, { alt: 'Фото из переписки' }); }}
      aria-label="Открыть фото"
    >
      <img src={srcOf(a)} alt="" loading="lazy" decoding="async" onLoad={() => setReady(true)} />
    </button>
  );
}

export function ChatThread({
  msgs, mine, onRetry, empty, boxRef,
}: {
  msgs: ChatMsg[];
  /** Чьи сообщения справа */
  mine: 'client' | 'studio';
  onRetry?: (id: string) => void;
  empty?: React.ReactNode;
  boxRef?: React.RefObject<HTMLDivElement | null>;
}) {
  const own = useRef<HTMLDivElement>(null);
  const ref = boxRef ?? own;
  const lastMine = [...msgs].reverse().find((m) => m.from === mine && !m.state);

  useEffect(() => {
    const el = ref.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [msgs.length, ref]);

  return (
    <div className="ct" ref={ref} role="log" aria-live="polite">
      {msgs.length === 0 && empty}
      {msgs.map((m, i) => {
        const side = m.from === mine ? 'me' : 'them';
        const newDay = i === 0 || dayKey(msgs[i - 1].at) !== dayKey(m.at);
        const grouped = !newDay && i > 0 && msgs[i - 1].from === m.from && m.at - msgs[i - 1].at < 5 * 60_000;
        return (
          <div key={m.id} className="ct-item">
            {newDay && <div className="ct-day"><span>{dayLabel(m.at)}</span></div>}
            <div className={`ct-row ${side}${grouped ? ' grouped' : ''}`}>
              <div className={`ct-bubble ${side}${m.attachment ? ' has-media' : ''}${m.state === 'sending' ? ' sending' : ''}${m.text ? '' : ' media-only'}`}>
                {m.attachment && <Attachment a={m.attachment} />}
                {m.text && <div className="ct-text">{m.text}</div>}
                <span className="ct-time">
                  {m.state === 'sending' ? <span className="ct-spin" aria-label="отправляется" /> : timeOf(m.at)}
                  {side === 'me' && !m.state && (
                    <Icon name={m.read ? 'check-double' : 'check'} size={13} strokeWidth={2.2} className={`ct-tick${m.read ? ' read' : ''}`} />
                  )}
                </span>
              </div>
              {m.state === 'failed' && (
                <button className="ct-failed" onClick={() => { tap(); onRetry?.(m.id); }}>
                  <Icon name="warning" size={12} strokeWidth={2.2} /> не отправлено · повторить
                </button>
              )}
              {m === lastMine && m.read && <div className="ct-seen">прочитано</div>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function ChatComposer({
  onSend, placeholder, draft, setDraft, label,
}: {
  onSend: (text: string, media?: PreparedMedia) => void;
  placeholder: string;
  draft: string;
  setDraft: (v: string) => void;
  label: string;
}) {
  const [media, setMedia] = useState<PreparedMedia | null>(null);
  const [preparing, setPreparing] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  // Отправили — поле возвращается к одной строке
  useEffect(() => { if (!draft && input.current) input.current.style.height = ''; }, [draft]);

  const pick = async (f: File | undefined) => {
    if (!f) return;
    setPreparing(true);
    try {
      const m = await prepareMedia(f);
      setMedia((old) => { if (old) URL.revokeObjectURL(old.preview); return m; });
    } catch (e) {
      toast(e instanceof MediaError ? e.message : 'Не удалось прикрепить файл');
    } finally {
      setPreparing(false);
      if (file.current) file.current.value = '';
    }
  };

  const submit = () => {
    if (preparing || (!draft.trim() && !media)) return;
    tap();
    onSend(draft, media ?? undefined);
    setDraft('');
    setMedia(null); // превью теперь живёт в сообщении; освободит его отправка
  };

  return (
    <div className="ct-compose">
      {(media || preparing) && (
        <div className="ct-attach">
          {preparing && <span className="ct-attach-wait"><span className="ct-spin" /> Готовим файл…</span>}
          {media && (
            <>
              {media.kind === 'image'
                ? <img className="ct-attach-thumb" src={media.preview} alt="" />
                : <video className="ct-attach-thumb" src={media.preview} muted playsInline preload="metadata" />}
              <span className="ct-attach-name">{media.kind === 'image' ? 'Фото' : 'Видео'} · {(media.blob.size / 1024 / 1024).toFixed(1)} МБ</span>
              <button className="ct-attach-off" type="button" onClick={() => { URL.revokeObjectURL(media.preview); setMedia(null); }} aria-label="Убрать вложение">
                <Icon name="x" size={14} strokeWidth={2.4} />
              </button>
            </>
          )}
        </div>
      )}
      <form className="ct-bar" onSubmit={(e) => { e.preventDefault(); submit(); }}>
        <button type="button" className="ct-clip" onClick={() => { tap(); file.current?.click(); }} aria-label="Прикрепить фото или видео" disabled={preparing}>
          <Icon name="paperclip" size={21} strokeWidth={1.9} />
        </button>
        <input ref={file} type="file" accept={MEDIA_ACCEPT} hidden onChange={(e) => { void pick(e.target.files?.[0]); }} />
        <textarea
          ref={input}
          className="ct-input"
          rows={1}
          enterKeyHint="send"
          placeholder={placeholder}
          value={draft}
          maxLength={2000}
          aria-label={label}
          onChange={(e) => {
            setDraft(e.target.value);
            const el = e.target; el.style.height = 'auto'; el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
          }}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); } }}
        />
        <button className="ct-send" type="submit" disabled={preparing || (!draft.trim() && !media)} aria-label="Отправить">
          <Icon name="arrow-up-right" size={18} strokeWidth={2.4} />
        </button>
      </form>
    </div>
  );
}
