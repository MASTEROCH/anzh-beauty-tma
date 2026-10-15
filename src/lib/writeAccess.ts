// The button «Получать ответ в Telegram» (КТ-7 С2): asking Telegram to let the bot
// message the client, and the six states every place shows (texts — writeAccessCopy.ts).
//
// TRUTH IS `Me.can_message` ONLY. The server sets it when Telegram delivers
// `write_access_allowed` (or /start) to the webhook (КТ-7 С1). The answer of
// `requestWriteAccess` is just a reason to re-read the profile: «allowed» whose flag did
// not rise is shown as «refused», never as «done».
//
// The waiting state lives HERE, not in a component: the request screen, the account feed
// and the settings show the same block and must agree — an ask started in one place is
// still being waited for in another.
//
// Never asks when a screen opens — only on a press. There is no «set the flag from the
// client's words» endpoint: the client only re-reads GET /me.

import { useEffect, useSyncExternalStore } from 'react';
import { currentMe, refreshMeAfterCurrent } from './api';
import { getLang } from './i18n';
import { askWriteAccess, canAskWriteAccess, onTelegramEvent, openTelegram } from './telegram';
import { toast } from './ui';
import { WRITE_ACCESS_COPY } from './writeAccessCopy';
import { RECHECK_DELAYS_MS } from './writeAccessRules';

/** Where the ask stands. */
export type WriteAccessPhase =
  | 'idle'
  | 'waiting'      // Telegram's prompt is open, no answer yet
  | 'checking'     // Telegram said «allowed»; re-reading Me by RECHECK_DELAYS_MS
  | 'timeout'      // no answer in WRITE_ACCESS_TIMEOUT_MS (telegram.ts)
  | 'refused'      // Telegram said «no»
  | 'not_raised'   // «allowed», but the last re-read of Me still said can_message is not true
  | 'unconfirmed'  // «allowed», but the last re-read of Me failed (network): we can't see the flag yet
  | 'unavailable'  // the call threw
  | 'done';        // Me.can_message became true after «allowed»

/**
 * What a place shows — Т1 §1: 1 unavailable, 2 offer, 3 waiting, 4 timeout (no answer),
 * 5 refused (or the flag did not rise), 6 ready; «unconfirmed» — «allowed» whose last
 * re-read of Me failed (Start 1b); or nothing.
 */
export type WriteAccessView = 'hidden' | 'unavailable' | 'offer' | 'waiting' | 'timeout' | 'refused' | 'unconfirmed' | 'ready';

export interface WriteAccessState {
  phase: WriteAccessPhase;
  /** A block showed a state 1–5 in this launch. «Done» is shown only after that (Т1, note to §1). */
  seenDown: boolean;
  /** A block showed 1, 4, 5 or «unconfirmed»: «done» is then 6а («now …») and a toast says it once. */
  stuck: boolean;
  /** The 6а toast has been shown. */
  toasted: boolean;
}

let state: WriteAccessState = { phase: 'idle', seenDown: false, stuck: false, toasted: false };
const listeners = new Set<() => void>();

function set(next: Partial<WriteAccessState>): void {
  state = { ...state, ...next };
  for (const l of listeners) {
    try { l(); } catch { /* a subscriber may not break the others */ }
  }
}

function subscribe(l: () => void): () => void {
  listeners.add(l);
  return () => { listeners.delete(l); };
}

export const writeAccessState = (): WriteAccessState => state;

/**
 * The view by the truth (`can_message`) and the ask's phase. `canMessage` not a boolean —
 * the server did not say: nothing is offered (as the settings did before С2).
 */
export function writeAccessView(canMessage: boolean | undefined, s: WriteAccessState, canAsk: boolean): WriteAccessView {
  if (canMessage === true) return s.seenDown ? 'ready' : 'hidden';
  if (canMessage !== false) return 'hidden';
  switch (s.phase) {
    case 'waiting':
    case 'checking':
      return 'waiting';
    case 'timeout':
      return 'timeout';
    case 'refused':
    case 'not_raised':
      return 'refused';
    case 'unconfirmed':
      return 'unconfirmed';
    case 'unavailable':
      return 'unavailable';
    default:
      // idle — or done whose flag fell later (the bot was blocked): offer again
      return canAsk ? 'offer' : 'unavailable';
  }
}

