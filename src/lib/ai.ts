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
import { isBookable, sShort, sTitle, type Service } from '../data/services';
import { getLang } from './i18n';
import { studioAddress, getStudio } from '../data/location';
import { TEAM } from '../data/team';
import { ON_REQUEST, type OnRequestService } from '../data/onRequest';

/** Ответ на языке интерфейса (Роч 15.10: «тут вообще ничего не переведено»). */
const en = () => getLang() === 'en';
const L = (ru: string, enText: string) => (en() ? enText : ru);

/* Texts — Katya, T2 ed. 2 §3 ("to the showcase after Anjelika's yes"). The assistant
   speaks the interface language (RU/EN); Katya's lines carry no leading emoji, so the replaced answers
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
  if (clinicOpen(now)) return L('сейчас на связи', 'online now');
  const day = now.getDay();
  if (day === 0) return L('отвечает со вторника с 09:00', 'replies from Tuesday, 09:00');
  if (day === 1) return L('отвечает завтра с 09:00', 'replies tomorrow from 09:00');
  return now.getHours() < 9 ? L('отвечает сегодня с 09:00', 'replies today from 09:00') : L('отвечает завтра с 09:00', 'replies tomorrow from 09:00');
}

// The price is already in the text — the button carries none (T2 ed. 1 §3.0 p.7)
const bookAction = (s: Service): AiAction => ({ kind: 'book', label: L('Записаться', 'Book'), serviceId: s.id });
const openAction = (s: Service): AiAction => ({ kind: 'service', label: L('Подробнее о процедуре', 'About the treatment'), serviceId: s.id });

/** Процедура витрины по id или undefined — снятой с витрины (или неизвестной) нет. */
const onShowcase = (id: string): Service | undefined => liveServices().find((s) => s.id === id);

/** T2 §3.5: "нет в прайсе" read as "she doesn't do it"; she may — it is just not in the app. */
const notInCatalogText = () => L('Сейчас этой процедуры нет в каталоге приложения — лучше уточнить у Анжелики.', 'This treatment isn’t in the app catalog right now — best to ask Anjelika.');

function notInCatalog(lead: string): AiReply {
  // Not on the showcase — no "book" for what is not there
  return {
    text: lead ? `${lead}\n\n${notInCatalogText()}` : notInCatalogText(),
    actions: [
      { kind: 'handoff', label: L('Спросить Анжелику', 'Ask Anjelika') },
      { kind: 'catalog', label: L('Показать процедуры', 'Show treatments') },
    ],
  };
}

