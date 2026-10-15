import { useRef, useState } from 'react';
import { Icon } from './Icon';
import { toast } from '../lib/ui';
import {
  dayOf, pendingOf, formatShort, formatMoneyParts, sumByCurrency, revenueMinor, salonTodayISO, visitTitle,
  type Visit,
} from '../lib/studio';

// Помощник мастера по своим записям. Анжелика: «подскажи, какие у меня
// записи, или расскажи про этого пациента». Отдельная боль: у неё «одни
// Марины, Оли и Кати», поэтому поиск идёт по имени из Telegram.
//
// Это поиск по словам, а не модель: ИИ этой ночью не подключается. Отвечает
// только по тому, что сервер отдал смотрящему (мастеру — его записи).

/** Основа имени без падежного окончания: «машу» и «маша» → «маш» */
const stem = (w: string) => w.trim().toLowerCase().replace(/[аяуюыиеёой]+$/u, '');

/**
 * Служебные слова запроса — отбрасываются ЦЕЛЫМ словом и только после
 * разбиения на слова. Прежде они вырезались из строки подстрокой: «про»
 * уходило и из имени — «расскажи про Прохорову» → «хорову», не найдено.
 * Одиночную «о» можно ставить в список только так: подстрокой она съела бы
 * каждую «о» («Олю» → «лю»).
 */
const SERVICE_WORD = /^(?:расскажи|покажи|про|о|об|клиент\p{L}*|пациент\p{L}*)$/u;

/**
 * Слова запроса, по которым ищется имя. Разделитель — всё, что не буква и не
 * цифра (`\p{L}`/`\p{N}` с флагом u: `\w` и `\b` кириллицы не видят), —
 * пробелы, запятые, «@», знаки вопроса.
 */
const nameWords = (query: string): string[] =>
  query
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((w) => w !== '' && !SERVICE_WORD.test(w))
    .map(stem)
    .filter((w) => w.length >= 2);

