/**
 * overhead_expenses.schema.ts
 *
 * Immutable ledger of every business overhead expense.
 * Covers occupancy and operational fixed costs:
 *   rent, renovation, utilities, insurance, maintenance, other
 *
 * Design principles:
 *   - Rows are NEVER updated after insert. If an entry was made in error the
 *     correction is logged as a new entry with a corrective note. This gives
 *     the owner a full, uneditable audit trail — matching how professional
 *     accounting packages (QuickBooks, Wave, Odoo) handle expense journals.
 *   - `expense_date` records WHEN the expense was incurred or paid (business
 *     event timestamp). `created_at` is the device write timestamp.
 *   - `is_recurring` is a boolean flag (INTEGER 0/1). It does NOT trigger
 *     automatic recurring entries — the system never auto-generates future
 *     rows. The owner logs each period manually; `is_recurring` is purely
 *     informational so the owner can quickly spot fixed monthly obligations.
 *   - `frequency` is informational metadata (one_time, monthly, quarterly,
 *     annual). It describes the billing cadence but the system does not use
 *     it to compute or schedule anything.
 *   - Dates are TEXT (ISO 8601) — consistent with every other table in this
 *     project.
 *   - `is_synced` INTEGER 0/1 — tracks background Supabase sync status.
 */

// ─── CREATE TABLE ─────────────────────────────────────────────────────────────

export const overheadExpensesSchema = `
  CREATE TABLE IF NOT EXISTS overhead_expenses (
    id               TEXT    PRIMARY KEY,
    category         TEXT    NOT NULL DEFAULT 'other',
    amount           REAL    NOT NULL,
    description      TEXT    NOT NULL,
    notes            TEXT,
    frequency        TEXT    NOT NULL DEFAULT 'one_time',
    expense_date     TEXT    NOT NULL,
    is_recurring     INTEGER NOT NULL DEFAULT 0,
    reference_number TEXT,
    created_at       TEXT    NOT NULL,
    is_synced        INTEGER NOT NULL DEFAULT 0
  );
`;

// ─── INDEXES ──────────────────────────────────────────────────────────────────

export const overheadExpensesIndexes: string[] = [
  // Category filter — the primary drill-down on the expense list screen
  `CREATE INDEX IF NOT EXISTS idx_overhead_expenses_category
     ON overhead_expenses (category);`,
  // Date range queries — dashboard KPIs and list pagination
  `CREATE INDEX IF NOT EXISTS idx_overhead_expenses_expense_date
     ON overhead_expenses (expense_date);`,
  // Recurring obligations filter — lets the owner quickly view fixed costs
  `CREATE INDEX IF NOT EXISTS idx_overhead_expenses_is_recurring
     ON overhead_expenses (is_recurring);`,
  // Background sync queue — must be fast for the offline sync worker
  `CREATE INDEX IF NOT EXISTS idx_overhead_expenses_is_synced
     ON overhead_expenses (is_synced);`,
];

// ─── ROW TYPE ─────────────────────────────────────────────────────────────────

/** Raw DB row — snake_case column names matching the table exactly. */
export interface OverheadExpenseRow {
  id:               string;
  /** 'rent' | 'renovation' | 'utilities' | 'insurance' | 'maintenance' | 'other' */
  category:         string;
  amount:           number;
  description:      string;
  notes:            string | null;
  /** 'one_time' | 'monthly' | 'quarterly' | 'annual' */
  frequency:        string;
  /** ISO 8601 date — when the expense was incurred or paid. */
  expense_date:     string;
  /** 1 = recurring obligation, 0 = one-off. */
  is_recurring:     0 | 1;
  reference_number: string | null;
  created_at:       string; // ISO 8601 write timestamp
  is_synced:        0 | 1;
}
