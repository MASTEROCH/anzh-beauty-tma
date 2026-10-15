import { useEffect, useRef, useState, type CSSProperties } from 'react';

/* Живое фото Анжелики (Vifix · Kling 3.0, 5 с, петля: первый и последний
   кадр — само фото, стык не виден). Одобрено Рочем 15.10 для продукта.

   🚨 Кнопки «Play» не бывает НИКОГДА (Роч 15.10, кадр с iPhone: системная
   кнопка воспроизведения закрыла лицо на первом экране). Две причины:
   · React не пишет атрибут `muted` в разметку, а iOS без него не даёт
     автозапуск — ставим muted руками до play();
   · в режиме энергосбережения iOS автозапуск запрещён вовсе — и тогда
     Safari рисует поверх застывшего <video> свою кнопку.
   Поэтому под видео ВСЕГДА лежит фото, а само видео прозрачно, пока не
   заиграло по-настоящему (событие `playing`). Не заиграло — человек видит
   портрет, а не кнопку. Первое касание экрана пробует запустить ещё раз.
   «Уменьшить движение» — только фото. Мимика сгенерирована ИИ. */
export function LiveAnjelika({ className, style, alt = 'Anjelika' }: { className?: string; style?: CSSProperties; alt?: string }) {
  const still = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const ref = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    const v = ref.current;
    if (!v || still) return;
    v.muted = true;
    v.defaultMuted = true;
    v.setAttribute('muted', '');
    v.setAttribute('playsinline', '');
    v.setAttribute('webkit-playsinline', '');
    const tryPlay = () => { void v.play().catch(() => { /* запрещено — остаётся фото */ }); };
    tryPlay();
    const onTouch = () => { if (v.paused) tryPlay(); };
    window.addEventListener('pointerdown', onTouch, { passive: true });
    window.addEventListener('touchstart', onTouch, { passive: true });
    return () => {
      window.removeEventListener('pointerdown', onTouch);
      window.removeEventListener('touchstart', onTouch);
    };
  }, [still]);

  return (
    <span className={`live-avatar${className ? ` ${className}` : ''}`} style={style} role={alt ? 'img' : undefined} aria-label={alt || undefined} aria-hidden={alt ? undefined : true}>
      <img src="/photos/anjelika.webp" alt="" className="live-avatar-still" />
      {!still && (
        <video
          ref={ref}
          className={`live-avatar-video${playing ? ' on' : ''}`}
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
          disablePictureInPicture
          controls={false}
          tabIndex={-1}
          aria-hidden
          onPlaying={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onEmptied={() => setPlaying(false)}
        >
          <source src="/photos/anjelika-live.webm" type="video/webm" />
          <source src="/photos/anjelika-live.mp4" type="video/mp4" />
        </video>
      )}
    </span>
  );
}
