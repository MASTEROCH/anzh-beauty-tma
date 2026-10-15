// 🔴 ПЕРВЫЕ ДВА ИМПОРТА — И ЭТО НЕ СТИЛЬ, А ПОРЯДОК ВЫПОЛНЕНИЯ.
//   1. bootGuard — слушатель падения при загрузке: должен встать раньше, чем
//      начнут выполняться модули дерева App (см. lib/bootGuard.ts).
//   2. legacyStorage — разовая чистка старых ключей localStorage обязана
//      пройти ДО того, как модули-хранилища из дерева App прочитают свои ключи
//      при импорте (см. lib/legacyStorage.ts). bootGuard хранилище только
//      читает (язык), копий не держит — чистке он не мешает.
// Не переносить ниже и не превращать в вызов из эффекта.
import { bootReached } from './lib/bootGuard';
import './lib/legacyStorage';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/tokens.css';
import './styles/global.css';
import { App } from './App';
import { StudioApp } from './screens/StudioApp';
import { ErrorBoundary } from './components/ErrorBoundary';

// Все модули выполнились — дальше падение рендера ловит ErrorBoundary
bootReached();

/* Два приложения в одной сборке: клиентская витрина (/) и кабинет студии
   (/studio — второй Mini App того же бота). Выбор по адресу, до первого
   рендера: в кабинете не запускается ничего клиентского (онбординг, чат,
   навигация), а у клиентки нет ни строки про кабинет. */
const isStudio = window.location.pathname.replace(/\/+$/, '') === '/studio';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      {isStudio ? <StudioApp /> : <App />}
    </ErrorBoundary>
  </StrictMode>,
);
