import { useEffect, useRef, useState } from 'react';
import { Icon, type IconName } from '../components/Icon';
import { LiveAnjelika } from '../components/LiveAvatar';
import { getTgUser } from '../lib/telegram';
import { setGender, useGender, type Gender, g as gg } from '../lib/gender';
import { useLang, type Lang } from '../lib/i18n';
import { LegalLink } from '../components/LegalFooter';
import { acceptPolicy, BUNDLED_POLICY_VERSION, resolvePolicyReask } from '../lib/myData';
import { initSession, sessionState } from '../lib/session';
import { currentMe, refreshMe, useMe } from '../lib/api';
import { grantConsent, hasConsent, isVersionMismatch, legalVersion } from '../lib/api/me';
import { AI_ASSISTANT } from '../lib/features';

type PolicySend = 'sent' | 'already' | 'local' | 'mismatch';

/**
 * Согласие с политикой — по нажатию «Создать кабинет» с отмеченной галочкой.
 * POST /me/consents {kind:'policy', version: Me.legal.policy, lang: язык
 * интерфейса}. Вход идёт в фоне с первого кадра, к последнему шагу он почти
 * всегда готов; если ещё идёт — дожидаемся его.
 *
 *  · 'mismatch' — 409 `version_mismatch`: пока человек читал, вышла новая
 *    редакция. Профиль перечитан, галочка снимается, экран показывает новую
 *    редакцию; онбординг НЕ закрывается — согласие на старый текст не
 *    засчитывается молча.
 *  · 'local' — гость, сервер не назвал версию или сеть: отметка ложится на
 *    устройство (lib/myData.ts, `anzh_policy_pending_v1`) ВМЕСТЕ с редакцией,
 *    которую человек видел (`shown`), и ждёт входа. После входа она уйдёт,
 *    только если эта редакция всё ещё текущая; иначе спросим заново.
 */
async function sendPolicyConsent(lang: Lang, shown: string): Promise<PolicySend> {
  if (sessionState().status === 'pending') await initSession();
  if (sessionState().status !== 'user') {
    acceptPolicy(shown, lang);
    return 'local';
  }
  const me = currentMe() ?? (await refreshMe());
  if (hasConsent(me, 'policy')) return 'already';
  const version = legalVersion(me, 'policy');
  if (!version) {
    acceptPolicy(shown, lang);
    return 'local';
  }
  try {
    await grantConsent('policy', version, lang);
  } catch (e) {
    if (isVersionMismatch(e)) {
      await refreshMe();
      return 'mismatch';
    }
    acceptPolicy(version, lang);
    return 'local';
  }
  void refreshMe();
  return 'sent';
}

export interface OnboardingResult {
  name: string;
  gender: Gender;
  instagram: string;
  phone: string;
}

interface Props {
  onComplete: (data: OnboardingResult) => void;
  onSkip: () => void;
  /** Выбор языка на первом шаге: App меняет язык всего приложения */
  onLang: (l: Lang) => void;
}

/** `ai` — the line promises the assistant: shown only while AI_ASSISTANT is on (lib/features.ts). */
type Benefit = { icon: IconName; title: string; sub: string; titleEn: string; subEn: string; accent: 'gold' | 'emerald'; ai?: true };

