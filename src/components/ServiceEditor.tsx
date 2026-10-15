import { useRef, useState } from 'react';
import { Icon } from './Icon';
import { closeSheet, openSheet, toast } from '../lib/ui';
import { notify, tap } from '../lib/haptics';
import { categories, servicePhoto, type Service } from '../data/services';
import { ApiError, newIdempotencyKey } from '../lib/session';
import { cabinetDenied } from '../lib/staff';
import {
  applyService, refreshServices, formatMoney, minorToInput, parseMoneyInput,
} from '../lib/studio';
import {
  createService, patchService, archiveService, restoreService,
  type ServiceCategory, type ServicePatch, type WireService,
} from '../lib/api/staff';
import { applyOwnerEdit } from '../lib/catalog';
import { currencySign } from '../lib/money';
import { SHOWCASE_CURRENCIES, type ShowcaseCurrency } from '../lib/showable';
import { asset } from '../lib/asset';
import { photoLibrary, uploadFile, PhotoError } from '../lib/photoLibrary';

/* ─── КАРТОЧКА ПРОЦЕДУРЫ В КАБИНЕТЕ ──────────────────────────────────────
   Правка прайса ходит на сервер через lib/api/staff.ts (проверено Ф-5:
   прежние addService/archiveService/restoreService из lib/catalog.ts
   пустые, и их здесь нет). После каждой удачной правки витрина клиентки на
   этом телефоне (lib/catalog.ts, отдельная копия GET /services) получает
   строку из ОТВЕТА сервера — не перечитывается: без пропуска GET /services
   край Vercel до 30 с отдаёт прежний прайс (Хейтер, волна 4). Списки самого
   кабинета читаются с пропуском и перечитываются (refreshServices).

   v2 (Роч, 15.10.2026): «провалиться внутрь карточки и заменить фотографию,
   описание, цену, длительность». Раньше форма знала название, короткое
   описание, цену и время; теперь — всё, что принимает `PATCH /services/{slug}`:
   фото, названия и описания на двух языках, «цена от», «что входит» и
   противопоказания. Поля, которых сервер не принимает (направление у
   существующей процедуры), показаны, но не редактируются.

   Минимум для НОВОЙ процедуры — ровно то, без чего её нельзя показать и
   записать: название, направление, длительность и цена. Остальное
   добавляется потом и пустым не ломает ни один экран.

   M-5 (решение владельца 06.10, "1-a"): цена живёт в СВОЕЙ валюте — лари или
   доллары, на экране и на проводе (`price_minor` + `currency`). Новая
   процедура выбирает валюту (лари выбраны и видны, не молча); существующая
   правится в своей; строка без валюты спрашивает её, прежде чем уйдёт
   цена. Пустое поле в PATCH не шлётся: выдуманные 80 / 60 мин / 1 день не
   ложатся на строку, у которой их не было. */

type Cat = Service['category'];

const TRANSLIT: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i', й: 'y', к: 'k', л: 'l',
  м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'h', ц: 'ts', ч: 'ch', ш: 'sh',
  щ: 'sch', ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya',
};

/** Адрес процедуры из названия: латиница, цифры и дефис (формат slug сервера). */
export function slugify(title: string): string {
  return title
    .toLowerCase()
    .split('')
    .map((ch) => TRANSLIT[ch] ?? ch)
    .join('')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64)
    .replace(/-+$/g, '');
}

const SLUG_RE = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/;

/** Currency chips of a new row (draft words for Katya). */
const CURRENCY_WORD: Record<ShowcaseCurrency, string> = { GEL: '₾ лари', USD: '$ доллары' };

export function saveErrorText(e: unknown): string {
  const code = e instanceof ApiError ? e.code : 'network';
  switch (code) {
    case 'slug_taken': return 'Такой адрес уже есть (в том числе у процедуры в архиве) — поменяйте его';
    case 'bad_currency': return 'Валюта не принята';
    case 'invalid': return 'Проверьте поля — сервер их не принял';
    case 'forbidden': return 'Прайс меняет только владелица';
    case 'pin_required': return 'Подтвердите PIN, чтобы продолжить';
    case 'not_found': return 'Процедуры больше нет';
    case 'network':
    case 'timeout': return 'Нет связи — ничего не сохранилось, повторите';
    default: return 'Не сохранилось — повторите';
  }
}

