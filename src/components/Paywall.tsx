import { retrySession } from '../lib/session';
import { openStarsInfo } from './StarsInfo';
import { PriceDrop } from './PriceDrop';
import { useId, useState } from 'react';
import { Icon } from './Icon';
import { closeSheet, openSheet, toast } from '../lib/ui';
import { notify, tap } from '../lib/haptics';
import { isDemoPay, payWithStars, starsToUsd, usePayAvailability, type PayAvailability } from '../lib/payments';
import { StarPrice } from './StarPrice';
import { BUNDLE, PAID_QUIZZES, type Quiz } from '../data/quizzes';
import { useLang, type Lang } from '../lib/i18n';
import { g as gg, useGender, type Gender } from '../lib/gender';
import { useMe, refreshMe } from '../lib/api';
import { legalVersion } from '../lib/api/me';
import { LegalLink, NOT_A_DIAGNOSIS } from './LegalFooter';

/** Разборы, чей итог уходит в паспорт кожи (QuizRunner → saveQuizToPassport). */
const PASSPORT_QUIZZES: ReadonlySet<string> = new Set(['profile', 'skintype']);

/* Строки оплаты. pay.* — формулировки Законника (16-legal-texts, ui-lines),
   переведённые на «ты», как весь интерфейс; смысл отрицаний не тронут. */
const PAY_COPY = {
  outside: {
    ru: 'Оплата доступна в приложении Telegram. Здесь можно посмотреть, что входит в разбор.',
    en: 'Payment is available in the Telegram app. Here you can see what the analysis includes.',
  },
  disabled: {
    ru: 'Оплата разборов звёздами скоро появится.',
    en: 'Paying for analyses with Stars is coming soon.',
  },
  checking: { ru: 'Проверяю, доступна ли оплата…', en: 'Checking whether payment is available…' },
  noSession: {
    ru: 'Не удалось войти — оплата сейчас недоступна. Открой приложение заново.',
    en: 'Could not sign in — payment is unavailable right now. Reopen the app.',
  },
  opening: { ru: 'Открываю оплату…', en: 'Opening payment…' },
  pending: {
    ru: 'Ждём подтверждения оплаты от Telegram. Обычно это меньше минуты.',
    en: 'Waiting for Telegram to confirm the payment. Usually under a minute.',
  },
  pendingTimeout: {
    ru: 'Оплата ещё не подтвердилась. Если звёзды списались, доступ откроется позже или мы их вернём. Помощь: /paysupport в боте.',
    en: 'Payment not confirmed yet. If Stars were charged, access will open later or we’ll refund them. Help: /paysupport in the bot.',
  },
  already: { ru: 'Этот разбор уже куплен — открываю', en: 'Already purchased — opening' },
  /* 409 already_purchased на набор: все его разборы уже куплены — по
     отдельности или прежним набором. Доступ открыт по covers покупок. */
  alreadyBundle: { ru: 'Все разборы набора уже куплены — открываю', en: 'All analyses in the set are already yours — opening' },
  /* Согласие на немедленный доступ — отдельная строка у кнопки, в галочку не
     сливается (Законник, волна 4, п.5). */
  consent: {
    ru: 'Оплачивая, ты соглашаешься, что доступ откроется сразу. Возврат — по',
    en: 'By paying, you agree that access opens immediately. Refunds per the',
  },
  /* Галочка перед оплатой (Законник, волна 4, п.5; решение владельца 28.09
     «да»): прочитала условия и согласна — отдельным действием ДО покупки, как
     велят правила Stars; 18+ — внутри неё. Прежней строки «Оплачивая,
     подтверждаю, что мне исполнилось 18 лет» больше нет: заявление
     переехало в галочку. Сама строка галочки зависит от рода — tickText(). */
  termsLink: { ru: 'Текст условий покупки', en: 'Read the purchase terms' },
  tickFirst: { ru: 'Чтобы оплатить, отметь галочку выше.', en: 'To pay, tick the box above.' },
  /* 409 terms_not_accepted. По-русски на экране — слова сервера (serverMessage:
     владелец текста — сервер, договор волны 5 велит показать их у кнопки);
     здесь они же дословно — на случай конверта без message. По-английски у
     сервера слов нет — своя строка по коду. */
  termsRefused: {
    ru: 'Перед оплатой прочитай и прими условия покупки',
    en: 'Before paying, read and accept the purchase terms',
  },
  /* Тот же 409, а перечитанный профиль назвал ДРУГУЮ редакцию, чем ушла в
     счёте: условия сменились, пока шторка была открыта. Здесь — не слова
     сервера, а своя строка (Катя; решение John, волна 5, круг 2). */
  termsUpdated: {
    ru: 'Условия покупки обновились. Открой «Текст условий покупки» выше и отметь галочку заново.',
    en: 'The purchase terms have been updated. Open “Read the purchase terms” above and tick the box again.',
  },
  /* Набор: сервер сказал «уже куплено», а перечитать покупки не удалось.
     Ошибка, а не «ничего не куплено» (слова — как у экрана ANZH). Повторное
     нажатие снова спросит сервер и снова перечитает покупки. */
  checkFailed: {
    ru: 'Не удалось проверить покупки. Попробуй ещё раз.',
    en: 'Could not check your purchases. Try again.',
  },
} as const;

