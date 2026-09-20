// Что с чем делают за один приход.
//
// Сценарий Анжелики: клиентка приходит на одну процедуру и «заодно» делает
// ещё пару, либо заранее списывается и приходит уже на набор. Плоский
// список из тринадцати процедур такому человеку не помогает — он не знает,
// что с чем сочетается, и спрашивает об этом в директе. Значит, сочетания
// должен знать интерфейс.
//
// Три состояния, а не два:
//   good — обычно делают вместе, и это даёт лучший результат
//   ok   — можно, ничего не мешает
//   no   — лучше в разные дни, с объяснением почему
//
// «no» НЕ блокирует. Решает Анжелика: она может знать причину, по которой
// в этот раз можно. Приложение предупреждает, а не запрещает — тот же
// принцип, что и с заявкой, которую подтверждает человек, а не система.
//
// ⚠️ Правила собраны по общей практике и описаниям самих процедур в
// каталоге. Их нужно подтвердить у Анжелики — она может знать иначе.

import { findService, type Service } from '../data/services';

export type Pairing = 'good' | 'ok' | 'no';

export interface ComboVerdict {
  kind: Pairing;
  why?: { ru: string; en: string };
}

const OK: ComboVerdict = { kind: 'ok' };

/** Зона работы: процедуры разных зон почти никогда не мешают друг другу */
const zoneOf = (s: Service) => s.zone ?? 'face';

export function pairing(a: Service, b: Service): ComboVerdict {
  if (a.id === b.id) return { kind: 'no' };

  // Обучение — не процедура: в визит клиентки оно не добавляется
  if (a.category === 'training' || b.category === 'training') return { kind: 'no' };

  const cats: Array<Service['category']> = [a.category, b.category];
  const has = (c: Service['category']) => cats.includes(c);
  const both = (x: Service['category'], y: Service['category']) =>
    (a.category === x && b.category === y) || (a.category === y && b.category === x);

  // Разные зоны — почти всегда совместимо: брови и лицо, тело и лицо
  if (zoneOf(a) !== zoneOf(b)) {
    return {
      kind: 'good',
      why: {
        ru: 'Разные зоны — делаются за один приход без ущерба друг другу',
        en: 'Different areas — done in one visit without interfering',
      },
    };
  }

  // Приём дерматолога хорош ПЕРЕД чем угодно: врач смотрит до процедуры
  if (has('derma')) {
    return {
      kind: 'good',
      why: {
        ru: 'Врач смотрит кожу до процедуры — и подтверждает, что её можно делать',
        en: 'The doctor checks your skin first and confirms the treatment is safe',
      },
    };
  }

  // LED-уход добавляется к чему угодно: он снимает покраснение после
  if (has('care')) {
    return {
      kind: 'good',
      why: {
        ru: 'Снимает покраснение и ускоряет восстановление сразу после процедуры',
        en: 'Calms redness and speeds up recovery right after the treatment',
      },
    };
  }

  // Две инъекционные за раз — отёк, по которому не оценить результат
  if (a.category === 'inj' && b.category === 'inj') {
    return {
      kind: 'no',
      why: {
        ru: 'Две инъекционные за раз дают отёк, из-за которого не видно результат ни одной',
        en: 'Two injectables at once cause swelling that hides both results',
      },
    };
  }

  // Чистка открывает поры — инъекции в тот же день это лишний риск
  if (both('clean', 'inj')) {
    return {
      kind: 'no',
      why: {
        ru: 'После чистки поры открыты — инъекции в тот же день лучше не делать',
        en: 'Pores stay open after a cleanse — injections are better on another day',
      },
    };
  }

  // Пилинг и чистка вместе — двойная нагрузка на барьер
  if (both('clean', 'peel')) {
    return {
      kind: 'no',
      why: {
        ru: 'Двойная нагрузка на барьер кожи — между ними нужен перерыв 1–2 недели',
        en: 'Double stress on the skin barrier — they need 1–2 weeks apart',
      },
    };
  }

  // Пилинг и лазер снимают роговой слой оба
  if (both('peel', 'apparatus')) {
    return {
      kind: 'no',
      why: {
        ru: 'И пилинг, и аппарат снимают роговой слой — вместе это перебор',
        en: 'Both a peel and the laser remove the top layer — together it is too much',
      },
    };
  }

  return OK;
}

export interface Suggestion {
  service: Service;
  verdict: ComboVerdict;
}

/**
 * Что предложить добавить к визиту. Сортировка — по смыслу, а не по
 * алфавиту: сперва то, что обычно делают вместе, потом остальное, и в
 * самом конце то, что лучше развести по разным дням.
 */
export function suggestionsFor(
  chosen: string[],
  catalog: Service[],
): Suggestion[] {
  const picked = chosen.map((id) => findService(id)).filter((s): s is Service => !!s);
  if (picked.length === 0) return [];

  const rank: Record<Pairing, number> = { good: 0, ok: 1, no: 2 };

  return catalog
    .filter((s) => !chosen.includes(s.id) && s.category !== 'training')
    .map((s) => {
      /* Вердикт по ВСЕМУ набору: худший из парных. Если процедура плохо
         сочетается хотя бы с одной уже выбранной — предупреждаем.
         Начинаем с ПЕРВОГО реального вердикта, а не с заглушки
         `{kind:'good'}`: у заглушки нет объяснения, и процедура, которая
         сочетается со всем, оставалась карточкой без единственного текста,
         ради которого этот блок и сделан. */
      let worst = pairing(picked[0], s);
      for (const p of picked.slice(1)) {
        const v = pairing(p, s);
        if (rank[v.kind] > rank[worst.kind]) worst = v;
      }
      return { service: s, verdict: worst };
    })
    .sort((x, y) => rank[x.verdict.kind] - rank[y.verdict.kind]);
}
