import { useState } from 'react';
import { Icon } from './Icon';
import { closeSheet, openSheet, toast } from '../lib/ui';
import { notify, tap } from '../lib/haptics';
import { payWithStars, addPurchase, canPayWithStars, starsToUsd } from '../lib/payments';
import { BUNDLE, IG_OFFER, igPrice, PAID_QUIZZES, type Quiz } from '../data/quizzes';
import { useLang } from '../lib/i18n';

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

interface PaywallProps {
  quiz: Quiz;
  price: number;
  bundlePrice: number;
  igApplied: boolean;
  onApplyIg: () => void;
  onBought: () => void;
  onOpenBundle: () => void;
}

export function Paywall({
  quiz, price, bundlePrice, igApplied, onApplyIg, onBought, onOpenBundle,
}: PaywallProps) {
  const ru = useLang() === 'ru';
  // Экономия набора считается от ЭТОЙ цены, а не от прайса: если скидка за
  // подписку уже применена, обещать старую выгоду нельзя
  const singleTotal = PAID_QUIZZES.reduce((s, q) => s + (igApplied ? igPrice(q.stars) : q.stars), 0);
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

      <div className="pw-price">
        <div className="pw-price-row">
          <span>{ru ? 'Этот разбор' : 'This analysis'}</span>
          <strong className="pw-price-now">
            {/* Число и звезда — одна строка: контейнер стоит колонкой ради
                подписи в долларах, и иконка уезжала под цену */}
            <span className="pw-price-figure">
              {price}<Icon name="star" size={14} strokeWidth={2} fill="current" />
            </span>
            <span className="pw-price-usd">≈ ${starsToUsd(price)}</span>
          </strong>
        </div>
        {igApplied && price !== quiz.stars && (
          <div className="pw-price-row pw-price-was">
            <span>{ru ? 'Без скидки' : 'Without discount'}</span>
            <s>{quiz.stars}★</s>
          </div>
        )}
        <div className="pw-price-note">
          {quiz.questions.length} {ru ? 'вопросов · около' : 'questions · about'} {quiz.minutes} {ru ? 'минут' : 'min'}
        </div>
      </div>

      {save > 0 && (
        <button className="pw-bundle" onClick={onOpenBundle}>
          <div className="pw-bundle-text">
            <div className="pw-bundle-title">
              {ru
                ? `Все шесть разборов — ${bundlePrice}★ ≈ $${starsToUsd(bundlePrice)}`
                : `All six analyses — ${bundlePrice}★ ≈ $${starsToUsd(bundlePrice)}`}
            </div>
            <div className="pw-bundle-sub">
              {ru ? `Дешевле на ${save}★, чем по одному` : `${save}★ cheaper than one by one`}
            </div>
          </div>
          <Icon name="chevron-right" size={18} strokeWidth={2} />
        </button>
      )}

      {!igApplied && (
        <button className="pw-promo" onClick={onApplyIg}>
          <Icon name="gift" size={16} strokeWidth={1.9} />
          <span>
            {ru
              ? `Подписка на @dr.domnich — −${IG_OFFER.percent}% по коду ${IG_OFFER.code}`
              : `Follow @dr.domnich — −${IG_OFFER.percent}% with code ${IG_OFFER.code}`}
          </span>
        </button>
      )}

      <div className="stars-note pw-note">
        <Icon name="star" size={14} strokeWidth={2} fill="current" />
        <span>
          {ru
            ? 'Оплата звёздами Telegram — без карты и перехода на сайт.'
            : 'Pay with Telegram Stars — no card, no leaving the app.'}
          {!canPayWithStars() && (ru ? ' В браузере это демо-режим.' : ' In a browser this is demo mode.')}
        </span>
      </div>

      <BuyButton
        id={quiz.id}
        title={ru ? quiz.title : quiz.titleEn ?? quiz.title}
        stars={price}
        unlocks={ru ? quiz.title : quiz.titleEn ?? quiz.title}
        onOpen={onBought}
      />
    </>
  );
}

