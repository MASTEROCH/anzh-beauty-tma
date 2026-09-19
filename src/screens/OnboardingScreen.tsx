import { useEffect, useRef, useState } from 'react';
import { Icon, type IconName } from '../components/Icon';
import { getTgUser } from '../lib/telegram';
import { setGender, type Gender, g as gg } from '../lib/gender';

export interface OnboardingResult {
  name: string;
  gender: Gender;
  instagram: string;
  phone: string;
}

interface Props {
  onComplete: (data: OnboardingResult) => void;
  onSkip: () => void;
}

type Benefit = { icon: IconName; title: string; sub: string; accent: 'gold' | 'emerald' };

const BENEFITS: Benefit[] = [
  {
    icon: 'calendar',
    title: 'Запись в 1 тап',
    sub: 'Без звонков и переписок. Выбираешь слот — Анжелика подтверждает.',
    accent: 'gold',
  },
  {
    icon: 'gift',
    title: 'Баллы за каждый визит',
    sub: 'Копятся в Anjelika Club. Отзыв с фото — бонус на следующую процедуру.',
    accent: 'emerald',
  },
  {
    icon: 'message',
    title: 'AI-консультант 24/7',
    sub: 'Подберёт процедуру, проверит противопоказания, ответит за 5 секунд.',
    accent: 'gold',
  },
  {
    icon: 'shield-check',
    title: 'Паспорт кожи',
    sub: 'Анжелика помнит каждую процедуру, аллергию и план ухода — навсегда.',
    accent: 'emerald',
  },
];

const STEP_COUNT = 5;

export function OnboardingScreen({ onComplete, onSkip }: Props) {
  const tg = getTgUser();
  const [step, setStep] = useState(0);
  const [name, setName] = useState(tg?.firstName ?? '');
  const [gender, setGenderLocal] = useState<Gender | null>(null);
  const [instagram, setInstagram] = useState('');
  const [phone, setPhone] = useState('');
  const [agree, setAgree] = useState(true);
  const [submitting, setSubmitting] = useState(false);
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

  const submit = () => {
    if (!agree || submitting || !gender) return;
    setSubmitting(true);
    setGender(gender);
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
    <div className="onb-screen">
      <div className="onb-orbs" aria-hidden />
      <header className="onb-header">
        {step > 0 ? (
          <button className="header-back" onClick={prev} aria-label="Назад">
            <Icon name="chevron-left" size={20} strokeWidth={2.2} />
          </button>
        ) : (
          <img src="/brand/anzh-logo.svg" alt="ANZH" style={{ height: 22 }} />
        )}
        <div className="onb-dots" aria-label={`Шаг ${step + 1} из ${STEP_COUNT}`}>
          {Array.from({ length: STEP_COUNT }, (_, i) => (
            <span key={i} className={`onb-dot ${i === step ? 'active' : ''} ${i < step ? 'done' : ''}`} />
          ))}
        </div>
        {step < STEP_COUNT - 1 ? (
          <button className="onb-skip" onClick={onSkip}>Пропустить</button>
        ) : (
          <div style={{ width: 36 }} />
        )}
      </header>

      <div className="onb-body" ref={bodyRef}>
        {step === 0 && <WelcomeSlide firstName={tg?.firstName} />}
        {step === 1 && (
          <IdentitySlide
            name={name}
            setName={setName}
            gender={gender}
            setGender={setGenderLocal}
            tgHandle={tg?.username}
          />
        )}
        {step === 2 && <BenefitsSlide />}
        {step === 3 && <HowItWorksSlide gender={gender ?? 'f'} />}
        {step === 4 && (
          <SignupSlide
            name={name}
            gender={gender ?? 'f'}
            instagram={instagram}
            setInstagram={setInstagram}
            phone={phone}
            setPhone={setPhone}
            agree={agree}
            setAgree={setAgree}
          />
        )}
      </div>

      <div className="onb-cta">
        <button
          className="btn btn-primary btn-block"
          onClick={step === STEP_COUNT - 1 ? submit : next}
          disabled={!canContinue || submitting}
        >
          {step === 0 && 'Знакомимся →'}
          {step === 1 && 'Дальше →'}
          {step === 2 && 'Дальше →'}
          {step === 3 && 'Создать кабинет →'}
          {step === 4 && (submitting ? 'Создаю…' : 'Создать кабинет · +50 баллов')}
        </button>
        {step === 4 && (
          <p className="onb-fine">
            Создавая кабинет — соглашаешься на хранение паспорта здоровья. Видит только Анжелика.
          </p>
        )}
      </div>
    </div>
  );
}

