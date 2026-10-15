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

/**
 * Absolute URL of a public file — for APIs that fetch media themselves
 * (Telegram `shareToStory` downloads the video by URL). This is a media
 * address, not a share link: links people share still come from the server.
 */
export function absoluteAsset(path: string): string {
  return new URL(asset(path), document.baseURI).href;
}
