import { useState } from 'react';
import { Icon } from './Icon';
import { ListEditor } from './ServiceEditor';
import { toast } from '../lib/ui';
import { notify, tap } from '../lib/haptics';
import { cabinetDenied } from '../lib/staff';
import { ApiError } from '../lib/session';
import { openExternal } from '../lib/telegram';
import { patchStudio, type StudioPatch } from '../lib/api/studio';
import { applyStudio, useStudio, toWire, type StudioProfile } from '../lib/studioProfile';

// «О студии» в кабинете: всё, что клиентка видит как контакты, адрес и часы.
//
// Раньше это было вшито в код (`data/location.ts`): сменила Анжелика номер
// или инстаграм — нужен разработчик и выкладка. Здесь же она правит сама, и
// изменение видно клиенткам сразу: профиль приходит публично (`GET /studio`),
// а после правки витрина на этом телефоне получает строку из ОТВЕТА сервера.
//
// Правила проверки жёсткие и объяснены словами рядом с полем: ошибка в
// контакте — это клиентка, которая написала «в никуда» (урок несуществующего
// WhatsApp 995500000000, который жил в коде).

const TG_RE = /^[A-Za-z][A-Za-z0-9_]{4,31}$/;
const IG_RE = /^[A-Za-z0-9._]{1,30}$/;
const PHONE_RE = /^\+\d{8,15}$/;
const WA_RE = /^\d{8,15}$/;
const DAYS = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];

function saveText(e: unknown): string {
  const code = e instanceof ApiError ? e.code : 'network';
  switch (code) {
    case 'forbidden': return 'Контакты студии меняет только владелица';
    case 'pin_required': return 'Подтвердите PIN, чтобы продолжить';
    case 'invalid': return 'Сервер не принял одно из полей — проверьте контакты';
    case 'not_found': return 'Сервер ещё не умеет хранить профиль студии — это нужно включить на бэкенде';
    case 'network':
    case 'timeout': return 'Нет связи — ничего не сохранилось, повторите';
    default: return 'Не сохранилось — повторите';
  }
}

/** «41.6459, 41.6317» или ссылка из Google Карт → { lat, lon } */
function parseCoords(text: string): { lat: number; lon: number } | null {
  const m = /(-?\d{1,3}\.\d+)\s*[,;\s]\s*(-?\d{1,3}\.\d+)/.exec(text);
  if (!m) return null;
  const lat = Number(m[1]);
  const lon = Number(m[2]);
  return lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180 ? { lat, lon } : null;
}

type Bi = { ru: string; en: string };

