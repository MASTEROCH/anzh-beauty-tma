import { useEffect, useRef, useState } from 'react';
import { Icon } from './Icon';
import { openSheet, toast } from '../lib/ui';
import { notify } from '../lib/haptics';
import { times } from '../lib/plural';
import { ApiError, newIdempotencyKey } from '../lib/session';
import { useMe } from '../lib/api';
import { findService } from '../data/services';
import { useCabinet, cabinetDenied, canSeeHealth } from '../lib/staff';
import {
  formatMoney, formatMoneyParts, sumByCurrency, formatShort, serviceBySlug, salonDateISO, STATUS_WORD, loadErrorText,
} from '../lib/studio';
import { flagsFor, sensitivityWord } from '../lib/clientCard';
import {
  getClient, getClientHealth, getNotes, addNote, deleteNote,
  type ClientCardWire, type ClientSummary, type HistoryEntry, type HealthProfile, type Note,
} from '../lib/api/clients';

// Карта клиентки в кабинете. Всё — с сервера (GET /clients/{id}).
//
// В заявке важны ровно три вопроса, и они читаются сверху вниз:
//   1. Была ли раньше и сколько раз — от этого зависит тон разговора
//   2. Что нельзя                    — ТОЛЬКО у владелицы, по анкете
//   3. Что уже делала                — от этого зависит, что предложить
//
// 🔴 Анкету видит только владелица (сервер: x-role owner, флаг `health`).
// У мастера на этом экране нет НИКАКИХ признаков анкеты — ни флагов, ни
// «анкета заполнена / не заполнена»: текст политики обещает клиентке, что
// анкету видит только Анжелика. Анкета грузится по явному нажатию, потому
// что каждый просмотр пишется в журнал доступа на сервере.
// 🔴 Заметки и анкета — медданные: только на экран.
// Даты истории и заметок — по поясу САЛОНА (ЦФ1), как весь кабинет.
// Кому видна карточка и заметки — решает сервер (Х14): мастеру — если у него
// с клиенткой визит confirmed/done за 12 месяцев или будущая pending/confirmed
// запись; заметки — только автору и владелице. Экран показывает, что
// пришло, и говорит правило словами — не обещает больше.

export const clientNameOf = (c: Pick<ClientSummary, 'first_name' | 'last_name' | 'username'>): string =>
  [c.first_name, c.last_name].filter(Boolean).join(' ').trim() || (c.username ? `@${c.username}` : 'Без имени');

/** Полоска под заявкой: была ли раньше и не пропускала ли. По тапу — карточка. */
export function ClientStrip({
  clientId, name, summary, slugs,
}: { clientId: number; name: string; summary?: ClientSummary; slugs?: string[] }) {
  const cab = useCabinet();
  const visits = summary?.visits ?? 0;
  const noShows = summary?.no_shows ?? 0;
  // Мастеру сервер считает визиты только к НЕМУ: «впервые» — это «у вас впервые».
  const mine = cab.me?.role === 'owner' ? '' : 'у вас ';
  return (
    <button className="cc-strip" onClick={() => openClientCard({ clientId, name, slugs })}>
      <span className={`cc-badge${visits > 0 ? ' returning' : ' first'}`}>
        {/* Говорим о прошлом прямо: сколько раз доходила до процедуры */}
        {visits > 0 ? `${mine}была ${times(visits)}` : `${mine}впервые`}
      </span>
      {noShows > 0 && <span className="cc-badge warn">{noShows} не пришла</span>}
      <Icon name="chevron-right" size={15} strokeWidth={2.2} className="cc-strip-go" />
    </button>
  );
}

export function openClientCard({ clientId, name, slugs }: { clientId: number; name: string; slugs?: string[] }) {
  openSheet({
    title: name,
    subtitle: 'карточка клиентки',
    body: <ClientCardBody clientId={clientId} slugs={slugs} />,
  });
}

type Load<T> = { data: T | null; loading: boolean; error: ApiError | null };

/** Почему не загрузилось — как у списков кабинета: «нет связи» только когда её нет. */
const whyNot = (e: ApiError | null): string => (loadErrorText(e) || 'Сервер не ответил').toLowerCase();

