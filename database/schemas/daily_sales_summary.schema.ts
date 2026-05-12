/**
 * daily_sales_summary.schema.ts
 *
 * One-row-per-product-per-day aggregate of sales data.
 *
 * Design decisions:
 *   - Used exclusively by the Target Sales weighting engine: when strategy is
 *     'WEIGHTED' or 'SMART_NEXT_DAY', the allocation algorithm looks up the
 *     most recent day's summaries to derive each product's relative sales
 *     velocity before distributing the total target units.
 *
 *   - The UNIQUE constraint on (summary_date, product_id) guarantees exactly
 *     one summary row per product per calendar day. Writes always use
 *     INSERT … ON CONFLICT DO UPDATE (upsert) so the calling code does not
 *     need to track whether a row exists.
 *
 *   - `product_id` is a value-level FK to `inventory_items.id` (no hard
 *     REFERENCES constraint) so that deleting a product does not cascade-break
 *     historical summary rows. The application layer handles the display
 *     fallback for orphaned rows.
 *
 *   - `revenue` is REAL because it holds a currency amount (e.g. ₱ 1 250.50).
 *     `units_sold` is INTEGER — fractional unit sales are not supported.
 *
 *   - Dates are TEXT ISO 8601, consistent with all other tables in this project.
 *     `summary_date` is YYYY-MM-DD (date only, no time component).
 *
 *   - No `deleted_at` / soft-delete: summaries are aggregate facts. If a
 *     sales order is cancelled the calling code should call
 *     `upsertDailySalesSummary` again with the corrected totals, not delete
 *     the row. Deleting aggregate rows would corrupt the weighting history.
 *
 *   - `is_synced` follows the project-standard INTEGER 0|1 pattern.
 */

// ─── daily_sales_summary ──────────────────────────────────────────────────────

export const dailySalesSummarySchema = `
  CREATE TABLE IF NOT EXISTS daily_sales_summary (
    id            TEXT  PRIMARY KEY,

    summary_date  TEXT  NOT NULL,
    product_id    TEXT  NOT NULL,
    product_name  TEXT  NOT NULL,
    units_sold    INTEGER NOT NULL DEFAULT 0,
    revenue       REAL    NOT NULL DEFAULT 0,

    created_at    TEXT  NOT NULL,
    updated_at    TEXT  NOT NULL,
    is_synced     INTEGER NOT NULL DEFAULT 0,

    UNIQUE (summary_date, product_id)
  );
`;

export const dailySalesSummaryIndexes: string[] = [
  // Primary access pattern: get all product summaries for a given date
  `CREATE INDEX IF NOT EXISTS idx_daily_sales_summary_summary_date
     ON daily_sales_summary (summary_date);`,
  // Secondary: look up the summary for a specific product across dates
  `CREATE INDEX IF NOT EXISTS idx_daily_sales_summary_product_id
     ON daily_sales_summary (product_id);`,
  // Sync queue: find un-synced rows quickly
  `CREATE INDEX IF NOT EXISTS idx_daily_sales_summary_is_synced
     ON daily_sales_summary (is_synced);`,
];

// ─── Row type ─────────────────────────────────────────────────────────────────

/** Raw DB row — snake_case column names matching the table exactly. */
export interface DailySalesSummaryRow {
  id:           string;
  summary_date: string;   // YYYY-MM-DD
  product_id:   string;
  /** Snapshot of inventory_items.name at time of summary write. */
  product_name: string;
  units_sold:   number;
  revenue:      number;
  created_at:   string;   // ISO 8601
  updated_at:   string;   // ISO 8601
  is_synced:    0 | 1;
}

// ─── Input types ──────────────────────────────────────────────────────────────

export interface UpsertDailySalesSummaryInput {
  summary_date: string;   // YYYY-MM-DD
  product_id:   string;
  product_name: string;
  units_sold:   number;
  revenue:      number;
}