/* Набор тому, у кого он уже есть, не продаётся (решение владельца 28.09, «б»;
   сервер: первый пункт alreadyOwns). Строки — вместо цены, кнопки и апселла
   набора (решение John, волна 5, круг 2). */

/** Карточка и шторка набора, путь через 409 — Законник (не ломается, если добавят два разбора). */
export const BUNDLE_OWNED = {
  ru: 'Этот набор у тебя уже есть — разборы, добавленные в него позже, в твою покупку не входят. Их можно купить отдельно.',
  en: "You already have this set — analyses added to it later aren't part of your purchase. You can buy them separately.",
} as const;

/** Пейвол разбора, которого нет в купленном наборе, — вместо апселла набора (Катя). */
export const NOT_IN_YOUR_SET = {
  ru: 'Этот разбор не входил в твой набор — он продаётся отдельно.',
  en: "This analysis wasn't part of your set — it's sold separately.",
} as const;

/** Галочка перед оплатой — дословно Законник п.5; русская — по роду. */
function tickText(lang: Lang, gender: Gender): string {
  return lang === 'ru'
    ? `${gg('Прочитала', 'Прочитал', gender)} Условия покупки и ${gg('согласна', 'согласен', gender)} с ними. Мне исполнилось 18 лет.`
    : 'I have read and agree to the Purchase terms. I am 18 or older.';
}

// Три момента покупки, которых раньше не было ни одного.
//
//  1. Paywall. Была строчка «оплата звёздами» и кнопка. Человек не понимал,
//     что именно он покупает и почему это стоит денег, — а решение о платеже
//     принимается ровно здесь.
//  2. Успешная оплата. Был тост, который живёт две секунды и исчезает вместе
//     с единственным подтверждением, что деньги дошли. За цифровой товар,
//     который нельзя потрогать, чек обязан быть виден.
//  3. Вручение результата. Разбор открывался молча, как следующий экран.
//
// Все три — один и тот же закон: платное действие должно иметь начало,
// подтверждение и вручение. Без среднего звена оплата ощущается как потеря
// денег, без последнего — как покупка без товара.

/* ── 1. Paywall ─────────────────────────────────────────── */

/* Скидки на разборы за подписку и задания здесь больше нет: цена на
   экране обязана совпасть со счётом, а счёт выставляет сервер по прайсу.
   Задания и скидки за них на запуск скрыты (решение John 24.09). */
interface PaywallProps {
  quiz: Quiz;
  price: number;
  bundlePrice: number;
  onBought: () => void;
  onOpenBundle: () => void;
  /**
   * Набор уже куплен (`owns(purchases, BUNDLE.id)` — первый пункт серверного
   * alreadyOwns). Пейвол у такого человека стоит только у разбора, которого в
   * его наборе нет: апселла набора здесь нет — сервер его не продаст, круг
   * «купи отдельно → купи набор» замкнулся бы. Вместо него — строка.
   */
  ownsBundle?: boolean;
  /** Открыть главой в подарок (за процедуры и подруг) — блок над ценой */
  chapter?: React.ReactNode;
  /** Кнопка оплаты — в подвале шторки (PaywallBuy в actions), здесь только юр. строка */
  buyInFooter?: boolean;
}

export function Paywall({
  quiz, price, bundlePrice, onBought, onOpenBundle, ownsBundle = false, chapter, buyInFooter = false,
}: PaywallProps) {
  const lang = useLang();
  const ru = lang === 'ru';
  const { me } = useMe();
  const avail = usePayAvailability();
  const singleTotal = PAID_QUIZZES.reduce((s, q) => s + q.stars, 0);
  const save = Math.max(0, singleTotal - bundlePrice);

  return (
    <>
      <div className="pw-hero">
        <div className="pw-hero-badge"><Icon name={quiz.icon} size={26} strokeWidth={1.7} /></div>
        <div className="pw-hero-meta">
          <div className="pw-hero-eyebrow">{ru ? 'платный разбор' : 'paid analysis'}</div>
          <div className="pw-hero-title">{ru ? quiz.title : quiz.titleEn ?? quiz.title}</div>
        </div>
      </div>

      <p className="pw-lede">{ru ? quiz.tagline : quiz.taglineEn ?? quiz.tagline}.</p>

      <QuizValue quiz={quiz} />

      {chapter}

      {/* Карточки «Этот разбор · цена» больше нет: цена, время и запуск —
          одна кнопка «Начать разбор» в доке внизу (Роч 15.10: «по сути это
          кнопка оплаты и старта теста»). */}

      {ownsBundle ? (
        <p className="stars-note" role="status" data-not-in-set>
          <Icon name="info" size={14} strokeWidth={2} />
          <span>{NOT_IN_YOUR_SET[ru ? 'ru' : 'en']}</span>
        </p>
      ) : save > 0 && (
        /* Оффер пакета — продающий, а не строка списка (Роч 15.10):
           золотая рамка с бегущим бликом, скидка бейджем, старая цена
           зачёркнута рядом с новой, стрелка — в золотом круге. Движение
           одно и медленное (блик раз в 3,6 с), reduced-motion — статично. */
        <button className="pw-bundle pw-offer" onClick={onOpenBundle}>
          <div className="pw-bundle-text">
            <div className="pw-offer-eyebrow">{ru ? 'выгоднее всего' : 'best value'}</div>
            <div className="pw-bundle-title">{ru ? 'Все 6 разборов сразу' : 'All 6 analyses at once'}</div>
            <div className="pw-bundle-sub">
              {ru ? `Экономия ${save}★ · весь паспорт кожи` : `Save ${save}★ · the full skin passport`}
            </div>
          </div>
          <PriceDrop oldStars={bundlePrice + save} newStars={bundlePrice} className="pw-offer-pd" />
        </button>
      )}

      {/* Браузерной «оплаты понарошку» больше нет: вне Telegram и при
          выключенном флаге кнопка не рисуется вовсе, вместо неё — честная
          строка (BuyButton) */}
      {avail === 'ready' && (
        <div className="stars-note pw-note">
          <Icon name="star" size={14} strokeWidth={2} fill="current" />
          <span>
            {ru
              ? 'Оплата звёздами Telegram — без карты и перехода на сайт.'
              : 'Pay with Telegram Stars — no card, no leaving the app.'}
          </span>
        </div>
      )}

      {buyInFooter
        ? <PurchaseTerms lang={lang} termsVersion={legalVersion(me, 'terms')} />
        : <PaywallBuy quiz={quiz} price={price} onBought={onBought} />}
    </>
  );
}

