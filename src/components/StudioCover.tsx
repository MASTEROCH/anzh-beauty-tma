import { useCallback, useEffect, useRef, useState } from 'react';
import { Icon } from './Icon';
import { t, type Lang } from '../lib/i18n';
import { asset } from '../lib/asset';
import { closeSheet, openLightbox, openSheet } from '../lib/ui';
import { tap } from '../lib/haptics';
import { STUDIO_COVER, STUDIO_PHOTOS, STUDIO_STRIP, type StudioShot } from '../data/studio';

// K15 (owner 07.10): "the video on the main screen as a cover about the studio — how it looks
// from the street and how to get in". The route video and the studio photos.
//
// Place (K15b, Hater K15-H4, John 07.10): the cover is the TOP block of the main screen — under
// the app header, above the avatar, the name and the buttons; the screen's width, 16:9 (the
// frame is a centred crop of the 9:16 video — the sign stays in it); the hero right under it.
//
// The network (Censor C1): the cover is on the first screen, so "near the screen" alone would
// start the ~1 MB video together with the catalog, the fonts and the first pictures. The <video>
// has no src and preload="none" until ALL of: the page has fired `load` and the browser has had
// an idle moment (requestIdleCallback; WebKit has none — 1.5 s after `load`); the block is on
// screen (rootMargin 0); autoplay is allowed — not with "reduce motion", Save-Data or a 2g
// connection. Then it plays MUTED (browsers and the Telegram WebView start only muted video by
// themselves). `muted` is set through the ref and as an attribute: React sets neither the
// attribute nor, reliably, the property, and iOS checks the attribute. Off screen or with the
// app in the background it pauses. A tap on ▶ loads it at once — that is the person's choice.
//
// States (Censor C2): loading — a ring instead of ▶ (from play() — and loadstart while it is
// unsettled — or waiting, until playing / pause / a refusal);
// failed — the file did not load or can't be decoded (`error`, or play() refused with
// NotSupportedError): ▶ and the sound button go, the poster stays — no button that does nothing.
// A refused AUTOPLAY (NotAllowedError) is not a failure: the poster and ▶ stay, a tap plays it.
// Sound: the "Turn sound on" button, again — off; not remembered between visits.

type NetInfo = { saveData?: boolean; effectiveType?: string };
type IdleWindow = Window & {
  requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
  cancelIdleCallback?: (id: number) => void;
};
const REDUCE = '(prefers-reduced-motion: reduce)';
/** Without requestIdleCallback (WebKit, Telegram iOS): start this long after `load`. */
const IDLE_FALLBACK_MS = 1500;

/** May the cover start by itself? (iOS has no Network Information API: load + idle + ~1 MB guard it.) */
function autoplayAllowed(): boolean {
  if (typeof window === 'undefined') return false;
  if (window.matchMedia?.(REDUCE).matches) return false;
  const c = (navigator as Navigator & { connection?: NetInfo }).connection;
  if (c && (c.saveData || /^(slow-2g|2g)$/.test(c.effectiveType ?? ''))) return false;
  return true;
}

/** True once the page has fired `load` and the browser has had an idle moment after it. */
function useAfterLoadIdle(): boolean {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const w = window as IdleWindow;
    let idle: number | undefined;
    let timer: number | undefined;
    const afterLoad = () => {
      if (typeof w.requestIdleCallback === 'function') idle = w.requestIdleCallback(() => setReady(true), { timeout: 3000 });
      else timer = window.setTimeout(() => setReady(true), IDLE_FALLBACK_MS);
    };
    if (document.readyState === 'complete') afterLoad();
    else window.addEventListener('load', afterLoad, { once: true });
    return () => {
      window.removeEventListener('load', afterLoad);
      if (idle !== undefined) w.cancelIdleCallback?.(idle);
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, []);
  return ready;
}

