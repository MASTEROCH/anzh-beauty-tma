import { useRef, useState } from 'react';
import { Icon } from './Icon';
import { genderOrDefault } from '../lib/gender';
import { asset } from '../lib/asset';
import { closeSheet, toast } from '../lib/ui';
import { select, notify } from '../lib/haptics';
import { saveQuizToPassport, useHealthConsent, type QuizSave, type Sensitivity } from '../lib/healthPassport';
import { AnalysisDisclaimer, LegalLink } from './LegalFooter';
import { useMe, refreshMe } from '../lib/api';
import { grantConsent, legalVersion } from '../lib/api/me';
import { useLang } from '../lib/i18n';
import { sTitle } from '../data/services';
import { liveServices } from '../lib/catalog';
import { servicePrice } from '../lib/money';
import type { Quiz } from '../data/quizzes';
import { scoreQuiz, SECONDARY_LABEL, type Answer } from '../lib/quizScore';
import { saveResult, syncQuizResult, type StoredResult } from '../lib/quizResults';
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

/**
 * Anjelika's procedure for the concern — so the analysis ends with an action. Only the
 * pair the clinic confirmed (K14, Censor R1): "hydration" → biorevitalization. The rest of
 * the prototype map (biorevitalization for wrinkles, tone and sensitivity, a cleansing for
 * pores, both for "nothing in particular" and for every other quiz) had no source at the
 * clinic — those get no picks, and the block is not drawn. Only what is on the showcase
 * now (liveServices: the server's catalog, hidden rows never get there).
 */
