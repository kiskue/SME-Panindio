/**
 * raw_material_consumption_logs.schema.ts
 *
 * Immutable audit ledger for every raw material quantity change, regardless
 * of the business event that caused it.
 *
 * Design principles (mirrors ingredient_consumption_logs):
 *   - Rows are NEVER updated after insert. Corrections are handled by
 *     inserting a new row with the opposite sign.
 *   - `quantity_used` is signed: positive = consumed, negative = returned/added.
 *   - `reason` values: sale | production | waste | adjustment
 *   - `reference_id` links back to the source document (sales_order, etc.).
 */

// ─── CREATE TABLE ─────────────────────────────────────────────────────────────

export const rawMaterialConsumptionLogsSchema = `
  CREATE TABLE IF NOT EXISTS raw_material_consumption_logs (
    id               TEXT PRIMARY KEY,
    raw_material_id  TEXT NOT NULL REFERENCES raw_materials(id),
    quantity_used    REAL NOT NULL,
    reason           TEXT NOT NULL,
    reference_id     TEXT,
    notes            TEXT,
    consumed_at      TEXT NOT NULL,
    created_at       TEXT NOT NULL,
    is_synced        INTEGER NOT NULL DEFAULT 0
  );
`;

// ─── INDEXES ──────────────────────────────────────────────────────────────────

export const rawMaterialConsumptionLogsIndexes: string[] = [
  `CREATE INDEX IF NOT EXISTS idx_rmcl_raw_material_id
     ON raw_material_consumption_logs (raw_material_id);`,
  `CREATE INDEX IF NOT EXISTS idx_rmcl_consumed_at
     ON raw_material_consumption_logs (consumed_at);`,
  `CREATE INDEX IF NOT EXISTS idx_rmcl_reason
     ON raw_material_consumption_logs (reason);`,
];

// ─── ROW TYPE ─────────────────────────────────────────────────────────────────

export interface RawMaterialConsumptionLogRow {
  id:              string;
  raw_material_id: string;
  quantity_used:   number;
  reason:          string;
  reference_id:    string | null;
  notes:           string | null;
  consumed_at:     string;
  created_at:      string;
  is_synced:       0 | 1;
}

// ─── COLUMN LIST ──────────────────────────────────────────────────────────────

export const RAW_MATERIAL_CONSUMPTION_LOG_COLUMNS = [
  'id',
  'raw_material_id',
  'quantity_used',
  'reason',
  'reference_id',
  'notes',
  'consumed_at',
  'created_at',
  'is_synced',
] as const;

export type RawMaterialConsumptionLogColumn =
  (typeof RAW_MATERIAL_CONSUMPTION_LOG_COLUMNS)[number];
