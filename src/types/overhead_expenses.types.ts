/**
 * overhead_expenses.types.ts
 *
 * Domain types for the Overhead Expenses module.
 *
 * Overhead expenses are immutable journal entries representing business
 * occupancy and operational fixed costs (rent, renovation,
 * insurance, maintenance, and other). Once recorded, an entry is never
 * edited — corrections are made by logging a new corrective entry.
 *
 * TypeScript strict-mode notes:
 *   - `exactOptionalPropertyTypes: true` — optional fields use `?:` only.
 *     Callers must never pass `prop: undefined`; use conditional spreading.
 *   - `noUncheckedIndexedAccess: true` — all indexed access must use `?? fallback`.
 */

// ─── Enums ────────────────────────────────────────────────────────────────────

/**
 * The category of overhead expense.
 * Maps directly to the `category` column in `overhead_expenses`.
 */
export type OverheadCategory =
  | 'rent'
  | 'renovation'
  | 'insurance'
  | 'maintenance'
  | 'other';

/**
 * How often this expense recurs (informational — no auto-scheduling).
 * Maps directly to the `frequency` column in `overhead_expenses`.
 */
export type OverheadFrequency =
  | 'one_time'
  | 'monthly'
  | 'quarterly'
  | 'annual';

// ─── Domain model ─────────────────────────────────────────────────────────────

/**
 * A single overhead expense entry — the camelCase domain model returned
 * by all repository read functions.
 */
export interface OverheadExpense {
  /** UUID primary key. */
  id:               string;
  /** Expense category for grouping and filtering. */
  category:         OverheadCategory;
  /** Amount in PHP. Always positive. */
  amount:           number;
  /** Required free-text description of the expense. */
  description:      string;
  /** Optional additional notes or context. */
  notes?:           string;
  /** Billing cadence — informational only, not used for scheduling. */
  frequency:        OverheadFrequency;
  /** ISO 8601 date when the expense was incurred or paid. */
  expenseDate:      string;
  /** True = recurring fixed obligation; false = one-off expense. */
  isRecurring:      boolean;
  /** Optional receipt or invoice reference number. */
  referenceNumber?: string;
  /** ISO 8601 timestamp when the row was written to SQLite. */
  createdAt:        string;
  /** Whether this row has been synced to Supabase. */
  isSynced:         boolean;
}

// ─── Input types ──────────────────────────────────────────────────────────────

/**
 * Fields required to create a new overhead expense entry.
 * `id`, `createdAt`, and `isSynced` are assigned by the repository.
 */
export interface CreateOverheadExpenseInput {
  category:         OverheadCategory;
  /** Amount in PHP. Must be > 0. */
  amount:           number;
  /** Required description — must not be empty. */
  description:      string;
  /** Optional supplementary notes. */
  notes?:           string;
  frequency:        OverheadFrequency;
  /** ISO 8601 date when the expense was incurred or paid. */
  expenseDate:      string;
  /** True if this is a recurring fixed obligation. */
  isRecurring:      boolean;
  /** Optional receipt or invoice number. */
  referenceNumber?: string;
}

// ─── Query options ────────────────────────────────────────────────────────────

/**
 * Filter and pagination options for `getOverheadExpenses()`.
 * All fields are optional — omitting all fields returns all expenses newest-first.
 */
export interface GetOverheadExpensesOptions {
  /** Filter to a specific category. */
  category?:    OverheadCategory;
  /** ISO 8601 lower bound (inclusive) on `expense_date`. */
  fromDate?:    string;
  /** ISO 8601 upper bound (inclusive) on `expense_date`. */
  toDate?:      string;
  /** Filter to recurring (true) or non-recurring (false) entries. */
  isRecurring?: boolean;
  /** Maximum rows to return (default: 20). */
  limit?:       number;
  /** Rows to skip for pagination (default: 0). */
  offset?:      number;
}

// ─── Summary types ────────────────────────────────────────────────────────────

/**
 * Period-aggregate KPIs returned by `getOverheadExpenseSummary()`.
 * All values are PHP totals.
 */
export interface OverheadExpenseSummary {
  /** SUM of amount WHERE expense_date is in the current calendar month. */
  thisMonth: number;
  /** SUM of amount WHERE expense_date is in the current calendar year. */
  thisYear:  number;
  /** SUM of all amounts with no date filter. */
  allTime:   number;
}

/**
 * A single monthly data point returned by `getMonthlyOverheadBreakdown()`.
 */
export interface MonthlyOverheadPoint {
  /** Calendar month number (1–12). */
  month:       number;
  /** Total overhead amount for this month. */
  totalAmount: number;
}
