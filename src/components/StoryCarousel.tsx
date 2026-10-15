import { useEffect, useRef, useState } from 'react';
import { useLang } from '../lib/i18n';

// Сторис-карусель по механике EPOCH (VenueHero). Ключевые решения оттуда,
// проверенные на бою:
//  · прогресс двигает requestAnimationFrame, а не setInterval — полоска должна
//    ехать плавно, а не дёргаться раз в кадр таймера;
//  · id кадра живёт в локальной переменной эффекта, НЕ в ref: иначе в
//    StrictMode уборка первого монтирования убивает кадр второго, и карусель
//    навсегда замирает на первом слайде;
//  · ось жеста фиксируется один раз за свайп, порог 8px, коммит 32px;
//  · touch-action: pan-y обязателен — с auto браузер съедает жест целиком;
//  · onTouchCancel обязателен: системный свайп «назад» или входящий звонок
//    не присылают touchend, и карусель осталась бы на паузе навсегда.

export interface Story {
  photo: string;
  title: string;
  text: string;
  titleEn?: string;
  textEn?: string;
}

const HOLD_MS = 4600;

export function StoryCarousel({ stories }: { stories: Story[] }) {
  const lang = useLang();
  const en = lang === 'en';
  const [index, setIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [paused, setPaused] = useState(false);
  const touch = useRef<{ x: number; y: number; axis: 'x' | 'y' | null } | null>(null);

  const go = (dir: 1 | -1) => {
    setIndex((i) => (i + dir + stories.length) % stories.length);
    setProgress(0);
  };

  useEffect(() => {
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduced || paused) return;

    let id = 0;
    let alive = true;
    const started = performance.now();

    const tick = (now: number) => {
      if (!alive) return;
      const p = Math.min(1, (now - started) / HOLD_MS);
      setProgress(p);
      if (p >= 1) {
        setIndex((i) => (i + 1) % stories.length);
        setProgress(0);
        return;
      }
      id = requestAnimationFrame(tick);
    };
    id = requestAnimationFrame(tick);

    return () => { alive = false; cancelAnimationFrame(id); };
  }, [index, paused, stories.length]);

  // Вкладка ушла в фон — останавливаемся, иначе человек возвращается к
  // случайному слайду.
  useEffect(() => {
    const onVis = () => setPaused(document.hidden);
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);

  const story = stories[index];

  return (
    <div
      className="story"
      onTouchStart={(e) => {
        const t = e.touches[0];
        touch.current = { x: t.clientX, y: t.clientY, axis: null };
        setPaused(true);
      }}
      onTouchMove={(e) => {
        const st = touch.current;
        if (!st) return;
        const t = e.touches[0];
        const dx = t.clientX - st.x;
        const dy = t.clientY - st.y;
        if (!st.axis && Math.hypot(dx, dy) > 8) st.axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
      }}
      onTouchEnd={(e) => {
        const st = touch.current;
        touch.current = null;
        setPaused(false);
        if (!st || st.axis !== 'x') return;
        const dx = e.changedTouches[0].clientX - st.x;
        if (Math.abs(dx) > 32) go(dx < 0 ? 1 : -1);
      }}
      onTouchCancel={() => { touch.current = null; setPaused(false); }}
    >
      <div className="story-ticks">
        {stories.map((_, i) => (
          <div key={i} className="story-tick">
            <div
              className="story-tick-fill"
              style={{
                transform: `scaleX(${i < index ? 1 : i === index ? progress : 0})`,
                transition: i === index ? 'none' : 'transform 0.3s linear',
              }}
            />
          </div>
        ))}
      </div>

      <img key={story.photo} className="story-photo" src={story.photo} alt="" draggable={false} />
      <div className="story-shade" aria-hidden />

      <div key={index} className="story-caption">
        <div className="story-title">{en ? story.titleEn ?? story.title : story.title}</div>
        <p className="story-text">{en ? story.textEn ?? story.text : story.text}</p>
      </div>

      <button className="story-tap prev" onClick={() => go(-1)} aria-label="Предыдущий кадр" />
      <button className="story-tap next" onClick={() => go(1)} aria-label="Следующий кадр" />

      <div className="story-dots">
        {stories.map((_, i) => (
          <button
            key={i}
            className={`story-dot ${i === index ? 'active' : ''}`}
            onClick={() => { setIndex(i); setProgress(0); }}
            aria-label={`Кадр ${i + 1}`}
          />
        ))}
      </div>
    </div>
  );
}
