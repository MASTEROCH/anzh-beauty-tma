// Экспорт по §14.1 — работающий, а не описанный. Проверяется то, из-за
// чего перенос в общую базу может тихо потерять данные:
// детерминированность, совпадение имён колонок со схемой, отсутствие
// секретов и полнота сводки.

import { test, before, after, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, rm, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { mkdtemp } from 'node:fs/promises';
import { startHarness, futureSlot, CLIENT_ID, OWNER_ID, type Harness } from './harness.ts';

/**
 * Считает ЗАПИСИ, а не строки файла.
 *
 * Комментарий клиентки может содержать перевод строки — по RFC 4180 он
 * так и лежит внутри кавычек, и это правильно: экранировать его значило
 * бы поменять данные при выгрузке, чего контракт §14.1 прямо запрещает
 * («никаких переименований на лету и вычисляемых полей»). Наивный
 * `split('\n')` на таком файле насчитал лишнюю запись — первым делом
 * этот тест и поймал сам себя.
 */
function countRecords(text: string): number {
  let records = 0;
  let inQuotes = false;
  let sawContent = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') i++; // удвоенная кавычка — не конец поля
        else inQuotes = false;
      }
      continue;
    }
    if (ch === '"') { inQuotes = true; sawContent = true; continue; }
    if (ch === '\n') {
      if (sawContent) records++;
      sawContent = false;
      continue;
    }
    if (ch !== '\r') sawContent = true;
  }
  if (sawContent) records++; // файл без завершающего перевода строки
  return records;
}

let h: Harness;
let dir: string;
let exportAll: (out?: string) => Promise<{ file: string; table: string; rows: number }[]>;

before(async () => {
  h = await startHarness();
  ({ exportAll } = await import('../src/services/export.ts'));
  dir = await mkdtemp(join(tmpdir(), 'anzh-export-'));

  // Данные, на которых видно всё интересное: юникод, запятые, кавычки,
  // переводы строк, jsonb, время, деньги.
  const token = await h.signIn(CLIENT_ID);
  await h.app.inject({
    method: 'POST',
    url: '/api/v1/bookings',
    headers: { authorization: `Bearer ${token}` },
    payload: {
      slugs: ['lips'],
      starts_at: futureSlot(30),
      note: 'Можно «пораньше», а то\nне успеваю; и ещё, "важно"',
    },
  });
  await h.app.inject({
    method: 'POST',
    url: '/api/v1/staff/pin/set',
    headers: { authorization: `Bearer ${await h.signIn(OWNER_ID)}` },
    payload: { pin: '739154' },
  });
});

after(async () => {
  await rm(dir, { recursive: true, force: true });
  await h.stop();
});

describe('экспорт данных', () => {
  test('кладёт по файлу на таблицу плюс сводку', async () => {
    const summary = await exportAll(dir);
    const files = (await readdir(dir)).sort();

    assert.ok(files.includes('00_summary.csv'));
    // Пользователи — ОТДЕЛЬНЫМ, первым файлом: часть этих людей может
    // уже существовать в общей базе, и вставляются они иначе.
    assert.equal(files[1], '01_users.csv');
    assert.equal(files.length, summary.length + 1);
  });

  test('порядок вставки учитывает внешние ключи', async () => {
    const files = (await readdir(dir)).filter((f) => f !== '00_summary.csv').sort();
    const at = (t: string) => files.findIndex((f) => f.endsWith(`_${t}.csv`));

    assert.ok(at('users') < at('bookings'), 'сначала люди, потом их записи');
    assert.ok(at('services') < at('booking_items'), 'сначала прайс, потом строки визита');
    assert.ok(at('bookings') < at('booking_items'));
    assert.ok(at('bookings') < at('notifications'));
  });

  test('🚨 два запуска подряд дают ОДИНАКОВЫЕ файлы', async () => {
    const first = await readFile(join(dir, '06_bookings.csv'), 'utf8');
    await exportAll(dir);
    const second = await readFile(join(dir, '06_bookings.csv'), 'utf8');
    assert.equal(first, second, 'без этого сверить полноту после вставки нечем');
  });

  test('🚨 хэша PIN в выгрузке нет', async () => {
    const staff = await readFile(join(dir, '02_staff.csv'), 'utf8');
    assert.equal(staff.includes('pin_hash'), false, 'колонки быть не должно');
    assert.equal(staff.includes('scrypt$'), false, 'значения тем более');

    // И вообще нигде по всей выгрузке.
    for (const f of await readdir(dir)) {
      const text = await readFile(join(dir, f), 'utf8');
      assert.equal(text.includes('scrypt$'), false, `секрет просочился в ${f}`);
    }
  });

  test('имена колонок совпадают со схемой', async () => {
    const header = (await readFile(join(dir, '06_bookings.csv'), 'utf8')).split('\n')[0]!;
    const columns = header.split(',');

    const actual = await h.sql<{ column_name: string }[]>`
      select column_name from information_schema.columns
      where table_schema = 'anzh' and table_name = 'bookings'
    `;
    const known = new Set(actual.map((c) => c.column_name));

    for (const c of columns) {
      assert.ok(known.has(c), `колонки «${c}» в схеме нет — при вставке её придётся угадывать`);
    }
  });

  test('даты в ISO-8601 с зоной, а не «как в локали»', async () => {
    const [, row] = (await readFile(join(dir, '06_bookings.csv'), 'utf8')).split('\n');
    assert.ok(row);
    assert.match(row, /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z/);
  });

  test('запятые, кавычки и переводы строк не рвут CSV', async () => {
    const text = await readFile(join(dir, '06_bookings.csv'), 'utf8');
    // Кавычка внутри значения удваивается по RFC 4180.
    assert.ok(text.includes('""важно""'), 'кавычка должна быть экранирована удвоением');
    assert.ok(text.includes('«пораньше»'), 'юникод сохраняется как есть');
  });

  test('сводка сходится с самими файлами', async () => {
    const lines = (await readFile(join(dir, '00_summary.csv'), 'utf8')).trim().split('\n');
    assert.equal(lines[0], 'file,table,rows,note');

    for (const line of lines.slice(1)) {
      const [file, , rows] = line.split(',') as [string, string, string];
      const actual = countRecords(await readFile(join(dir, file), 'utf8')) - 1; // минус заголовок
      assert.equal(actual, Number(rows), `${file}: сводка обещает ${rows}, в файле ${actual}`);
    }
  });
});
