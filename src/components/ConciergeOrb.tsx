/**
 * ConciergeOrb — premium liquid-glass AI concierge avatar.
 * Replaces the raster cartoon mascot with an on-brand emerald/gold glass
 * gem: a refracting sphere, breathing inner light, drifting specular, and
 * a faint sparkle. Pure CSS/SVG — no assets, scales to any size.
 */
interface Props {
  size?: number;
  /** 'idle' | 'think' | 'listen' — subtle state tint, optional */
  state?: 'idle' | 'think' | 'listen';
  className?: string;
  onTap?: () => void;
}

export function ConciergeOrb({ size = 56, state = 'idle', className, onTap }: Props) {
  return (
    <span
      className={['orb', `orb--${state}`, className].filter(Boolean).join(' ')}
      style={{ width: size, height: size }}
      onClick={onTap}
      aria-hidden
    >
      <span className="orb-halo" />
      <span className="orb-body">
        <span className="orb-core" />
        <span className="orb-swirl" />
        <span className="orb-spec" />
        <span className="orb-rim" />
      </span>
      <span className="orb-spark orb-spark--1" />
      <span className="orb-spark orb-spark--2" />
    </span>
  );
}