function ClientCardBody({ clientId, slugs }: { clientId: number; slugs?: string[] }) {
  const cab = useCabinet();
  const { me: profile } = useMe();
  const [card, setCard] = useState<Load<{ client: ClientCardWire; history: HistoryEntry[] }>>(
    { data: null, loading: true, error: null },
  );
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let alive = true;
    setCard({ data: null, loading: true, error: null });
    getClient(clientId).then(
      (data) => { if (alive) setCard({ data, loading: false, error: null }); },
      (e: unknown) => {
        if (!alive) return;
        cabinetDenied(e);
        setCard({ data: null, loading: false, error: e instanceof ApiError ? e : new ApiError(0, 'network', 'сбой') });
      },
    );
    return () => { alive = false; };
  }, [clientId, attempt]);

  const showHealth = canSeeHealth(cab.me, profile?.features);

  if (card.loading) return <div className="cc"><div className="cc-empty">Загружаем карточку…</div></div>;

  if (card.error || !card.data) {
    const nf = card.error?.status === 404;
    const owner = cab.me?.role === 'owner';
    return (
      <div className="cc">
        <div className="cc-empty" role={nf ? undefined : 'alert'}>
          {/* Мастеру — правило, а не факт о визитах: 404 отвечают и на
              клиентку после удаления и возвращения, у которой визиты были
              (черта истории), и на удалённую. Правило — как staffSeesClient
              сервера (api/_domain/clients.js, Х14). Причину закрытия не
              называть (Законник, волна 4): она выдала бы мастеру, что
              клиентка удаляла аккаунт. */}
          {nf
            ? owner
              ? 'Карточки нет: клиентки нет в базе'
              : 'Карточка закрыта: она открывается, только если у вас с клиенткой был подтверждённый или состоявшийся визит за последние 12 месяцев либо есть будущая заявка или запись'
            : `Карточку не загрузили — ${whyNot(card.error)}`}
        </div>
        {!nf && (
          <button className="btn btn-secondary btn-block mt-md" onClick={() => setAttempt((x) => x + 1)}>
            Повторить
          </button>
        )}
      </div>
    );
  }

  const { client, history } = card.data;
  const visits = client.visits ?? 0;
  const noShows = client.no_shows ?? 0;
  const handle = client.instagram ? `@${client.instagram.replace(/^@/, '')}` : client.username ? `@${client.username}` : null;
  const done = history.filter((h) => h.status === 'done' || h.status === 'no_show');
  // "Spent": the server's spent_minor adds up every currency of her visits (gap passed to
  // the server side). One currency in the history — the server's number stands; several —
  // per currency from the same rows (paid, else the booking total), never one mixed sum.
  const spentParts = sumByCurrency(history.filter((h) => h.status === 'done'), (h) => h.paid_minor ?? h.total_minor ?? 0);
  const spent = visits === 0
    ? '—'
    : spentParts.length > 1 ? formatMoneyParts(spentParts) : formatMoney(client.spent_minor ?? 0, client.currency);

  return (
    <div className="cc">
      <div className="studio-client-stats">
        <div className="scs"><span className="scs-v">{visits}</span><span className="scs-k">визитов</span></div>
        <div className="scs"><span className="scs-v">{spent}</span><span className="scs-k">потрачено</span></div>
        <div className="scs"><span className="scs-v">{noShows}</span><span className="scs-k">неявок</span></div>
      </div>
      {(handle || client.phone) && (
        <div className="cc-line"><span>Контакт</span><b>{[handle, client.phone].filter(Boolean).join(' · ')}</b></div>
      )}

      {/* Противопоказания — первыми, до истории. Только владелица. */}
      {showHealth && <HealthSection clientId={clientId} slugs={slugs ?? []} />}

      <div className="eyebrow cc-eyebrow">что уже делала</div>
      {done.length === 0 ? (
        <div className="cc-empty">Процедур ещё не было — это первый визит</div>
      ) : (
        <ul className="cc-history">
          {done.slice(0, 12).map((h) => (
            <li key={h.id}>
              <span className="cc-history-date">{formatShort(salonDateISO(h.starts_at))}</span>
              <span className="cc-history-title">
                {(h.services ?? []).map(titleOfSlug).join(' + ') || 'Процедура'}
                {h.status === 'no_show' ? ` · ${STATUS_WORD.no_show}` : ''}
              </span>
              {h.status === 'done' && (
                <span className="cc-history-sum">{formatMoney(h.paid_minor ?? h.total_minor ?? 0, h.currency)}</span>
              )}
            </li>
          ))}
        </ul>
      )}

      {noShows > 0 && (
        <div className="cc-noshow">
          <Icon name="warning" size={14} strokeWidth={2.2} />
          Не пришла {times(noShows)} — стоит подтвердить накануне
        </div>
      )}

      <ClientNotes clientId={clientId} />
    </div>
  );
}

