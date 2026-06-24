/**
 * utilities.repository.ts
 *
 * All SQLite access for `utility_types` and `utility_logs` lives here.
 * No SQL may appear in screens, hooks, or Zustand stores — they call
 * these functions exclusively.
 *
 * Upsert strategy:
 *   `upsertUtilityLog` uses INSERT OR REPLACE which leverages the UNIQUE
 *   constraint on (utility_type_id, period_year, period_month). When a
 *   duplicate key is detected SQLite deletes the old row and inserts the
 *   new one atomically — effectively an update while preserving the same
 *   semantic intent. The repository generates a fresh id only when no
 *   existing row is found, preserving the original id on conflict.
 *
 * JOIN reads:
 *   `getUtilityLogs` and `getUtilityLogById` return denormalised rows that
 *   include utility_types.name/icon/color/unit so callers never need a
 *   second query.
 *
 * Summary queries:
 *   `getMonthlySummary` and `getYearlySummary` aggregate amounts from
 *   non-deleted logs. Soft-deleted rows (deleted_at IS NOT NULL) are always
 *   excluded from aggregates.
 */

import { getDatabase } from '../database';
import type {
  UtilityTypeRow,
  UtilityLogJoinRow,
} from '../schemas/utilities.schema';
import type { UtilityType, UtilityLog } from '@/types';

// ─── UUID helper ──────────────────────────────────────────────────────────────

function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// ─── Domain mapping ───────────────────────────────────────────────────────────

function typeRowToDomain(row: UtilityTypeRow): UtilityType {
  return {
    id:        row.id,
    name:      row.name,
    icon:      row.icon,
    unit:      row.unit,
    color:     row.color,
    isCustom:  row.is_custom === 1,
    createdAt: row.created_at,
  };
}

function logJoinRowToDomain(row: UtilityLogJoinRow): UtilityLog {
  return {
    id:                row.id,
    utilityTypeId:     row.utility_type_id,
    // LEFT JOIN — fall back to empty strings so the domain type stays non-nullable
    // and the UI can still render a row even when the seed type is missing.
    utilityTypeName:   row.utility_type_name  ?? '',
    utilityTypeIcon:   row.utility_type_icon  ?? '',
    utilityTypeColor:  row.utility_type_color ?? '',
    utilityTypeUnit:   row.utility_type_unit  ?? '',
    periodYear:        row.period_year,
    periodMonth:       row.period_month,
    amount:            row.amount,
    createdAt:         row.created_at,
    updatedAt:         row.updated_at,
    ...(row.consumption !== null ? { consumption: row.consumption } : {}),
    ...(row.due_date    !== null ? { dueDate:     row.due_date    } : {}),
    ...(row.paid_at     !== null ? { paidAt:      row.paid_at     } : {}),
    ...(row.notes       !== null ? { notes:       row.notes       } : {}),
  };
}

// ─── Shared SELECT columns ─────────────────────────────────────────────────────

/**
 * Column list for the utility_logs JOIN query.
 * Keeping this in one place ensures all read functions are consistent.
 */
const LOG_JOIN_SELECT = `
  ul.id,
  ul.utility_type_id,
  ul.period_year,
  ul.period_month,
  ul.consumption,
  ul.amount,
  ul.due_date,
  ul.paid_at,
  ul.notes,
  ul.created_at,
  ul.updated_at,
  ul.is_synced,
  ul.deleted_at,
  ut.name  AS utility_type_name,
  ut.icon  AS utility_type_icon,
  ut.color AS utility_type_color,
  ut.unit  AS utility_type_unit
`;

// ─── Input types ──────────────────────────────────────────────────────────────

export interface CreateUtilityTypeInput {
  name:  string;
  icon:  string;
  unit:  string;
  color: string;
}

export interface UpsertUtilityLogInput {
  utilityTypeId: string;
  periodYear:    number;
  periodMonth:   number;
  amount:        number;
  consumption?:  number;
  dueDate?:      string;
  paidAt?:       string;
  notes?:        string;
}

// ─── Repository functions ─────────────────────────────────────────────────────

/**
 * Returns all utility types including user-created ones.
 * Built-in types (is_custom = 0) are returned first, then custom ones.
 */
export async function getUtilityTypes(): Promise<UtilityType[]> {
  const db = await getDatabase();

  const rows = await db.getAllAsync<UtilityTypeRow>(
    `SELECT id, name, icon, unit, color, is_custom, created_at
     FROM utility_types
     ORDER BY is_custom ASC, created_at ASC`,
    [],
  );

  return rows.map(typeRowToDomain);
}

/**
 * Inserts a new user-defined utility type.
 * Built-in seeds use is_custom = 0; this function always sets is_custom = 1.
 */
