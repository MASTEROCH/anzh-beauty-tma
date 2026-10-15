#!/usr/bin/env node
// tools/check-share-links.mjs — share/referral links come from the SERVER only (AppHub rule §18).
//
//   node tools/check-share-links.mjs              scan src/ (runs first in `npm run build`)
//   node tools/check-share-links.mjs --root <dir> scan another tree (tests)
//   exit 0 — clean; 1 — a forbidden pattern (file:line and the rule are printed); 2 — usage.
//
// Why a build gate and not a review note: the same mistake came back three times in the ecosystem
// (bare bot links, preview domains, `window.location.href` in shares). Here the invariant already
// holds — the screens take Me.referral_link as a finished string and only wrap it into
// t.me/share/url — and this file keeps it holding: the build fails before a regression ships.
//
// Forbidden in client code (comments are skipped):
//   R1  a hardcoded link to a bot (t.me/<name>bot…) — the bot comes from the server (BOT_USERNAME);
//   R2  building `startapp=` on the client — the server assembles the whole link (§18.2);
//   R3  building `ref_` + something on the client — same, and it is how telegram_id leaks (§18.5);
//   R4  window.location.href / location.origin in a share — a preview domain instead of the app link;
//   R5  a hardcoded *.vercel.app address.
// Allowed on purpose: t.me/share/url (Telegram's share endpoint wrapping the server link), the
// studio's public channel (t.me/anzh_cosmetology), and t.me/${…} built from a person's or the
// studio's username (a chat link, not an app link).

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
let root = resolve(HERE, '..', 'src');
if (args.length) {
  if (args[0] !== '--root' || !args[1] || args.length !== 2) {
    console.error('usage: node tools/check-share-links.mjs [--root <dir>]');
    process.exit(2);
  }
  root = resolve(args[1]);
}

const RULES = [
  { id: 'R1', re: /t\.me\/(?!share\/url\b)(?!anzh_cosmetology\b)(?!\$\{)[A-Za-z0-9_]*bot\b/i, why: 'ссылка на бота строкой — бот приходит с сервера (BOT_USERNAME)' },
  { id: 'R2', re: /startapp=/, why: 'клиент собирает startapp= — ссылку собирает только сервер (§18.2)' },
  { id: 'R3', re: /['"`]ref_['"`]?\s*\+|`ref_\$\{/, why: 'клиент собирает ref_… — ссылку собирает только сервер (§18.5)' },
  { id: 'R4', re: /(share|Share|clipboard)[^\n]*location\.(href|origin)|location\.(href|origin)[^\n]*(share|Share)/, why: 'адрес страницы в шеринге — уйдёт служебный домен вместо ссылки приложения' },
  { id: 'R5', re: /[a-z0-9-]+\.vercel\.app/i, why: 'домен Vercel строкой в клиенте' },
];

const EXT = /\.(ts|tsx|js|jsx|mjs)$/;
function* walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) yield* walk(p);
    else if (EXT.test(name)) yield p;
  }
}

/** Code without comments, line numbers kept (block comments become blank lines). */
function stripComments(text) {
  let out = '';
  let i = 0;
  let inStr = null;
  while (i < text.length) {
    const c = text[i];
    const n = text[i + 1];
    if (inStr) {
      out += c;
      if (c === '\\') { out += n ?? ''; i += 2; continue; }
      if (c === inStr) inStr = null;
      i += 1;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') { inStr = c; out += c; i += 1; continue; }
    if (c === '/' && n === '/') { while (i < text.length && text[i] !== '\n') i += 1; continue; }
    if (c === '/' && n === '*') {
      i += 2;
      while (i < text.length && !(text[i] === '*' && text[i + 1] === '/')) { if (text[i] === '\n') out += '\n'; i += 1; }
      i += 2;
      continue;
    }
    out += c;
    i += 1;
  }
  return out;
}

let files = 0;
const found = [];
try {
  for (const file of walk(root)) {
    files += 1;
    const lines = stripComments(readFileSync(file, 'utf8')).split('\n');
    lines.forEach((line, idx) => {
      for (const r of RULES) if (r.re.test(line)) found.push(`${relative(process.cwd(), file)}:${idx + 1}  ${r.id} ${r.why}`);
    });
  }
} catch (e) {
  console.error(`check-share-links: не прочитать ${root}: ${e.code || e.message}`);
  process.exit(2);
}

if (found.length) {
  console.error(`🔴 check-share-links: ${found.length} нарушение(й) правила §18 (ссылки — только с сервера):`);
  for (const f of found) console.error(`   ${f}`);
  process.exit(1);
}
console.log(`✅ check-share-links: ${files} файлов, ссылки шеринга — только серверные`);