/** Запуск разбора = оплата: «Начать разбор · цена». В подвал шторки — `footer`. */
export function PaywallBuy({ quiz, price, onBought, footer = false }: { quiz: Quiz; price: number; onBought: () => void; footer?: boolean }) {
  const ru = useLang() === 'ru';
  return (
    <BuyButton
      id={quiz.id}
      title={ru ? quiz.title : quiz.titleEn ?? quiz.title}
      stars={price}
      unlocks={ru ? quiz.title : quiz.titleEn ?? quiz.title}
      onOpen={onBought}
      cta={{ ru: 'Начать разбор', en: 'Start the analysis' }}
      meta={ru ? `${quiz.questions.length} вопросов · ~${quiz.minutes} мин` : `${quiz.questions.length} questions · ~${quiz.minutes} min`}
      footer={footer}
    />
  );
}

/** Юр. строка покупки — у кнопки или, когда кнопка в подвале, в конце описания */
export { PurchaseTerms };

/* ── 2. Кнопка оплаты + чек ─────────────────────────────── */

interface BuyButtonProps {
  id: string;
  title: string;
  stars: number;
  /** Что открылось — показывается в чеке */
  unlocks: string;
  onOpen: () => void;
  /** Что делает кнопка, словами: «Начать разбор» — оплата и старт одним нажатием */
  cta?: { ru: string; en: string };
  /** Строка под кнопкой: сколько вопросов и минут */
  meta?: string;
  /** В подвале шторки (actions): компактно — строка галочки, кнопка, одна
      строка под ней. Юр. строка тогда стоит в теле шторки (PurchaseTerms). */
  footer?: boolean;
}

/**
 * Строка под кнопкой: что случилось и что делать. `kind` — для смоуков
 * (data-pay-note). У отказа по условиям — ещё и редакция, ушедшая в счёте:
 * разошлась с перечитанной Me.legal.terms — на экране «условия обновились».
 */
type BuyNote =
  | { kind: 'unconfirmed' | 'bundle-owned' | 'check-failed'; text: string }
  | { kind: 'terms'; text: string; sent: string | null };

/* 'invoice' — счёт выписывается и окно Telegram открыто;
   'confirming' — Telegram сказал «оплачено», ждём, пока покупку
   подтвердит сервер (доступ даёт только он, до 30 с). */
type Phase = 'idle' | 'invoice' | 'confirming';

/* Условия и оговорка живут ВНУТРИ кнопки покупки, а не в пейволе: кнопка
   стоит в двух местах (разбор и набор), и строка «не диагноз» обязана
   доехать до каждого пути, где берут деньги. Галочка условий — там же и по
   той же причине (Законник п.5: «внутри BuyButton»). */