export async function createUtilityType(
  input: CreateUtilityTypeInput,
): Promise<UtilityType> {
  const db  = await getDatabase();
  const id  = generateUUID();
  const now = new Date().toISOString();

  await db.runAsync(
    `INSERT INTO utility_types
       (id, name, icon, unit, color, is_custom, created_at)
     VALUES (?, ?, ?, ?, ?, 1, ?)`,
    [id, input.name, input.icon, input.unit, input.color, now],
  );

  return {
    id,
    name:      input.name,
    icon:      input.icon,
    unit:      input.unit,
    color:     input.color,
    isCustom:  true,
    createdAt: now,
  };
}

/**
 * Returns utility logs with their utility_type details joined in.
 * Soft-deleted rows are always excluded.
 *
 * Filters:
 *   year       — restrict to a specific calendar year
 *   month      — restrict to a specific month (1–12)
 *   typeId     — restrict to a single utility type
 *   unpaidOnly — when true, only rows where paid_at IS NULL are returned
 */
export async function getUtilityLogs(filters?: {
  year?:       number;
  month?:      number;
  typeId?:     string;
  unpaidOnly?: boolean;
}): Promise<UtilityLog[]> {
  const db = await getDatabase();

  const conditions: string[] = ['ul.deleted_at IS NULL'];
  const params: (string | number)[] = [];

  if (filters?.year !== undefined) {
    conditions.push('ul.period_year = ?');
    params.push(filters.year);
  }
  if (filters?.month !== undefined) {
    conditions.push('ul.period_month = ?');
    params.push(filters.month);
  }
  if (filters?.typeId !== undefined) {
    conditions.push('ul.utility_type_id = ?');
    params.push(filters.typeId);
  }
  if (filters?.unpaidOnly === true) {
    conditions.push('ul.paid_at IS NULL');
  }

  const where = conditions.join(' AND ');

  const rows = await db.getAllAsync<UtilityLogJoinRow>(
    `SELECT ${LOG_JOIN_SELECT}
     FROM utility_logs ul
     LEFT JOIN utility_types ut ON ut.id = ul.utility_type_id
     WHERE ${where}
     ORDER BY ul.period_year DESC, ul.period_month DESC, ut.name ASC`,
    params,
  );

  return rows.map(logJoinRowToDomain);
}

/**
 * Returns a single utility log by id, with utility_type details joined.
 * Returns null when not found or soft-deleted.
 */
export async function getUtilityLogById(id: string): Promise<UtilityLog | null> {
  const db = await getDatabase();

  const row = await db.getFirstAsync<UtilityLogJoinRow>(
    `SELECT ${LOG_JOIN_SELECT}
     FROM utility_logs ul
     LEFT JOIN utility_types ut ON ut.id = ul.utility_type_id
     WHERE ul.id = ? AND ul.deleted_at IS NULL`,
    [id],
  );

  return row !== null ? logJoinRowToDomain(row) : null;
}

/**
 * Inserts or replaces the utility log for a given (utilityTypeId, year, month).
 *
 * Strategy:
 *   1. Check whether a non-deleted row already exists for the period.
 *   2. If yes, preserve its id and created_at; UPDATE the mutable columns.
 *   3. If no, INSERT a fresh row.
 *
 * This two-step approach avoids the INSERT OR REPLACE issue where the old
 * row's id and created_at are lost on a conflict-triggered replacement.
 */
export async function upsertUtilityLog(
  input: UpsertUtilityLogInput,
): Promise<UtilityLog> {
  const db  = await getDatabase();
  const now = new Date().toISOString();

  // Search for ANY existing row for this period — including soft-deleted ones.
  // We must include deleted rows because the UNIQUE constraint on
  // (utility_type_id, period_year, period_month) spans the whole table, not just
  // live rows. If we only look at deleted_at IS NULL and a soft-deleted row exists,
  // the subsequent INSERT would hit a UNIQUE constraint violation.
  const existing = await db.getFirstAsync<{
    id:         string;
    created_at: string;
    deleted_at: string | null;
  }>(
    `SELECT id, created_at, deleted_at FROM utility_logs
     WHERE utility_type_id = ? AND period_year = ? AND period_month = ?`,
    [input.utilityTypeId, input.periodYear, input.periodMonth],
  );

  let logId: string;
  let createdAt: string;

  if (existing !== null) {
    // UPDATE the existing record (whether live or soft-deleted):
    //   - Clear deleted_at so a previously soft-deleted entry is revived.
    //   - Preserve the original id and created_at for history continuity.
    logId     = existing.id;
    createdAt = existing.created_at;

    await db.runAsync(
      `UPDATE utility_logs
       SET amount          = ?,
           consumption     = ?,
           due_date        = ?,
           paid_at         = ?,
           notes           = ?,
           updated_at      = ?,
           is_synced       = 0,
           deleted_at      = NULL
       WHERE id = ?`,
      [
        input.amount,
        input.consumption   ?? null,
        input.dueDate       ?? null,
        input.paidAt        ?? null,
        input.notes         ?? null,
        now,
        logId,
      ],
    );
  } else {
    // INSERT a new record — safe because no row (live or deleted) exists for
    // this (utility_type_id, period_year, period_month) combination.
    logId     = generateUUID();
    createdAt = now;

    await db.runAsync(
      `INSERT INTO utility_logs
         (id, utility_type_id, period_year, period_month,
          amount, consumption, due_date, paid_at, notes,
          created_at, updated_at, is_synced, deleted_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, NULL)`,
      [
        logId,
        input.utilityTypeId,
        input.periodYear,
        input.periodMonth,
        input.amount,
        input.consumption ?? null,
        input.dueDate     ?? null,
        input.paidAt      ?? null,
        input.notes       ?? null,
        createdAt,
        now,
      ],
    );
  }

  // Re-read with JOIN to return a fully populated domain object
  const result = await getUtilityLogById(logId);
  if (result === null) {
    throw new Error(
      `[utility_logs] upsertUtilityLog: write succeeded but SELECT returned null for id=${logId}`,
    );
  }
  return result;
}

