import { useState } from 'react';
import { Icon } from './Icon';
import { openSheet, closeSheet, toast } from '../lib/ui';
import { notify, select, tap } from '../lib/haptics';
import { useModels, loadModels, setMyModel } from '../lib/modelsLive';
import { applyModel, bookModelDay, type Availability, type ModelPrice, type TrainingDay } from '../lib/api/models';
import { formatAmount } from '../lib/money';
import { findService, sTitle } from '../data/services';
import { useSession, ApiError } from '../lib/session';
import { useGender, g as gg } from '../lib/gender';
import { loadMyBookings } from '../lib/appointments';
import { SheetSlot, SlotPortal } from './SheetSlot';
import type { Lang } from '../lib/i18n';

/* ПРОГРАММА «МОДЕЛИ ANZH» (Роч 16.10). Модели нужны только в дни обучения:
   процедуру делает обучающийся врач, Анжелика контролирует каждый шаг.
   Модель платит по прайсу Анжелики по себестоимости — только за запись
   моделью в день обучения, ничего не копится и не переносится.

   Путь: узнала (карточка) → посмотрела цены и дни → встала в лист ожидания
   → студия одобрила → записалась моделью на конкретный день и процедуру. */

const TZ = 'Asia/Tbilisi';
const cap = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);
const dayLabel = (iso: string, lang: Lang) => cap(new Date(iso).toLocaleDateString(lang === 'ru' ? 'ru-RU' : 'en-US', { timeZone: TZ, weekday: 'short', day: 'numeric', month: 'long' }));
const timeLabel = (iso: string, lang: Lang) => new Date(iso).toLocaleTimeString(lang === 'ru' ? 'ru-RU' : 'en-GB', { timeZone: TZ, hour: '2-digit', minute: '2-digit' });
const priceOf = (p: ModelPrice | undefined, lang: Lang) => (p ? formatAmount(p.model_price_minor, p.currency, lang) : '');
const titleOf = (slug: string, prices: ModelPrice[], lang: Lang) => {
  const p = prices.find((x) => x.slug === slug);
  if (p) return p.title[lang] || p.title.ru;
  const s = findService(slug);
  return s ? sTitle(s, lang) : slug;
};

/** Карточка-вход: каталог, «Паспорт», страницы курсов */
export function ModelCard({ lang, variant = 'card' }: { lang: Lang; variant?: 'card' | 'course' }) {
  const { program, mine } = useModels();
  const ru = lang === 'ru';
  if (!program || program.prices.length === 0) return null;
  const next = program.days[0];
  const st = mine?.status ?? 'none';
  const badge = st === 'approved' ? (ru ? 'вы модель' : 'you’re a model') : st === 'pending' ? (ru ? 'заявка отправлена' : 'request sent') : null;
  return (
    <button className={`mdl-card${variant === 'course' ? ' mdl-card--course' : ''}`} onClick={() => openModelProgram(lang)}>
      <span className="mdl-card-ic"><Icon name="sparkles" size={20} strokeWidth={1.8} /></span>
      <span className="mdl-card-body">
        <span className="mdl-card-k">{variant === 'course' ? (ru ? 'курсу нужны модели' : 'this course needs models') : (ru ? 'стать моделью' : 'become a model')}</span>
        <b>{ru ? 'Процедуры по себестоимости в дни обучения' : 'Treatments at cost on training days'}</b>
        <span>{next ? `${ru ? 'Ближайший день' : 'Next day'}: ${dayLabel(next.starts_at, lang)}` : (ru ? 'Даты появятся — встаньте в лист ожидания' : 'Dates coming soon — join the waitlist')}</span>
      </span>
      {badge ? <span className="mdl-card-badge">{badge}</span> : <Icon name="chevron-right" size={16} strokeWidth={2.2} className="mdl-card-go" />}
    </button>
  );
}

export function openModelProgram(lang: Lang, focusDayId?: string) {
  tap();
  const ru = lang === 'ru';
  openSheet({
    title: ru ? 'Модели ANZH' : 'ANZH models',
    subtitle: ru ? 'Процедура по себестоимости в день обучения' : 'A treatment at cost on a training day',
    body: <ProgramBody lang={lang} focusDayId={focusDayId} />,
    actions: <ProgramFooter lang={lang} />,
  });
}

