import { Component, type ReactNode } from 'react';
import { CRASH_TEXT, crashLang, restartApp } from '../lib/bootGuard';

/* Верхний предохранитель: ошибка рендера в любом экране — честный экран
   «перезапусти» с кнопкой, а не белый лист. Текст и вид — те же, что у
   падения при загрузке (lib/bootGuard.ts), чтобы человек видел одно и то же.

   Ни сообщения, ни стека на экран: человеку они ничего не скажут, а в тексте
   ошибки может оказаться что угодно. Разработчику ошибку по-прежнему пишет
   в консоль сам React. */
interface Props { children: ReactNode }
interface State { failed: boolean }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  render() {
    if (!this.state.failed) return this.props.children;
    const t = CRASH_TEXT[crashLang()];
    return (
      <div className="crash-screen" role="alert">
        <p className="crash-title">{t.title}</p>
        <button type="button" className="btn btn-primary crash-action" onClick={restartApp}>
          {t.action}
        </button>
      </div>
    );
  }
}
