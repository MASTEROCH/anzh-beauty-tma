import { useState } from 'react';
import { Icon } from './Icon';
import { closeSheet, openSheet, toast } from '../lib/ui';
import { notify } from '../lib/haptics';
import { categories, type Service } from '../data/services';
import { addService, archiveService, restoreService, isArchived, isCustom } from '../lib/catalog';

// Добавление процедуры мастером. Минимум полей — ровно те, без которых
// услугу нельзя ни показать, ни записать: название, категория, длительность
// и цена. Остальное («что входит», противопоказания) добавляется потом и
// пустым не ломает ни один экран — списки просто не рисуются.
//
// Почему не полная форма на 12 полей: её заполняют один раз и бросают на
// середине. Короткая форма даёт живую услугу за минуту, а детали можно
// дописать, когда до них дойдут руки.

const EMPTY = {
  title: '',
  short: '',
  category: 'care' as Service['category'],
  duration: 60,
  priceUsd: 80,
};

export function openServiceEditor() {
  openSheet({
    title: 'Новая процедура',
    subtitle: 'Появится в каталоге сразу после сохранения',
    body: <ServiceForm />,
  });
}

function ServiceForm() {
  const [f, setF] = useState(EMPTY);
  const ready = f.title.trim().length > 1 && f.duration > 0 && f.priceUsd > 0;

  const save = () => {
    if (!ready) return;
    addService({
      category: f.category,
      title: f.title.trim(),
      short: f.short.trim() || `${f.duration} мин`,
      description: f.short.trim() || 'Описание добавим позже.',
      duration: f.duration,
      priceUsd: f.priceUsd,
      // Курс лари к доллару фиксируем один раз здесь: мастер вводит цену
      // в долларах, а вторая валюта нужна только для показа
      priceGel: Math.round(f.priceUsd * 2.74),
      icon: categories.find((c) => c.id === f.category)?.icon ?? 'sparkles',
      includes: [],
      contraindications: [],
    });
    notify('success');
    closeSheet();
    toast(`${f.title.trim()} — в каталоге`, 'success');
  };

  return (
    <div className="se">
      <label className="se-field">
        <span>Название</span>
        <input
          value={f.title}
          onChange={(e) => setF({ ...f, title: e.target.value })}
          placeholder="Например: Микротоки"
          autoFocus
        />
      </label>

      <label className="se-field">
        <span>Короткое описание</span>
        <input
          value={f.short}
          onChange={(e) => setF({ ...f, short: e.target.value })}
          placeholder="Аппарат · лифтинг без игл"
        />
      </label>

      <div className="se-field">
        <span>Направление</span>
        <div className="se-cats">
          {categories.filter((c) => c.id !== 'all').map((c) => (
            <button
              key={c.id}
              className={`se-cat${f.category === c.id ? ' active' : ''}`}
              onClick={() => setF({ ...f, category: c.id as Service['category'] })}
            >
              <Icon name={c.icon} size={13} strokeWidth={2} />
              {c.label}
            </button>
          ))}
        </div>
      </div>

      <div className="se-two">
        <label className="se-field">
          <span>Длительность, мин</span>
          <input
            type="number"
            inputMode="numeric"
            value={f.duration}
            onChange={(e) => setF({ ...f, duration: Number(e.target.value) || 0 })}
          />
        </label>
        <label className="se-field">
          <span>Цена, $</span>
          <input
            type="number"
            inputMode="numeric"
            value={f.priceUsd}
            onChange={(e) => setF({ ...f, priceUsd: Number(e.target.value) || 0 })}
          />
        </label>
      </div>

      <div className="se-preview">
        <Icon name={categories.find((c) => c.id === f.category)?.icon ?? 'sparkles'} size={18} strokeWidth={1.8} />
        <div>
          <b>{f.title.trim() || 'Название процедуры'}</b>
          <span>{f.short.trim() || 'короткое описание'} · {f.duration} мин · ${f.priceUsd}</span>
        </div>
      </div>

      <button className="btn btn-primary btn-block" disabled={!ready} onClick={save} style={{ marginTop: 14 }}>
        {ready ? 'Добавить в каталог' : 'Заполни название и цену'}
      </button>
    </div>
  );
}

/** Убрать / вернуть процедуру. Удаления нет намеренно — см. lib/catalog.ts */
export function ArchiveButton({ service, onDone }: { service: Service; onDone: () => void }) {
  const archived = isArchived(service.id);
  return (
    <button
      className={`se-arch${archived ? ' on' : ''}`}
      aria-label={archived ? 'Вернуть в каталог' : 'Убрать из каталога'}
      onClick={() => {
        if (archived) {
          restoreService(service.id);
          toast(`${service.title} — снова в каталоге`, 'success');
        } else {
          archiveService(service.id);
          toast(
            isCustom(service.id)
              ? `${service.title} убрана из каталога`
              : `${service.title} скрыта — история визитов сохранена`,
          );
        }
        onDone();
      }}
    >
      <Icon name={archived ? 'plus' : 'x'} size={14} strokeWidth={2.4} />
    </button>
  );
}