function StatusLine({ lang }: { lang: Lang }) {
  const { mine } = useModels();
  const ru = lang === 'ru';
  const st = mine?.status ?? 'none';
  if (st === 'none') return null;
  const map = {
    pending: { ic: 'clock' as const, t: ru ? 'Заявка в листе ожидания' : 'You’re on the waitlist', s: ru ? 'Студия рассмотрит её и ответит в бота. Обычно — в течение пары дней.' : 'The studio reviews it and replies in the bot, usually within a couple of days.' },
    approved: { ic: 'check' as const, t: ru ? 'Вы модель ANZH' : 'You’re an ANZH model', s: ru ? 'Выберите день обучения и процедуру ниже — цена для моделей применится сама.' : 'Pick a training day and treatment below — the model price applies automatically.' },
    declined: { ic: 'info' as const, t: ru ? 'Пока не подошло' : 'Not this time', s: mine?.reason ? mine.reason : (ru ? 'Можно подать заявку снова — например, на другие процедуры.' : 'You can apply again — e.g. for other treatments.') },
  }[st];
  return (
    <div className={`mdl-status ${st}`} role="status">
      <span className="mdl-status-ic"><Icon name={map.ic} size={16} strokeWidth={2.4} /></span>
      <span><b>{map.t}</b><span>{map.s}</span></span>
    </div>
  );
}

function ProgramBody({ lang, focusDayId }: { lang: Lang; focusDayId?: string }) {
  const { program, mine, failed } = useModels();
  const ru = lang === 'ru';
  const [showTerms, setShowTerms] = useState(false);
  if (!program) {
    return <p className="muted">{failed ? (ru ? 'Программа не загрузилась — проверьте интернет.' : 'Couldn’t load the programme — check your connection.') : (ru ? 'Загружаю…' : 'Loading…')}</p>;
  }
  const terms = (program.agreement[lang] || program.agreement.ru).split('\n').filter(Boolean);
  return (
    <div className="mdl">
      <StatusLine lang={lang} />
      <p className="mdl-lede">
        {ru
          ? 'В дни обучения Анжелика учит врачей — им нужны модели. Процедуру делает обучающийся врач, Анжелика контролирует каждый шаг, а модель платит только себестоимость.'
          : 'On training days Anjelika teaches doctors — they need models. A doctor in training performs the treatment, Anjelika supervises every step, and the model pays only the cost price.'}
      </p>

      <ol className="mdl-steps">
        <li><b>{ru ? 'Заявка' : 'Apply'}</b><span>{ru ? 'процедуры и удобные дни' : 'treatments and days'}</span></li>
        <li><b>{ru ? 'Одобрение' : 'Approval'}</b><span>{ru ? 'студия ответит в бота' : 'reply in the bot'}</span></li>
        <li><b>{ru ? 'День обучения' : 'Training day'}</b><span>{ru ? 'запись в один тап' : 'book in one tap'}</span></li>
      </ol>

      <div className="eyebrow mdl-h">{ru ? 'цены для моделей' : 'model prices'}</div>
      <div className="mdl-prices">
        {program.prices.map((p) => (
          <div key={p.slug} className="mdl-price">
            <span className="mdl-price-t">{p.title[lang] || p.title.ru}</span>
            {p.price_minor != null && <s>{formatAmount(p.price_minor, p.currency, lang)}</s>}
            <b>{priceOf(p, lang)}</b>
          </div>
        ))}
      </div>

      <div className="eyebrow mdl-h">{ru ? 'ближайшие дни обучения' : 'upcoming training days'}</div>
      {program.days.length === 0 && <p className="muted mdl-empty">{ru ? 'Новых дат пока нет. Встаньте в лист ожидания — бот напишет, когда появятся.' : 'No dates yet. Join the waitlist — the bot will message you when they appear.'}</p>}
      <div className="mdl-days">
        {program.days.map((d) => <DayCard key={d.id} day={d} lang={lang} focus={d.id === focusDayId} approved={mine?.status === 'approved'} bookedSlug={mine?.bookings.find((b) => (b as { training_day_id?: string }).training_day_id === d.id)?.items?.[0]?.slug ?? null} prices={program.prices} />)}
      </div>

      <button className="mdl-terms-toggle" onClick={() => { tap(); setShowTerms(!showTerms); }} aria-expanded={showTerms}>
        <Icon name="chevron-right" size={14} strokeWidth={2.4} className={showTerms ? 'open' : ''} /> {ru ? 'Условия для моделей' : 'Model terms'}
      </button>
      {showTerms && <ul className="mdl-terms">{terms.map((t) => <li key={t}>{t}</li>)}</ul>}
    </div>
  );
}

