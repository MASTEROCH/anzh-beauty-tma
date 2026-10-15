import { useRef, useState } from 'react';
import { Icon } from './Icon';
import { closeSheet, openSheet, toast } from '../lib/ui';
import { notify } from '../lib/haptics';
import { categories, type Service } from '../data/services';
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

/* Правка прайса ходит в сервер через lib/api/staff.ts (проверено Ф-5:
   прежние addService/archiveService/restoreService из lib/catalog.ts
   пустые, и их здесь нет). После каждой удачной правки витрина клиентки на
   этом телефоне (lib/catalog.ts, отдельная копия GET /services) получает
   строку из ОТВЕТА сервера — не перечитывается: без пропуска GET /services
   край Vercel до 30 с отдаёт прежний прайс (Хейтер, волна 4). Списки самого
   кабинета читаются с пропуском и перечитываются (refreshServices). */

// Процедура в прайсе владелицы: завести (POST /services), поправить
// (PATCH /services/{slug}), снять с витрины и вернуть (DELETE, /restore).
// Всё — на сервере; на устройстве ничего не хранится.
//
// Минимум полей — ровно те, без которых услугу нельзя ни показать, ни
// записать: название, направление, длительность и цена. Остальное
// («что входит», противопоказания) добавляется потом и пустым не ломает
// ни один экран.
//
// M-5 (owner's decision 06.10, "1-a"): the price lives in the row's OWN currency —
// GEL or USD — on screen and on the wire (`price_minor` + `currency`); no default
// dollar, no conversion. A new procedure picks its currency (lari preselected and
// visible, not silent); an existing one is edited in its currency, and a row without
// one asks for it before a price goes out. An empty field is not sent in a PATCH:
// no invented 80 / 60 min / 1 day lands on a row that had none.

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

function saveErrorText(e: unknown): string {
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
    title: existing ? 'Процедура' : 'Новая процедура',
    subtitle: existing ? existing.title.ru : 'Появится в каталоге сразу после сохранения',
    body: <ServiceForm existing={existing} />,
  });
}