const BENEFITS: Benefit[] = [
  {
    icon: 'calendar',
    title: 'Запись в 1 тап',
    sub: 'Без звонков и переписок. Выбираешь слот — Анжелика подтверждает.',
    titleEn: 'Book in one tap',
    subEn: 'No calls or long chats. Pick a slot — Anjelika confirms it.',
    accent: 'gold',
  },
  /* Здесь стоял пункт про баллы за визит: за визит баллы не начисляются,
     а баллы и уровни на запуск скрыты (решение John 24.09). Вместо них —
     то, что сервер действительно шлёт клиентке: напоминание за 24 часа.
     Условно, а не безусловно (Хейтер №18, решение John): напоминание
     ставится, только если запись подтверждена раньше чем за сутки до визита
     и бот может писать (Start). Подтверждённой позже клиентке время уже
     пришло в «запись подтверждена» — второго сообщения нет.
     КТ-7 С2 (Законник Ю1): the line asks for Start and promises only messages
     about bookings, no reminder. RU only — this slide has no English slot.
     Start 1b (Хейтер H-3, checked by Законник): the title promises no reminder either. */
  {
    icon: 'clock',
    title: 'Сообщения о записях',
    sub: 'Нажми Start у бота — тогда он сможет писать тебе о записях.',
    titleEn: 'Booking messages',
    subEn: 'Press Start in the bot so it can message you about your bookings.',
    accent: 'emerald',
  },
  /* ИИ не проверяет противопоказания и не должен так называться (разбор
     Законника А.7, высокая серьёзность): это делает Анжелика. */
  {
    icon: 'message',
    title: 'AI-консультант 24/7',
    sub: 'Подскажет по процедурам и ценам; противопоказания проверяет Анжелика.',
    titleEn: 'AI assistant 24/7',
    subEn: 'Answers about treatments and prices; Anjelika checks contraindications.',
    accent: 'gold',
    ai: true,
  },
  /* Бессрочное «помнит всё» спорило со сроком хранения и с правом удалить.
     Раздел назван по вкладке, которая реально есть в нижнем меню:
     «Профиля» в приложении нет — анкета живёт во вкладке «Паспорт», и
     кнопка удаления стоит в самой анкете. */
  {
    icon: 'shield-check',
    title: 'Паспорт кожи',
    sub: 'Анкета с аллергиями и противопоказаниями. Хранится, пока ты пользуешься приложением; удалить можно в разделе «Паспорт».',
    titleEn: 'Skin passport',
    subEn: 'A questionnaire with allergies and contraindications. Kept while you use the app; delete it any time in “Passport”.',
    accent: 'emerald',
  },
];

const STEP_COUNT = 5;