export function BuyButton({ id, stars, unlocks, onOpen, cta, meta, footer = false }: BuyButtonProps) {
  const lang = useLang();
  const ru = lang === 'ru';
  const avail = usePayAvailability();
  const { me } = useMe();
  /* Текущая редакция Условий покупки — ровно Me.legal.terms: сервер отдаёт её
     из того же реестра, по которому сверяет счёт (consents.js legalVersions,
     payments.js assertTermsAccepted). Её же несут обе ссылки на Условия (?v=):
     после смены редакции открывается новый текст, а не копия из кэша WebView. */
  const termsVersion = legalVersion(me, 'terms');
  /* Состояние оплаты — здесь, в кнопке, которая стоит, пока открыта шторка
     (как до волны 5), а не в ReadyBuy: перевход после 401 посреди оплаты
     переводит сессию в 'pending', доступность — в 'checking'
     (session.ts forgetToken), и прежде это стирало «Ждём подтверждения»,
     строку отказа и заслон второго счёта (Хейтер 4 = Цензор 1, круг 2). */
  const [phase, setPhase] = useState<Phase>('idle');
  const [note, setNote] = useState<BuyNote | null>(null);

  /** Нажатие «Оплатить» при отметке, поставленной на редакцию `version`. */
  const buy = async (version: string | null, dropTick: () => void) => {
    if (phase !== 'idle') return; // второе нажатие во время оплаты — не второй счёт
    tap('medium');
    setNote(null);
    setPhase('invoice');
    const status = await payWithStars(id, {
      termsVersion: version,
      bundleIncludes: id === BUNDLE.id ? BUNDLE.includes : undefined,
      onConfirming: () => setPhase('confirming'),
      onTermsRefused: (serverText) => {
        // Сразу, до перечитывания профиля: занятость снята (рядом с отказом нет
        // «Открываю оплату…»), отметка на отвергнутую редакцию снята, слова
        // отказа — у кнопки. Порядок стережёт смоук «409: сначала отказ».
        setPhase('idle');
        dropTick();
        setNote({
          kind: 'terms',
          sent: version,
          text: ru ? serverText ?? PAY_COPY.termsRefused.ru : PAY_COPY.termsRefused.en,
        });
      },
    });
    setPhase('idle');

    if (status === 'already') {
      // Сервер уже знает о покупке — открываем то, что куплено
      toast((id === BUNDLE.id ? PAY_COPY.alreadyBundle : PAY_COPY.already)[lang], 'success');
      closeSheet();
      setTimeout(onOpen, 220);
      return;
    }
    if (status === 'already_partial') {
      // Набор куплен раньше, его состав с тех пор вырос: шторка остаётся,
      // строка — у кнопки (тост живёт 2,6 с, а здесь две фразы). Обычно сюда
      // не доходит — у купленного набора кнопки нет (AnzhScreen); путь
      // запасной, когда список покупок ещё не знал о наборе.
      notify('warning');
      setNote({ kind: 'bundle-owned', text: BUNDLE_OWNED[lang] });
      return;
    }
    if (status === 'already_unverified') {
      notify('error');
      setNote({ kind: 'check-failed', text: PAY_COPY.checkFailed[lang] });
      return;
    }
    if (status === 'terms') {
      notify('warning'); // строка и снятая галочка уже на экране (onTermsRefused)
      return;
    }
    if (status === 'unconfirmed') {
      notify('warning');
      setNote({ kind: 'unconfirmed', text: PAY_COPY.pendingTimeout[lang] });
      return;
    }
    if (status === 'unavailable') {
      toast(PAY_COPY.outside[lang]);
      return;
    }
    if (status === 'disabled') {
      toast(PAY_COPY.disabled[lang]);
      return;
    }
    if (status === 'no_session') {
      toast(PAY_COPY.noSession[lang]);
      return;
    }
    if (status === 'rate_limited') {
      toast(ru ? 'Слишком часто — попробуй через минуту' : 'Too many attempts — try again in a minute');
      return;
    }

    if (status === 'paid') {
      // Сюда доходим, только когда покупку подтвердил сервер
      notify('success');
      // Чек вместо тоста: его не смахнёшь случайно и он говорит, что дальше
      openSheet({
        title: ru ? 'Оплачено' : 'Paid',
        subtitle: `${stars}★ · ${unlocks}`,
        body: <PurchaseSuccess stars={stars} unlocks={unlocks} />,
        actions: (
          <>
            <button className="btn btn-primary btn-block" onClick={() => { closeSheet(); setTimeout(onOpen, 220); }}>
              {ru ? 'Пройти разбор сейчас' : 'Take the analysis now'}
            </button>
            <button className="btn btn-quiet btn-block" onClick={closeSheet}>
              {ru ? 'Позже' : 'Later'}
            </button>
          </>
        ),
      });
      return;
    }

    notify('error');
    if (status === 'cancelled') toast(ru ? 'Оплата отменена — ничего не списано' : 'Payment cancelled — nothing charged');
    else toast(ru ? 'Оплата не прошла — попробуй ещё раз' : 'Payment failed — please try again');
  };

  /* Отметка снова поставлена — отказ «прими условия» исполнен, строка о нём
     больше не правда. */
  const onTicked = () => setNote((n) => (n?.kind === 'terms' ? null : n));

  /* Отказ по условиям, а перечитанный профиль назвал другую редакцию, чем ушла
     в счёте, — условия сменились, пока шторка была открыта: вместо слов
     сервера — «условия обновились». Решается при показе, а не в миг отказа:
     профиль перечитывается в фоне (lib/payments.ts). */
  const shown: { kind: string; text: string } | null =
    note?.kind === 'terms' && note.sent !== termsVersion
      ? { kind: 'terms-updated', text: PAY_COPY.termsUpdated[lang] }
      : note;

  return (
    <>
      {/* Пока оплата в полёте, живой блок остаётся на месте, даже если
          доступность на миг ушла из 'ready' (перевход после 401): иначе вместо
          «Ждём подтверждения» встала бы строка «Проверяю…», а галочка
          вернулась бы пустой. */}
      {avail === 'ready' || phase !== 'idle' ? (
        <ReadyBuy
          id={id}
          stars={stars}
          phase={phase}
          termsVersion={termsVersion}
          lang={lang}
          onBuy={buy}
          onTicked={onTicked}
          cta={cta}
          meta={meta}
          footer={footer}
        />
      ) : (
        <PayUnavailable avail={avail} lang={lang} />
      )}
      {/* Строки отказа и набора — role=status: подсказка, что делать дальше, а
          не тревога; тревога — только «не удалось проверить покупки». */}
      {shown && (
        <p
          className="stars-note"
          role={shown.kind === 'check-failed' ? 'alert' : 'status'}
          data-pay-note={shown.kind}
          style={{ marginTop: 'var(--sp-sm)' }}
        >
          <Icon name={shown.kind === 'unconfirmed' ? 'clock' : 'info'} size={14} strokeWidth={2} />
          <span>{shown.text}</span>
        </p>
      )}
      {!footer && <PurchaseTerms lang={lang} termsVersion={termsVersion} />}
    </>
  );
}

