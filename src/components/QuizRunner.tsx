import { useState } from 'react';
import { Icon } from './Icon';
import { closeSheet, toast } from '../lib/ui';
import { select, notify } from '../lib/haptics';
import { updateHealthPassport, type Sensitivity } from '../lib/healthPassport';
import { useLang } from '../lib/i18n';
import { services, sTitle } from '../data/services';
import type { Quiz } from '../data/quizzes';
import { scoreQuiz, SECONDARY_LABEL, type Answer } from '../lib/quizScore';
import { saveResult } from '../lib/quizResults';
import { Routine } from './Routine';
import { routineFor } from '../data/routines';
import type { Service } from '../data/services';

// Прохождение настоящих тестов ANZH Skin Intelligence. Результат считает
// lib/quizScore.ts — перенос calcResult с сайта, поэтому индексы ответов
// здесь сохраняются как есть, без переупорядочивания.

/* Skin Profile заполняет паспорт кожи — ради этого Анжелика и хотела тесты
   внутри приложения: «формируется паспорт пациента, и ты заранее знаешь,
   кто с чем пришёл». Индексы соответствуют вопросам profile. */
const PROFILE_CONCERN = ['Поры и высыпания', 'Увлажнение', 'Овал и морщины', 'Сияние и тон', 'Чувствительность', ''];
const PROFILE_SENS: Sensitivity[] = ['high', 'medium', 'low'];
const PROFILE_CARE = ['Впервые у косметолога', 'Базовый уход', 'Многоступенчатый уход', 'Профессиональный уход'];

/** Тип кожи из теста skintype — тоже уходит в паспорт */
const SKIN_TYPE_LABEL: Record<string, string> = {
  normal: 'Нормальная', dry: 'Сухая', oily: 'Жирная', combo: 'Комбинированная',
  dehydrated: 'Обезвоженная', sensitive: 'Чувствительная', acne: 'Проблемная', aging: 'Зрелая',
};

/** Процедуры Анжелики под запрос — чтобы разбор заканчивался действием */
function suggest(concern: string | undefined): Service[] {
  const ids =
    concern === 'Поры и высыпания' ? ['deep-cleansing', 'led-therapy', 'almagold-peel']
    : concern === 'Овал и морщины' ? ['rf-lifting', 'pdrn', 'biorevit']
    : concern === 'Сияние и тон' ? ['almagold-peel', 'biorevit', 'led-therapy']
    : concern === 'Чувствительность' ? ['led-therapy', 'biorevit']
    : concern === 'Увлажнение' ? ['biorevit', 'pdrn']
    : ['deep-cleansing', 'biorevit', 'led-therapy'];
  return ids.map((id) => services.find((s) => s.id === id)!).filter(Boolean).slice(0, 3);
}

