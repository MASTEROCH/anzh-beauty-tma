#!/usr/bin/env node
// Каталог для демо-сервера на Vercel: src/data/services.ts → tools/stand-seed.json.
// В функции Vercel нет ни исходников TS, ни esbuild — стенд берёт готовый JSON.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { transformSync } from 'esbuild';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = fs.readFileSync(path.join(ROOT, 'src/data/services.ts'), 'utf8');
const js = transformSync(src, { loader: 'ts', format: 'esm' }).code;
const mod = await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);
fs.writeFileSync(path.join(ROOT, 'tools/stand-seed.json'), JSON.stringify(mod.services));
console.log(`✅ build-seed: ${mod.services.length} услуг → tools/stand-seed.json`);