/**
 * Живая оплата: галочка условий, ссылка на их текст, кнопка и подсказка.
 * Своё состояние у неё одно — галочка. Компонент монтируется заново с каждой
 * шторкой оплаты (showPaywall и showBundle открывают её после закрытия
 * прежней) — на этом держится «галочка снята при каждом открытии»; оплата в
 * полёте его не снимает (BuyButton держит его, пока phase ≠ 'idle').
 */
function ReadyBuy({ id, stars, phase, termsVersion, lang, onBuy, onTicked, cta, meta, footer = false }: {
  footer?: boolean;
  cta?: { ru: string; en: string };
  meta?: string;
  id: string;
  stars: number;
  phase: Phase;
  termsVersion: string | null;
  lang: Lang;
  onBuy: (version: string | null, dropTick: () => void) => Promise<void>;
  onTicked: () => void;
}) {
  const ru = lang === 'ru';
  const gender = useGender();
  const hintId = useId();
  /* Галочка — местный факт экрана; доказательство согласия — запись сервера
     (terms_version в счёте). Хранится редакция, при которой отметку
     поставили: пришла другая (Me перечитан) — отметка на прежний текст на
     новый молча не переносится. Сравнение — только точным равенством строк,
     как у сервера. */
  const [tick, setTick] = useState<{ version: string | null } | null>(null);
  const ticked = tick !== null && tick.version === termsVersion;
  // Подсказка «отметьте галочку» — после нажатия без неё, а не постоянной строкой
  const [nudged, setNudged] = useState(false);
  const busy = phase !== 'idle';

  const toggle = () => {
    if (busy) return; // запрос уже ушёл с этой отметкой
    if (ticked) {
      setTick(null);
      return;
    }
    setTick({ version: termsVersion });
    onTicked();
  };

  const press = () => {
    if (busy) return; // второе нажатие во время оплаты — не второй счёт
    /* Без галочки кнопка погашена aria-disabled, а не disabled (умение
       readonly-not-disabled): она остаётся в обходе и в озвучке, а нажатие
       ДОХОДИТ до этого обработчика. Заслон — эта строка, тем же `ticked`, что
       гасит кнопку: без галочки счёт не запрашивается. */
    if (!ticked) {
      notify('warning');
      setNudged(true);
      return;
    }
    // ticked ⇒ отметку ставили именно при этой редакции
    void onBuy(termsVersion, () => setTick(null));
  };

  const label = busy ? (
    <span className="pw-busy">
      <span className="pw-spinner" aria-hidden />
      {phase === 'invoice' ? PAY_COPY.opening[lang] : PAY_COPY.pending[lang]}
    </span>
  ) : (
    <span className="pw-buy-label">
      {/* Цена — всегда на кнопке, и в демо тоже: без неё казалось, что
          продаётся только пакет «все 6» (Роч 16.10) */}
      {cta
        ? `${cta[lang]} · $${starsToUsd(stars)}`
        : isDemoPay()
          ? (ru ? 'Открыть — демо без оплаты' : 'Open — demo, no charge')
          : (ru ? `Оплатить $${starsToUsd(stars)}` : `Pay $${starsToUsd(stars)}`)}
      <span className="pw-buy-usd">
        <Icon name="star" size={12} strokeWidth={2} fill="current" />
        {stars}
      </span>
    </span>
  );

  /* Подвал шторки (Роч 16.10: «синий блок занял пол-экрана, внизу дыра»):
     три строки вместо семи — галочка со ссылкой справа, кнопка, одна строка.
     Подвал не прокручивается вместе с описанием, поэтому под ним ничего
     не вылезает. */
  if (footer) {
    return (
      <div className="pw-foot">
        <div className="pw-foot-terms" data-pay-terms>
          <button
            type="button"
            role="checkbox"
            aria-checked={ticked}
            aria-disabled={busy || undefined}
            aria-label={tickText(lang, gender)}
            className={`pw-tick${ticked ? ' on' : ''}${nudged && !ticked ? ' nudge' : ''}`}
            onClick={() => { setNudged(false); toggle(); }}
            data-pay-tick
          >
            <span className="pw-tick-box" aria-hidden>{ticked && <Icon name="check" size={13} strokeWidth={2.8} />}</span>
            <span className="pw-tick-text">{ru ? `${gg('Прочитала', 'Прочитал', gender)} условия, ${gg('согласна', 'согласен', gender)}, мне 18+` : 'I’ve read and agree to the terms, I’m 18+'}</span>
          </button>
          <LegalLink doc="terms" version={termsVersion}>{ru ? 'Условия' : 'Terms'}</LegalLink>
        </div>
        <button
          className="btn btn-amber btn-block"
          onClick={press}
          disabled={busy}
          aria-disabled={ticked ? undefined : true}
          aria-describedby={ticked ? undefined : hintId}
          data-pay={id}
        >
          {label}
        </button>
        <p className={`pw-foot-meta${nudged && !ticked ? ' warn' : ''}`} id={hintId} aria-live="polite">
          {nudged && !ticked
            ? PAY_COPY.tickFirst[lang]
            : <>
                {meta}{isDemoPay() ? (ru ? ' · демо, без списания' : ' · demo, no charge') : ''}
                {' · '}
                <button type="button" className="pw-foot-link" onClick={() => openStarsInfo(lang, stars)}>{ru ? 'что такое Stars' : 'what are Stars'}</button>
              </>}
        </p>
      </div>
    );
  }

  return (
    /* Док внизу шторки (Роч 15.10: «где кнопка запуска разбора?»): кнопка
       стояла под оффером, сноской и условиями — до неё надо было листать.
       Теперь галочка и кнопка всегда на виду, описание прокручивается под ними. */
    <div className="pw-dock">
      {/* Галочка — над кнопкой, 18+ внутри неё (Законник п.5). Ссылка на текст —
          ОТДЕЛЬНОЙ строкой, не внутри кнопки-галочки: ссылка внутри кнопки —
          невалидная разметка, и «прочитать» ставило бы отметку. Зоны нажатия
          44px у ссылки нет: под галочкой она накрыла бы саму галочку; своя
          цель — не меньше 24px по высоте (.pw-terms-link a, WCAG 2.5.8).
          Ссылка — с версией (?v=): после 409 открывается новая редакция, а не
          копия из кэша WebView. */}
      <div className="pw-terms" data-pay-terms>
        <button
          type="button"
          role="checkbox"
          aria-checked={ticked}
          aria-disabled={busy || undefined}
          className={`onb-agree${ticked ? ' on' : ''}`}
          onClick={toggle}
          data-pay-tick
        >
          <span className="onb-check">{ticked && <Icon name="check" size={14} strokeWidth={2.4} />}</span>
          <span className="onb-agree-text">{tickText(lang, gender)}</span>
        </button>
        <p className="onb-hint pw-terms-link">
          <LegalLink doc="terms" version={termsVersion}>{PAY_COPY.termsLink[lang]}</LegalLink>
        </p>
      </div>
      <button
        className="btn btn-amber btn-block"
        onClick={press}
        disabled={busy}
        aria-disabled={ticked ? undefined : true}
        aria-describedby={ticked ? undefined : hintId}
        data-pay={id}
      >
        {busy ? (
          <span className="pw-busy">
            <span className="pw-spinner" aria-hidden />
            {phase === 'invoice' ? PAY_COPY.opening[lang] : PAY_COPY.pending[lang]}
          </span>
        ) : (
          <span className="pw-buy-label">
            {cta
              ? `${cta[lang]} · ${isDemoPay() ? (ru ? 'демо' : 'demo') : `$${starsToUsd(stars)}`}`
              : isDemoPay()
                ? (ru ? 'Открыть — демо без оплаты' : 'Open — demo, no charge')
                : (ru ? `Оплатить $${starsToUsd(stars)}` : `Pay $${starsToUsd(stars)}`)}
            <span className="pw-buy-usd">
              <Icon name="star" size={12} strokeWidth={2} fill="current" />
              {stars}
            </span>
          </span>
        )}
      </button>
      {meta && <p className="pw-dock-meta">{meta}</p>}
      <button type="button" className="pw-stars-what" onClick={() => openStarsInfo(lang, stars)}>
        <Icon name="star" size={12} strokeWidth={2} fill="current" /> {ru ? 'Что такое Telegram Stars и курс' : 'What Telegram Stars are · rate'}
      </button>
      {isDemoPay() && (
        <p className="legal-note" style={{ marginTop: 'var(--sp-sm)', maxWidth: 'none', textAlign: 'center' }}>
          {ru ? 'Демо-версия: звёзды не списываются, разбор откроется сразу.' : 'Demo: no Stars are charged, the analysis opens right away.'}
        </p>
      )}
      {/* Погасить, а не спрятать: кнопка на месте, причина — рядом и в озвучке */}
      {!ticked && (
        <p id={hintId} className="legal-note" data-pay-hint style={{ marginTop: 'var(--sp-sm)', maxWidth: 'none', textAlign: 'center' }}>
          {PAY_COPY.tickFirst[lang]}
        </p>
      )}
    </div>
  );
}

