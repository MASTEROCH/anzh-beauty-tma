import type { MascotEmotion } from '../components/Mascot';

const EVT = 'mascot:mood';

export function emitMascotMood(mood: MascotEmotion, duration = 2500) {
  window.dispatchEvent(new CustomEvent(EVT, { detail: { mood, duration } }));
}

export function onMascotMood(
  handler: (mood: MascotEmotion, duration: number) => void,
): () => void {
  function listener(e: Event) {
    const ev = e as CustomEvent<{ mood: MascotEmotion; duration: number }>;
    handler(ev.detail.mood, ev.detail.duration);
  }
  window.addEventListener(EVT, listener);
  return () => window.removeEventListener(EVT, listener);
}
