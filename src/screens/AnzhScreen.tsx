import { openSheet, toast } from '../lib/ui';
import { Icon } from '../components/Icon';
import { useLang } from '../lib/i18n';

type Product = { id: string; name: string; sub: string; price: string; photo: string; description: string };

const PRODUCTS: Product[] = [
  { id: 'serum',  name: 'Skin Reset Serum', sub: 'Ниацинамид · 30 мл', price: '49 USD', photo: '/photos/prod-serum.jpg', description: 'Сыворотка с 10% ниацинамидом и цинком. Снимает воспаления, выравнивает тон. Можно использовать утром под SPF.' },
  { id: 'cream',  name: 'Glow Cream',       sub: 'Гиалурон · SPF 30',  price: '38 USD', photo: '/photos/prod-cream.jpg', description: 'Дневной крем с гиалуроновой кислотой и физическими фильтрами. Лёгкая текстура, без липкости.' },
  { id: 'mask',   name: 'Calm Mask',        sub: 'Алоэ · после процедур', price: '22 USD', photo: '/photos/prod-mask.jpg', description: 'Восстанавливающая маска после инъекций, пилингов, чисток. Алоэ + пантенол + центелла.' },
  { id: 'recovery', name: 'Lip Recovery',   sub: 'После контурной',    price: '18 USD', photo: '/photos/prod-lip.jpg', description: 'Бальзам для губ после контурной пластики. Снимает отёк, ускоряет заживление за 48 часов.' },
];

