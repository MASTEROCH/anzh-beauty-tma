import { useEffect } from 'react';
import { openSheet, closeSheet, toast } from '../lib/ui';
import { Icon } from '../components/Icon';
import { QuizRunner } from '../components/QuizRunner';
import { Paywall, PaywallBuy, PurchaseTerms, BuyButton, QuizIntro, BUNDLE_OWNED } from '../components/Paywall';
import { ChaptersCard, ChapterOffer } from '../components/PassportChapters';
import { openStarsInfo } from '../components/StarsInfo';
import { useMe } from '../lib/api';
import { legalVersion } from '../lib/api/me';
import { PriceDrop } from '../components/PriceDrop';
import { RewardsCard } from '../components/RewardsCard';
import { usePassport, chapterOpen } from '../lib/passportChapters';
import { StarPrice } from '../components/StarPrice';
import { useLang, tr } from '../lib/i18n';
import { FREE_QUIZ, PAID_QUIZZES, BUNDLE, quizWhy, quizStep, type Quiz } from '../data/quizzes';
import { usePurchases, usePurchasesState, refreshPurchases, hasAccess, coversAll, owns } from '../lib/payments';
import { useHealthPassport } from '../lib/healthPassport';
import { useQuizResults } from '../lib/quizResults';
import { NOT_A_DIAGNOSIS } from '../components/LegalFooter';

// ANZH Skin Intelligence внутри Telegram: вся методология с anzh.store —
// бесплатный Skin Profile и шесть платных разборов — проходится здесь, без
// перехода на сайт. Физических товаров тут нет намеренно: Telegram
// запрещает продавать за звёзды что-либо, кроме цифрового.

