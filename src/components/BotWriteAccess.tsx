// The block «Получать ответ в Telegram» (КТ-7 С2) — one for the request screen, the
// account feed and the settings. States and their truth — lib/writeAccess.ts; texts —
// lib/writeAccessCopy.ts (Т1). The caller passes the state from `useWriteAccess`, so a
// place can also hide its own line when the block already says the same.

import type { Lang } from '../lib/i18n';
import { askBotWriteAccess, openBotChat, type WriteAccessUi } from '../lib/writeAccess';
import { WRITE_ACCESS_COPY as COPY, type WriteAccessContext } from '../lib/writeAccessCopy';
import { safeBotLink } from '../lib/writeAccessRules';

type Variant = 'flow' | 'timeline' | 'settings';

const TEXT_CLASS: Record<Variant, string> = { flow: 'cf-sub', timeline: 'nt-text', settings: 'onb-hint' };

export function BotWriteAccess({
  ui,
  link,
  lang,
  context,
  variant,
}: {
  ui: WriteAccessUi;
  /** `Me.bot_link` — a ready string from the server, or null: the Start hint then has no link.
   *  Anything but https://t.me/<bot>?start=notify counts as null (safeBotLink, 007 m-2). */
  link: string | null | undefined;
  lang: Lang;
  context: WriteAccessContext;
  variant: Variant;
}) {
  const { view, now } = ui;
  if (view === 'hidden') return null;

  const textClass = TEXT_CLASS[variant];
  const botLink = safeBotLink(link);
  const waiting = view === 'waiting';
  const lead =
    view === 'offer' || waiting ? COPY.offerLine[context][lang]
    : view === 'timeout' ? COPY.timeout[lang]
    : view === 'refused' ? COPY.refused[lang]
    : view === 'unconfirmed' ? COPY.unconfirmed[lang]
    : view === 'ready' ? (now ? COPY.readyNow : COPY.ready)[context][lang]
    : null; // «unavailable»: the Start hint only, no lead line (Т1 §1, state 1)
  const startHint = view === 'unavailable' || view === 'timeout' || view === 'refused' || view === 'unconfirmed';

  const body = (
    <div
      className="stack-tight"
      data-write-access={view}
      data-context={context}
      aria-live="polite"
      style={variant === 'timeline' ? { gridColumn: '1 / -1' } : variant === 'settings' ? { marginTop: 'var(--sp-sm)' } : undefined}
    >
      {lead && <p className={textClass} data-write-access-line>{lead}</p>}
      {(view === 'offer' || waiting) && (
        /* Not `disabled` while waiting: the press still reaches the module, which ignores it —
           no second call of the method; screen readers hear «busy», not a vanished button. */
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          data-action="write-access"
          aria-disabled={waiting || undefined}
          aria-busy={waiting || undefined}
          style={waiting ? { opacity: 0.6, cursor: 'progress' } : undefined}
          onClick={() => void askBotWriteAccess()}
        >
          {waiting ? COPY.waiting[lang] : COPY.button[context][lang]}
        </button>
      )}
      {startHint && (
        <div className="stack-tight" data-hint="start-bot" data-link={botLink ? 'yes' : 'no'}>
          <p className={textClass}>{botLink ? COPY.startBot[lang] : COPY.startBotNoLink[lang]}</p>
          {botLink && (
            <button type="button" className="btn btn-quiet btn-sm" data-action="open-bot" onClick={() => openBotChat(botLink)}>
              {COPY.startBotOpen[lang]}
            </button>
          )}
        </div>
      )}
    </div>
  );

  if (variant === 'flow') {
    return (
      <li style={{ opacity: 1 }}>
        <span className="cf-dot" />
        {body}
      </li>
    );
  }
  if (variant === 'timeline') return <li>{body}</li>;
  return body;
}