/** The route video as the cover of the main screen (K15, K15b). */
export function StudioCover({ lang }: { lang: Lang }) {
  const frameRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const ready = useAfterLoadIdle();
  const [auto, setAuto] = useState(autoplayAllowed);
  const [near, setNear] = useState(false);
  const [src, setSrc] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [muted, setMuted] = useState(true);
  const userPaused = useRef(false);
  const userStarted = useRef(false);
  const wantPlay = useRef(false);
  // A play() is asked and not settled yet. `loadstart` is a queued task: it may come AFTER
  // `playing` or after a refused play() — then it must not bring the ring back.
  const pending = useRef(false);

  // The attribute at mount (iOS) and the property (everyone)
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.setAttribute('muted', '');
    v.muted = true;
  }, []);

  // "Reduce motion" switched while the app is open: decide again; a video that started by itself
  // stops (Censor C5) — one the person started stays theirs
  useEffect(() => {
    const mq = window.matchMedia?.(REDUCE);
    if (!mq) return;
    const on = () => {
      const allowed = autoplayAllowed();
      setAuto(allowed);
      if (!allowed && !userStarted.current) {
        wantPlay.current = false;
        videoRef.current?.pause();
      }
    };
    mq.addEventListener?.('change', on);
    return () => mq.removeEventListener?.('change', on);
  }, []);

  const play = useCallback(() => {
    const v = videoRef.current;
    if (!v || !v.getAttribute('src')) return;
    pending.current = true;
    setLoading(true);
    const p = v.play();
    if (p && typeof p.then === 'function') {
      p.catch((e: unknown) => {
        pending.current = false;
        setPlaying(false);
        setLoading(false);
        // No playable source (no codec, a broken file): unlike a refused autoplay, a tap won't help
        if ((e as { name?: string } | null)?.name === 'NotSupportedError') setFailed(true);
      });
    }
  }, []);

  // On screen or off (rootMargin 0: the first request waits for the block itself); off → pause
  useEffect(() => {
    const el = frameRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver((entries) => {
      // The LAST entry of a batch is the current state (Censor C4)
      const e = entries[entries.length - 1];
      setNear(e.isIntersecting);
      if (!e.isIntersecting) videoRef.current?.pause();
    }, { rootMargin: '0px' });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // By itself: on screen + after load and idle + allowed + not paused by the person
  useEffect(() => {
    if (!near || !ready || !auto || failed || userPaused.current) return;
    wantPlay.current = true;
    if (videoRef.current?.getAttribute('src')) play();
    else setSrc(STUDIO_COVER.video);
  }, [near, ready, auto, failed, play]);

  // The src has just been set: start if someone wants it
  useEffect(() => {
    if (src && wantPlay.current) play();
  }, [src, play]);

  // Telegram minimised / tab hidden → pause; back → resume if it was playing by itself
  useEffect(() => {
    const on = () => {
      if (document.visibilityState === 'hidden') videoRef.current?.pause();
      else if (near && ready && auto && !failed && !userPaused.current && src) play();
    };
    document.addEventListener('visibilitychange', on);
    return () => document.removeEventListener('visibilitychange', on);
  }, [near, ready, auto, failed, src, play]);

  const start = () => {
    userPaused.current = false;
    userStarted.current = true;
    wantPlay.current = true;
    if (videoRef.current?.getAttribute('src')) play();
    else setSrc(STUDIO_COVER.video);
  };

  const toggle = () => {
    tap();
    const v = videoRef.current;
    if ((playing || loading) && v) {
      userPaused.current = true;
      wantPlay.current = false;
      pending.current = false;
      setLoading(false);
      v.pause();
    } else start();
  };

  const toggleSound = () => {
    tap();
    const v = videoRef.current;
    const next = !muted;
    setMuted(next);
    if (v) {
      v.muted = next;
      if (next) v.setAttribute('muted', '');
      else v.removeAttribute('muted');
    }
    // "Sound on" is a tap — a user gesture: the video may start with sound now
    if (!next && !playing && !loading) start();
  };

  const state = failed ? 'failed' : loading ? 'loading' : playing ? 'playing' : 'idle';
  return (
    <div
      className="studio-cover"
      ref={frameRef}
      data-testid="studio-cover"
      data-auto={auto ? '1' : '0'}
      data-playing={playing ? '1' : '0'}
      data-near={near ? '1' : '0'}
      data-state={state}
      aria-busy={loading || undefined}
    >
      {/* The top of the screen: the poster loads at once (no loading="lazy") */}
      <img
        className="studio-cover-poster"
        src={asset(STUDIO_COVER.poster)}
        width={STUDIO_COVER.w}
        height={STUDIO_COVER.h}
        decoding="async"
        alt={t('studio.poster', lang)}
      />
      <video
        ref={videoRef}
        className="studio-cover-video"
        src={src ? asset(src) : undefined}
        width={STUDIO_COVER.w}
        height={STUDIO_COVER.h}
        playsInline
        loop
        preload="none"
        disablePictureInPicture
        aria-label={t('studio.video', lang)}
        onLoadStart={() => { if (pending.current) setLoading(true); }}
        onWaiting={() => setLoading(true)}
        onPlaying={() => { pending.current = false; setLoading(false); setPlaying(true); }}
        onPause={() => { pending.current = false; setLoading(false); setPlaying(false); }}
        onError={() => { pending.current = false; setFailed(true); setLoading(false); setPlaying(false); }}
      />
      {!failed && (
        <>
          <button
            className="studio-cover-toggle"
            data-testid="studio-cover-toggle"
            aria-label={playing || loading ? t('studio.pause', lang) : t('studio.play', lang)}
            onClick={toggle}
          >
            {loading
              ? <span className="studio-cover-wait" data-testid="studio-cover-wait" aria-hidden />
              : !playing && <span className="studio-cover-play" aria-hidden><Icon name="play" size={26} strokeWidth={2} /></span>}
          </button>
          {/* The label says the action and changes with it — so no aria-pressed (Censor C6) */}
          <button className="studio-cover-sound" data-testid="studio-cover-sound" data-on={muted ? undefined : '1'} onClick={toggleSound}>
            <Icon name={muted ? 'volume' : 'volume-off'} size={16} strokeWidth={2} />
            {muted ? t('studio.soundOn', lang) : t('studio.soundOff', lang)}
          </button>
        </>
      )}
    </div>
  );
}

const openShot = (s: StudioShot, lang: Lang) => openLightbox(asset(s.src), s.caption[lang], { alt: s.caption[lang] });

function ShotThumb({ s, lang, className }: { s: StudioShot; lang: Lang; className: string }) {
  return (
    <button className={className} data-shot={s.id} onClick={() => { tap(); openShot(s, lang); }} aria-label={`${t('works.open', lang)}: ${s.caption[lang]}`}>
      <img src={asset(s.thumb)} width={s.w} height={s.h} loading="lazy" decoding="async" alt="" />
    </button>
  );
}

function openAll(lang: Lang) {
  tap();
  openSheet({
    title: t('studio.allTitle', lang),
    body: (
      <div className="studio-all-grid" data-testid="studio-all">
        {STUDIO_PHOTOS.map((s) => (
          <button
            key={s.id}
            className="studio-all-tile"
            data-shot={s.id}
            onClick={() => { closeSheet(); setTimeout(() => openShot(s, lang), 200); }}
            aria-label={`${t('works.open', lang)}: ${s.caption[lang]}`}
          >
            <img src={asset(s.thumb)} width={s.w} height={s.h} loading="lazy" decoding="async" alt="" />
          </button>
        ))}
      </div>
    ),
  });
}

/** "Inside the studio": the strip of studio photos and "All photos". The route video is the
    cover at the top of the screen (K15b). Not behind PROFILE_TEXTS_SHOWN. */
export function StudioSection({ lang }: { lang: Lang }) {
  return (
    <section className="section section-tight" data-testid="studio-block">
      <div className="section-head">
        <div>
          <div className="eyebrow">{t('studio.eyebrow', lang)}</div>
          <h2 className="section-title">{t('studio.allTitle', lang)}</h2>
        </div>
      </div>
      <div className="studio-strip" data-testid="studio-strip" role="group" aria-label={t('studio.photos', lang)}>
        {STUDIO_STRIP.map((s) => <ShotThumb key={s.id} s={s} lang={lang} className="studio-shot" />)}
        <button className="studio-shot studio-shot--all" data-testid="studio-all-open" onClick={() => openAll(lang)}>
          <Icon name="sparkles" size={18} strokeWidth={2} />
          {t('studio.all', lang).replace('{n}', String(STUDIO_PHOTOS.length))}
        </button>
      </div>
    </section>
  );
}
