/**
 * target_sales_plans.schema.ts
 *
 * Two-table schema for the Target Sales feature.
 *
 * Design decisions:
 *   - `target_sales_plans` is the header: one row per date the user sets a
 *     daily unit target. Only ONE plan per date should be active at a time;
 *     the UNIQUE index on `plan_date` enforces this at the DB level.
 *
 *   - `target_sales_items` is the per-product line: how many units of each
 *     product are allocated within a plan, the computed weight used for that
 *     allocation, and the running actual units sold as sales are recorded.
 *
 *   - Products are NOT stored in a separate `products` table — they live in
 *     `inventory_items` with `category = 'product'`. All FKs targeting
 *     product records reference `inventory_items.id`.
 *
 *   - No REFERENCES constraints are declared on `product_id` in
 *     `target_sales_items` so that deleting a product does not cascade-break
 *     historical plan items. The application layer handles the "missing product"
 *     display fallback.
 *
 *   - `deleted_at` is TEXT (ISO 8601) and NULL when the row is live — consistent
 *     with every other table in this project. Soft-delete is used instead of
 *     physical DELETE so plans remain available for historical reporting.
 *
 *   - `target_sales_items` has NO `deleted_at` because items are always managed
 *     as a set per plan: the repository replaces the full item set atomically.
 *     Individual item soft-deletion is not a supported use-case here.
 *
 *   - Timestamps are TEXT ISO 8601, matching all other tables in this project.
 *     `plan_date` is also TEXT (YYYY-MM-DD) — no time component needed.
 *
 *   - `is_synced` follows the project-standard INTEGER 0|1 pattern.
 */

// ─── target_sales_plans ───────────────────────────────────────────────────────

export const targetSalesPlansSchema = `
  CREATE TABLE IF NOT EXISTS target_sales_plans (
    id                  TEXT    PRIMARY KEY,

    plan_date           TEXT    NOT NULL,
    total_target_units  INTEGER NOT NULL DEFAULT 0,
    strategy            TEXT    NOT NULL DEFAULT 'EVEN',
    status              TEXT    NOT NULL DEFAULT 'DRAFT',

    created_at          TEXT    NOT NULL,
    updated_at          TEXT    NOT NULL,
    is_synced           INTEGER NOT NULL DEFAULT 0,
    deleted_at          TEXT
  );
`;

export const targetSalesPlansIndexes: string[] = [
  // Primary access pattern: look up the plan for today's date
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_target_sales_plans_plan_date
     ON target_sales_plans (plan_date)
     WHERE deleted_at IS NULL;`,
  // Filter by status (DRAFT / ACTIVE / COMPLETED)
  `CREATE INDEX IF NOT EXISTS idx_target_sales_plans_status
     ON target_sales_plans (status);`,
  // Sync queue: find un-synced rows quickly
  `CREATE INDEX IF NOT EXISTS idx_target_sales_plans_is_synced
     ON target_sales_plans (is_synced);`,
];

// ─── target_sales_items ───────────────────────────────────────────────────────

export const targetSalesItemsSchema = `
  CREATE TABLE IF NOT EXISTS target_sales_items (
    id                  TEXT    PRIMARY KEY,

    plan_id             TEXT    NOT NULL REFERENCES target_sales_plans(id),
    product_id          TEXT    NOT NULL,
    product_name        TEXT    NOT NULL,
    allocated_units     INTEGER NOT NULL DEFAULT 0,
    actual_units_sold   INTEGER NOT NULL DEFAULT 0,
    weight              REAL    NOT NULL DEFAULT 0,

    created_at          TEXT    NOT NULL,
    updated_at          TEXT    NOT NULL
  );
`;

export const targetSalesItemsIndexes: string[] = [
  // Primary access pattern: get all items for a plan
  `CREATE INDEX IF NOT EXISTS idx_target_sales_items_plan_id
     ON target_sales_items (plan_id);`,
  // Secondary: look up whether a product is already in a plan
  `CREATE INDEX IF NOT EXISTS idx_target_sales_items_product_id
     ON target_sales_items (product_id);`,
  // Composite: fast plan+product lookup for upsert
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_target_sales_items_plan_product
     ON target_sales_items (plan_id, product_id);`,
];

// ─── Row types ────────────────────────────────────────────────────────────────

/** Raw DB row — snake_case column names matching the table exactly. */
export interface TargetSalesPlanRow {
  id:                 string;
  plan_date:          string;            // YYYY-MM-DD
  total_target_units: number;
  strategy:           'EVEN' | 'WEIGHTED' | 'SMART_NEXT_DAY';
  /** 'DRAFT' → editing; 'ACTIVE' → in-progress today; 'COMPLETED' → day ended. */
  status:             'DRAFT' | 'ACTIVE' | 'COMPLETED';
  created_at:         string;            // ISO 8601
  updated_at:         string;            // ISO 8601
  is_synced:          0 | 1;
  deleted_at:         string | null;     // ISO 8601, NULL when live
}

/** Raw DB row — snake_case column names matching the table exactly. */
export interface TargetSalesItemRow {
  id:                string;
  plan_id:           string;
  product_id:        string;
  /** Snapshot of inventory_items.name at time of plan creation. */
  product_name:      string;
  allocated_units:   number;
  actual_units_sold: number;
  /** Weight used during allocation (0.0 – 1.0); all items in a plan sum to 1.0. */
  weight:            number;
  created_at:        string;             // ISO 8601
  updated_at:        string;             // ISO 8601
}

// ─── Input types ──────────────────────────────────────────────────────────────

export interface CreateTargetSalesPlanInput {
  plan_date:          string;
  total_target_units: number;
  strategy:           'EVEN' | 'WEIGHTED' | 'SMART_NEXT_DAY';
  status?:            'DRAFT' | 'ACTIVE' | 'COMPLETED';
}

export interface UpdateTargetSalesPlanInput {
  total_target_units?: number;
  strategy?:           'EVEN' | 'WEIGHTED' | 'SMART_NEXT_DAY';
  status?:             'DRAFT' | 'ACTIVE' | 'COMPLETED';
}

export interface UpsertTargetSalesItemInput {
  plan_id:           string;
  product_id:        string;
  product_name:      string;
  allocated_units:   number;
  weight:            number;
  actual_units_sold?: number;
}
