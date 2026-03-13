/**
 * product_ingredients.repository.ts
 *
 * All SQLite access for the `product_ingredients` junction table lives here.
 * No SQL may appear in screens, hooks, or Zustand stores — they call
 * these functions exclusively.
 *
 * ID generation uses the same Math.random()-based RFC 4122 v4 UUID helper
 * as inventory_items.repository.ts — `crypto.randomUUID()` is not available
 * in the Hermes engine bundled with React Native 0.81 / Expo SDK 54.
 */

import { getDatabase } from '../database';
import type { ProductIngredientRow } from '../schemas/product_ingredients.schema';
import { PRODUCT_INGREDIENT_COLUMNS } from '../schemas/product_ingredients.schema';
import type { ProductIngredient, ProductIngredientWithDetails } from '@/types';

// ─── UUID helper ──────────────────────────────────────────────────────────────

function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// ─── Column projection ────────────────────────────────────────────────────────

const COLUMNS = PRODUCT_INGREDIENT_COLUMNS.join(', ');
const TABLE   = 'product_ingredients';

// ─── Domain mapping ───────────────────────────────────────────────────────────

function toDomain(row: ProductIngredientRow): ProductIngredient {
  return {
    id:           row.id,
    productId:    row.product_id,
    ingredientId: row.ingredient_id,
    quantityUsed: row.quantity_used,
    unit:         row.unit,
    createdAt:    row.created_at,
    updatedAt:    row.updated_at,
  };
}

// ─── Repository functions ─────────────────────────────────────────────────────

/**
 * Links an ingredient to a product with the given quantity.
 * Throws if the pair already exists — call `updateIngredientQuantity` instead.
 */
