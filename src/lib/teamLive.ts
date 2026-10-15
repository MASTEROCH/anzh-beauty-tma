import { useSyncExternalStore } from 'react';
import { getPublicTeam, type PublicMember } from './api/staff';
import { teamPhoto, teamFocus, TEAM, TEAM_BIO, MASTER_SERVICES } from '../data/team';

/* «О нас → Команда» — живая. Правит её владелица в кабинете (Студия →
   Команда): фото, описание, услуги, порядок, видимость. Пока сервер не
   ответил (или ручки ещё нет) — показываем команду из data/team.ts, как
   было: гость вне сети тоже видит людей, а не пустой ряд. */

type Bi = { ru: string; en: string };
export interface TeamView {
  key: string;
  name: Bi;
  surname?: Bi | null;
  role: Bi;
  short?: Bi | null;
  photo: { src: string; w: number; h: number } | null;
  focus: { x: number; y: number };
  cred?: Bi | null;
  does: { ru: string[]; en: string[] };
  services: string[];
  isAdmin: boolean;
  instagram?: string | null;
  telegram?: string | null;
  phone?: string | null;
}

const CENTER = { x: 50, y: 50 };

const STATIC: TeamView[] = TEAM.flatMap((m) => {
  const p = teamPhoto(m);
  if (!p) return [];
  const bio = TEAM_BIO[m.id];
  return [{
    key: m.id, name: m.name, surname: m.surname ?? null, role: m.role, short: m.short ?? null,
    photo: { src: p.src, w: p.w, h: p.h }, focus: teamFocus(m), cred: bio.cred ?? null, does: bio.does,
    services: [...MASTER_SERVICES[m.id]], isAdmin: m.id === 'darya',
  }];
});

const fromWire = (m: PublicMember): TeamView => ({
  key: m.key, name: m.name, surname: m.surname ?? null, role: m.role, short: m.short ?? null,
  photo: m.photo_url && /^\/photos\//.test(m.photo_url) ? { src: m.photo_url, w: 480, h: 480 } : null,
  focus: m.focus ?? CENTER, cred: m.cred ?? null, does: m.does ?? { ru: [], en: [] },
  services: m.services ?? [], isAdmin: !!m.is_admin,
  instagram: m.instagram ?? null, telegram: m.telegram ?? null, phone: m.phone ?? null,
});

let state: TeamView[] = STATIC;
const listeners = new Set<() => void>();
let started = false;

export function loadPublicTeam(): void {
  if (started) return;
  started = true;
  getPublicTeam().then((list) => {
    if (list.length === 0) return; // пустой ответ не стирает людей с витрины
    state = list.map(fromWire);
    listeners.forEach((l) => l());
  }).catch(() => { started = false; });
}

export function useTeamView(): TeamView[] {
  return useSyncExternalStore(
    (l) => { listeners.add(l); loadPublicTeam(); return () => { listeners.delete(l); }; },
    () => state, () => state,
  );
}
