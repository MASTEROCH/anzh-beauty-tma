import { useState } from 'react';
import { openExternal } from '../lib/telegram';
import { Icon } from './Icon';
import { STUDIO, googleMapsUrl, yandexMapsUrl, osmEmbedUrl, studioAddress, ZOOM_STEPS, DEFAULT_ZOOM } from '../data/location';
import { useLang } from '../lib/i18n';
import { tap } from '../lib/haptics';

// Карта в блоке «Где найти». Клиентка решает «дойду ли я туда» ГЛАЗАМИ:
// строка «ул. Parnavaz Mepe 92/94» не отвечает на этот вопрос, фрагмент
// карты — отвечает.
//
// Карта грузится ТОЛЬКО по нажатию «Показать карту» (решение John перед
// волной 3, приватность): встроенная карта — это запрос к openstreetmap.org,
// и OSM получает IP-адрес телефона. `loading="lazy"` не спасал: Chromium
// (Telegram на Android) грузил iframe ниже первого экрана сразу при запуске
// (сторож — tests/smoke/boot.spec.ts, прогон E2E_BROWSER=chromium). До
// нажатия в рамке нет ни iframe, ни одного внешнего адреса.
//
// Две кнопки, а не одна: в Грузии Яндекс.Карты знают дворы и маршрутки, а
// Google — привычнее приезжим. Выбирать за клиентку тут нечего.

export function StudioMap() {
  const lang = useLang();
  const ru = lang === 'ru';
  const [zoom, setZoom] = useState(DEFAULT_ZOOM);
  const [shown, setShown] = useState(false);

  const open = (url: string) => {
    tap();
    openExternal(url);
  };

  return (
    <div className="studio-map">
      <div className="studio-map-frame" data-map={shown ? 'shown' : 'hidden'}>
        {!shown ? (
          <div
            data-testid="map-placeholder"
            style={{ height: '100%', display: 'grid', placeItems: 'center', alignContent: 'center', gap: 8, padding: '0 20px', textAlign: 'center' }}
          >
            <button
              className="btn btn-secondary"
              data-testid="map-show"
              onClick={() => { tap(); setShown(true); }}
            >
              <Icon name="pin" size={15} strokeWidth={2} />
              {ru ? 'Показать карту' : 'Show the map'}
            </button>
            <span className="faint" style={{ fontSize: 12, lineHeight: 1.45 }}>
              {ru
                ? 'Карта загрузится с OpenStreetMap только по нажатию: сервис увидит адрес твоего устройства в сети (IP) и данные браузера.'
                : 'The map loads from OpenStreetMap only when you tap: the service will see your device’s network address (IP) and browser details.'}
            </span>
          </div>
        ) : (
          <>
            {/* iframe намеренно неинтерактивен: собственные кнопки embed внутри
                него не срабатывают, и оставить их кликабельными значит держать
                на экране две мёртвые кнопки. Масштаб меняем своими. */}
            <iframe
              title={ru ? 'Карта: кабинет Анжелики' : 'Map: Anjelika’s studio'}
              src={osmEmbedUrl(zoom)}
              referrerPolicy="no-referrer"
              tabIndex={-1}
            />
            <div className="studio-map-zoom">
              <button
                onClick={() => setZoom((z) => Math.min(ZOOM_STEPS.length - 1, z + 1))}
                disabled={zoom >= ZOOM_STEPS.length - 1}
                aria-label={ru ? 'Приблизить' : 'Zoom in'}
              >
                <Icon name="plus" size={15} strokeWidth={2.8} />
              </button>
              <button
                onClick={() => setZoom((z) => Math.max(0, z - 1))}
                disabled={zoom <= 0}
                aria-label={ru ? 'Отдалить' : 'Zoom out'}
              >
                <Icon name="minus" size={15} strokeWidth={2.8} />
              </button>
            </div>
            {/* Метка рисуется поверх: у embed своя, но она мелкая и теряется */}
            <div className="studio-map-pin" aria-hidden>
              <span className="studio-map-pulse" />
              <Icon name="pin" size={18} strokeWidth={2.2} />
            </div>
          </>
        )}
      </div>

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

      <div className="studio-map-actions">
        <button className="btn btn-secondary" onClick={() => open(yandexMapsUrl())}>
          <Icon name="pin" size={15} strokeWidth={2} />
          {ru ? 'Яндекс.Карты' : 'Yandex Maps'}
        </button>
        <button className="btn btn-secondary" onClick={() => open(googleMapsUrl())}>
          <Icon name="globe" size={15} strokeWidth={2} />
          Google Maps
        </button>
      </div>
    </div>
  );
}
