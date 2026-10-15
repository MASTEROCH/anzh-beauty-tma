// Ответы ассистента. Раньше это были захардкоженные строки-тупики: бот
// рассказывал про филлеры и на этом разговор кончался — записаться можно было
// только вернувшись и пройдя навигацию руками. Теперь ответ знает реальную
// услугу из каталога и несёт кнопки действия, а когда не справляется —
// отдаёт человека Анжелике, а не повторяет «спросите иначе».
//
// Услуги и цены — только из ЗАГРУЖЕННОЙ витрины (lib/catalog.ts →
// liveServices: сервер или его кэш, скрытое с витрины туда не попадает).
// Статический список приложения здесь не читается: из него помощник
// предлагал записаться на снятый с витрины «Приём дерматолога» и называл
// цены, которых на сервере может уже не быть.
//
// Помощник не обещает того, чего сервер не делает: ни баллов, ни уровней,
// ни скидок за отзывы (на запуск скрыты), ни «другого времени» от мастера
// (такого статуса у заявки нет), ни проверки противопоказаний (её делает
// Анжелика, не код).

import { liveServices } from './catalog';
import { durationLabel } from './plural';
import { FROM_SENTENCE, formatAmount, priceUnit, servicePrice } from './money';
import { isPriceMinor } from './showable';
import { isBookable, type Service } from '../data/services';
import { studioAddress, getStudio } from '../data/location';
import { TEAM } from '../data/team';
import { ON_REQUEST, type OnRequestService } from '../data/onRequest';

/* Texts — Katya, T2 ed. 2 §3 ("to the showcase after Anjelika's yes"). The assistant
   speaks Russian only; Katya's lines carry no leading emoji, so the replaced answers
   have none (the untouched ones keep theirs). Prices — lib/money.ts, each in its own
   currency (B1-B): no dollar default, no lari estimate. */

export type AiActionKind = 'service' | 'book' | 'catalog' | 'plan' | 'handoff' | 'passport';

export interface AiAction {
  kind: AiActionKind;
  label: string;
  serviceId?: string;
}

export interface AiReply {
  text: string;
  actions: AiAction[];
}

/** Анжелика принимает вт–сб 09:00–20:00 */
export function clinicOpen(now = new Date()): boolean {
  const day = now.getDay();
  const hour = now.getHours();
  return day >= 2 && day <= 6 && hour >= 9 && hour < 20;
}

export function nextOpening(now = new Date()): string {
  if (clinicOpen(now)) return 'сейчас на связи';
  const day = now.getDay();
  if (day === 0) return 'отвечает со вторника с 09:00';
  if (day === 1) return 'отвечает завтра с 09:00';
  return now.getHours() < 9 ? 'отвечает сегодня с 09:00' : 'отвечает завтра с 09:00';
}

// The price is already in the text — the button carries none (T2 ed. 1 §3.0 p.7)
const bookAction = (s: Service): AiAction => ({ kind: 'book', label: 'Записаться', serviceId: s.id });
const openAction = (s: Service): AiAction => ({ kind: 'service', label: 'Подробнее о процедуре', serviceId: s.id });

/** Процедура витрины по id или undefined — снятой с витрины (или неизвестной) нет. */
const onShowcase = (id: string): Service | undefined => liveServices().find((s) => s.id === id);

/** T2 §3.5: "нет в прайсе" read as "she doesn't do it"; she may — it is just not in the app. */
const NOT_IN_CATALOG = 'Сейчас этой процедуры нет в каталоге приложения — лучше уточнить у Анжелики.';

function notInCatalog(lead: string): AiReply {
  // Not on the showcase — no "book" for what is not there
  return {
    text: lead ? `${lead}\n\n${NOT_IN_CATALOG}` : NOT_IN_CATALOG,
    actions: [
      { kind: 'handoff', label: 'Спросить Анжелику' },
      { kind: 'catalog', label: 'Показать процедуры' },
    ],
  };
}

function describe(s: Service, lead: string): AiReply {
  // T2 §3.0: the subtitle, not the description (up to ~900 characters in a chat bubble);
  // details "{duration} · {price}" — the price line of money.ts, in the row's own currency.
  const details = [durationLabel(s.duration, s.days), servicePrice(s)].filter(Boolean).join(' · ');
  const from = s.priceFrom === true && isBookable(s) ? FROM_SENTENCE.ru : '';
  return {
    text: [lead, s.short, [details, from].filter(Boolean).join('\n')].filter(Boolean).join('\n\n'),
    actions: [bookAction(s), openAction(s)],
  };
}