function DayCard({ day, lang, focus, approved, bookedSlug, prices }: { day: TrainingDay; lang: Lang; focus: boolean; approved: boolean; bookedSlug: string | null; prices: ModelPrice[] }) {
  const ru = lang === 'ru';
  const [busy, setBusy] = useState<string | null>(null);
  const course = day.course_slug ? findService(day.course_slug) : undefined;
  const book = async (slug: string) => {
    if (busy) return;
    setBusy(slug); tap('medium');
    try {
      await bookModelDay(day.id, slug);
      notify('success');
      toast(ru ? `Вы записаны моделью: ${dayLabel(day.starts_at, lang)} — время уточнит администратор` : `Booked as a model: ${dayLabel(day.starts_at, lang)} — the admin will confirm the time`, 'success');
      await Promise.all([loadModels(), loadMyBookings?.()]);
    } catch (e) {
      notify('error');
      toast(e instanceof ApiError && e.message ? e.message : (ru ? 'Не получилось — проверьте интернет' : 'Didn’t work — check your connection'));
      void loadModels();
    } finally { setBusy(null); }
  };
  return (
    <div className={`mdl-day${focus ? ' focus' : ''}`}>
      <div className="mdl-day-head">
        <b>{dayLabel(day.starts_at, lang)}</b>
        <span>{timeLabel(day.starts_at, lang)}–{timeLabel(day.ends_at, lang)}{course ? ` · ${sTitle(course, lang)}` : ''}</span>
      </div>
      {day.slots.map((x) => {
        const left = Math.max(0, x.spots - x.taken);
        const mineHere = bookedSlug === x.slug;
        return (
          <div key={x.slug} className="mdl-slot">
            <span className="mdl-slot-t">
              <b>{titleOf(x.slug, prices, lang)}</b>
              <span>{priceOf(prices.find((p) => p.slug === x.slug), lang)} · {left > 0 ? (ru ? `мест: ${left} из ${x.spots}` : `${left} of ${x.spots} left`) : (ru ? 'мест нет' : 'full')}</span>
            </span>
            {mineHere
              ? <span className="mdl-slot-mine"><Icon name="check" size={13} strokeWidth={2.8} /> {ru ? 'вы записаны' : 'booked'}</span>
              : approved && !bookedSlug && left > 0
                ? <button className="btn btn-primary btn-sm" disabled={busy !== null} aria-busy={busy === x.slug} onClick={() => { void book(x.slug); }}>{busy === x.slug ? '…' : (ru ? 'Записаться' : 'Book')}</button>
                : null}
          </div>
        );
      })}
    </div>
  );
}

function ProgramFooter({ lang }: { lang: Lang }) {
  const { mine, program } = useModels();
  const session = useSession();
  const ru = lang === 'ru';
  const st = mine?.status ?? 'none';
  if (session.status !== 'user') {
    return <p className="pw-foot-meta">{ru ? 'Заявка подаётся из приложения в Telegram.' : 'Apply from the app inside Telegram.'}</p>;
  }
  if (st === 'none' || st === 'declined') {
    return (
      <button className="btn btn-amber btn-block" disabled={!program} onClick={() => openApply(lang)}>
        <Icon name="sparkles" size={16} strokeWidth={2} /> {st === 'declined' ? (ru ? 'Подать заявку снова' : 'Apply again') : (ru ? 'Встать в лист ожидания' : 'Join the waitlist')}
      </button>
    );
  }
  return (
    <button className="btn btn-quiet btn-block" onClick={closeSheet}>
      {st === 'pending' ? (ru ? 'Ждём ответа студии · закрыть' : 'Waiting for the studio · close') : (ru ? 'Готово' : 'Done')}
    </button>
  );
}

/* ── Заявка в лист ожидания ── */
function openApply(lang: Lang) {
  const ru = lang === 'ru';
  openSheet({
    title: ru ? 'Заявка в модели' : 'Model application',
    subtitle: ru ? 'Лист ожидания · ответ придёт в бота' : 'Waitlist · the answer comes to the bot',
    body: <ApplyForm lang={lang} />,
    actions: <SheetSlot name="model-apply" />,
  });
}

