/**
 * utilities.schema.ts
 *
 * Two-table schema for the Utilities Consumption module:
 *
 *   utility_types  — master list of utility categories (seeded at migration time)
 *   utility_logs   — monthly consumption/billing records per utility type
 *
 * Design decisions:
 *   - `utility_types` carries no `updated_at`, `is_synced`, or `deleted_at`
 *     because the 5 built-in types are immutable seeds. User-created types
 *     (`is_custom = 1`) are append-only for now; they can be hidden via a future
 *     status column without requiring a migration here.
 *   - `utility_logs` enforces a UNIQUE constraint on
 *     (utility_type_id, period_year, period_month) so that `INSERT OR REPLACE`
 *     in the repository acts as a true upsert — one bill record per utility per
 *     calendar month.
 *   - `consumption` is nullable because some utilities (e.g. Rent) are billed as
 *     a flat monthly amount with no metered consumption reading.
 *   - `paid_at` is NULL when the bill is unpaid and an ISO-8601 string when paid.
 *   - Timestamps follow the project convention: TEXT / ISO-8601 strings.
 *   - `is_synced INTEGER NOT NULL DEFAULT 0` enables the Supabase background sync
 *     queue. Only `utility_logs` participates in sync; `utility_types` are
 *     app-local seeds.
 */

// ─── utility_types ────────────────────────────────────────────────────────────

export const utilityTypesSchema = `
  CREATE TABLE IF NOT EXISTS utility_types (
    id          TEXT    NOT NULL PRIMARY KEY,
    name        TEXT    NOT NULL,
    icon        TEXT    NOT NULL,
    unit        TEXT    NOT NULL,
    color       TEXT    NOT NULL,
    is_custom   INTEGER NOT NULL DEFAULT 0,
    created_at  TEXT    NOT NULL
  );
`;

export const utilityTypesIndexes: string[] = [
  `CREATE INDEX IF NOT EXISTS idx_utility_types_is_custom
     ON utility_types (is_custom);`,
];

// ─── utility_logs ─────────────────────────────────────────────────────────────

export const utilityLogsSchema = `
  CREATE TABLE IF NOT EXISTS utility_logs (
    id               TEXT    NOT NULL PRIMARY KEY,
    utility_type_id  TEXT    NOT NULL REFERENCES utility_types(id),
    period_year      INTEGER NOT NULL,
    period_month     INTEGER NOT NULL,
    consumption      REAL,
    amount           REAL    NOT NULL,
    due_date         TEXT,
    paid_at          TEXT,
    notes            TEXT,
    created_at       TEXT    NOT NULL,
    updated_at       TEXT    NOT NULL,
    is_synced        INTEGER NOT NULL DEFAULT 0,
    deleted_at       TEXT,
    UNIQUE (utility_type_id, period_year, period_month)
  );
`;

export const utilityLogsIndexes: string[] = [
  `CREATE INDEX IF NOT EXISTS idx_utility_logs_utility_type_id
     ON utility_logs (utility_type_id);`,
  `CREATE INDEX IF NOT EXISTS idx_utility_logs_period_year
     ON utility_logs (period_year);`,
  `CREATE INDEX IF NOT EXISTS idx_utility_logs_period_month
     ON utility_logs (period_month);`,
  `CREATE INDEX IF NOT EXISTS idx_utility_logs_paid_at
     ON utility_logs (paid_at);`,
  `CREATE INDEX IF NOT EXISTS idx_utility_logs_is_synced
     ON utility_logs (is_synced);`,
  // Index for dashboard unpaid-bill branch: paid_at IS NULL AND created_at BETWEEN ? AND ?
  `CREATE INDEX IF NOT EXISTS idx_utility_logs_created_at
     ON utility_logs (created_at);`,
];

// ─── Row types (DB shape) ─────────────────────────────────────────────────────

export interface UtilityTypeRow {
  id:         string;
  name:       string;
  icon:       string;
  unit:       string;
  color:      string;
  is_custom:  0 | 1;
  created_at: string;
}

export interface UtilityLogRow {
  id:              string;
  utility_type_id: string;
  period_year:     number;
  period_month:    number;
  consumption:     number | null;
  amount:          number;
  due_date:        string | null;
  paid_at:         string | null;
  notes:           string | null;
  created_at:      string;
  updated_at:      string;
  is_synced:       0 | 1;
  deleted_at:      string | null;
}

/**
 * Shape returned by the JOIN query in `getUtilityLogs()` and `getUtilityLogById()`.
 * Extends `UtilityLogRow` with denormalised utility_type columns.
 *
 * These four columns are nullable because the query uses a LEFT JOIN — a log
 * row whose utility_type_id no longer has a matching utility_types row (e.g. a
 * seed that failed to insert during migration) will still be returned rather
 * than silently disappearing from the result set.
 */
export interface UtilityLogJoinRow extends UtilityLogRow {
  utility_type_name:  string | null;
  utility_type_icon:  string | null;
  utility_type_color: string | null;
  utility_type_unit:  string | null;
}
