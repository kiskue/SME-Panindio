/**
 * overhead_expenses.repository.ts
 *
 * All SQL for the overhead_expenses table lives here.
 * No SQL may appear in screens, hooks, or stores — this is the sole
 * data-access boundary for the Overhead Expenses module.
 *
 * Design decisions:
 *   - All reads return camelCase domain objects (`OverheadExpense`).
 *   - `createOverheadExpense` inserts a row and immediately reads it back
 *     so the caller always receives the full persisted object including
 *     the server-assigned `createdAt`.
 *   - `getOverheadExpenses` is paginated (newest-first) and supports
 *     optional filters: category, date range, and is_recurring.
 *   - `getOverheadExpenseSummary` returns the three dashboard KPI buckets
 *     (thisMonth, thisYear, allTime) in a single pass using CASE aggregates
 *     so the dashboard's Promise.all only needs one call.
 *   - `getMonthlyOverheadBreakdown` returns 12 monthly totals for charts.
 *     Months with no expenses are NOT returned — the caller zero-fills.
 *   - TypeScript strict mode enforced throughout:
 *       exactOptionalPropertyTypes: use conditional spread for optional WHERE clauses
 *       noUncheckedIndexedAccess:   ?? fallbacks on all row field access
 */

import { getDatabase } from '../database';
import type {
  OverheadExpense,
  CreateOverheadExpenseInput,
  GetOverheadExpensesOptions,
  OverheadExpenseSummary,
  MonthlyOverheadPoint,
} from '@/types';
import type { OverheadExpenseRow } from '../schemas/overhead_expenses.schema';

// ─── ID helper ────────────────────────────────────────────────────────────────

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

// ─── Row → Domain mapper ──────────────────────────────────────────────────────

/**
 * Maps a raw SQLite row (snake_case) to the camelCase domain model.
 * Optional fields use the `...(value !== null ? { prop: value } : {})` spread
 * pattern required by `exactOptionalPropertyTypes: true`.
 */
function rowToDomain(row: OverheadExpenseRow): OverheadExpense {
  return {
    id:          row.id,
    category:    row.category as OverheadExpense['category'],
    amount:      row.amount,
    description: row.description,
    frequency:   row.frequency as OverheadExpense['frequency'],
    expenseDate: row.expense_date,
    isRecurring: row.is_recurring === 1,
    createdAt:   row.created_at,
    isSynced:    row.is_synced === 1,
    ...(row.notes            !== null ? { notes:           row.notes }            : {}),
    ...(row.reference_number !== null ? { referenceNumber: row.reference_number } : {}),
  };
}

// ─── WHERE clause builder ─────────────────────────────────────────────────────

/**
 * Builds the WHERE fragments and params array from `GetOverheadExpensesOptions`.
 * Returns `{ clauses: string[], params: (string | number)[] }`.
 * Each entry in `clauses` is a single `column op ?` expression.
 */