export function StudioAbout() {
  const cur = useStudio();
  const [lang, setLang] = useState<'ru' | 'en'>('ru');
  const [f, setF] = useState(() => ({
    telegram: cur.telegram,
    instagram: cur.instagram ?? '',
    phone: cur.phone ?? '',
    whatsapp: cur.whatsapp ?? '',
    city: { ...cur.city },
    street: { ...cur.street },
    floor: { ...cur.floor },
    hint: { ...cur.hint },
    hours: { ...cur.hours },
    landmarks: { ru: [...cur.landmarks.ru], en: [...cur.landmarks.en] },
    offDays: [...cur.offDays],
    coords: `${cur.lat}, ${cur.lon}`,
  }));
  const [busy, setBusy] = useState(false);
  const [why, setWhy] = useState<string | null>(null);
  const L = lang;

  const bi = (k: 'city' | 'street' | 'floor' | 'hint' | 'hours', v: string) =>
    setF((p) => ({ ...p, [k]: { ...p[k], [L]: v } as Bi }));

  // ── проверка ──
  const tg = f.telegram.trim().replace(/^@/, '');
  const ig = f.instagram.trim().replace(/^@/, '');
  const phone = f.phone.replace(/[\s()-]/g, '');
  const wa = f.whatsapp.replace(/\D/g, '');
  const coords = parseCoords(f.coords);
  const errors: string[] = [];
  if (!TG_RE.test(tg)) errors.push('Telegram: имя без @, 5–32 символа, латиница, цифры и «_»');
  if (ig && !IG_RE.test(ig)) errors.push('Instagram: только латиница, цифры, «.» и «_»');
  if (phone && !PHONE_RE.test(phone)) errors.push('Телефон: в международном формате, например +995 555 12 34 56');
  if (f.whatsapp.trim() && !WA_RE.test(wa)) errors.push('WhatsApp: цифры с кодом страны, например 995555123456');
  if (!coords) errors.push('Координаты: два числа через запятую, например 41.6459, 41.6317');
  if (!f.street.ru.trim()) errors.push('Укажите улицу');

  const next: StudioProfile = {
    ...cur,
    telegram: tg,
    instagram: ig || null,
    phone: phone || null,
    whatsapp: wa || null,
    city: f.city, street: f.street, floor: f.floor, hint: f.hint, hours: f.hours,
    landmarks: f.landmarks,
    offDays: f.offDays,
    lat: coords?.lat ?? cur.lat,
    lon: coords?.lon ?? cur.lon,
  };
  const before = JSON.stringify(toWire(cur));
  const dirty = JSON.stringify(toWire(next)) !== before;

  const save = async () => {
    if (busy || errors.length || !dirty) return;
    setBusy(true);
    setWhy(null);
    try {
      const wire = toWire(next);
      const was = JSON.parse(before) as Record<string, unknown>;
      // Только изменившиеся поля: пустая правка — 422 `empty_patch`, лишнее — шум
      const patch: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(wire)) {
        if (JSON.stringify(v) !== JSON.stringify(was[k])) patch[k] = v;
      }
      applyStudio(await patchStudio(patch as StudioPatch));
      notify('success');
      toast('Контакты студии сохранены', 'success');
    } catch (e) {
      cabinetDenied(e);
      notify('error');
      setWhy(saveText(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="section" style={{ paddingTop: 10 }}>
      <div className="pe">
        <div className="pe-sect">
          <div className="pe-sect-head"><span className="eyebrow">Как с вами связаться</span></div>
          <label className="se-field"><span>Telegram студии</span>
            <input value={f.telegram} onChange={(e) => setF({ ...f, telegram: e.target.value })} placeholder="anzh_cosmetology" autoCapitalize="none" autoCorrect="off" />
          </label>
          <label className="se-field"><span>Instagram</span>
            <input value={f.instagram} onChange={(e) => setF({ ...f, instagram: e.target.value })} placeholder="dr.domnich" autoCapitalize="none" autoCorrect="off" />
          </label>
          <div className="se-two">
            <label className="se-field"><span>Телефон</span>
              <input value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} placeholder="+995 …" inputMode="tel" />
            </label>
            <label className="se-field"><span>WhatsApp</span>
              <input value={f.whatsapp} onChange={(e) => setF({ ...f, whatsapp: e.target.value })} placeholder="995…" inputMode="tel" />
            </label>
          </div>
          <p className="faint pe-hint">
            Телефон и WhatsApp необязательны: пока поле пусто, кнопки «Позвонить» и «Написать в WhatsApp» клиентке не показываются.
            Кнопка, ведущая в никуда, хуже её отсутствия.
          </p>
        </div>

        <div className="pe-sect">
          <div className="pe-sect-head">
            <span className="eyebrow">Адрес</span>
            <div className="pe-lang" role="tablist" aria-label="Язык текстов">
              {(['ru', 'en'] as const).map((l) => (
                <button key={l} role="tab" aria-selected={lang === l} className={lang === l ? 'on' : ''} onClick={() => setLang(l)}>{l.toUpperCase()}</button>
              ))}
            </div>
          </div>
          <div className="se-two">
            <label className="se-field"><span>Город</span>
              <input value={f.city[L]} onChange={(e) => bi('city', e.target.value)} />
            </label>
            <label className="se-field"><span>Этаж</span>
              <input value={f.floor[L]} onChange={(e) => bi('floor', e.target.value)} />
            </label>
          </div>
          <label className="se-field"><span>Улица и дом</span>
            <input value={f.street[L]} onChange={(e) => bi('street', e.target.value)} />
          </label>
          <label className="se-field"><span>Как найти — одной строкой</span>
            <input value={f.hint[L]} onChange={(e) => bi('hint', e.target.value)} placeholder="10 мин от Boulevard" />
          </label>
          <div className="se-field">
            <span>Приметы для того, кто уже у двери</span>
            <ListEditor
              items={f.landmarks[L]}
              onChange={(v) => setF({ ...f, landmarks: { ...f.landmarks, [L]: v } })}
              placeholder="Например: вывеска ANZH над входом"
              addLabel="Добавить примету"
              max={6}
            />
          </div>
        </div>

        <div className="pe-sect">
          <div className="pe-sect-head"><span className="eyebrow">Часы работы</span></div>
          <label className="se-field"><span>Текстом, как увидит клиентка</span>
            <input value={f.hours[L]} onChange={(e) => bi('hours', e.target.value)} placeholder="Вт–Сб · 09:00–20:00" />
          </label>
          <div className="se-field">
            <span>Выходные дни</span>
            <div className="se-cats">
              {DAYS.map((d, i) => {
                const off = f.offDays.includes(i);
                return (
                  <button key={d} className={`se-cat${off ? ' active' : ''}`} aria-pressed={off}
                    onClick={() => { tap(); setF({ ...f, offDays: off ? f.offDays.filter((x) => x !== i) : [...f.offDays, i].sort() }); }}>
                    {d}
                  </button>
                );
              })}
            </div>
            <p className="faint pe-hint" style={{ marginTop: 6 }}>По этим дням календарь записи не предлагает время.</p>
          </div>
        </div>

        <div className="pe-sect">
          <div className="pe-sect-head"><span className="eyebrow">Точка на карте</span></div>
          <label className="se-field"><span>Координаты</span>
            <input value={f.coords} onChange={(e) => setF({ ...f, coords: e.target.value })} placeholder="41.6459, 41.6317" inputMode="decimal" autoCapitalize="none" />
          </label>
          <p className="faint pe-hint">
            Вставьте пару чисел из Google Карт (долгое нажатие на точку → скопировать координаты). Кнопки «Яндекс» и «Google» у клиентки
            ведут именно сюда — неверная точка увезёт её в другой квартал.
          </p>
          {coords && (
            <button
              className="btn btn-secondary btn-block"
              onClick={() => { tap(); openExternal(`https://www.google.com/maps/search/?api=1&query=${coords.lat},${coords.lon}`); }}
            >
              <Icon name="pin" size={15} strokeWidth={2} /> Проверить точку на карте
            </button>
          )}
        </div>

        {errors.length > 0 && (
          <ul className="form-why" role="alert" style={{ paddingLeft: 18, margin: 0 }}>
            {errors.map((e) => <li key={e}>{e}</li>)}
          </ul>
        )}
        {why && <p className="form-why" role="alert">{why}</p>}

        <div className="pe-save">
          <button className="btn btn-primary btn-block" disabled={busy || errors.length > 0 || !dirty} onClick={() => { void save(); }}>
            {busy ? 'Сохраняем…' : dirty ? 'Сохранить' : 'Всё сохранено'}
          </button>
        </div>
      </div>
    </section>
  );
}
