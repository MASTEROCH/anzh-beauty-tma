import { tr } from '../lib/i18n';
import { useEffect, useRef, useState } from 'react';
import { Icon } from './Icon';
import { starsToUsd } from '../lib/payments';

/* «Старая цена зачёркивается» — механика ROCH Motion `price-drop`, своим
   кодом (лицензия набора — только команда AppHUB, движок в продукт клиента
   не вкладываем). Скидка видна прямо в цене, а не подписью сбоку:
     1. по старой цене прочерчивается штрих (SVG, stroke-dashoffset);
     2. её копия «падает» с поворотом — ускорение, как под тяжестью;
     3. новая цена докручивается от старой вниз (табло, правые разряды быстрее);
     4. бейдж «−33 %» выпрыгивает на пружине.
   Раз за жизнь экрана, по входу в кадр. reduced-motion — сразу итог.
   «Чего не делать» из паспорта эффекта: падение только для честной
   скидки — у пакета она настоящая (цена шести разборов по отдельности). */

const still = () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

export function PriceDrop({ oldStars, newStars, badge = true, className = '' }: { oldStars: number; newStars: number; badge?: boolean; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [go, setGo] = useState(still());
  const oldUsd = Number(starsToUsd(oldStars));
  const newUsd = Number(starsToUsd(newStars));
  const [usd, setUsd] = useState(go ? newUsd : oldUsd);
  const pct = Math.round((1 - newStars / oldStars) * 100);

  useEffect(() => {
    const el = ref.current;
    if (!el || go) return;
    if (typeof IntersectionObserver === 'undefined') { setGo(true); return; }
    const io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) { setGo(true); io.disconnect(); } }, { threshold: 0.6 });
    io.observe(el);
    return () => io.disconnect();
  }, [go]);

  useEffect(() => {
    if (!go || still()) { setUsd(newUsd); return; }
    let raf = 0;
    const t0 = performance.now() + 380; // после штриха
    const step = (t: number) => {
      const k = Math.max(0, Math.min(1, (t - t0) / 900));
      setUsd(oldUsd + (newUsd - oldUsd) * (1 - Math.pow(1 - k, 3)));
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    const done = window.setTimeout(() => setUsd(newUsd), 1500); // скрытая вкладка морозит rAF
    return () => { cancelAnimationFrame(raf); window.clearTimeout(done); };
  }, [go, oldUsd, newUsd]);

  return (
    <span ref={ref} className={`pd${go ? ' pd-go' : ''} ${className}`.trim()} aria-label={`$${starsToUsd(newStars)} · ${newStars} ★ ${tr('вместо', 'instead of')} ${oldStars} ★`}>
      <span className="pd-top" aria-hidden>
        {badge && pct > 0 && <span className="pd-badge">−{pct}%</span>}
        <span className="pd-old">
          {oldStars} ★
          <svg className="pd-strike" viewBox="0 0 100 10" preserveAspectRatio="none"><path d="M2 7 Q 50 2 98 4" pathLength={100} /></svg>
          <span className="pd-fall">{oldStars} ★</span>
        </span>
      </span>
      <span className="pd-new" aria-hidden>${usd.toFixed(2)}</span>
      <span className="pd-stars" aria-hidden><Icon name="star" size={12} strokeWidth={2} fill="current" />{newStars}</span>
    </span>
  );
}
