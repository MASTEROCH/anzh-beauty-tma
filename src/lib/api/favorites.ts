// Провод «закладки» — избранные процедуры на сервере, а не только в телефоне.
// 🔴 [ПРЕДЛОЖЕНИЕ БЭКЕНДУ] Без них сервер не знает, что человек хотел сделать,
// и не может написать «есть окно на вашу процедуру» (напоминания в боте).
//   GET /me/favorites          → {slugs: string[], updated_at}
//   PUT /me/favorites {slugs}  → {slugs, updated_at}   (целиком, до 50 slug'ов)
import { apiRequest } from '../session';

export async function getFavorites(): Promise<string[]> {
  const r = await apiRequest<{ slugs: string[] }>('GET', '/me/favorites');
  return Array.isArray(r?.slugs) ? r.slugs.filter((x) => typeof x === 'string') : [];
}
export async function putFavorites(slugs: string[]): Promise<string[]> {
  const r = await apiRequest<{ slugs: string[] }>('PUT', '/me/favorites', { body: { slugs: slugs.slice(0, 50) } });
  return Array.isArray(r?.slugs) ? r.slugs : slugs;
}