function ApplyForm({ lang }: { lang: Lang }) {
  const { program } = useModels();
  const gender = useGender();
  const ru = lang === 'ru';
  const [slugs, setSlugs] = useState<string[]>([]);
  const [avail, setAvail] = useState<Availability>('any');
  const [adult, setAdult] = useState(false);
  const [terms, setTerms] = useState(false);
  const [photo, setPhoto] = useState(false);
  const [busy, setBusy] = useState(false);
  const [why, setWhy] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  if (!program) return null;
  const ready = slugs.length > 0 && adult && terms && photo && !busy;
  const need = slugs.length === 0 ? (ru ? 'Выберите хотя бы одну процедуру' : 'Pick at least one treatment')
    : !(adult && terms && photo) ? (ru ? 'Отметьте три согласия' : 'Tick the three consents') : null;

  if (done) {
    return (
      <div className="wr-done">
        <span className="wr-done-ic"><Icon name="check" size={26} strokeWidth={2.4} /></span>
        <b>{ru ? 'Вы в листе ожидания' : 'You’re on the waitlist'}</b>
        <SlotPortal name="model-apply"><button className="btn btn-quiet btn-block" onClick={closeSheet}>{ru ? 'Готово' : 'Done'}</button></SlotPortal>
        <p>{ru ? 'Студия рассмотрит заявку и напишет в бота. Перед днём обучения заполните анкету здоровья в «Паспорте» — противопоказания проверяют до процедуры.' : 'The studio reviews it and messages you in the bot. Before the training day, fill in the health form in “Passport” — contraindications are checked before the treatment.'}</p>
      </div>
    );
  }

  const send = async () => {
    if (!ready) return;
    setBusy(true); setWhy(null);
    try {
      const m = await applyModel({ slugs, availability: avail, agreement_version: program.agreement.version, photo_consent: true, adult: true });
      setMyModel(m);
      notify('success');
      setDone(true);
    } catch (e) {
      notify('error');
      if (e instanceof ApiError && e.code === 'agreement_changed') void loadModels();
      setWhy(e instanceof ApiError && e.message ? e.message : (ru ? 'Не отправилось — проверьте интернет' : 'Not sent — check your connection'));
    } finally { setBusy(false); }
  };

  const tick = (on: boolean, set: (v: boolean) => void, text: string) => (
    <button type="button" role="checkbox" aria-checked={on} className={`pw-tick${on ? ' on' : ''}`} onClick={() => { select(); set(!on); }}>
      <span className="pw-tick-box" aria-hidden>{on && <Icon name="check" size={13} strokeWidth={2.8} />}</span>
      <span className="pw-tick-text">{text}</span>
    </button>
  );

  return (
    <div className="mdl-form">
      <div className="eyebrow">{ru ? 'какие процедуры интересны' : 'treatments you’re interested in'}</div>
      <div className="wr-procs">
        {program.prices.map((p) => (
          <button key={p.slug} className={`chip${slugs.includes(p.slug) ? ' chip-gold' : ''}`} aria-pressed={slugs.includes(p.slug)}
            onClick={() => { select(); setSlugs((x) => (x.includes(p.slug) ? x.filter((y) => y !== p.slug) : [...x, p.slug])); }}>
            {p.title[lang] || p.title.ru} · {priceOf(p, lang)}
          </button>
        ))}
      </div>
      <div className="eyebrow">{ru ? 'когда удобно' : 'when suits you'}</div>
      <div className="mdl-seg" role="radiogroup">
        {([['weekdays', ru ? 'Будни' : 'Weekdays'], ['weekends', ru ? 'Выходные' : 'Weekends'], ['any', ru ? 'Любой день' : 'Any day']] as Array<[Availability, string]>).map(([id, t]) => (
          <button key={id} role="radio" aria-checked={avail === id} className={avail === id ? 'on' : ''} onClick={() => { select(); setAvail(id); }}>{t}</button>
        ))}
      </div>
      <div className="mdl-ticks">
        {tick(adult, setAdult, ru ? 'Мне 18 лет или больше' : 'I’m 18 or older')}
        {tick(terms, setTerms, ru ? `${gg('Согласна', 'Согласен', gender)} с условиями для моделей` : 'I agree to the model terms')}
        {tick(photo, setPhoto, ru ? `${gg('Согласна', 'Согласен', gender)} на фото до/после для обучения` : 'I agree to before/after photos for training')}
      </div>
      <ul className="mdl-terms mdl-terms--inline">{(program.agreement[lang] || program.agreement.ru).split('\n').filter(Boolean).map((t) => <li key={t}>{t}</li>)}</ul>
      {why && <p className="form-why" role="alert">{why}</p>}
      <SlotPortal name="model-apply">
        {!why && need && <p className="pw-foot-meta">{need}</p>}
        <button className="btn btn-amber btn-block" disabled={!ready} aria-busy={busy} onClick={() => { void send(); }}>
          {busy ? (ru ? 'Отправляю…' : 'Sending…') : (ru ? 'Отправить заявку' : 'Send application')}
        </button>
      </SlotPortal>
    </div>
  );
}