function aboutService(id: string, lead: string): AiReply {
  const s = onShowcase(id);
  return s ? describe(s, lead) : notInCatalog(lead);
}

/** The first showcase procedure of a category (cleansing, peels, dermatology) — no demo ids. */
function aboutCategory(category: Service['category'], lead: string): AiReply {
  const s = liveServices().find((x) => x.category === category && isBookable(x));
  return s ? describe(s, lead) : notInCatalog(lead);
}

/* Leads — T2 ed. 2 §3.2. The cleansing, peel and acne leads name Maria: they wait for
   her consent to her name and title (Yu2 §3.2, §6 p.15) — until then those answers
   carry no lead. */
const LEAD = {
  contour: 'Анжелика работает с углами нижней челюсти, скулами и подбородком, вытягивает профиль. Обычно — на всё лицо: от 2 мл, максимум 3–4 мл, всё зависит от того, насколько нужна коррекция. Только по показаниям. Начать можно с очного осмотра или онлайн-консультации по твоим фото, окончательное решение — на приёме.',
  fillerDissolve: 'Если филлер в губах мигрировал, образовались комочки, уплотнения или неровности, его можно растворить: точечно или полностью — что подойдёт, решают на осмотре.',
  biorevit: 'Биоревитализация — базовая процедура для увлажнения кожи; её делают и с профилактической целью. Вау-эффекта она не даёт: кожа может стать глаже и увлажнённее, может появиться сияние — насколько заметно, у всех по-разному. Часто нужен курс от двух процедур — зависит от исходного состояния кожи.',
  botulinum: 'Ботулотоксин на время расслабляет мышцы. Анжелика работает с верхней третью лица, флип-лип, мышцей, опускающей углы рта, бруксизмом, гипергидрозом и платизмой. Цена — за единицу препарата, сколько единиц нужно — индивидуально.',
  collagen: 'Коллагеностимуляторы стимулируют выработку собственного коллагена; чаще их делают после 30. Цена зависит от препарата — она в карточке.',
  threads: 'Армирующие мононити — рассасывающиеся нити из поликапролактона или полимолочной кислоты. Цена зависит от зоны.',
  smas: 'SMAS-лифтинг — аппаратная процедура без игл: она уплотняет кожу и стимулирует выработку коллагена.',
  lips: 'Увеличение губ — не только про объём: это и коррекция асимметрии, увлажнение, лёгкая форма и припухлость.',
} as const;

const PRICES_IN_CATALOG: AiReply = {
  text: 'Цены — в каталоге: там прайс, который сейчас действует.',
  actions: [{ kind: 'catalog', label: 'Открыть каталог с ценами' }],
};

/**
 * T2 ed. 2 §3.4: the lowest price only — no "from X to Y" (decision John 06.10, K7): every
 * price may be "from", so the top one is a lower bound too, not a ceiling. The lowest is
 * taken over procedures WITHOUT a unit ("за единицу", "за 1 мл" is not the price of a
 * visit); courses are not procedures (isBookable). Prices are never compared across
 * currencies (B1-B, no conversion): procedures in more than one currency — the plain
 * "prices are in the catalog" answer instead of a minimum.
 */
function pricesReply(): AiReply {
  const plain = liveServices().filter((s) => isBookable(s) && priceUnit(s.id) === null && isPriceMinor(s.priceMinor));
  if (plain.length === 0 || new Set(plain.map((s) => s.currency)).size !== 1) return PRICES_IN_CATALOG;
  const cheapest = plain.reduce((a, b) => (b.priceMinor < a.priceMinor ? b : a));
  return {
    text: `Цены в каталоге начинаются от ${formatAmount(cheapest.priceMinor, cheapest.currency)} (${cheapest.title}). «От» — это минимум: итог зависит от препарата и объёма, его называют после осмотра. Если рядом написано «за единицу» или «за 1 мл» — это цена за единицу измерения, итог зависит от количества.`,
    actions: [{ kind: 'catalog', label: 'Открыть каталог с ценами' }],
  };
}

/** Что делает процедура — для плашек «расскажи про …» в чате: по id, без угадывания по словам. */
const LEAD_BY_ID: Record<string, string> = {
  'contour-plastic': LEAD.contour, 'filler-dissolve': LEAD.fillerDissolve, biorevit: LEAD.biorevit,
  botulinum: LEAD.botulinum, 'collagen-stimulators': LEAD.collagen, 'mono-threads': LEAD.threads,
  'smas-lifting': LEAD.smas, 'lip-filler': LEAD.lips,
};
export function explainProcedure(id: string): AiReply {
  return aboutService(id, LEAD_BY_ID[id] ?? '');
}