export function QuizRunner({
  quiz,
  onBook,
  saved,
}: {
  quiz: Quiz;
  onBook: (id: string) => void;
  /** Ответы прошлого прохождения — открывают сразу результат, не переспрашивая */
  saved?: Answer[];
}) {
  const lang = useLang();
  const ru = lang === 'ru';
  const [step, setStep] = useState(saved ? quiz.questions.length : 0);
  const [answers, setAnswers] = useState<Answer[]>(saved ?? []);
  const [multi, setMulti] = useState<number[]>([]);
  const [shared, setShared] = useState(false);

  const done = step >= quiz.questions.length;
  const question = quiz.questions[step];

  const commit = (value: Answer) => {
    const next = [...answers];
    next[step] = value;
    setAnswers(next);
    setMulti([]);
    setStep((s) => s + 1);
    if (step === quiz.questions.length - 1) {
      writePassport(next);
      notify('success');
    }
  };

  /** Результат сохраняется всегда, в паспорт уходит только то, что там уместно */
  const writePassport = (all: Answer[]) => {
    const scored = scoreQuiz(quiz, all);
    if (scored) {
      saveResult({
        quizId: quiz.id,
        quizTitle: quiz.title,
        resultKey: scored.key,
        title: scored.title,
        sub: scored.sub,
        secondary: scored.secondary,
        answers: all,
        takenAt: Date.now(),
      });
    }

    if (quiz.id === 'profile') {
      const concernIdx = typeof all[2] === 'number' ? all[2] : 5;
      const sensIdx = typeof all[3] === 'number' ? all[3] : 1;
      const careIdx = typeof all[4] === 'number' ? all[4] : 0;
      updateHealthPassport({
        goal: PROFILE_CONCERN[concernIdx] || undefined,
        sensitivity: PROFILE_SENS[sensIdx] ?? 'medium',
        experience: PROFILE_CARE[careIdx],
        quizAt: Date.now(),
      });
      return;
    }
    if (quiz.id === 'skintype' && scored) {
      updateHealthPassport({ skinType: SKIN_TYPE_LABEL[scored.key] ?? scored.title, quizAt: Date.now() });
    }
  };

  /* ── Вопрос ── */
  if (!done) {
    const qText = ru ? question.q : question.qEn ?? question.q;
    const options = (ru ? question.a : question.aEn ?? question.a) ?? [];
    const isMulti = !!question.multi;

    return (
      <div>
        <div className="quiz-progress">
          {quiz.questions.map((_, i) => (
            <span key={i} className={`quiz-pip ${i < step ? 'done' : ''} ${i === step ? 'active' : ''}`} />
          ))}
        </div>
        <div className="quiz-step" key={step}>
          <div className="eyebrow" style={{ marginBottom: 8 }}>
            {ru ? 'вопрос' : 'question'} {step + 1} {ru ? 'из' : 'of'} {quiz.questions.length}
            {isMulti && ` · ${ru ? 'можно несколько' : 'multiple choice'}`}
          </div>
          <h3 className="quiz-q">{qText}</h3>
          <div className="quiz-options">
            {options.map((o, i) => {
              const picked = isMulti && multi.includes(i);
              return (
                <button
                  key={o}
                  className={`quiz-option${picked ? ' picked' : ''}`}
                  onClick={() => {
                    select();
                    if (isMulti) setMulti((m) => (m.includes(i) ? m.filter((x) => x !== i) : [...m, i]));
                    else commit(i);
                  }}
                >
                  <span>{o}</span>
                  {isMulti
                    ? <Icon name={picked ? 'check' : 'plus'} size={16} strokeWidth={2.2} />
                    : <Icon name="chevron-right" size={17} strokeWidth={2} />}
                </button>
              );
            })}
          </div>
          {isMulti && (
            <button
              className="btn btn-primary btn-block"
              style={{ marginTop: 14 }}
              disabled={multi.length === 0}
              onClick={() => commit([...multi].sort((a, b) => a - b))}
            >
              {multi.length === 0 ? (ru ? 'Выбери хотя бы один' : 'Pick at least one') : (ru ? 'Дальше' : 'Next')}
            </button>
          )}
        </div>
        {step > 0 && (
          <button className="btn btn-ghost btn-block" style={{ marginTop: 10 }} onClick={() => setStep((s) => s - 1)}>
            {ru ? 'Назад' : 'Back'}
          </button>
        )}
      </div>
    );
  }

  /* ── Результат ── */
  const result = scoreQuiz(quiz, answers);
  if (!result) return null;

  const title = ru ? result.title : result.titleEn ?? result.title;
  const sub = ru ? result.sub : result.subEn ?? result.sub;
  const desc = ru ? result.desc : result.descEn ?? result.desc;
  const traits = (ru ? result.traits : result.traitsEn ?? result.traits) ?? [];
  const procedures = (ru ? result.procedures : result.proceduresEn ?? result.procedures) ?? [];
  const concern = quiz.id === 'profile' && typeof answers[2] === 'number' ? PROFILE_CONCERN[answers[2]] : undefined;
  const picks = suggest(concern);
  const hasRoutine = !!routineFor(quiz.id, result.key, lang);
  const locked = quiz.id === 'profile' && !shared;

  return (
    <div className="quiz-result">
      {/* Вручение. Раньше разбор просто появлялся следующим экраном — человек
          отвечал на 14 вопросов (а за платный ещё и платил) и не получал ни
          одной секунды, отмечающей, что это результат, а не ещё один шаг. */}
      {!saved && (
      <div className="quiz-congrats">
        <span className="quiz-congrats-burst" aria-hidden />
        <div className="quiz-congrats-text">
          {ru ? 'Готово! Вот твой разбор' : 'Done! Here is your analysis'}
        </div>
      </div>
      )}

      <div className="quiz-result-head">
        <div className="quiz-result-badge"><Icon name={quiz.icon} size={22} strokeWidth={1.7} /></div>
        <div>
          <div className="quiz-result-type">{title}</div>
          <div className="faint" style={{ fontSize: 12 }}>{sub}</div>
        </div>
      </div>

      <p className="quiz-desc">{desc}</p>

      {traits.length > 0 && (
        <div className="row" style={{ flexWrap: 'wrap', gap: 6, marginTop: 14 }}>
          {traits.map((t) => <span key={t} className="hp-chip on">{t}</span>)}
        </div>
      )}

      {result.secondary && result.secondary.length > 0 && (
        <>
          <div className="eyebrow" style={{ margin: '18px 0 8px' }}>{ru ? 'дополнительно' : 'also noted'}</div>
          <div className="row" style={{ flexWrap: 'wrap', gap: 6 }}>
            {result.secondary.map((s) => (
              <span key={s} className="hp-chip warn">{SECONDARY_LABEL[s]?.[lang] ?? s}</span>
            ))}
          </div>
        </>
      )}

      {procedures.length > 0 && (
        <>
          <div className="eyebrow" style={{ margin: '18px 0 8px' }}>{ru ? 'что делать у косметолога' : 'what to do at the clinic'}</div>
          <ul className="info-list">
            {procedures.slice(0, 5).map((p) => <li key={p}>{p}</li>)}
          </ul>
        </>
      )}

      {/* Полный протокол ухода, если он есть для этого исхода; короткий
          список — запасной вариант для исходов, где протокола нет */}
      {hasRoutine ? (
        <Routine quizId={quiz.id} resultKey={result.key} />
      ) : (
        result.prods && result.prods.length > 0 && (
          <>
            <div className="eyebrow" style={{ margin: '18px 0 8px' }}>{ru ? 'домашний уход' : 'home care'}</div>
            <ul className="info-list">
              {result.prods.map((p) => <li key={p.n}><b>{p.n}</b> — {p.d}</li>)}
            </ul>
          </>
        )
      )}

      <div className="eyebrow" style={{ margin: '18px 0 8px' }}>{ru ? 'процедуры анжелики' : 'anjelika’s treatments'}</div>
      <div className={`quiz-picks ${locked ? 'locked' : ''}`}>
        {picks.map((s) => (
          <button key={s.id} className="quiz-pick" onClick={() => { if (!locked) { closeSheet(); onBook(s.id); } }}>
            <div className="quiz-pick-icon"><Icon name={s.icon} size={18} strokeWidth={1.8} /></div>
            <div className="quiz-pick-body">
              <div className="quiz-pick-title">{sTitle(s, lang)}</div>
              <div className="quiz-pick-sub">${s.priceUsd}</div>
            </div>
            {!locked && <Icon name="chevron-right" size={18} strokeWidth={2} />}
          </button>
        ))}
        {locked && (
          <div className="quiz-lock">
            <Icon name="gift" size={20} strokeWidth={1.8} />
            <div className="quiz-lock-text">
              {ru
                ? 'Подбор открыт бесплатно. Поделись разбором с подругой — или просто запишись, и я открою его сразу.'
                : 'The picks are free. Share the analysis with a friend — or just book, and I’ll open them right away.'}
            </div>
          </div>
        )}
      </div>

      <div className="review-submit-row" style={{ marginTop: 16 }}>
        {locked ? (
          <>
            <button
              className="btn btn-primary btn-block"
              onClick={() => {
                const nav = navigator as Navigator & { share?: (d: { title?: string; text?: string; url?: string }) => Promise<void> };
                const payload = {
                  title: 'ANZH Skin Intelligence',
                  text: ru ? 'Прошла разбор кожи у Анжелики — он бесплатный, попробуй' : 'I took Anjelika’s free skin analysis — try it',
                  url: 'https://t.me/anzh_cosmetology',
                };
                if (nav.share) nav.share(payload).catch(() => {});
                else navigator.clipboard?.writeText(`${payload.text} ${payload.url}`);
                setShared(true);
                toast(ru ? 'Подбор открыт 💛' : 'Picks unlocked 💛', 'success');
              }}
            >
              <Icon name="share" size={16} strokeWidth={2} /> {ru ? 'Поделиться и открыть' : 'Share and unlock'}
            </button>
            <button className="btn btn-ghost btn-block" onClick={() => setShared(true)}>
              {ru ? 'Я записываюсь — открыть сразу' : 'I’m booking — open now'}
            </button>
          </>
        ) : (
          <>
            <button className="btn btn-primary btn-block" onClick={() => { closeSheet(); onBook(picks[0].id); }}>
              {ru ? 'Записаться' : 'Book'} · {sTitle(picks[0], lang)}
            </button>
            <button className="btn btn-quiet btn-block" onClick={closeSheet}>{ru ? 'Позже' : 'Later'}</button>
          </>
        )}
      </div>
    </div>
  );
}
