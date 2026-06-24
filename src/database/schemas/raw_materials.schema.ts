/**
 * raw_materials.schema.ts
 *
 * SQLite schema for the `raw_materials` table.
 *
 * Raw materials are consumable non-food operational supplies used when
 * producing or selling products — e.g. sauce packets, paper plates,
 * containers, rolls, packaging bags, boxes, etc.
 *
 * Design principles:
 *   - Separate from `inventory_items` (which handles products, ingredients,
 *     and equipment) to keep the data model clean and typed.
 *   - Soft-delete via `is_active = 0` — rows are NEVER hard-deleted so the
 *     audit trail (consumption logs, product links) stays intact.
 *   - `synced_at` is NULL until the row has been synced to Supabase.
 */

// ─── CREATE TABLE ─────────────────────────────────────────────────────────────

export const rawMaterialsSchema = `
  CREATE TABLE IF NOT EXISTS raw_materials (
    id                    TEXT    PRIMARY KEY,
    name                  TEXT    NOT NULL,
    description           TEXT,
    unit                  TEXT    NOT NULL,
    quantity_in_stock     REAL    NOT NULL DEFAULT 0,
    minimum_stock_level   REAL    NOT NULL DEFAULT 0,
    cost_per_unit         REAL    NOT NULL DEFAULT 0,
    category              TEXT,
    is_active             INTEGER NOT NULL DEFAULT 1,
    created_at            TEXT    NOT NULL,
    updated_at            TEXT    NOT NULL,
    is_synced             INTEGER NOT NULL DEFAULT 0
  );
`;

// ─── INDEXES ──────────────────────────────────────────────────────────────────

export const rawMaterialsIndexes: string[] = [
  `CREATE INDEX IF NOT EXISTS idx_rm_name
     ON raw_materials (name);`,
  `CREATE INDEX IF NOT EXISTS idx_rm_category
     ON raw_materials (category);`,
  `CREATE INDEX IF NOT EXISTS idx_rm_is_active
     ON raw_materials (is_active);`,
  `CREATE INDEX IF NOT EXISTS idx_rm_low_stock
     ON raw_materials (is_active, quantity_in_stock, minimum_stock_level);`,
];

// ─── ROW TYPE ─────────────────────────────────────────────────────────────────

/** Raw DB row — snake_case, matches table columns exactly. */
export interface RawMaterialRow {
  id:                   string;
  name:                 string;
  description:          string | null;
  unit:                 string;
  quantity_in_stock:    number;
  minimum_stock_level:  number;
  cost_per_unit:        number;
  category:             string | null;
  is_active:            0 | 1;
  created_at:           string;
  updated_at:           string;
  is_synced:            0 | 1;
}

// ─── COLUMN LIST ──────────────────────────────────────────────────────────────

export const RAW_MATERIAL_COLUMNS = [
  'id',
  'name',
  'description',
  'unit',
  'quantity_in_stock',
  'minimum_stock_level',
  'cost_per_unit',
  'category',
  'is_active',
  'created_at',
  'updated_at',
  'is_synced',
] as const;

export type RawMaterialColumn = (typeof RAW_MATERIAL_COLUMNS)[number];