export function OnboardingScreen({ onComplete, onSkip, onLang }: Props) {
  const tg = getTgUser();
  const [step, setStep] = useState(0);
  const [name, setName] = useState(tg?.firstName ?? '');
  const [gender, setGenderLocal] = useState<Gender | null>(null);
  const [instagram, setInstagram] = useState('');
  const [phone, setPhone] = useState('');
  /* Согласие с политикой НЕ отмечено заранее: заранее поставленная галочка
     согласием не считается. Согласия на данные о здоровье здесь нет вовсе —
     оно спрашивается отдельно, в анкете, и отказ от него ничего не ломает.
     Что сервер получает от Telegram при ВХОДЕ (до этой галочки), экран
     говорит прямо — строкой над галочкой (Хейтер №5, вариант «б»). */
  const [agree, setAgree] = useState(false);
  const lang = useLang();
  const ru = lang === 'ru';
  const { me } = useMe();
  /* Редакция, которую человек видит: названная сервером, а до входа — та,
     что лежит в этой сборке (public/legal/privacy.html). Её же несёт
     отложенная отметка гостя. */
  const policyVersion = legalVersion(me, 'policy') ?? BUNDLED_POLICY_VERSION;
  const [submitting, setSubmitting] = useState(false);
  /** Пока человек читал, вышла новая редакция политики (409). */
  const [staleVersion, setStaleVersion] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);

  // Каждый шаг начинается сверху: без сброса скролла шаг с формой открывается
  // на середине предыдущего слайда.
  useEffect(() => { bodyRef.current?.scrollTo({ top: 0 }); }, [step]);

  // Пол уходит в глобальный стор сразу, как его выбрали — все следующие экраны
  // (включая «3 шага — и ты записана») читают уже его.
  useEffect(() => {
    if (gender) setGender(gender);
  }, [gender]);

  const next = () => setStep((s) => Math.min(STEP_COUNT - 1, s + 1));
  const prev = () => setStep((s) => Math.max(0, s - 1));

  const submit = async () => {
    if (!agree || submitting || !gender) return;
    setSubmitting(true);
    setStaleVersion(false);
    setGender(gender);
    /* Согласие с политикой — по действию человека (галочка выше), версия
       та, что сервер назвал в Me.legal.policy, язык — язык интерфейса. */
    const sent = await sendPolicyConsent(lang, policyVersion);
    if (sent === 'mismatch') {
      setAgree(false);
      setStaleVersion(true);
      setSubmitting(false);
      return;
    }
    setTimeout(() => onComplete({
      name: name.trim() || (tg?.firstName ?? ''),
      gender,
      instagram: instagram.trim().replace(/^@/, ''),
      phone: phone.trim(),
    }), 700);
  };

  const canContinue =
    step === 1 ? name.trim().length > 1 && gender !== null :
    step === 4 ? agree :
    true;

  return (
    <div className={`onb-screen${step === 0 ? ' onb-screen--lang' : ''}`}>
      <div className="onb-orbs" aria-hidden />
      <header className="onb-header">
        {step > 0 ? (
          <button className="header-back" onClick={prev} aria-label={ru ? 'Назад' : 'Back'}>
            <Icon name="chevron-left" size={20} strokeWidth={2.2} />
          </button>
        ) : (
          <img src="/brand/anzh-logo.svg" alt="ANZH" style={{ height: 22 }} />
        )}
        <div className="onb-dots" aria-label={ru ? `Шаг ${step + 1} из ${STEP_COUNT}` : `Step ${step + 1} of ${STEP_COUNT}`}>
          {Array.from({ length: STEP_COUNT }, (_, i) => (
            <span key={i} className={`onb-dot ${i === step ? 'active' : ''} ${i < step ? 'done' : ''}`} />
          ))}
        </div>
        {step < STEP_COUNT - 1 ? (
          <button className="onb-skip" onClick={onSkip}>{ru ? 'Пропустить' : 'Skip'}</button>
        ) : (
          <div style={{ width: 36 }} />
        )}
      </header>

      <div className="onb-body" ref={bodyRef}>
        {step === 0 && <WelcomeSlide firstName={tg?.firstName} lang={lang} />}
        {step === 1 && (
          <IdentitySlide
            name={name}
            setName={setName}
            gender={gender}
            setGender={setGenderLocal}
            tgHandle={tg?.username}
            ru={ru}
          />
        )}
        {step === 2 && <BenefitsSlide ru={ru} />}
        {step === 3 && <HowItWorksSlide gender={gender ?? 'f'} ru={ru} />}
        {step === 4 && (
          <SignupSlide
            name={name}
            gender={gender ?? 'f'}
            instagram={instagram}
            setInstagram={setInstagram}
            phone={phone}
            setPhone={setPhone}
            agree={agree}
            setAgree={(v) => { setAgree(v); if (v) setStaleVersion(false); }}
            lang={lang}
            policyVersion={policyVersion}
            staleVersion={staleVersion}
          />
        )}
      </div>

      <div className="onb-cta">
        {/* Язык — первым же выбором (Роч 15.10): у Анжелики много англоязычных
            пациентов — турки, грузины, арабы, израильтяне, американцы; кто не
            читает по-русски, обычно читает по-английски. По умолчанию — язык
            Telegram (lib/i18n.ts). Стоит в закреплённой панели над кнопкой:
            в теле слайда на iPhone в браузере он уходил ПОД кнопку «Знакомимся»
            (кадр Роча 15.10) — выбор, который не видно, не выбор. */}
        {step === 0 && (
          <div className="onb-lang" role="radiogroup" aria-label="Язык · Language">
            {([['ru', 'Русский'], ['en', 'English']] as Array<[Lang, string]>).map(([l, label]) => (
              <button
                key={l}
                role="radio"
                aria-checked={lang === l}
                className={`onb-lang-btn${lang === l ? ' on' : ''}`}
                onClick={() => { if (lang !== l) onLang(l); }}
                lang={l}
              >
                {label}
              </button>
            ))}
          </div>
        )}
        <button
          className="btn btn-primary btn-block"
          onClick={step === STEP_COUNT - 1 ? () => { void submit(); } : next}
          disabled={!canContinue || submitting}
        >
          {step === 0 && (ru ? 'Знакомимся →' : 'Let’s start →')}
          {(step === 1 || step === 2) && (ru ? 'Дальше →' : 'Next →')}
          {step === 3 && (ru ? 'Создать кабинет →' : 'Create my account →')}
          {step === 4 && (submitting ? (ru ? 'Создаю…' : 'Creating…') : (ru ? 'Создать кабинет' : 'Create my account'))}
        </button>
        {step === 4 && (
          <p className="onb-fine">
            {/* Пока галочки нет, ссылка на политику стоит и здесь: строка под
                кнопкой видна всегда, а ссылка под галочкой на коротком экране
                уходит под закреплённую кнопку до прокрутки. */}
            {lang === 'ru'
              ? (agree
                ? 'Анкету о здоровье заполнишь позже, если захочешь, — с отдельным согласием.'
                : <>Чтобы продолжить, отметь согласие с <LegalLink doc="privacy" version={policyVersion}>политикой конфиденциальности</LegalLink>.</>)
              : (agree
                ? 'The health questionnaire is separate and optional, with its own consent.'
                : <>To continue, tick the <LegalLink doc="privacy" version={policyVersion}>privacy policy</LegalLink> consent.</>)}
          </p>
        )}
      </div>
    </div>
  );
}