let checking: Promise<void> | null = null;

/**
 * Telegram said «allowed»: re-read Me after the read in flight, then — while the flag is not
 * true — again after each pause of RECHECK_DELAYS_MS. A failed read (`null`: network, server)
 * is not a refusal: the schedule goes on. The LAST read decides: true → done; failed →
 * unconfirmed («we can't see it yet»); anything else → not_raised (shown as «refused»).
 */
function confirmAllowed(): Promise<void> {
  if (checking) return checking;
  set({ phase: 'checking' });
  checking = (async () => {
    let me = await refreshMeAfterCurrent();
    for (const delay of RECHECK_DELAYS_MS) {
      if (me?.can_message === true) break;
      await new Promise((r) => setTimeout(r, delay));
      me = await refreshMeAfterCurrent();
    }
    set({ phase: me?.can_message === true ? 'done' : me === null ? 'unconfirmed' : 'not_raised' });
  })().finally(() => { checking = null; });
  return checking;
}

/** Telegram answered after our timer: a late «allowed» is allowed (поправки 05, С2); a late «no» turns «no answer» into «refused». */
function onLateAnswer(allowed: boolean): void {
  if (allowed) void confirmAllowed();
  else if (state.phase === 'timeout') set({ phase: 'refused' });
}

/**
 * The press. While waiting for Telegram or re-reading Me a press does nothing — no second
 * call of the method (the button stays pressable for screen readers, see BotWriteAccess).
 */
export async function askBotWriteAccess(): Promise<void> {
  if (state.phase === 'waiting' || state.phase === 'checking') return;
  set({ phase: 'waiting' });
  const answer = await askWriteAccess(onLateAnswer);
  if (answer === 'allowed') return confirmAllowed();
  set({ phase: answer });
}

/** The Start path: open the bot chat by `Me.bot_link` (a ready string from the server). */
export const openBotChat = (link: string): void => openTelegram(link);

/* Back from the bot chat (Start pressed there) — re-read Me while the flag is down.
   `visibilitychange` for the page; `activated` (Bot API 8.0) for a Mini App that was only
   minimized. Whether a client fires either on that return is on faith until the probe. */
function onReturn(): void {
  if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
  if (currentMe()?.can_message !== false) return;
  void refreshMeAfterCurrent();
}

let watchers = 0;
let unwatchTelegram: (() => void) | null = null;

function watchReturn(): () => void {
  if (watchers++ === 0) {
    document.addEventListener('visibilitychange', onReturn);
    unwatchTelegram = onTelegramEvent('activated', onReturn);
  }
  return () => {
    if (--watchers === 0) {
      document.removeEventListener('visibilitychange', onReturn);
      unwatchTelegram?.();
      unwatchTelegram = null;
    }
  };
}

/** Remember what a block has shown: «done» needs a state 1–5 before it, 6а — one of 1, 4, 5 (or «unconfirmed»). */
function noteShown(view: WriteAccessView): void {
  const down = view !== 'hidden' && view !== 'ready';
  const stuck = view === 'unavailable' || view === 'timeout' || view === 'refused' || view === 'unconfirmed';
  if ((down && !state.seenDown) || (stuck && !state.stuck)) {
    set({ seenDown: state.seenDown || down, stuck: state.stuck || stuck });
  }
  if (view === 'ready' && state.stuck && !state.toasted) {
    set({ toasted: true });
    toast(WRITE_ACCESS_COPY.readyNowToast[getLang()], 'success');
  }
}

export interface WriteAccessUi {
  view: WriteAccessView;
  /** «Done» is 6а: the flag rose after «unavailable», «no answer» or «refused». */
  now: boolean;
}

/** The block's state for React. While the flag is down, watches the return from the bot chat. */
export function useWriteAccess(canMessage: boolean | undefined): WriteAccessUi {
  const s = useSyncExternalStore(subscribe, writeAccessState, writeAccessState);
  const view = writeAccessView(canMessage, s, canAskWriteAccess());
  const down = canMessage === false;
  useEffect(() => (down ? watchReturn() : undefined), [down]);
  useEffect(() => { noteShown(view); }, [view]);
  return { view, now: s.stuck };
}