export function openServiceEditor(existing?: WireService) {
  openSheet({
    title: existing ? 'Карточка процедуры' : 'Новая процедура',
    subtitle: existing ? existing.title.ru : 'Появится в каталоге сразу после сохранения',
    body: <ServiceForm existing={existing} />,
  });
}

/* ── Список строк: «что входит» и противопоказания ── */
export function ListEditor({
  items, onChange, placeholder, addLabel, max = 12,
}: {
  items: string[];
  onChange: (next: string[]) => void;
  placeholder: string;
  addLabel: string;
  max?: number;
}) {
  const [draft, setDraft] = useState('');
  const add = () => {
    const v = draft.trim();
    if (!v || items.length >= max) return;
    tap();
    onChange([...items, v]);
    setDraft('');
  };
  return (
    <div className="pe-list">
      {items.map((it, i) => (
        <div className="pe-list-row" key={`${i}-${it}`}>
          <span className="pe-list-text">{it}</span>
          <button className="pe-list-x" aria-label={`Убрать: ${it}`} onClick={() => onChange(items.filter((_, j) => j !== i))}>
            <Icon name="x" size={13} strokeWidth={2.4} />
          </button>
        </div>
      ))}
      <div className="pe-list-add">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } }}
          placeholder={placeholder}
          maxLength={160}
          enterKeyHint="done"
        />
        <button className="pe-list-plus" onClick={add} disabled={!draft.trim() || items.length >= max} aria-label={addLabel}>
          <Icon name="plus" size={15} strokeWidth={2.6} />
        </button>
      </div>
    </div>
  );
}