export async function addIngredientToProduct(
  productId:    string,
  ingredientId: string,
  quantityUsed: number,
  unit:         string,
): Promise<ProductIngredient> {
  const db  = await getDatabase();
  const id  = generateUUID();
  const now = new Date().toISOString();

  await db.runAsync(
    `INSERT INTO ${TABLE} (${COLUMNS}) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [id, productId, ingredientId, quantityUsed, unit, now, now],
  );

  const row = await db.getFirstAsync<ProductIngredientRow>(
    `SELECT ${COLUMNS} FROM ${TABLE} WHERE id = ?`,
    [id],
  );

  if (row === null) {
    throw new Error(`[product_ingredients] INSERT succeeded but SELECT returned null for id=${id}`);
  }

  return toDomain(row);
}

/**
 * Removes an ingredient link from a product.
 * No-op if the pair does not exist.
 */
export async function removeIngredientFromProduct(
  productId:    string,
  ingredientId: string,
): Promise<void> {
  const db = await getDatabase();

  await db.runAsync(
    `DELETE FROM ${TABLE} WHERE product_id = ? AND ingredient_id = ?`,
    [productId, ingredientId],
  );
}

/**
 * Updates the quantity used (and optionally the unit) for an existing
 * product–ingredient link identified by its primary key.
 */
export async function updateIngredientQuantity(
  id:          string,
  quantityUsed: number,
  unit:         string,
): Promise<ProductIngredient> {
  const db  = await getDatabase();
  const now = new Date().toISOString();

  await db.runAsync(
    `UPDATE ${TABLE} SET quantity_used = ?, unit = ?, updated_at = ? WHERE id = ?`,
    [quantityUsed, unit, now, id],
  );

  const row = await db.getFirstAsync<ProductIngredientRow>(
    `SELECT ${COLUMNS} FROM ${TABLE} WHERE id = ?`,
    [id],
  );

  if (row === null) {
    throw new Error(`[product_ingredients] UPDATE target not found for id=${id}`);
  }

  return toDomain(row);
}

/**
 * Returns all ingredient links for a product, joined with the ingredient's
 * name, unit, cost_price, and current stock quantity from `inventory_items`.
 * Computes `line_cost = quantity_used * cost_price` inline.
 */
export async function getProductIngredients(
  productId: string,
): Promise<ProductIngredientWithDetails[]> {
  const db = await getDatabase();

  const rows = await db.getAllAsync<{
    id:                string;
    product_id:        string;
    ingredient_id:     string;
    quantity_used:     number;
    unit:              string;
    created_at:        string;
    updated_at:        string;
    ingredient_name:   string;
    ingredient_unit:   string;
    ingredient_cost:   number | null;
    ingredient_stock:  number;
  }>(
    `SELECT
       pi.id,
       pi.product_id,
       pi.ingredient_id,
       pi.quantity_used,
       pi.unit,
       pi.created_at,
       pi.updated_at,
       ii.name        AS ingredient_name,
       ii.unit        AS ingredient_unit,
       ii.cost_price  AS ingredient_cost,
       ii.quantity    AS ingredient_stock
     FROM product_ingredients pi
     JOIN inventory_items ii ON ii.id = pi.ingredient_id
     WHERE pi.product_id = ?
       AND ii.deleted_at IS NULL
     ORDER BY pi.created_at ASC`,
    [productId],
  );

  return rows.map((r) => {
    const cost     = r.ingredient_cost ?? 0;
    const lineCost = r.quantity_used * cost;
    return {
      id:                r.id,
      productId:         r.product_id,
      ingredientId:      r.ingredient_id,
      quantityUsed:      r.quantity_used,
      unit:              r.unit,
      createdAt:         r.created_at,
      updatedAt:         r.updated_at,
      ingredientName:    r.ingredient_name,
      ingredientUnit:    r.ingredient_unit,
      ingredientQuantity: r.ingredient_stock,
      lineCost,
      ...(r.ingredient_cost !== null ? { ingredientCostPrice: r.ingredient_cost } : {}),
    };
  });
}

/**
 * Returns the total ingredient cost for a product:
 *   SUM(quantity_used × ingredient.cost_price)
 * Ingredients with no cost_price contribute 0.
 */
export async function calculateProductCost(productId: string): Promise<number> {
  const db = await getDatabase();

  const result = await db.getFirstAsync<{ total: number | null }>(
    `SELECT SUM(pi.quantity_used * COALESCE(ii.cost_price, 0)) AS total
     FROM product_ingredients pi
     JOIN inventory_items ii ON ii.id = pi.ingredient_id
     WHERE pi.product_id = ?
       AND ii.deleted_at IS NULL`,
    [productId],
  );

  return result?.total ?? 0;
}

/**
 * Returns the computed ingredient cost for every product that has at least
 * one linked ingredient. Used for bulk cost summaries.
 */
export async function getAllProductsWithCost(): Promise<
  { productId: string; totalCost: number }[]
> {
  const db = await getDatabase();

  const rows = await db.getAllAsync<{ product_id: string; total: number }>(
    `SELECT
       pi.product_id,
       SUM(pi.quantity_used * COALESCE(ii.cost_price, 0)) AS total
     FROM product_ingredients pi
     JOIN inventory_items ii ON ii.id = pi.ingredient_id
     WHERE ii.deleted_at IS NULL
     GROUP BY pi.product_id`,
    [],
  );

  return rows.map((r) => ({ productId: r.product_id, totalCost: r.total }));
}

// ─── Ingredient consumption ───────────────────────────────────────────────────

export interface IngredientConsumptionResult {
  ingredientId: string;
  deducted:     number;
  newQuantity:  number;
}

/**
 * Deducts ingredient stock for every ingredient linked to a product.
 *
 * For each `product_ingredients` row:
 *   deduction = quantity_used × unitsProduced
 *   new quantity = MAX(0, current quantity − deduction)
 *
 * Runs inside a single transaction — all deductions succeed or none do.
 * Returns the actual amounts deducted and the resulting quantities.
 */
export async function consumeIngredients(
  productId:     string,
  unitsProduced: number,
): Promise<IngredientConsumptionResult[]> {
  const db = await getDatabase();

  // Fetch ingredient links with current stock quantities
  const links = await db.getAllAsync<{
    ingredient_id:  string;
    quantity_used:  number;
    current_qty:    number;
  }>(
    `SELECT pi.ingredient_id, pi.quantity_used, ii.quantity AS current_qty
     FROM product_ingredients pi
     JOIN inventory_items ii ON ii.id = pi.ingredient_id
     WHERE pi.product_id = ? AND ii.deleted_at IS NULL`,
    [productId],
  );

  if (links.length === 0) return [];

  const results: IngredientConsumptionResult[] = [];
  const now = new Date().toISOString();

  await db.withTransactionAsync(async () => {
    for (const link of links) {
      const deduction   = link.quantity_used * unitsProduced;
      const newQuantity = Math.max(0, link.current_qty - deduction);
      const deducted    = link.current_qty - newQuantity;

      await db.runAsync(
        `UPDATE inventory_items
         SET quantity = ?, updated_at = ?, is_synced = 0
         WHERE id = ? AND deleted_at IS NULL`,
        [newQuantity, now, link.ingredient_id],
      );

      results.push({
        ingredientId: link.ingredient_id,
        deducted,
        newQuantity,
      });
    }
  });

  return results;
}

/**
 * Replaces all ingredient links for a product in a single transaction.
 * Useful when the user saves the full ingredient list at once from the UI.
 */
export async function replaceProductIngredients(
  productId:   string,
  ingredients: { ingredientId: string; quantityUsed: number; unit: string }[],
): Promise<ProductIngredient[]> {
  const db  = await getDatabase();
  const now = new Date().toISOString();
  const results: ProductIngredient[] = [];

  await db.withTransactionAsync(async () => {
    // Remove all existing links for this product
    await db.runAsync(
      `DELETE FROM ${TABLE} WHERE product_id = ?`,
      [productId],
    );

    // Re-insert the new set
    for (const ing of ingredients) {
      const id = generateUUID();
      await db.runAsync(
        `INSERT INTO ${TABLE} (${COLUMNS}) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [id, productId, ing.ingredientId, ing.quantityUsed, ing.unit, now, now],
      );
      results.push({
        id,
        productId,
        ingredientId: ing.ingredientId,
        quantityUsed: ing.quantityUsed,
        unit:         ing.unit,
        createdAt:    now,
        updatedAt:    now,
      });
    }
  });

  return results;
}
