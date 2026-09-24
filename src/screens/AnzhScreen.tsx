import { openSheet, closeSheet, toast } from '../lib/ui';
import { Icon } from '../components/Icon';
import { QuizRunner } from '../components/QuizRunner';
import { Paywall, BuyButton, QuizIntro } from '../components/Paywall';
import { StarPrice } from '../components/StarPrice';
import { useLang } from '../lib/i18n';
import { FREE_QUIZ, PAID_QUIZZES, BUNDLE, IG_OFFER, igPrice, quizWhy, quizStep, type Quiz } from '../data/quizzes';
import { usePurchases, owns, canPayWithStars } from '../lib/payments';
import { useHealthPassport } from '../lib/healthPassport';
import { useQuests, discountActive } from '../lib/quests';
import { QuestBadge, openQuests } from '../components/Quests';
import { ReviewSheet } from '../components/ReviewSheet';
import { useQuizResults } from '../lib/quizResults';
import { PER_TASK } from '../lib/quests';

// ANZH Skin Intelligence внутри Telegram: вся методология с anzh.store —
// бесплатный Skin Profile и шесть платных разборов — проходится здесь, без
// перехода на сайт. Физических товаров тут нет намеренно: Telegram
// запрещает продавать за звёзды что-либо, кроме цифрового.