/** Услуга «по запросу» (брови, лазер…) — её нет в витрине с ценой, но студия её делает */
function matchOnRequest(q: string): OnRequestService | undefined {
  if (liveServices().length === 0) return undefined;
  let best: { s: OnRequestService; n: number } | undefined;
  for (const s of ON_REQUEST) {
    if (liveServices().some((x) => x.id === s.id)) continue; // уже с ценой — отвечает витрина
    const stems = s.title.toLowerCase().split(/[^a-zа-яё0-9]+/i).filter((w) => w.length >= 4).map((w) => w.slice(0, Math.max(4, w.length - 2)));
    const n = stems.filter((st) => q.includes(st)).length;
    if (n > 0 && (!best || n > best.n)) best = { s, n };
  }
  return best?.s;
}

function onRequestReply(s: OnRequestService): AiReply {
  return {
    text: `«${s.title}» делает ${s.masterName.ru.split(' · ')[0]}. ${s.short}. Цену и свободное время сейчас называет администратор — напишите, и вам ответят в этом же чате.`,
    actions: [{ kind: 'handoff', label: 'Узнать цену и время' }],
  };
}

/** Процедура витрины, чьё название узнаётся в вопросе: по основам слов (≥ 4 букв). */
function matchByTitle(q: string): Service | undefined {
  let best: { s: Service; n: number } | undefined;
  for (const s of liveServices()) {
    if (!isBookable(s)) continue;
    const stems = s.title.toLowerCase().split(/[^a-zа-яё0-9]+/i).filter((w) => w.length >= 4).map((w) => w.slice(0, Math.max(4, w.length - 2)));
    const n = stems.filter((st) => q.includes(st)).length;
    if (n > 0 && (!best || n > best.n)) best = { s, n };
  }
  return best?.s;
}

