import { useEffect, useRef, useState } from 'react';
import { Mascot, type MascotEmotion } from './Mascot';
import { onMascotMood } from '../lib/mascot-events';
import { onAskMascot } from '../lib/chat-events';
import { Icon } from './Icon';
import { toast } from '../lib/ui';
import type { Screen } from '../App';

const SCREEN_MOODS: Partial<Record<Screen, MascotEmotion>> = {
  profile: 'adoration',
  catalog: 'wonder',
  service: 'fun',
  booking: 'think',
  confirm: 'adoration',
  account: 'idle',
  anzh: 'fun',
};

const SCREEN_HINTS: Partial<Record<Screen, string>> = {
  profile: 'Привет 💛 я ассистент Анжелики',
  catalog: 'Подсказать процедуру?',
  service: 'Можно записаться прямо сейчас',
  booking: 'Помогу выбрать слот',
  account: 'Хочешь записаться повторно?',
  anzh: 'Подобрать домашний уход?',
};

interface Message { id: number; role: 'user' | 'assistant'; text: string }

function mockResponse(message: string): string {
  const lower = message.toLowerCase();
  if (/(губ|конт|пласт|филлер)/i.test(lower)) {
    return '💋 Для первого раза обычно 0.5–0.7 мл Restylane Kysse — естественный объём, без «утиного» эффекта. Записать на консультацию + разметку?';
  }
  if (/(чистк|почист)/i.test(lower)) {
    return '🌿 Глубокая чистка — 90 мин, без боли. Ближайший слот пятница 24 мая в 16:30. Подходит?';
  }
  if (/(биорев|увлажн|сухость)/i.test(lower)) {
    return '✨ Биоревитализация курсом 3 процедуры с интервалом 2 недели. Препарат IAL-System. Спросить ближайшие даты?';
  }
  if (/(пилинг|кисло)/i.test(lower)) {
    return '🍃 PRX-T33 — биоревитализирующий пилинг без слущивания. Идеален в любой сезон. 45 минут, $75.';
  }
  if (/(лифтинг|подтяжк|rf|апп)/i.test(lower)) {
    return '⚡ RF-лифтинг INDIBA — мгновенный визуальный эффект, накопительный — через 3-4 процедуры. Без реабилитации.';
  }
  if (/(аллерг|лидокаин|реакц)/i.test(lower)) {
    return '⚠ Анжелика всегда сверяется с твоим паспортом здоровья перед процедурой. Лидокаин-фри протокол доступен по запросу — без проблем.';
  }
  if (/(беремен|лактац|кормл)/i.test(lower)) {
    return '🤰 При беременности и лактации большинство инъекций нельзя. Подберём безопасные уходовые процедуры — спроси список?';
  }
  if (/(аденд|цен|стоим|сколько)/i.test(lower)) {
    return '💸 Цены — от $40 (LED-терапия) до $180 (PDRN). Каталог открой во вкладке «Каталог», там USD↔GEL переключаются.';
  }
  if (/(адрес|где|как до|кабин|чавчав)/i.test(lower)) {
    return '📍 Батуми, ул. Parnavaz Mepe 92/94, 3 этаж. 10 минут от Boulevard, парковка у входа. Открою карту?';
  }
  if (/(пуш|напомин|жди|ждать)/i.test(lower)) {
    return '🔔 Я пришлю пуш-напоминание за 24 часа и за 2 часа до процедуры. После — серия post-care сообщений: 24ч, 3д, 7д.';
  }
  if (/(депоз|отмен|перенес|перенос)/i.test(lower)) {
    return '📅 Депозит 10%, возврат полный — если отменяешь больше чем за 24 часа. Перенос бесплатный и в любой момент.';
  }
  if (/(балл|лояль|skid|скидк)/i.test(lower)) {
    return '⭐ 5% от каждого чека возвращаются баллами. Тиры: Bronze → Silver → Gold → Diamond. Реферал друга — +1000 баллов обоим.';
  }
  if (/(спас|благод|круто|супер)/i.test(lower)) {
    return 'Рада помочь! 💛 Если что-то ещё — спрашивай. Анжелика тоже всегда рядом.';
  }
  return 'Спасибо за вопрос! Я подскажу про процедуры, цены, противопоказания, запись, баллы и адрес. Что интересует?';
}

let _msgCounter = 0;
const nextId = () => ++_msgCounter;

interface Props {
  screen?: Screen;
  onBookingNav?: () => void;
}