/** Честная строка вместо кнопки: почему оплатить здесь нельзя. */
function PayUnavailable({ avail, lang }: { avail: Exclude<PayAvailability, 'ready'>; lang: Lang }) {
  const text =
    avail === 'outside_telegram' ? PAY_COPY.outside[lang]
    : avail === 'disabled' ? PAY_COPY.disabled[lang]
    : avail === 'checking' ? PAY_COPY.checking[lang]
    : PAY_COPY.noSession[lang];
  const [busy, setBusy] = useState(false);
  const canRetry = avail === 'no_session' || avail === 'checking';
  return (
    <div className="pw-unavail">
      <div className="stars-note" role="note" data-pay-unavailable={avail}>
        <Icon name="info" size={14} strokeWidth={2} />
        <span>{avail === 'no_session' ? (lang === 'ru' ? 'Не удалось связаться с сервером — оплата пока недоступна.' : 'Couldn’t reach the server — payment is unavailable for now.') : text}</span>
      </div>
      {/* Не тупик «откройте заново»: вход повторяется одним нажатием */}
      {canRetry && (
        <button className="btn btn-amber btn-block" disabled={busy} aria-busy={busy} onClick={() => {
          setBusy(true);
          void retrySession().then(() => refreshMe()).finally(() => setBusy(false));
        }}>
          {busy ? (lang === 'ru' ? 'Подключаюсь…' : 'Connecting…') : (lang === 'ru' ? 'Повторить вход' : 'Try again')}
        </button>
      )}
    </div>
  );
}

