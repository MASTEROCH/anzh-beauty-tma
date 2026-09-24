import { useState } from 'react';
import { Icon } from './Icon';
import { openSheet, closeSheet, toast } from '../lib/ui';
import { notify, tap } from '../lib/haptics';
import {
  usePromos, addPromo, updatePromo, removePromo, setLive,
  isRunning, promoBenefit, type Promo, type PromoKind,
} from '../lib/promos';
import { liveServices } from '../lib/catalog';
import { findService } from '../data/services';

/*
   АКЦИИ: создать и запустить.

   Ключевое различие, вокруг которого построен экран, — между
   «придумана» и «идёт». Акция, у которой стоит галочка «запущена», но
   вышел срок, НЕ идёт: иначе «до 20-го» висело бы двадцать первого, и
   объясняться пришлось бы у стойки. Поэтому состояние считается, а не
   хранится флагом.

   Запуск и остановка вынесены отдельной кнопкой из правки: это
   решение, а не текст. Перепутать «поправил формулировку» и «включил
   скидку всем» нельзя.
*/

export function StudioPromos() {
  const promos = usePromos();
  const running = promos.filter((p) => isRunning(p));

  return (
    <div>
      <div className="row row-between mb-md">
        <div className="eyebrow">
          акции · идёт {running.length} из {promos.length}
        </div>
        <button className="chip chip-gold" onClick={() => openForm()}>
          <Icon name="plus" size={13} strokeWidth={2.6} /> акция
        </button>
      </div>

      {promos.length === 0 && (
        <div className="card empty-card">
          <Icon name="gift" size={26} strokeWidth={1.8} />
          <div className="muted mt-sm">Акций пока нет</div>
          <div className="faint mt-xs" style={{ fontSize: 12 }}>
            Свободное окно во вторник или сезонный спад — повод сделать предложение
          </div>
        </div>
      )}

      <div className="stack-tight">
        {promos.map((p) => {
          const live = isRunning(p);
          return (
            <article key={p.id} className={`promo-row${live ? ' live' : ''}`}>
              <button className="promo-main" onClick={() => openForm(p)}>
                <span className="promo-head">
                  <span className="promo-benefit">{promoBenefit(p)}</span>
                  <span className={`chip ${live ? 'chip-gold' : 'chip-quiet'}`}>
                    {live ? 'идёт' : p.live ? 'срок вышел' : 'остановлена'}
                  </span>
                </span>
                <span className="promo-title">{p.title}</span>
                <span className="promo-meta">
                  {p.serviceIds.length === 0
                    ? 'на все процедуры'
                    : p.serviceIds.map((id) => findService(id)?.title ?? id).join(' · ')}
                  {p.toISO && ` · до ${p.toISO.slice(5).replace('-', '.')}`}
                </span>
              </button>

              <button
                className={`promo-switch${p.live ? ' on' : ''}`}
                aria-label={p.live ? 'Остановить' : 'Запустить'}
                onClick={() => {
                  tap();
                  setLive(p.id, !p.live);
                  toast(p.live ? `«${p.title}» остановлена` : `«${p.title}» запущена`,
                    p.live ? undefined : 'success');
                }}
              >
                <span className="promo-knob" />
              </button>
            </article>
          );
        })}
      </div>
    </div>
  );
}

function openForm(promo?: Promo) {
  openSheet({
    title: promo ? 'Акция' : 'Новая акция',
    subtitle: promo?.title,
    body: <PromoForm promo={promo} />,
  });
}

const KINDS: Array<{ id: PromoKind; label: string; hint: string }> = [
  { id: 'percent', label: 'Процент', hint: 'скидка со всей процедуры' },
  { id: 'amount', label: 'Сумма', hint: 'фиксированная скидка в долларах' },
  { id: 'gift', label: 'Подарок', hint: 'что-то к визиту, без скидки' },
];