/* ── Выбор фото: сетка из снимков студии и загрузка нового ── */
function PhotoPicker({
  slug, current, onPick, onBack,
}: {
  slug?: string;
  current: string | null;
  onPick: (src: string) => void;
  onBack: () => void;
}) {
  const lib = photoLibrary(slug);
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [why, setWhy] = useState<string | null>(null);

  const onFile = async (f: File | undefined) => {
    if (!f) return;
    setBusy(true);
    setWhy(null);
    try {
      onPick(await uploadFile(f));
    } catch (e) {
      notify('error');
      setWhy(e instanceof PhotoError ? e.message : 'Не загрузилось — повторите');
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const grid = (photos: typeof lib.mine) => (
    <div className="pe-photos">
      {photos.map((p) => (
        <button
          key={p.src}
          className={`pe-photo${current === p.src ? ' on' : ''}`}
          onClick={() => { tap(); onPick(p.src); }}
          aria-label={p.label}
          aria-pressed={current === p.src}
        >
          <img src={asset(p.thumb)} alt="" loading="lazy" decoding="async" />
          {current === p.src && <span className="pe-photo-tick"><Icon name="check" size={13} strokeWidth={3} /></span>}
        </button>
      ))}
    </div>
  );

  return (
    <div className="pe">
      <button className="pe-back" onClick={onBack}>
        <Icon name="chevron-left" size={16} strokeWidth={2.4} /> К карточке
      </button>

      <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => { void onFile(e.target.files?.[0]); }} />
      <button className="btn btn-primary btn-block" onClick={() => fileRef.current?.click()} disabled={busy}>
        <Icon name="upload" size={16} strokeWidth={2} />
        {busy ? 'Загружаем…' : 'Загрузить свой снимок'}
      </button>
      {why && <p className="form-why" role="alert">{why}</p>}
      <p className="faint pe-hint">
        Снимок сожмётся на телефоне до 1600 px — загрузка занимает секунды.
        Фото клиенток публикуйте только с их письменного согласия.
      </p>

      {lib.mine.length > 0 && (
        <>
          <div className="eyebrow sub-head">Снимки этой процедуры</div>
          {grid(lib.mine)}
        </>
      )}
      {lib.groups.map((g) => (
        <div key={g.id}>
          <div className="eyebrow sub-head">{g.title}</div>
          {grid(g.photos)}
        </div>
      ))}
    </div>
  );
}

function ServiceForm({ existing }: { existing?: WireService }) {
  const initialCat = (existing?.category && existing.category !== 'analysis' ? existing.category : 'care') as Cat;
  const [lang, setLang] = useState<'ru' | 'en'>('ru');
  const [view, setView] = useState<'form' | 'photos'>('form');

  const [title, setTitle] = useState({ ru: existing?.title.ru ?? '', en: existing?.title.en ?? '' });
  const [short, setShort] = useState({ ru: existing?.subtitle?.ru ?? '', en: existing?.subtitle?.en ?? '' });
  const [desc, setDesc] = useState({ ru: existing?.description?.ru ?? '', en: existing?.description?.en ?? '' });
  const [includes, setIncludes] = useState<string[]>(existing?.includes ?? []);
  const [contra, setContra] = useState<string[]>(existing?.contraindications ?? []);
  const [photo, setPhoto] = useState<string | null>(existing?.photo_url ?? null);
  const [category, setCategory] = useState<Cat>(initialCat);
  // Field text, not a number: an empty field of an existing row stays empty and is not sent
  const [lengthText, setLengthText] = useState<string>(() => {
    const v = existing ? (initialCat === 'training' ? existing.days : existing.duration_min) : (initialCat === 'training' ? 1 : 60);
    return v != null ? String(v) : '';
  });
  const [price, setPrice] = useState(
    existing ? (existing.price_minor != null ? minorToInput(existing.price_minor) : '') : '80',
  );
  const [priceFrom, setPriceFrom] = useState<boolean>(existing?.price_from === true);
  // Повтор: пусто = бот не напоминает (клиника интервалов не дала — не выдумываем)
  const [repeatText, setRepeatText] = useState<string>(existing?.repeat_after_days != null ? String(existing.repeat_after_days) : '');
  const repeatDays = repeatText.trim() === '' ? null : Math.round(Number(repeatText));
  const repeatBad = repeatDays !== null && !(repeatDays >= 7 && repeatDays <= 730);
  // The row's currency; a new row — lari, shown on the chips. Another ISO code of an
  // existing row (set through the API) is kept as is: the chips are not shown for it.
  const [currency, setCurrency] = useState<string | null>(existing ? existing.currency || null : 'GEL');
  const askCurrency = !existing || !existing.currency;
  const [slug, setSlug] = useState(existing?.slug ?? '');
  const [slugTouched, setSlugTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [why, setWhy] = useState<string | null>(null);
  /** Один ключ на одну открытую форму — повтор после обрыва не создаст вторую процедуру. */
  const intent = useRef<string>(newIdempotencyKey());

  const training = category === 'training';
  const priceMinor = parseMoneyInput(price);
  const priceEmpty = price.trim() === '';
  const length = /^[0-9]+$/.test(lengthText.trim()) ? Number(lengthText.trim()) : null;
  const lengthEmpty = lengthText.trim() === '';
  const finalSlug = existing ? existing.slug : slugTouched ? slug : slugify(title.ru);
  // A new procedure needs a price and a length; an existing one may leave a field empty —
  // then that field is simply not in the PATCH. A price always goes with its currency.
  const priceOk = priceEmpty ? Boolean(existing) : priceMinor !== null && priceMinor > 0 && currency !== null;
  const lengthOk = lengthEmpty ? Boolean(existing) : length !== null && length > 0;
  const ready = title.ru.trim().length > 1 && priceOk && lengthOk
    && (existing ? true : SLUG_RE.test(finalSlug));
  const sign = currencySign(currency);
  // K13 (F9): the form names why "Save" is off — a price was typed into a row without a currency
  const needCurrency = askCurrency && !priceEmpty && currency === null;

  /* Что видно на обложке прямо сейчас: выбранное или то, что подставит витрина.
     `servicePhoto` знает и то, и другое — но только для процедур, которые уже
     в каталоге, поэтому у новой без выбора обложки нет вовсе. */
  const shownPhoto = photo ?? (existing ? servicePhoto(existing.slug) : null);

  /* K13 (F11): the currency chips are a radio group — arrows move the choice and the focus,
     one chip in the tab order (the chosen one, or the first while none is chosen). */
  const onCurrencyKey = (e: React.KeyboardEvent<HTMLButtonElement>, i: number) => {
    const step = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
    if (step === 0) return;
    e.preventDefault();
    const n = SHOWCASE_CURRENCIES.length;
    const next = (i + step + n) % n;
    setCurrency(SHOWCASE_CURRENCIES[next]);
    const radios = e.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="radio"]');
    radios?.[next]?.focus();
  };

  const same = (a: string[], b: string[]) => a.length === b.length && a.every((x, i) => x === b[i]);

  const save = async () => {
    if (!ready || busy) return;
    setBusy(true);
    setWhy(null);
    try {
      if (existing) {
        const patch: ServicePatch = {};
        if (title.ru.trim() !== existing.title.ru) patch.title_ru = title.ru.trim();
        if (title.en.trim() && title.en.trim() !== existing.title.en) patch.title_en = title.en.trim();
        if (short.ru.trim() !== (existing.subtitle?.ru ?? '')) patch.subtitle_ru = short.ru.trim() || null;
        if (short.en.trim() !== (existing.subtitle?.en ?? '')) patch.subtitle_en = short.en.trim() || null;
        if (desc.ru.trim() !== (existing.description?.ru ?? '')) patch.description_ru = desc.ru.trim() || null;
        if (desc.en.trim() !== (existing.description?.en ?? '')) patch.description_en = desc.en.trim() || null;
        if (!priceEmpty && priceMinor !== null && currency !== null
          && (priceMinor !== existing.price_minor || currency !== (existing.currency || null))) {
          patch.price_minor = priceMinor;
          patch.currency = currency;
        }
        if (!priceEmpty && priceFrom !== (existing.price_from === true)) patch.price_from = priceFrom;
        if (length !== null) {
          if (training) {
            if (length !== existing.days) patch.days = length;
          } else if (length !== existing.duration_min) {
            patch.duration_min = length;
          }
        }
        if (!same(includes, existing.includes ?? [])) patch.includes = includes;
        if (!same(contra, existing.contraindications ?? [])) patch.contraindications = contra;
        if (photo !== (existing.photo_url ?? null)) patch.photo_url = photo;
        if (!repeatBad && repeatDays !== (existing.repeat_after_days ?? null)) patch.repeat_after_days = repeatDays;
        // Пустая правка — 422 `empty_patch`: не шлём, просто закрываем — и так и говорим (K13, F9).
        const changed = Object.keys(patch).length > 0;
        if (changed) {
          const saved = await patchService(existing.slug, patch);
          applyService(saved);
          applyOwnerEdit(saved.slug, saved);
        }
        notify('success');
        closeSheet();
        toast(`${title.ru.trim()} — ${changed ? 'сохранено' : 'без изменений'}`, 'success');
      } else {
        if (priceMinor === null || currency === null || length === null) return;
        const created = await createService({
          slug: finalSlug,
          kind: training ? 'training' : 'procedure',
          category: category as ServiceCategory,
          title_ru: title.ru.trim(),
          ...(title.en.trim() ? { title_en: title.en.trim() } : {}),
          subtitle_ru: short.ru.trim() || null,
          ...(short.en.trim() ? { subtitle_en: short.en.trim() } : {}),
          description_ru: desc.ru.trim() || null,
          ...(desc.en.trim() ? { description_en: desc.en.trim() } : {}),
          price_minor: priceMinor,
          currency,
          price_from: priceFrom,
          ...(training ? { days: length } : { duration_min: length }),
          ...(includes.length ? { includes } : {}),
          ...(contra.length ? { contraindications: contra } : {}),
          ...(photo ? { photo_url: photo } : {}),
          ...(!repeatBad && repeatDays !== null ? { repeat_after_days: repeatDays } : {}),
        }, intent.current);
        refreshServices();
        applyOwnerEdit(created.slug, created);
        notify('success');
        closeSheet();
        toast(`${title.ru.trim()} — в каталоге`, 'success');
      }
    } catch (e) {
      cabinetDenied(e);
      notify('error');
      setWhy(saveErrorText(e));
    } finally {
      setBusy(false);
    }
  };

  if (view === 'photos') {
    return (
      <PhotoPicker
        slug={existing?.slug}
        current={photo}
        onPick={(src) => { setPhoto(src); setView('form'); notify('success'); }}
        onBack={() => setView('form')}
      />
    );
  }

  const L = lang;
  const wasPhoto = existing?.photo_url ?? null;

  return (
    <div className="pe">
      {/* ── Фото ── */}
      <div className="pe-cover">
        {shownPhoto
          ? <img src={asset(shownPhoto)} alt="" className="pe-cover-img" />
          : <div className="pe-cover-empty"><Icon name="image" size={28} strokeWidth={1.5} /><span>Фото не выбрано</span></div>}
        <div className="pe-cover-bar">
          <button className="pe-cover-btn" onClick={() => setView('photos')}>
            <Icon name="image" size={15} strokeWidth={2} /> {shownPhoto ? 'Заменить фото' : 'Выбрать фото'}
          </button>
          {photo !== null && (
            <button className="pe-cover-btn pe-cover-btn--quiet" onClick={() => { setPhoto(wasPhoto !== null && photo !== wasPhoto ? wasPhoto : null); tap(); }}>
              {wasPhoto !== null && photo !== wasPhoto ? 'Отменить замену' : 'Убрать'}
            </button>
          )}
        </div>
      </div>
      {!shownPhoto && <p className="faint pe-hint">Без выбранного фото витрина подставит снимок процедуры сама или покажет знак.</p>}
      {photo === null && existing && servicePhoto(existing.slug) && (
        <p className="faint pe-hint">Сейчас стоит автоматическое фото процедуры.</p>
      )}

      {/* ── Тексты: язык переключается, поля те же ── */}
      <div className="pe-sect">
        <div className="pe-sect-head">
          <span className="eyebrow">Тексты</span>
          <div className="pe-lang" role="tablist" aria-label="Язык текстов">
            {(['ru', 'en'] as const).map((l) => (
              <button key={l} role="tab" aria-selected={lang === l} className={lang === l ? 'on' : ''} onClick={() => setLang(l)}>{l.toUpperCase()}</button>
            ))}
          </div>
        </div>

        <label className="se-field">
          <span>Название {L === 'en' ? '· English' : ''}</span>
          <input value={title[L]} onChange={(e) => setTitle({ ...title, [L]: e.target.value })} placeholder={L === 'ru' ? 'Например: Микротоки' : 'For example: Microcurrent'} maxLength={120} />
        </label>
        <label className="se-field">
          <span>Коротко (под названием)</span>
          <input value={short[L]} onChange={(e) => setShort({ ...short, [L]: e.target.value })} placeholder={L === 'ru' ? 'Аппарат · лифтинг без игл' : 'Device · needle-free lifting'} maxLength={200} />
        </label>
        <label className="se-field">
          <span>Описание</span>
          <textarea className="pe-area" rows={5} value={desc[L]} onChange={(e) => setDesc({ ...desc, [L]: e.target.value })} placeholder={L === 'ru' ? 'Что это за процедура, кому подходит, чего ждать' : 'What the treatment is, who it suits, what to expect'} maxLength={2000} />
        </label>
        {L === 'en' && !title.en.trim() && (
          <p className="faint pe-hint">Пока английского названия нет, англоязычная клиентка увидит русское.</p>
        )}
      </div>

      {!existing && (
        <label className="se-field">
          <span>Адрес в каталоге</span>
          <input
            value={finalSlug}
            onChange={(e) => { setSlugTouched(true); setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 64)); }}
            placeholder="mikrotoki"
            inputMode="url"
          />
        </label>
      )}

      <div className="se-field">
        <span>Направление{existing ? ' · не меняется после создания' : ''}</span>
        <div className="se-cats">
          {categories.filter((c) => c.id !== 'all').map((c) => (
            <button
              key={c.id}
              className={`se-cat${category === c.id ? ' active' : ''}`}
              onClick={() => { if (!existing) setCategory(c.id as Cat); }}
              disabled={Boolean(existing) && category !== c.id}
            >
              <Icon name={c.icon} size={13} strokeWidth={2} />
              {c.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Цена и время ── */}
      <div className="pe-sect">
        <div className="pe-sect-head"><span className="eyebrow">Цена и время</span></div>
        <div className="se-two">
          <label className="se-field">
            <span>{training ? 'Длительность, дней' : 'Длительность, мин'}</span>
            <input type="number" inputMode="numeric" value={lengthText} onChange={(e) => setLengthText(e.target.value)} />
          </label>
          <label className="se-field">
            <span>{sign ? `Цена, ${sign}` : 'Цена'}</span>
            <input inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} />
          </label>
        </div>
        {/* K13 (F9): an emptied price is not sent — the form says so instead of "saved" over nothing */}
        {existing && priceEmpty && (
          <p className="faint" data-testid="price-empty-hint" style={{ fontSize: 12, margin: '-4px 0 10px' }}>
            Если оставить цену пустой, она не изменится.
          </p>
        )}

        <label className="pe-toggle">
          <input type="checkbox" checked={priceFrom} onChange={(e) => setPriceFrom(e.target.checked)} disabled={priceEmpty} />
          <span className="pe-toggle-box" aria-hidden />
          <span className="pe-toggle-text">
            Цена «от»
            <small>Итог врач называет после осмотра: клиентка увидит «от 400 ₾» и пометку про осмотр</small>
          </span>
        </label>

        {!training && (
          <label className="se-field se-repeat">
            <span>Напомнить о повторе через, дней</span>
            <input type="number" inputMode="numeric" value={repeatText} placeholder="не напоминать"
              onChange={(e) => setRepeatText(e.target.value)} aria-invalid={repeatBad || undefined} />
            <small className={repeatBad ? 'form-why' : 'faint'}>
              {repeatBad
                ? 'От 7 до 730 дней — или оставьте пустым'
                : 'Бот напишет клиентке через столько дней после процедуры и предложит свободные окна. Например, ботокс — 120, чистка — 30.'}
            </small>
          </label>
        )}

        {askCurrency && (
          <div className="se-field">
            <span>Валюта</span>
            <div className="se-cats" role="radiogroup" aria-label="Валюта">
              {SHOWCASE_CURRENCIES.map((c: ShowcaseCurrency, i) => (
                <button
                  key={c}
                  role="radio"
                  aria-checked={currency === c}
                  tabIndex={currency === c || (currency === null && i === 0) ? 0 : -1}
                  className={`se-cat${currency === c ? ' active' : ''}`}
                  onClick={() => setCurrency(c)}
                  onKeyDown={(e) => onCurrencyKey(e, i)}
                >
                  {CURRENCY_WORD[c]}
                </button>
              ))}
            </div>
            {needCurrency && (
              <p className="faint" data-testid="currency-hint" style={{ fontSize: 12, margin: '6px 0 0' }}>
                Выбери валюту цены — без неё сохранить нельзя.
              </p>
            )}
          </div>
        )}
      </div>

      {/* ── Состав и противопоказания ── */}
      <div className="pe-sect">
        <div className="pe-sect-head"><span className="eyebrow">Что входит</span></div>
        <ListEditor items={includes} onChange={setIncludes} placeholder="Например: консультация и разметка" addLabel="Добавить пункт" />
      </div>
      <div className="pe-sect">
        <div className="pe-sect-head"><span className="eyebrow">Противопоказания</span></div>
        <ListEditor items={contra} onChange={setContra} placeholder="Например: беременность и лактация" addLabel="Добавить противопоказание" />
        <p className="faint pe-hint">По этому списку приложение сверяет анкету здоровья клиентки. Пока он пуст, сверять не с чем — и клиентка видит «автосверки пока нет».</p>
      </div>

      <div className="pe-preview">
        {shownPhoto
          ? <span className="pe-preview-ph" style={{ backgroundImage: `url(${asset(shownPhoto)})` }} />
          : <span className="pe-preview-ph pe-preview-ph--empty"><Icon name={categories.find((c) => c.id === category)?.icon ?? 'sparkles'} size={18} strokeWidth={1.8} /></span>}
        <div className="pe-preview-body">
          <b>{title.ru.trim() || 'Название процедуры'}</b>
          <span>
            {short.ru.trim() || 'короткое описание'} · {length ?? '—'} {training ? 'дн.' : 'мин'} · {priceMinor !== null ? `${priceFrom ? 'от ' : ''}${formatMoney(priceMinor, currency)}` : '—'}
          </span>
        </div>
      </div>

      {why && <p className="form-why" role="alert">{why}</p>}

      <div className="pe-save">
        <button className="btn btn-primary btn-block" disabled={!ready || busy} onClick={() => { void save(); }}>
          {busy ? 'Сохраняем…' : needCurrency ? 'Выбери валюту' : existing ? 'Сохранить' : ready ? 'Добавить в каталог' : 'Заполни название и цену'}
        </button>
      </div>
    </div>
  );
}

/**
 * Снять с витрины / вернуть. Удаления нет намеренно: на процедуру ссылается
 * история визитов, сервер снимает мягко. «Убрать» — жестом (SwipeRow) с
 * подтверждением, а не кнопкой; кнопка осталась только для «вернуть».
 */
export async function archiveWithUndoable(service: WireService): Promise<void> {
  await archiveService(service.slug);
  applyOwnerEdit(service.slug, null);
  refreshServices();
}

export async function restoreArchived(service: WireService): Promise<void> {
  await restoreService(service.slug);
  // Сервер отвечает только {restored}: строка — из архива кабинета
  // (прочитан с пропуском), она и возвращается на витрину
  applyOwnerEdit(service.slug, service);
  refreshServices();
}
