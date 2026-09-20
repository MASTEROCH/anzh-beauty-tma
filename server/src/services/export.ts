// Выгрузка накопленных данных для переноса в общую базу (контракт §14.1).
//
// Перенос — разовая ручная операция на стороне платформы. Поэтому от
// нас нужен не доступ к базе, а ВОСПРОИЗВОДИМЫЙ экспорт: два запуска
// подряд дают побайтово одинаковые файлы, и по ним видно, что между
// выгрузкой и вставкой ничего не потерялось.
//
//   npm run export [-- --out=папка]
//
// Требования, которые здесь соблюдаются буквально:
//  · имена колонок в файле совпадают с именами в схеме — никаких
//    переименований на лету и вычисляемых полей;
//  · CSV в UTF-8, даты ISO-8601 с часовым поясом;
//  · детерминированный порядок — сортировка по ключу;
//  · файлы пронумерованы в порядке вставки, с учётом внешних ключей;
//  · отдельный файл-сводка с числом строк;
//  · ни одного секрета в выгрузке.

import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { sql } from '../db.ts';

interface TableSpec {
  /** Имя как в схеме. */
  table: string;
  /** Колонки — ровно как в схеме. Секреты сюда не попадают. */
  columns: string[];
  /** Детерминированный порядок. */
  orderBy: string;
  note?: string;
}

// Порядок = порядок вставки. Сначала то, на что ссылаются.
//
// 🚨 users идёт ОТДЕЛЬНЫМ, первым файлом и не смешивается с остальным:
// часть этих людей может уже существовать в общей базе (человек мог
// пользоваться другим приложением экосистемы), и вставляться они будут
// иначе, чем всё прочее.
const TABLES: TableSpec[] = [
  {
    table: 'users',
    columns: [
      'telegram_id', 'referral_code', 'referred_by',
      'first_name', 'last_name', 'username', 'language_code', 'photo_url',
      'can_message', 'notify_reminders', 'notify_review', 'notify_marketing',
      'app_source', 'created_at', 'updated_at', 'deleted_at', 'metadata',
    ],
    orderBy: 'telegram_id',
    note: 'вставляется отдельно; referred_by НЕ перезаписывает существующее значение',
  },
  {
    table: 'staff',
    // pin_hash ОТСУТСТВУЕТ намеренно: хэшей PIN в выгрузке быть не должно.
    columns: [
      'telegram_id', 'name', 'title', 'role', 'photo_url', 'active',
      'app_source', 'created_at', 'updated_at', 'deleted_at', 'metadata',
    ],
    orderBy: 'telegram_id',
    note: 'без pin_hash — секреты не выгружаются',
  },
  {
    table: 'services',
    columns: [
      'id', 'slug', 'kind', 'category', 'zone',
      'title_ru', 'title_en', 'subtitle_ru', 'subtitle_en',
      'description_ru', 'description_en',
      'price_minor', 'currency', 'stars_amount', 'price_from',
      'duration_min', 'days', 'includes', 'contraindications',
      'photo_url', 'sort', 'archived_at',
      'app_source', 'created_at', 'updated_at', 'deleted_at', 'metadata',
    ],
    orderBy: 'id',
  },
  { table: 'staff_services', columns: ['staff_id', 'service_id', 'created_at'], orderBy: 'staff_id, service_id' },
  { table: 'referrals', columns: ['id', 'referrer_id', 'referred_id', 'app_source', 'created_at'], orderBy: 'id', note: 'переносятся ВСЕ строки' },
  {
    table: 'bookings',
    columns: [
      'id', 'telegram_id', 'staff_id', 'starts_at', 'duration_min', 'status',
      'total_minor', 'currency', 'discount_percent', 'client_note',
      'decline_reason', 'decided_by', 'decided_at',
      'app_source', 'created_at', 'updated_at', 'deleted_at', 'metadata',
    ],
    orderBy: 'id',
  },
  { table: 'booking_items', columns: ['id', 'booking_id', 'service_id', 'price_minor', 'currency', 'duration_min', 'sort', 'created_at'], orderBy: 'id' },
  { table: 'consents', columns: ['id', 'telegram_id', 'kind', 'policy_version', 'granted_at', 'revoked_at', 'app_source'], orderBy: 'id' },
  { table: 'health_profiles', columns: ['telegram_id', 'answers', 'policy_version', 'created_at', 'updated_at', 'deleted_at', 'app_source'], orderBy: 'telegram_id', note: '🔒 данные о здоровье' },
  { table: 'analyses', columns: ['id', 'telegram_id', 'analysis_slug', 'answers', 'outcome', 'completed_at', 'created_at', 'updated_at', 'deleted_at', 'app_source'], orderBy: 'id', note: '🔒 данные о здоровье' },
  { table: 'health_access_log', columns: ['id', 'actor_id', 'subject_id', 'object', 'reason_id', 'at'], orderBy: 'id' },
  { table: 'purchases', columns: ['id', 'telegram_id', 'product_kind', 'product_slug', 'stars_amount', 'telegram_payment_charge_id', 'provider_payment_charge_id', 'invoice_payload', 'status', 'refunded_at', 'app_source', 'created_at', 'updated_at', 'metadata'], orderBy: 'id' },
  { table: 'reviews', columns: ['id', 'telegram_id', 'booking_id', 'service_id', 'rating', 'body', 'photo_url', 'published', 'app_source', 'created_at', 'updated_at', 'deleted_at'], orderBy: 'id' },
  { table: 'quest_completions', columns: ['id', 'telegram_id', 'kind', 'percent', 'basis_table', 'basis_id', 'confirmed_by', 'confirmed_at', 'app_source', 'created_at'], orderBy: 'id' },
  { table: 'loyalty_ledger', columns: ['id', 'telegram_id', 'delta', 'reason', 'booking_id', 'comment', 'created_by', 'app_source', 'created_at'], orderBy: 'id' },
  { table: 'notifications', columns: ['id', 'telegram_id', 'template', 'payload', 'channel', 'send_at', 'status', 'attempts', 'last_error', 'sent_at', 'booking_id', 'app_source', 'created_at', 'updated_at'], orderBy: 'id' },
];

