import { useRewards } from '../lib/rewardsLive';
import { asset } from '../lib/asset';
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { findService, sTitle, sShort, servicePhoto } from '../data/services';
import { catalogNote, useCatalog } from '../lib/catalog';
import { FROM_FOOTNOTE, FROM_NOTE, PAY_NOTE, displayPrice, priceSourceOf, servicePrice, visitTotal } from '../lib/money';
import { usePriceMode } from '../lib/priceMode';
import { useRate } from '../lib/rates';
import { isOnShowcase } from '../lib/showable';
import { openSheet, toast } from '../lib/ui';
import { Icon } from '../components/Icon';
import { LiveAnjelika } from '../components/LiveAvatar';
import { PingPong } from '../components/PingPong';
import { SwipeRow } from '../components/SwipeRow';
import { useLang, t } from '../lib/i18n';
import {
  addDaysISO, isBookable, isoWeekday, requestBooking, salonToday, salonTz, setSalonTimeZone,
} from '../lib/appointments';
import { getSlots, type Slot } from '../lib/api/bookings';
import { ApiError, isAbortError, newIdempotencyKey, serverMessage, useSession, type GuestReason } from '../lib/session';
import { refreshMe, updateMe, useMe, type MePatch } from '../lib/api';
import { studioAddress, telegramUrl } from '../data/location';
import { openTelegram } from '../lib/telegram';
import { select } from '../lib/haptics';
import { suggestionsFor } from '../lib/combos';
import { useHealthPassport, matchContraindications } from '../lib/healthPassport';
import type { ClientProfile } from '../App';

type Lang = 'ru' | 'en';
type Msg = { ru: string; en: string };

const DAYS_RU = ['ВС', 'ПН', 'ВТ', 'СР', 'ЧТ', 'ПТ', 'СБ'];
const MON_RU = ['ЯНВ', 'ФЕВ', 'МАР', 'АПР', 'МАЙ', 'ИЮН', 'ИЮЛ', 'АВГ', 'СЕН', 'ОКТ', 'НОЯ', 'ДЕК'];
const DAYS_EN = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const MON_EN = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

/** Сколько дней показывает лента дат. Дальше сервер может ответить too_far. */
const DAYS_AHEAD = 21;

/* ВРЕМЯ ЗАПИСИ — ТОЛЬКО С СЕРВЕРА (GET /slots). Прежние зашитые слоты
   («вт–сб, 09:00–19:30») и «занято» по демо-базе телефона убраны: часы,
   шаг сетки, выходные и занятость знает только сервер, и `starts_at` для
   заявки берётся из его ответа, а не собирается из даты и часа на телефоне. */

/* ── Сеть: без связи заявку не принимаем ─────────────────────────────── */

function subscribeOnline(cb: () => void) {
  window.addEventListener('online', cb);
  window.addEventListener('offline', cb);
  return () => {
    window.removeEventListener('online', cb);
    window.removeEventListener('offline', cb);
  };
}
const onlineNow = () => (typeof navigator === 'undefined' ? true : navigator.onLine !== false);

/* ── Слова для отказов ─────────────────────────────────────────────────
   Коды — из server/openapi.yaml (x-codes у /slots и POST /bookings).
   `where` — у какого поля сказать: у времени, у контактов или у кнопки. */

type Where = 'time' | 'contact' | 'submit';

const GUEST_TEXT: Record<GuestReason, Msg> = {
  outside_telegram: {
    ru: 'Свободное время и заявка — в приложении внутри Telegram. Открой его через бота.',
    en: 'Free times and requests work inside the Telegram app. Open it via the bot.',
  },
  network: {
    ru: 'Нет связи с сервером — свободное время не загрузить. Проверь интернет.',
    en: 'Can’t reach the server — free times can’t load. Check your connection.',
  },
  refused: {
    ru: 'Не удалось войти — перезапусти приложение из Telegram.',
    en: 'Sign-in failed — restart the app from Telegram.',
  },
  server: {
    ru: 'Сервер сейчас не отвечает — попробуй чуть позже.',
    en: 'The server isn’t responding right now — try again a bit later.',
  },
};

const OFFLINE_TEXT: Msg = {
  ru: 'Нет связи — заявка сейчас не уйдёт. Подключись к интернету и отправь снова: в очередь мы её не ставим.',
  en: 'You’re offline — the request can’t be sent now. Reconnect and send again: we don’t queue it.',
};

function slotsErrorText(e: ApiError): Msg {
  switch (e.code) {
    case 'past_time':
      return { ru: 'Этот день уже прошёл — выбери другой.', en: 'This day has passed — pick another.' };
    case 'too_far':
      return { ru: 'Так далеко запись пока не открыта — выбери дату поближе.', en: 'Booking isn’t open that far ahead — pick an earlier date.' };
    case 'no_staff':
    case 'staff_mismatch':
      return {
        ru: 'Этот состав визита сейчас некому провести — убери лишнюю процедуру или напиши Анжелике.',
        en: 'No one can do this combination right now — remove a treatment or message Anjelika.',
      };
    case 'unknown_service':
    case 'incomplete_service':
      return {
        ru: 'Одна из процедур сейчас недоступна для записи онлайн — напиши Анжелике.',
        en: 'One of the treatments can’t be booked online right now — message Anjelika.',
      };
    case 'network':
    case 'timeout':
      return { ru: 'Нет связи — свободное время не загрузилось.', en: 'No connection — free times didn’t load.' };
    default:
      return { ru: 'Свободное время не загрузилось — попробуй ещё раз.', en: 'Free times didn’t load — try again.' };
  }
}

