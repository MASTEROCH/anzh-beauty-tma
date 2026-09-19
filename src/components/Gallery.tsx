import { useState } from 'react';
import { useReveal } from '../lib/reveal';
import { Icon } from './Icon';
import { closeSheet, openSheet, openLightbox } from '../lib/ui';
import { select, tap } from '../lib/haptics';
import { useLang, t } from '../lib/i18n';
import { servicePhoto, sTitle, categories, CATEGORY_KEY, type Service } from '../data/services';
import { useCatalog } from '../lib/catalog';

// Галерея была шестью фотографиями, повторёнными по кругу, с подписью
// «54 кейса». Три беды сразу: плитки ничего не открывали, направления не
// фильтровались, а число было выдумано — при 6 снимках «54 кейса» замечает
// любой, кто досмотрит до второго повтора.
//
// Теперь это вход в процедуры: направления фильтруются, каждая плитка
// открывает карточку с тем, что реально записано в услуге (что входит,
// сколько длится, сколько стоит), и оттуда же ведёт запись. Галерея —
// главный драйвер решения «идти или нет», и обрывать её на картинке значит
// терять человека ровно там, где он уже согласился.
//
// Снимки — иллюстрации процедуры, а не работы Анжелики: подпись об этом
// стоит в блоке, а не прячется. Настоящие «до / после» появятся в
// `serviceResultPair`, когда Анжелика даст свои.


export function Gallery({ onBook, onOpenService }: { onBook: (id: string) => void; onOpenService: (id: string) => void }) {
  const lang = useLang();
  const ru = lang === 'ru';
  const [cat, setCat] = useState<string>('all');

  const { live } = useCatalog();
  const all = live.filter((s) => servicePhoto(s.id));
  // Показываем только те направления, в которых реально есть карточки —
  // пустой фильтр это обещание, которое интерфейс не выполняет
  const present = new Set(all.map((s) => s.category));
  const chips = categories.filter((c) => c.id === 'all' || present.has(c.id as Service['category']));
  const list = cat === 'all' ? all : all.filter((s) => s.category === cat);
  // Пересобираем наблюдателя при смене фильтра: список стал другим
  const gridRef = useReveal<HTMLDivElement>([cat]);

  const openCase = (s: Service) => {
    tap();
    const photo = servicePhoto(s.id)!;
    openSheet({
      title: sTitle(s, lang),
      subtitle: `${s.duration} ${t('common.min', lang)} · $${s.priceUsd}`,
      body: (
        <>
          <button
            className="case-photo"
            onClick={() => openLightbox(photo, sTitle(s, lang))}
            aria-label={ru ? 'Открыть фото' : 'Open the photo'}
            style={{ backgroundImage: `url(${photo})` }}
          >
            <span className="case-photo-zoom"><Icon name="search" size={15} strokeWidth={2.2} /></span>
          </button>

          <p className="case-desc">{s.description}</p>

          <div className="case-facts">
            <div className="case-fact">
              <span className="case-fact-v">{s.duration}</span>
              <span className="case-fact-k">{t('common.min', lang)}</span>
            </div>
            <div className="case-fact">
              <span className="case-fact-v">${s.priceUsd}</span>
              <span className="case-fact-k">{s.priceGel} GEL</span>
            </div>
            <div className="case-fact">
              <span className="case-fact-v">{s.includes.length}</span>
              <span className="case-fact-k">{ru ? 'шага внутри' : 'steps inside'}</span>
            </div>
          </div>

          <div className="eyebrow" style={{ margin: '18px 0 8px' }}>{t('service.includes', lang)}</div>
          <ul className="info-list">
            {s.includes.map((i) => <li key={i}>{i}</li>)}
          </ul>

          <div className="case-note">
            <Icon name="shield-check" size={14} strokeWidth={1.9} />
            <span>
              {ru
                ? 'Фото иллюстрирует процедуру. Свои работы Анжелика показывает на приёме — чужие снимки в примеры не ставим.'
                : 'The photo illustrates the procedure. Anjelika shows her own work at the visit — we don’t pass off stock as results.'}
            </span>
          </div>
        </>
      ),
      actions: (
        <>
          <button className="btn btn-primary btn-block" onClick={() => { closeSheet(); setTimeout(() => onBook(s.id), 200); }}>
            {ru ? 'Записаться на эту процедуру' : 'Book this treatment'}
          </button>
          <button className="btn btn-quiet btn-block" onClick={() => { closeSheet(); setTimeout(() => onOpenService(s.id), 200); }}>
            {ru ? 'Подробно о процедуре' : 'Full details'}
          </button>
        </>
      ),
    });
  };

  return (
    <div className="gallery">
      <div className="gallery-filters category-row" role="tablist">
        {chips.map((c) => (
          <button
            key={c.id}
            role="tab"
            aria-selected={cat === c.id}
            className={`gallery-chip${cat === c.id ? ' active' : ''}`}
            onClick={() => { select(); setCat(c.id); }}
          >
            <Icon name={c.icon} size={13} strokeWidth={2} />
            {t(CATEGORY_KEY[c.id] ?? 'cat.all', lang)}
          </button>
        ))}
      </div>

      <div className="gallery-grid" ref={gridRef}>
        {list.map((s) => (
          <button
            key={s.id}
            className="gallery-tile"
            style={{ backgroundImage: `url(${servicePhoto(s.id)})` }}
            onClick={() => openCase(s)}
          >
            <span className="gallery-tile-scrim" aria-hidden />
            <span className="gallery-tile-meta">
              <span className="gallery-tile-title">{sTitle(s, lang)}</span>
              <span className="gallery-tile-sub">{s.duration} {t('common.min', lang)} · ${s.priceUsd}</span>
            </span>
            <span className="gallery-tile-go" aria-hidden><Icon name="chevron-right" size={14} strokeWidth={2.6} /></span>
          </button>
        ))}
      </div>

      {list.length === 0 && (
        <p className="gallery-empty">
          {ru ? 'В этом направлении фотографий пока нет.' : 'No photos in this direction yet.'}
        </p>
      )}
    </div>
  );
}