// anzh.idempotency не выгружается сознательно: это служебная память о
// повторах запросов за последние сутки, переносить её некуда и незачем.

function cell(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value.toISOString();      // ISO-8601 с зоной
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

/** RFC 4180: кавычим только когда надо, кавычку удваиваем. */
function csv(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
}

export interface ExportSummary {
  file: string;
  table: string;
  rows: number;
  note: string;
}

/** Возвращает сводку — её же пишет в 00_summary.csv. */
export async function exportAll(outDir = 'export-out'): Promise<ExportSummary[]> {
  const dir = resolve(outDir);
  await mkdir(dir, { recursive: true });

  const summary: ExportSummary[] = [];

  for (const [index, spec] of TABLES.entries()) {
    const rows = await sql.unsafe(
      `select ${spec.columns.join(', ')} from anzh.${spec.table} order by ${spec.orderBy}`,
    );

    const lines = [spec.columns.join(',')];
    for (const row of rows) {
      lines.push(
        spec.columns.map((c) => csv(cell((row as Record<string, unknown>)[c]))).join(','),
      );
    }

    const name = `${String(index + 1).padStart(2, '0')}_${spec.table}.csv`;
    // Завершающий перевод строки: без него два разных инструмента
    // читают последнюю строку по-разному.
    await writeFile(join(dir, name), lines.join('\n') + '\n', 'utf8');

    summary.push({ file: name, table: spec.table, rows: rows.length, note: spec.note ?? '' });

  }

  // Файл-сводка: по нему после вставки сверяется полнота.
  const head = 'file,table,rows,note';
  const body = summary.map((s) => [s.file, s.table, s.rows, csv(s.note)].join(','));
  await writeFile(join(dir, '00_summary.csv'), [head, ...body].join('\n') + '\n', 'utf8');

  return summary;
}

