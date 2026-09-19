import { useRef, useState } from 'react';
import { Icon } from './Icon';
import { toast } from '../lib/ui';
import { findService, sTitle } from '../data/services';
import {
  getClients, getDay, getPending, formatShort, toISODate,
  type Appointment,
} from '../lib/appointments';

// Голосовой помощник мастера. Анжелика: «какая-то нейронка — подскажи, какие у
// меня записи, или расскажи про этого пациента». Отдельная боль: у неё «одни
// Марины, Оли и Кати», поэтому поиск идёт и по имени, и по нику инстаграма.

/** Основа имени без падежного окончания: «машу» и «маша» → «маш» */
const stem = (w: string) => w.trim().toLowerCase().replace(/[аяуюыиеёой]+$/u, '');

export function StudioAsk({ all }: { all: Appointment[] }) {
  const [q, setQ] = useState('');
  const [answer, setAnswer] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  const recRef = useRef<{ stop: () => void } | null>(null);

  const ask = (text: string) => {
    const query = text.trim().toLowerCase();
    if (!query) return;

    if (/(записи|расписан|сегодня|день|кто прид)/.test(query)) {
      const today = getDay(all);
      const pending = getPending(all);
      setAnswer(
        today.length === 0
          ? `Сегодня записей нет. Новых заявок: ${pending.length}.`
          : `Сегодня ${today.length}: ${today
              .map((a) => {
                const s = findService(a.serviceId);
                return `${a.slot} — ${a.clientName}${a.clientInstagram ? ` (@${a.clientInstagram})` : ''}, ${s ? sTitle(s, 'ru').toLowerCase() : ''}`;
              })
              .join('; ')}. Новых заявок: ${pending.length}.`,
      );
      return;
    }

    if (/(заявк|новы|подтверд)/.test(query)) {
      const pending = getPending(all);
      setAnswer(
        pending.length === 0
          ? 'Новых заявок нет — всё разобрано.'
          : `${pending.length} заявки ждут решения: ${pending
              .map((a) => `${a.clientName} на ${formatShort(a.dateISO)} ${a.slot}`)
              .join('; ')}.`,
      );
      return;
    }

    // Поиск человека — по имени ИЛИ по нику, потому что имён-дублей много.
    // Сравниваем основы: спрашивают «расскажи про Машу», а в базе «Маша».
    const clients = getClients(all);
    const words = query
      .replace(/расскажи|покажи|про|о\b|клиент[а-я]*|пациент[а-я]*/g, ' ')
      .split(/[\s,@]+/)
      .map(stem)
      .filter((w) => w.length >= 2);

    const found = words.length === 0 ? undefined : clients.find((c) =>
      words.some((w) =>
        stem(c.name.toLowerCase()).startsWith(w) ||
        w.startsWith(stem(c.name.toLowerCase())) ||
        (c.instagram ?? '').toLowerCase().includes(w)),
    );

    if (found) {
      const visits = all.filter((a) => (a.clientInstagram || a.clientName) === found.key && a.status === 'completed');
      const last = visits[0];
      const lastSvc = last ? findService(last.serviceId) : undefined;
      setAnswer(
        `${found.name}${found.instagram ? ` · @${found.instagram}` : ''}. ` +
        `Визитов: ${found.visits}, оставила $${found.spent}. ` +
        (last ? `Последняя процедура — ${lastSvc ? sTitle(lastSvc, 'ru').toLowerCase() : ''} ${formatShort(last.dateISO)}. ` : '') +
        (found.noShows > 0 ? `Внимание: неявок ${found.noShows}. ` : '') +
        (visits.length > 1 ? `До этого: ${visits.slice(1, 3).map((v) => {
          const s = findService(v.serviceId);
          return `${s ? sTitle(s, 'ru').toLowerCase() : ''} (${formatShort(v.dateISO)})`;
        }).join(', ')}.` : ''),
      );
      return;
    }

    setAnswer('Не нашла такого человека в базе. Попробуй имя или ник из инстаграма.');
  };

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
          placeholder="Какие записи сегодня? Расскажи про Олю"
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
          {['Какие записи сегодня?', 'Сколько новых заявок?', 'Расскажи про Машу'].map((h) => (
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
      <div className="faint" style={{ fontSize: 11, marginTop: 8 }}>
        Сегодня {formatShort(toISODate(new Date()))} · база собирается сама из записей
      </div>
    </div>
  );
}