/** «Не диагноз» + согласие на немедленный доступ + условия и возврат — у каждой кнопки оплаты */
function PurchaseTerms({ lang, termsVersion }: { lang: Lang; termsVersion: string | null }) {
  const ru = lang === 'ru';
  return (
    <p className="legal-note" style={{ marginTop: 'var(--sp-sm)', maxWidth: 'none', textAlign: 'center' }}>
      {NOT_A_DIAGNOSIS[lang]}{' '}
      {ru ? 'Доступ без ограничения срока.' : 'Access with no time limit.'}
      <br />
      {PAY_COPY.consent[lang]}{' '}
      <LegalLink doc="refunds" hitArea>{ru ? 'условиям возврата' : 'refund terms'}</LegalLink>
      {' · '}
      {/* С версией, как ссылка под галочкой: кэш WebView касается обеих */}
      <LegalLink doc="terms" hitArea version={termsVersion}>{ru ? 'Условия покупки' : 'Purchase terms'}</LegalLink>
    </p>
  );
}

/** Чек: деньги дошли, вот что открылось */
function PurchaseSuccess({ stars, unlocks }: { stars: number; unlocks: string }) {
  const lang = useLang();
  const ru = lang === 'ru';
  const { me } = useMe();
  return (
    <div className="pw-done">
      <div className="pw-done-mark" aria-hidden>
        <span className="pw-done-ring" />
        <Icon name="check" size={34} strokeWidth={2.6} />
      </div>
      <div className="pw-done-title">{ru ? 'Доступ открыт' : 'Access unlocked'}</div>
      <div className="pw-done-sub">{unlocks}</div>
      <div className="pw-done-receipt">
        <div className="pw-done-line">
          <span>{ru ? 'Списано' : 'Charged'}</span>
          {isDemoPay()
            ? <strong>{ru ? 'ничего — это демо' : 'nothing — demo'}</strong>
            : <strong>${starsToUsd(stars)} <span className="pw-done-usd">· {stars} ★</span></strong>}
        </div>
        <div className="pw-done-line">
          <span>{ru ? 'Доступ' : 'Access'}</span>
          <strong>{ru ? 'без ограничения срока' : 'no time limit'}</strong>
        </div>
        <div className="pw-done-line">
          <span>{ru ? 'Где найти' : 'Where to find it'}</span>
          <strong>{ru ? 'раздел ANZH' : 'ANZH tab'}</strong>
        </div>
      </div>
      <p className="legal-note" style={{ marginTop: 'var(--sp-sm)', maxWidth: 'none' }}>
        {NOT_A_DIAGNOSIS[lang]}{' '}
        <LegalLink doc="terms" hitArea version={legalVersion(me, 'terms')}>{ru ? 'Условия' : 'Terms'}</LegalLink>
        {' · '}
        <LegalLink doc="refunds" hitArea>{ru ? 'Условия возврата' : 'Refund policy'}</LegalLink>
      </p>
    </div>
  );
}

/* ── Что даёт разбор ────────────────────────────────────────
   Раньше этот список строился из `Object.values(quiz.results)` — то есть
   перечислял ВОЗМОЖНЫЕ ИСХОДЫ. У платных разборов их 5–8, и список хоть
   как-то читался; у бесплатного Skin Profile исход ровно один, и весь блок
   схлопывался в одну бессмысленную строку «Skin Profile создан». Ценность
   разбора — не в перечне его вариантов ответа. */

