/* ════════════════════════════════════════════════════════════════════
   App state — bookings, favourites, loyalty. Persisted to localStorage
   so a Mini App reopened from the Telegram chat looks the same.
   Same subscribe/useX shape as lib/ui.ts and lib/i18n.ts.
   ════════════════════════════════════════════════════════════════════ */
import { useEffect, useState } from 'react';
import { findService } from '../data/services';
import { daysFromNow, fromISODate, toISODate } from './date';

export type Currency = 'usd' | 'gel';
export type BookingStatus = 'upcoming' | 'done' | 'cancelled';

export type Booking = {
  id: string;
  serviceId: string;
  /** local `yyyy-mm-dd` */
  date: string;
  /** `HH:MM` */
  slot: string;
  status: BookingStatus;
  priceUsd: number;
  priceGel: number;
  /** loyalty points this visit earned */
  points: number;
  createdAt: number;
  reviewed?: boolean;
};

export type State = {
  bookings: Booking[];
  favorites: string[];
  points: number;
  userName: string;
  currency: Currency;
};

const KEY = 'anzh_state_v1';

/* ── Loyalty ─────────────────────────────────────────────── */
export const TIERS = [
  { id: 'bronze',  label: 'Bronze',  min: 0,    cashback: 5 },
  { id: 'silver',  label: 'Silver',  min: 300,  cashback: 7 },
  { id: 'gold',    label: 'Gold',    min: 600,  cashback: 10 },
  { id: 'diamond', label: 'Diamond', min: 1200, cashback: 15 },
] as const;

export type Tier = (typeof TIERS)[number];

export function tierFor(points: number): Tier {
  return [...TIERS].reverse().find((t) => points >= t.min) ?? TIERS[0];
}

export function nextTierFor(points: number): Tier | null {
  return TIERS.find((t) => t.min > points) ?? null;
}

/** Points earned by a visit — cashback percentage of the USD price. */
export function pointsFor(priceUsd: number, atPoints: number): number {
  return Math.round(priceUsd * (tierFor(atPoints).cashback / 100) * 2);
}

/* ── Seed — a returning client, so the prototype is never empty ── */
function seedBookings(): Booking[] {
  const past: Array<[string, number]> = [
    ['biorevit', 28],
    ['deep-cleansing', 63],
    ['lip-filler', 108],
    ['pdrn', 166],
  ];
  return past.map(([serviceId, ago], i) => {
    const s = findService(serviceId)!;
    return {
      id: `seed-${i}`,
      serviceId,
      date: toISODate(daysFromNow(-ago)),
      slot: ['16:30', '12:00', '18:00', '10:30'][i],
      status: 'done' as const,
      priceUsd: s.priceUsd,
      priceGel: s.priceGel,
      points: Math.round(s.priceUsd * 0.05),
      createdAt: Date.now() - ago * 86_400_000,
      reviewed: i > 1,
    };
  });
}

function initial(): State {
  return {
    bookings: seedBookings(),
    favorites: [],
    points: 380,
    userName: 'Маша',
    currency: 'usd',
  };
}

function load(): State {
  if (typeof window === 'undefined') return initial();
  // ?seed=1 (screenshot tests) always starts from the same known state
  if (window.location.search.includes('seed=1')) return initial();
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return initial();
    const parsed = JSON.parse(raw) as Partial<State>;
    const base = initial();
    return {
      ...base,
      ...parsed,
      // drop bookings whose service no longer exists in the catalog
      bookings: (parsed.bookings ?? base.bookings).filter((b) => findService(b.serviceId)),
    };
  } catch {
    return initial();
  }
}

let state: State = load();
const listeners = new Set<(s: State) => void>();

function persist() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* private mode / quota */ }
}

function set(patch: Partial<State> | ((s: State) => Partial<State>)) {
  const next = typeof patch === 'function' ? patch(state) : patch;
  state = { ...state, ...next };
  persist();
  listeners.forEach((l) => l(state));
}

export function getState(): State {
  return state;
}

export function useStore(): State {
  const [s, setS] = useState(state);
  useEffect(() => {
    listeners.add(setS);
    setS(state);                    // catch writes that landed before subscribe
    return () => { listeners.delete(setS); };
  }, []);
  return s;
}

/* ── Selectors ───────────────────────────────────────────── */
function byDate(a: Booking, b: Booking) {
  return `${a.date} ${a.slot}`.localeCompare(`${b.date} ${b.slot}`);
}