function titleOfSlug(slug: string): string {
  return serviceBySlug(slug)?.title.ru ?? findService(slug)?.title ?? slug;
}

/* ── Анкета: только владелица, только по нажатию ── */

function HealthSection({ clientId, slugs }: { clientId: number; slugs: string[] }) {
  const [state, setState] = useState<Load<HealthProfile | null> & { asked: boolean }>(
    { data: null, loading: false, error: null, asked: false },
  );

  const load = () => {
    setState({ data: null, loading: true, error: null, asked: true });
    getClientHealth(clientId).then(
      (data) => setState({ data, loading: false, error: null, asked: true }),
      (e: unknown) => {
        cabinetDenied(e);
        setState({ data: null, loading: false, error: e instanceof ApiError ? e : new ApiError(0, 'network', 'сбой'), asked: true });
      },
    );
  };

  if (!state.asked) {
    return (
      <>
        <div className="eyebrow cc-eyebrow">анкета</div>
        <button className="btn btn-secondary btn-block" onClick={load}>
          <Icon name="shield-check" size={15} strokeWidth={2} /> Показать анкету
        </button>
        <div className="faint" style={{ fontSize: 11.5, marginTop: 6 }}>
          Просмотр анкеты записывается в журнал доступа.
        </div>
      </>
    );
  }

  if (state.loading) return <div className="cc-empty">Загружаем анкету…</div>;

  if (state.error) {
    const code = state.error.code;
    const text = code === 'feature_disabled'
      ? 'Анкеты сейчас выключены'
      : code === 'forbidden'
        ? 'Анкета доступна только владелице'
        : state.error.status === 404
          ? 'Клиентки нет'
          : `Анкету не загрузили — ${whyNot(state.error)}`;
    return (
      <div className="cc-empty" role="alert">
        {text}
        {state.error.isNetwork && (
          <button className="btn btn-secondary btn-block mt-md" onClick={load}>Повторить</button>
        )}
      </div>
    );
  }

  const p = state.data?.answers ?? null;
  const flags = flagsFor(slugs, p);

  return (
    <>
      {/* 1. Противопоказания процедур этой заявки — первыми */}
      {!p ? (
        <div className="cc-ok">
          <Icon name="shield-check" size={15} strokeWidth={2} />
          Анкета не заполнена — спросить на приёме
        </div>
      ) : flags.length > 0 ? (
        <div className="cc-flags">
          {flags.map((f) => (
            <div key={f.from} className={`cc-flag ${f.level}`}>
              <Icon name={f.level === 'stop' ? 'warning' : 'info'} size={15} strokeWidth={2.2} />
              <div>
                <div className="cc-flag-from">{f.from}</div>
                <div className="cc-flag-match">
                  {f.level === 'stop' ? 'противопоказание процедуры: ' : 'сверить: '}{f.matches}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : slugs.length > 0 ? (
        <div className="cc-ok">
          <Icon name="shield-check" size={15} strokeWidth={2} />
          Совпадений по словам нет — просмотрите анкету
        </div>
      ) : null}

      {/* 2. Сама анкета */}
      {p && (
        <>
          <div className="eyebrow cc-eyebrow">анкета</div>
          <div className="cc-grid">
            <div className="cc-cell"><span>Тип кожи</span><b>{p.skinType || '—'}</b></div>
            <div className="cc-cell"><span>Чувствит.</span><b>{sensitivityWord(p.sensitivity)}</b></div>
            <div className="cc-cell"><span>Фототип</span><b>{p.fitzpatrick || '—'}</b></div>
            <div className="cc-cell"><span>Купероз</span><b>{p.couperose === true ? 'есть' : p.couperose === false ? 'нет' : '—'}</b></div>
          </div>
          {!p.noAllergies && (p.allergies?.length ?? 0) > 0 && (
            <div className="cc-line"><span>Аллергии</span><b>{p.allergies!.join(', ')}</b></div>
          )}
          {(p.pregnant || p.lactating) && (
            <div className="cc-line"><span>Состояние</span><b>{[p.pregnant && 'беременность', p.lactating && 'лактация'].filter(Boolean).join(', ')}</b></div>
          )}
          {p.chronic && <div className="cc-line"><span>Хронические</span><b>{p.chronic}</b></div>}
          {p.meds && <div className="cc-line"><span>Препараты</span><b>{p.meds}</b></div>}
          {p.goal && <div className="cc-line"><span>Запрос</span><b>{p.goal}</b></div>}
          {p.notes && <div className="cc-line"><span>Пометки</span><b>{p.notes}</b></div>}
        </>
      )}
    </>
  );
}

/* ── Заметки: видят автор и владелица (Х14), остальные мастера — нет ── */

function ClientNotes({ clientId }: { clientId: number }) {
  const cab = useCabinet();
  const [list, setList] = useState<Load<Note[]>>({ data: null, loading: true, error: null });
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [why, setWhy] = useState<string | null>(null);
  /** Ключ на одно намерение «сохранить эту заметку»: повтор после обрыва — тот же ключ. */
  const intent = useRef<string | null>(null);

  useEffect(() => {
    let alive = true;
    getNotes(clientId).then(
      (data) => { if (alive) setList({ data, loading: false, error: null }); },
      (e: unknown) => {
        if (!alive) return;
        cabinetDenied(e);
        setList({ data: null, loading: false, error: e instanceof ApiError ? e : new ApiError(0, 'network', 'сбой') });
      },
    );
    return () => { alive = false; };
  }, [clientId]);

  const save = async () => {
    const body = draft.trim();
    if (!body || busy) return;
    setBusy(true);
    setWhy(null);
    intent.current ??= newIdempotencyKey();
    try {
      const note = await addNote(clientId, body, intent.current);
      intent.current = null;
      setDraft('');
      setList((s) => ({ ...s, data: [note, ...(s.data ?? []).filter((n) => n.id !== note.id)] }));
      notify('success');
    } catch (e) {
      cabinetDenied(e);
      setWhy(e instanceof ApiError && e.isNetwork
        ? 'Нет связи — заметка не сохранена, повторите'
        : 'Заметку не сохранили — повторите');
    } finally {
      setBusy(false);
    }
  };

  const drop = (n: Note) => setList((s) => ({ ...s, data: (s.data ?? []).filter((x) => x.id !== n.id) }));

  const remove = async (n: Note) => {
    try {
      await deleteNote(n.id);
      drop(n);
      toast('Заметка удалена');
    } catch (e) {
      cabinetDenied(e);
      /* 404 — заметки для этого человека нет: её уже удалили (владелица или
         с другого телефона). Повтор не поможет — убираем её и с экрана.
         Чужую заметку сервер тоже отвечает 404, «как будто её нет» (Х14,
         api/_domain/notes.js deleteNote; раньше было 403), но чужие мастеру
         и не приходят. */
      if (e instanceof ApiError && e.status === 404) {
        drop(n);
        toast('Этой заметки уже нет');
        return;
      }
      toast('Не удалось удалить — повторите');
    }
  };

  const myId = cab.me?.telegram_id;
  const owner = cab.me?.role === 'owner';

  return (
    <>
      <div className="eyebrow cc-eyebrow">{owner ? 'заметки мастеров' : 'ваши заметки'}</div>
      {list.loading && <div className="cc-empty">Загружаем заметки…</div>}
      {list.error && <div className="cc-empty" role="alert">Заметки не загрузились — {whyNot(list.error)}</div>}
      {list.data && list.data.length === 0 && <div className="cc-empty">Заметок пока нет</div>}
      {list.data && list.data.length > 0 && (
        <ul className="cc-history">
          {list.data.map((n) => (
            <li key={n.id}>
              <span className="cc-history-date">{formatShort(salonDateISO(n.created_at))}</span>
              <span className="cc-history-title">
                {n.body}
                {n.author_name ? <span className="faint"> · {n.author_name}</span> : null}
              </span>
              {(owner || n.author_id === myId) && (
                <button className="se-arch" aria-label="Удалить заметку" onClick={() => { void remove(n); }}>
                  <Icon name="x" size={13} strokeWidth={2.4} />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      <textarea
        className="review-textarea mt-sm"
        rows={3}
        value={draft}
        onChange={(e) => { setDraft(e.target.value); setWhy(null); }}
        placeholder="Как переносит боль, о чём просила, чем закончился прошлый раз"
        maxLength={2000}
      />
      {why && <p className="form-why" role="alert">{why}</p>}
      <button className="btn btn-secondary btn-block mt-sm" disabled={!draft.trim() || busy} onClick={() => { void save(); }}>
        {busy ? 'Сохраняем…' : 'Сохранить заметку'}
      </button>
      <div className="faint" style={{ fontSize: 11.5, marginTop: 6 }}>
        {owner
          ? 'Заметку видят её автор и владелица. Другие мастера и клиентка — нет.'
          : 'Заметку видите вы и владелица. Другие мастера и клиентка — нет.'}
      </div>
    </>
  );
}
