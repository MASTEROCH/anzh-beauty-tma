// Тонкая обёртка: вся логика — в src/services/export.ts, чтобы её
// можно было прогнать тестом. Требование §14.1 звучит как «работающая,
// а не описанная» — значит, она обязана быть исполняемой из теста.
//
//   npm run export [-- --out=папка]

import { exportAll } from '../src/services/export.ts';
import { closeDatabase } from '../src/db.ts';

try {
  const outArg = process.argv.find((a) => a.startsWith('--out='));
  const summary = await exportAll(outArg ? outArg.slice(6) : 'export-out');

  for (const s of summary) {
    console.log(`${s.file.padEnd(30)} ${String(s.rows).padStart(6)} строк`);
  }
  const total = summary.reduce((n, s) => n + s.rows, 0);
  console.log(`\nВыгружено ${summary.length} таблиц, ${total} строк.`);
  console.log('Секретов в выгрузке нет: pin_hash и служебные ключи не экспортируются.');
} catch (err) {
  console.error('🚨 Экспорт не выполнен:', err instanceof Error ? err.message : err);
  process.exitCode = 1;
} finally {
  await closeDatabase();
}