export function AnzhScreen() {
  const lang = useLang();
  const showProduct = (p: Product) =>
    openSheet({
      title: p.name,
      subtitle: p.sub,
      body: (
        <>
          <div
            style={{
              height: 180,
              borderRadius: 16,
              backgroundImage: `url(${p.photo})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              boxShadow: 'var(--glow-teal)',
              border: '0.5px solid var(--border)',
            }}
          />
          <p style={{ marginTop: 16, lineHeight: 1.6 }}>{p.description}</p>
          <div className="row" style={{ marginTop: 14, gap: 10 }}>
            <span className="chip chip-amber">−10% по ANZH Pass</span>
            <span className="chip">★ 4.8 · 142 отзыва</span>
          </div>
          <div
            style={{
              fontFamily: 'Space Grotesk, system-ui, sans-serif',
              fontSize: 28,
              color: 'var(--gdl)',
              marginTop: 14,
              fontWeight: 600,
            }}
          >
            {p.price}
          </div>
        </>
      ),
      actions: (
        <>
          <button
            className="btn btn-primary btn-block"
            onClick={() => {
              toast('Перехожу в ANZH.store…', 'success');
              window.open(`https://anzh.store/?utm_source=tma&product=${p.id}`, '_blank');
            }}
          >
            Купить в ANZH.store
          </button>
          <button
            className="btn btn-ghost btn-block"
            onClick={() => toast('Сохранено в желаемое', 'success')}
          >
            <Icon name="heart" size={16} strokeWidth={1.9} /> Сохранить
          </button>
        </>
      ),
    });

  const showPass = () =>
    openSheet({
      title: 'ANZH Pass',
      subtitle: 'Подписка для клиентов Анжелики',
      body: (
        <>
          <div
            style={{
              padding: 22,
              borderRadius: 22,
              background: 'radial-gradient(circle at 100% 0%, rgba(224,160,48,0.30), transparent 50%), linear-gradient(135deg, var(--dk2), var(--t))',
              border: '0.5px solid rgba(196,168,130,0.4)',
            }}
          >
            <div className="loyalty-tier" style={{ marginBottom: 6 }}>★ PASS</div>
            <div
              style={{
                fontFamily: 'Space Grotesk, system-ui, sans-serif',
                fontSize: 32,
                fontWeight: 600,
                letterSpacing: '-0.02em',
              }}
            >
              $79<small style={{ fontSize: 14, fontWeight: 400, color: 'var(--text-hint)' }}> / месяц</small>
            </div>
            <div className="faint" style={{ fontSize: 13, marginTop: 4 }}>= 200 GEL</div>
          </div>
          <ul className="info-list" style={{ marginTop: 16 }}>
            <li>2 базовые процедуры в месяц</li>
            <li>Приоритетная запись на любые слоты</li>
            <li>−15% на дополнительные процедуры</li>
            <li>−10% на всю ANZH.store</li>
            <li>Закрытые квартальные акции</li>
            <li>Можно поставить на паузу или отменить в любой момент</li>
          </ul>
        </>
      ),
      actions: (
        <button
          className="btn btn-amber btn-block"
          onClick={() => toast('Оформляю подписку — открываю оплату', 'success')}
        >
          Оформить ANZH Pass
        </button>
      ),
    });

  return (
    <div className="screen anzh-screen">
      <header className="header">
        <img src="/brand/anzh-logo.svg" alt="ANZH" style={{ height: 22 }} />
        <button className="chip chip-amber" onClick={showPass}>★ −10% Pass</button>
      </header>

      <button
        className="anzh-hero"
        onClick={showPass}
        style={{ border: 0, padding: 0, cursor: 'pointer', background: 'none' }}
        aria-label="О бренде"
      >
        <img
          src="/brand/anzh-back.png"
          alt="ANZH"
          style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 'inherit', display: 'block' }}
        />
      </button>

      <h1 style={{ fontFamily: 'Space Grotesk, system-ui, sans-serif', fontSize: 28, fontWeight: 600, letterSpacing: '-0.015em' }}>
        ANZH.store
      </h1>
      <p className="muted" style={{ fontSize: 14, marginTop: 6, maxWidth: 320, marginInline: 'auto' }}>
        {lang === 'ru'
          ? 'Домашний уход, который Анжелика назначает после процедур. Покупки в один тап, цена клиента — −10%.'
          : 'Home care Anjelika prescribes after treatments. One-tap checkout, client price — −10%.'}
      </p>

      <div className="anzh-grid">
        {PRODUCTS.map((p) => (
          <button
            key={p.id}
            className="card"
            onClick={() => showProduct(p)}
            style={{ textAlign: 'left', cursor: 'pointer', font: 'inherit', color: 'inherit' }}
          >
            <div
              style={{
                width: '100%',
                height: 104,
                borderRadius: 14,
                backgroundImage: `url(${p.photo})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                marginBottom: 10,
                border: '0.5px solid var(--border)',
                boxShadow: '0 8px 22px -12px rgba(0,0,0,0.6)',
              }}
            />
            <div style={{ fontWeight: 600, fontSize: 14, lineHeight: 1.3 }}>{p.name}</div>
            <div className="faint" style={{ fontSize: 12, marginTop: 2 }}>{p.sub}</div>
            <div className="px">{p.price}</div>
          </button>
        ))}
      </div>

      <button
        className="btn btn-amber btn-block"
        style={{ marginTop: 22 }}
        onClick={() => {
          openSheet({
            title: lang === 'ru' ? 'Узнай всё о своей коже' : 'Discover your skin',
            subtitle: lang === 'ru' ? 'Персональный квиз ANZH · 4 минуты' : 'Personal ANZH quiz · 4 min',
            body: (
              <>
                <p className="muted" style={{ lineHeight: 1.65 }}>
                  {lang === 'ru'
                    ? 'Ответь на 12 вопросов о коже, образе жизни и целях — Анжелика подберёт индивидуальный протокол ухода и список процедур, которые тебе действительно нужны.'
                    : 'Answer 12 questions about your skin, lifestyle and goals — Anjelika will build a personal care protocol and the exact treatments you actually need.'}
                </p>
                <ul className="info-list" style={{ marginTop: 14 }}>
                  <li>{lang === 'ru' ? 'Тип кожи · фототип · реакции' : 'Skin type · phototype · reactions'}</li>
                  <li>{lang === 'ru' ? 'Аллергии и противопоказания' : 'Allergies and contraindications'}</li>
                  <li>{lang === 'ru' ? 'Текущие средства ухода' : 'Current skincare routine'}</li>
                  <li>{lang === 'ru' ? 'Цели: anti-age / acne / сияние' : 'Goals: anti-age / acne / glow'}</li>
                  <li>{lang === 'ru' ? 'Бюджет и темп' : 'Budget and pace'}</li>
                </ul>
                <p className="faint" style={{ fontSize: 12, marginTop: 14 }}>
                  {lang === 'ru' ? 'Результат — PDF-отчёт с подбором уходовой линейки и плана процедур.' : 'Result — a PDF report with a curated routine and treatment plan.'}
                </p>
              </>
            ),
            actions: (
              <button
                className="btn btn-primary btn-block"
                onClick={() => {
                  window.open('https://www.anzh.store', '_blank', 'noopener');
                  toast(lang === 'ru' ? 'Открываю квиз на anzh.store' : 'Opening the quiz on anzh.store', 'success');
                }}
              >
                {lang === 'ru' ? 'Начать квиз на anzh.store' : 'Start the quiz on anzh.store'}
              </button>
            ),
          });
        }}
      >
        {lang === 'ru' ? 'Узнай всё о своей коже →' : 'Discover your skin →'}
      </button>

      <p className="faint" style={{ fontSize: 12, marginTop: 14 }}>
        {lang === 'ru' ? 'Персональный подбор от Анжелики' : 'Personal picks by Anjelika'}
      </p>
    </div>
  );
}
