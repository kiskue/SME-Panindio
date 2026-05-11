/**
 * sales_targets.schema.ts
 *
 * SQLite schema for the `sales_targets` table.
 *
 * Design decisions:
 *   - Singleton-row pattern: the table always contains exactly one row with
 *     id = 1, seeded by migration 023. All writes are INSERT … ON CONFLICT
 *     UPDATE (upsert). This avoids the complexity of multi-row active/inactive
 *     state management for a feature that is inherently a single user preference.
 *
 *   - `id` is INTEGER PRIMARY KEY (not UUID TEXT) because the singleton
 *     identity is meaningful — the row is always id = 1. There is no need for
 *     distributed-unique identifiers here.
 *
 *   - `daily_target` is REAL — net income is a decimal currency amount.
 *
 *   - `target_product_id` is a soft FK to `inventory_items.id`. No hard
 *     REFERENCES constraint is declared so that deleting a product does not
 *     break the target row. The application layer handles the display fallback
 *     when the referenced product no longer exists.
 *
 *   - `weekly_target` and `monthly_target` are intentionally NOT stored.
 *     They are derived values (daily × 7, daily × 30) computed at runtime.
 *
 *   - Dates follow the project-wide TEXT / ISO 8601 convention matching
 *     `inventory_items` and `sales_orders`.
 *
 *   - No `is_active`, `status`, `is_synced`, or `deleted_at` columns — the
 *     singleton design makes these concepts inapplicable. There is only ever
 *     one current target; history is not tracked in this table.
 *
 * This schema must remain in sync with migration 023 (`023_add_sales_targets.ts`).
 */

// ─── CREATE TABLE ─────────────────────────────────────────────────────────────

export const salesTargetsSchema = `
  CREATE TABLE IF NOT EXISTS sales_targets (
    id                 INTEGER PRIMARY KEY,
    daily_target       REAL    NOT NULL DEFAULT 0,
    target_product_id  TEXT,
    created_at         TEXT    NOT NULL,
    updated_at         TEXT    NOT NULL
  );
`;

// ─── INDEXES ──────────────────────────────────────────────────────────────────

export const salesTargetsIndexes: string[] = [
  // FK-style index — allows efficient filter/join by referenced product
  `CREATE INDEX IF NOT EXISTS idx_sales_targets_target_product_id ON sales_targets (target_product_id);`,
];

// ─── TYPESCRIPT INTERFACE ─────────────────────────────────────────────────────

/**
 * Row shape of the `sales_targets` SQLite table.
 * Column names use snake_case to match the DB schema exactly.
 *
 * `id` is always 1 — the singleton row seeded by migration 023.
 */
export interface SalesTargetRow {
  id:                number;   // always 1
  daily_target:      number;
  target_product_id: string | null;
  created_at:        string;   // ISO 8601
  updated_at:        string;   // ISO 8601
}

// ─── INPUT TYPES ──────────────────────────────────────────────────────────────

/**
 * Fields the caller provides when persisting a new target configuration.
 * `id`, `created_at`, and `updated_at` are managed by the repository and must
 * NOT be passed by the caller.
 */
export interface UpdateSalesTargetInput {
  daily_target:       number;
  target_product_id?: string | null;
}