export function AiChatBubble({ screen, onBookingNav }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [hintVisible, setHintVisible] = useState(false);
  const [inputFocused, setInputFocused] = useState(false);
  const [transientMood, setTransientMood] = useState<MascotEmotion | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const transientTimer = useRef<number | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<{ stop: () => void; abort?: () => void } | null>(null);

  function handleVoiceClick() {
    if (isRecording) {
      try { recognitionRef.current?.stop(); } catch {}
      recognitionRef.current = null;
      setIsRecording(false);
      return;
    }
    const SR =
      typeof window !== 'undefined'
        ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition)
        : null;
    if (!SR) {
      const insecure =
        typeof window !== 'undefined' &&
        window.location.protocol !== 'https:' &&
        window.location.hostname !== 'localhost' &&
        window.location.hostname !== '127.0.0.1';
      toast(
        insecure
          ? 'Голосовой ввод требует HTTPS или localhost'
          : 'Голосовой ввод недоступен в этом браузере',
      );
      return;
    }
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const recognition: any = new SR();
      recognition.lang = 'ru-RU';
      recognition.continuous = true;
      recognition.interimResults = true;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      recognition.onresult = (e: any) => {
        let finalText = '';
        let interim = '';
        for (let i = 0; i < e.results.length; i++) {
          const transcript = e.results[i][0].transcript;
          if (e.results[i].isFinal) finalText += transcript;
          else interim += transcript;
        }
        setInputValue((finalText + ' ' + interim).replace(/\s+/g, ' ').trim());
      };
      recognition.onerror = () => { setIsRecording(false); recognitionRef.current = null; };
      recognition.onend = () => { setIsRecording(false); recognitionRef.current = null; };
      recognitionRef.current = recognition;
      setIsRecording(true);
      recognition.start();
    } catch {
      setIsRecording(false);
      toast('Не удалось запустить запись');
    }
  }

  function playTransient(mood: MascotEmotion, duration = 2500) {
    if (transientTimer.current) window.clearTimeout(transientTimer.current);
    setTransientMood(mood);
    transientTimer.current = window.setTimeout(() => setTransientMood(null), duration);
  }

  useEffect(() => {
    if (!screen) return;
    const mood = SCREEN_MOODS[screen];
    if (!mood || mood === 'idle') return;
    playTransient(mood, 3500);
    return () => { if (transientTimer.current) window.clearTimeout(transientTimer.current); };
  }, [screen]);

  useEffect(() => onMascotMood((mood, duration) => playTransient(mood, duration)), []);

  useEffect(() =>
    onAskMascot((question) => {
      setIsOpen(true);
      setMessages((prev) => {
        const base = prev.length === 0
          ? [{ id: nextId(), role: 'assistant' as const, text: 'Привет 💛 Я ассистент Анжелики — помогу записаться или подобрать процедуру.' }]
          : prev;
        return [...base, { id: nextId(), role: 'user', text: question }];
      });
      setIsTyping(true);
      playTransient('think', 1500);
      setTimeout(() => {
        setMessages((prev) => [...prev, { id: nextId(), role: 'assistant', text: mockResponse(question) }]);
        setIsTyping(false);
        playTransient('fun', 2200);
      }, 800 + Math.random() * 400);
    }),
  []);

  const currentMood: MascotEmotion = transientMood
    ? transientMood
    : isOpen
      ? (isTyping ? 'think' : inputFocused && inputValue.length > 0 ? 'listen' : 'idle')
      : 'idle';

  useEffect(() => {
    if (!screen || isOpen) { setHintVisible(false); return; }
    const showDelay = setTimeout(() => setHintVisible(true), 700);
    const hideDelay = setTimeout(() => setHintVisible(false), 6500);
    return () => { clearTimeout(showDelay); clearTimeout(hideDelay); };
  }, [screen, isOpen]);

  const currentHint = screen ? SCREEN_HINTS[screen] : null;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  useEffect(() => {
    if (isOpen) {
      setMessages((prev) =>
        prev.length === 0
          ? [{ id: nextId(), role: 'assistant', text: 'Привет 💛 Я ассистент Анжелики — помогу записаться, проверю противопоказания и подскажу процедуру.' }]
          : prev,
      );
      setInputValue('');
      document.body.setAttribute('data-sheet-open', '');
      setTimeout(() => inputRef.current?.focus(), 350);
      return () => document.body.removeAttribute('data-sheet-open');
    }
  }, [isOpen]);

  function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || isTyping) return;
    setMessages((prev) => [...prev, { id: nextId(), role: 'user', text: trimmed }]);
    setInputValue('');
    setIsTyping(true);
    playTransient('think', 1500);
    setTimeout(() => {
      setMessages((prev) => [...prev, { id: nextId(), role: 'assistant', text: mockResponse(trimmed) }]);
      setIsTyping(false);
      const lower = trimmed.toLowerCase();
      const m: MascotEmotion =
        /(спас|благод)/i.test(lower) ? 'adoration' :
        /(совет|рекоменд)/i.test(lower) ? 'fun' :
        /(\?|как|что|где|сколько)/i.test(lower) ? 'wonder' :
        'fun';
      playTransient(m, 2400);
    }, 800 + Math.random() * 400);
  }

  return (
    <>
      {hintVisible && currentHint && !isOpen && (
        <div className="ai-bubble-hint" onClick={() => setIsOpen(true)} role="button" tabIndex={0}>
          <span className="ai-bubble-hint-text">{currentHint}</span>
          <button
            className="ai-bubble-hint-close"
            onClick={(e) => { e.stopPropagation(); setHintVisible(false); }}
            aria-label="Закрыть"
          >✕</button>
          <span className="ai-bubble-hint-tail" aria-hidden />
        </div>
      )}

      {!isOpen && (
        <button className="ai-bubble" onClick={() => setIsOpen(true)} aria-label="Открыть AI-ассистента">
          <Mascot mood={currentMood} size={56} className="ai-bubble-mascot" onTap={() => {}} />
        </button>
      )}

      {isOpen && (
        <>
          <div className="ai-chat-overlay" onClick={() => setIsOpen(false)} />
          <div className="ai-chat-panel" role="dialog" aria-label="AI-ассистент">
            <div className="ai-chat-header">
              <div className="ai-chat-header-avatar-wrap" role="button" tabIndex={-1}>
                <Mascot mood={currentMood} size={56} className="ai-chat-header-avatar" />
              </div>
              <div className="ai-chat-header-info">
                <span className="ai-chat-header-title">AI-ассистент</span>
                <span className="ai-chat-header-sub">ANZH Cosmetology</span>
              </div>
              <button className="ai-chat-close" onClick={() => setIsOpen(false)} aria-label="Закрыть">✕</button>
            </div>
            <div className="ai-messages">
              {messages.map((m) => (
                <div key={m.id} className={`ai-message ${m.role}`}>{m.text}</div>
              ))}
              {messages.length === 1 && !isTyping && (
                <div className="ai-suggestions">
                  <button className="ai-suggestion-chip" onClick={() => setInputValue('Хочу губы — какой объём?')}>Хочу губы — какой объём?</button>
                  <button className="ai-suggestion-chip" onClick={() => setInputValue('Чистка — есть слот на эту неделю?')}>Чистка — есть слот?</button>
                  <button className="ai-suggestion-chip" onClick={() => setInputValue('Что после биоревитализации?')}>После биоревит — что можно?</button>
                  <button className="ai-suggestion-chip" onClick={() => setInputValue('Сколько стоит контурная пластика?')}>Сколько стоит?</button>
                  <button className="ai-suggestion-chip" onClick={() => setInputValue('Где кабинет?')}>Где кабинет?</button>
                  <button className="ai-suggestion-chip" onClick={() => setInputValue('Как с депозитом и отменой?')}>Депозит и отмена</button>
                </div>
              )}
              {isTyping && (
                <div className="ai-typing" aria-label="печатает">
                  <div className="ai-typing-dot" />
                  <div className="ai-typing-dot" />
                  <div className="ai-typing-dot" />
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
            <div className="ai-input-area">
              <input
                ref={inputRef}
                className="ai-input"
                type="text"
                placeholder="Спроси что-нибудь…"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onFocus={() => setInputFocused(true)}
                onBlur={() => setInputFocused(false)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); send(inputValue); } }}
                disabled={isTyping}
              />
              <button
                type="button"
                className={`ai-voice-btn${isRecording ? ' recording' : ''}`}
                onClick={handleVoiceClick}
                aria-label={isRecording ? 'Стоп запись' : 'Голосовой ввод'}
                title="Голосовой ввод"
              >
                <Icon name="mic" size={18} strokeWidth={2} />
              </button>
              <button
                className="ai-send-btn"
                onClick={() => send(inputValue)}
                disabled={(!inputValue.trim() && !isRecording) || isTyping}
                aria-label="Отправить"
              >
                <Icon name="arrow-up-right" size={18} strokeWidth={2.4} />
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
}
