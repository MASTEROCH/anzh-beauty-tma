import { useEffect, useRef, useState } from 'react';

// Ассистент — чёрная сфера с логотипом ANZH, а не лицо. Мультяшная мимика
// спорила с тоном кабинета: у врача-косметолога это марка, а не персонаж.
// Настроение осталось в API (его шлют экраны и чат), но выражается теперь
// светом и пульсом ореола, а не гримасами. Логотип бьётся как сердце —
// настроение меняет частоту удара, а не выражение лица.

export type MascotEmotion =
  | 'idle'
  | 'adoration'
  | 'fun'
  | 'think'
  | 'wonder'
  | 'listen'
  | 'pause'
  | 'wink'
  | 'eating'
  | 'coughing'
  | 'temperature'
  | 'sneezing'
  | 'glitch';

/** Настроение → характер свечения */
const PULSE: Record<MascotEmotion, 'calm' | 'active' | 'warm'> = {
  idle: 'calm',
  pause: 'calm',
  think: 'active',
  listen: 'active',
  wonder: 'active',
  fun: 'warm',
  adoration: 'warm',
  wink: 'warm',
  eating: 'warm',
  coughing: 'calm',
  temperature: 'calm',
  sneezing: 'calm',
  glitch: 'active',
};

interface Props {
  mood?: MascotEmotion;
  size?: number;
  className?: string;
  onTap?: () => void;
}

export function Mascot({ mood = 'idle', size = 72, className, onTap }: Props) {
  const [spin, setSpin] = useState(false);
  const tapHistory = useRef<number[]>([]);
  const spinTimer = useRef<number | null>(null);

  useEffect(() => () => { if (spinTimer.current) window.clearTimeout(spinTimer.current); }, []);

  function handleClick() {
    const now = Date.now();
    tapHistory.current = tapHistory.current.filter((t) => now - t < 1500);
    tapHistory.current.push(now);
    if (tapHistory.current.length >= 3) {
      tapHistory.current = [];
      setSpin(true);
      if (spinTimer.current) window.clearTimeout(spinTimer.current);
      spinTimer.current = window.setTimeout(() => setSpin(false), 900);
    }
    onTap?.();
  }

  return (
    <div
      className={['mascot-stage', `mascot-${PULSE[mood]}`, spin ? 'mascot-spin' : '', className].filter(Boolean).join(' ')}
      style={{ width: size, height: size }}
      onClickCapture={onTap ? handleClick : undefined}
    >
      <span className="mascot-halo" aria-hidden />
      <img className="mascot-back" src="/mascot/back.webp" alt="" draggable={false} />
      <span className="mascot-logo" aria-hidden />
      <span className="mascot-sheen" aria-hidden />
    </div>
  );
}
