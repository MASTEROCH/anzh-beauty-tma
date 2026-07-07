import { useEffect, useState, useRef } from 'react';

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

interface EmotionCfg { folder: string; frames: number; fps: number }

const EMOTIONS: Record<MascotEmotion, EmotionCfg> = {
  idle:        { folder: 'idle',        frames: 8,  fps: 4  },
  adoration:   { folder: 'adoration',   frames: 8,  fps: 8  },
  fun:         { folder: 'fun',         frames: 11, fps: 10 },
  think:       { folder: 'think',       frames: 9,  fps: 5  },
  wonder:      { folder: 'wonder',      frames: 5,  fps: 5  },
  listen:      { folder: 'listen',      frames: 9,  fps: 7  },
  pause:       { folder: 'pause',       frames: 8,  fps: 4  },
  wink:        { folder: 'wink',        frames: 6,  fps: 10 },
  eating:      { folder: 'eating',      frames: 12, fps: 8  },
  coughing:    { folder: 'coughing',    frames: 10, fps: 8  },
  temperature: { folder: 'temperature', frames: 16, fps: 8  },
  sneezing:    { folder: 'sneezing',    frames: 11, fps: 8  },
  glitch:      { folder: 'glitch',      frames: 4,  fps: 10 },
};

const IDLE_INTERJECTIONS: MascotEmotion[] = ['wink', 'wink', 'wink', 'sneezing', 'coughing'];

interface Props {
  mood?: MascotEmotion;
  size?: number;
  className?: string;
  onTap?: () => void;
}

/**
 * AppHub mascot — sphere body + emotion sprite + glow halo.
 * Ported from dine-redesign_2.0 with same FPS/frame calibration.
 */
export function Mascot({ mood = 'idle', size = 72, className, onTap }: Props) {
  const [active, setActive] = useState<MascotEmotion>(mood);
  const [frame, setFrame] = useState(0);
  const overrideTimer = useRef<number | null>(null);
  const interjectTimer = useRef<number | null>(null);
  const tapHistory = useRef<number[]>([]);

  useEffect(() => {
    if (overrideTimer.current) return;
    setActive(mood);
    setFrame(0);
  }, [mood]);

  useEffect(() => {
    const targets: MascotEmotion[] = [mood, 'idle', 'wink', 'think', 'fun'];
    targets.forEach((emotion) => {
      const cfg = EMOTIONS[emotion];
      if (!cfg) return;
      for (let i = 1; i <= cfg.frames; i++) {
        const img = new Image();
        img.src = `/mascot/${cfg.folder}/${String(i).padStart(2, '0')}.webp`;
      }
    });
  }, [mood]);

  useEffect(() => {
    const cfg = EMOTIONS[active];
    if (!cfg) return;
    let f = 0;
    setFrame(0);
    const id = window.setInterval(() => {
      f = (f + 1) % cfg.frames;
      setFrame(f);
    }, 1000 / cfg.fps);
    return () => window.clearInterval(id);
  }, [active]);

  useEffect(() => {
    if (active !== mood || mood !== 'idle') return;
    function schedule() {
      const delay = 30000 + Math.random() * 30000;
      interjectTimer.current = window.setTimeout(() => {
        const pick = IDLE_INTERJECTIONS[Math.floor(Math.random() * IDLE_INTERJECTIONS.length)];
        playOnce(pick);
      }, delay);
    }
    schedule();
    return () => {
      if (interjectTimer.current) window.clearTimeout(interjectTimer.current);
    };
  }, [active, mood]);

  function playOnce(emotion: MascotEmotion) {
    if (overrideTimer.current) window.clearTimeout(overrideTimer.current);
    const cfg = EMOTIONS[emotion];
    const duration = Math.max(900, (cfg.frames * 1000) / cfg.fps);
    setActive(emotion);
    setFrame(0);
    overrideTimer.current = window.setTimeout(() => {
      overrideTimer.current = null;
      setActive(mood);
      setFrame(0);
    }, duration);
  }

  function handleClick() {
    const now = Date.now();
    tapHistory.current = tapHistory.current.filter((t) => now - t < 1500);
    tapHistory.current.push(now);
    if (tapHistory.current.length >= 3) {
      tapHistory.current = [];
      playOnce('glitch');
    }
    onTap?.();
  }

  const cfg = EMOTIONS[active];
  const padded = String(frame + 1).padStart(2, '0');
  const src = `/mascot/${cfg.folder}/${padded}.webp`;

  return (
    <div
      className={['mascot-stage', className].filter(Boolean).join(' ')}
      style={{ width: size, height: size }}
      onClickCapture={onTap ? handleClick : undefined}
    >
      <span className="mascot-halo" aria-hidden />
      <img className="mascot-back" src="/mascot/back.webp" alt="" draggable={false} />
      <img className="mascot-frame" src={src} alt="" draggable={false} />
      <span className="mascot-sheen" aria-hidden />
    </div>
  );
}
