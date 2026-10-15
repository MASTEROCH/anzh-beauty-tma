import { useState } from 'react';
import { Icon, type IconName } from './Icon';
import { closeSheet, openSheet, toast } from '../lib/ui';
import { notify, tap } from '../lib/haptics';
import { useMe } from '../lib/api';
import { canShareStory, shareStory, openExternal } from '../lib/telegram';
import { getStudio, instagramUrl } from '../data/location';
import { absoluteAsset } from '../lib/asset';
import { useRewards, setRewards } from '../lib/rewardsLive';
import { submitStory, type RewardAction, type RewardState } from '../lib/api/rewards';
import { inviteFriend } from './PassportChapters';
import { openWriteReview } from './WriteReview';
import type { Lang } from '../lib/i18n';

/* СКИДКИ ЗА ДЕЙСТВИЯ — вернулись из ANZH.store (Роч 15.10): Skin Profile,
   подруга, сторис, отзыв — по −5 % на следующую процедуру, каждое один раз.
   Считает и применяет сервер (в расчёте записи приходит discount_percent);
   здесь только показ и входы в сами действия.

   Почему карточка — чек-лист, а не баннер «−20 %»: человек видит, что уже
   сделано и что осталось, и каждое действие — одна кнопка прямо в строке.
   Сторис проверить машинно нельзя (Telegram не сообщает, вышла ли она),
   поэтому её подтверждает студия — строка честно пишет «на проверке». */

const ROWS: Array<{ id: RewardAction; icon: IconName; ru: [string, string]; en: [string, string] }> = [
  { id: 'profile', icon: 'sparkles', ru: ['Пройти Skin Profile', 'бесплатный разбор, 3 минуты'], en: ['Take the Skin Profile', 'free analysis, 3 minutes'] },
  { id: 'invite', icon: 'send', ru: ['Пригласить подругу', 'засчитаем, когда она откроет приложение'], en: ['Invite a friend', 'counts once she opens the app'] },
  { id: 'story', icon: 'camera', ru: ['Сторис про студию', 'с отметкой студии — проверит администратор'], en: ['Story about the studio', 'tag the studio — the admin checks it'] },
  { id: 'review', icon: 'star', ru: ['Оставить отзыв', 'любая оценка — честный отзыв важнее'], en: ['Leave a review', 'any rating — honesty matters more'] },
];

function StoryProof({ lang }: { lang: Lang }) {
  const ru = lang === 'ru';
  const [proof, setProof] = useState('');
  const [busy, setBusy] = useState(false);
  const [why, setWhy] = useState('');
  const studio = getStudio();
  const tg = canShareStory();
  const send = async () => {
    if (busy) return;
    setBusy(true); setWhy('');
    try {
      setRewards(await submitStory(proof.trim() || (ru ? 'сторис в Telegram' : 'Telegram story')));
      notify('success'); closeSheet();
      toast(ru ? 'Отправили на проверку — скидка появится после подтверждения' : 'Sent for review — the discount appears once confirmed', 'success');
    } catch {
      notify('error');
      setWhy(ru ? 'Не отправилось — проверьте интернет и попробуйте ещё раз' : 'Didn’t send — check your connection and try again');
    } finally { setBusy(false); }
  };
  return (
    <div className="rw-story">
      <ol className="rw-steps">
        <li>{ru ? 'Выложите сторис о визите или о студии' : 'Post a story about your visit or the studio'}{studio.instagram ? (ru ? ` — в Instagram отметьте @${studio.instagram}` : ` — on Instagram tag @${studio.instagram}`) : ''}.</li>
        <li>{ru ? 'Вернитесь сюда и нажмите «Готово» — администратор проверит и включит скидку.' : 'Come back and tap “Done” — the admin checks it and turns the discount on.'}</li>
      </ol>
      <div className="rw-story-go">
        {tg && (
          <button className="btn btn-secondary" onClick={() => {
            tap();
            shareStory(absoluteAsset('photos/anjelika-live.mp4'),
              ru ? 'Мой косметолог в Батуми — Анжелика, ANZH Cosmetology' : 'My cosmetologist in Batumi — Anjelika, ANZH Cosmetology');
          }}>
            <Icon name="send" size={15} strokeWidth={2} /> {ru ? 'Сторис в Telegram' : 'Telegram story'}
          </button>
        )}
        {studio.instagram && (
          <button className="btn btn-secondary" onClick={() => { tap(); openExternal(instagramUrl()); }}>
            <Icon name="camera" size={15} strokeWidth={2} /> Instagram
          </button>
        )}
      </div>
      <label className="wr-label rw-proof-l" htmlFor="rw-proof">{ru ? 'Ссылка на сторис или ваш ник — чтобы её нашли' : 'Story link or your handle — so we can find it'}</label>
      <input id="rw-proof" className="input" value={proof} maxLength={200} onChange={(e) => setProof(e.target.value)} placeholder={ru ? '@ваш_ник или ссылка' : '@your_handle or link'} />
      {why && <p className="form-why" role="alert">{why}</p>}
      <button className="btn btn-primary btn-block" onClick={send} disabled={busy} aria-busy={busy}>
        {busy ? (ru ? 'Отправляем…' : 'Sending…') : (ru ? 'Готово, выложила' : 'Done, it’s posted')}
      </button>
    </div>
  );
}

