/**
 * product_ingredients.schema.ts
 *
 * SQLite schema for the `product_ingredients` junction table.
 *
 * Links a product (inventory_items.category = 'product') to one or more
 * ingredient items (inventory_items.category = 'ingredient'), recording how
 * much of each ingredient is consumed to produce one unit of the product.
 *
 * The `quantity_used` × `ingredient.cost_price` product gives the per-ingredient
 * line cost; summing all rows for a product yields the total ingredient cost,
 * which is surfaced in `calculateProductCost()` in the repository.
 *
 * UNIQUE(product_id, ingredient_id) prevents the same ingredient from being
 * listed twice for the same product — use `updateIngredientQuantity` to adjust.
 */

// ─── CREATE TABLE ─────────────────────────────────────────────────────────────

export const productIngredientsSchema = `
  CREATE TABLE IF NOT EXISTS product_ingredients (
    id              TEXT  PRIMARY KEY,
    product_id      TEXT  NOT NULL REFERENCES inventory_items(id),
    ingredient_id   TEXT  NOT NULL REFERENCES inventory_items(id),
    quantity_used   REAL  NOT NULL,
    unit            TEXT  NOT NULL,
    created_at      TEXT  NOT NULL,
    updated_at      TEXT  NOT NULL,
    UNIQUE (product_id, ingredient_id)
  );
`;

// ─── INDEXES ──────────────────────────────────────────────────────────────────

export const productIngredientsIndexes: string[] = [
  `CREATE INDEX IF NOT EXISTS idx_product_ingredients_product_id
     ON product_ingredients (product_id);`,
  `CREATE INDEX IF NOT EXISTS idx_product_ingredients_ingredient_id
     ON product_ingredients (ingredient_id);`,
];

// ─── ROW TYPE ─────────────────────────────────────────────────────────────────

/** Raw DB row shape — snake_case, matches the table columns exactly. */
export interface ProductIngredientRow {
  id:            string;
  product_id:    string;
  ingredient_id: string;
  quantity_used: number;
  unit:          string;
  created_at:    string; // ISO 8601
  updated_at:    string; // ISO 8601
}

// ─── COLUMN LIST ──────────────────────────────────────────────────────────────

export const PRODUCT_INGREDIENT_COLUMNS = [
  'id',
  'product_id',
  'ingredient_id',
  'quantity_used',
  'unit',
  'created_at',
  'updated_at',
] as const;

export type ProductIngredientColumn = (typeof PRODUCT_INGREDIENT_COLUMNS)[number];
