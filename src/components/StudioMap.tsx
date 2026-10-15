import { openExternal } from '../lib/telegram';
import { Icon } from './Icon';
import { STUDIO, googleMapsUrl, yandexMapsUrl, studioAddress, STUDIO_SAT } from '../data/location';
import { useLang } from '../lib/i18n';
import { tap } from '../lib/haptics';
import { asset } from '../lib/asset';
import { closeSheet, openSheet } from '../lib/ui';

// Карта в блоке «Где найти». Клиентка решает «дойду ли я туда» ГЛАЗАМИ:
// строка «ул. Parnavaz Mepe 92/94» на этот вопрос не отвечает, вид сверху —
// отвечает.
//
// 🚨 КАРТА ОТКРЫТА ВСЕГДА, И ПРИ ЭТОМ НИ ОДНОГО ВНЕШНЕГО ЗАПРОСА.
// Раньше здесь стоял встроенный OpenStreetMap за кнопкой «Показать карту»:
// кнопка была не капризом, а защитой — встроенная карта это запрос к
// openstreetmap.org, и чужой сервис получал IP телефона. Защита верная,
// цена неверная: человек видел серый прямоугольник там, где ему нужен был
// ответ «куда идти».
//
// Снимок со спутника лежит У НАС (`/photos/studio/map-sat-v1.webp`, 87 КБ):
// он виден сразу, и наружу по-прежнему не уходит ничего. Метка рисуется
// поверх по центру — кадр снят ровно вокруг координат студии.
//
// Чужие карты открываются ПО НАЖАТИЮ и только тогда: там человек строит
// маршрут, и тогда он сам решает идти в Яндекс или в Google. Две, а не
// одна: в Грузии Яндекс знает дворы и маршрутки, Google привычнее приезжим.
//
// Имя файла с версией: vercel.json кэширует /photos/ на час в браузере и на
// сутки на CDN. Новый кадр — новое имя, иначе старый останется в кэшах.

export function StudioMap() {
  const lang = useLang();
  const ru = lang === 'ru';

  const open = (url: string) => {
    tap();
    closeSheet();
    openExternal(url);
  };

  /* Выбор карты — шторкой, а не двумя кнопками на экране. Кнопки стояли
     всегда и предлагали уйти из приложения раньше, чем человек посмотрел,
     куда идти; теперь сначала вид сверху, а «открыть в картах» — шаг,
     который он делает сам. */
  const chooseMap = () => {
    tap();
    openSheet({
      title: ru ? 'Открыть в картах' : 'Open in maps',
      subtitle: studioAddress(lang),
      body: (
        <div className="col" style={{ gap: 10 }}>
          <button className="btn btn-secondary btn-block" onClick={() => open(yandexMapsUrl())}>
            <Icon name="pin" size={15} strokeWidth={2} />
            {ru ? 'Яндекс.Карты' : 'Yandex Maps'}
          </button>
          <button className="btn btn-secondary btn-block" onClick={() => open(googleMapsUrl())}>
            <Icon name="globe" size={15} strokeWidth={2} />
            Google Maps
          </button>
          <p className="faint" style={{ fontSize: 12, lineHeight: 1.5, margin: 0 }}>
            {ru
              ? 'Маршрут строится в приложении карт — оно откроется отдельно и увидит, откуда ты идёшь.'
              : 'The route is built in the maps app — it opens separately and will see where you start from.'}
          </p>
        </div>
      ),
    });
  };

  return (
    <div className="studio-map">
      <button
        className="studio-map-frame"
        onClick={chooseMap}
        data-testid="map-open"
        aria-label={ru ? 'Открыть студию в картах' : 'Open the studio in maps'}
      >
        <img
          className="studio-map-sat"
          src={asset(STUDIO_SAT.src)}
          width={STUDIO_SAT.w}
          height={STUDIO_SAT.h}
          alt={ru
            ? 'Вид сверху на квартал: студия в центре кадра'
            : 'Satellite view of the block: the studio is at the centre'}
          decoding="async"
          loading="lazy"
        />
        {/* Метка — ровно по центру: кадр снят вокруг координат студии */}
        <span className="studio-map-pin" aria-hidden>
          <span className="studio-map-pulse" />
          <Icon name="pin" size={18} strokeWidth={2.2} />
        </span>
        <span className="studio-map-open" aria-hidden>
          <Icon name="globe" size={14} strokeWidth={2.2} />
          {ru ? 'Открыть в картах' : 'Open in maps'}
        </span>
        <span className="studio-map-credit">{STUDIO_SAT.credit}</span>
      </button>

      <div className="studio-map-foot">
        <div className="studio-map-addr">
          <div className="studio-map-street">{studioAddress(lang)}</div>
          <div className="studio-map-hint">{STUDIO.hint[lang]}</div>
        </div>
      </div>

      <ul className="studio-map-list">
        {STUDIO.landmarks[lang].map((l) => (
          <li key={l}><Icon name="check" size={13} strokeWidth={2.6} />{l}</li>
        ))}
      </ul>
    </div>
  );
}
