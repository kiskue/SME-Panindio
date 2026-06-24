/**
 * stock_reduction_logs.schema.ts
 *
 * Immutable audit ledger for every inventory stock reduction event.
 * Supports both products (item_type = 'product') and ingredients
 * (item_type = 'ingredient') from the shared inventory_items table.
 *
 * Design principles (mirrors ingredient_consumption_logs and
 * raw_material_consumption_logs):
 *   - Rows are NEVER updated after insert. Each reduction is a permanent,
 *     append-only record. If a reduction was entered in error, the correction
 *     is handled at the inventory_items layer (re-add the stock) — not by
 *     mutating this table.
 *   - `units_reduced` is always POSITIVE. It represents how many units were
 *     removed from inventory_items.quantity.
 *   - `item_name` is a denormalised snapshot so the audit history remains
 *     readable even if the item is later renamed or deleted.
 *   - `item_type` discriminates between 'product' and 'ingredient' rows so
 *     the audit screen can filter without an extra JOIN to inventory_items.
 *   - `product_id` / `product_name` are retained for backward compatibility
 *     with existing product rows written before migration 013. New product
 *     rows should still populate both `product_id` + `item_name`; ingredient
 *     rows leave `product_id` / `product_name` NULL.
 *   - `reduced_at` records the business-event timestamp (user-supplied or
 *     defaulted to now); `created_at` is the DB write timestamp.
 *   - Dates are TEXT (ISO 8601) — consistent with every other table in this
 *     project. No UNIX-ms integers.
 *   - No `status` or `deleted_at` columns — log rows are never soft-deleted.
 *
 * reason values:
 *   correction   — user made a mistake when adding stock and is reversing it;
 *                  the only reason that re-adds units to inventory_items
 *   waste        — units discarded due to spoilage, over-production, or process
 *                  loss; written as a wastage audit entry (permanent loss)
 *   damage       — units damaged and removed from saleable inventory
 *   expiry       — units expired and discarded
 *   other        — catch-all for ad-hoc reductions with a free-text note
 *
 * item_type values:
 *   product      — the reduced item is an inventory_items row with category='product'
 *   ingredient   — the reduced item is an inventory_items row with category='ingredient'
 */

// ─── CREATE TABLE ─────────────────────────────────────────────────────────────
// NOTE: Migration 013 performs a table rebuild to make product_id nullable and
// add item_type / item_name. This CREATE TABLE IF NOT EXISTS reflects the
// post-013 schema. On a fresh install, this runs before any migrations and
// creates the correct shape from the start.

export const stockReductionLogsSchema = `
  CREATE TABLE IF NOT EXISTS stock_reduction_logs (
    id            TEXT  PRIMARY KEY,
    item_type     TEXT  NOT NULL DEFAULT 'product',
    item_name     TEXT  NOT NULL,
    product_id    TEXT  REFERENCES inventory_items(id),
    product_name  TEXT,
    units_reduced REAL  NOT NULL,
    reason        TEXT  NOT NULL DEFAULT 'correction',
    notes         TEXT,
    performed_by  TEXT,
    reduced_at    TEXT  NOT NULL,
    created_at    TEXT  NOT NULL,
    is_synced     INTEGER NOT NULL DEFAULT 0
  );
`;

// ─── INDEXES ──────────────────────────────────────────────────────────────────

export const stockReductionLogsIndexes: string[] = [
  // FK lookup — join back to inventory_items and filter by item
  `CREATE INDEX IF NOT EXISTS idx_srl_product_id
     ON stock_reduction_logs (product_id);`,
  // Discriminator — filter product-only vs ingredient-only audit screens
  `CREATE INDEX IF NOT EXISTS idx_srl_item_type
     ON stock_reduction_logs (item_type);`,
  // Timeline queries — the most common filter on audit screens
  `CREATE INDEX IF NOT EXISTS idx_srl_reduced_at
     ON stock_reduction_logs (reduced_at);`,
  // Background sync queue — must be fast
  `CREATE INDEX IF NOT EXISTS idx_srl_is_synced
     ON stock_reduction_logs (is_synced);`,
];

// ─── ROW TYPE ─────────────────────────────────────────────────────────────────

/** Raw DB row — snake_case column names matching the post-013 table exactly. */
export interface StockReductionLogRow {
  id:            string;
  /**
   * Discriminates between product and ingredient rows.
   * 'product' | 'ingredient'
   */
  item_type:     string;
  /** Generic denormalised name snapshot — populated for all rows. */
  item_name:     string;
  /**
   * FK to inventory_items.id — populated only for product rows.
   * NULL for ingredient rows (ingredient_id is the logical key but the column
   * is reused via item_name; query ingredient_consumption_logs for the full
   * ingredient audit trail).
   */
  product_id:    string | null;
  /** Legacy denormalised product name — populated for product rows only. */
  product_name:  string | null;
  units_reduced: number;
  reason:        string;
  notes:         string | null;
  performed_by:  string | null;
  reduced_at:    string; // ISO 8601
  created_at:    string; // ISO 8601
  is_synced:     0 | 1;
}

// ─── COLUMN LIST ──────────────────────────────────────────────────────────────

export const STOCK_REDUCTION_LOG_COLUMNS = [
  'id',
  'item_type',
  'item_name',
  'product_id',
  'product_name',
  'units_reduced',
  'reason',
  'notes',
  'performed_by',
  'reduced_at',
  'created_at',
  'is_synced',
] as const;

export type StockReductionLogColumn =
  (typeof STOCK_REDUCTION_LOG_COLUMNS)[number];