/* ─── Шаг 0 · Приветствие ──────────────────────────────────── */
function WelcomeSlide({ firstName, lang }: { firstName?: string; lang: Lang }) {
  const ru = lang === 'ru';
  return (
    <div className="onb-slide">
      <div className="onb-welcome">
        <div className="onb-avatar-wrap">
          <span className="onb-avatar-glow" aria-hidden />
          <LiveAnjelika className="onb-avatar" />
          <span className="onb-avatar-badge">
            <Icon name="check" size={14} strokeWidth={2.4} />
          </span>
        </div>
        <div className="onb-eyebrow">ANZH · cosmetology</div>
        <h1 className="onb-title">
          {ru
            ? (firstName ? <>{firstName}, привет —<br />я <span className="onb-name-accent">Анжелика</span></> : <>Привет, я <span className="onb-name-accent">Анжелика</span></>)
            : (firstName ? <>Hi {firstName} —<br />I’m <span className="onb-name-accent">Anjelika</span></> : <>Hi, I’m <span className="onb-name-accent">Anjelika</span></>)}
        </h1>
        {/* Здесь стояли стаж, число процедур, рейтинг и число отзывов —
            цифры-заготовки, не подтверждённые Анжеликой. Решение
            владельца: выдуманное убирать, а не прятать. */}
        <p className="onb-lead">
          {ru ? 'Косметолог в Батуми' : 'Cosmetologist in Batumi'}
        </p>
        <p className="onb-text">
          {ru
            ? 'Здесь ты записываешься ко мне в пару касаний, а всё о твоей коже хранится в одном месте. Покажу, как тут всё устроено, — это минута.'
            : 'Book with me in a couple of taps and keep everything about your skin in one place. I’ll show you around — it takes a minute.'}
        </p>
        <div className="onb-meta-row">
          <span className="onb-meta-chip">
            <Icon name="pin" size={12} strokeWidth={1.8} />
            Parnavaz Mepe 92/94
          </span>
        </div>

      </div>
    </div>
  );
}