function bookingErrorText(e: ApiError): { where: Where; text: Msg; reloadSlots?: boolean; keepKey?: boolean } {
  switch (e.code) {
    case 'slot_taken':
      return {
        where: 'time', reloadSlots: true,
        text: { ru: 'Это время только что заняли — выбери другое.', en: 'That time was just taken — pick another.' },
      };
    case 'outside_hours':
      return {
        where: 'time', reloadSlots: true,
        text: { ru: 'Это время вне часов работы — выбери из списка ниже.', en: 'That’s outside working hours — pick from the list below.' },
      };
    case 'off_grid':
      return {
        where: 'time', reloadSlots: true,
        text: { ru: 'Запись идёт по сетке расписания — выбери время из списка.', en: 'Bookings follow the schedule grid — pick a time from the list.' },
      };
    case 'past_time':
      return {
        where: 'time', reloadSlots: true,
        text: { ru: 'Это время уже прошло — выбери другое.', en: 'That time has already passed — pick another.' },
      };
    case 'too_far':
      return {
        where: 'time',
        text: { ru: 'Так далеко запись пока не открыта — выбери дату поближе.', en: 'Booking isn’t open that far ahead — pick an earlier date.' },
      };
    case 'bad_time':
    case 'staff_mismatch':
      return {
        where: 'time', reloadSlots: true,
        text: { ru: 'Расписание изменилось — выбери время заново.', en: 'The schedule changed — pick the time again.' },
      };
    case 'no_staff':
      return {
        where: 'submit',
        text: { ru: 'Эту процедуру сейчас некому провести — напиши Анжелике.', en: 'No one can do this treatment right now — message Anjelika.' },
      };
    case 'unknown_service':
    case 'incomplete_service':
      return {
        where: 'submit',
        text: { ru: 'Одна из процедур сейчас недоступна для записи онлайн — убери её или напиши Анжелике.', en: 'One of the treatments can’t be booked online right now — remove it or message Anjelika.' },
      };
    case 'mixed_currency':
      return {
        where: 'submit',
        text: { ru: 'Эти процедуры нельзя записать одним визитом — отправь заявки отдельно.', en: 'These treatments can’t be booked as one visit — send separate requests.' },
      };
    case 'empty_visit':
    case 'too_many':
    case 'bad_slugs':
      return {
        where: 'submit',
        text: { ru: 'В одном визите — от одной до шести процедур.', en: 'One visit holds one to six treatments.' },
      };
    case 'too_many_pending':
      /* Х9: у клиентки уже три заявки ждут ответа салона — четвёртую сервер
         не заводит. Число и что делать называет сервер: его слова и
         показываем у кнопки (решение John, волна 4). Повтор не поможет,
         пока салон не ответит, — ключ новый: после ответа или отмены это
         уже новое намерение. У сервера слова только русские. */
      return {
        where: 'submit',
        text: {
          ru: serverMessage(e) ?? 'Уже несколько заявок ждут ответа салона — дождись ответа или отмени одну из них.',
          en: 'Your earlier requests are still waiting for the salon’s reply — wait for an answer or cancel one of them.',
        },
      };
    case 'idempotency_in_progress':
      return {
        where: 'submit', keepKey: true,
        text: { ru: 'Заявка ещё отправляется — подожди пару секунд и проверь кабинет.', en: 'The request is still being sent — wait a moment and check your account.' },
      };
    case 'rate_limited': {
      const min = e.retryAfterSec ? Math.max(1, Math.ceil(e.retryAfterSec / 60)) : null;
      return {
        where: 'submit', keepKey: true,
        text: min
          ? { ru: `Слишком много заявок подряд — попробуй через ${min} мин.`, en: `Too many requests in a row — try again in ${min} min.` }
          : { ru: 'Слишком много заявок подряд — попробуй чуть позже.', en: 'Too many requests in a row — try again a bit later.' },
      };
    }
    case 'network':
    case 'timeout':
      return {
        where: 'submit', keepKey: true,
        text: { ru: 'Нет связи — заявка не отправлена. Проверь интернет и нажми ещё раз.', en: 'No connection — the request wasn’t sent. Check your internet and tap again.' },
      };
    default:
      if (e.status >= 500) {
        return {
          where: 'submit', keepKey: true,
          text: { ru: 'Сервер не принял заявку — попробуй ещё раз чуть позже.', en: 'The server didn’t accept the request — try again a bit later.' },
        };
      }
      return {
        where: 'submit',
        text: { ru: 'Заявка не отправлена — попробуй ещё раз или напиши Анжелике.', en: 'The request wasn’t sent — try again or message Anjelika.' },
      };
  }
}

/** Ошибка контактов — показывается у полей и останавливает отправку. */
class FieldError extends Error {
  constructor(readonly where: Where, readonly text: Msg) {
    super(text.ru);
  }
}

interface SlotsView {
  status: 'idle' | 'loading' | 'ready' | 'error';
  slots: Slot[];
  staffId: number | null;
  error: ApiError | null;
}

