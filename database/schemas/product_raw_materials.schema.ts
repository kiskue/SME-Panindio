/**
 * product_raw_materials.schema.ts
 *
 * Junction table linking products (inventory_items where category='product')
 * to raw materials. Defines how many units of each raw material are consumed
 * per 1 unit of the product sold/produced.
 *
 * This mirrors the `product_ingredients` table but for non-food operational
 * supplies (containers, packaging, paper plates, etc.).
 *
 * Design notes:
 *   - UNIQUE (product_id, raw_material_id) — one row per material per product.
 *   - The repository uses INSERT OR REPLACE for upsert semantics when editing.
 *   - No FK enforcement in SQLite (PRAGMA foreign_keys is off by default in
 *     Expo SQLite), but the repository validates references in application code.
 */

// ─── CREATE TABLE ─────────────────────────────────────────────────────────────

export const productRawMaterialsSchema = `
  CREATE TABLE IF NOT EXISTS product_raw_materials (
    id                TEXT PRIMARY KEY,
    product_id        TEXT NOT NULL,
    raw_material_id   TEXT NOT NULL REFERENCES raw_materials(id),
    quantity_required REAL NOT NULL DEFAULT 1,
    unit              TEXT NOT NULL,
    created_at        TEXT NOT NULL,
    updated_at        TEXT NOT NULL,
    UNIQUE (product_id, raw_material_id)
  );
`;

// ─── INDEXES ──────────────────────────────────────────────────────────────────

export const productRawMaterialsIndexes: string[] = [
  `CREATE INDEX IF NOT EXISTS idx_prm_product_id
     ON product_raw_materials (product_id);`,
  `CREATE INDEX IF NOT EXISTS idx_prm_raw_material_id
     ON product_raw_materials (raw_material_id);`,
];

// ─── ROW TYPE ─────────────────────────────────────────────────────────────────

export interface ProductRawMaterialRow {
  id:                string;
  product_id:        string;
  raw_material_id:   string;
  quantity_required: number;
  unit:              string;
  created_at:        string;
  updated_at:        string;
}

// ─── COLUMN LIST ──────────────────────────────────────────────────────────────

export const PRODUCT_RAW_MATERIAL_COLUMNS = [
  'id',
  'product_id',
  'raw_material_id',
  'quantity_required',
  'unit',
  'created_at',
  'updated_at',
] as const;

export type ProductRawMaterialColumn = (typeof PRODUCT_RAW_MATERIAL_COLUMNS)[number];