/* ─── Шаг 1 · Знакомство: имя + обращение ──────────────────── */
function IdentitySlide({
  name, setName, gender, setGender, tgHandle, ru,
}: {
  name: string; setName: (v: string) => void;
  gender: Gender | null; setGender: (g: Gender) => void;
  tgHandle?: string;
  ru: boolean;
}) {
  return (
    <div className="onb-slide">
      <div className="onb-eyebrow">{ru ? 'знакомство' : 'about you'}</div>
      <h2 className="onb-title onb-title-sm">{ru ? 'Давай познакомимся' : 'Let’s get acquainted'}</h2>
      <p className="onb-text onb-text-sm">
        {tgHandle
          ? (ru ? 'Имя забрала из Telegram — поправь, если зовут иначе.' : 'I took your name from Telegram — fix it if it’s different.')
          : (ru ? 'Скажи, как тебя зовут и как к тебе обращаться.' : 'Tell me your name and how to address you.')}
      </p>

      {tgHandle && (
        <div className="onb-tg-badge">
          <Icon name="check" size={14} strokeWidth={2.4} />
          <span>@{tgHandle}</span>
          <span className="faint">· Telegram</span>
        </div>
      )}

      <div className="onb-form">
        <label className="onb-field">
          <span className="onb-label">{ru ? 'имя' : 'name'}</span>
          <input
            className="onb-input"
            type="text"
            placeholder={ru ? 'Как тебя зовут' : 'Your name'}
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="given-name"
          />
        </label>

        <div className="onb-field">
          <span className="onb-label">{ru ? 'пол' : 'gender'}</span>
          <div className="seg">
            <button
              className={`seg-btn ${gender === 'f' ? 'active' : ''}`}
              onClick={() => setGender('f')}
              aria-pressed={gender === 'f'}
            >
              <span>{ru ? 'Женский' : 'Female'}</span>
              {gender === 'f' && <Icon name="check" size={14} strokeWidth={2.6} className="seg-check" />}
            </button>
            <button
              className={`seg-btn ${gender === 'm' ? 'active' : ''}`}
              onClick={() => setGender('m')}
              aria-pressed={gender === 'm'}
            >
              <span>{ru ? 'Мужской' : 'Male'}</span>
              {gender === 'm' && <Icon name="check" size={14} strokeWidth={2.6} className="seg-check" />}
            </button>
          </div>
          <span className="onb-hint">
            {ru
              ? (gender
                ? `Буду писать «ты ${gg('записана', 'записан', gender)}» — и подберу протоколы под тебя.`
                : 'Нужен, чтобы правильно обращаться и подбирать протоколы.')
              : 'Helps me address you correctly and pick the right protocols.'}
          </span>
        </div>
      </div>
    </div>
  );
}

