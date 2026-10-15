import type { CSSProperties } from 'react';

/* Живое фото Анжелики (Vifix · Kling 3.0, 5 с, петля: первый и последний
   кадр — само фото, стык не виден). Одобрено Рочем 15.10 для продукта.
   Постер — то же фото: пока ролик грузится или если автозапуск запрещён
   (режим энергосбережения iOS), виден обычный портрет, без чёрного кадра.
   «Уменьшить движение» — только фото. Мимика сгенерирована ИИ. */
export function LiveAnzhelika({ className, style, alt = 'Anjelika' }: { className?: string; style?: CSSProperties; alt?: string }) {
  const still = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  if (still) return <img src="/photos/anjelika.webp" alt={alt} className={className} style={style} />;
  return (
    <video
      className={`live-avatar${className ? ` ${className}` : ''}`}
      style={style}
      poster="/photos/anjelika.webp"
      autoPlay
      muted
      loop
      playsInline
      preload="auto"
      aria-label={alt || undefined}
      aria-hidden={alt ? undefined : true}
      disablePictureInPicture
    >
      <source src="/photos/anjelika-live.webm" type="video/webm" />
      <source src="/photos/anjelika-live.mp4" type="video/mp4" />
    </video>
  );
}
