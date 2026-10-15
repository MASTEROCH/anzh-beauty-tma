// ДЕМО-СЕРВЕР ссылки прототипа: локальный стенд (tools/dev-stand.mjs) как
// функция Vercel. Данные — в /tmp экземпляра: демонстрационные и могут
// сброситься при простое. Настоящий бэкенд — отдельный проект (BACKEND-SPEC.md).
//
// Все /api/v1/* переписываются сюда (vercel.json) с исходным путём в `__p`:
// файловый catch-all `[...path]` у функций без Next ловит лишь один сегмент.
process.env.STAND_DATA ??= '/tmp/anzh-stand';
const stand = await import('../tools/dev-stand.mjs');

export default async function handler(req, res) {
  const u = new URL(req.url, 'http://x');
  const p = u.searchParams.get('__p');
  if (p !== null) {
    u.searchParams.delete('__p');
    const qs = u.searchParams.toString();
    req.url = `/api/v1/${p}${qs ? `?${qs}` : ''}`;
  }
  return stand.handle(req, res);
}