function ServiceForm({ existing }: { existing?: WireService }) {
  const initialCat = (existing?.category && existing.category !== 'analysis' ? existing.category : 'care') as Cat;
  const [title, setTitle] = useState(existing?.title.ru ?? '');
  const [short, setShort] = useState(existing?.subtitle?.ru ?? '');
  const [category, setCategory] = useState<Cat>(initialCat);
  // Field text, not a number: an empty field of an existing row stays empty and is not sent
  const [lengthText, setLengthText] = useState<string>(() => {
    const v = existing ? (initialCat === 'training' ? existing.days : existing.duration_min) : (initialCat === 'training' ? 1 : 60);
    return v != null ? String(v) : '';
  });
  const [price, setPrice] = useState(
    existing ? (existing.price_minor != null ? minorToInput(existing.price_minor) : '') : '80',
  );
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
  const finalSlug = existing ? existing.slug : slugTouched ? slug : slugify(title);
  // A new procedure needs a price and a length; an existing one may leave a field empty —
  // then that field is simply not in the PATCH. A price always goes with its currency.
  const priceOk = priceEmpty ? Boolean(existing) : priceMinor !== null && priceMinor > 0 && currency !== null;
  const lengthOk = lengthEmpty ? Boolean(existing) : length !== null && length > 0;
  const ready = title.trim().length > 1 && priceOk && lengthOk
    && (existing ? true : SLUG_RE.test(finalSlug));
  const sign = currencySign(currency);
  // K13 (F9): the form names why "Save" is off — a price was typed into a row without a currency
  const needCurrency = askCurrency && !priceEmpty && currency === null;

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

  const save = async () => {
    if (!ready || busy) return;
    setBusy(true);
    setWhy(null);
    try {
      if (existing) {
        const patch: ServicePatch = {};
        if (title.trim() !== existing.title.ru) patch.title_ru = title.trim();
        if (short.trim() !== (existing.subtitle?.ru ?? '')) patch.subtitle_ru = short.trim() || null;
        if (!priceEmpty && priceMinor !== null && currency !== null
          && (priceMinor !== existing.price_minor || currency !== (existing.currency || null))) {
          patch.price_minor = priceMinor;
          patch.currency = currency;
        }
        if (length !== null) {
          if (training) {
            if (length !== existing.days) patch.days = length;
          } else if (length !== existing.duration_min) {
            patch.duration_min = length;
          }
        }
        // Пустая правка — 422 `empty_patch`: не шлём, просто закрываем — и так и говорим (K13, F9).
        const changed = Object.keys(patch).length > 0;
        if (changed) {
          const saved = await patchService(existing.slug, patch);
          applyService(saved);
          applyOwnerEdit(saved.slug, saved);
        }
        notify('success');
        closeSheet();
        toast(`${title.trim()} — ${changed ? 'сохранено' : 'без изменений'}`, 'success');
      } else {
        if (priceMinor === null || currency === null || length === null) return;
        const created = await createService({
          slug: finalSlug,
          kind: training ? 'training' : 'procedure',
          category: category as ServiceCategory,
          title_ru: title.trim(),
          subtitle_ru: short.trim() || null,
          price_minor: priceMinor,
          currency,
          ...(training ? { days: length } : { duration_min: length }),
        }, intent.current);
        refreshServices();
        applyOwnerEdit(created.slug, created);
        notify('success');
        closeSheet();
        toast(`${title.trim()} — в каталоге`, 'success');
      }
    } catch (e) {
      cabinetDenied(e);
      notify('error');
      setWhy(saveErrorText(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="se">
      <label className="se-field">
        <span>Название</span>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Например: Микротоки" maxLength={120} autoFocus />
      </label>

      <label className="se-field">
        <span>Короткое описание</span>
        <input value={short} onChange={(e) => setShort(e.target.value)} placeholder="Аппарат · лифтинг без игл" maxLength={200} />
      </label>

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
        <span>Направление</span>
        <div className="se-cats">
          {categories.filter((c) => c.id !== 'all').map((c) => (
            <button
              key={c.id}
              className={`se-cat${category === c.id ? ' active' : ''}`}
              onClick={() => setCategory(c.id as Cat)}
            >
              <Icon name={c.icon} size={13} strokeWidth={2} />
              {c.label}
            </button>
          ))}
        </div>
      </div>

      <div className="se-two">
        <label className="se-field">
          <span>{training ? 'Длительность, дней' : 'Длительность, мин'}</span>
          <input
            type="number"
            inputMode="numeric"
            value={lengthText}
            onChange={(e) => setLengthText(e.target.value)}
          />
        </label>
        <label className="se-field">
          <span>{sign ? `Цена, ${sign}` : 'Цена'}</span>
          <input
            inputMode="decimal"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
          />
        </label>
      </div>
      {/* K13 (F9): an emptied price is not sent — the form says so instead of "saved" over nothing */}
      {existing && priceEmpty && (
        <p className="faint" data-testid="price-empty-hint" style={{ fontSize: 12, margin: '-4px 0 10px' }}>
          Если оставить цену пустой, она не изменится.
        </p>
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

      <div className="se-preview">
        <Icon name={categories.find((c) => c.id === category)?.icon ?? 'sparkles'} size={18} strokeWidth={1.8} />
        <div>
          <b>{title.trim() || 'Название процедуры'}</b>
          <span>
            {short.trim() || 'короткое описание'} · {length ?? '—'} {training ? 'дн.' : 'мин'} · {priceMinor !== null ? formatMoney(priceMinor, currency) : '—'}
          </span>
        </div>
      </div>

      {why && <p className="form-why" role="alert">{why}</p>}

      <button className="btn btn-primary btn-block" disabled={!ready || busy} onClick={() => { void save(); }} style={{ marginTop: 14 }}>
        {busy ? 'Сохраняем…' : needCurrency ? 'Выбери валюту' : existing ? 'Сохранить' : ready ? 'Добавить в каталог' : 'Заполни название и цену'}
      </button>
    </div>
  );
}

/**
 * Снять с витрины / вернуть. Удаления нет намеренно: на процедуру ссылается
 * история визитов, сервер снимает мягко.
 */
export function ArchiveButton({ service, archived }: { service: WireService; archived: boolean }) {
  const [busy, setBusy] = useState(false);
  const title = service.title.ru;
  return (
    <button
      className={`se-arch${archived ? ' on' : ''}`}
      aria-label={archived ? `Вернуть в каталог: ${title}` : `Убрать из каталога: ${title}`}
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          if (archived) {
            await restoreService(service.slug);
            // Сервер отвечает только {restored}: строка — из архива кабинета
            // (прочитан с пропуском), она и возвращается на витрину
            applyOwnerEdit(service.slug, service);
            toast(`${title} — снова в каталоге`, 'success');
          } else {
            await archiveService(service.slug);
            applyOwnerEdit(service.slug, null);
            toast(`${title} скрыта — история визитов сохранена`);
          }
          refreshServices();
        } catch (e) {
          cabinetDenied(e);
          toast(saveErrorText(e));
        } finally {
          setBusy(false);
        }
      }}
    >
      <Icon name={archived ? 'plus' : 'x'} size={14} strokeWidth={2.4} />
    </button>
  );
}