export function AnzhScreen({ onBook }: { onBook: (id: string) => void }) {
  const lang = useLang();
  const ru = lang === 'ru';
  const purchases = usePurchases();
  const passport = useHealthPassport();
  const quests = useQuests();
  // Скидка — следствие выполненного задания, а не нажатия на шильдик
  const igApplied = discountActive(quests);
  const results = useQuizResults();
  const hasResult = (id: string) => results.some((r) => r.quizId === id);

  const hasBundle = owns(purchases, BUNDLE.id);
  const priceFor = (q: Quiz) => (igApplied ? igPrice(q.stars) : q.stars);
  const bundlePrice = igApplied ? igPrice(BUNDLE.stars) : BUNDLE.stars;

  /* Отзыв — задание на скидку, и писать его человек начинает отсюда же */
  const openReviewSheet = () =>
    openSheet({
      title: ru ? 'Отзыв о процедуре' : 'Review a treatment',
      subtitle: ru ? `Засчитается сразу — и даст −${PER_TASK}% на разборы` : `Counts instantly — and gives −${PER_TASK}% on analyses`,
      body: <ReviewSheet onAwardPoints={() => {}} />,
    });

  const runQuiz = (quiz: Quiz) =>
    openSheet({
      title: quiz.title,
      subtitle: `${quiz.questions.length} вопросов · ${quiz.minutes} мин`,
      body: <QuizRunner quiz={quiz} onBook={onBook} />,
    });

  const showQuiz = (quiz: Quiz) => {
    const bought = hasBundle || owns(purchases, quiz.id);
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
  /* `ig` передаётся явно, а не берётся из состояния: тело шторки — это снимок
     React-узла, оно не перерисуется от setState. Без параметра скидка
     «применялась», а цена в открытой шторке оставалась старой. */
  const showPaywall = (quiz: Quiz, ig = igApplied) =>
    openSheet({
      title: ru ? 'Разбор за звёзды' : 'Analysis for Stars',
      subtitle: ru ? 'Оплата внутри Telegram' : 'Paid inside Telegram',
      body: (
        <Paywall
          quiz={quiz}
          price={ig ? igPrice(quiz.stars) : quiz.stars}
          bundlePrice={ig ? igPrice(BUNDLE.stars) : BUNDLE.stars}
          igApplied={ig}
          onApplyIg={() => { closeSheet(); setTimeout(() => openQuests(openReviewSheet, ru), 220); }}
          onBought={() => runQuiz(quiz)}
          onOpenBundle={() => { closeSheet(); setTimeout(showBundle, 220); }}
        />
      ),
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
    const bought = hasBundle || owns(purchases, quiz.id);
    // Пройденный разбор ведёт к результату: показывать там цену — значит
    // предлагать купить то, что уже куплено и пройдено
    if (hasResult(quiz.id)) showResult(quiz);
    else if (quiz.stars > 0 && !bought) showPaywall(quiz);
    else showQuiz(quiz);
  };

  const showBundle = () =>
    openSheet({
      title: BUNDLE.title,
      subtitle: ru ? 'Шесть по цене четырёх' : 'Six for the price of four',
      body: (
        <>
          <p className="muted" style={{ lineHeight: 1.65 }}>
            Шесть разборов закрывают кожу целиком: тип, чувствительность, качество, домашний
            уход, стратегию старения и морфотип — в том порядке, в котором их и стоит проходить.
            По отдельности — {BUNDLE.fullStars}★, вместе — {bundlePrice}★.
          </p>
          <div className="eyebrow sub-head">что входит</div>
          <div className="col" style={{ gap: 6 }}>
            {PAID_QUIZZES.map((q) => (
              <div key={q.id} className="bundle-row">
                <Icon name={q.icon} size={15} strokeWidth={1.8} />
                <span className="bundle-row-title">{q.title}</span>
                <span className="bundle-row-price">{q.stars}★</span>
              </div>
            ))}
          </div>
          <div className="bundle-total">
            <span>По отдельности</span>
            <span className="bundle-strike">{BUNDLE.fullStars}★</span>
          </div>
          <div className="bundle-total accent">
            <span>Вместе</span>
            <StarPrice stars={bundlePrice} size="md" />
          </div>
        </>
      ),
      actions: hasBundle ? (
        <button className="btn btn-primary btn-block" onClick={() => { closeSheet(); setTimeout(() => runQuiz(PAID_QUIZZES[0]), 200); }}>
          Открыть — уже куплено
        </button>
      ) : (
        <BuyButton
          id={BUNDLE.id}
          title={BUNDLE.title}
          stars={bundlePrice}
          unlocks={ru ? 'Все шесть разборов' : 'All six analyses'}
          onOpen={() => runQuiz(PAID_QUIZZES[0])}
        />
      ),
    });

  return (
    <div className="screen anzh-screen">
      {/* Фото — фон всего раздела. Тёмный скрим обязателен: светлый текст на
          фотографии иначе не читается ни в одной теме (канон ROCH). */}
      <div className="anzh-bg" aria-hidden>
        <img src="/brand/anzh-back.png" alt="" />
        <div className="anzh-bg-scrim" />
      </div>

      <header className="header">
        <img src="/brand/anzh-logo.svg" alt="ANZH" style={{ height: 22 }} />
        <span className="chip chip-gold">
          <Icon name="star" size={12} strokeWidth={2} fill="current" /> Stars
        </span>
      </header>

      <div className="anzh-lede">
        <h1 className="anzh-title">ANZH Skin Intelligence</h1>
        <p className="anzh-sub">
          {ru
            ? 'Авторская методология Анжелики: семь разборов, которые проходятся здесь, в Telegram. Результат сразу идёт в твой паспорт кожи.'
            : 'Anjelika’s own methodology: seven analyses taken right here in Telegram. Results go straight into your skin passport.'}
        </p>
        {passport.quizAt && (
          <div className="anzh-passport-chip">
            <Icon name="check" size={13} strokeWidth={2.4} />
            {passport.skinType} · {passport.goal ?? (ru ? 'профиль собран' : 'profile built')}
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

      {/* Скидку надо заслужить: отзыв, подруга или сторис */}
      {!hasBundle && (
        <QuestBadge onOpen={() => openQuests(openReviewSheet, ru)} />
      )}

      <section className="anzh-section">
        <div className="section-head" style={{ padding: 0, marginBottom: 10 }}>
          <div>
            <div className="eyebrow">{ru ? 'разборы · по порядку' : 'analyses · in order'}</div>
            <h2 className="section-title">{ru ? 'Шесть сторон твоей кожи' : 'Six sides of your skin'}</h2>
          </div>
          {igApplied && <span className="chip chip-gold">−{IG_OFFER.percent}%</span>}
        </div>

        <p className="quiz-order-lede">
          {ru
            ? 'Порядок не случайный: каждый следующий разбор читается через предыдущий. Можно брать любой, но снизу вверх он даст меньше.'
            : 'The order matters: each analysis is read through the one before it. You can start anywhere, but bottom-up tells you less.'}
        </p>

        <div className="col quiz-order" style={{ gap: 10 }}>
          {PAID_QUIZZES.map((q, i) => {
            const bought = hasBundle || owns(purchases, q.id);
            const price = priceFor(q);
            const step = quizStep(q.id);
            const why = quizWhy(q.id);
            const passed = hasResult(q.id);
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
                      {igApplied && q.anchorStars && <span className="stars-anchor">{q.stars}★</span>}
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
        </div>
        {!hasBundle && (
          <div className="bundle-cta-price">
            <span className="bundle-strike">{BUNDLE.fullStars}★</span>
            <StarPrice stars={bundlePrice} size="lg" className="bundle-now" />
          </div>
        )}
      </button>

      <p className="faint" style={{ fontSize: 12, marginTop: 16, paddingBottom: 4 }}>
        {ru
          ? 'Звёздами оплачивается цифровое — так устроен Telegram. Домашний уход Анжелика подбирает на приёме.'
          : 'Stars pay for digital goods — that’s how Telegram works. Home care is prescribed at the visit.'}
      </p>
    </div>
  );
}