export function BookingScreen({
  initialServiceId,
  initialDateISO,
  initialTime,
  onConfirm,
  onChooseService,
  client,
  onClientChange,
}: {
  initialServiceId?: string;
  /** Из напоминания бота: день и время окна, которое предложили */
  initialDateISO?: string;
  initialTime?: string;
  onConfirm: () => void;
  onChooseService: () => void;
  client: ClientProfile;
  onClientChange: (patch: Partial<ClientProfile>) => void;
}) {
  const lang = useLang() as Lang;
  const priceMode = usePriceMode(); // перерисовка при смене валюты показа
  useRate();
  const ru = lang === 'ru';
  const passport = useHealthPassport();
  const session = useSession();
  const { me } = useMe();
  const online = useSyncExternalStore(subscribeOnline, onlineNow, onlineNow);
  const DAYS = ru ? DAYS_RU : DAYS_EN;
  const MON = ru ? MON_RU : MON_EN;

  const catalog = useCatalog();
  /* Записать можно только процедуру с витрины: курсы сервер не записывает
     (422 not_bookable), у них на экране услуги «Написать Анжелике». */
  const live = useMemo(() => catalog.live.filter(isBookable), [catalog.live]);
  const note = catalogNote(catalog);
  const bookableIds = useMemo(() => new Set(live.map((s) => s.id)), [live]);

  const pickedId = initialServiceId;
  // Процедура для записи — только с витрины: скрытую или снятую записать нельзя.
  const serviceId = pickedId && bookableIds.has(pickedId) && isOnShowcase(pickedId) ? pickedId : undefined;
  const fallbackId = !pickedId ? live[0]?.id : undefined;
  const effectiveId = serviceId ?? fallbackId;
  const service = effectiveId ? findService(effectiveId) : undefined;

  /* Дополнительные процедуры того же визита. Анжелика часто делает две-три
     за один приход — это одна заявка, а не несколько. */
  const [extras, setExtras] = useState<string[]>([]);
  /* One currency per visit (K5, B1-B): the server refuses a mixed visit
     (api/_domain/pricing.js priceVisit: `currencies.size > 1` → 422 mixed_currency).
     The same rule here: only procedures in the main one's currency join the visit,
     so the screen neither offers a visit the server won't take nor adds lari to dollars. */
  const visitCurrency = service?.currency;
  const joinable = useMemo(() => live.filter((x) => x.currency === visitCurrency), [live, visitCurrency]);
  const extrasLive = extras.filter((id) => bookableIds.has(id) && id !== effectiveId && findService(id)?.currency === visitCurrency);
  const [showAll, setShowAll] = useState(false);

  // Даты — по поясу салона; пояс сервер называет в ответе /slots.
  const [tz, setTz] = useState(salonTz);
  const dates = useMemo(() => {
    void tz;
    const today = salonToday();
    return Array.from({ length: DAYS_AHEAD }, (_, i) => addDaysISO(today, i));
  }, [tz]);
  const [dateISO, setDateISO] = useState<string>(() => (initialDateISO && dates.includes(initialDateISO) ? initialDateISO : dates[0]));
  // Окно из напоминания: выбрать его, когда сервер подтвердит, что оно ещё свободно
  const presetTime = useRef(initialDateISO && dates.includes(initialDateISO) ? initialTime ?? null : null);
  const [slot, setSlot] = useState<Slot | null>(null);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<Where, Msg>>>({});
  const [reloadTick, setReloadTick] = useState(0);
  const [slotsView, setSlotsView] = useState<SlotsView>({ status: 'idle', slots: [], staffId: null, error: null });

  /** Ключ идемпотентности — один на намерение: тот же состав, время и комментарий. */
  const keyRef = useRef<{ sig: string; key: string } | null>(null);

  const slugs = useMemo(() => (effectiveId ? [effectiveId, ...extrasLive] : []), [effectiveId, extrasLive.join(',')]); // eslint-disable-line react-hooks/exhaustive-deps
  const slugsKey = slugs.join(',');
  const guest = session.status === 'guest';

  // Свободное время: на каждый день и состав визита — свой запрос. Прежний
  // запрос рвётся (выбрали другой день раньше, чем пришёл ответ).
  useEffect(() => {
    if (!slugsKey || guest) {
      setSlotsView({ status: 'idle', slots: [], staffId: null, error: null });
      return;
    }
    const ctrl = new AbortController();
    let alive = true;
    setSlotsView({ status: 'loading', slots: [], staffId: null, error: null });
    getSlots(dateISO, slugsKey.split(','), { signal: ctrl.signal }).then(
      (r) => {
        if (!alive) return;
        setSalonTimeZone(r.timezone);
        setTz(salonTz());
        const slots = Array.isArray(r.slots) ? r.slots.filter((s) => s && typeof s.time === 'string' && typeof s.starts_at === 'string') : [];
        setSlotsView({ status: 'ready', slots, staffId: typeof r.staff_id === 'number' ? r.staff_id : null, error: null });
      },
      (e: unknown) => {
        if (!alive || isAbortError(e)) return;
        const error = e instanceof ApiError ? e : new ApiError(0, 'bad_response', 'GET /slots');
        setSlotsView({ status: 'error', slots: [], staffId: null, error });
      },
    );
    return () => {
      alive = false;
      ctrl.abort();
    };
  }, [dateISO, slugsKey, guest, reloadTick]);

  useEffect(() => {
    if (!presetTime.current || slotsView.status !== 'ready') return;
    const hit = slotsView.slots.find((x) => x.time === presetTime.current);
    presetTime.current = null;
    if (hit) setSlot(hit);
  }, [slotsView]);

  // Выбранное время живёт только пока оно есть в ответе сервера.
  useEffect(() => {
    if (slot && !slotsView.slots.some((s) => s.starts_at === slot.starts_at)) setSlot(null);
  }, [slotsView, slot]);

  const chosen = service ? [service, ...extrasLive.map((id) => findService(id)).filter((x): x is NonNullable<typeof x> => !!x)] : [];
  // Booked rows are showcase procedures — they always have minutes (lib/showable.ts).
  const totalMin = chosen.reduce((n, x) => n + (x.duration ?? 0), 0);
  /* Visit total for display: the sum in the visit's one currency, "from" if any part is
     (lib/money.ts visitTotal). The booked total is the server's — Booking.total_minor,
     shown on the confirmation; the number for anything functional is priceMinor. */
  const total = visitTotal(chosen.map(priceSourceOf));
  const rewards = useRewards();
  const price = total ? displayPrice(total, lang) : null;
  const totalFrom = total?.priceFrom === true;
  /* K11 Б2 (the lawyer): the visit summary names the payment currency once. No second price
     here — the sum to pay is the main currency only, so the note says only that (K13, H-5:
     "dollar prices are approximate" pointed at dollars this screen does not show). Only a
     lari visit. */
  const payNote = visitCurrency === 'GEL' ? PAY_NOTE[lang] : null;

  /* Подсказки пересчитываются от ВСЕГО набора: добавили чистку — пилинг
     сразу уезжает вниз с пометкой «лучше в разные дни» */
  const suggestions = useMemo(
    () => (effectiveId ? suggestionsFor([effectiveId, ...extrasLive], joinable) : []),
    [effectiveId, extrasLive.join(','), joinable], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const toggleExtra = (id: string) => {
    select();
    setErrors({});
    setExtras((x) => (x.includes(id) ? x.filter((i) => i !== id) : [...x, id]));
  };

  const contraHits = service ? matchContraindications(passport, service.contraindications) : [];
  const deviceTz = (() => {
    try { return Intl.DateTimeFormat().resolvedOptions().timeZone; } catch { return ''; }
  })();

  const showMaster = () =>
    openSheet({
      title: 'Анжелика',
      subtitle: ru ? 'Врач-косметолог · Батуми' : 'Medical cosmetologist · Batumi',
      body: (
        <>
          <LiveAnjelika
            alt=""
            style={{ width: 96, height: 96, borderRadius: '50%', objectFit: 'cover', margin: '0 auto 14px', display: 'block', border: '2px solid var(--border-strong)' }}
          />
          <ul className="info-list">
            <li>{studioAddress(lang)}</li>
            <li>{ru ? 'Свободное время на экране — из расписания салона' : 'Free times on screen come from the salon’s schedule'}</li>
            <li>{ru ? 'Заявку подтверждает Анжелика' : 'Anjelika confirms your request'}</li>
          </ul>
        </>
      ),
    });

  /** Контакты из формы — в профиль (PATCH /me): так мастер узнает человека. */
  async function saveContacts() {
    const patch: MePatch = {};
    const name = client.name.trim();
    const ig = client.instagram.trim().replace(/^@/, '');
    if (name && name !== (me?.first_name ?? '')) patch.first_name = name;
    if (ig && ig !== (me?.instagram ?? '').replace(/^@/, '')) patch.instagram = ig;
    if (Object.keys(patch).length === 0) return;
    try {
      const next = await updateMe(patch);
      // Ответ PATCH /me — {user} (решение John); не разобрали — перечитать профиль.
      if (!next) void refreshMe();
    } catch (e) {
      if (!(e instanceof ApiError)) throw e;
      if (e.code === 'bad_instagram') {
        throw new FieldError('contact', {
          ru: 'Инстаграм не похож на ник: только латиница, цифры, точка и подчёркивание.',
          en: 'That doesn’t look like an Instagram handle: letters, digits, dot and underscore only.',
        });
      }
      if (e.code === 'bad_name') {
        throw new FieldError('contact', { ru: 'Имя — от 1 до 64 символов.', en: 'Name must be 1–64 characters.' });
      }
      if (e.isNetwork) throw e;
      // Контакты не сохранились по другой причине — заявку это не блокирует,
      // но человек должен знать, что мастер может его не узнать.
      toast(ru ? 'Контакты не сохранились — заявка всё равно уйдёт' : 'Contacts weren’t saved — the request will still be sent', 'info');
    }
  }

  const submit = async () => {
    if (submitting || !service) return;
    if (!slot) {
      setErrors({ time: { ru: 'Выбери время из списка.', en: 'Pick a time from the list.' } });
      return;
    }
    if (guest) {
      setErrors({ submit: GUEST_TEXT[session.reason ?? 'outside_telegram'] });
      return;
    }
    if (!online) {
      setErrors({ submit: OFFLINE_TEXT });
      return;
    }
    setSubmitting(true);
    setErrors({});
    const noteText = comment.trim() || null;
    const sig = JSON.stringify([slugs, slot.starts_at, noteText]);
    if (!keyRef.current || keyRef.current.sig !== sig) keyRef.current = { sig, key: newIdempotencyKey() };
    try {
      await saveContacts();
      await requestBooking(
        { slugs, starts_at: slot.starts_at, staff_id: slotsView.staffId ?? undefined, note: noteText },
        keyRef.current.key,
      );
      keyRef.current = null;
      setSubmitting(false);
      onConfirm();
    } catch (e) {
      setSubmitting(false);
      if (e instanceof FieldError) {
        setErrors({ [e.where]: e.text });
        return;
      }
      if (e instanceof ApiError && e.code === 'no_session') {
        setErrors({ submit: GUEST_TEXT[session.reason ?? 'refused'] });
        return;
      }
      const err = e instanceof ApiError ? e : new ApiError(0, 'network', 'POST /bookings');
      const r = bookingErrorText(err);
      if (!r.keepKey) keyRef.current = null;
      setErrors({ [r.where]: r.text });
      if (r.reloadSlots) {
        setSlot(null);
        setReloadTick((x) => x + 1);
      }
    }
  };

  if (!service && pickedId && (catalog.status === 'idle' || catalog.status === 'loading')) {
    // Процедуры нет в запасном списке — ждём каталог с сервера, а не пугаем «недоступна».
    return (
      <div className="screen">
        <section className="section">
          <div className="card" style={{ padding: 20, textAlign: 'center' }} data-testid="booking-loading">
            <div className="muted">{ru ? 'Загружаю каталог…' : 'Loading the catalog…'}</div>
          </div>
        </section>
      </div>
    );
  }

  /* Сюда пришли с курсом (подсказка ИИ, разбор): курс онлайн не
     записывается — честно сказать и дать написать Анжелике. */
  const pickedCourse = pickedId ? catalog.live.find((x) => x.id === pickedId && !isBookable(x)) : undefined;

  if (!service) {
    return (
      <div className="screen">
        <header className="header">
          <div className="header-lede">
            <div className="eyebrow">{t('booking.eyebrow', lang)}</div>
            <div className="header-title">{t('booking.title', lang)}</div>
          </div>
        </header>
        <section className="section">
          <div className="card" style={{ padding: 20, textAlign: 'center' }} data-testid="booking-unavailable">
            <div className="muted">
              {pickedCourse
                ? (ru ? 'Курс не записывается онлайн — сроки и группу Анжелика обсуждает лично.' : 'Courses aren’t booked online — Anjelika arranges dates and groups personally.')
                : pickedId
                  ? (ru ? 'Эта процедура сейчас недоступна для записи онлайн.' : 'This treatment can’t be booked online right now.')
                  : (ru ? 'На витрине пока нет процедур для записи.' : 'There are no treatments to book yet.')}
            </div>
            {pickedCourse ? (
              <button
                className="btn btn-primary btn-sm mt"
                data-testid="course-write"
                onClick={() => openTelegram(telegramUrl(ru
                  ? `Здравствуйте! Хочу на курс «${sTitle(pickedCourse, lang)}»`
                  : `Hi! I’d like to join the course “${sTitle(pickedCourse, lang)}”`))}
              >
                {ru ? 'Написать Анжелике' : 'Message Anjelika'}
              </button>
            ) : (
              <button className="btn btn-primary btn-sm mt" onClick={onChooseService}>
                {ru ? 'Открыть каталог' : 'Open the catalog'}
              </button>
            )}
          </div>
        </section>
      </div>
    );
  }

  const dayInfo = isoWeekday(dateISO);
  const slotsBlockedText: Msg | null = guest ? GUEST_TEXT[session.reason ?? 'outside_telegram'] : null;
  const ctaLabel = submitting
    ? (ru ? 'Отправляю…' : 'Sending…')
    : !online
      ? (ru ? 'Нет связи — заявка не уйдёт' : 'Offline — can’t send')
      : slot
        ? `${ru ? 'Отправить заявку' : 'Send request'} · ${slot.time}`
        : (ru ? 'Выбери время' : 'Pick a time');

  return (
    <>
      <div className="screen has-cta">
        <header className="header">
          <div className="header-lede">
            <div className="eyebrow">{t('booking.eyebrow', lang)}</div>
            <div className="header-title">{t('booking.title', lang)}</div>
          </div>
        </header>

        <div className="booking-stepper">
          <button
            className="step done"
            onClick={onChooseService}
            style={{ background: 'none', border: 0, padding: 0, color: 'inherit', cursor: 'pointer' }}
          >
            <span className="step-dot"><Icon name="check" size={11} strokeWidth={2.6} /></span>
            <span>{t('booking.step.service', lang)}</span>
          </button>
          <div className="sep" />
          <div className="step active">
            <span className="step-dot">2</span>
            <span>{t('booking.step.date', lang)}</span>
          </div>
          <div className="sep" />
          <div className="step">
            <span className="step-dot">3</span>
            <span>{ru ? 'заявка' : 'request'}</span>
          </div>
        </div>

        {note && (
          <p className="faint" data-testid="catalog-note" style={{ fontSize: 12, padding: '10px 20px 0' }}>{note[lang]}</p>
        )}

        {/* Мастер — строкой в теле, а не чипом в шапке: в шапке он наезжал
            на переключатели валюты и языка (кадр Роча 15.10) */}
        <section style={{ padding: '14px 20px 0' }}>
          <button className="bk-master" onClick={showMaster} aria-label={ru ? 'О мастере' : 'About the master'}>
            <img src={asset('photos/anjelika.webp')} alt="" className="bk-master-ph" />
            <span className="bk-master-body">
              <span className="bk-master-k">{ru ? 'Ведёт приём' : 'Your specialist'}</span>
              <b>{ru ? 'Анжелика · врач-косметолог' : 'Anjelika · medical cosmetologist'}</b>
            </span>
            <Icon name="chevron-right" size={16} strokeWidth={2.2} className="bk-master-go" />
          </button>
          <div className="eyebrow mb-sm">{t('booking.chosen', lang)}</div>
          <button
            onClick={onChooseService}
            className="card service-card"
            style={{ marginBottom: 4, width: '100%', cursor: 'pointer', textAlign: 'left' }}
          >
            <div
              className={`service-image${servicePhoto(service.id) ? '' : ' service-image--blank'}`}
              style={servicePhoto(service.id) ? { backgroundImage: `url(${servicePhoto(service.id)})` } : undefined}
            >
              {/* Значок поверх снимка убран (как в каталоге): иконка остаётся
                  только там, где фотографии нет. */}
              {!servicePhoto(service.id) && <Icon name={service.icon} size={30} strokeWidth={1.5} className="service-image-glyph" />}
            </div>
            <div className="service-body">
              <h3 className="service-title">{sTitle(service, lang)}</h3>
              <p className="service-desc">{sShort(service, lang)}</p>
              <div className="service-meta">
                {/* The procedure's own price, as on its catalog card; the visit total is below */}
                <span className="service-price">{servicePrice(service, lang)}</span>
                {service.duration != null && <span className="faint" style={{ fontSize: 12 }}>· {service.duration} {t('common.min', lang)}</span>}
              </div>
            </div>
            <span style={{ position: 'absolute', top: '50%', right: 14, transform: 'translateY(-50%)', color: 'var(--tl)', fontSize: 18 }}>›</span>
          </button>
          {/* Добавленные к визиту — списком, а не чипами: их надо видеть
              целиком. Снимаются жестом — потянуть строку влево (решение
              Роча 15.10: «×» на каждой строке убран, как и в кабинете). */}
          {extrasLive.length > 0 && (
            <div className="bk-extras">
              {extrasLive.map((id) => {
                const x = findService(id);
                if (!x) return null;
                return (
                  <SwipeRow key={id} label={ru ? 'Убрать' : 'Remove'} instant onCommit={() => toggleExtra(id)}>
                  <div className="bk-extra">
                    {/* Снимок процедуры, а не её иконка: человек выбрал
                        процедуру по фотографии в каталоге и узнаёт её
                        здесь по тому же кадру. Иконка остаётся только
                        там, где снимка нет. */}
                    {servicePhoto(x.id)
                      ? <span className="bk-extra-shot" style={{ backgroundImage: `url(${servicePhoto(x.id)})` }} aria-hidden />
                      : <Icon name={x.icon} size={15} strokeWidth={1.9} />}
                    {/* Название и цена в одной строке не помещались и
                        обрезались многоточием на самом нужном слове.
                        Теперь цена идёт ПОД названием, а длинное название
                        не прячется, а ездит (PingPong). */}
                    <span className="bk-extra-body">
                      <PingPong className="bk-extra-title">{sTitle(x, lang)}</PingPong>
                      <span className="bk-extra-meta">{x.duration != null && <>+{x.duration} {t('common.min', lang)} · </>}{servicePrice(x, lang)}</span>
                    </span>
                  </div>
                  </SwipeRow>
                );
              })}
              <div className="bk-extra-total" data-testid="visit-total">
                {ru ? 'Визит целиком' : 'Whole visit'} · {totalMin} {t('common.min', lang)}{price !== null && <> · {price}</>}
              </div>
            </div>
          )}

          {/* Бегущая лента чипов не годится для выбора: она уезжает
              раньше, чем человек дочитал название. Здесь он принимает
              решение, а не любуется движением. */}
          <div className="eyebrow sub-head">
            {ru ? 'добавить к этому визиту' : 'add to this visit'}
          </div>
          {/* K13 (H-4; the lawyer): one line over the list instead of the prototype's verdicts —
              it covers every pair, including those that carry no text */}
          {suggestions.length > 0 && (
            <p className="faint" data-testid="combo-note" style={{ fontSize: 12, margin: '0 0 8px' }}>
              {ru ? 'Что с чем сочетается, подтвердит Анжелика.' : 'Anjelika will confirm what goes together.'}
            </p>
          )}
          <div className="bk-suggest">
            {suggestions.slice(0, showAll ? undefined : 4).map(({ service: x, verdict }) => (
              <button
                key={x.id}
                className={`bk-sug bk-sug--${verdict.kind}`}
                onClick={() => toggleExtra(x.id)}
              >
                <span className="bk-sug-icon"><Icon name={x.icon} size={17} strokeWidth={1.8} /></span>
                <span className="bk-sug-body">
                  <span className="bk-sug-title">{sTitle(x, lang)}</span>
                  {verdict.why && <span className="bk-sug-why">{verdict.why[lang]}</span>}
                  <span className="bk-sug-meta">
                    {x.duration != null && <>+{x.duration} {t('common.min', lang)} · </>}{servicePrice(x, lang)}
                  </span>
                </span>
                <span className="bk-sug-add" aria-hidden>
                  <Icon name="plus" size={15} strokeWidth={2.8} />
                </span>
              </button>
            ))}
          </div>

          {suggestions.length > 4 && (
            <button className="btn btn-quiet btn-block bk-more" onClick={() => setShowAll((v) => !v)}>
              {showAll
                ? (ru ? 'Свернуть' : 'Collapse')
                : (ru ? `Показать все — ещё ${suggestions.length - 4}` : `Show all — ${suggestions.length - 4} more`)}
            </button>
          )}
        </section>

        {contraHits.length > 0 && (
          <section style={{ padding: '14px 20px 0' }}>
            <div className="contra-alert">
              <Icon name="warning" size={18} strokeWidth={2} />
              <div>
                <div className="contra-alert-title">
                  {ru
                    ? 'Автоматическая сверка нашла совпадения с анкетой. Окончательно решает Анжелика на приёме'
                    : 'An automatic check found matches with your questionnaire. Anjelika makes the final call at the visit'}
                </div>
                <div className="contra-alert-text">
                  {contraHits.join(' · ')}{ru ? '. Заявку отправить можно — Анжелика посмотрит и решит.' : '. You can still send the request — Anjelika will review and decide.'}
                </div>
              </div>
            </div>
          </section>
        )}

        <section>
          <div className="eyebrow" style={{ padding: '18px 20px 0' }}>{t('booking.pickDay', lang)}</div>
          <div className="date-strip">
            {dates.map((iso) => {
              const d = isoWeekday(iso);
              return (
                <button
                  key={iso}
                  className={`date-pill ${dateISO === iso ? 'active' : ''}`}
                  data-date={iso}
                  onClick={() => {
                    setDateISO(iso);
                    setSlot(null);
                    setErrors({});
                  }}
                >
                  <div className="dow">{DAYS[d.dow]}</div>
                  <div className="day">{d.day}</div>
                  <div className="mon">{MON[d.month]}</div>
                </button>
              );
            })}
          </div>
        </section>

        <section data-testid="slots">
          <div className="eyebrow" style={{ padding: '6px 20px 8px' }}>{t('booking.freeTime', lang)}</div>
          {errors.time && (
            <div className="contra-alert" role="alert" data-testid="time-error" style={{ margin: '0 20px 10px' }}>
              <Icon name="warning" size={18} strokeWidth={2} />
              <div className="contra-alert-text">{errors.time[lang]}</div>
            </div>
          )}
          {slotsBlockedText ? (
            <div className="card" style={{ margin: '0 20px', padding: 18, textAlign: 'center' }} data-testid="slots-blocked">
              <div className="muted">{slotsBlockedText[lang]}</div>
            </div>
          ) : slotsView.status === 'loading' || slotsView.status === 'idle' ? (
            <div className="card" style={{ margin: '0 20px', padding: 18, textAlign: 'center' }} data-testid="slots-loading">
              <div className="muted">{ru ? 'Загружаю свободное время…' : 'Loading free times…'}</div>
            </div>
          ) : slotsView.status === 'error' && slotsView.error ? (
            <div className="card" style={{ margin: '0 20px', padding: 18, textAlign: 'center' }} data-testid="slots-error">
              <div className="muted">{slotsErrorText(slotsView.error)[lang]}</div>
              <button className="btn btn-secondary btn-sm mt" onClick={() => setReloadTick((x) => x + 1)}>
                {ru ? 'Повторить' : 'Retry'}
              </button>
            </div>
          ) : slotsView.slots.length === 0 ? (
            <div className="card" style={{ margin: '0 20px', padding: 18, textAlign: 'center' }} data-testid="slots-empty">
              <div className="muted">
                {ru ? 'На этот день свободного времени нет — выбери другой день.' : 'No free time this day — pick another day.'}
              </div>
            </div>
          ) : (
            <div className="slot-grid">
              {slotsView.slots.map((s) => (
                <button
                  key={s.starts_at}
                  className={`slot ${slot?.starts_at === s.starts_at ? 'active' : ''}`}
                  onClick={() => { select(); setSlot(s); setErrors({}); }}
                  aria-pressed={slot?.starts_at === s.starts_at}
                >
                  {s.time}
                </button>
              ))}
            </div>
          )}
          <div className="faint" style={{ fontSize: 12, padding: '10px 20px 0' }}>
            {ru
              ? 'Показано свободное время по расписанию салона. Заявку подтверждает Анжелика: она ведёт записи ещё и по телефону.'
              : 'Free times follow the salon’s schedule. Anjelika confirms requests — she also books by phone.'}
            {deviceTz && deviceTz !== tz && (
              <> {ru ? `Время — по часовому поясу салона (${tz}).` : `Times are in the salon’s time zone (${tz}).`}</>
            )}
          </div>
        </section>

        <section style={{ padding: '18px 20px 0' }}>
          <div className="eyebrow mb-sm">{ru ? 'как с тобой связаться' : 'how to reach you'}</div>
          {errors.contact && (
            <div className="contra-alert" role="alert" data-testid="contact-error" style={{ marginBottom: 10 }}>
              <Icon name="warning" size={18} strokeWidth={2} />
              <div className="contra-alert-text">{errors.contact[lang]}</div>
            </div>
          )}
          <div className="onb-form">
            <label className="onb-field">
              <span className="onb-label">{ru ? 'имя' : 'name'}</span>
              <input
                className="onb-input"
                type="text"
                value={client.name}
                maxLength={64}
                onChange={(e) => onClientChange({ name: e.target.value })}
                placeholder={ru ? 'Как тебя зовут' : 'Your name'}
              />
            </label>
            <label className="onb-field">
              <span className="onb-label">{ru ? 'инстаграм' : 'instagram'} <span className="faint">· {ru ? 'так Анжелика тебя узнает' : 'how Anjelika recognises you'}</span></span>
              <input
                className="onb-input"
                type="text"
                value={client.instagram}
                maxLength={31}
                onChange={(e) => onClientChange({ instagram: e.target.value.replace(/^@/, '') })}
                placeholder="@nickname"
                autoCapitalize="none"
                autoCorrect="off"
              />
            </label>
            <label className="onb-field">
              <span className="onb-label">{ru ? 'комментарий' : 'comment'} <span className="faint">· {ru ? 'опционально' : 'optional'}</span></span>
              <textarea
                className="review-textarea"
                rows={2}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder={ru ? 'Пожелания по времени' : 'Preferred time'}
                maxLength={1000}
              />
              {/* Комментарий к записи — не медданные: он уходит мастеру и в
                  выгрузку без отдельного согласия. Здоровью место в анкете
                  (Хейтер №7; политика, п. 2.3, просит о том же). */}
              <span className="onb-hint" data-hint="note-health">
                {ru ? 'О здоровье — в анкете' : 'Health details — in the questionnaire'}
              </span>
            </label>
          </div>
        </section>

        <section className="booking-summary">
          <div className="eyebrow mb-sm">{t('booking.details', lang)}</div>
          <div className="summary-row">
            <span className="k">{t('booking.sum.service', lang)}</span>
            {/* Каждая процедура — своей строкой. Склеенные через « + » в одну
                строку названия не помещались в карточку и выходили за её край
                («Контурная пластика + Увеличение гу…»); а перенос по словам
                внутри склейки читался кашей. Столбик решает оба. */}
            <span className="v v-list">
              {chosen.map((x) => <span key={x.id}>{sTitle(x, lang)}</span>)}
            </span>
          </div>
          <div className="summary-row">
            <span className="k">{t('booking.sum.duration', lang)}</span>
            <span className="v">{totalMin} {t('common.min', lang)}</span>
          </div>
          <div className="summary-row">
            <span className="k">{t('booking.sum.date', lang)}</span>
            <span className="v">
              {dayInfo.day} {MON[dayInfo.month].toLowerCase()} · {DAYS[dayInfo.dow]}
            </span>
          </div>
          <div className="summary-row">
            <span className="k">{t('booking.sum.time', lang)}</span>
            <span className="v">{slot?.time ?? '—'}</span>
          </div>
          <div className="summary-row">
            <span className="k">{t('booking.sum.address', lang)}</span>
            <span className="v" style={{ textAlign: 'right', fontSize: 13 }}>{studioAddress(lang)}</span>
          </div>
          {/* Скидка за действия: процент показываем, саму сумму со скидкой считает
              сервер при подтверждении — клиенту в деньгах не верим */}
          {rewards && rewards.percent > 0 && !rewards.used && (
            <div className="summary-row" data-testid="summary-discount">
              <span className="k">{ru ? 'Скидка за действия' : 'Action discount'}</span>
              <span className="v" style={{ color: 'var(--brand-gold-bright)' }}>−{rewards.percent} %</span>
            </div>
          )}
          <div className="summary-row total">
            <span className="k">{t('booking.sum.total', lang)}</span>
            <span className="v" data-testid="summary-total">
              {price ?? '—'}
              {/* T2 ed. 2 §4.2: the caption under a "from" total */}
              {totalFrom && (
                <span className="faint" data-testid="total-from-note" style={{ display: 'block', fontSize: 12, fontWeight: 400 }}>{FROM_NOTE[lang]}</span>
              )}
            </span>
          </div>
        </section>

        {payNote !== null && (
          <p className="faint" data-testid="price-ref-note" data-currency="GEL" style={{ fontSize: 12, padding: '12px 20px 0', textAlign: 'center' }}>{payNote}</p>
        )}

        {/* T2 ed. 2 §4.2 ("Замена BookingScreen.tsx:822"); the "from" sentence only for a "from" visit */}
        <p className="faint" data-testid="booking-footnote" style={{ fontSize: 12, padding: '12px 20px 0', textAlign: 'center' }}>
          {ru
            ? 'Это заявка, а не бронь. Анжелика подтвердит или отклонит её — статус появится в кабинете.'
            : 'This is a request, not a booking. Anjelika will confirm or decline it — the status will appear in your account.'}
          {totalFrom && <> {FROM_FOOTNOTE[lang]}</>}
        </p>

        {errors.submit && (
          <div className="contra-alert" role="alert" data-testid="submit-error" style={{ margin: '12px 20px 0' }}>
            <Icon name="warning" size={18} strokeWidth={2} />
            <div className="contra-alert-text">{errors.submit[lang]}</div>
          </div>
        )}
        {!online && !errors.submit && (
          <p className="faint" data-testid="offline-note" style={{ fontSize: 12, padding: '12px 20px 0', textAlign: 'center' }}>
            {OFFLINE_TEXT[lang]}
          </p>
        )}
      </div>

      <div className="bottom-cta">
        <button
          className="btn btn-primary btn-block"
          data-bottom-cta
          data-testid="booking-submit"
          onClick={() => { void submit(); }}
          disabled={submitting || !online}
        >
          {ctaLabel}
        </button>
      </div>
    </>
  );
}
