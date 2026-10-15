import { useEffect } from 'react';
import { PinGate } from '../components/PinGate';
import { StudioScreen } from './StudioScreen';
import { SheetHost, ToastHost, LightboxHost } from '../components/UIHost';
import { OfflineBar } from '../components/OfflineBar';
import { useCabinet, lockCabinet } from '../lib/staff';
import { initTelegram } from '../lib/telegram';
import { installEdgeSwipeGuard } from '../lib/gestures';
import { initSession, sessionState } from '../lib/session';
import { refreshMe } from '../lib/api';
import { loadStudioProfile } from '../lib/studioProfile';

/*
   ПРИЛОЖЕНИЕ СТУДИИ — отдельный вход в кабинет (Роч 15.10).

   Открывается по адресу /studio: в Telegram это второй Mini App того же
   бота (BotFather → /newapp → URL https://<домен>/studio → t.me/<бот>/studio).
   Тот же бот — значит та же подпись initData и ни одной правки на сервере.
   В клиентском приложении входа в кабинет больше нет совсем: раньше он
   прятался в «Паспорт → Настройки», и даже владелица каждый раз его искала.

   Кто вы — говорит сервер по подписи Telegram (GET /staff/me), PIN
   подтверждает, что телефон в руках того же человека. «Выйти» здесь =
   заблокировать и вернуться к PIN, а не уйти в клиентскую витрину.
*/
/* Демо-ссылка прототипа: показать вход каждой роли без Telegram. В боевой
   сборке блока нет (условие — литерал false): роль определяет сервер по
   подписи Telegram, выбрать её нельзя. PIN на демо у всех один. */
const DEMO = import.meta.env.DEV || import.meta.env.VITE_DEMO === '1';
const DEMO_ROLES: Array<[string, string, string]> = [
  ['owner', 'Анжелика', 'владелица · всё'],
  ['admin', 'Дарья', 'администратор · заявки, клиентки, чат'],
  ['maria', 'Мария', 'мастер · свои записи и доход'],
  ['ekaterina', 'Екатерина', 'мастер · брови'],
  ['roman', 'Роман', 'мастер · лазер'],
];
function DemoRoles() {
  const cur = new URLSearchParams(window.location.search).get('as') ?? 'owner';
  return (
    <div className="sg-demo">
      <div className="sg-demo-head">Демо · войти как <span>PIN 2468</span></div>
      <div className="sg-demo-list">
        {DEMO_ROLES.map(([as, name, what]) => (
          <a key={as} className={`sg-demo-row${cur === as ? ' on' : ''}`} href={`/studio?as=${as}`}>
            <b>{name}</b>
            <span>{what}</span>
          </a>
        ))}
      </div>
    </div>
  );
}

export function StudioApp() {
  const cab = useCabinet();

  useEffect(() => {
    document.title = 'ANZH Студия';
    initTelegram();
    return installEdgeSwipeGuard();
  }, []);

  useEffect(() => {
    const start = () => { void initSession().then((s) => { if (s === 'user') void refreshMe(); }); };
    start();
    void loadStudioProfile();
    const onOnline = () => {
      const st = sessionState();
      if (st.status === 'guest' && (st.reason === 'network' || st.reason === 'server')) start();
    };
    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
  }, []);

  return (
    <div className="app">
      <div className="app-orbs" aria-hidden />
      {/* Пока временный PIN не заменён своим — кабинет не открываем */}
      {cab.phase === 'open' && !cab.me?.must_change_pin ? (
        <StudioScreen onExit={lockCabinet} />
      ) : (
        <div className="sg">
          <div className="sg-head">
            <img src="/brand/anzh-logo.svg" alt="ANZH" className="sg-logo" />
            <div className="sg-eyebrow">кабинет студии</div>
            <h1 className="sg-title">ANZH Студия</h1>
            <p className="sg-sub">Заявки, расписание, клиентки, переписка и выручка — для Анжелики и команды.</p>
          </div>
          <div className="sg-card">
            <PinGate embedded onUnlock={() => { /* кабинет откроется сам: фаза станет open */ }} />
          </div>
          {cab.phase === 'not_staff' && (
            <a className="btn btn-secondary btn-block sg-client" href="/">Открыть приложение для клиентов</a>
          )}
          {DEMO && <DemoRoles />}
        </div>
      )}
      <OfflineBar />
      <SheetHost />
      <LightboxHost />
      <ToastHost />
    </div>
  );
}
