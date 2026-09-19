import { useEffect, useState } from 'react';
import { Icon } from './Icon';

// Приложение не должно умирать молча. В мини-аппе связь пропадает постоянно:
// метро, лифт, роуминг. Данные лежат локально, поэтому смотреть каталог и
// свою историю можно и без сети — а вот заявка уйдёт не сразу, и об этом
// человек должен узнать до того, как решит, что его проигнорировали.

export function OfflineBar() {
  const [offline, setOffline] = useState(() => typeof navigator !== 'undefined' && !navigator.onLine);
  const [justBack, setJustBack] = useState(false);

  useEffect(() => {
    const goOffline = () => { setOffline(true); setJustBack(false); };
    const goOnline = () => {
      setOffline(false);
      setJustBack(true);
      window.setTimeout(() => setJustBack(false), 2600);
    };
    window.addEventListener('offline', goOffline);
    window.addEventListener('online', goOnline);
    return () => {
      window.removeEventListener('offline', goOffline);
      window.removeEventListener('online', goOnline);
    };
  }, []);

  if (!offline && !justBack) return null;

  return (
    <div className={`offline-bar${offline ? '' : ' back'}`} role="status" aria-live="polite">
      <Icon name={offline ? 'warning' : 'check'} size={14} strokeWidth={2.2} />
      {offline
        ? 'Нет сети — каталог и записи видны, заявка уйдёт, когда связь вернётся'
        : 'Связь вернулась'}
    </div>
  );
}
