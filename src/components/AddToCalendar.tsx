import { Icon } from './Icon';
import { closeSheet, openSheet, toast } from '../lib/ui';
import { tap, notify } from '../lib/haptics';
import { openExternal } from '../lib/telegram';
import { downloadEvents, googleCalendarUrl, type CalEvent } from '../lib/ics';

/* «В календарь» одной командой — клиентке и в кабинете (Роч 15.10).
   Два пути, потому что календарей у людей два: системный (iPhone, Outlook,
   Mac — понимают .ics) и Google (открывается ссылкой с готовой формой).
   Google — только для одного события: ссылка не умеет пачку. */

export function openAddToCalendar(events: CalEvent[], lang: 'ru' | 'en', fileName: string) {
  const ru = lang === 'ru';
  if (events.length === 0) {
    toast(ru ? 'У записи нет точного времени — календарь не соберём' : 'No exact time — can’t build a calendar event');
    return;
  }
  tap();
  const one = events.length === 1;
  openSheet({
    title: ru ? 'Добавить в календарь' : 'Add to calendar',
    subtitle: one
      ? events[0].title
      : (ru ? `${events.length} записей одним файлом` : `${events.length} bookings in one file`),
    body: (
      <div className="cal-pick">
        <button className="cal-opt" onClick={() => {
          const ok = downloadEvents(events, fileName);
          notify(ok ? 'success' : 'error');
          closeSheet();
          toast(ok
            ? (ru ? 'Файл календаря готов — откройте его, чтобы добавить' : 'Calendar file ready — open it to add')
            : (ru ? 'Браузер не дал скачать файл — попробуйте Google Календарь' : 'The browser blocked the file — try Google Calendar'), ok ? 'success' : undefined);
        }}>
          <span className="cal-ic"><Icon name="calendar" size={20} strokeWidth={1.8} /></span>
          <span className="cal-body"><b>{ru ? 'Календарь iPhone, Mac, Outlook' : 'iPhone, Mac, Outlook calendar'}</b><span>{ru ? 'файл .ics с напоминанием за 2 часа' : '.ics file with a 2-hour reminder'}</span></span>
        </button>
        {one && (
          <button className="cal-opt" onClick={() => { closeSheet(); openExternal(googleCalendarUrl(events[0])); }}>
            <span className="cal-ic"><Icon name="globe" size={20} strokeWidth={1.8} /></span>
            <span className="cal-body"><b>Google {ru ? 'Календарь' : 'Calendar'}</b><span>{ru ? 'откроется форма события — нажмите «Сохранить»' : 'an event form opens — tap “Save”'}</span></span>
          </button>
        )}
      </div>
    ),
  });
}
