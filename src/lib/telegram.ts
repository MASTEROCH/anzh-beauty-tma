// Личность клиента берём из Telegram, а не спрашиваем заново. Для Анжелики это
// главный якорь: телефонов у неё почти ни у кого нет, в контактах — ник из
// инстаграма, который в любой момент может слететь. Telegram-ID не слетает.

export interface TgUser {
  id: number;
  firstName: string;
  lastName?: string;
  username?: string;
  languageCode?: string;
  photoUrl?: string;
}

interface TgWebApp {
  initDataUnsafe?: {
    user?: {
      id: number;
      first_name: string;
      last_name?: string;
      username?: string;
      language_code?: string;
      photo_url?: string;
    };
  };
  ready?: () => void;
  expand?: () => void;
}

function webApp(): TgWebApp | undefined {
  if (typeof window === 'undefined') return undefined;
  return (window as unknown as { Telegram?: { WebApp?: TgWebApp } }).Telegram?.WebApp;
}

export function getTgUser(): TgUser | null {
  const u = webApp()?.initDataUnsafe?.user;
  if (!u) return null;
  return {
    id: u.id,
    firstName: u.first_name,
    lastName: u.last_name,
    username: u.username,
    languageCode: u.language_code,
    photoUrl: u.photo_url,
  };
}


export function tgReady() {
  const w = webApp();
  w?.ready?.();
  w?.expand?.();
}

/** @username или имя — то, как мастер найдёт человека в своей базе */
export function tgHandle(u: TgUser | null): string {
  if (!u) return '';
  return u.username ? `@${u.username}` : u.firstName;
}
