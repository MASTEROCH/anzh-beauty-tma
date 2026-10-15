import { useState } from 'react';
import { Icon } from './Icon';
import { toast } from '../lib/ui';
import { notify, tap } from '../lib/haptics';
import { openTelegram } from '../lib/telegram';
import { useMe } from '../lib/api';
import { plural } from '../lib/plural';
import { openChapter } from '../lib/passportChapters';
import type { PassportWire } from '../lib/api/passport';
import { ApiError } from '../lib/session';

/* ГЛАВЫ ПАСПОРТА В ПОДАРОК (Роч 15.10): разбор открывается не только за
   Stars — за каждую пройденную процедуру и за каждых N подруг, которые
   пришли на процедуру. Разменивать паспорт на «социалку» — честный обмен:
   студия получает визиты и новых клиенток, человек — разбор своей кожи. */

function useInvite() {
  const { me } = useMe();
  const link = typeof me?.referral_link === 'string' ? me.referral_link : '';
  return link;
}

export function inviteFriend(link: string, ru: boolean) {
  if (!link) return;
  tap();
  const text = ru
    ? 'Записываюсь к Анжелике в ANZH Cosmetology — приходи тоже, вот приложение:'
    : 'I book with Anjelika at ANZH Cosmetology — join me, here’s the app:';
  openTelegram(`https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(text)}`);
}

/** Карточка на экране ANZH: сколько глав можно открыть и что приблизит следующую */
export function ChaptersCard({ pass, ru }: { pass: PassportWire; ru: boolean }) {
  const link = useInvite();
  if (!pass.enabled) return null;
  const n = pass.friends_per_chapter;
  const friendsInRound = pass.friends_done % n;
  return (
    <section className="ch-card" aria-label={ru ? 'Главы паспорта в подарок' : 'Free passport chapters'}>
      <div className="ch-head">
        <span className="ch-ic"><Icon name="gift" size={20} strokeWidth={1.8} /></span>
        <div>
          <div className="ch-title">{ru ? 'Главы паспорта — в подарок' : 'Passport chapters — free'}</div>
          <div className="ch-sub">
            {pass.credits > 0
              ? (ru ? `Можно открыть ${pass.credits} ${plural(pass.credits, 'главу', 'главы', 'глав')} — выберите разбор ниже` : `You can open ${pass.credits} chapter${pass.credits > 1 ? 's' : ''} — pick an analysis below`)
              : (ru ? 'Глава за каждую процедуру и за подруг, которые пришли к Анжелике' : 'A chapter for every treatment and for friends who visit Anjelika')}
          </div>
        </div>
        {pass.credits > 0 && <span className="ch-badge">{pass.credits}</span>}
      </div>
      <div className="ch-rows">
        <div className="ch-row">
          <span>{ru ? 'Процедуры' : 'Treatments'}</span>
          <b>{ru ? `пройдено ${pass.visits_done} · +1 глава за каждую` : `${pass.visits_done} done · +1 chapter each`}</b>
        </div>
        <div className="ch-row">
          <span>{ru ? 'Подруги' : 'Friends'}</span>
          <b>{ru ? `${friendsInRound} из ${n} до следующей главы` : `${friendsInRound} of ${n} to the next chapter`}</b>
        </div>
        <div className="ch-bar" aria-hidden><i style={{ width: `${(friendsInRound / n) * 100}%` }} /></div>
      </div>
      {link && (
        <button className="btn btn-secondary btn-block ch-invite" onClick={() => inviteFriend(link, ru)}>
          <Icon name="send" size={15} strokeWidth={2} /> {ru ? 'Пригласить подругу' : 'Invite a friend'}
        </button>
      )}
      <p className="ch-fine">
        {ru ? 'Подруга засчитывается, когда придёт на свою первую процедуру.' : 'A friend counts once she has her first treatment.'}
      </p>
    </section>
  );
}

/** Блок в шторке разбора: открыть главой, если есть подарок, — или как его получить */
export function ChapterOffer({ pass, quizId, ru, onOpened }: { pass: PassportWire | null; quizId: string; ru: boolean; onOpened: () => void }) {
  const [busy, setBusy] = useState(false);
  const link = useInvite();
  if (!pass?.enabled) return null;
  if (pass.credits > 0) {
    return (
      <div className="ch-offer">
        <button
          className="btn btn-primary btn-block"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await openChapter(quizId);
              notify('success');
              toast(ru ? 'Глава открыта — проходите разбор' : 'Chapter unlocked — take the analysis', 'success');
              onOpened();
            } catch (e) {
              notify('error');
              toast(e instanceof ApiError && e.code === 'no_credits' ? (ru ? 'Подарочные главы закончились' : 'No free chapters left') : (ru ? 'Не открылось — повторите' : 'Could not unlock — try again'));
            } finally {
              setBusy(false);
            }
          }}
        >
          <Icon name="gift" size={16} strokeWidth={2} />
          {busy ? (ru ? 'Открываем…' : 'Unlocking…') : (ru ? `Открыть в подарок · осталось ${pass.credits}` : `Unlock free · ${pass.credits} left`)}
        </button>
        <div className="ch-or">{ru ? 'или за Stars' : 'or with Stars'}</div>
      </div>
    );
  }
  return (
    <div className="ch-hint">
      <Icon name="gift" size={15} strokeWidth={2} />
      <span>
        {ru
          ? `Бесплатно: глава откроется после вашей следующей процедуры или когда ${pass.friends_per_chapter} ${plural(pass.friends_per_chapter, 'подруга придёт', 'подруги придут', 'подруг придут')} к Анжелике.`
          : `Free: a chapter unlocks after your next treatment or when ${pass.friends_per_chapter} friends visit Anjelika.`}
        {link && <> <button className="ch-link" onClick={() => inviteFriend(link, ru)}>{ru ? 'Пригласить' : 'Invite'}</button></>}
      </span>
    </div>
  );
}
