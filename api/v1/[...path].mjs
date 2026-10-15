// ДЕМО-СЕРВЕР ссылки прототипа: локальный стенд (tools/dev-stand.mjs) как
// функция Vercel. Данные — в /tmp экземпляра: демонстрационные и могут
// сброситься при простое. Настоящий бэкенд — отдельный проект (BACKEND-SPEC.md).
process.env.STAND_DATA ??= '/tmp/anzh-stand';
const stand = await import('../../tools/dev-stand.mjs');

export default async function handler(req, res) {
  return stand.handle(req, res);
}
