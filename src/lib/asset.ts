/**
 * Resolves a path in `public/` against Vite's base URL.
 *
 * Served from a domain root (Vercel, localhost) the base is `/` and this is
 * a no-op; served from a subpath (GitHub Pages: /anzh-beauty-tma/) it keeps
 * every image resolving. Always route public assets through here rather than
 * writing a leading-slash string.
 */
export function asset(path: string): string {
  return import.meta.env.BASE_URL + path.replace(/^\/+/, '');
}