export function respond(message: string): AiReply {
  const q = message.toLowerCase();

  // Order — T2 §3.0: the refusal first (otherwise "скулы" goes to contouring), then
  // contraindications and prices; filler removal before lips and contouring.
  if (/(ботокс|ботул|botox|жевательн|скул)/.test(q) && /(похуд|худ|уменьш|сузить)/.test(q)) {
    return {
      text: 'Нет: жевательные мышцы Анжелика колет только по показаниям — например, при бруксизме, когда человек скрипит или сжимает зубами, чаще ночью. Ботулинотерапию ради похудения лица она не делает. Если хочешь поработать с формой лица, для этого у нас есть другие процедуры — обсуди это с Анжеликой.',
      actions: [
        { kind: 'handoff', label: 'Написать Анжелике' },
        { kind: 'catalog', label: 'Показать процедуры' },
      ],
    };
  }

  if (/(аллерг|лидокаин|реакц|противопоказ|беремен|лактац|кормл)/.test(q)) {
    return {
      text: 'У процедур есть противопоказания. Анжелика проверит их на приёме — и по анкете здоровья, если она заполнена. Если есть особый случай или вопрос, напиши Анжелике.',
      actions: [
        { kind: 'passport', label: 'Заполнить паспорт здоровья' },
        { kind: 'handoff', label: 'Спросить Анжелику лично' },
      ],
    };
  }


  // ── Скриптованные ответы без обращения к модели ─────────────────────────
  // Всё, что отвечается данными приложения (часы, команда, каналы, валюта,
  // порядок записи), отвечается здесь, а не нейросетью: быстрее, бесплатно и
  // не расходится с тем, что студия сама задала в кабинете.
  if (/^\s*(привет|здравств|добр(ый|ое|ого)|hello|hi\b|хай|салам)/.test(q) && q.length < 40) {
    return {
      text: 'Здравствуйте 💛 Я ANZH — помощник студии. Могу рассказать про любую процедуру, цены, адрес, порядок записи. Выберите процедуру внизу или задайте вопрос.',
      actions: [{ kind: 'catalog', label: 'Открыть каталог' }],
    };
  }

  if (/(что (ты )?умеешь|чем (ты )?(можешь )?помочь|что можешь|помощь|help)/.test(q)) {
    return {
      text: 'Я знаю процедуры студии: что делает каждая, сколько длится и стоит. Подскажу адрес, часы работы, как записаться и отменить запись, как связаться с командой. Если вопрос про вашу кожу или здоровье — передам администратору: такое решает врач на осмотре.',
      actions: [{ kind: 'catalog', label: 'Показать процедуры' }, { kind: 'handoff', label: 'Написать администратору' }],
    };
  }

  if (/(живой|человек|оператор|админ|менеджер|позови|соедини|связаться|связь)/.test(q) && !/(процедур|цен)/.test(q)) {
    return {
      text: 'Конечно. Администратор отвечает здесь же, в чате, и в других каналах студии — выберите удобный.',
      actions: [{ kind: 'handoff', label: 'Написать администратору' }],
    };
  }

  if (/(кто (у вас|работает|мастер|врач|принимает)|мастер(а|ов)?\b|команд|специалист|врачи|доктор)/.test(q) && !/(процедур|цен|стоим)/.test(q)) {
    const lines = TEAM.map((m) => `· ${m.name.ru} — ${m.role.ru.toLowerCase()}`).join('\n');
    return {
      text: `В студии работают:\n${lines}\n\nФото и подробности — в разделе «О нас», блок «Команда»: нажмите на фото человека.`,
      actions: [{ kind: 'catalog', label: 'Процедуры по мастерам' }],
    };
  }

  if (/(график|режим работы|часы работы|до скольки|во сколько (откры|закры)|выходн|работаете|работает студия|открыт)/.test(q)) {
    const st = getStudio();
    return {
      text: `Студия работает: ${st.hours.ru}. ${clinicOpen() ? 'Сейчас открыто.' : `Сейчас закрыто — администратор ${nextOpening()}.`} Записаться можно в любое время: заявка дождётся утра.`,
      actions: [{ kind: 'book', label: 'Выбрать время' }],
    };
  }

  if (/(как (записать|запис)|как оформить|как попасть|записаться как)/.test(q)) {
    return {
      text: 'Запись в четыре шага: 1) выберите процедуру в каталоге; 2) выберите день и время; 3) отправьте заявку; 4) администратор подтверждает её, ответ появится в «Паспорте». Пока заявку не подтвердили, вы ничего не теряете.',
      actions: [{ kind: 'catalog', label: 'Выбрать процедуру' }, { kind: 'book', label: 'Сразу к записи' }],
    };
  }

  if (/(валют|лари|доллар|в gel|в usd|курс|переключ.*цен|цены в)/.test(q)) {
    return {
      text: 'Цены можно смотреть в лари и в долларах: переключатель — пилюля вверху справа на экранах каталога и записи. Доллары пересчитываются по курсу Нацбанка Грузии на сегодня, поэтому рядом стоит «≈». Итог визита всегда фиксируется в валюте процедуры.',
      actions: [{ kind: 'catalog', label: 'Открыть каталог' }],
    };
  }

  if (/(инстаграм|instagram|телеграм|telegram|ватсап|whatsapp|вацап|телефон|позвонить|номер)/.test(q)) {
    return {
      text: 'Связаться можно в чате с администратором — вкладка «Администратор» здесь же: там Telegram, Instagram и другие каналы, которые студия включила.',
      actions: [{ kind: 'handoff', label: 'Открыть связь' }],
    };
  }

  if (/(язык|english|по-английски|на английском)/.test(q)) {
    return {
      text: 'Приложение есть на русском и английском: язык переключается пилюлей RU/EN вверху справа. Чат помощника отвечает по-русски; администратор — на русском и английском.',
      actions: [],
    };
  }

  // Цена конкретной процедуры — ответ про неё, а не общий «от 100 ₾»
  const named = matchByTitle(q);
  const ask = matchOnRequest(q);
  if (ask) return onRequestReply(ask);
  if (named && /(цен|стоим|сколько|прайс)/.test(q)) return describe(named, '');

  // Только процедуры витрины: обучение — не визит (isBookable, по kind), скрытое — не предлагаем
  if (/(цен|стоим|сколько|прайс|деньг)/.test(q)) return pricesReply();

  // Training (T2 §3.6) — before the procedure rules ("обучение ботоксу" is not a booking)
  // and before "курс / план", which would answer "I can build a plan".
  if (/(обуч|учиться|курс для врач|курсы для врач)/.test(q)) {
    return {
      text: 'Анжелика проводит обучение для специалистов с медицинским образованием: с нуля она не обучает. Курсы — в каталоге, в разделе «Обучение». Записаться на курс в приложении нельзя, но можно написать Анжелике.',
      actions: [
        { kind: 'catalog', label: 'Открыть каталог' },
        { kind: 'handoff', label: 'Написать Анжелике' },
      ],
    };
  }

  if (/(удал|раствор)/.test(q) && /филлер/.test(q)) return aboutService('filler-dissolve', LEAD.fillerDissolve);
  if (/(губ|объём|объем)/.test(q)) return aboutService('lip-filler', LEAD.lips);
  if (/(конт|пласт|скул|подбород|челюст|филлер)/.test(q)) return aboutService('contour-plastic', LEAD.contour);
  if (/(биорев|увлажн|сухост|сияни|тускл)/.test(q)) return aboutService('biorevit', LEAD.biorevit);
  if (/(ботокс|ботул|botox|бруксизм|гипергидроз|флип|платизм)/.test(q)) return aboutService('botulinum', LEAD.botulinum);
  if (/коллаген/.test(q)) return aboutService('collagen-stimulators', LEAD.collagen);
  if (/(мононит|нити|нить|нитей)/.test(q)) return aboutService('mono-threads', LEAD.threads);
  if (/(smas|смас|лифтинг|подтяжк|аппарат)/.test(q)) return aboutService('smas-lifting', LEAD.smas);
  // Cleansing, peels, acne — by category: no demo ids, and no lead until Maria's consent
  if (/(чистк|почист|поры|чёрные точки|черные точки)/.test(q)) return aboutCategory('clean', '');
  if (/(пилинг|кисло|пигмент)/.test(q)) return aboutCategory('peel', '');
  if (/(акне|воспал|прыщ|рубц|рубец)/.test(q)) return aboutCategory('derma', '');

  if (/(курс|план|последовател|что после|порядок|этап)/.test(q)) {
    return {
      text: '🗺 Могу собрать план: отмечаешь сердечком процедуры, которые хочешь, а я выстраиваю их в правильном порядке — сначала подготовка кожи, потом пилинги и аппарат, инъекции последними, с нужными интервалами.',
      actions: [
        { kind: 'plan', label: 'Собрать план процедур' },
        { kind: 'catalog', label: 'Выбрать процедуры' },
      ],
    };
  }

  if (/(адрес|где|как добра|кабинет|метро|парков)/.test(q)) {
    return {
      text: `📍 ${studioAddress('ru')}. Карта с меткой — в разделе «О нас», «Где найти».`,
      actions: [{ kind: 'book', label: 'Выбрать время' }],
    };
  }

  if (/(запис|слот|свободн|когда|время|приём|прием)/.test(q)) {
    /* Часы и «предложит другое время» отсюда сняты: свободное время знает
       только сервер (GET /slots), а статуса «другое время» у заявки нет —
       мастер её подтверждает или отклоняет. */
    return {
      text: '📅 Свободное время видно при записи — его показывает расписание. Выбираешь время — заявка уходит Анжелике, она подтверждает или отклоняет. Ответ появится в «Паспорте»; если бот запущен, придёт и сообщение.',
      actions: [{ kind: 'book', label: 'Выбрать время' }],
    };
  }

  if (/(депоз|отмен|перенес|перенос|опозда)/.test(q)) {
    return {
      text: '📋 Отменить заявку можно в «Паспорте», пока визит не прошёл. Перенести — напиши Анжелике. Заявка — не бронь: пока Анжелика не подтвердила, ты ничего не теряешь.',
      actions: [{ kind: 'handoff', label: 'Написать Анжелике' }],
    };
  }

  if (/(балл|лояльн|скидк|бонус|кэшбэк|кешбэк|реферал|подруг)/.test(q)) {
    // Баллы, уровни и скидки на запуск скрыты (решение John 24.09): не обещаем
    return {
      text: '⭐ Баллов, уровней и скидок за визиты и отзывы сейчас нет — цена в каталоге и есть цена процедуры. Ссылка-приглашение для подруги есть в «Паспорте»; бонусов за приглашение пока нет.',
      actions: [{ kind: 'catalog', label: 'Открыть каталог с ценами' }],
    };
  }

  if (/(уход|крем|домашн|космет|сыворот)/.test(q)) {
    return {
      text: '🧴 Домашний уход Анжелика подбирает под твою кожу после процедуры — чтобы результат держался дольше. Что именно, зависит от типа кожи и того, что делали.',
      actions: [{ kind: 'handoff', label: 'Спросить про уход' }],
    };
  }

  if (/(спасиб|благодар|круто|супер|класс)/.test(q)) {
    return { text: 'Рада помочь 💛 Если что-то ещё — спрашивай, я всегда тут.', actions: [] };
  }

  // Название процедуры в вопросе («расскажи про лазер») — без нейросети, по словам из каталога
  const hit = matchByTitle(q);
  if (hit) return describe(hit, '');

  return {
    text: 'Тут я лучше не буду угадывать — спрошу Анжелику, она ответит точно. А пока могу показать процедуры, цены или свободное время.',
    actions: [
      { kind: 'handoff', label: 'Передать Анжелике' },
      { kind: 'catalog', label: 'Показать процедуры' },
    ],
  };
}