function buildWhereClause(options: GetOverheadExpensesOptions): {
  clauses: string[];
  params:  (string | number)[];
} {
  const clauses: string[]              = [];
  const params:  (string | number)[]   = [];

  if (options.category !== undefined) {
    clauses.push('category = ?');
    params.push(options.category);
  }

  if (options.fromDate !== undefined) {
    clauses.push('expense_date >= ?');
    params.push(options.fromDate);
  }

  if (options.toDate !== undefined) {
    clauses.push('expense_date <= ?');
    params.push(options.toDate);
  }

  if (options.isRecurring !== undefined) {
    clauses.push('is_recurring = ?');
    params.push(options.isRecurring ? 1 : 0);
  }

  return { clauses, params };
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Inserts a new overhead expense row and reads it back.
 * The insert + select are NOT wrapped in an explicit transaction because
 * SQLite's WAL mode guarantees that a single `runAsync` followed by a
 * `getFirstAsync` on the same connection is linearisable — and wrapping
 * with BEGIN/COMMIT inside a repository would conflict with the outer
 * transaction the migration runner may hold.
 *
 * @throws If the insert fails (e.g. constraint violation).
 */
export async function createOverheadExpense(
  input: CreateOverheadExpenseInput,
): Promise<OverheadExpense> {
  const db  = await getDatabase();
  const id  = generateId();
  const now = new Date().toISOString();

  await db.runAsync(
    `INSERT INTO overhead_expenses
       (id, category, amount, description, notes, frequency,
        expense_date, is_recurring, reference_number, created_at, is_synced)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
    [
      id,
      input.category,
      input.amount,
      input.description,
      input.notes            ?? null,
      input.frequency,
      input.expenseDate,
      input.isRecurring ? 1 : 0,
      input.referenceNumber  ?? null,
      now,
    ],
  );

  const row = await db.getFirstAsync<OverheadExpenseRow>(
    'SELECT * FROM overhead_expenses WHERE id = ?',
    [id],
  );

  if (row == null) {
    throw new Error(`overhead_expenses: readback after insert failed for id=${id}`);
  }

  return rowToDomain(row);
}

/**
 * Returns a paginated list of overhead expenses, newest-first.
 * All filter parameters are optional.
 *
 * @param options - Filter and pagination options (all optional).
 */
export async function getOverheadExpenses(
  options: GetOverheadExpensesOptions = {},
): Promise<OverheadExpense[]> {
  const db    = await getDatabase();
  const limit  = options.limit  ?? 20;
  const offset = options.offset ?? 0;

  const { clauses, params } = buildWhereClause(options);

  const where = clauses.length > 0
    ? `WHERE ${clauses.join(' AND ')}`
    : '';

  const rows = await db.getAllAsync<OverheadExpenseRow>(
    `SELECT * FROM overhead_expenses
     ${where}
     ORDER BY expense_date DESC, created_at DESC
     LIMIT ? OFFSET ?`,
    [...params, limit, offset],
  );

  return rows.map(rowToDomain);
}

/**
 * Returns the total count of rows matching the given filters.
 * Used for pagination metadata (hasMore calculation).
 *
 * @param options - The same filter options passed to `getOverheadExpenses`.
 */
export async function getOverheadExpenseCount(
  options: GetOverheadExpensesOptions = {},
): Promise<number> {
  const db = await getDatabase();
  const { clauses, params } = buildWhereClause(options);

  const where = clauses.length > 0
    ? `WHERE ${clauses.join(' AND ')}`
    : '';

  const row = await db.getFirstAsync<{ total: number }>(
    `SELECT COUNT(*) AS total FROM overhead_expenses ${where}`,
    params,
  );

  return row?.total ?? 0;
}

/**
 * Returns the three dashboard KPI buckets for overhead expenses.
 * Uses conditional CASE aggregation in a single SQL round-trip so the
 * dashboard's parallel Promise.all only needs one DB call.
 *
 * Period semantics (device UTC, matching dashboard.repository.ts convention):
 *   thisMonth — expense_date in the current calendar month and year
 *   thisYear  — expense_date in the current calendar year
 *   allTime   — no date filter
 */
export async function getOverheadExpenseSummary(): Promise<OverheadExpenseSummary> {
  const db  = await getDatabase();
  const now = new Date();

  const year  = now.getUTCFullYear();
  const month = now.getUTCMonth() + 1; // 1-based

  // Build ISO date prefix strings for filtering by TEXT column.
  // expense_date is stored as an ISO 8601 string (e.g. "2026-03-15T00:00:00.000Z")
  // so prefix comparisons work correctly for both date-only and full ISO strings.
  const yearPrefix       = `${year}-`;
  const monthStr         = String(month).padStart(2, '0');
  const monthPrefix      = `${year}-${monthStr}-`;

  interface SummaryRow {
    this_month: number | null;
    this_year:  number | null;
    all_time:   number | null;
  }

  const row = await db.getFirstAsync<SummaryRow>(
    `SELECT
       SUM(CASE WHEN expense_date LIKE ? THEN amount ELSE 0 END) AS this_month,
       SUM(CASE WHEN expense_date LIKE ? THEN amount ELSE 0 END) AS this_year,
       SUM(amount)                                               AS all_time
     FROM overhead_expenses`,
    [`${monthPrefix}%`, `${yearPrefix}%`],
  );

  return {
    thisMonth: row?.this_month ?? 0,
    thisYear:  row?.this_year  ?? 0,
    allTime:   row?.all_time   ?? 0,
  };
}

/**
 * Returns month-by-month totals for the given calendar year.
 * Only months that have at least one expense row are returned —
 * the caller is responsible for zero-filling the remaining months.
 *
 * @param year - The full 4-digit calendar year (e.g. 2026).
 */
export async function getMonthlyOverheadBreakdown(
  year: number,
): Promise<MonthlyOverheadPoint[]> {
  const db         = await getDatabase();
  const yearPrefix = `${year}-`;

  interface BreakdownRow {
    month:        number;
    total_amount: number;
  }

  const rows = await db.getAllAsync<BreakdownRow>(
    `SELECT
       CAST(strftime('%m', expense_date) AS INTEGER) AS month,
       SUM(amount)                                   AS total_amount
     FROM overhead_expenses
     WHERE expense_date LIKE ?
     GROUP BY month
     ORDER BY month ASC`,
    [`${yearPrefix}%`],
  );

  return rows.map((r) => ({
    month:       r.month,
    totalAmount: r.total_amount,
  }));
}
