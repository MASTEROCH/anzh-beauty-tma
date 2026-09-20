// Заливает seed.sql. Отдельной командой, а не миграцией: тестовые
// данные в боевую базу не едут (контракт §5.4).

import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sql, closeDatabase } from '../src/db.ts';
import { config } from '../src/config.ts';

const FILE = join(dirname(fileURLToPath(import.meta.url)), '..', 'seed.sql');

try {
  if (config.isProduction) {
    // Заготовки с выдуманными именами в боевой базе — это те самые
    // «это демо», которые переживают все переделки и всплывают у
    // клиента (контракт §13).
    throw new Error('NODE_ENV=production — тестовые данные в боевую базу не заливаются.');
  }
  await sql.unsafe(await readFile(FILE, 'utf8')).simple();
  console.log('Тестовые данные залиты.');
} catch (err) {
  console.error('🚨 Не удалось залить:', err instanceof Error ? err.message : err);
  process.exitCode = 1;
} finally {
  await closeDatabase();
}