export function suggest(concern: string | undefined): Service[] {
  const ids = concern === 'Увлажнение' ? ['biorevit'] : [];
  const live = liveServices();
  return ids.map((id) => live.find((s) => s.id === id)).filter((s): s is Service => !!s).slice(0, 3);
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
  /* Что стало с результатом после последнего ответа — для честной строки.
     null — ещё не отвечали до конца или открыт сохранённый результат. */
  const [saveState, setSaveState] = useState<QuizSave | 'memory' | null>(null);
  const consent = useHealthConsent();

  const done = step >= quiz.questions.length;
  const question = quiz.questions[step];

  /* Двойной тап по варианту отвечал и на СЛЕДУЮЩИЙ вопрос: второй палец
     попадал в кнопку нового экрана. На сайте — _nextQBusy 400 мс, здесь так же. */
  const busy = useRef(false);
  const commit = (value: Answer) => {
    if (busy.current) return;
    busy.current = true;
    window.setTimeout(() => { busy.current = false; }, 350);
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

  /** Результат держится в памяти запуска; в анкету уходит только то, что там
      уместно, и на сервер — только с согласием на данные о здоровье
      (lib/healthPassport.ts, saveQuizToPassport). */
  const writePassport = (all: Answer[]) => {
    const scored = scoreQuiz(quiz, all);
    let stored: StoredResult | null = null;
    if (scored) {
      stored = {
        quizId: quiz.id,
        quizTitle: quiz.title,
        resultKey: scored.key,
        title: scored.title,
        sub: scored.sub,
        secondary: scored.secondary,
        answers: all,
        takenAt: Date.now(),
      };
      saveResult(stored);
    }
    // Каждый разбор — на сервер (с согласием): его увидит «Паспорт» и студия
    const toServer = stored ? syncQuizResult(stored) : Promise.resolve<'kept_local'>('kept_local');

    if (quiz.id === 'profile') {
      // «Что беспокоит» — множественный выбор (как на сайте); в анкету идёт первое
      const c2 = all[2];
      const concernIdx = Array.isArray(c2) ? (c2[0] ?? 5) : typeof c2 === 'number' ? c2 : 5;
      const sensIdx = typeof all[3] === 'number' ? all[3] : 1;
      const careIdx = typeof all[4] === 'number' ? all[4] : 0;
      void saveQuizToPassport({
        goal: PROFILE_CONCERN[concernIdx] || undefined,
        sensitivity: PROFILE_SENS[sensIdx] ?? 'medium',
        experience: PROFILE_CARE[careIdx],
        quizAt: Date.now(),
      }).then(setSaveState);
      return;
    }
    if (quiz.id === 'skintype' && scored) {
      void saveQuizToPassport({ skinType: SKIN_TYPE_LABEL[scored.key] ?? scored.title, quizAt: Date.now() })
        .then(setSaveState);
      return;
    }
    void toServer.then((st) => setSaveState(st === 'kept_local' ? 'memory' : st));
  };

  /* ── Вопрос ── */
  if (!done) {
    const qText = ru ? question.q : question.qEn ?? question.q;
    const male = genderOrDefault() === 'm';
    const options = (ru ? (male && question.aMale ? question.aMale : question.a) : question.aEn ?? question.a) ?? [];
    const isMulti = !!question.multi;
    const photos = question.photos ? question.photos[male ? 'm' : 'w'] : null;
    const current = answers[step];

    return (
      <div>
        <div className="quiz-progress">
          {quiz.questions.map((_, i) => (
            <span key={i} className={`quiz-pip ${i < step ? 'done' : ''} ${i === step ? 'active' : ''}`} />
          ))}
        </div>
        <div className="quiz-step" key={step}>
          <div className="eyebrow mb-sm">
            {ru ? 'вопрос' : 'question'} {step + 1} {ru ? 'из' : 'of'} {quiz.questions.length}
            {isMulti && ` · ${ru ? 'можно несколько' : 'multiple choice'}`}
          </div>
          <h3 className="quiz-q">{qText}</h3>
          <div className={`quiz-options${photos ? ' quiz-options--photo' : ''}`}>
            {options.map((o, i) => {
              const picked = isMulti && multi.includes(i);
              return (
                <button
                  key={o}
                  className={`quiz-option${picked || (!isMulti && current === i) ? ' picked' : ''}${photos ? ' quiz-option--photo' : ''}`}
                  onClick={() => {
                    select();
                    if (isMulti) setMulti((m) => (m.includes(i) ? m.filter((x) => x !== i) : [...m, i]));
                    else commit(i);
                  }}
                >
                  {photos?.[i] && <img className="quiz-option-img" src={asset(photos[i])} alt="" loading="lazy" decoding="async" />}
                  <span>{o}</span>
                  {photos ? null : isMulti
                    ? <Icon name={picked ? 'check' : 'plus'} size={16} strokeWidth={2.2} />
                    : <Icon name="chevron-right" size={17} strokeWidth={2} />}
                </button>
              );
            })}
          </div>
          {isMulti && (
            <button
              className="btn btn-primary btn-block mt"
              disabled={multi.length === 0}
              onClick={() => commit([...multi].sort((a, b) => a - b))}
            >
              {multi.length === 0 ? (ru ? 'Выбери хотя бы один' : 'Pick at least one') : (ru ? 'Дальше' : 'Next')}
            </button>
          )}
        </div>
        {step > 0 && (
          <button
            className="btn btn-secondary btn-block mt-sm"
            onClick={() => {
              // Назад — с прошлым выбором: раньше множественный выбор сбрасывался
              const prev = answers[step - 1];
              setMulti(Array.isArray(prev) ? prev : []);
              setStep((s) => s - 1);
            }}
          >
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
  const a2 = answers[2];
  const concern = quiz.id === 'profile' ? PROFILE_CONCERN[Array.isArray(a2) ? a2[0] : typeof a2 === 'number' ? a2 : -1] : undefined;
  const picks = suggest(concern);
  const hasRoutine = !!routineFor(quiz.id, result.key, lang);
  // Nothing to pick — nothing to unlock
  const locked = quiz.id === 'profile' && !shared && picks.length > 0;

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

      {/* «Не диагноз» — внутри результата и НАД итогом, не в свёрнутом блоке
          (ui-line result.disclaimer Законника). Раньше оговорку подкладывали
          обёртки в AnzhScreen и анкете — путь через кабинет оставался без неё. */}
      <AnalysisDisclaimer lang={lang} />

      {saveState && <SaveNote state={saveState} consent={!!consent} lang={lang} />}
      {/* Результат должен попасть в «Паспорт» (Роч 15.10): без согласия на
          данные о здоровье сервер его не хранит — даём согласие прямо здесь,
          явной галочкой со ссылкой на документ, и пересохраняем. */}
      {saveState === 'kept_local' && !consent && (
        <ConsentSave lang={lang} onSaved={() => writePassport(answers)} />
      )}

      <p className="quiz-desc">{desc}</p>
      {(ru ? result.note : result.noteEn ?? result.note) && (
        <p className="quiz-note">{ru ? result.note : result.noteEn ?? result.note}</p>
      )}

      {traits.length > 0 && (
        <div className="row" style={{ flexWrap: 'wrap', gap: 6, marginTop: 14 }}>
          {traits.map((t) => <span key={t} className="hp-chip on">{t}</span>)}
        </div>
      )}

      {result.secondary && result.secondary.length > 0 && (
        <>
          <div className="eyebrow sub-head">{ru ? 'дополнительно' : 'also noted'}</div>
          <div className="row" style={{ flexWrap: 'wrap', gap: 6 }}>
            {result.secondary.map((s) => (
              <span key={s} className="hp-chip warn">{SECONDARY_LABEL[s]?.[lang] ?? s}</span>
            ))}
          </div>
        </>
      )}

      {procedures.length > 0 && (
        <>
          <div className="eyebrow sub-head">{ru ? 'что делать у косметолога' : 'what to do at the clinic'}</div>
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
            <div className="eyebrow sub-head">{ru ? 'домашний уход' : 'home care'}</div>
            <ul className="info-list">
              {result.prods.map((p) => <li key={p.n}><b>{p.n}</b> — {p.d}</li>)}
            </ul>
          </>
        )
      )}

      {picks.length > 0 && <>
      <div className="eyebrow sub-head">{ru ? 'процедуры анжелики' : 'anjelika’s treatments'}</div>
      <p className="faint" style={{ fontSize: 12, margin: '0 0 8px' }}>
        {ru
          ? 'Подходит ли тебе процедура, Анжелика решает на приёме — с учётом твоей анкеты.'
          : 'Whether a treatment suits you is decided by Anjelika at the visit, based on your questionnaire.'}
      </p>
      <div className={`quiz-picks ${locked ? 'locked' : ''}`}>
        {picks.map((s) => (
          <button key={s.id} className="quiz-pick" onClick={() => { if (!locked) { closeSheet(); onBook(s.id); } }}>
            <div className="quiz-pick-icon"><Icon name={s.icon} size={18} strokeWidth={1.8} /></div>
            <div className="quiz-pick-body">
              <div className="quiz-pick-title">{sTitle(s, lang)}</div>
              {servicePrice(s, lang) !== null && <div className="quiz-pick-sub">{servicePrice(s, lang)}</div>}
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
      </>}

      <div className="review-submit-row mt-md">
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
            <button className="btn btn-secondary btn-block" onClick={() => setShared(true)}>
              {ru ? 'Я записываюсь — открыть сразу' : 'I’m booking — open now'}
            </button>
          </>
        ) : (
          <>
            {picks.length > 0 && (
              <button className="btn btn-primary btn-block" onClick={() => { closeSheet(); onBook(picks[0].id); }}>
                {ru ? 'Записаться' : 'Book'} · {sTitle(picks[0], lang)}
              </button>
            )}
            <button className="btn btn-quiet btn-block" onClick={closeSheet}>{ru ? 'Позже' : 'Later'}</button>
          </>
        )}
      </div>
    </div>
  );
}

/** Согласие на данные о здоровье прямо в результате — чтобы разбор сохранился в «Паспорт». */
function ConsentSave({ lang, onSaved }: { lang: 'ru' | 'en'; onSaved: () => void }) {
  const ru = lang === 'ru';
  const { me } = useMe();
  const version = legalVersion(me, 'health_data');
  const [tick, setTick] = useState(false);
  const [busy, setBusy] = useState(false);
  const save = async () => {
    if (!tick || busy || !version) return;
    setBusy(true);
    try {
      await grantConsent('health_data', version, lang);
      await refreshMe();
      onSaved();
      notify('success');
      toast(ru ? 'Сохранено в «Паспорт» — Анжелика увидит до приёма' : 'Saved to “Passport” — Anjelika sees it before the visit', 'success');
    } catch {
      notify('error');
      toast(ru ? 'Не сохранилось — проверьте интернет' : 'Not saved — check your connection');
    } finally { setBusy(false); }
  };
  return (
    <div className="qs-consent">
      <button type="button" role="checkbox" aria-checked={tick} className={`onb-agree${tick ? ' on' : ''}`} onClick={() => { select(); setTick(!tick); }}>
        <span className="onb-check">{tick && <Icon name="check" size={14} strokeWidth={2.4} />}</span>
        <span className="onb-agree-text">{ru ? `${genderOrDefault() === 'm' ? 'Согласен' : 'Согласна'} на обработку данных о здоровье — ответы увидит только Анжелика` : 'I consent to processing of health data — only Anjelika sees the answers'}</span>
      </button>
      <p className="qs-consent-doc"><LegalLink doc="health-consent" version={version}>{ru ? 'Текст согласия' : 'Consent text'}</LegalLink></p>
      <button className="btn btn-primary btn-block" disabled={!tick || busy || !version} aria-busy={busy} onClick={() => { void save(); }}>
        <Icon name="check" size={16} strokeWidth={2.4} /> {busy ? (ru ? 'Сохраняю…' : 'Saving…') : (ru ? 'Сохранить в Паспорт' : 'Save to Passport')}
      </button>
    </div>
  );
}

/** Честная строка: сохранился ли результат и где. */
function SaveNote({ state, consent, lang }: { state: QuizSave | 'memory'; consent: boolean; lang: 'ru' | 'en' }) {
  const ru = lang === 'ru';
  const text =
    state === 'saved'
      ? (ru ? 'Тип кожи и ответы профиля сохранены в анкете.' : 'Skin type and profile answers are saved to your questionnaire.')
      : state === 'failed'
        ? (ru ? 'Не удалось сохранить в анкету — нет связи с сервером. Результат виден, пока открыто приложение.' : 'Could not save to your questionnaire — no connection. The result stays until you close the app.')
        : state === 'kept_local' && !consent
          ? (ru ? 'Результат не сохранён: нет согласия на данные о здоровье. Дать его можно в анкете, в разделе «Паспорт».' : 'Result not saved: no health-data consent. You can give it in the questionnaire, in the Passport tab.')
          : (ru ? 'Результат виден, пока открыто приложение: сохранять разборы мы пока не умеем.' : 'The result stays until you close the app: saving analyses is not available yet.');
  return (
    <p className="legal-note" role="status" data-quiz-save={state} style={{ marginTop: 'var(--sp-sm)', maxWidth: 'none' }}>
      {text}
    </p>
  );
}
