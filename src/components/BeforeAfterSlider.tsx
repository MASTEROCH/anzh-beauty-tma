import { useRef, useState } from 'react';

// Интерактивное «до / после»: одна фотография поверх другой, шторка тянется
// пальцем. Раньше это были две статичные плитки с ОДНИМ и тем же снимком —
// как только клиент замечал, что половинки идентичны, доказательство
// результата превращалось в его противоположность.

interface Props {
  before: string;
  after: string;
  beforeLabel?: string;
  afterLabel?: string;
  /** Пока нет двух разных снимков — «до» показывается в холодной гамме */
  grade?: boolean;
  height?: number;
}

export function BeforeAfterSlider({
  before,
  after,
  beforeLabel = 'ДО',
  afterLabel = 'ПОСЛЕ',
  grade = true,
  height = 260,
}: Props) {
  const [pos, setPos] = useState(50);
  const [dragging, setDragging] = useState(false);
  // Подсказка играет один раз и снимается при первом касании
  const [teasing, setTeasing] = useState(true);
  const boxRef = useRef<HTMLDivElement>(null);

  const moveTo = (clientX: number) => {
    const box = boxRef.current;
    if (!box) return;
    const rect = box.getBoundingClientRect();
    const next = ((clientX - rect.left) / rect.width) * 100;
    setPos(Math.max(0, Math.min(100, next)));
  };

  return (
    <div
      className={`ba-slider${dragging ? ' dragging' : ''}${teasing ? ' tease' : ''}`}
      ref={boxRef}
      style={{ height }}
      onPointerDown={(e) => {
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        setTeasing(false);
        setDragging(true);
        moveTo(e.clientX);
      }}
      onPointerMove={(e) => { if (dragging) moveTo(e.clientX); }}
      onPointerUp={() => setDragging(false)}
      onPointerCancel={() => setDragging(false)}
    >
      <div className="ba-layer ba-after" style={{ backgroundImage: `url(${after})` }} />
      <div
        className={`ba-layer ba-before${grade ? ' graded' : ''}`}
        style={{ backgroundImage: `url(${before})`, clipPath: `inset(0 ${100 - pos}% 0 0)` }}
      />

      <span className="ba-label ba-label-before" style={{ opacity: pos > 14 ? 1 : 0 }}>{beforeLabel}</span>
      <span className="ba-label ba-label-after" style={{ opacity: pos < 86 ? 1 : 0 }}>{afterLabel}</span>

      <div className="ba-handle" style={{ left: `${pos}%` }}>
        <span className="ba-handle-line" />
        <button
          className="ba-handle-grip"
          aria-label="Потяни, чтобы сравнить до и после"
          role="slider"
          aria-valuenow={Math.round(pos)}
          aria-valuemin={0}
          aria-valuemax={100}
          onKeyDown={(e) => {
            if (e.key === 'ArrowLeft') setPos((p) => Math.max(0, p - 5));
            if (e.key === 'ArrowRight') setPos((p) => Math.min(100, p + 5));
          }}
        >
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 7l5 5-5 5M10 17l-5-5 5-5" />
          </svg>
        </button>
      </div>
    </div>
  );
}
