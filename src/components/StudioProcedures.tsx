import { useMemo, useState } from 'react';
import { Icon } from './Icon';
import { SwipeRow } from './SwipeRow';
import { openServiceEditor, archiveWithUndoable, restoreArchived, saveErrorText } from './ServiceEditor';
import { closeSheet, openSheet, toast } from '../lib/ui';
import { notify, tap } from '../lib/haptics';
import { servicePhoto, findService } from '../data/services';
import { durationLabel } from '../lib/plural';
import { formatPrice } from '../lib/money';
import { isShowable } from '../lib/showable';
import { cabinetDenied } from '../lib/staff';
import {
  useLiveServices, useArchivedServices, loadLiveServices, loadErrorText, type WireService,
} from '../lib/studio';
import { asset } from '../lib/asset';

// Раздел «Процедуры» в кабинете владелицы: что видят клиентки и чем это
// можно править.
//
// Было: ряд полей цены, под которыми не видно ни фото, ни статуса, а правая
// кнопка «×» убирала процедуру с витрины без вопроса. Название обрезалось
// полем цены («Коллагеностимулятор…»), а чтобы поправить описание или
// фото, нужно было догадаться, что за названием прячется вход.
//
// Теперь:
//   · строка — это КАРТОЧКА с настоящим фото процедуры, названием целиком,
//     родной ценой и временем; тап по ней открывает полную карточку правки
//     (фото, тексты на двух языках, цена, время, состав, противопоказания);
//   · убирают жестом: потянуть строку влево, затем подтвердить. Кнопки «×» нет;
//   · процедуры, которые клиентка НЕ видит (нет цены или времени — такую
//     нельзя записать), помечены прямо в строке и сказано, чего не хватает:
//     раньше владелица заводила процедуру и не понимала, почему её нет в
//     каталоге.

function priceLine(svc: WireService): string {
  const p = formatPrice({
    priceMinor: svc.price_minor, currency: svc.currency, priceFrom: svc.price_from, slug: svc.slug,
  });
  return p ?? 'цена не назначена';
}

function lengthLine(svc: WireService): string {
  return svc.duration_min || svc.days
    ? durationLabel(svc.duration_min ?? 0, svc.days ?? undefined)
    : 'время не указано';
}

/** Чем процедура не годится для витрины — словами, или null, если годится. */
function hiddenWhy(svc: WireService): string | null {
  if (isShowable(svc)) return null;
  const miss: string[] = [];
  if (svc.price_minor == null) miss.push('цены');
  else if (svc.currency !== 'GEL' && svc.currency !== 'USD') miss.push('валюты');
  if (!svc.duration_min && !svc.days) miss.push('времени');
  return miss.length ? `клиентки не видят — нет ${miss.join(' и ')}` : 'клиентки не видят — не хватает данных';
}

function ArchiveConfirm({ svc, onGo }: { svc: WireService; onGo: () => void }) {
  return (
    <div className="confirm">
      <p className="confirm-lead">
        Клиентки перестанут видеть «{svc.title.ru}» в каталоге и не смогут на неё записаться.
      </p>
      <p className="faint confirm-sub">
        Уже оставленные записи, история визитов и отчёты не пострадают. Вернуть процедуру можно в блоке «Скрытые» ниже.
      </p>
      <button className="btn btn-danger btn-block" onClick={() => { notify('warning'); closeSheet(); onGo(); }}>
        <Icon name="trash" size={16} strokeWidth={2} /> Убрать с витрины
      </button>
    </div>
  );
}

