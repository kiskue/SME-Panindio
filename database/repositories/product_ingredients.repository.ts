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
 *
 * UOM conversion:
 *   `stock_unit` (added in migration 006) records the ingredient's canonical
 *   stock unit at link time (e.g. 'kg').  `unit` remains the recipe unit
 *   (e.g. 'g').  `calculateStockDeductions()` converts `quantity_used` from
 *   the recipe unit to the stock unit before returning the deduction amounts.
 */

import { getDatabase } from '../database';
import type { ProductIngredientRow } from '../schemas/product_ingredients.schema';
import { PRODUCT_INGREDIENT_COLUMNS } from '../schemas/product_ingredients.schema';
import type {
  ProductIngredient,
  ProductIngredientDetail,
  SelectedIngredient,
  StockDeduction,
} from '@/types';
import { canConvert, convertUnit } from '@/utils/unitConversion';

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

/**
 * Converts `quantity` from `fromUnit` to `toUnit` when conversion is possible.
 * When units are identical or conversion is not supported (unknown unit pair),
 * returns `quantity` unchanged. This is intentionally non-throwing — unknown
 * or custom units (e.g. 'bag', 'box') should be treated as already in the
 * correct unit rather than crashing the deduction.
 */
function resolveConvertedQuantity(quantity: number, fromUnit: string, toUnit: string): number {
  if (fromUnit === toUnit) return quantity;
  if (!canConvert(fromUnit, toUnit)) return quantity;
  return convertUnit(quantity, fromUnit, toUnit);
}

// ─── Repository functions ─────────────────────────────────────────────────────

/**
 * Links an ingredient to a product with the given quantity.
 * Throws if the pair already exists — call `updateIngredientQuantity` instead.
 *
 * @param productId    Primary key of the product (inventory_items.category = 'product').
 * @param ingredientId Primary key of the ingredient (inventory_items.category = 'ingredient').
 * @param quantityUsed How much of the ingredient is used per unit of the product,
 *                     expressed in `unit` (the recipe unit).
 * @param unit         The unit used in the recipe (e.g. 'g').
 * @param stockUnit    The unit the ingredient is stocked in (e.g. 'kg').
 *                     Pass the value from `inventory_items.unit` for the ingredient.
 *                     When omitted, defaults to `unit` (no conversion will be applied).
 */