/** Soonest upcoming visit, or `null`. */
export function nextBooking(s: State = state): Booking | null {
  const today = toISODate(new Date());
  return s.bookings
    .filter((b) => b.status === 'upcoming' && b.date >= today)
    .sort(byDate)[0] ?? null;
}

/** Completed visits, newest first. */
export function pastBookings(s: State = state): Booking[] {
  return s.bookings.filter((b) => b.status === 'done').sort(byDate).reverse();
}

export function isTaken(date: string, slot: string, s: State = state): boolean {
  return s.bookings.some((b) => b.status === 'upcoming' && b.date === date && b.slot === slot);
}

export const SLOTS = ['09:00', '10:30', '12:00', '13:30', '15:00', '16:30', '18:00', '19:30'];

/* Anjelika is closed on Sundays; a deterministic hash keeps the other
   "already taken" slots stable across re-renders instead of flickering. */
export function slotTaken(dateISO: string, slot: string, s: State = state): boolean {
  if (isTaken(dateISO, slot, s)) return true;
  if (fromISODate(dateISO).getDay() === 0) return true;
  // Today's slots that have already started are gone.
  if (dateISO === toISODate(new Date())) {
    const now = new Date();
    const [h, m] = slot.split(':').map(Number);
    if (h * 60 + m <= now.getHours() * 60 + now.getMinutes()) return true;
  }
  let h = 0;
  for (const ch of dateISO + slot) h = (h * 31 + ch.charCodeAt(0)) % 997;
  return h % 5 === 0;
}

export function freeSlots(dateISO: string, s: State = state): string[] {
  return SLOTS.filter((sl) => !slotTaken(dateISO, sl, s));
}

/** The soonest bookable `{date, slot}` within the next two weeks. */
export function nearestFreeSlot(s: State = state): { date: string; slot: string } | null {
  for (let i = 0; i < 14; i++) {
    const date = toISODate(daysFromNow(i));
    const free = freeSlots(date, s);
    if (free.length) return { date, slot: free[0] };
  }
  return null;
}

/* ── Mutations ───────────────────────────────────────────── */
export function createBooking(serviceId: string, date: string, slot: string): Booking {
  const svc = findService(serviceId)!;
  const earned = pointsFor(svc.priceUsd, state.points);
  const booking: Booking = {
    id: `b${Date.now().toString(36)}`,
    serviceId,
    date,
    slot,
    status: 'upcoming',
    priceUsd: svc.priceUsd,
    priceGel: svc.priceGel,
    points: earned,
    createdAt: Date.now(),
  };
  set((s) => ({ bookings: [...s.bookings, booking], points: s.points + earned }));
  return booking;
}

export function cancelBooking(id: string) {
  set((s) => ({
    bookings: s.bookings.map((b) => (b.id === id ? { ...b, status: 'cancelled' as const } : b)),
    // the visit never happened — take its points back
    points: Math.max(0, s.points - (s.bookings.find((b) => b.id === id)?.points ?? 0)),
  }));
}

export function rescheduleBooking(id: string, date: string, slot: string) {
  set((s) => ({ bookings: s.bookings.map((b) => (b.id === id ? { ...b, date, slot } : b)) }));
}

export function markReviewed(id: string) {
  set((s) => ({ bookings: s.bookings.map((b) => (b.id === id ? { ...b, reviewed: true } : b)) }));
}

export function toggleFavorite(id: string) {
  set((s) => ({
    favorites: s.favorites.includes(id) ? s.favorites.filter((f) => f !== id) : [...s.favorites, id],
  }));
}

export function awardPoints(n: number) {
  set((s) => ({ points: Math.max(0, s.points + n) }));
}

export function setUserName(userName: string) {
  set({ userName });
}

export function setCurrency(currency: Currency) {
  set({ currency });
}

/** Dev/testing escape hatch — wipes persisted state. */
export function resetStore() {
  state = initial();
  persist();
  listeners.forEach((l) => l(state));
}

/* ── Money ───────────────────────────────────────────────── */
/** `$150` / `410 ₾` — one formatter so screens can't drift apart. */
export function money(priceUsd: number, priceGel: number, currency: Currency = state.currency): string {
  return currency === 'usd' ? `$${priceUsd}` : `${priceGel} ₾`;
}
