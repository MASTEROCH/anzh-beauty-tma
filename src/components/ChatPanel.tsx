import { useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from './Icon';
import { tap, select } from '../lib/haptics';
import { openExternal, openTelegram } from '../lib/telegram';
import { telegramUrl, instagramUrl, phoneUrl, whatsappUrl } from '../data/location';
import { useStudio } from '../lib/studioProfile';
import { respond, explainProcedure, clinicOpen, nextOpening, type AiAction } from '../lib/ai';
import { liveServices } from '../lib/catalog';
import { isBookable } from '../data/services';
import { useLang } from '../lib/i18n';
import { useClientChat } from '../lib/clientChat';
import { ChatThread, ChatComposer } from './ChatThread';
import type { ChatRequest } from '../lib/chatBus';
import { APP_NOT_A_DIAGNOSIS } from './LegalFooter';

// Чат студии: два разговора в одном окне.
//   · «Администратор» — живой человек: каналы связи студии (их задаёт
//     владелица в кабинете → «О студии»). Кнопки рисуются только для
//     заданных каналов: фальшивая кнопка хуже отсутствующей.
//   · «ANZH AI» — помощник: объясняет, что делает каждая процедура с
//     витрины, отвечает на частые вопросы (цены, адрес, отмена,
//     противопоказания) и, когда не уверен, передаёт администратору, а не
//     угадывает.
// Открывается левой кнопкой свёрнутой навигации; закрывается по фону, по ×
// и по Escape.

type Who = 'admin' | 'ai';
interface Msg { id: number; role: 'user' | 'ai'; text: string; actions?: AiAction[] }
let uid = 0;

const GREETING =
  'Привет 💛 Я ANZH — помощник студии. Расскажу, что делает каждая процедура, сколько она длится и стоит, и отвечу на частые вопросы. Если нужен человек — переключитесь на «Администратор».';

export function ChatPanel({
  open, request, onClose, onBook, onOpenService, onOpenCatalog, onOpenPlan, onOpenPassport,
}: {
  open: boolean;
  /** Открыли «с намерением» (каталог, карточка): нужная вкладка и готовый текст */
  request?: ChatRequest | null;
  onClose: () => void;
  onBook: (id?: string) => void;
  onOpenService: (id: string) => void;
  onOpenCatalog: () => void;
  onOpenPlan: () => void;
  onOpenPassport: () => void;
}) {
  const lang = useLang();
  const studio = useStudio();
  const [who, setWho] = useState<Who>('ai');
  const [msgs, setMsgs] = useState<Msg[]>([{ id: ++uid, role: 'ai', text: GREETING }]);
  const [value, setValue] = useState('');
  const [typing, setTyping] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const timer = useRef<number | null>(null);
  const lastQ = useRef('');
  const [leaving, setLeaving] = useState(false);
  const [mounted, setMounted] = useState(open);
  const [draft, setDraft] = useState('');
  const chat = useClientChat(open && who === 'admin');
  useEffect(() => {
    if (!request) return;
    setWho(request.tab);
    if (request.draft) setDraft(request.draft);
  }, [request]);

  // Закрытие с анимацией: выход ≈ 0.65 входа (закон пары), затем размонтирование
  useEffect(() => {
    if (open) { setMounted(true); setLeaving(false); return; }
    if (!mounted) return;
    setLeaving(true);
    const id = window.setTimeout(() => { setMounted(false); setLeaving(false); }, 210);
    return () => window.clearTimeout(id);
  }, [open, mounted]);

  useEffect(() => {
    if (!open) return;
    document.body.setAttribute('data-sheet-open', '');
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => { document.body.removeAttribute('data-sheet-open'); window.removeEventListener('keydown', onKey); };
  }, [open, onClose]);

  useEffect(() => () => { if (timer.current) window.clearTimeout(timer.current); }, []);

  useEffect(() => {
    const el = box.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [msgs, typing, who, mounted]);


  const procs = useMemo(
    () => (open ? liveServices().filter((s) => isBookable(s)).slice(0, 12) : []),
    [open],
  );

  if (!mounted) return null;

  const ask = (text: string, reply?: () => ReturnType<typeof respond>) => {
    const q = text.trim();
    if (!q || typing) return;
    lastQ.current = q;
    setMsgs((m) => [...m, { id: ++uid, role: 'user', text: q }]);
    setValue('');
    setTyping(true);
    timer.current = window.setTimeout(() => {
      const r = (reply ?? (() => respond(q)))();
      setMsgs((m) => [...m, { id: ++uid, role: 'ai', text: r.text, actions: r.actions }]);
      setTyping(false);
    }, 650 + Math.random() * 350);
  };

  const run = (a: AiAction) => {
    tap();
    switch (a.kind) {
      case 'handoff': setDraft(lastQ.current); setWho('admin'); return;
      case 'book': onClose(); onBook(a.serviceId); return;
      case 'service': onClose(); if (a.serviceId) onOpenService(a.serviceId); return;
      case 'catalog': onClose(); onOpenCatalog(); return;
      case 'plan': onClose(); onOpenPlan(); return;
      case 'passport': onClose(); onOpenPassport(); return;
    }
  };

  const openNow = clinicOpen();
  const q = lastQ.current;
  const phone = phoneUrl();
  const wa = whatsappUrl(q || undefined);
  const ig = studio.instagram ? instagramUrl() : null;

  return (
    <>
      <div className={`ai-chat-overlay cp-overlay${leaving ? ' cp-out' : ''}`} onClick={onClose} />
      <div className={`ai-chat-panel cp${leaving ? ' cp-out' : ''}`} role="dialog" aria-label="Чат со студией">
        <div className="cp-head">
          <div className="cp-title">Чат</div>
          <button className="ai-chat-close" onClick={onClose} aria-label="Закрыть">
            <Icon name="x" size={18} strokeWidth={2.4} />
          </button>
        </div>

        <div className="cp-seg seg" role="tablist" aria-label="С кем говорить">
          <button
            role="tab" aria-selected={who === 'admin'}
            className={`seg-btn${who === 'admin' ? ' active' : ''}`}
            onClick={() => { if (who !== 'admin') { select(); setWho('admin'); } }}
          >
            <Icon name="user" size={15} strokeWidth={2} /> Администратор
          </button>
          <button
            role="tab" aria-selected={who === 'ai'}
            className={`seg-btn${who === 'ai' ? ' active' : ''}`}
            onClick={() => { if (who !== 'ai') { select(); setWho('ai'); } }}
          >
            <Icon name="chat-ai" size={15} strokeWidth={2} /> ANZH AI
          </button>
        </div>

        {who === 'admin' ? (
          <div className="cp-admin" key="admin">
            <div className="cp-who">
              <span className="cp-ava" aria-hidden><Icon name="user" size={20} strokeWidth={1.7} /></span>
              <div className="cp-who-body">
                <div className="cp-who-name">Администратор студии</div>
                <div className={`cp-status ${openNow ? 'on' : 'off'}`}>
                  <span className="cp-dot" />
                  {openNow ? 'сейчас на связи' : nextOpening()} · {studio.hours[lang === 'en' ? 'en' : 'ru']}
                </div>
              </div>
            </div>

            {/* Другие каналы — компактным рядом: основной разговор теперь здесь */}
            <div className="cp-chips" aria-label="Другие способы связи">
              <button className="cp-chip" onClick={() => { tap(); openTelegram(telegramUrl(draft || undefined)); }}>
                <Icon name="send" size={15} strokeWidth={1.9} /> Telegram
              </button>
              {wa && (
                <button className="cp-chip cp-chip--wa" onClick={() => { tap(); openExternal(whatsappUrl(draft || undefined) ?? wa); }}>
                  <Icon name="message" size={15} strokeWidth={1.9} /> WhatsApp
                </button>
              )}
              {phone && (
                <button className="cp-chip" onClick={() => { tap(); openExternal(phone); }}>
                  <Icon name="phone" size={15} strokeWidth={1.9} /> Позвонить
                </button>
              )}
              {ig && (
                <button className="cp-chip" onClick={() => { tap(); openExternal(ig); }}>
                  <Icon name="camera" size={15} strokeWidth={1.9} /> Instagram
                </button>
              )}
            </div>

            {chat.enabled ? (
              <>
                {chat.offline && chat.loaded && <div className="cp-hint cp-hint--warn" role="status">Нет связи — сообщения дойдут, когда появится интернет</div>}
                {!chat.loaded
                  ? <div className="ct"><div className="cp-hint">Загружаем переписку…</div></div>
                  : (
                    <ChatThread
                      msgs={chat.msgs}
                      mine="client"
                      onRetry={chat.retry}
                      empty={(
                        <div className="cp-empty">
                          <Icon name="message" size={26} strokeWidth={1.6} />
                          <b>Напишите администратору</b>
                          <span>Запись, перенос, как добраться, вопросы по визиту. Можно приложить фото или видео. Ответ придёт сюда{openNow ? '' : `: ${nextOpening()}`}.</span>
                        </div>
                      )}
                    />
                  )}
                <ChatComposer
                  draft={draft}
                  setDraft={setDraft}
                  onSend={(text, media) => chat.send(text, media)}
                  placeholder="Сообщение…"
                  label="Сообщение администратору"
                />
              </>
            ) : (
              <div className="cp-guest">
                <Icon name="message" size={26} strokeWidth={1.6} />
                <b>Чат работает внутри Telegram</b>
                <span>Откройте приложение из Telegram — и переписка с администратором будет прямо здесь. Пока можно написать в любом из каналов выше.</span>
              </div>
            )}
          </div>
        ) : (
          <>
            <div className="ai-messages cp-msgs" ref={box} key="ai">
              {msgs.map((m) => (
                <div key={m.id} className={`ai-msg-wrap ${m.role === 'ai' ? 'assistant' : 'user'}`}>
                  <div className={`ai-message ${m.role === 'ai' ? 'assistant' : 'user'}`}>{m.text}</div>
                  {m.actions && m.actions.length > 0 && (
                    <div className="ai-msg-actions">
                      {m.actions.map((a) => (
                        <button key={a.label} className={`ai-msg-action${a.kind === 'handoff' ? ' handoff' : ''}`} onClick={() => run(a)}>
                          {a.kind === 'handoff' && <Icon name="user" size={13} strokeWidth={2} />}
                          {a.kind === 'book' && <Icon name="calendar" size={13} strokeWidth={2} />}
                          {a.kind === 'handoff' ? 'Написать администратору' : a.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
              {typing && (
                <div className="ai-typing" aria-label="печатает">
                  <div className="ai-typing-dot" /><div className="ai-typing-dot" /><div className="ai-typing-dot" />
                </div>
              )}
            </div>

            <div className="cp-ask">
              {procs.length > 0 && (
                <div className="cp-procs" aria-label="Что делает процедура">
                  {procs.map((s) => (
                    <button key={s.id} className="cp-pill" disabled={typing} onClick={() => { tap(); ask(`Что такое «${s.title}»?`, () => explainProcedure(s.id)); }}>
                      {s.title}
                    </button>
                  ))}
                </div>
              )}
              <div className="cp-procs cp-faq">
                {['Сколько стоит?', 'Где вы находитесь?', 'Можно отменить запись?', 'Есть ли противопоказания?'].map((f) => (
                  <button key={f} className="cp-pill cp-pill--q" disabled={typing} onClick={() => { tap(); ask(f); }}>{f}</button>
                ))}
              </div>
            </div>

            <p className="legal-note cp-note" data-disclaimer="ai">{APP_NOT_A_DIAGNOSIS[lang]}</p>
            <form className="ai-input-area" onSubmit={(e) => { e.preventDefault(); ask(value); }}>
              <input
                className="ai-input"
                type="text"
                enterKeyHint="send"
                placeholder="Спросите про процедуру…"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                disabled={typing}
                aria-label="Вопрос помощнику"
              />
              <button className="ai-send-btn" type="submit" disabled={!value.trim() || typing} aria-label="Отправить">
                <Icon name="arrow-up-right" size={18} strokeWidth={2.4} />
              </button>
            </form>
          </>
        )}
      </div>
    </>
  );
}