function PromoForm({ promo }: { promo?: Promo }) {
  const services = liveServices();
  const [title, setTitle] = useState(promo?.title ?? '');
  const [kind, setKind] = useState<PromoKind>(promo?.kind ?? 'percent');
  const [value, setValue] = useState(String(promo?.value ?? 10));
  const [ids, setIds] = useState<string[]>(promo?.serviceIds ?? []);
  const [fromISO, setFrom] = useState(promo?.fromISO ?? '');
  const [toISO, setTo] = useState(promo?.toISO ?? '');

  const toggle = (id: string) =>
    setIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const num = Number(value) || 0;
  const ready = title.trim().length > 2 && (kind === 'gift' || num > 0);
  // Срок задом наперёд — акция, которая не начнётся никогда
  const badRange = !!fromISO && !!toISO && toISO < fromISO;

  const save = () => {
    if (badRange) return;
    const patch = {
      title: title.trim(),
      kind,
      value: kind === 'gift' ? 0 : num,
      serviceIds: ids,
      fromISO: fromISO || undefined,
      toISO: toISO || undefined,
    };
    if (promo) updatePromo(promo.id, patch);
    else addPromo(patch);
    notify('success');
    closeSheet();
    toast(promo ? 'Акция обновлена' : 'Акция создана — запустите её переключателем', 'success');
  };

  return (
    <>
      <label className="field">
        <span className="field-k">Как назвать</span>
        <input
          className="input"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Вторник без очереди"
        />
      </label>

      <div className="eyebrow sub-head">что даём</div>
      <div className="chips-wrap">
        {KINDS.map((k) => (
          <button
            key={k.id}
            className={`chip${kind === k.id ? ' chip-gold' : ''}`}
            onClick={() => setKind(k.id)}
          >
            {k.label}
          </button>
        ))}
      </div>
      <p className="faint mt-xs" style={{ fontSize: 12 }}>
        {KINDS.find((k) => k.id === kind)?.hint}
      </p>

      {kind !== 'gift' && (
        <label className="field mt-md">
          <span className="field-k">{kind === 'percent' ? 'Процент' : 'Сумма, $'}</span>
          <input
            className="input"
            inputMode="numeric"
            value={value}
            onChange={(e) => setValue(e.target.value.replace(/\D/g, ''))}
          />
        </label>
      )}

      <div className="eyebrow sub-head">на какие процедуры</div>
      <p className="faint mb-sm" style={{ fontSize: 12 }}>
        Не выбрано ни одной — акция действует на всё
      </p>
      <div className="chips-wrap">
        {services.map((s) => (
          <button
            key={s.id}
            className={`chip${ids.includes(s.id) ? ' chip-gold' : ''}`}
            onClick={() => toggle(s.id)}
          >
            {s.title}
          </button>
        ))}
      </div>

      <div className="eyebrow sub-head">срок</div>
      <div className="row" style={{ gap: 'var(--sp-sm)' }}>
        <label className="field row-fill">
          <span className="field-k">с</span>
          <input className="input" type="date" value={fromISO} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label className="field row-fill">
          <span className="field-k">по</span>
          <input className="input" type="date" value={toISO} onChange={(e) => setTo(e.target.value)} />
        </label>
      </div>
      {badRange && <p className="form-why">Конец срока раньше начала — такая акция не начнётся</p>}
      <p className="faint" style={{ fontSize: 12 }}>
        Пусто — бессрочно. Акция с истёкшим сроком останавливается сама.
      </p>

      <button className="btn btn-primary btn-block mt-md" disabled={!ready || badRange} onClick={save}>
        {promo ? 'Сохранить' : 'Создать'}
      </button>

      {promo && (
        <button
          className="btn btn-quiet btn-block danger mt-sm"
          onClick={() => {
            removePromo(promo.id);
            closeSheet();
            toast('Акция удалена');
          }}
        >
          Удалить акцию
        </button>
      )}
    </>
  );
}