/* ─── Шаг 2 · Что внутри ───────────────────────────────────── */
function BenefitsSlide({ ru }: { ru: boolean }) {
  return (
    <div className="onb-slide">
      <div className="onb-eyebrow">{ru ? 'что внутри' : 'what’s inside'}</div>
      <h2 className="onb-title onb-title-sm">{ru ? 'Зачем тебе кабинет' : 'Why you’ll like it'}</h2>
      <p className="onb-text onb-text-sm">
        {/* No count in the text (K13, F1): the list below is filtered by AI_ASSISTANT */}
        {ru ? 'Вот что ты получаешь сразу.' : 'Here’s what you get right away.'}
      </p>
      <ul className="onb-benefits">
        {BENEFITS.filter((b) => AI_ASSISTANT || !b.ai).map((b) => (
          <li key={b.title} className={`onb-benefit onb-benefit-${b.accent}`}>
            <div className="onb-benefit-icon">
              <Icon name={b.icon} size={22} strokeWidth={1.7} />
            </div>
            <div className="onb-benefit-body">
              <div className="onb-benefit-title">{ru ? b.title : b.titleEn}</div>
              <div className="onb-benefit-sub">{ru ? b.sub : b.subEn}</div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ─── Шаг 3 · Как это работает ─────────────────────────────── */
function HowItWorksSlide({ gender, ru }: { gender: Gender; ru: boolean }) {
  const steps = ru ? [
    { num: 1, title: 'Выбери процедуру', sub: 'Каталог с ценами и описанием процедур.' },
    /* «Предложит другое время» и «план ухода после» сервер на запуск не
       делает: статуса «другое время» нет, из уведомлений клиентке уходит
       только напоминание за 24 часа и ответ на заявку. */
    { num: 2, title: 'Тапни удобный слот', sub: 'Заявка уйдёт Анжелике на подтверждение.' },
    { num: 3, title: `Приходи ${gg('готовой', 'готовым', gender)}`, sub: 'Нажми Start у бота — тогда он сможет писать тебе о записях.' },
  ] : [
    { num: 1, title: 'Pick a treatment', sub: 'A catalogue with prices and descriptions.' },
    { num: 2, title: 'Tap a time that suits you', sub: 'Your request goes to Anjelika to confirm.' },
    { num: 3, title: 'Come in ready', sub: 'Press Start in the bot so it can message you about your bookings.' },
  ];
  return (
    <div className="onb-slide">
      <div className="onb-eyebrow">{ru ? 'как это работает' : 'how it works'}</div>
      <h2 className="onb-title onb-title-sm">{ru ? <>3 шага — и ты {gg('записана', 'записан', gender)}</> : '3 steps to your booking'}</h2>
      <p className="onb-text onb-text-sm">
        {ru ? 'Без звонков и лишних переписок — всё в одном экране.' : 'No calls, no long chats — everything on one screen.'}
      </p>
      <ol className="onb-steps">
        {steps.map((s) => (
          <li key={s.num} className="onb-step">
            <div className="onb-step-num">{s.num}</div>
            <div className="onb-step-body">
              <div className="onb-step-title">{s.title}</div>
              <div className="onb-step-sub">{s.sub}</div>
            </div>
          </li>
        ))}
      </ol>
      <div className="onb-callout">
        <Icon name="info" size={18} strokeWidth={1.8} />
        <span>
          {ru
            ? (AI_ASSISTANT ? 'Можешь не записываться — просто посмотри каталог или спроси AI-ассистента.' : 'Можешь не записываться — просто посмотри каталог с ценами.')
            : (AI_ASSISTANT ? 'No need to book — just browse the catalogue or ask the AI assistant.' : 'No need to book — just browse the catalogue with prices.')}
          <strong>{ru ? ' Доступ в кабинет бесплатный.' : ' The app is free.'}</strong>
        </span>
      </div>
    </div>
  );
}

/* ─── Шаг 4 · Контакт для Анжелики ─────────────────────────── */
function SignupSlide({
  name, gender, instagram, setInstagram, phone, setPhone, agree, setAgree, lang, policyVersion, staleVersion,
}: {
  name: string;
  gender: Gender;
  instagram: string; setInstagram: (v: string) => void;
  phone: string; setPhone: (v: string) => void;
  agree: boolean; setAgree: (v: boolean) => void;
  lang: 'ru' | 'en';
  /** Текущая редакция политики с сервера (Me.legal.policy) или null. */
  policyVersion: string | null;
  /** Сервер ответил 409: отмеченная редакция уже не текущая. */
  staleVersion: boolean;
}) {
  const ru = lang === 'ru';
  return (
    <div className="onb-slide">
      <div className="onb-eyebrow">{ru ? 'последний шаг' : 'last step'}</div>
      <h2 className="onb-title onb-title-sm">{ru ? (name ? `${name}, где тебя найти` : 'Где тебя найти') : (name ? `${name}, how can we reach you` : 'How can we reach you')}</h2>
      <p className="onb-text onb-text-sm">
        {ru
          ? 'Анжелика ведёт клиентов по инстаграму — так она узнает, что это ты, и подтянет твою историю процедур.'
          : 'Anjelika keeps in touch with clients on Instagram — this way she’ll know it’s you and see your treatment history.'}
      </p>

      {/* Здесь был блок стартового бонуса баллами: баллы на запуск скрыты. */}

      <div className="onb-form">
        <label className="onb-field">
          <span className="onb-label">
            {ru ? 'инстаграм' : 'instagram'} <span className="faint">{ru ? '· чтобы Анжелика тебя узнала' : '· so she knows it’s you'}</span>
          </span>
          <input
            className="onb-input"
            type="text"
            inputMode="text"
            placeholder="@nickname"
            value={instagram}
            onChange={(e) => setInstagram(e.target.value)}
            autoCapitalize="none"
            autoCorrect="off"
          />
        </label>
        <label className="onb-field">
          <span className="onb-label">
            {ru ? 'телефон' : 'phone'} <span className="faint">{ru ? '· опционально' : '· optional'}</span>
          </span>
          <input
            className="onb-input"
            type="tel"
            placeholder="+995 5XX XXX XXX"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            autoComplete="tel"
          />
          <span className="onb-hint">{ru ? 'Нужен, только если потеряется Telegram' : 'Only in case we lose you on Telegram'}</span>
        </label>

        {/* Согласие только с политикой — для обычных данных: имя, Telegram,
            инстаграм, телефон. Ссылка стоит ОТДЕЛЬНОЙ строкой, а не внутри
            кнопки-галочки: ссылка внутри кнопки — невалидная разметка, и
            нажатие «прочитать» ставило бы галочку.
            Строка над галочкой — честно о том, что уже случилось: вход идёт
            при открытии приложения, и данные Telegram сервер получает ДО
            галочки; основание — вход и запись, не это согласие. */}
        <div className="onb-field">
          <button
            type="button"
            role="checkbox"
            className={`onb-agree ${agree ? 'on' : ''}`}
            onClick={() => setAgree(!agree)}
            aria-checked={agree}
          >
            <span className="onb-check">{agree && <Icon name="check" size={14} strokeWidth={2.4} />}</span>
            {/* Строки — Законник, редакция 2026-09-25-draft2 (_work/18). Прежнее
                «…нужны, чтобы записывать меня» подавало галочку как основание
                хранения; данные Telegram приходят при входе и до неё. */}
            <span className="onb-agree-text">
              {ru
                ? `${gg('Согласна', 'Согласен', gender)} с политикой конфиденциальности.`
                : 'I agree to the privacy policy.'}
            </span>
          </button>
          <span className="onb-hint">
            <LegalLink doc="privacy" version={policyVersion}>
              {ru ? 'Текст политики конфиденциальности' : 'Read the privacy policy'}
            </LegalLink>
            {policyVersion && (
              <span data-policy-version>{ru ? ` · редакция ${policyVersion}` : ` · version ${policyVersion}`}</span>
            )}
          </span>
          <p className="onb-hint" data-note="tg-data">
            {ru
              ? 'Telegram при открытии приложения уже передал нам твой ID, имя, username, язык и ссылку на фото (а при входе по приглашению — от кого оно): без этого не работают вход и запись, и от галочки это не зависит.'
              : 'When you opened the app, Telegram already sent us your ID, name, username, language and profile photo link (and who invited you, if you came via an invite): sign-in and booking need them, and this does not depend on the checkbox.'}
          </p>
          {staleVersion && (
            <p className="onb-hint" role="alert" data-policy-stale style={{ color: 'var(--text-primary)' }}>
              {ru
                ? `Политика обновилась, пока ты ${gg('читала', 'читал', gender)}. Открой текст новой редакции и отметь согласие заново.`
                : 'The privacy policy was updated while you were reading. Open the new version and tick the consent again.'}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Повторный вопрос о политике ──────────────────────────────
   Гость отметил согласие на устройстве, а к моменту входа текущая редакция
   политики уже другая (решение John перед волной 3): отметка на прежний
   текст не переносится на новый молча. Спрашиваем заново — та же галочка,
   та же строка о данных Telegram; «Не сейчас» ничего не ломает, как и
   «Пропустить» в онбординге. Открывает App.tsx шторкой. */
export function PolicyReconsent({ onDone }: { onDone: () => void }) {
  const lang = useLang();
  const ru = lang === 'ru';
  const gender = useGender();
  const { me } = useMe();
  const version = legalVersion(me, 'policy');
  const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState(false);
  const [stale, setStale] = useState(false);
  const [failed, setFailed] = useState(false);

  const send = async () => {
    if (!agree || busy || !version) return;
    setBusy(true);
    setStale(false);
    setFailed(false);
    try {
      await grantConsent('policy', version, lang);
    } catch (e) {
      setBusy(false);
      if (isVersionMismatch(e)) {
        // Пока человек читал, вышла ещё одна редакция — галочка снова снята
        setAgree(false);
        setStale(true);
        await refreshMe();
        return;
      }
      setFailed(true);
      return;
    }
    resolvePolicyReask();
    void refreshMe();
    onDone();
  };

  const later = () => {
    resolvePolicyReask();
    onDone();
  };

  return (
    <div className="col" style={{ gap: 12 }} data-testid="policy-reask">
      <p className="muted" style={{ lineHeight: 1.6 }}>
        {ru
          ? `Политика конфиденциальности обновилась после того, как ты ${gg('отметила', 'отметил', gender)} согласие. Прежняя отметка относится к старой редакции — прочитай новую и, если ${gg('согласна', 'согласен', gender)}, отметь согласие снова.`
          : 'The privacy policy has changed since you ticked the consent. That tick covers the old version — read the new one and, if you agree, tick the consent again.'}
      </p>
      <button
        type="button"
        role="checkbox"
        className={`onb-agree ${agree ? 'on' : ''}`}
        onClick={() => setAgree(!agree)}
        aria-checked={agree}
        disabled={!version}
      >
        <span className="onb-check">{agree && <Icon name="check" size={14} strokeWidth={2.4} />}</span>
        <span className="onb-agree-text">
          {ru ? `${gg('Согласна', 'Согласен', gender)} с политикой конфиденциальности.` : 'I agree to the privacy policy.'}
        </span>
      </button>
      <span className="onb-hint">
        <LegalLink doc="privacy" version={version}>
          {ru ? 'Текст политики конфиденциальности' : 'Read the privacy policy'}
        </LegalLink>
        {version && <span data-policy-version>{ru ? ` · редакция ${version}` : ` · version ${version}`}</span>}
      </span>
      <p className="onb-hint" data-note="tg-data">
        {ru
          ? 'Telegram при открытии приложения уже передал нам твой ID, имя, username, язык и ссылку на фото (а при входе по приглашению — от кого оно): без этого не работают вход и запись, и от галочки это не зависит.'
          : 'When you opened the app, Telegram already sent us your ID, name, username, language and profile photo link (and who invited you, if you came via an invite): sign-in and booking need them, and this does not depend on the checkbox.'}
      </p>
      {stale && (
        <p className="onb-hint" role="alert" data-policy-stale style={{ color: 'var(--text-primary)' }}>
          {ru
            ? `Политика обновилась, пока ты ${gg('читала', 'читал', gender)}. Открой текст новой редакции и отметь согласие заново.`
            : 'The privacy policy was updated while you were reading. Open the new version and tick the consent again.'}
        </p>
      )}
      {failed && (
        <p className="onb-hint" role="alert" style={{ color: 'var(--text-primary)' }}>
          {ru ? 'Не удалось отправить согласие — проверь связь и попробуй ещё раз.' : 'Could not send the consent — check the connection and try again.'}
        </p>
      )}
      <button className="btn btn-primary btn-block" onClick={() => { void send(); }} disabled={!agree || busy || !version}>
        {busy ? (ru ? 'Отправляю…' : 'Sending…') : (ru ? 'Согласиться' : 'Agree')}
      </button>
      <button className="btn btn-quiet btn-block" onClick={later} disabled={busy}>
        {ru ? 'Не сейчас' : 'Not now'}
      </button>
    </div>
  );
}
