/**
 * product_stock_additions.schema.ts
 *
 * Schema for the `product_stock_additions` table.
 *
 * Records every time a product's stock is increased via the BOM-constrained
 * "Add Stock" flow. Each row is an immutable audit entry: it captures a
 * snapshot of which ingredients and raw materials were deducted (as JSON blobs)
 * at the exact moment the addition was committed. This allows downstream
 * reporting to reconstruct the full cost of each production run without
 * requiring subsequent joins to possibly-changed ingredient records.
 *
 * Foreign key: product_id → inventory_items(id)
 *   No ON DELETE CASCADE — we want the audit row to survive even if the
 *   product is soft-deleted. The product_name TEXT column is a denormalised
 *   snapshot for the same reason.
 */

// ─── DDL ─────────────────────────────────────────────────────────────────────

export const productStockAdditionsSchema = `
  CREATE TABLE IF NOT EXISTS product_stock_additions (
    id                  TEXT    PRIMARY KEY,
    product_id          TEXT    NOT NULL REFERENCES inventory_items(id),
    product_name        TEXT    NOT NULL,
    units_added         REAL    NOT NULL CHECK(units_added > 0),
    notes               TEXT,
    performed_by        TEXT,
    ingredients_used    TEXT,
    raw_materials_used  TEXT,
    added_at            TEXT    NOT NULL,
    created_at          TEXT    NOT NULL,
    is_synced           INTEGER NOT NULL DEFAULT 0
  );
`;

// ─── Indexes ─────────────────────────────────────────────────────────────────

export const productStockAdditionsIndexes = [
  `CREATE INDEX IF NOT EXISTS idx_psa_product_id ON product_stock_additions(product_id);`,
  `CREATE INDEX IF NOT EXISTS idx_psa_added_at   ON product_stock_additions(added_at);`,
  `CREATE INDEX IF NOT EXISTS idx_psa_is_synced  ON product_stock_additions(is_synced);`,
];

// ─── TypeScript interface ─────────────────────────────────────────────────────

/** JSON-serialisable shape stored in `ingredients_used`. */
export interface IngredientUsedSnapshot {
  ingredientId:    string;
  ingredientName:  string;
  amountDeducted:  number;
  unit:            string;
}

/** JSON-serialisable shape stored in `raw_materials_used`. */
export interface RawMaterialUsedSnapshot {
  rawMaterialId:    string;
  rawMaterialName:  string;
  amountDeducted:   number;
  unit:             string;
}

/**
 * Domain representation of a `product_stock_additions` row.
 * `ingredientsUsed` and `rawMaterialsUsed` are already parsed from their JSON
 * blob columns — the repository handles serialisation/deserialisation.
 */
export interface ProductStockAddition {
  id:               string;
  productId:        string;
  productName:      string;
  unitsAdded:       number;
  notes?:           string;
  performedBy?:     string;
  ingredientsUsed?: IngredientUsedSnapshot[];
  rawMaterialsUsed?: RawMaterialUsedSnapshot[];
  addedAt:          string;
  createdAt:        string;
  isSynced:         boolean;
}
