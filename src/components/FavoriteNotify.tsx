import { Icon } from './Icon';
import { closeSheet, openSheet, toast } from '../lib/ui';
import { askBotWriteAccess } from '../lib/writeAccess';
import { canAskWriteAccess } from '../lib/telegram';
import type { Lang } from '../lib/i18n';

/* Первое сердечко → «Напомнить, когда будет окно?».
   Просим право писать ровно тогда, когда понятна польза: человек только
   что отметил процедуру, которую хочет сделать. Спрашиваем один раз на
   устройство; уже разрешено или Telegram не умеет спрашивать — молчим. */
const KEY = 'anzh_fav_notify_asked';

export function maybeAskFavoriteNotify(canMessage: boolean | undefined, lang: Lang) {
  if (canMessage !== false || !canAskWriteAccess()) return;
  try { if (localStorage.getItem(KEY)) return; localStorage.setItem(KEY, '1'); } catch { return; }
  const ru = lang === 'ru';
  window.setTimeout(() => openSheet({
    title: ru ? 'Напомнить, когда будет окно?' : 'Tell you when there is a slot?',
    subtitle: ru ? 'Процедура в закладках' : 'Treatment saved',
    body: (
      <div className="fn-body">
        <span className="fn-ic"><Icon name="bell" size={22} strokeWidth={1.8} /></span>
        <p>{ru
          ? 'Бот студии напишет в Telegram, когда у Анжелики освободится время на процедуры из закладок, и напомнит о повторной процедуре, когда подойдёт срок. Не чаще раза в неделю, отключается в настройках.'
          : 'The studio bot will message you in Telegram when Anjelika has time for your saved treatments, and remind you when a repeat is due. At most once a week, off in settings.'}</p>
      </div>
    ),
    actions: (
      <>
        <button className="btn btn-primary btn-block" onClick={() => { closeSheet(); void askBotWriteAccess().then(() => toast(ru ? 'Готово — напомним, когда будет окно' : 'Done — we’ll tell you when there is a slot', 'success')); }}>
          {ru ? 'Да, напоминать' : 'Yes, remind me'}
        </button>
        <button className="btn btn-secondary btn-block" onClick={closeSheet}>{ru ? 'Не сейчас' : 'Not now'}</button>
      </>
    ),
  }), 450);
}