export function AnzhScreen({ onBook }: { onBook: (id: string) => void }) {
  const lang = useLang();
  const ru = lang === 'ru';
  const { me } = useMe();
  /* Купленное — ТОЛЬКО с сервера (GET /me/purchases): доступ к платному
     разбору не выдаёт ни колбэк окна оплаты, ни память устройства. */
  const purchases = usePurchases();
  const purchasesState = usePurchasesState();
  const passport = useHealthPassport();
  const results = useQuizResults();
  // Главы, открытые подарком (за процедуры и подруг) — доступ наравне с покупкой
  const pass = usePassport();
  const access = (id: string) => hasAccess(purchases, id) || chapterOpen(pass, id);
  const hasResult = (id: string) => results.some((r) => r.quizId === id);

  /* Цена — прайсовая. Скидки за задания (отзыв, подруга, сторис) на
     разборы больше нет: задания на запуск скрыты, а цена на экране обязана
     совпасть со счётом, который выставит сервер (решение John 24.09). */
  /* Доступ — ТОЛЬКО по covers покупок (решение John Х1): набор открывает
     свой снимок состава, а не «всё». «Все разборы открыты» — когда каждый
     разбор витрины покрыт хоть одной оплаченной покупкой, откуда бы она ни
     была: набор, отдельные разборы или то и другое. */
  const hasBundle = coversAll(purchases, BUNDLE.includes);
  /* Сервер не продаёт набор (alreadyOwns, payments.js:264-270) в двух случаях:
     сам набор уже куплен — `owns` тем же выражением, что `owned.has(slug)`; или
     покрыт весь его текущий состав — hasBundle. Там, где набор не продаётся,
     нет ни цены, ни кнопки, ни апселла — вместо них строка (решение владельца
     28.09 «б», решение John, круг 2). Путь через 409 остаётся запасным: список
     покупок мог ещё не знать о наборе. */
  const ownsBundle = owns(purchases, BUNDLE.id);
  const offerBundle = !hasBundle && !ownsBundle;
  const priceFor = (q: Quiz) => q.stars;
  const bundlePrice = BUNDLE.stars;

  /* Оговорка «не диагноз» стоит внутри QuizRunner, над итогом: она доезжает
     до каждого пути, где показывают результат (здесь, анкета, кабинет). */
  const runQuiz = (quiz: Quiz) =>
    openSheet({
      title: tr(quiz.title, quiz.titleEn ?? quiz.title),
      subtitle: tr(`${quiz.questions.length} вопросов · ${quiz.minutes} мин`, `${quiz.questions.length} questions · ${quiz.minutes} min`),
      body: <QuizRunner quiz={quiz} onBook={onBook} />,
    });

  // Пришли из проводника «Паспорта» («Пройти Skin Profile») — сразу открыть разбор
  useEffect(() => {
    let want: string | null = null;
    try { want = sessionStorage.getItem('anzh_open_quiz'); sessionStorage.removeItem('anzh_open_quiz'); } catch { /* ok */ }
    if (want === 'profile') { const t = window.setTimeout(() => showQuiz(FREE_QUIZ), 350); return () => window.clearTimeout(t); }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const showQuiz = (quiz: Quiz) => {
    const bought = access(quiz.id);
    const free = quiz.stars === 0;
    const passed = quiz.id === 'profile' ? !!passport.quizAt : hasResult(quiz.id);

    openSheet({
      /* Имя разбора несёт шапка ВНУТРИ тела, поэтому здесь — что это вообще
         за шторка. Иначе «Skin Profile» стоит трижды подряд: заголовок,
         подзаголовок-слоган и он же в hero. */
      title: free
        ? (ru ? 'Бесплатный разбор' : 'Free analysis')
        : (ru ? 'Твой разбор' : 'Your analysis'),
      subtitle: `${quiz.questions.length} ${ru ? 'вопросов · около' : 'questions · about'} ${quiz.minutes} ${ru ? 'мин' : 'min'}`,
      body: <QuizIntro quiz={quiz} passed={passed} />,
      actions: (
        <button className="btn btn-primary btn-block" onClick={() => runQuiz(quiz)}>
          {passed
            ? (ru ? 'Пройти заново' : 'Retake')
            : bought && !free
              ? (ru ? 'Открыть разбор' : 'Open the analysis')
              : (ru ? 'Пройти бесплатно' : 'Take it free')}
        </button>
      ),
    });
  };

  /* Платный и ещё не купленный разбор открывает paywall, а не описание с
     кнопкой внизу: решение о платеже принимается здесь, и у него должен быть
     свой экран. */
  const showPaywall = (quiz: Quiz) =>
    openSheet({
      title: ru ? 'Разбор за звёзды' : 'Analysis for Stars',
      subtitle: ru ? 'Оплата внутри Telegram' : 'Paid inside Telegram',
      body: (
        <Paywall
          quiz={quiz}
          price={quiz.stars}
          bundlePrice={BUNDLE.stars}
          onBought={() => runQuiz(quiz)}
          onOpenBundle={() => { closeSheet(); setTimeout(showBundle, 220); }}
          ownsBundle={ownsBundle}
          chapter={<ChapterOffer pass={pass} quizId={quiz.id} ru={ru} onOpened={() => { closeSheet(); setTimeout(() => runQuiz(quiz), 220); }} />}
          buyInFooter
        />
      ),
      // Кнопка запуска — в неподвижном подвале: всегда видна и ничего не прячет
      actions: <PaywallBuy quiz={quiz} price={quiz.stars} onBought={() => runQuiz(quiz)} footer />,
    });

  const showResult = (quiz: Quiz) => {
    const stored = results.find((r) => r.quizId === quiz.id);
    if (!stored) return showQuiz(quiz);
    openSheet({
      title: ru ? 'Твой результат' : 'Your result',
      subtitle: `${ru ? quiz.title : quiz.titleEn ?? quiz.title} · ${new Date(stored.takenAt).toLocaleDateString(ru ? 'ru-RU' : 'en-US')}`,
      body: <QuizRunner quiz={quiz} onBook={onBook} saved={stored.answers} />,
      actions: (
        <>
          <button className="btn btn-secondary btn-block" onClick={() => runQuiz(quiz)}>
            {ru ? 'Пройти заново' : 'Retake'}
          </button>
          <button className="btn btn-quiet btn-block" onClick={closeSheet}>
            {ru ? 'Закрыть' : 'Close'}
          </button>
        </>
      ),
    });
  };

  const openQuiz = (quiz: Quiz) => {
    const bought = access(quiz.id);
    // Платный и не купленный (по серверу) — всегда пейвол: результат в памяти
    // не открывает разбор после возврата покупки. Купленный и пройденный
    // ведёт к результату: показывать там цену — значит предлагать купить то,
    // что уже куплено и пройдено.
    if (quiz.stars > 0 && !bought) showPaywall(quiz);
    else if (hasResult(quiz.id)) showResult(quiz);
    else showQuiz(quiz);
  };

  const showBundle = () =>
    openSheet({
      title: ru ? BUNDLE.title : 'All six analyses',
      subtitle: ru ? 'Шесть по цене четырёх' : 'Six for the price of four',
      body: (
        <>
          <p className="muted" style={{ lineHeight: 1.65 }} data-bundle-lede>
            {ru
              ? 'Шесть разборов закрывают кожу целиком: тип, чувствительность, качество, домашний уход, стратегию старения и морфотип — в том порядке, в котором их и стоит проходить.'
              : 'Six analyses cover your skin completely: type, sensitivity, quality, home care, ageing strategy and morphotype — in the order they’re best taken.'}
            {offerBundle && (ru ? <> По отдельности — {BUNDLE.fullStars}★, вместе — {bundlePrice}★.</> : <> Separately — {BUNDLE.fullStars}★, together — {bundlePrice}★.</>)}
          </p>
          <div className="eyebrow sub-head">{ru ? 'что входит' : 'what’s included'}</div>
          <div className="col" style={{ gap: 6 }}>
            {PAID_QUIZZES.map((q) => (
              <div key={q.id} className="bundle-row">
                <Icon name={q.icon} size={15} strokeWidth={1.8} />
                <span className="bundle-row-title">{ru ? q.title : q.titleEn ?? q.title}</span>
                <span className="bundle-row-price">{q.stars}★</span>
              </div>
            ))}
          </div>
          {offerBundle && (
            <>
              <div className="bundle-total">
                <span>{ru ? 'По отдельности' : 'Separately'}</span>
                <span className="bundle-strike">{BUNDLE.fullStars}★</span>
              </div>
              <div className="bundle-total accent">
                <span>{ru ? 'Вместе' : 'Together'}</span>
                <StarPrice stars={bundlePrice} size="md" />
              </div>
            </>
          )}
          {!hasBundle && !ownsBundle && <PurchaseTerms lang={lang} termsVersion={legalVersion(me, 'terms')} />}
        </>
      ),
      actions: hasBundle ? (
        <button className="btn btn-primary btn-block" onClick={() => { closeSheet(); setTimeout(() => runQuiz(PAID_QUIZZES[0]), 200); }}>
          {ru ? 'Открыть — уже куплено' : 'Open — already purchased'}
        </button>
      ) : ownsBundle ? (
        <>
          <p className="stars-note" role="status" data-bundle-owned style={{ marginTop: 0 }}>
            <Icon name="info" size={14} strokeWidth={2} />
            <span>{BUNDLE_OWNED[lang]}</span>
          </p>
          <button className="btn btn-quiet btn-block" onClick={closeSheet}>{ru ? 'Закрыть' : 'Close'}</button>
        </>
      ) : (
        <BuyButton
          id={BUNDLE.id}
          title={BUNDLE.title}
          stars={bundlePrice}
          unlocks={ru ? 'Все шесть разборов' : 'All six analyses'}
          onOpen={() => runQuiz(PAID_QUIZZES[0])}
          cta={{ ru: 'Открыть все 6 разборов', en: 'Unlock all 6 analyses' }}
          meta={ru ? 'Доступ навсегда · начнём с типа кожи' : 'Lifetime access · we start with skin type'}
          footer
        />
      ),
    });

  return (
    <div className="screen anzh-screen">
      {/* Фото — фон всего раздела. Тёмный скрим обязателен: светлый текст на
          фотографии иначе не читается ни в одной теме (канон Романа). */}
      <div className="anzh-bg" aria-hidden>
        <img src="/brand/anzh-back.png" alt="" />
        <div className="anzh-bg-scrim" />
      </div>

      <header className="header">
        <img src="/brand/anzh-logo.svg" alt="ANZH" style={{ height: 22 }} />
        {/* Не надпись, а вход: что такое звёзды, курс и пополнение в Telegram */}
        <button className="chip chip-gold" onClick={() => openStarsInfo(ru ? 'ru' : 'en')} aria-label={ru ? 'Что такое Telegram Stars и как пополнить' : 'What Telegram Stars are and how to top up'}>
          <Icon name="star" size={12} strokeWidth={2} fill="current" /> Stars
        </button>
      </header>

      <div className="anzh-lede">
        <h1 className="anzh-title">ANZH Skin Intelligence</h1>
        <p className="anzh-sub">
          {ru
            ? 'Авторская методология Анжелики: семь разборов, которые проходятся здесь, в Telegram.'
            : 'Anjelika’s own methodology: seven analyses taken right here in Telegram.'}
        </p>
        {/* Пустые поля не склеиваем в « · »: тип кожи в пустой анкете — '' */}
        {passport.quizAt && (
          <div className="anzh-passport-chip">
            <Icon name="check" size={13} strokeWidth={2.4} />
            {[passport.skinType, passport.goal].filter(Boolean).join(' · ') || (ru ? 'профиль собран' : 'profile built')}
          </div>
        )}
      </div>

      {/* Бесплатный вход в методологию */}
      <button className="quiz-hero" onClick={() => showQuiz(FREE_QUIZ)}>
        <div className="quiz-hero-badge">
          <Icon name={FREE_QUIZ.icon} size={22} strokeWidth={1.8} />
        </div>
        <div className="quiz-hero-body">
          <div className="quiz-hero-eyebrow">{ru ? 'начни отсюда · бесплатно' : 'start here · free'}</div>
          <div className="quiz-hero-title">{ru ? FREE_QUIZ.title : FREE_QUIZ.titleEn}</div>
          <div className="quiz-hero-sub">{ru ? FREE_QUIZ.tagline : FREE_QUIZ.taglineEn} · {FREE_QUIZ.questions.length} {ru ? 'вопросов' : 'questions'}</div>
        </div>
        {passport.quizAt
          ? <span className="digital-free">{ru ? 'пройден' : 'done'}</span>
          : <Icon name="chevron-right" size={20} strokeWidth={2} className="review-cta-arrow" />}
      </button>

      {/* Главы в подарок: за процедуры и за подруг (Роч 15.10) */}
      {pass && <ChaptersCard pass={pass} ru={ru} />}

      {/* Скидки за действия — разовые, по −5 % (из ANZH.store, Роч 15.10) */}
      <RewardsCard lang={ru ? 'ru' : 'en'} onProfile={() => showQuiz(FREE_QUIZ)} />

      {/* Ошибка ≠ пустота: не удалось проверить покупки — говорим прямо, а не
          рисуем всё «не куплено» (человек мог уже заплатить). */}
      {purchasesState.error && (
        <div className="stars-note" role="alert" style={{ marginTop: 12 }}>
          <Icon name="info" size={14} strokeWidth={2} />
          <span>
            {ru ? 'Не удалось проверить покупки. ' : 'Could not check your purchases. '}
            <button type="button" className="legal-link" onClick={() => void refreshPurchases()}>
              {ru ? 'Повторить' : 'Retry'}
            </button>
          </span>
        </div>
      )}

      <section className="anzh-section">
        <div className="section-head" style={{ padding: 0, marginBottom: 10 }}>
          <div>
            <div className="eyebrow">{ru ? 'разборы · по порядку' : 'analyses · in order'}</div>
            <h2 className="section-title">{ru ? 'Шесть сторон твоей кожи' : 'Six sides of your skin'}</h2>
          </div>
        </div>

        <p className="quiz-order-lede">
          {ru
            ? 'Порядок не случайный: каждый следующий разбор читается через предыдущий. Можно брать любой, но снизу вверх он даст меньше.'
            : 'The order matters: each analysis is read through the one before it. You can start anywhere, but bottom-up tells you less.'}
        </p>

        <div className="col quiz-order" style={{ gap: 10 }}>
          {PAID_QUIZZES.map((q, i) => {
            const bought = access(q.id);
            const price = priceFor(q);
            const step = quizStep(q.id);
            const why = quizWhy(q.id);
            // Результат платного показываем только при покупке по серверу
            const passed = bought && hasResult(q.id);
            // Следующий по порядку из непройденных — единственный, который
            // подсвечен. Подсветить все шесть значит не подсветить ни одного.
            const isNext = !passed && PAID_QUIZZES.every((o, j) => j >= i || hasResult(o.id));
            return (
              <button
                key={q.id}
                className={`digital-card reveal quiz-step-card${bought ? ' owned' : ''}${isNext ? ' is-next' : ''}${passed ? ' is-passed' : ''}`}
                style={{ animationDelay: `${i * 45}ms` }}
                onClick={() => openQuiz(q)}
              >
                <span className="quiz-step-num" aria-hidden>
                  {passed ? <Icon name="check" size={13} strokeWidth={3} /> : step}
                </span>
                <div className="digital-icon"><Icon name={q.icon} size={20} strokeWidth={1.8} /></div>
                <div className="digital-body">
                  <div className="digital-title">{ru ? q.title : q.titleEn}</div>
                  <div className="digital-sub">{why ? why[lang] : (ru ? q.tagline : q.taglineEn)}</div>
                  {isNext && <span className="quiz-step-badge">{ru ? 'следующий шаг' : 'next step'}</span>}
                </div>
                <div className="digital-price">
                  {passed ? (
                    <span className="digital-result">
                      {ru ? 'результат' : 'result'}
                      <Icon name="chevron-right" size={14} strokeWidth={2.4} />
                    </span>
                  ) : bought ? (
                    <span className="digital-free">{ru ? 'открыт' : 'unlocked'}</span>
                  ) : (
                    <span className="digital-stars">
                      <StarPrice stars={price} size="sm" />
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* Бандл — главный офер */}
      <button className={`bundle-cta${hasBundle ? ' owned' : ''}`} onClick={showBundle}>
        <div className="bundle-cta-glow" aria-hidden />
        <div className="bundle-cta-head">
          {/* «Шесть по цене четырёх» не надо считать в уме, а «−33%» — надо */}
          <span className="bundle-cta-eyebrow">{ru ? 'шесть по цене четырёх' : 'six for the price of four'}</span>
          <span className="bundle-cta-title">{hasBundle ? (ru ? 'Все разборы открыты' : 'All analyses unlocked') : (ru ? BUNDLE.title : 'All six analyses')}</span>
          {/* Набор куплен, а состав с тех пор вырос: вместо цены — строка */}
          {!hasBundle && ownsBundle && (
            <span className="bundle-cta-owned" data-bundle-owned>{BUNDLE_OWNED[lang]}</span>
          )}
        </div>
        {offerBundle && (
          <div className="bundle-cta-price">
            {/* Скидка видна в самой цене: старая зачёркивается и падает (price-drop) */}
            <PriceDrop oldStars={BUNDLE.fullStars} newStars={bundlePrice} />
          </div>
        )}
      </button>

      <p className="faint" style={{ fontSize: 12, marginTop: 16, paddingBottom: 4 }}>
        {ru
          ? 'Звёздами оплачивается цифровое — так устроен Telegram. Домашний уход Анжелика подбирает на приёме.'
          : 'Stars pay for digital goods — that’s how Telegram works. Home care is prescribed at the visit.'}
        {' '}
        {NOT_A_DIAGNOSIS[lang]}
      </p>
    </div>
  );
}


