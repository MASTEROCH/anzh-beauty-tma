import { openSheet, toast } from '../lib/ui';

type Product = { id: string; name: string; sub: string; price: string; emoji: string; description: string };

const PRODUCTS: Product[] = [
  { id: 'serum',  name: 'Skin Reset Serum', sub: 'Ниацинамид · 30 мл', price: '49 USD', emoji: '🧴', description: 'Сыворотка с 10% ниацинамидом и цинком. Снимает воспаления, выравнивает тон. Можно использовать утром под SPF.' },
  { id: 'cream',  name: 'Glow Cream',       sub: 'Гиалурон · SPF 30',  price: '38 USD', emoji: '🤍', description: 'Дневной крем с гиалуроновой кислотой и физическими фильтрами. Лёгкая текстура, без липкости.' },
  { id: 'mask',   name: 'Calm Mask',        sub: 'Алоэ · после процедур', price: '22 USD', emoji: '🌿', description: 'Восстанавливающая маска после инъекций, пилингов, чисток. Алоэ + пантенол + центелла.' },
  { id: 'recovery', name: 'Lip Recovery',   sub: 'После контурной',    price: '18 USD', emoji: '💋', description: 'Бальзам для губ после контурной пластики. Снимает отёк, ускоряет заживление за 48 часов.' },
];

export function AnzhScreen() {
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
              background: 'linear-gradient(135deg, var(--t), var(--gd))',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 80,
              boxShadow: 'var(--glow-teal)',
              border: '0.5px solid var(--border)',
            }}
          >
            {p.emoji}
          </div>
          <p style={{ marginTop: 16, lineHeight: 1.6 }}>{p.description}</p>
          <div className="row" style={{ marginTop: 14, gap: 10 }}>
            <span className="chip chip-amber">−10% по ANZH Pass</span>
            <span className="chip">★ 4.8 · 142 отзыва</span>
          </div>
          <div
            style={{
              fontFamily: 'Playfair Display, Georgia, serif',
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
            onClick={() => toast('Сохранено в желаемое 🤍', 'success')}
          >
            ♡ Сохранить
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
                fontFamily: 'Playfair Display, Georgia, serif',
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
          style={{ width: 60, height: 60, objectFit: 'contain', filter: 'drop-shadow(0 4px 18px rgba(47,118,122,0.5))' }}
        />
      </button>

      <h1 style={{ fontFamily: 'Playfair Display, Georgia, serif', fontSize: 28, fontWeight: 600, letterSpacing: '-0.015em' }}>
        ANZH.store
      </h1>
      <p className="muted" style={{ fontSize: 14, marginTop: 6, maxWidth: 320, marginInline: 'auto' }}>
        Домашний уход, который Анжелика назначает после процедур.
        Покупки в один тап, цена клиента — −10%.
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
                width: 44,
                height: 44,
                borderRadius: 14,
                background: 'linear-gradient(135deg, var(--t), var(--gd))',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 22,
                marginBottom: 10,
                boxShadow: 'var(--glow-teal)',
              }}
            >
              {p.emoji}
            </div>
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
            title: 'Узнай всё о своей коже',
            subtitle: 'Персональный квиз ANZH · 4 минуты',
            body: (
              <>
                <p className="muted" style={{ lineHeight: 1.65 }}>
                  Ответь на 12 вопросов о коже, образе жизни и целях — Анжелика подберёт индивидуальный протокол ухода и список процедур, которые тебе действительно нужны.
                </p>
                <ul className="info-list" style={{ marginTop: 14 }}>
                  <li>Тип кожи · фототип · реакции</li>
                  <li>Аллергии и противопоказания</li>
                  <li>Текущие средства ухода</li>
                  <li>Цели: anti-age / acne / сияние</li>
                  <li>Бюджет и темп</li>
                </ul>
                <p className="faint" style={{ fontSize: 12, marginTop: 14 }}>
                  Результат — PDF-отчёт с подбором уходовой линейки и плана процедур.
                </p>
              </>
            ),
            actions: (
              <button
                className="btn btn-primary btn-block"
                onClick={() => toast('Начинаю квиз — открываю первый шаг', 'success')}
              >
                Начать квиз
              </button>
            ),
          });
        }}
      >
        Узнай всё о своей коже →
      </button>

      <p className="faint" style={{ fontSize: 12, marginTop: 14 }}>
        Персональный подбор от Анжелики
      </p>
    </div>
  );
}