function stateWord(s: RewardState, ru: boolean): string | null {
  if (s === 'done') return ru ? '−5 %' : '−5%';
  if (s === 'pending') return ru ? 'на проверке' : 'in review';
  return null;
}

export function RewardsCard({ lang, onProfile }: { lang: Lang; onProfile: () => void }) {
  const r = useRewards();
  const { me } = useMe();
  const ru = lang === 'ru';
  if (!r) return null;
  const link = typeof me?.referral_link === 'string' ? me.referral_link : '';
  const doneCount = ROWS.filter((x) => r.actions[x.id] === 'done').length;

  const go = (id: RewardAction) => {
    if (r.actions[id] !== 'idle' || r.used) return;
    tap();
    if (id === 'profile') onProfile();
    else if (id === 'invite') {
      if (link) inviteFriend(link, ru);
      else toast(ru ? 'Ссылка приглашения появится, когда приложение подключится к серверу' : 'The invite link appears once the app is connected');
    } else if (id === 'story') openSheet({ title: ru ? 'Сторис про студию' : 'Story about the studio', subtitle: ru ? '−5 % на процедуру' : '−5% off a treatment', body: <StoryProof lang={lang} /> });
    else openWriteReview(lang);
  };

  return (
    <section className={`rw-card${r.used ? ' used' : ''}`} aria-label={ru ? 'Скидки за действия' : 'Discounts for actions'}>
      <div className="rw-head">
        <div>
          <div className="eyebrow">{ru ? 'разовая акция' : 'one-time offer'}</div>
          <div className="rw-title">{ru ? 'Скидка до −20 % на процедуру' : 'Up to 20% off a treatment'}</div>
          <div className="rw-sub">
            {r.used
              ? (ru ? 'Скидка уже использована на визите — спасибо!' : 'Already used on a visit — thank you!')
              : r.percent > 0
                ? (ru ? `Сейчас −${r.percent} % — применится к следующей записи сама` : `Now ${r.percent}% off — applies to your next booking automatically`)
                : (ru ? 'По −5 % за каждое действие, один раз' : '5% off for each action, once')}
          </div>
        </div>
        <div className="rw-pct" aria-hidden>
          <b>{r.percent > 0 ? `−${r.percent}` : '0'}</b><span>%</span>
        </div>
      </div>
      <div className="rw-meter" aria-hidden>
        {ROWS.map((x, i) => <i key={x.id} className={i < doneCount ? 'on' : ''} />)}
      </div>
      <div className="rw-rows">
        {ROWS.map((x) => {
          const st = r.actions[x.id];
          const word = stateWord(st, ru);
          const [t, s] = ru ? x.ru : x.en;
          return (
            <button key={x.id} className={`rw-row ${st}`} onClick={() => go(x.id)} disabled={st !== 'idle' || r.used} aria-label={`${t}${word ? ` — ${word}` : ''}`}>
              <span className="rw-ic"><Icon name={st === 'done' ? 'check' : x.icon} size={17} strokeWidth={st === 'done' ? 2.6 : 1.9} /></span>
              <span className="rw-body"><b>{t}</b><span>{s}</span></span>
              {word ? <span className={`rw-state ${st}`}>{word}</span> : <Icon name="chevron-right" size={16} strokeWidth={2.2} className="rw-go" />}
            </button>
          );
        })}
      </div>
      <p className="rw-fine">{ru ? 'Скидки складываются и действуют на одну процедуру. Каждое действие засчитывается один раз.' : 'Discounts add up and apply to one treatment. Each action counts once.'}</p>
    </section>
  );
}
