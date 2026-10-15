// Честный экран вместо белого — для падения, которое React поймать не может.
//
// ErrorBoundary (components/ErrorBoundary.tsx) ловит ошибки РЕНДЕРА. Но есть
// падение раньше рендера: модуль бросает прямо при импорте (например, чтение
// запрещённого localStorage в теле модуля — Цензор, волна 0, фронт №1). Тогда
// ESM не доходит до тела main.tsx, React не запускается вовсе, и человек видит
// бессрочный белый экран без единой кнопки.
//
// 🔴 ПОРЯДОК. Этот модуль — ПЕРВЫЙ импорт main.tsx: слушатель ошибок обязан
// встать до того, как начнут выполняться модули дерева App. Своих зависимостей
// у модуля нет — упасть при импорте ему нечем.
//
// Слушатель действует только до `bootReached()`: дальше ошибки принадлежат
// ErrorBoundary, а ошибка в обработчике нажатия не повод гасить живой экран.
//
// Наружу — ни текста ошибки, ни стека: человеку они ничего не скажут, а в
// сообщении может оказаться что угодно. Только «что делать».

export type CrashLang = 'ru' | 'en';

export const CRASH_TEXT: Record<CrashLang, { title: string; action: string }> = {
  ru: { title: 'Что-то пошло не так — перезапусти приложение', action: 'Перезапустить' },
  en: { title: 'Something went wrong — please restart the app', action: 'Restart' },
};

/* Язык — тем же порядком, что у lib/i18n.ts (сохранённый → Telegram → ru), но
   без импорта i18n: экран падения не должен зависеть от модуля, который мог
   упасть сам. Каждое чтение — в try/catch по той же причине. */
export function crashLang(): CrashLang {
  try {
    const saved = window.localStorage.getItem('anzh_lang');
    if (saved === 'ru' || saved === 'en') return saved;
  } catch { /* хранилище запрещено */ }
  try {
    const code = (window as unknown as {
      Telegram?: { WebApp?: { initDataUnsafe?: { user?: { language_code?: string } } } };
    }).Telegram?.WebApp?.initDataUnsafe?.user?.language_code;
    if (code) return code.startsWith('ru') ? 'ru' : 'en';
  } catch { /* SDK нет или он сломан */ }
  return 'ru';
}

export function restartApp(): void {
  window.location.reload();
}

let reached = false;

/** main.tsx зовёт перед запуском React: все модули выполнились без ошибки. */
export function bootReached(): void {
  reached = true;
}

function renderBootCrash(): void {
  const root = document.getElementById('root');
  // Уже нарисовано (вторая ошибка подряд) — второй экран не нужен
  if (!root || root.querySelector('.crash-screen')) return;
  const t = CRASH_TEXT[crashLang()];
  const box = document.createElement('div');
  box.className = 'crash-screen';
  box.setAttribute('role', 'alert');
  const title = document.createElement('p');
  title.className = 'crash-title';
  title.textContent = t.title;
  const action = document.createElement('button');
  action.type = 'button';
  action.className = 'btn btn-primary crash-action';
  action.textContent = t.action;
  action.addEventListener('click', restartApp);
  box.append(title, action);
  root.replaceChildren(box);
}

if (typeof window !== 'undefined') {
  window.addEventListener('error', () => {
    if (reached) return;
    renderBootCrash();
  });
}