export function StudioProcedures() {
  const live = useLiveServices();
  const archived = useArchivedServices(true);
  const [q, setQ] = useState('');
  const [gone, setGone] = useState<ReadonlySet<string>>(new Set());
  const [hiddenOpen, setHiddenOpen] = useState(false);
  const [restoring, setRestoring] = useState<string | null>(null);

  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return s ? live.list.filter((x) => x.title.ru.toLowerCase().includes(s) || x.title.en.toLowerCase().includes(s)) : live.list;
  }, [live.list, q]);

  const archive = async (svc: WireService) => {
    // Схлопываем строку сразу — запрос идёт параллельно. Не вышло: возвращаем
    // строку на место и говорим, почему, а не оставляем её «убранной» на экране.
    setGone((g) => new Set(g).add(svc.slug));
    try {
      await archiveWithUndoable(svc);
      notify('success');
      toast(`«${svc.title.ru}» убрана с витрины`);
    } catch (e) {
      cabinetDenied(e);
      notify('error');
      setGone((g) => { const n = new Set(g); n.delete(svc.slug); return n; });
      toast(saveErrorText(e));
    }
  };

  const confirm = (svc: WireService) =>
    openSheet({
      title: 'Убрать с витрины?',
      subtitle: svc.title.ru,
      body: <ArchiveConfirm svc={svc} onGo={() => { void archive(svc); }} />,
    });

  return (
    <section className="section" style={{ paddingTop: 10 }}>
      <div className="studio-price-head">
        <div className="eyebrow">на витрине · {live.list.length}</div>
        <button className="chip chip-gold" onClick={() => openServiceEditor()}>
          <Icon name="plus" size={13} strokeWidth={2.6} /> процедура
        </button>
      </div>

      {live.list.length > 7 && (
        <label className="pr-search">
          <Icon name="search" size={15} strokeWidth={2} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Найти процедуру" aria-label="Найти процедуру" />
        </label>
      )}

      {live.loading && !live.loaded && (
        <div className="card" style={{ padding: 20, textAlign: 'center' }}><div className="muted">Загружаем процедуры…</div></div>
      )}
      {live.error && (
        <div className="card empty-state mb" role="alert">
          <div className="empty-title">Процедуры не загрузились</div>
          <div className="empty-sub">{loadErrorText(live.error)} — проверьте интернет.</div>
          <button className="btn btn-secondary btn-block mt-md" onClick={() => { void loadLiveServices(true); }}>Повторить</button>
        </div>
      )}

      <div className="pr-list">
        {list.map((svc) => {
          const photo = servicePhoto(svc.slug);
          const why = hiddenWhy(svc);
          return (
            <SwipeRow
              key={svc.slug}
              label="Убрать"
              onCommit={() => confirm(svc)}
              collapsing={gone.has(svc.slug)}
            >
              <button className="pr-row" onClick={() => { tap(); openServiceEditor(svc); }} aria-label={`Изменить: ${svc.title.ru}`}>
                <span className={`pr-ph${photo ? '' : ' pr-ph--blank'}`} style={photo ? { backgroundImage: `url(${asset(photo)})` } : undefined}>
                  {!photo && <Icon name={findService(svc.slug)?.icon ?? 'sparkles'} size={18} strokeWidth={1.6} />}
                </span>
                <span className="pr-body">
                  <span className="pr-title">{svc.title.ru}</span>
                  <span className="pr-meta">{priceLine(svc)} · {lengthLine(svc)}</span>
                  {why && <span className="pr-warn"><Icon name="warning" size={11} strokeWidth={2.2} /> {why}</span>}
                </span>
                <Icon name="chevron-right" size={16} strokeWidth={2.2} className="pr-go" />
              </button>
            </SwipeRow>
          );
        })}
        {live.loaded && list.length === 0 && (
          <div className="card empty-state">
            <div className="empty-title">{q ? 'Ничего не найдено' : 'Пока ни одной процедуры'}</div>
            <div className="empty-sub">{q ? 'Попробуйте другое слово.' : 'Добавьте первую — она сразу появится в каталоге.'}</div>
          </div>
        )}
      </div>

      <p className="faint pr-help">
        Нажмите на процедуру, чтобы поменять фото, описание, цену и время. Потяните её влево, чтобы убрать с витрины.
      </p>

      {/* Скрытые: владелице видны, клиенткам — нет. Вернуть можно одним нажатием. */}
      {archived.list.length > 0 && (
        <>
          <button className="pr-hidden-head" onClick={() => setHiddenOpen((v) => !v)} aria-expanded={hiddenOpen}>
            <span className="eyebrow">скрытые · {archived.list.length}</span>
            <Icon name="chevron-right" size={14} strokeWidth={2.4} className={`pr-caret${hiddenOpen ? ' open' : ''}`} />
          </button>
          {hiddenOpen && (
            <div className="pr-list">
              {archived.list.map((svc) => (
                <div key={svc.slug} className="pr-row pr-row--hidden">
                  <span className="pr-body">
                    <span className="pr-title">{svc.title.ru}</span>
                    <span className="pr-meta">{priceLine(svc)}</span>
                  </span>
                  <button
                    className="chip"
                    disabled={restoring === svc.slug}
                    onClick={async () => {
                      setRestoring(svc.slug);
                      try {
                        await restoreArchived(svc);
                        notify('success');
                        toast(`«${svc.title.ru}» снова в каталоге`, 'success');
                      } catch (e) {
                        cabinetDenied(e);
                        notify('error');
                        toast(saveErrorText(e));
                      } finally {
                        setRestoring(null);
                      }
                    }}
                  >
                    Вернуть
                  </button>
                </div>
              ))}
            </div>
          )}
        </>
      )}
      {archived.error && <p className="form-why" role="alert">Скрытые не загрузились — {loadErrorText(archived.error).toLowerCase()}</p>}
    </section>
  );
}