/* ─── Шаг 0 · Приветствие ──────────────────────────────────── */
function WelcomeSlide({ firstName }: { firstName?: string }) {
  return (
    <div className="onb-slide">
      <div className="onb-welcome">
        <div className="onb-avatar-wrap">
          <span className="onb-avatar-glow" aria-hidden />
          <img src="/photos/anjelika.jpg" alt="Anjelika" className="onb-avatar" />
          <span className="onb-avatar-badge">
            <Icon name="check" size={14} strokeWidth={2.4} />
          </span>
        </div>
        <div className="onb-eyebrow">ANZH · cosmetology</div>
        <h1 className="onb-title">
          {firstName ? <>{firstName}, привет —<br />я <span className="onb-name-accent">Анжелика</span></> : <>Привет, я <span className="onb-name-accent">Анжелика</span></>}
        </h1>
        <p className="onb-lead">
          Косметолог в Батуми · 8 лет практики · 1 472 процедуры
        </p>
        <p className="onb-text">
          Это твой цифровой кабинет: запись, паспорт кожи, баллы лояльности и личный AI-ассистент.
          Я провожу тебя за минуту.
        </p>
        <div className="onb-meta-row">
          <span className="onb-meta-chip">
            <Icon name="star" size={12} strokeWidth={2} fill="current" />
            4.9 · 312 отзывов
          </span>
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
  name, setName, gender, setGender, tgHandle,
}: {
  name: string; setName: (v: string) => void;
  gender: Gender | null; setGender: (g: Gender) => void;
  tgHandle?: string;
}) {
  return (
    <div className="onb-slide">
      <div className="onb-eyebrow">знакомство</div>
      <h2 className="onb-title onb-title-sm">Давай познакомимся</h2>
      <p className="onb-text onb-text-sm">
        {tgHandle
          ? 'Имя забрала из Telegram — поправь, если зовут иначе.'
          : 'Скажи, как тебя зовут и как к тебе обращаться.'}
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
          <span className="onb-label">имя</span>
          <input
            className="onb-input"
            type="text"
            placeholder="Как тебя зовут"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="given-name"
          />
        </label>

        <div className="onb-field">
          <span className="onb-label">пол</span>
          <div className="seg">
            <button
              className={`seg-btn ${gender === 'f' ? 'active' : ''}`}
              onClick={() => setGender('f')}
              aria-pressed={gender === 'f'}
            >
              <span>Женский</span>
              {gender === 'f' && <Icon name="check" size={14} strokeWidth={2.6} className="seg-check" />}
            </button>
            <button
              className={`seg-btn ${gender === 'm' ? 'active' : ''}`}
              onClick={() => setGender('m')}
              aria-pressed={gender === 'm'}
            >
              <span>Мужской</span>
              {gender === 'm' && <Icon name="check" size={14} strokeWidth={2.6} className="seg-check" />}
            </button>
          </div>
          <span className="onb-hint">
            {gender
              ? `Буду писать «ты ${gg('записана', 'записан', gender)}» — и подберу протоколы под тебя.`
              : 'Нужен, чтобы правильно обращаться и подбирать протоколы.'}
          </span>
        </div>
      </div>
    </div>
  );
}

