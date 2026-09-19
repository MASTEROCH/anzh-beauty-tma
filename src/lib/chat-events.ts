const EVT = 'chat:ask';


export function onAskMascot(handler: (question: string) => void): () => void {
  function listener(e: Event) {
    const ev = e as CustomEvent<{ question: string }>;
    handler(ev.detail.question);
  }
  window.addEventListener(EVT, listener);
  return () => window.removeEventListener(EVT, listener);
}