/**
 * Marks a utility log as paid.
 * `paidAt` defaults to the current ISO timestamp when omitted.
 */
export async function markUtilityPaid(
  id:      string,
  paidAt?: string,
): Promise<void> {
  const db  = await getDatabase();
  const now = new Date().toISOString();

  await db.runAsync(
    `UPDATE utility_logs
     SET paid_at    = ?,
         updated_at = ?,
         is_synced  = 0
     WHERE id = ? AND deleted_at IS NULL`,
    [paidAt ?? now, now, id],
  );
}

/**
 * Soft-deletes a utility log by setting deleted_at to the current timestamp.
 */
export async function deleteUtilityLog(id: string): Promise<void> {
  const db  = await getDatabase();
  const now = new Date().toISOString();

  await db.runAsync(
    `UPDATE utility_logs
     SET deleted_at = ?,
         updated_at = ?,
         is_synced  = 0
     WHERE id = ? AND deleted_at IS NULL`,
    [now, now, id],
  );
}

/**
 * Returns a payment summary for a single calendar month.
 *
 * Result fields:
 *   totalAmount   — sum of all non-deleted bills for the month
 *   paidAmount    — sum of bills where paid_at IS NOT NULL
 *   unpaidAmount  — totalAmount - paidAmount
 *   count         — total number of non-deleted bills
 *   paidCount     — number of paid bills
 */
export async function getMonthlySummary(
  year:  number,
  month: number,
): Promise<{
  totalAmount:   number;
  paidAmount:    number;
  unpaidAmount:  number;
  count:         number;
  paidCount:     number;
}> {
  const db = await getDatabase();

  const row = await db.getFirstAsync<{
    total_amount:  number | null;
    paid_amount:   number | null;
    total_count:   number;
    paid_count:    number;
  }>(
    `SELECT
       SUM(amount)                                             AS total_amount,
       SUM(CASE WHEN paid_at IS NOT NULL THEN amount ELSE 0 END) AS paid_amount,
       COUNT(*)                                               AS total_count,
       SUM(CASE WHEN paid_at IS NOT NULL THEN 1 ELSE 0 END)  AS paid_count
     FROM utility_logs
     WHERE period_year  = ?
       AND period_month = ?
       AND deleted_at IS NULL`,
    [year, month],
  );

  const totalAmount  = row?.total_amount ?? 0;
  const paidAmount   = row?.paid_amount  ?? 0;
  const count        = row?.total_count  ?? 0;
  const paidCount    = row?.paid_count   ?? 0;

  return {
    totalAmount,
    paidAmount,
    unpaidAmount: totalAmount - paidAmount,
    count,
    paidCount,
  };
}

/**
 * Returns 12 rows representing total billed amounts per month for a calendar year.
 * Months with no records are included with totalAmount = 0 so callers can
 * render a full 12-point chart without gap handling.
 *
 * Returns rows ordered by month ascending (January = 1 … December = 12).
 */
export async function getYearlySummary(
  year: number,
): Promise<{ month: number; totalAmount: number }[]> {
  const db = await getDatabase();

  const rows = await db.getAllAsync<{
    period_month: number;
    total_amount: number;
  }>(
    `SELECT period_month,
            SUM(amount) AS total_amount
     FROM utility_logs
     WHERE period_year = ?
       AND deleted_at IS NULL
     GROUP BY period_month
     ORDER BY period_month ASC`,
    [year],
  );

  // Build a full 12-entry array, filling in 0 for months with no data
  const byMonth = new Map<number, number>();
  for (const row of rows) {
    byMonth.set(row.period_month, row.total_amount);
  }

  return Array.from({ length: 12 }, (_, i) => ({
    month:       i + 1,
    totalAmount: byMonth.get(i + 1) ?? 0,
  }));
}
