import { useEffect, useState } from 'react';
import { Icon, type IconName } from './Icon';
import { tap } from '../lib/haptics';
import { findService, sTitle } from '../data/services';
import { formatWeekday, fromISODate, formatMonthShort, type Appointment } from '../lib/appointments';
import type { JourneyStep } from '../lib/journey';
import type { Lang } from '../lib/i18n';

/* Блок-приветствие «Паспорта» — уже не «Привет ♥», а проводник.
   Три строки: кто ты → где ты на пути → что дальше, и ОДНА кнопка.

   Движение — механика ROCH Motion «mask-lines» («абзацы выезжают из-под
   маски»), повторённая своим кодом (лицензия набора — только команда AppHUB):
   каждая строка в своей маске поднимается снизу с недодемпфированной
   пружиной наклона, шаг 60 мс. Текст читается по шагам, а не простынёй —
   ровно задача этого блока. Повторяется при смене шага (ключ = kind),
   reduced-motion — сразу на месте. */

const STAGES: Record<Lang, string[]> = {
  ru: ['Кожа', 'Выбор', 'Заявка', 'Визит', 'Уход'],
  en: ['Skin', 'Choice', 'Request', 'Visit', 'Care'],
};

function when(a: Appointment | undefined, lang: Lang): string {
  if (!a) return '';
  const d = fromISODate(a.dateISO);
  return `${formatWeekday(d, lang)}, ${d.getDate()} ${formatMonthShort(d, lang)} · ${a.slot}`;
}
const titleOf = (slug: string | undefined, lang: Lang) => {
  const s = slug ? findService(slug) : undefined;
  return s ? sTitle(s, lang) : '';
};

export interface JourneyActions {
  onProfile: () => void;
  onBook: (slug?: string) => void;
  onOpenVisit: (a: Appointment) => void;
  onCalendar: (a: Appointment) => void;
  onReview: () => void;
  onPlan: () => void;
  onCatalog: () => void;
}

export function JourneyHero({ name, step, lang, act }: { name: string; step: JourneyStep; lang: Lang; act: JourneyActions }) {
  const ru = lang === 'ru';
  const [run, setRun] = useState(0);
  useEffect(() => { setRun((n) => n + 1); }, [step.kind]);

  const svc = step.appt ? titleOf(step.appt.serviceId, lang) : titleOf(step.slug, lang);
  const copy: Record<JourneyStep['kind'], { line: string; cta: string; icon: IconName; go: () => void; alt?: { label: string; go: () => void } }> = {
    guest: { line: ru ? 'Откройте приложение в Telegram — там запись, паспорт кожи и чат с Анжеликой.' : 'Open the app in Telegram — booking, skin passport and chat live there.', cta: ru ? 'Смотреть услуги' : 'See treatments', icon: 'sparkles', go: act.onCatalog },
    visit: { line: ru ? `Ждём вас: ${svc} — ${when(step.appt, lang)}. Добавьте в календарь, чтобы не забыть.` : `See you: ${svc} — ${when(step.appt, lang)}. Add it to your calendar.`, cta: ru ? 'В календарь' : 'Add to calendar', icon: 'calendar', go: () => step.appt && act.onCalendar(step.appt), alt: { label: ru ? 'Детали визита' : 'Visit details', go: () => step.appt && act.onOpenVisit(step.appt) } },
    pending: { line: ru ? `Заявка на «${svc}» у Анжелики. Ответ придёт в бота — обычно в течение дня.` : `Your request for “${svc}” is with Anjelika. The answer comes to the bot, usually within a day.`, cta: ru ? 'Посмотреть заявку' : 'View request', icon: 'clock', go: () => step.appt && act.onOpenVisit(step.appt) },
    review: { line: ru ? `Как прошла ${svc ? `«${svc}»` : 'процедура'}? Пара слов — и −5 % на следующий визит.` : `How was ${svc ? `“${svc}”` : 'your treatment'}? A few words — and 5% off your next visit.`, cta: ru ? 'Оставить отзыв' : 'Leave a review', icon: 'star', go: act.onReview, alt: { label: ru ? 'Записаться снова' : 'Book again', go: () => act.onBook(step.appt?.serviceId) } },
    profile: { line: ru ? 'Начните с Skin Profile: 3 минуты — и Анжелика увидит вашу кожу ещё до приёма.' : 'Start with the Skin Profile: 3 minutes, and Anjelika sees your skin before the visit.', cta: ru ? 'Пройти Skin Profile' : 'Take the Skin Profile', icon: 'sparkles', go: act.onProfile },
    bookmark: { line: ru ? `В закладках — «${svc}». Выберите удобное время, остальное сделаем мы.` : `Saved: “${svc}”. Pick a time — we handle the rest.`, cta: ru ? 'Выбрать время' : 'Pick a time', icon: 'calendar', go: () => act.onBook(step.slug) },
    choose: { line: ru ? 'Профиль кожи готов. Выберите процедуру — или спросите Анжелику в чате.' : 'Your skin profile is ready. Pick a treatment — or ask Anjelika in the chat.', cta: ru ? 'Выбрать процедуру' : 'Choose a treatment', icon: 'sparkles', go: act.onCatalog },
    course: { line: ru ? 'Следующий шаг — курс: порядок процедур и интервалы между ними.' : 'Next step — a course: treatment order and intervals.', cta: ru ? 'Собрать план' : 'Build the plan', icon: 'layers', go: act.onPlan },
  };
  const c = copy[step.kind];
  const hello = `${ru ? 'Привет' : 'Hi'}${name ? `, ${name}` : ''}`;

  return (
    <section className="jh" aria-live="polite" key={run}>
      <h1 className="jh-hello"><span className="jh-mask"><span className="jh-line" style={{ animationDelay: '0ms' }}>{hello}</span></span></h1>
      {step.stage > 0 && (
        <div className="jh-path" aria-label={ru ? `Шаг ${step.stage} из 5` : `Step ${step.stage} of 5`}>
          {STAGES[lang].map((label, i) => (
            <span key={label} className={`jh-stop${i + 1 < step.stage ? ' done' : i + 1 === step.stage ? ' now' : ''}`} style={{ animationDelay: `${120 + i * 60}ms` }}>
              <i aria-hidden />{label}
            </span>
          ))}
        </div>
      )}
      <p className="jh-text"><span className="jh-mask"><span className="jh-line" style={{ animationDelay: '180ms' }}>{c.line}</span></span></p>
      <div className="jh-actions jh-rise" style={{ animationDelay: '300ms' }}>
        <button className="btn btn-primary btn-block" onClick={() => { tap(); c.go(); }}>
          <Icon name={c.icon} size={16} strokeWidth={2} /> {c.cta}
        </button>
        {c.alt && <button className="jh-alt" onClick={() => { tap(); c.alt!.go(); }}>{c.alt.label}</button>}
      </div>
    </section>
  );
}
