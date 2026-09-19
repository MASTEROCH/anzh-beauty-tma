// Кто вошёл в кабинет и что ему видно.
//
// В салоне не одна Анжелика: она владелица И косметолог одновременно, плюс
// два-три мастера на других процедурах. Отсюда два разных уровня, а не
// «админ / не админ»:
//
//   owner  — Анжелика. Видит всё: деньги салона целиком, чужие записи,
//            прайс, состав команды, выручку по каждому мастеру.
//   master — мастер на своих процедурах. Видит СВОЙ день, своих клиентов и
//            свой заработок. Чужую выручку и прайс — нет.
//
// Почему выручка чужого мастера закрыта: зарплата это личное. Панель, где
// каждый видит, сколько заработал сосед, ссорит команду — а чинить это
// потом приходится не интерфейсом.
//
// ⚠️ Прототип: PIN лежит на клиенте. На бою вход — это проверка Telegram-ID
// на сервере; PIN тут только чтобы флоу можно было пройти целиком.

import { useEffect, useState } from 'react';

export type Role = 'owner' | 'master';

export interface Staff {
  id: string;
  name: string;
  role: Role;
  /** Что человек делает — id услуг. У владельца пусто: она ведёт всё */
  serviceIds: string[];
  pin: string;
  colour: string;
  active: boolean;
}

const KEY = 'anzh_staff_v1';
const SESSION_KEY = 'anzh_staff_session_v1';

/* Стартовая команда. Анжелика — единственная, кого нельзя удалить: на ней
   держится весь бренд, и кабинет без владельца превращается в кирпич. */
const SEED: Staff[] = [
  {
    id: 'anzhelika',
    name: 'Анжелика',
    role: 'owner',
    serviceIds: [],
    pin: '2024',
    colour: '#12C088',
    active: true,
  },
  {
    id: 'marina',
    name: 'Марина',
    role: 'master',
    serviceIds: ['brow-lamination'],
    pin: '1111',
    colour: '#C9A52F',
    active: true,
  },
  {
    id: 'nino',
    name: 'Нино',
    role: 'master',
    serviceIds: ['tattoo-removal', 'carbon-peel'],
    pin: '2222',
    colour: '#35E4A6',
    active: true,
  },
];

export const OWNER_ID = 'anzhelika';

const listeners = new Set<(s: Staff[]) => void>();

function load(): Staff[] {
  if (typeof window === 'undefined') return SEED;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return SEED;
    const parsed = JSON.parse(raw) as Staff[];
    // Владелец обязан быть всегда — иначе в кабинет некому войти
    return parsed.some((s) => s.id === OWNER_ID) ? parsed : SEED;
  } catch {
    return SEED;
  }
}

let team: Staff[] = load();

function persist() {
  try { localStorage.setItem(KEY, JSON.stringify(team)); } catch { /* ignore */ }
  listeners.forEach((l) => l(team));
}

export function useTeam(): Staff[] {
  const [s, setS] = useState(team);
  useEffect(() => {
    listeners.add(setS);
    return () => { listeners.delete(setS); };
  }, []);
  return s;
}

export const getTeam = () => team;
export const findStaff = (id: string) => team.find((s) => s.id === id);

export function addStaff(input: Omit<Staff, 'id' | 'active'>): Staff {
  const person: Staff = { ...input, id: `s${Date.now()}`, active: true };
  team = [...team, person];
  persist();
  return person;
}

export function updateStaff(id: string, patch: Partial<Omit<Staff, 'id'>>) {
  team = team.map((s) => (s.id === id ? { ...s, ...patch } : s));
  persist();
}

/** Мастера не удаляем, а выключаем: на нём висит история записей */
export function deactivateStaff(id: string) {
  if (id === OWNER_ID) return;
  updateStaff(id, { active: false });
}

export function activateStaff(id: string) {
  updateStaff(id, { active: true });
}

/** Кто может делать эту услугу. Владелец — всегда */
export function staffForService(serviceId: string): Staff[] {
  return team.filter(
    (s) => s.active && (s.role === 'owner' || s.serviceIds.includes(serviceId)),
  );
}

/* ── Сессия входа ── */

const sessionListeners = new Set<(id: string | null) => void>();

function loadSession(): string | null {
  if (typeof window === 'undefined') return null;
  try { return localStorage.getItem(SESSION_KEY); } catch { return null; }
}

let sessionId: string | null = loadSession();

export function signIn(pin: string): Staff | null {
  const person = team.find((s) => s.active && s.pin === pin);
  if (!person) return null;
  sessionId = person.id;
  try { localStorage.setItem(SESSION_KEY, person.id); } catch { /* ignore */ }
  sessionListeners.forEach((l) => l(sessionId));
  return person;
}

export function signOut() {
  sessionId = null;
  try { localStorage.removeItem(SESSION_KEY); } catch { /* ignore */ }
  sessionListeners.forEach((l) => l(null));
}

/** Кто сейчас в кабинете. null — никто не вошёл */
export function useSession(): Staff | null {
  const [id, setId] = useState(sessionId);
  useEffect(() => {
    sessionListeners.add(setId);
    return () => { sessionListeners.delete(setId); };
  }, []);
  const person = id ? findStaff(id) : undefined;
  // Мастера выключили, пока он был внутри — сессия больше не действует
  return person && person.active ? person : null;
}

/* ── Права. Одно место, где написано, кому что можно ── */

export interface Access {
  /** Деньги салона целиком, а не только свои */
  seeAllMoney: boolean;
  /** Чужие записи в расписании */
  seeAllAppointments: boolean;
  editPrices: boolean;
  editCatalog: boolean;
  manageTeam: boolean;
}

export function accessOf(person: Staff | null): Access {
  const owner = person?.role === 'owner';
  return {
    seeAllMoney: owner,
    seeAllAppointments: owner,
    editPrices: owner,
    editCatalog: owner,
    manageTeam: owner,
  };
}
