import { studioAddress } from '../data/location';
import { visitTitle, STATUS_WORD, type Visit } from './studio';
import type { CalEvent } from './ics';

/* Запись кабинета → событие календаря мастера. В заголовке — кто и что:
   в календаре телефона видно, кто следующий, не открывая приложение.
   Комментарий клиентки НЕ кладём: он бывает о здоровье, а календарь
   синхронизируется в чужие облака (lib/studio.ts: «только на экран»). */
export function eventOfVisit(v: Visit): CalEvent {
  const pending = v.status === 'pending';
  return {
    uid: `staff-${v.id}@anzh.tma`,
    start: new Date(v.startsAt),
    durationMin: v.durationMin || 60,
    title: `${pending ? '❓ ' : ''}${v.clientName} · ${visitTitle(v)}`,
    location: studioAddress('ru'),
    description: [
      `Статус: ${STATUS_WORD[v.status] ?? v.status}`,
      v.staffName ? `Мастер: ${v.staffName}` : null,
      'ANZH Студия — карточка клиентки в кабинете',
    ].filter(Boolean).join('\n'),
    alarmMin: 30,
  };
}