function describe(s: Service, lead: string): AiReply {
  // T2 §3.0: the subtitle, not the description (up to ~900 characters in a chat bubble);
  // details "{duration} · {price}" — the price line of money.ts, in the row's own currency.
  const lang = en() ? 'en' : 'ru';
  const details = [durationLabel(s.duration, s.days, lang), servicePrice(s, lang)].filter(Boolean).join(' · ');
  const from = s.priceFrom === true && isBookable(s) ? FROM_SENTENCE[lang] : '';
  return {
    text: [lead, sShort(s, lang), [details, from].filter(Boolean).join('\n')].filter(Boolean).join('\n\n'),
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
const LEAD_RU = {
  contour: 'Анжелика работает с углами нижней челюсти, скулами и подбородком, вытягивает профиль. Обычно — на всё лицо: от 2 мл, максимум 3–4 мл, всё зависит от того, насколько нужна коррекция. Только по показаниям. Начать можно с очного осмотра или онлайн-консультации по твоим фото, окончательное решение — на приёме.',
  fillerDissolve: 'Если филлер в губах мигрировал, образовались комочки, уплотнения или неровности, его можно растворить: точечно или полностью — что подойдёт, решают на осмотре.',
  biorevit: 'Биоревитализация — базовая процедура для увлажнения кожи; её делают и с профилактической целью. Вау-эффекта она не даёт: кожа может стать глаже и увлажнённее, может появиться сияние — насколько заметно, у всех по-разному. Часто нужен курс от двух процедур — зависит от исходного состояния кожи.',
  botulinum: 'Ботулотоксин на время расслабляет мышцы. Анжелика работает с верхней третью лица, флип-лип, мышцей, опускающей углы рта, бруксизмом, гипергидрозом и платизмой. Цена — за единицу препарата, сколько единиц нужно — индивидуально.',
  collagen: 'Коллагеностимуляторы стимулируют выработку собственного коллагена; чаще их делают после 30. Цена зависит от препарата — она в карточке.',
  threads: 'Армирующие мононити — рассасывающиеся нити из поликапролактона или полимолочной кислоты. Цена зависит от зоны.',
  smas: 'SMAS-лифтинг — аппаратная процедура без игл: она уплотняет кожу и стимулирует выработку коллагена.',
  lips: 'Увеличение губ — не только про объём: это и коррекция асимметрии, увлажнение, лёгкая форма и припухлость.',
};
const LEAD_EN: typeof LEAD_RU = {
  contour: 'Anjelika works on the jaw angles, cheekbones and chin to define the profile. Usually the whole face: from 2 ml, 3–4 ml at most, depending on how much correction is needed. Only when indicated. You can start with an in-person exam or an online consultation from your photos; the final decision is made at the appointment.',
  fillerDissolve: 'If lip filler has migrated or left lumps, hard spots or unevenness, it can be dissolved — partly or fully; the exam decides which.',
  biorevit: 'Biorevitalization is a basic hydration treatment, also done preventively. It has no “wow” effect: skin may become smoother and more hydrated, with some glow — how visible varies. Often a course of two or more sessions is needed, depending on the skin.',
  botulinum: 'Botulinum toxin temporarily relaxes muscles. Anjelika treats the upper face, lip flip, the mouth-corner depressor, bruxism, hyperhidrosis and platysma. The price is per unit; how many units you need is individual.',
  collagen: 'Collagen stimulators boost your own collagen production; most often done after 30. The price depends on the product — see the card.',
  threads: 'Reinforcing mono threads are absorbable polycaprolactone or polylactic acid threads. The price depends on the area.',
  smas: 'SMAS lifting is a needle-free device treatment: it firms the skin and stimulates collagen.',
  lips: 'Lip enhancement isn’t only about volume: it also corrects asymmetry, hydrates, and adds a soft shape and fullness.',
};
const LEAD = new Proxy(LEAD_RU, { get: (_t, k: keyof typeof LEAD_RU) => (en() ? LEAD_EN : LEAD_RU)[k] }) as typeof LEAD_RU;

const pricesInCatalog = (): AiReply => ({
  text: L('Цены — в каталоге: там прайс, который сейчас действует.', 'Prices are in the catalog — that’s the current price list.'),
  actions: [{ kind: 'catalog', label: L('Открыть каталог с ценами', 'Open the price list') }],
});

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
  if (plain.length === 0 || new Set(plain.map((s) => s.currency)).size !== 1) return pricesInCatalog();
  const cheapest = plain.reduce((a, b) => (b.priceMinor < a.priceMinor ? b : a));
  return {
    text: L(
      `Цены в каталоге начинаются от ${formatAmount(cheapest.priceMinor, cheapest.currency)} (${sTitle(cheapest, 'ru')}). «От» — это минимум: итог зависит от препарата и объёма, его называют после осмотра. Если рядом написано «за единицу» или «за 1 мл» — это цена за единицу измерения, итог зависит от количества.`,
      `Prices in the catalog start from ${formatAmount(cheapest.priceMinor, cheapest.currency)} (${sTitle(cheapest, 'en')}). “From” is the minimum: the total depends on the product and amount and is set after the exam. “Per unit” or “per 1 ml” means a price per unit — the total depends on the quantity.`,
    ),
    actions: [{ kind: 'catalog', label: L('Открыть каталог с ценами', 'Open the price list') }],
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
    text: L(
      `«${s.title}» делает ${s.masterName.ru.split(' · ')[0]}. ${s.short}. Цену и свободное время сейчас называет администратор — напишите, и вам ответят в этом же чате.`,
      `“${s.titleEn}” is done by ${s.masterName.en.split(' · ')[0]}. ${s.shortEn}. The admin gives the price and free time — write, and you’ll get the answer in this chat.`,
    ),
    actions: [{ kind: 'handoff', label: L('Узнать цену и время', 'Ask price and time') }],
  };
}

/** Процедура витрины, чьё название узнаётся в вопросе: по основам слов (≥ 4 букв). */
function matchByTitle(q: string): Service | undefined {
  let best: { s: Service; n: number } | undefined;
  for (const s of liveServices()) {
    if (!isBookable(s)) continue;
    const stems = `${s.title} ${sTitle(s, 'en')}`.toLowerCase().split(/[^a-zа-яё0-9]+/i).filter((w) => w.length >= 4).map((w) => w.slice(0, Math.max(4, w.length - 2)));
    const n = stems.filter((st) => q.includes(st)).length;
    if (n > 0 && (!best || n > best.n)) best = { s, n };
  }
  return best?.s;
}

export function respond(message: string): AiReply {
  const q = message.toLowerCase();

  // Order — T2 §3.0: the refusal first (otherwise "скулы" goes to contouring), then
  // contraindications and prices; filler removal before lips and contouring.
  if (/(ботокс|ботул|botox|жевательн|скул|masseter|jaw)/.test(q) && /(похуд|худ|уменьш|сузить|slim|thin)/.test(q)) {
    return {
      text: L('Нет: жевательные мышцы Анжелика колет только по показаниям — например, при бруксизме, когда человек скрипит или сжимает зубами, чаще ночью. Ботулинотерапию ради похудения лица она не делает. Если хочешь поработать с формой лица, для этого у нас есть другие процедуры — обсуди это с Анжеликой.',
        'No: Anjelika treats the masseter only when indicated — for example bruxism, when someone grinds or clenches their teeth, usually at night. She doesn’t do botulinum therapy to slim the face. For face shape there are other treatments — discuss it with Anjelika.'),
      actions: [
        { kind: 'handoff', label: L('Написать Анжелике', 'Message Anjelika') },
        { kind: 'catalog', label: L('Показать процедуры', 'Show treatments') },
      ],
    };
  }

  if (/(аллерг|лидокаин|реакц|противопоказ|беремен|лактац|кормл|allerg|lidocaine|contraindic|pregnan|breastfeed)/.test(q)) {
    return {
      text: L('У процедур есть противопоказания. Анжелика проверит их на приёме — и по анкете здоровья, если она заполнена. Если есть особый случай или вопрос, напиши Анжелике.',
        'Treatments have contraindications. Anjelika checks them at the visit — and from your health form, if you’ve filled it in. For a special case or a question, message Anjelika.'),
      actions: [
        { kind: 'passport', label: L('Заполнить паспорт здоровья', 'Fill in the health form') },
        { kind: 'handoff', label: L('Спросить Анжелику лично', 'Ask Anjelika directly') },
      ],
    };
  }


  // ── Скриптованные ответы без обращения к модели ─────────────────────────
  // Всё, что отвечается данными приложения (часы, команда, каналы, валюта,
  // порядок записи), отвечается здесь, а не нейросетью: быстрее, бесплатно и
  // не расходится с тем, что студия сама задала в кабинете.
  if (/^\s*(привет|здравств|добр(ый|ое|ого)|hello|hi\b|hey|good (morning|afternoon|evening)|хай|салам)/.test(q) && q.length < 40) {
    return {
      text: L('Здравствуйте 💛 Я ANZH — помощник студии. Могу рассказать про любую процедуру, цены, адрес, порядок записи. Выберите процедуру внизу или задайте вопрос.',
        'Hello 💛 I’m ANZH, the studio assistant. I can tell you about any treatment, prices, the address and how booking works. Pick a treatment below or ask a question.'),
      actions: [{ kind: 'catalog', label: L('Открыть каталог', 'Open the catalog') }],
    };
  }

  if (/(что (ты )?умеешь|чем (ты )?(можешь )?помочь|что можешь|помощь|help|what can you)/.test(q)) {
    return {
      text: L('Я знаю процедуры студии: что делает каждая, сколько длится и стоит. Подскажу адрес, часы работы, как записаться и отменить запись, как связаться с командой. Если вопрос про вашу кожу или здоровье — передам администратору: такое решает врач на осмотре.',
        'I know the studio’s treatments: what each does, how long it takes and what it costs. I can give the address, hours, how to book or cancel, and how to reach the team. Questions about your skin or health go to the admin — a doctor decides those at the exam.'),
      actions: [{ kind: 'catalog', label: L('Показать процедуры', 'Show treatments') }, { kind: 'handoff', label: L('Написать администратору', 'Message the admin') }],
    };
  }

  if (/(живой|человек|оператор|админ|менеджер|позови|соедини|связаться|связь|human|person|operator|admin|manager|contact)/.test(q) && !/(процедур|цен|price|treatment)/.test(q)) {
    return {
      text: L('Конечно. Администратор отвечает здесь же, в чате, и в других каналах студии — выберите удобный.', 'Of course. The admin replies right here in the chat and in the studio’s other channels — pick whichever suits you.'),
      actions: [{ kind: 'handoff', label: L('Написать администратору', 'Message the admin') }],
    };
  }

  if (/(кто (у вас|работает|мастер|врач|принимает)|мастер(а|ов)?\b|команд|специалист|врачи|доктор|team|who works|doctor|specialist)/.test(q) && !/(процедур|цен|стоим|price|cost)/.test(q)) {
    const lng = en() ? 'en' : 'ru';
    const lines = TEAM.map((m) => `· ${m.name[lng]} — ${m.role[lng].toLowerCase()}`).join('\n');
    return {
      text: L(`В студии работают:\n${lines}\n\nФото и подробности — в разделе «О нас», блок «Команда»: нажмите на фото человека.`,
        `The studio team:\n${lines}\n\nPhotos and details are in “About”, the “Team” block — tap a person’s photo.`),
      actions: [{ kind: 'catalog', label: L('Процедуры по мастерам', 'Treatments by specialist') }],
    };
  }

  if (/(график|режим работы|часы работы|до скольки|во сколько (откры|закры)|выходн|работаете|работает студия|открыт|hours|open|opening|closed)/.test(q)) {
    const st = getStudio();
    return {
      text: L(`Студия работает: ${st.hours.ru}. ${clinicOpen() ? 'Сейчас открыто.' : `Сейчас закрыто — администратор ${nextOpening()}.`} Записаться можно в любое время: заявка дождётся утра.`,
        `Studio hours: ${st.hours.en}. ${clinicOpen() ? 'Open now.' : `Closed now — the admin ${nextOpening()}.`} You can book any time: the request waits until morning.`),
      actions: [{ kind: 'book', label: L('Выбрать время', 'Pick a time') }],
    };
  }

  if (/(как (записать|запис)|как оформить|как попасть|записаться как|how (do i|to) book|how booking)/.test(q)) {
    return {
      text: L('Запись в четыре шага: 1) выберите процедуру в каталоге; 2) выберите день и время; 3) отправьте заявку; 4) администратор подтверждает её, ответ появится в «Паспорте». Пока заявку не подтвердили, вы ничего не теряете.',
        'Booking in four steps: 1) pick a treatment in the catalog; 2) choose a day and time; 3) send the request; 4) the admin confirms it and the answer appears in “Passport”. Until it’s confirmed you lose nothing.'),
      actions: [{ kind: 'catalog', label: L('Выбрать процедуру', 'Choose a treatment') }, { kind: 'book', label: L('Сразу к записи', 'Go to booking') }],
    };
  }

  if (/(валют|лари|доллар|в gel|в usd|курс|переключ.*цен|цены в|currency|lari|dollar|usd|gel|exchange)/.test(q)) {
    return {
      text: L('Цены можно смотреть в лари и в долларах: переключатель — пилюля вверху справа на экранах каталога и записи. Доллары пересчитываются по курсу Нацбанка Грузии на сегодня, поэтому рядом стоит «≈». Итог визита всегда фиксируется в валюте процедуры.',
        'You can view prices in lari or dollars: the switch is the pill at the top right of the catalog and booking screens. Dollars use today’s National Bank of Georgia rate, hence the “≈”. The visit total is always fixed in the treatment’s own currency.'),
      actions: [{ kind: 'catalog', label: L('Открыть каталог', 'Open the catalog') }],
    };
  }

  if (/(инстаграм|instagram|телеграм|telegram|ватсап|whatsapp|вацап|телефон|позвонить|номер|phone|call|number)/.test(q)) {
    return {
      text: L('Связаться можно в чате с администратором — вкладка «Администратор» здесь же: там Telegram, Instagram и другие каналы, которые студия включила.',
        'You can reach us in the admin chat — the “Admin” tab right here: Telegram, Instagram and the other channels the studio has turned on.'),
      actions: [{ kind: 'handoff', label: L('Открыть связь', 'Open contacts') }],
    };
  }

  if (/(язык|english|по-английски|на английском|language|russian)/.test(q)) {
    return {
      text: L('Приложение есть на русском и английском: язык переключается пилюлей RU/EN вверху справа. Помощник отвечает на языке приложения; администратор — на русском и английском.',
        'The app is in Russian and English: switch with the RU/EN pill at the top right. The assistant answers in the app’s language; the admin speaks Russian and English.'),
      actions: [],
    };
  }

  // Цена конкретной процедуры — ответ про неё, а не общий «от 100 ₾»
  const named = matchByTitle(q);
  const ask = matchOnRequest(q);
  if (ask) return onRequestReply(ask);
  if (named && /(цен|стоим|сколько|прайс|price|cost|how much)/.test(q)) return describe(named, '');

  // Только процедуры витрины: обучение — не визит (isBookable, по kind), скрытое — не предлагаем
  if (/(цен|стоим|сколько|прайс|деньг|price|cost|how much)/.test(q)) return pricesReply();

  // Training (T2 §3.6) — before the procedure rules ("обучение ботоксу" is not a booking)
  // and before "курс / план", which would answer "I can build a plan".
  if (/(обуч|учиться|курс для врач|курсы для врач|training|course for doctors|learn)/.test(q)) {
    return {
      text: L('Анжелика проводит обучение для специалистов с медицинским образованием: с нуля она не обучает. Курсы — в каталоге, в разделе «Обучение». Записаться на курс в приложении нельзя, но можно написать Анжелике.',
        'Anjelika trains specialists with a medical background — not complete beginners. Courses are in the catalog under “Training”. You can’t book a course in the app, but you can message Anjelika.'),
      actions: [
        { kind: 'catalog', label: L('Открыть каталог', 'Open the catalog') },
        { kind: 'handoff', label: L('Написать Анжелике', 'Message Anjelika') },
      ],
    };
  }

  if (/(удал|раствор|dissolv|remov)/.test(q) && /(филлер|filler)/.test(q)) return aboutService('filler-dissolve', LEAD.fillerDissolve);
  if (/(губ|объём|объем|\blip)/.test(q)) return aboutService('lip-filler', LEAD.lips);
  if (/(конт|пласт|скул|подбород|челюст|филлер|contour|cheek|chin|jaw|filler)/.test(q)) return aboutService('contour-plastic', LEAD.contour);
  if (/(биорев|увлажн|сухост|сияни|тускл|biorevit|hydrat|dry|glow|dull)/.test(q)) return aboutService('biorevit', LEAD.biorevit);
  if (/(ботокс|ботул|botox|бруксизм|гипергидроз|флип|платизм|botul|brux|sweat|lip flip|platysma)/.test(q)) return aboutService('botulinum', LEAD.botulinum);
  if (/(коллаген|collagen)/.test(q)) return aboutService('collagen-stimulators', LEAD.collagen);
  if (/(мононит|нити|нить|нитей|thread)/.test(q)) return aboutService('mono-threads', LEAD.threads);
  if (/(smas|смас|лифтинг|подтяжк|аппарат|lifting|device)/.test(q)) return aboutService('smas-lifting', LEAD.smas);
  // Cleansing, peels, acne — by category: no demo ids, and no lead until Maria's consent
  if (/(чистк|почист|поры|чёрные точки|черные точки|cleans|pores|blackhead|facial)/.test(q)) return aboutCategory('clean', '');
  if (/(пилинг|кисло|пигмент|peel|acid|pigment)/.test(q)) return aboutCategory('peel', '');
  if (/(акне|воспал|прыщ|рубц|рубец|acne|pimple|scar|inflam)/.test(q)) return aboutCategory('derma', '');

  if (/(курс|план|последовател|что после|порядок|этап|course|plan|order|sequence)/.test(q)) {
    return {
      text: L('🗺 Могу собрать план: отмечаешь сердечком процедуры, которые хочешь, а я выстраиваю их в правильном порядке — сначала подготовка кожи, потом пилинги и аппарат, инъекции последними, с нужными интервалами.',
        '🗺 I can build a plan: heart the treatments you want and I’ll put them in the right order — skin prep first, then peels and devices, injections last, with the right intervals.'),
      actions: [
        { kind: 'plan', label: L('Собрать план процедур', 'Build a treatment plan') },
        { kind: 'catalog', label: L('Выбрать процедуры', 'Choose treatments') },
      ],
    };
  }

  if (/(адрес|где|как добра|кабинет|метро|парков|address|where|location|get there|parking)/.test(q)) {
    return {
      text: L(`📍 ${studioAddress('ru')}. Карта с меткой — в разделе «О нас», «Где найти».`, `📍 ${studioAddress('en')}. The map is in “About”, under “Find us”.`),
      actions: [{ kind: 'book', label: L('Выбрать время', 'Pick a time') }],
    };
  }

  if (/(запис|слот|свободн|когда|время|приём|прием|book|slot|available|when|appointment)/.test(q)) {
    /* Часы и «предложит другое время» отсюда сняты: свободное время знает
       только сервер (GET /slots), а статуса «другое время» у заявки нет —
       мастер её подтверждает или отклоняет. */
    return {
      text: L('📅 Свободное время видно при записи — его показывает расписание. Выбираешь время — заявка уходит Анжелике, она подтверждает или отклоняет. Ответ появится в «Паспорте»; если бот запущен, придёт и сообщение.',
        '📅 Free times show up when you book — straight from the schedule. Pick a time and the request goes to Anjelika, who confirms or declines it. The answer appears in “Passport”, and the bot messages you too if it’s started.'),
      actions: [{ kind: 'book', label: L('Выбрать время', 'Pick a time') }],
    };
  }

  if (/(депоз|отмен|перенес|перенос|опозда|cancel|reschedul|late|deposit)/.test(q)) {
    return {
      text: L('📋 Отменить заявку можно в «Паспорте», пока визит не прошёл. Перенести — напиши Анжелике. Заявка — не бронь: пока Анжелика не подтвердила, ты ничего не теряешь.',
        '📋 You can cancel a request in “Passport” before the visit. To reschedule, message Anjelika. A request isn’t a booking: until Anjelika confirms, you lose nothing.'),
      actions: [{ kind: 'handoff', label: L('Написать Анжелике', 'Message Anjelika') }],
    };
  }

  if (/(балл|лояльн|скидк|бонус|кэшбэк|кешбэк|реферал|подруг|discount|bonus|loyal|referral|friend|cashback)/.test(q)) {
    // Скидки за действия вернулись (Роч 15.10): −5 % за каждое, разово, до −20 %
    return {
      text: L('⭐ Есть разовые скидки за действия — по −5 % на процедуру за каждое: пройти Skin Profile, пригласить подругу, выложить сторис про студию, оставить отзыв. Вместе — до −20 % на одну процедуру. Всё на экране ANZH, скидка применится к записи сама. Баллов и уровней нет.',
        '⭐ There are one-time discounts for actions — 5% off a treatment for each: take the Skin Profile, invite a friend, post a story about the studio, leave a review. Together up to 20% off one treatment. It’s all on the ANZH screen and applies to your booking automatically. No points or tiers.'),
      actions: [{ kind: 'catalog', label: L('Открыть каталог с ценами', 'Open the price list') }],
    };
  }

  if (/(уход|крем|домашн|космет|сыворот|care|cream|serum|skincare|aftercare)/.test(q)) {
    return {
      text: L('🧴 Домашний уход Анжелика подбирает под твою кожу после процедуры — чтобы результат держался дольше. Что именно, зависит от типа кожи и того, что делали.',
        '🧴 Anjelika picks home care for your skin after the treatment so the result lasts longer. What exactly depends on your skin type and what was done.'),
      actions: [{ kind: 'handoff', label: L('Спросить про уход', 'Ask about care') }],
    };
  }

  if (/(спасиб|благодар|круто|супер|класс|thank|great|cool|awesome)/.test(q)) {
    return { text: L('Рада помочь 💛 Если что-то ещё — спрашивай, я всегда тут.', 'Happy to help 💛 Ask anything else — I’m always here.'), actions: [] };
  }

  // Название процедуры в вопросе («расскажи про лазер») — без нейросети, по словам из каталога
  const hit = matchByTitle(q);
  if (hit) return describe(hit, '');

  return {
    text: L('Тут я лучше не буду угадывать — спрошу Анжелику, она ответит точно. А пока могу показать процедуры, цены или свободное время.',
      'I’d rather not guess here — Anjelika will answer exactly. Meanwhile I can show treatments, prices or free times.'),
    actions: [
      { kind: 'handoff', label: L('Передать Анжелике', 'Pass to Anjelika') },
      { kind: 'catalog', label: L('Показать процедуры', 'Show treatments') },
    ],
  };
}