/* ─── Шаг 2 · Что внутри ───────────────────────────────────── */
function BenefitsSlide() {
  return (
    <div className="onb-slide">
      <div className="onb-eyebrow">что внутри</div>
      <h2 className="onb-title onb-title-sm">Зачем тебе кабинет</h2>
      <p className="onb-text onb-text-sm">
        4 вещи, которые ты получаешь сразу — и которые работают сами, пока ты живёшь свою жизнь.
      </p>
      <ul className="onb-benefits">
        {BENEFITS.map((b) => (
          <li key={b.title} className={`onb-benefit onb-benefit-${b.accent}`}>
            <div className="onb-benefit-icon">
              <Icon name={b.icon} size={22} strokeWidth={1.7} />
            </div>
            <div className="onb-benefit-body">
              <div className="onb-benefit-title">{b.title}</div>
              <div className="onb-benefit-sub">{b.sub}</div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ─── Шаг 3 · Как это работает ─────────────────────────────── */
function HowItWorksSlide({ gender }: { gender: Gender }) {
  const steps = [
    { num: 1, title: 'Выбери процедуру', sub: 'Каталог с ценами и противопоказаниями.' },
    { num: 2, title: 'Тапни удобный слот', sub: 'Заявка улетит Анжелике — она подтвердит или предложит другое время.' },
    { num: 3, title: `Приходи ${gg('готовой', 'готовым', gender)}`, sub: 'Пушу подготовку за 24 ч и план ухода после.' },
  ];
  return (
    <div className="onb-slide">
      <div className="onb-eyebrow">как это работает</div>
      <h2 className="onb-title onb-title-sm">3 шага — и ты {gg('записана', 'записан', gender)}</h2>
      <p className="onb-text onb-text-sm">
        Никаких звонков, переписок и забытых дат — всё в одном экране.
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
          Можешь не записываться — просто посмотри каталог, открой отзывы или поболтай с AI-ассистентом.
          <strong> Доступ в кабинет бесплатный.</strong>
        </span>
      </div>
    </div>
  );
}

/* ─── Шаг 4 · Контакт для Анжелики ─────────────────────────── */
function SignupSlide({
  name, gender, instagram, setInstagram, phone, setPhone, agree, setAgree,
}: {
  name: string;
  gender: Gender;
  instagram: string; setInstagram: (v: string) => void;
  phone: string; setPhone: (v: string) => void;
  agree: boolean; setAgree: (v: boolean) => void;
}) {
  return (
    <div className="onb-slide">
      <div className="onb-eyebrow">последний шаг</div>
      <h2 className="onb-title onb-title-sm">{name ? `${name}, где тебя найти` : 'Где тебя найти'}</h2>
      <p className="onb-text onb-text-sm">
        Анжелика ведёт клиентов по инстаграму — так она узнает, что это ты, и подтянет твою историю процедур.
      </p>

      <div className="onb-bonus">
        <div className="onb-bonus-icon"><Icon name="gift" size={20} strokeWidth={1.8} /></div>
        <div>
          <div className="onb-bonus-title">+50 баллов на старт</div>
          <div className="onb-bonus-sub">Сразу в Anjelika Club, без условий</div>
        </div>
      </div>

      <div className="onb-form">
        <label className="onb-field">
          <span className="onb-label">
            инстаграм <span className="faint">· чтобы Анжелика тебя узнала</span>
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
            телефон <span className="faint">· опционально</span>
          </span>
          <input
            className="onb-input"
            type="tel"
            placeholder="+995 5XX XXX XXX"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            autoComplete="tel"
          />
          <span className="onb-hint">Нужен, только если потеряется Telegram</span>
        </label>

        <button
          type="button"
          className={`onb-agree ${agree ? 'on' : ''}`}
          onClick={() => setAgree(!agree)}
          aria-pressed={agree}
        >
          <span className="onb-check">{agree && <Icon name="check" size={14} strokeWidth={2.4} />}</span>
          <span className="onb-agree-text">
            {gg('Согласна', 'Согласен', gender)} на хранение паспорта здоровья. Данные приватные, видит только Анжелика.
          </span>
        </button>
      </div>
    </div>
  );
}
