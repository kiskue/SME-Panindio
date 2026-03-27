/**
 * bomValidation.ts
 *
 * Async BOM pre-flight validation for the "Add Product Stock" flow.
 *
 * `validateStockAddition()` answers one question before any DB write:
 *   "Can we produce `requestedQty` units of this product right now,
 *    given the current ingredient and raw material stock levels?"
 *
 * It performs a read-only database query — no writes, no transactions.
 * Call it before `addProductStock()` to surface shortage details to the
 * user. `addProductStock()` performs its own internal validation inside
 * the transaction as a safety net, but pre-flight keeps the UX responsive.
 *
 * Unit conversion for ingredients follows the same rules as
 * `consumeIngredients()` in `product_ingredients.repository.ts`:
 *   recipeDeduction = quantity_used × requestedQty          (in recipe unit)
 *   stockDeduction  = convertUnit(recipeDeduction, unit, stockUnit)
 * When `stock_unit` is NULL or the unit pair cannot be converted (e.g. opaque
 * units like 'bag', 'box'), the recipe quantity is used as-is — this exactly
 * mirrors the non-throwing `resolveConvertedQuantity` helper in the repository.
 *
 * Raw materials have no unit conversion step — `quantity_required` is already
 * stored in the raw material's native unit.
 */

import { getDatabase } from '../../database/database';
import { canConvert, convertUnit } from '@/utils/unitConversion';
import type { BomShortageItem, BomValidationResult } from '@/types';

// ─── Internal helpers ─────────────────────────────────────────────────────────

/**
 * Converts `quantity` from `fromUnit` to `toUnit` without throwing.
 * Returns `quantity` unchanged when units are identical or the pair cannot
 * be converted — mirrors `resolveConvertedQuantity` in the repository layer.
 */
function resolveDeduction(quantity: number, fromUnit: string, toUnit: string): number {
  if (fromUnit === toUnit) return quantity;
  if (!canConvert(fromUnit, toUnit)) return quantity;
  return convertUnit(quantity, fromUnit, toUnit);
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Validates whether the current stock levels can satisfy a production run of
 * `requestedQty` units of the given product.
 *
 * Database reads performed:
 *   1. `product_ingredients` JOIN `inventory_items` — ingredient stock levels
 *      and unit conversion metadata.
 *   2. `product_raw_materials` JOIN `raw_materials` — raw material stock levels.
 *
 * @param productId    Primary key of the product (`inventory_items.category = 'product'`).
 * @param requestedQty Positive number of product units the operator wants to produce.
 * @returns            `BomValidationResult` — always resolves, never throws.
 */
export async function validateStockAddition(
  productId:    string,
  requestedQty: number,
): Promise<BomValidationResult> {
  const db = await getDatabase();

  // ── 1. Fetch ingredient links with current stock ────────────────────────────

  const ingredientRows = await db.getAllAsync<{
    ingredient_id:   string;
    ingredient_name: string;
    quantity_used:   number;
    unit:            string;
    stock_unit:      string | null;
    current_stock:   number;
  }>(
    `SELECT
       pi.ingredient_id,
       ii.name        AS ingredient_name,
       pi.quantity_used,
       pi.unit,
       pi.stock_unit,
       ii.quantity    AS current_stock
     FROM product_ingredients pi
     JOIN inventory_items ii
       ON ii.id = pi.ingredient_id
      AND ii.deleted_at IS NULL
     WHERE pi.product_id = ?
     ORDER BY pi.created_at ASC`,
    [productId],
  );

  // ── 2. Fetch raw material links with current stock ──────────────────────────

  const rawMaterialRows = await db.getAllAsync<{
    raw_material_id:   string;
    raw_material_name: string;
    quantity_required: number;
    unit:              string;
    current_stock:     number;
  }>(
    `SELECT
       prm.raw_material_id,
       rm.name             AS raw_material_name,
       prm.quantity_required,
       prm.unit,
       rm.quantity_in_stock AS current_stock
     FROM product_raw_materials prm
     JOIN raw_materials rm
       ON rm.id = prm.raw_material_id
      AND rm.is_active = 1
     WHERE prm.product_id = ?
     ORDER BY prm.created_at ASC`,
    [productId],
  );

  // ── 3. Short-circuit when there is no BOM ──────────────────────────────────

  if (ingredientRows.length === 0 && rawMaterialRows.length === 0) {
    return {
      isValid:      true,
      maxProducible: Infinity,
      shortages:    [],
      requestedQty,
    };
  }

  // ── 4. Evaluate each ingredient ────────────────────────────────────────────

  const shortages: BomShortageItem[] = [];
  // maxProducible tracks the minimum floor(available / requiredPerUnit)
  // across every BOM material. Start at +Infinity and narrow down.
  let maxProducible = Infinity;

  for (const row of ingredientRows) {
    const effectiveStockUnit = row.stock_unit ?? row.unit;
    // Per-unit requirement expressed in the stock unit
    const requiredPerUnit = resolveDeduction(row.quantity_used, row.unit, effectiveStockUnit);
    const totalRequired   = requiredPerUnit * requestedQty;
    const available       = row.current_stock;

    // Update maxProducible: how many whole units can this ingredient support?
    if (requiredPerUnit > 0) {
      const canMake = Math.floor(available / requiredPerUnit);
      if (canMake < maxProducible) maxProducible = canMake;
    }

    if (available < totalRequired) {
      shortages.push({
        ingredientId:   row.ingredient_id,
        ingredientName: row.ingredient_name,
        required:       requiredPerUnit,
        available,
        shortage:       totalRequired - available,
        unit:           effectiveStockUnit,
        isRawMaterial:  false,
      });
    }
  }

  // ── 5. Evaluate each raw material ──────────────────────────────────────────

  for (const row of rawMaterialRows) {
    const requiredPerUnit = row.quantity_required;
    const totalRequired   = requiredPerUnit * requestedQty;
    const available       = row.current_stock;

    if (requiredPerUnit > 0) {
      const canMake = Math.floor(available / requiredPerUnit);
      if (canMake < maxProducible) maxProducible = canMake;
    }

    if (available < totalRequired) {
      shortages.push({
        ingredientId:   row.raw_material_id,
        ingredientName: row.raw_material_name,
        required:       requiredPerUnit,
        available,
        shortage:       totalRequired - available,
        unit:           row.unit,
        isRawMaterial:  true,
      });
    }
  }

  return {
    isValid:      shortages.length === 0,
    maxProducible: Math.max(0, maxProducible),
    shortages,
    requestedQty,
  };
}
