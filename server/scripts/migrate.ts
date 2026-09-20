// Миграции применяются ЭТИМ скриптом и никогда руками в консоли базы
// (контракт §5.4, §13). Применённое руками невоспроизводимо — переносить
// будет нечего.
//
//   npm run migrate           применить всё неприменённое
//   npm run migrate:status    показать, что применено, ничего не меняя
//
// Правила:
//  · файлы NNN_description.sql, трёхзначные, без пропусков;
//  · только вперёд — применённую миграцию не переписывают, изменение
//    оформляется новым файлом;
//  · факт применения записывается в anzh.schema_migrations вместе с
//    контрольной суммой: если файл после применения изменили, скрипт
//    остановится и скажет какой. Молча накатить расхождение нельзя.

import { readdir, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sql, closeDatabase } from '../src/db.ts';

const DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'migrations');
const NAME = /^(\d{3})_[a-z0-9_]+\.sql$/;

interface Migration {
  version: number;
  file: string;
  body: string;
  checksum: string;
}

async function load(): Promise<Migration[]> {
  const files = (await readdir(DIR)).filter((f) => f.endsWith('.sql')).sort();

  const out: Migration[] = [];
  for (const file of files) {
    const m = NAME.exec(file);
    if (!m) {
      throw new Error(
        `Файл миграции «${file}» назван не по правилу NNN_description.sql (три цифры, нижний регистр).`,
      );
    }
    const body = await readFile(join(DIR, file), 'utf8');
    out.push({
      version: Number(m[1]),
      file,
      body,
      checksum: createHash('sha256').update(body).digest('hex'),
    });
  }

  // Пропуск в нумерации — почти всегда потерянный при слиянии файл.
  // Лучше остановиться здесь, чем получить схему без одной таблицы.
  out.forEach((mig, i) => {
    if (mig.version !== i + 1) {
      throw new Error(
        `Пропуск в нумерации миграций: после ${i} ожидался ${String(i + 1).padStart(3, '0')}, найден ${mig.file}.`,
      );
    }
  });

  return out;
}

async function ensureTable(): Promise<void> {
  // Схему создаёт 001, но таблица учёта нужна раньше неё — поэтому
  // создаётся здесь и живёт в public: она про процесс, а не про домен.
  await sql`
    create table if not exists public.anzh_schema_migrations (
      version     integer primary key,
      file        text not null,
      checksum    text not null,
      applied_at  timestamptz not null default now()
    )
  `;
}

interface AppliedRow {
  version: number;
  file: string;
  checksum: string;
  applied_at: Date;
}

async function applied(): Promise<Map<number, AppliedRow>> {
  const rows = await sql<AppliedRow[]>`
    select version, file, checksum, applied_at
    from public.anzh_schema_migrations
    order by version
  `;
  return new Map(rows.map((r) => [r.version, r]));
}

async function main(): Promise<void> {
  const statusOnly = process.argv.includes('--status');

  await ensureTable();
  const all = await load();
  const done = await applied();

  // Только вперёд: изменённый задним числом файл означает, что схема в
  // базе и схема в репозитории разошлись.
  const drifted = all.filter((m) => {
    const row = done.get(m.version);
    return row && row.checksum !== m.checksum;
  });
  if (drifted.length > 0) {
    console.error('🚨 Применённые миграции изменены после применения:');
    for (const m of drifted) console.error(`   ${m.file}`);
    console.error(
      '\nПрименённую миграцию не переписывают. Верните файл как был и оформите\n' +
        'изменение новым файлом (контракт §5.4).',
    );
    process.exitCode = 1;
    return;
  }

  const pending = all.filter((m) => !done.has(m.version));

  if (statusOnly) {
    for (const m of all) {
      const row = done.get(m.version);
      const when = row ? row.applied_at.toISOString() : '—';
      console.log(`${row ? '✓' : '·'} ${m.file.padEnd(28)} ${when}`);
    }
    console.log(`\nприменено ${done.size} из ${all.length}, ожидает ${pending.length}`);
    return;
  }

  if (pending.length === 0) {
    console.log(`Нечего применять: все ${all.length} миграций уже в базе.`);
    return;
  }

  for (const m of pending) {
    // Каждая миграция — одна транзакция. Упавшая на середине не оставит
    // половину таблиц.
    await sql.begin(async (tx) => {
      await tx.unsafe(m.body).simple();
      await tx`
        insert into public.anzh_schema_migrations (version, file, checksum)
        values (${m.version}, ${m.file}, ${m.checksum})
      `;
    });
    console.log(`✓ ${m.file}`);
  }

  console.log(`\nПрименено миграций: ${pending.length}.`);
}

try {
  await main();
} catch (err) {
  console.error('🚨 Миграции не применены:', err instanceof Error ? err.message : err);
  process.exitCode = 1;
} finally {
  await closeDatabase();
}