export async function addIngredientToProduct(
  productId:    string,
  ingredientId: string,
  quantityUsed: number,
  unit:         string,
  stockUnit?:   string,
): Promise<ProductIngredient> {
  const db  = await getDatabase();
  const id  = generateUUID();
  const now = new Date().toISOString();
  const resolvedStockUnit = stockUnit ?? null;

  await db.runAsync(
    `INSERT INTO ${TABLE} (${COLUMNS}) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, productId, ingredientId, quantityUsed, unit, resolvedStockUnit, now, now],
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
 * Updates the quantity, recipe unit, and optionally the stock unit for an
 * existing product–ingredient link identified by its primary key.
 *
 * @param stockUnit  Pass the current `inventory_items.unit` value for the
 *                   ingredient when the stock unit may have changed since the
 *                   link was first created.  Omit to leave `stock_unit`
 *                   unchanged in the database.
 */
export async function updateIngredientQuantity(
  id:           string,
  quantityUsed: number,
  unit:         string,
  stockUnit?:   string,
): Promise<ProductIngredient> {
  const db  = await getDatabase();
  const now = new Date().toISOString();

  if (stockUnit !== undefined) {
    await db.runAsync(
      `UPDATE ${TABLE} SET quantity_used = ?, unit = ?, stock_unit = ?, updated_at = ? WHERE id = ?`,
      [quantityUsed, unit, stockUnit, now, id],
    );
  } else {
    await db.runAsync(
      `UPDATE ${TABLE} SET quantity_used = ?, unit = ?, updated_at = ? WHERE id = ?`,
      [quantityUsed, unit, now, id],
    );
  }

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
 *
 * Also populates `stockUnit` and `convertedQuantity` on each row so callers
 * have everything needed for deduction calculations without additional queries.
 */
export async function getProductIngredients(
  productId: string,
): Promise<ProductIngredientDetail[]> {
  const db = await getDatabase();

  const rows = await db.getAllAsync<{
    id:                string;
    product_id:        string;
    ingredient_id:     string;
    quantity_used:     number;
    unit:              string;
    stock_unit:        string | null;
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
       pi.stock_unit,
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
    const cost          = r.ingredient_cost ?? 0;
    const lineCost      = r.quantity_used * cost;
    const stockUnit     = r.stock_unit ?? r.unit;
    const convertedQty  = resolveConvertedQuantity(r.quantity_used, r.unit, stockUnit);
    return {
      id:                 r.id,
      productId:          r.product_id,
      ingredientId:       r.ingredient_id,
      quantityUsed:       r.quantity_used,
      unit:               r.unit,
      createdAt:          r.created_at,
      updatedAt:          r.updated_at,
      ingredientName:     r.ingredient_name,
      ingredientUnit:     r.ingredient_unit,
      ingredientQuantity: r.ingredient_stock,
      lineCost,
      stockUnit,
      convertedQuantity:  convertedQty,
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
 * For each `product_ingredients` row the deduction is converted from the
 * recipe unit (`unit`) to the stock unit (`stock_unit`) before being applied:
 *
 *   recipeDeduction  = quantity_used × unitsProduced        (in recipe unit)
 *   stockDeduction   = convertUnit(recipeDeduction, unit, stock_unit)
 *   new quantity     = MAX(0, current quantity − stockDeduction)
 *
 * When `stock_unit` is NULL (rows created before migration 006) or when the
 * units are identical, no conversion is applied — the deduction equals
 * `quantity_used × unitsProduced` as before.
 *
 * Runs inside a single transaction — all deductions succeed or none do.
 * Returns the actual amounts deducted (in stock units) and resulting quantities.
 */
export async function consumeIngredients(
  productId:     string,
  unitsProduced: number,
): Promise<IngredientConsumptionResult[]> {
  const db = await getDatabase();

  // Fetch ingredient links with current stock quantities and both unit columns
  const links = await db.getAllAsync<{
    ingredient_id:  string;
    quantity_used:  number;
    unit:           string;
    stock_unit:     string | null;
    current_qty:    number;
  }>(
    `SELECT pi.ingredient_id, pi.quantity_used, pi.unit, pi.stock_unit,
            ii.quantity AS current_qty
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
      // Convert recipe quantity to stock unit before deducting
      const recipeDeduction = link.quantity_used * unitsProduced;
      const effectiveSU     = link.stock_unit ?? link.unit;
      const stockDeduction  = resolveConvertedQuantity(recipeDeduction, link.unit, effectiveSU);

      const newQuantity = Math.max(0, link.current_qty - stockDeduction);
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
 *
 * @param ingredients  Each entry may include an optional `stockUnit` (the
 *                     inventory unit of the ingredient, e.g. 'kg').  Passing
 *                     it enables UOM conversion in `consumeIngredients()` and
 *                     `calculateStockDeductions()` for these links.
 */
export async function replaceProductIngredients(
  productId:   string,
  ingredients: { ingredientId: string; quantityUsed: number; unit: string; stockUnit?: string }[],
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
      const id            = generateUUID();
      const resolvedSU    = ing.stockUnit ?? null;
      await db.runAsync(
        `INSERT INTO ${TABLE} (${COLUMNS}) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, productId, ing.ingredientId, ing.quantityUsed, ing.unit, resolvedSU, now, now],
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

// ─── UOM-aware stock deduction preview ────────────────────────────────────────
//
// Two functions:
//   calculateDeductionsFromIngredients — pure, synchronous, no DB (new products)
//   calculateStockDeductions           — async DB read (existing saved products)

// ─── In-memory deduction calculation (no DB) ─────────────────────────────────

/**
 * Computes per-ingredient stock deductions directly from a `SelectedIngredient[]`
 * array — no database lookup required.
 *
 * Use this for NEW products that have not yet been saved to the DB (and therefore
 * have no `productId` to pass to `calculateStockDeductions`).
 *
 * Business logic (Flour example):
 *   ingredient: quantityUsed = 200, unit = 'g', stockUnit = 'kg'
 *   qty = 5
 *   recipeTotal    = 200 × 5 = 1000 g
 *   amountToDeduct = convertUnit(1000, 'g', 'kg') = 1 kg
 *
 * When `unit === stockUnit` or conversion is not supported (unknown custom
 * units such as 'bag', 'box'), `amountToDeduct` equals `quantityUsed × qty`
 * unchanged — same defensive policy as `resolveConvertedQuantity`.
 *
 * This is a PURE synchronous function — no async, no DB side-effects.
 *
 * @param ingredients  Live `SelectedIngredient[]` from the form state.
 * @param qty          Number of product units being produced (must be > 0).
 * @returns            One `StockDeduction` per ingredient entry.
 */
export function calculateDeductionsFromIngredients(
  ingredients: SelectedIngredient[],
  qty:         number,
): StockDeduction[] {
  return ingredients.map((ing) => {
    const recipeTotal    = ing.quantityUsed * qty;
    const amountToDeduct = resolveConvertedQuantity(recipeTotal, ing.unit, ing.stockUnit);
    return {
      ingredientId:   ing.ingredientId,
      ingredientName: ing.ingredientName,
      amountToDeduct,
      stockUnit:      ing.stockUnit,
    };
  });
}

// ─── DB-backed stock deduction preview ───────────────────────────────────────

/**
 * Returns the per-ingredient stock deductions required to produce `quantity`
 * units of the product, with all amounts converted to each ingredient's
 * stock unit.
 *
 * This function is READ-ONLY — it does not write to the database.
 * Use it to preview or validate deductions before calling `consumeIngredients()`,
 * or to build the ingredient line items for `createProductionLog()`.
 *
 * Business logic (Flour example):
 *   product_ingredients row: quantity_used = 200, unit = 'g', stock_unit = 'kg'
 *   quantity = 5 (producing 5 units of the product)
 *   recipeTotal    = 200 × 5 = 1000 g
 *   amountToDeduct = convertUnit(1000, 'g', 'kg') = 1 kg
 *
 * When `stock_unit` is NULL (pre-migration-006 rows) or when units match,
 * `amountToDeduct` equals `quantity_used × quantity` with no conversion.
 *
 * @param productId  The product whose recipe ingredients should be resolved.
 * @param quantity   Number of product units being produced (must be > 0).
 * @returns          One `StockDeduction` per linked ingredient.
 */
export async function calculateStockDeductions(
  productId: string,
  quantity:  number,
): Promise<StockDeduction[]> {
  const db = await getDatabase();

  const rows = await db.getAllAsync<{
    ingredient_id:   string;
    ingredient_name: string;
    quantity_used:   number;
    unit:            string;
    stock_unit:      string | null;
  }>(
    `SELECT
       pi.ingredient_id,
       ii.name       AS ingredient_name,
       pi.quantity_used,
       pi.unit,
       pi.stock_unit
     FROM product_ingredients pi
     JOIN inventory_items ii ON ii.id = pi.ingredient_id
     WHERE pi.product_id = ?
       AND ii.deleted_at IS NULL
     ORDER BY pi.created_at ASC`,
    [productId],
  );

  return rows.map((r) => {
    const effectiveSU   = r.stock_unit ?? r.unit;
    const recipeTotal   = r.quantity_used * quantity;
    const amountToDeduct = resolveConvertedQuantity(recipeTotal, r.unit, effectiveSU);
    return {
      ingredientId:   r.ingredient_id,
      ingredientName: r.ingredient_name,
      amountToDeduct,
      stockUnit:      effectiveSU,
    };
  });
}