/* ── 2. Кнопка оплаты + чек ─────────────────────────────── */

export function BuyButton({
  id, title, stars, unlocks, onOpen,
}: {
  id: string;
  title: string;
  stars: number;
  /** Что открылось — показывается в чеке */
  unlocks: string;
  onOpen: () => void;
}) {
  const ru = useLang() === 'ru';
  const [busy, setBusy] = useState(false);

  const buy = async () => {
    tap('medium');
    setBusy(true);
    const status = await payWithStars(id);
    setBusy(false);

    if (status === 'paid') {
      addPurchase({ productId: id, title, stars });
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
              {ru ? 'Позже — он никуда не денется' : 'Later — it stays yours'}
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

  return (
    <button className="btn btn-amber btn-block" onClick={buy} disabled={busy}>
      {busy ? (
        <span className="pw-busy">
          <span className="pw-spinner" aria-hidden />
          {ru ? 'Открываю оплату…' : 'Opening payment…'}
        </span>
      ) : (
        <span className="pw-buy-label">
          <Icon name="star" size={16} strokeWidth={2} fill="current" />
          {ru ? `Оплатить ${stars} звёзд` : `Pay ${stars} Stars`}
          <span className="pw-buy-usd">≈ ${starsToUsd(stars)}</span>
        </span>
      )}
    </button>
  );
}

/** Чек: деньги дошли, вот что открылось */
function PurchaseSuccess({ stars, unlocks }: { stars: number; unlocks: string }) {
  const ru = useLang() === 'ru';
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
          <strong>{stars}★ <span className="pw-done-usd">≈ ${starsToUsd(stars)}</span></strong>
        </div>
        <div className="pw-done-line">
          <span>{ru ? 'Доступ' : 'Access'}</span>
          <strong>{ru ? 'навсегда' : 'forever'}</strong>
        </div>
        <div className="pw-done-line">
          <span>{ru ? 'Где найти' : 'Where to find it'}</span>
          <strong>{ru ? 'раздел ANZH' : 'ANZH tab'}</strong>
        </div>
      </div>
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
        ru ? 'Анжелика видит его ДО приёма и не тратит визит на расспросы' : 'Anjelika sees it BEFORE the visit instead of spending it on questions',
        ru ? 'Подбор процедур под твой запрос, а не общий список' : 'Treatments picked for your concern, not a generic list',
        ru ? 'Бесплатно и навсегда — можно переснять, когда кожа изменится' : 'Free and yours forever — retake it when your skin changes',
      ]
    : [
        ru ? `Один из ${outcomes} типов с полным разбором, а не оценка «хорошо / плохо»` : `One of ${outcomes} types with a full read-out, not a good/bad score`,
        ru ? 'Что делать у косметолога и в каком порядке' : 'What to do at the clinic, and in what order',
        ru ? 'Результат уходит в паспорт кожи — Анжелика видит его до приёма' : 'The result goes into your skin passport — Anjelika sees it before the visit',
        ru ? 'Доступ навсегда, проходить можно заново' : 'Yours forever, retake any time',
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
        <div className="pw-retake">
          <Icon name="clock" size={15} strokeWidth={2} />
          <span>
            {ru
              ? 'Ты уже проходила его. Новый результат заменит прежний в паспорте кожи.'
              : 'You have taken this before. A new result replaces the old one in your passport.'}
          </span>
        </div>
      )}

      <div className="pw-privacy">
        <Icon name="shield-check" size={15} strokeWidth={1.9} />
        <span>
          {ru
            ? 'Ответы видит только Анжелика — они нужны, чтобы не навредить коже на процедуре.'
            : 'Only Anjelika sees your answers — they exist so a treatment does not harm your skin.'}
        </span>
      </div>
    </>
  );
}
