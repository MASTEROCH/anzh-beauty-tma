// Процедуры, которыми управляет Анжелика: добавить свою, убрать лишнюю.
//
// Два правила, из которых растёт вся эта логика:
//
//  1. Услугу НЕЛЬЗЯ удалять — только архивировать. На ней висит история
//     визитов, выручка и записи в картах клиентов. Удаление строки прайса
//     превратило бы прошлый визит в «услуга не найдена», а выручку — в
//     дыру в отчёте задним числом.
//  2. Базовые услуги живут в коде, добавленные — в хранилище. Слой правок
//     накладывается поверх, а не заменяет: обновление приложения не должно
//     стирать то, что мастер завёл руками.

import { useEffect, useState } from 'react';
import { services as BASE, type Service } from '../data/services';

const CUSTOM_KEY = 'anzh_custom_services_v1';
const HIDDEN_KEY = 'anzh_archived_services_v1';

const listeners = new Set<() => void>();

function read<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

let custom: Service[] = read<Service[]>(CUSTOM_KEY, []);
let archived: string[] = read<string[]>(HIDDEN_KEY, []);

function persist() {
  try {
    localStorage.setItem(CUSTOM_KEY, JSON.stringify(custom));
    localStorage.setItem(HIDDEN_KEY, JSON.stringify(archived));
  } catch { /* ignore */ }
  listeners.forEach((l) => l());
}

/** Все услуги, включая архивные — для истории и отчётов */
export const allKnownServices = (): Service[] => [...BASE, ...custom];

/** Что видит клиент: базовые + добавленные, без архивных */
export const liveServices = (): Service[] =>
  allKnownServices().filter((s) => !archived.includes(s.id));

export const isArchived = (id: string) => archived.includes(id);
export const isCustom = (id: string) => custom.some((s) => s.id === id);

export function addService(input: Omit<Service, 'id'>): Service {
  const svc: Service = {
    ...input,
    id: `svc-${Date.now().toString(36)}`,
  };
  custom = [...custom, svc];
  persist();
  return svc;
}

/** Убрать из каталога, сохранив в истории */
export function archiveService(id: string) {
  if (!archived.includes(id)) archived = [...archived, id];
  persist();
}

export function restoreService(id: string) {
  archived = archived.filter((x) => x !== id);
  persist();
}

/** Подписка на изменения каталога */
export function useCatalog(): { live: Service[]; all: Service[]; archived: string[] } {
  const [, force] = useState(0);
  useEffect(() => {
    const fn = () => force((x) => x + 1);
    listeners.add(fn);
    return () => { listeners.delete(fn); };
  }, []);
  return { live: liveServices(), all: allKnownServices(), archived };
}
