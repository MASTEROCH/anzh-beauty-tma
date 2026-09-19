// Ответы ассистента. Раньше это были захардкоженные строки-тупики: бот
// рассказывал про филлеры и на этом разговор кончался — записаться можно было
// только вернувшись и пройдя навигацию руками. Теперь ответ знает реальную
// услугу из каталога и несёт кнопки действия, а когда не справляется —
// отдаёт человека Анжелике, а не повторяет «спросите иначе».

import { findService, services, type Service } from '../data/services';

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

const bookAction = (s: Service): AiAction => ({ kind: 'book', label: `Записаться · $${s.priceUsd}`, serviceId: s.id });
const openAction = (s: Service): AiAction => ({ kind: 'service', label: 'Подробнее о процедуре', serviceId: s.id });

function aboutService(id: string, lead: string): AiReply {
  const s = findService(id)!;
  return {
    text: `${lead}\n\n${s.description}\n\n${s.duration} мин · $${s.priceUsd} · ${s.priceGel} GEL`,
    actions: [bookAction(s), openAction(s)],
  };
}

export function respond(message: string): AiReply {
  const q = message.toLowerCase();

  if (/(губ|конт|пласт|филлер|объём|объем)/.test(q)) {
    return aboutService('lip-filler', '💋 Для первого раза обычно берут 0.5–0.7 мл — естественный объём, без «утиного» эффекта. Форму Анжелика размечает по MD-Codes под овал лица.');
  }
  if (/(чистк|почист|поры|чёрные точки|черные точки)/.test(q)) {
    return aboutService('deep-cleansing', '🌿 Атравматичная чистка — ультразвук плюс мануальная работа, без травмы кожи.');
  }
  if (/(биорев|увлажн|сухост|сияни|тускл)/.test(q)) {
    return aboutService('biorevit', '✨ Биоревитализация делается курсом из 3 процедур с интервалом 2 недели — разовая даёт эффект, но он быстро уходит.');
  }
  if (/(пилинг|кисло|тон|пигмент)/.test(q)) {
    return aboutService('almagold-peel', '🍃 PRX-T33 — пилинг без слущивания, можно делать в любой сезон, даже летом.');
  }
  if (/(лифтинг|подтяжк|\brf\b|аппарат|овал)/.test(q)) {
    return aboutService('rf-lifting', '⚡ RF-лифтинг INDIBA даёт видимый эффект сразу, накопительный — после 3–4 процедур. Без реабилитации.');
  }
  if (/(pdrn|днк|регенер|восстанов|зрел)/.test(q)) {
    return aboutService('pdrn', '🧬 PDRN — полинуклеотиды, глубокое восстановление кожи. Хорошо заходит после агрессивных процедур.');
  }
  if (/(led|акне|воспал|прыщ)/.test(q)) {
    return aboutService('led-therapy', '💡 LED-терапия снимает воспаления и ускоряет заживление. Можно добавить к любой процедуре.');
  }

  if (/(аллерг|лидокаин|реакц|противопоказ|беремен|лактац|кормл)/.test(q)) {
    return {
      text: '⚠️ Перед процедурой я сверяю твою анкету с противопоказаниями — но анкета должна быть заполнена. Проверь аллергии и состояние, это займёт минуту.',
      actions: [
        { kind: 'passport', label: 'Заполнить паспорт здоровья' },
        { kind: 'handoff', label: 'Спросить Анжелику лично' },
      ],
    };
  }

  if (/(цен|стоим|сколько|прайс|деньг)/.test(q)) {
    const min = Math.min(...services.map((s) => s.priceUsd));
    const max = Math.max(...services.map((s) => s.priceUsd));
    return {
      text: `💸 Процедуры от $${min} (LED-терапия) до $${max} (PDRN). В каталоге можно переключить USD ↔ GEL — цены пересчитаются.`,
      actions: [{ kind: 'catalog', label: 'Открыть каталог с ценами' }],
    };
  }

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
      text: '📍 Батуми, Parnavaz Mepe 92/94, 1 этаж, домофон 12. Десять минут от Boulevard, парковка у входа.',
      actions: [{ kind: 'book', label: 'Выбрать время' }],
    };
  }

  if (/(запис|слот|свободн|когда|время|приём|прием)/.test(q)) {
    return {
      text: `📅 Анжелика принимает вт–сб, 09:00–20:00. Выбираешь слот — заявка уходит ей, она подтверждает или предлагает другое время. ${clinicOpen() ? 'Сейчас она на связи.' : `Сейчас нерабочее время: ${nextOpening()}.`}`,
      actions: [{ kind: 'book', label: 'Выбрать время' }],
    };
  }

  if (/(депоз|отмен|перенес|перенос|опозда)/.test(q)) {
    return {
      text: '📋 Перенос бесплатный и в любой момент. Заявка — не бронь: пока Анжелика не подтвердила, ты ничего не теряешь.',
      actions: [{ kind: 'handoff', label: 'Написать Анжелике' }],
    };
  }

  if (/(балл|лояльн|скидк|бонус|кэшбэк|кешбэк|реферал|подруг)/.test(q)) {
    return {
      text: '⭐ Кэшбэк баллами с каждого визита, процент растёт с тиром: Bronze 5% → Silver 7% → Gold 10% → Diamond 15%. Отзыв даёт −10% на следующую, отзыв с фото — бонус. Подруга по реферальной ссылке — +1000 баллов обоим.',
      actions: [{ kind: 'book', label: 'Записаться и копить' }],
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

  return {
    text: 'Тут я лучше не буду угадывать — спрошу Анжелику, она ответит точно. А пока могу показать процедуры, цены или свободное время.',
    actions: [
      { kind: 'handoff', label: 'Передать Анжелике' },
      { kind: 'catalog', label: 'Показать процедуры' },
    ],
  };
}