export function StudioAsk({ queue, day, history }: { queue: Visit[]; day: Visit[]; history: Visit[] }) {
  const [q, setQ] = useState('');
  const [answer, setAnswer] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  const recRef = useRef<{ stop: () => void } | null>(null);

  const everyone = (): Visit[] => {
    const seen = new Map<string, Visit>();
    for (const list of [history, day, queue]) for (const v of list) seen.set(v.id, v);
    return [...seen.values()];
  };

  const ask = (text: string) => {
    const query = text.trim().toLowerCase();
    if (!query) return;

    if (/(записи|расписан|сегодня|день|кто прид)/.test(query)) {
      const today = dayOf(day);
      const pending = pendingOf(queue);
      setAnswer(
        today.length === 0
          ? `Сегодня записей нет. Новых заявок: ${pending.length}.`
          : `Сегодня ${today.length}: ${today
              .map((v) => `${v.slot} — ${v.clientName}, ${visitTitle(v).toLowerCase()}`)
              .join('; ')}. Новых заявок: ${pending.length}.`,
      );
      return;
    }

    if (/(заявк|новы|подтверд)/.test(query)) {
      const pending = pendingOf(queue);
      setAnswer(
        pending.length === 0
          ? 'Новых заявок нет — всё разобрано.'
          : `${pending.length} ждут решения: ${pending
              .map((v) => `${v.clientName} на ${formatShort(v.dateISO)} ${v.slot}`)
              .join('; ')}.`,
      );
      return;
    }

    // Поиск человека по имени. Сравниваем основы: спрашивают «расскажи про
    // Машу», а в записи «Маша». Слова — nameWords: сначала разбиение, потом
    // служебные слова целиком. Прежняя строка вырезала их подстрокой («про»
    // из «Прохоровой»), а на месте `\b` прототипа стоял невидимый управляющий
    // символ U+0008; в волне 1 (6b5233f) у разделителя `[\s,@]` потерялась
    // обратная косая, и запрос резался по латинской «s», а не по пробелам.
    const all = everyone();
    const words = nameWords(query);

    const hit = words.length === 0 ? undefined : all.find((v) => {
      // Без имени в Telegram клиентка записана как «@ник» (clientNameOf), а
      // «@» из запроса ушло при разбиении: подсказка «Расскажи про @ник»
      // иначе не находила её саму.
      const name = stem(v.clientName.toLowerCase().replace(/^@/, ''));
      return words.some((w) => name.startsWith(w) || w.startsWith(name));
    });

    if (hit) {
      const mine = all.filter((v) => v.clientId === hit.clientId);
      const done = mine.filter((v) => v.status === 'done').sort((a, b) => b.startsAt.localeCompare(a.startsAt));
      const noShows = mine.filter((v) => v.status === 'no_show').length;
      // Per currency: lari and dollars are never added into one number (B1-B)
      const spent = sumByCurrency(done, revenueMinor);
      const last = done[0];
      setAnswer(
        `${hit.clientName}. Визитов: ${done.length}${spent.length ? `, оставила ${formatMoneyParts(spent)}` : ''}. ` +
        (last ? `Последняя процедура — ${visitTitle(last).toLowerCase()} ${formatShort(last.dateISO)}. ` : '') +
        (noShows > 0 ? `Внимание: неявок ${noShows}. ` : '') +
        (done.length > 1 ? `До этого: ${done.slice(1, 3).map((v) => `${visitTitle(v).toLowerCase()} (${formatShort(v.dateISO)})`).join(', ')}.` : ''),
      );
      return;
    }

    setAnswer('Не нашла такого человека в ваших записях. Попробуйте имя, как в Telegram.');
  };

  const someone = everyone()[0]?.clientName.split(' ')[0];
  const hints = ['Какие записи сегодня?', 'Сколько новых заявок?', ...(someone ? [`Расскажи про ${someone}`] : [])];

  const voice = () => {
    if (recording) { recRef.current?.stop(); setRecording(false); return; }
    const SR = (window as unknown as { SpeechRecognition?: new () => unknown; webkitSpeechRecognition?: new () => unknown });
    const Ctor = SR.SpeechRecognition ?? SR.webkitSpeechRecognition;
    if (!Ctor) { toast('Голосовой ввод недоступен в этом браузере'); return; }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rec: any = new (Ctor as new () => unknown)();
    rec.lang = 'ru-RU';
    rec.interimResults = true;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rec.onresult = (e: any) => {
      const text = Array.from(e.results).map((r: any) => r[0].transcript).join(' ');
      setQ(text);
      if (e.results[e.results.length - 1].isFinal) ask(text);
    };
    rec.onend = () => { setRecording(false); recRef.current = null; };
    recRef.current = rec;
    setRecording(true);
    rec.start();
  };

  return (
    <div className="studio-ask">
      <div className="studio-ask-row">
        <input
          className="studio-ask-input"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') ask(q); }}
          placeholder="Спросите про записи"
        />
        <button className={`studio-ask-mic${recording ? ' on' : ''}`} onClick={voice} aria-label="Спросить голосом">
          <Icon name="mic" size={17} strokeWidth={2} />
        </button>
        <button className="studio-ask-send" onClick={() => ask(q)} aria-label="Спросить">
          <Icon name="arrow-up-right" size={17} strokeWidth={2.4} />
        </button>
      </div>
      {!answer && (
        <div className="studio-ask-hints">
          {hints.map((h) => (
            <button key={h} className="studio-ask-hint" onClick={() => { setQ(h); ask(h); }}>{h}</button>
          ))}
        </div>
      )}
      {answer && (
        <div className="studio-ask-answer">
          {answer}
          <button className="studio-ask-clear" onClick={() => { setAnswer(null); setQ(''); }} aria-label="Закрыть">
            <Icon name="x" size={14} strokeWidth={2.4} />
          </button>
        </div>
      )}
      {/* «Сегодня» — день САЛОНА, как все даты визитов в кабинете (ЦФ1) */}
      <div className="faint" style={{ fontSize: 12, marginTop: 8 }}>
        Сегодня {formatShort(salonTodayISO())} · отвечает по вашим записям
      </div>
    </div>
  );
}