export function QuizValue({ quiz }: { quiz: Quiz }) {
  const ru = useLang() === 'ru';
  const outcomes = Object.values(quiz.results).length;
  const profile = quiz.id === 'profile';

  const rows = profile
    ? [
        ru ? 'Паспорт кожи заполняется сам — тип, чувствительность, опыт ухода' : 'Your skin passport fills itself — type, sensitivity, care history',
        ru ? 'С твоего согласия на анкету Анжелика увидит его до приёма' : 'With your questionnaire consent, Anjelika sees it before the visit',
        ru ? 'Если запрос — сухость кожи, покажу процедуру Анжелики под него' : 'If your concern is dryness, you’ll see Anjelika’s treatment for it',
        ru ? 'Бесплатно — можно пройти заново, когда кожа изменится' : 'Free — retake it when your skin changes',
      ]
    : [
        ru ? `Один из ${outcomes} типов с полным разбором, а не оценка «хорошо / плохо»` : `One of ${outcomes} types with a full read-out, not a good/bad score`,
        ru ? 'Что делать у косметолога и в каком порядке' : 'What to do at the clinic, and in what order',
        /* Здесь стояло «результат сохраняется в паспорте кожи»: разборы на
           сервере — второй ряд, результат живёт до закрытия приложения
           (lib/quizResults.ts). Обещаем только то, что есть. */
        ru ? 'Результат — сразу после последнего ответа' : 'Your result right after the last answer',
        ru ? 'Доступ без ограничения срока, проходить можно заново' : 'Access with no time limit, retake any time',
      ];

  return (
    <>
      <div className="eyebrow pw-eyebrow">{ru ? 'что ты получишь' : 'what you get'}</div>
      <ul className="pw-list">
        {rows.map((r) => (
          <li key={r}>
            <Icon name="check" size={15} strokeWidth={2.6} />
            <span>{r}</span>
          </li>
        ))}
      </ul>
    </>
  );
}

/* ── Вход в бесплатный или уже купленный разбор ─────────────
   Тот же вес, что у paywall: человек решает, тратить ли десять минут, —
   решение не меньшее, чем «платить или нет». */

export function QuizIntro({ quiz, passed }: { quiz: Quiz; passed: boolean }) {
  const ru = useLang() === 'ru';
  const free = quiz.stars === 0;
  /* В паспорт (PUT /me/health, QuizRunner → saveQuizToPassport) пишут только
     Skin Profile и тип кожи; остальные разборы живут в памяти до закрытия
     приложения (lib/quizResults.ts). Обещать «заменит в паспорте» им нельзя
     (Цензор фронта №2, решение John ЦФ2). */
  const toPassport = PASSPORT_QUIZZES.has(quiz.id);

  return (
    <>
      <div className="pw-hero">
        <div className={`pw-hero-badge${free ? ' pw-hero-badge--free' : ''}`}>
          <Icon name={quiz.icon} size={26} strokeWidth={1.7} />
        </div>
        <div className="pw-hero-meta">
          <div className={`pw-hero-eyebrow${free ? ' pw-hero-eyebrow--free' : ''}`}>
            {free ? (ru ? 'бесплатно' : 'free') : (ru ? 'разбор открыт' : 'unlocked')}
          </div>
          <div className="pw-hero-title">{ru ? quiz.title : quiz.titleEn ?? quiz.title}</div>
        </div>
      </div>

      <QuizValue quiz={quiz} />

      <div className="pw-facts">
        <div className="pw-fact">
          <span className="pw-fact-v">{quiz.questions.length}</span>
          <span className="pw-fact-k">{ru ? 'вопросов' : 'questions'}</span>
        </div>
        <div className="pw-fact">
          <span className="pw-fact-v">~{quiz.minutes}</span>
          <span className="pw-fact-k">{ru ? 'минут' : 'min'}</span>
        </div>
        <div className="pw-fact">
          <span className="pw-fact-v"><Icon name="check" size={17} strokeWidth={2.6} /></span>
          <span className="pw-fact-k">{ru ? 'можно прервать' : 'pausable'}</span>
        </div>
      </div>

      {passed && (
        <div className="pw-retake" data-retake={toPassport ? 'passport' : 'session'}>
          <Icon name="clock" size={15} strokeWidth={2} />
          <span>
            {toPassport
              ? (ru
                ? 'Ты уже проходила его. Новый результат заменит прежний в паспорте кожи.'
                : 'You have taken this before. A new result replaces the old one in your passport.')
              : (ru
                ? 'Ты уже проходила его. Результат виден до закрытия приложения.'
                : 'You have taken this before. The result stays visible until you close the app.')}
          </span>
        </div>
      )}

      <div className="pw-privacy">
        <Icon name="shield-check" size={15} strokeWidth={1.9} />
        <span>
          {ru
            ? 'Ответы видит только Анжелика и только с твоего согласия на данные о здоровье — они нужны, чтобы не навредить коже на процедуре.'
            : 'Only Anjelika sees your answers, and only with your health data consent — they exist so a treatment does not harm your skin.'}
        </span>
      </div>
    </>
  );
}
