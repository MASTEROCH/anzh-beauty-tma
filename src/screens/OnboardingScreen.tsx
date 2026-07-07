import { useState } from 'react';
import { Icon, type IconName } from '../components/Icon';

interface Props {
  onComplete: (data: { name: string; phone: string }) => void;
  onSkip: () => void;
}

type Benefit = { icon: IconName; title: string; sub: string; accent: 'gold' | 'emerald' };

const BENEFITS: Benefit[] = [
  {
    icon: 'calendar',
    title: 'Запись в 1 тап',
    sub: 'Без звонков, без WhatsApp. Слот — мгновенное подтверждение.',
    accent: 'gold',
  },
  {
    icon: 'gift',
    title: 'Баллы за каждый визит',
    sub: 'Копятся в Anjelika Club. Отзыв = +200, фото = +100. Тиры до Diamond.',
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

type Step = { num: number; title: string; sub: string };
const STEPS: Step[] = [
  { num: 1, title: 'Выбери процедуру', sub: 'Каталог с ценами и противопоказаниями.' },
  { num: 2, title: 'Тапни удобный слот', sub: 'Анжелика подтвердит, забронируешь за 30 секунд.' },
  { num: 3, title: 'Приходи готовой', sub: 'Пушу подготовку за 24 ч и план ухода после.' },
];

export function OnboardingScreen({ onComplete, onSkip }: Props) {
  const [step, setStep] = useState<0 | 1 | 2 | 3>(0);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('+995 ');
  const [agree, setAgree] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const next = () => setStep((s) => (s < 3 ? ((s + 1) as 0 | 1 | 2 | 3) : s));
  const prev = () => setStep((s) => (s > 0 ? ((s - 1) as 0 | 1 | 2 | 3) : s));

  const submit = () => {
    if (!name.trim() || !agree || submitting) return;
    setSubmitting(true);
    setTimeout(() => onComplete({ name: name.trim(), phone: phone.trim() }), 700);
  };

  const canContinue = step < 3 || (name.trim().length > 1 && agree);

  return (
    <div className="onb-screen">
      {/* Header — skip on first 3 steps, back arrow on later steps */}
      <header className="onb-header">
        {step > 0 ? (
          <button className="header-back" onClick={prev} aria-label="Назад">
            <Icon name="chevron-left" size={20} strokeWidth={2.2} />
          </button>
        ) : (
          <img src="/brand/anzh-logo.svg" alt="ANZH" style={{ height: 22 }} />
        )}
        <div className="onb-dots" aria-label={`Шаг ${step + 1} из 4`}>
          {[0, 1, 2, 3].map((i) => (
            <span key={i} className={`onb-dot ${i === step ? 'active' : ''} ${i < step ? 'done' : ''}`} />
          ))}
        </div>
        {step < 3 ? (
          <button className="onb-skip" onClick={onSkip}>Пропустить</button>
        ) : (
          <div style={{ width: 36 }} />
        )}
      </header>

      {/* Slides */}
      <div className="onb-body">
        {step === 0 && <WelcomeSlide />}
        {step === 1 && <BenefitsSlide />}
        {step === 2 && <HowItWorksSlide />}
        {step === 3 && (
          <SignupSlide
            name={name}
            setName={setName}
            phone={phone}
            setPhone={setPhone}
            agree={agree}
            setAgree={setAgree}
          />
        )}
      </div>

      {/* Bottom CTA */}
      <div className="onb-cta">
        <button
          className="btn btn-primary btn-block"
          onClick={step === 3 ? submit : next}
          disabled={step === 3 ? !canContinue || submitting : false}
        >
          {step === 0 && 'Знакомимся →'}
          {step === 1 && 'Дальше →'}
          {step === 2 && 'Создать кабинет →'}
          {step === 3 && (submitting ? 'Создаю…' : 'Создать кабинет · +50 баллов')}
        </button>
        {step === 3 && (
          <p className="onb-fine">
            Создавая кабинет — соглашаешься на хранение паспорта здоровья. Видит только Анжелика.
          </p>
        )}
      </div>
    </div>
  );
}

/* ─── Step 0 · Welcome ─────────────────────────────────────── */
function WelcomeSlide() {
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
          Привет, я <span className="onb-name-accent">Анжелика</span>
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

/* ─── Step 1 · Benefits ────────────────────────────────────── */
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

/* ─── Step 2 · How it works ────────────────────────────────── */
function HowItWorksSlide() {
  return (
    <div className="onb-slide">
      <div className="onb-eyebrow">как это работает</div>
      <h2 className="onb-title onb-title-sm">3 шага — и ты записана</h2>
      <p className="onb-text onb-text-sm">
        Никаких звонков, переписок и забытых дат — всё в одном экране.
      </p>
      <ol className="onb-steps">
        {STEPS.map((s) => (
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

/* ─── Step 3 · Sign-up form ────────────────────────────────── */
function SignupSlide({
  name, setName, phone, setPhone, agree, setAgree,
}: {
  name: string; setName: (v: string) => void;
  phone: string; setPhone: (v: string) => void;
  agree: boolean; setAgree: (v: boolean) => void;
}) {
  return (
    <div className="onb-slide">
      <div className="onb-eyebrow">последний шаг</div>
      <h2 className="onb-title onb-title-sm">Создай кабинет</h2>
      <p className="onb-text onb-text-sm">
        30 секунд. Анжелика будет знать, как к тебе обращаться, и сразу зачислит приветственные баллы.
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
          <span className="onb-label">Как тебя зовут</span>
          <input
            className="onb-input"
            type="text"
            placeholder="Маша"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
            autoComplete="given-name"
          />
        </label>
        <label className="onb-field">
          <span className="onb-label">
            Телефон <span className="faint">· опционально</span>
          </span>
          <input
            className="onb-input"
            type="tel"
            placeholder="+995 5XX XXX XXX"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            autoComplete="tel"
          />
          <span className="onb-hint">Для напоминаний и связи если потеряешь Telegram</span>
        </label>

        <button
          type="button"
          className={`onb-agree ${agree ? 'on' : ''}`}
          onClick={() => setAgree(!agree)}
          aria-pressed={agree}
        >
          <span className="onb-check">{agree && <Icon name="check" size={14} strokeWidth={2.4} />}</span>
          <span className="onb-agree-text">
            Согласна на хранение паспорта здоровья. Данные приватные, видит только Анжелика.
          </span>
        </button>
      </div>
    </div>
  );
}
