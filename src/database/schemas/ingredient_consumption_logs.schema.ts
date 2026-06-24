/**
 * ingredient_consumption_logs.schema.ts
 *
 * Immutable audit ledger for every ingredient quantity reduction, regardless
 * of the business event that caused it.
 *
 * Design principles:
 *   - Rows are NEVER updated after insert. Corrections are handled by
 *     inserting a row with a negative quantity and trigger_type = 'RETURN'.
 *   - `cancelled_at` is the only mutable column — set when a production log
 *     is voided so that aggregate queries can exclude cancelled entries.
 *   - `reference_id` + `reference_type` form a polymorphic foreign key back
 *     to the source document (production_log, manual_adjustment, etc.).
 *   - `quantity_consumed` is always POSITIVE (even for wastage / manual out).
 *     A RETURN entry carries a negative value to represent stock coming back.
 *
 * trigger_type values:
 *   PRODUCTION        — consumed during a production run
 *   MANUAL_ADJUSTMENT — operator manually logged a reduction
 *   WASTAGE           — spoilage, expiry, breakage
 *   RETURN            — stock returned / correction (quantity may be negative)
 *   TRANSFER          — moved to another warehouse / location
 */

// ─── CREATE TABLE ─────────────────────────────────────────────────────────────

export const ingredientConsumptionLogsSchema = `
  CREATE TABLE IF NOT EXISTS ingredient_consumption_logs (
    id                TEXT  PRIMARY KEY,
    ingredient_id     TEXT  NOT NULL REFERENCES inventory_items(id),
    quantity_consumed REAL  NOT NULL,
    unit              TEXT  NOT NULL,
    trigger_type      TEXT  NOT NULL,
    reference_id      TEXT,
    reference_type    TEXT,
    notes             TEXT,
    cost_price        REAL,
    total_cost        REAL  NOT NULL DEFAULT 0,
    performed_by      TEXT,
    consumed_at       TEXT  NOT NULL,
    created_at        TEXT  NOT NULL,
    cancelled_at      TEXT,
    product_id        TEXT,
    product_name      TEXT
  );
`;

// ─── INDEXES ──────────────────────────────────────────────────────────────────

export const ingredientConsumptionLogsIndexes: string[] = [
  `CREATE INDEX IF NOT EXISTS idx_icl_ingredient_id
     ON ingredient_consumption_logs (ingredient_id);`,
  `CREATE INDEX IF NOT EXISTS idx_icl_consumed_at
     ON ingredient_consumption_logs (consumed_at);`,
  `CREATE INDEX IF NOT EXISTS idx_icl_trigger_type
     ON ingredient_consumption_logs (trigger_type);`,
  `CREATE INDEX IF NOT EXISTS idx_icl_reference
     ON ingredient_consumption_logs (reference_id, reference_type);`,
  // Composite index for dashboard period queries (queryIngredientKPI, queryTrendPoint costs leg)
  `CREATE INDEX IF NOT EXISTS idx_icl_cancelled_at_consumed_at
     ON ingredient_consumption_logs (cancelled_at, consumed_at);`,
];

// ─── ROW TYPE ─────────────────────────────────────────────────────────────────

/** Raw DB row — snake_case, matches table columns exactly. */
export interface IngredientConsumptionLogRow {
  id:                string;
  ingredient_id:     string;
  quantity_consumed: number;
  unit:              string;
  trigger_type:      string;
  reference_id:      string | null;
  reference_type:    string | null;
  notes:             string | null;
  cost_price:        number | null;
  total_cost:        number;
  performed_by:      string | null;
  consumed_at:       string;
  created_at:        string;
  cancelled_at:      string | null;
  /** FK to inventory_items.id — the finished product this ingredient was consumed for. */
  product_id:        string | null;
  /** Denormalized snapshot of the product name at time of consumption. */
  product_name:      string | null;
}

// ─── COLUMN LIST ──────────────────────────────────────────────────────────────

export const INGREDIENT_CONSUMPTION_LOG_COLUMNS = [
  'id',
  'ingredient_id',
  'quantity_consumed',
  'unit',
  'trigger_type',
  'reference_id',
  'reference_type',
  'notes',
  'cost_price',
  'total_cost',
  'performed_by',
  'consumed_at',
  'created_at',
  'cancelled_at',
  'product_id',
  'product_name',
] as const;

export type IngredientConsumptionLogColumn =
  (typeof INGREDIENT_CONSUMPTION_LOG_COLUMNS)[number];
