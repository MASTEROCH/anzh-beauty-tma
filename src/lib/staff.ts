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

  /* Карточка сотрудника. Владелица держит команду в голове, пока людей
     трое; на пятом человеке «кто чем занимается и как с ним связаться»
     начинает теряться. Всё необязательное — заполняется по мере сил. */
  title?: string;        // должность: «мастер по бровям», «администратор»
  photo?: string;        // путь к фото
  phone?: string;
  instagram?: string;
  /** Когда человек пришёл в команду — для стажа в карточке */
  joinedISO?: string;
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
    title: 'Косметолог · владелица',
    photo: '/photos/anjelika.jpg',
    instagram: 'dr.domnich',
    joinedISO: '2018-03-01',
  },
  {
    id: 'marina',
    name: 'Марина',
    role: 'master',
    serviceIds: ['brow-lamination'],
    pin: '1111',
    colour: '#C9A52F',
    active: true,
    title: 'Мастер по бровям',
    joinedISO: '2024-05-12',
  },
  {
    id: 'nino',
    name: 'Нино',
    role: 'master',
    serviceIds: ['tattoo-removal', 'carbon-peel'],
    pin: '2222',
    colour: '#35E4A6',
    active: true,
    title: 'Аппаратные процедуры',
    joinedISO: '2025-02-03',
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

/**
 * Назначить или сменить код сотруднику.
 *
 * Четыре цифры, и не из числа заводских: код, который ходил по
 * переписке, способом входа быть не должен — его надо не поменять, а
 * вывести из употребления.
 */
export function setPin(id: string, pin: string): { ok: true } | { ok: false; why: string } {
  if (!/^\d{4}$/.test(pin)) return { ok: false, why: 'Код — ровно четыре цифры' };
  if (DEFAULT_PINS.has(pin)) return { ok: false, why: 'Этот код известен из переписки, выберите другой' };
  // Два человека с одним кодом — это два человека, которых кабинет не
  // различает. Проверяем по всей команде, включая выключенных.
  if (team.some((s) => s.id !== id && s.pin === pin)) {
    return { ok: false, why: 'Такой код уже у другого сотрудника' };
  }
  updateStaff(id, { pin });
  return { ok: true };
}

/**
 * Исключить из команды НАСОВСЕМ.
 *
 * Отличается от `deactivateStaff`: тот оставляет человека в списке
 * выключенным, и его записи по-прежнему находятся по id. Исключение
 * убирает строку целиком — применять, когда человек не просто в отпуске,
 * а больше не работает.
 *
 * Владельца исключить нельзя: кабинет без владельца превращается в
 * кирпич, а вернуть её будет уже некому.
 */
export function removeStaff(id: string): { ok: true } | { ok: false; why: string } {
  if (id === OWNER_ID) return { ok: false, why: 'Владельца нельзя исключить из команды' };
  if (sessionId === id) return { ok: false, why: 'Нельзя исключить себя — вы сейчас в кабинете' };
  team = team.filter((s) => s.id !== id);
  persist();
  return { ok: true };
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

const DEFAULT_PINS = new Set(['2024', '1111', '2222']);

/**
 * Код ещё заводской?
 *
 * Подсказка с кодом показывается на входе ТОЛЬКО пока человек не сменил
 * его сам. Это не «демо-надпись», которая переживёт все переделки, а
 * механика: владелица назначила сотруднику свой код — подсказка исчезла
 * сама. Заодно видно в панели команды, кто ещё сидит на заводском.
 */
export const hasDefaultPin = (person: Staff) => DEFAULT_PINS.has(person.pin);

/**
 * Вход конкретным человеком.
 *
 * `who` обязателен: раньше код искался по всей команде, и человек,
 * набравший чужой код, входил под ним, не заметив этого. Теперь сперва
 * выбираешь, кто ты, и код проверяется только против твоего.
 */
export function signInAs(who: string, pin: string): Staff | null {
  const person = team.find((s) => s.active && s.id === who && s.pin === pin);
  if (!person) return null;
  sessionId = person.id;
  try { localStorage.setItem(SESSION_KEY, person.id); } catch { /* ignore */ }
  sessionListeners.forEach((l) => l(sessionId));
  return person;
}

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
