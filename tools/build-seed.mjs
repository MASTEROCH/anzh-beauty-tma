#!/usr/bin/env node
// Данные для стенда из ТЕХ ЖЕ файлов, что читает приложение:
//   src/data/services.ts → каталог;  src/data/team.ts → команда (профили, фото, услуги).
// Запуск руками пишет tools/stand-seed.json — его берёт демо-сервер на Vercel,
// где нет ни исходников TS, ни esbuild. Локальный стенд собирает свежие данные сам.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

async function load(entry) {
  const { build } = await import('esbuild');
  const out = await build({
    entryPoints: [path.join(ROOT, entry)], bundle: true, format: 'esm', write: false,
    platform: 'neutral', logLevel: 'silent', define: { 'import.meta.env': '{}' },
  });
  return import(`data:text/javascript;base64,${Buffer.from(out.outputFiles[0].text).toString('base64')}`);
}

export async function buildSeed() {
  const { services } = await load('src/data/services.ts');
  const t = await load('src/data/team.ts');
  const team = t.TEAM.map((m, i) => {
    const photo = t.teamPhoto(m);
    const bio = t.TEAM_BIO[m.id];
    return {
      key: m.id,
      name: m.name, surname: m.surname ?? null, role: m.role, short: m.short ?? null,
      photo_url: photo ? photo.src : null, focus: m.focus ?? null,
      cred: bio?.cred ?? null, does: bio?.does ?? { ru: [], en: [] },
      services: [...(t.MASTER_SERVICES[m.id] ?? [])],
      visible: true, sort: i,
    };
  });
  return { services, team };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const seed = await buildSeed();
  fs.writeFileSync(path.join(ROOT, 'tools/stand-seed.json'), JSON.stringify(seed));
  console.log(`✅ build-seed: ${seed.services.length} услуг, ${seed.team.length} в команде → tools/stand-seed.json`);
}
