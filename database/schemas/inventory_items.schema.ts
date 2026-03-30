/**
 * inventory_items.schema.ts
 *
 * SQLite schema for the `inventory_items` table.
 *
 * A single flat table stores all three inventory categories
 * (product, ingredient, equipment). Category-specific columns are nullable
 * and carry no default so the TypeScript layer can distinguish "not set"
 * from a meaningful zero/empty value via strict `exactOptionalPropertyTypes`.
 *
 * Mapping decisions vs. the existing InventoryItem TypeScript type:
 *   - All ISO 8601 date strings (createdAt, updatedAt, purchaseDate) are
 *     stored as TEXT. This matches the existing domain type convention and
 *     avoids lossy UNIX-ms conversion for human-readable date-only fields
 *     (purchaseDate is YYYY-MM-DD, not a full timestamp).
 *   - Numeric prices and quantities are REAL (SQLite floating-point).
 *   - Booleans: is_synced is INTEGER 0/1.
 *   - Soft-delete: deleted_at is TEXT (ISO 8601), NULL when not deleted.
 *   - imageUri is TEXT; the URI is stored as-is (local filesystem path).
 */

// ─── CREATE TABLE ─────────────────────────────────────────────────────────────

export const inventoryItemsSchema = `
  CREATE TABLE IF NOT EXISTS inventory_items (
    id               TEXT    PRIMARY KEY,

    -- Core fields (required for all categories)
    name             TEXT    NOT NULL,
    category         TEXT    NOT NULL,
    quantity         REAL    NOT NULL DEFAULT 0,
    unit             TEXT    NOT NULL,

    -- Common optional fields
    description      TEXT,
    cost_price       REAL,
    image_uri        TEXT,

    -- Product-specific fields
    price            REAL,
    sku              TEXT,

    -- Ingredient-specific fields
    reorder_level    REAL,

    -- Equipment-specific fields
    condition        TEXT,
    serial_number    TEXT,
    purchase_date    TEXT,

    -- Standard audit / sync fields
    status           TEXT    NOT NULL DEFAULT 'active',
    created_at       TEXT    NOT NULL,
    updated_at       TEXT    NOT NULL,
    is_synced        INTEGER NOT NULL DEFAULT 0,
    deleted_at       TEXT
  );
`;

// ─── INDEXES ──────────────────────────────────────────────────────────────────

export const inventoryItemsIndexes: string[] = [
  // Category is the most common filter predicate
  `CREATE INDEX IF NOT EXISTS idx_inventory_items_category ON inventory_items (category);`,
  // is_synced drives the background sync queue — must be fast
  `CREATE INDEX IF NOT EXISTS idx_inventory_items_is_synced ON inventory_items (is_synced);`,
  // Soft-delete filter appears in every live query
  `CREATE INDEX IF NOT EXISTS idx_inventory_items_deleted_at ON inventory_items (deleted_at);`,
  // Low-stock alert query: category='ingredient' AND quantity <= reorder_level
  `CREATE INDEX IF NOT EXISTS idx_inventory_items_reorder ON inventory_items (category, quantity, reorder_level);`,
  // SKU lookup for barcode scan — UNIQUE so two items cannot share a non-null SKU.
  // The WHERE clause makes this a partial index: NULL skus are excluded and never
  // counted as duplicates (SQLite treats each NULL as distinct, but the partial
  // index makes the intent explicit and avoids any engine-version ambiguity).
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_inventory_items_sku ON inventory_items (sku) WHERE sku IS NOT NULL;`,
];

// ─── TYPESCRIPT INTERFACE ─────────────────────────────────────────────────────

/**
 * Row shape of the `inventory_items` SQLite table.
 * Column names use snake_case to match the DB schema exactly — the repository
 * layer maps these to the camelCase `InventoryItem` domain type.
 */
export interface InventoryItemRow {
  id:             string;
  name:           string;
  category:       'product' | 'ingredient' | 'equipment';
  quantity:       number;
  unit:           string;
  description:    string | null;
  cost_price:     number | null;
  image_uri:      string | null;
  // Product
  price:          number | null;
  sku:            string | null;
  // Ingredient
  reorder_level:  number | null;
  // Equipment
  condition:      'good' | 'fair' | 'poor' | null;
  serial_number:  string | null;
  purchase_date:  string | null;
  // Audit
  status:         'active' | 'inactive' | 'deleted';
  created_at:     string;   // ISO 8601
  updated_at:     string;   // ISO 8601
  is_synced:      0 | 1;
  deleted_at:     string | null; // ISO 8601 or NULL
}

/**
 * All columns in their insertion order — used to keep INSERT and SELECT
 * column lists in sync without magic strings scattered across the repository.
 */
export const INVENTORY_ITEM_COLUMNS = [
  'id',
  'name',
  'category',
  'quantity',
  'unit',
  'description',
  'cost_price',
  'image_uri',
  'price',
  'sku',
  'reorder_level',
  'condition',
  'serial_number',
  'purchase_date',
  'status',
  'created_at',
  'updated_at',
  'is_synced',
  'deleted_at',
] as const;

export type InventoryItemColumn = (typeof INVENTORY_ITEM_COLUMNS)[number];

// ─── INPUT TYPES ──────────────────────────────────────────────────────────────

/**
 * Fields the caller must/can provide when creating a new item.
 * `id`, `created_at`, `updated_at`, `is_synced`, `deleted_at`, and `status`
 * are all managed by the repository and must NOT be passed by the caller.
 */
export type CreateInventoryItemInput = Omit<
  InventoryItemRow,
  'id' | 'status' | 'created_at' | 'updated_at' | 'is_synced' | 'deleted_at'
>;

/**
 * All business columns are patchable; audit columns are managed internally.
 */
export type UpdateInventoryItemInput = Partial<
  Omit<InventoryItemRow, 'id' | 'created_at' | 'is_synced' | 'deleted_at'>
>;
