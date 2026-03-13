/**
 * production_logs.schema.ts
 *
 * Two-table schema for production tracking:
 *
 *   production_logs              — one row per production run
 *   production_log_ingredients   — ingredient line items consumed in that run
 *
 * A "production run" is recorded whenever a user marks units of a product as
 * produced. The ingredient snapshots (cost_price at time of production) make
 * each log self-contained for historical cost reporting even if the ingredient
 * price changes later.
 */

// ─── production_logs ──────────────────────────────────────────────────────────

export const productionLogsSchema = `
  CREATE TABLE IF NOT EXISTS production_logs (
    id             TEXT  PRIMARY KEY,
    product_id     TEXT  NOT NULL REFERENCES inventory_items(id),
    units_produced REAL  NOT NULL,
    total_cost     REAL  NOT NULL DEFAULT 0,
    notes          TEXT,
    produced_at    TEXT  NOT NULL,
    created_at     TEXT  NOT NULL
  );
`;

export const productionLogsIndexes: string[] = [
  `CREATE INDEX IF NOT EXISTS idx_production_logs_product_id
     ON production_logs (product_id);`,
  `CREATE INDEX IF NOT EXISTS idx_production_logs_produced_at
     ON production_logs (produced_at);`,
];

// ─── production_log_ingredients ───────────────────────────────────────────────

export const productionLogIngredientsSchema = `
  CREATE TABLE IF NOT EXISTS production_log_ingredients (
    id                TEXT  PRIMARY KEY,
    production_log_id TEXT  NOT NULL REFERENCES production_logs(id),
    ingredient_id     TEXT  NOT NULL REFERENCES inventory_items(id),
    quantity_consumed REAL  NOT NULL,
    unit              TEXT  NOT NULL,
    cost_price        REAL,
    line_cost         REAL  NOT NULL DEFAULT 0,
    created_at        TEXT  NOT NULL
  );
`;

export const productionLogIngredientsIndexes: string[] = [
  `CREATE INDEX IF NOT EXISTS idx_production_log_ingredients_log_id
     ON production_log_ingredients (production_log_id);`,
  `CREATE INDEX IF NOT EXISTS idx_production_log_ingredients_ingredient_id
     ON production_log_ingredients (ingredient_id);`,
];

// ─── Row types ────────────────────────────────────────────────────────────────

export interface ProductionLogRow {
  id:             string;
  product_id:     string;
  units_produced: number;
  total_cost:     number;
  notes:          string | null;
  produced_at:    string;
  created_at:     string;
}

export interface ProductionLogIngredientRow {
  id:                string;
  production_log_id: string;
  ingredient_id:     string;
  quantity_consumed: number;
  unit:              string;
  cost_price:        number | null;
  line_cost:         number;
  created_at:        string;
}
