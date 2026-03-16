/**
 * ingredientPreflight.ts
 *
 * Pure, synchronous pre-flight check for ingredient availability.
 *
 * This module answers one question before any DB write:
 *   "Given the ingredients in the form and the current stock levels,
 *    are there any shortfalls if we produce `quantity` units?"
 *
 * It is deliberately free of async I/O — the Zustand inventory store already
 * holds current ingredient quantities in memory, so this runs at call-site
 * synchronously with zero latency.
 *
 * Unit conversion follows the same rules as `consumeIngredients()` in
 * product_ingredients.repository.ts:
 *   recipeDeduction = quantityUsed × unitsProduced   (in recipe unit)
 *   stockDeduction  = convertUnit(recipeDeduction, unit, stockUnit)
 * When `unit === stockUnit` or conversion is not possible (opaque units like
 * 'bag', 'box'), `recipeDeduction` is used as-is — matching repository
 * behaviour exactly.
 */

import type { SelectedIngredient, InventoryItem } from '@/types';
import { canConvert, convertUnit } from '@/utils/unitConversion';

// ─── Public types ─────────────────────────────────────────────────────────────

/**
 * Describes a single ingredient that does not have enough stock to satisfy
 * the production run.
 */
export interface InsufficientStockItem {
  ingredientId:   string;
  ingredientName: string;
  /** Amount required, expressed in the ingredient's stock unit. */
  required:       number;
  /** Amount currently in stock, expressed in the ingredient's stock unit. */
  available:      number;
  /** The stock unit both `required` and `available` are expressed in. */
  unit:           string;
  /** Formatted shortage string, e.g. "needs 2 kg, has 0.8 kg". */
  shortageLabel:  string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Converts `quantity` from `fromUnit` to `toUnit` when conversion is possible.
 * When units are identical or the pair spans different dimensions (e.g. 'bag'
 * has no known conversion), returns `quantity` unchanged — matching the
 * `resolveConvertedQuantity` helper in product_ingredients.repository.ts.
 */
function resolveDeduction(quantity: number, fromUnit: string, toUnit: string): number {
  if (fromUnit === toUnit) return quantity;
  if (!canConvert(fromUnit, toUnit)) return quantity;
  return convertUnit(quantity, fromUnit, toUnit);
}

/**
 * Formats a number for display: no unnecessary trailing zeros.
 * e.g. 2.0 → "2", 0.25 → "0.25", 1.5 → "1.5"
 */
function fmt(n: number): string {
  // Round to 4 dp to suppress floating-point noise, then strip trailing zeros.
  return parseFloat(n.toFixed(4)).toString();
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Computes which ingredients (if any) have insufficient stock to produce
 * `unitsToProduced` units of a product with the given recipe.
 *
 * @param selectedIngredients  The recipe as built in the form — comes from
 *                             the `selectedIngredients` state in `add.tsx`.
 * @param unitsToProduced      Number of product units being produced.
 * @param inventoryItems       The current inventory cache from Zustand —
 *                             `useInventoryStore.getState().items`.  Only
 *                             items of category 'ingredient' are relevant.
 * @returns                    One entry per ingredient whose available stock
 *                             is below the required deduction.  An empty
 *                             array means all ingredients are sufficiently
 *                             stocked and the production run may proceed.
 */
export function runPreflightCheck(
  selectedIngredients: SelectedIngredient[],
  unitsToProduced:     number,
  inventoryItems:      InventoryItem[],
): InsufficientStockItem[] {
  if (selectedIngredients.length === 0 || unitsToProduced <= 0) return [];

  // Build a fast lookup map: ingredientId → current quantity
  const stockMap = new Map<string, number>();
  for (const item of inventoryItems) {
    if (item.category === 'ingredient') {
      stockMap.set(item.id, item.quantity);
    }
  }

  const shortfalls: InsufficientStockItem[] = [];

  for (const ing of selectedIngredients) {
    // Mirror the exact arithmetic in consumeIngredients()
    const recipeDeduction = ing.quantityUsed * unitsToProduced;
    const stockDeduction  = resolveDeduction(recipeDeduction, ing.unit, ing.stockUnit);

    const available = stockMap.get(ing.ingredientId) ?? 0;

    if (available < stockDeduction) {
      shortfalls.push({
        ingredientId:   ing.ingredientId,
        ingredientName: ing.ingredientName,
        required:       stockDeduction,
        available,
        unit:           ing.stockUnit,
        shortageLabel:  `needs ${fmt(stockDeduction)} ${ing.stockUnit}, has ${fmt(available)} ${ing.stockUnit}`,
      });
    }
  }

  return shortfalls;
}

/**
 * Builds a human-readable summary message for the shortage Alert dialog.
 * Produces a multi-line string suitable for `Alert.alert`'s `message` param.
 *
 * @param shortfalls   Result of `runPreflightCheck`.
 * @param productName  Display name for the product being added.
 */
export function buildShortageMessage(
  shortfalls:  InsufficientStockItem[],
  productName: string,
): string {
  const lines = shortfalls.map(
    (s) => `  • ${s.ingredientName}: ${s.shortageLabel}`,
  );
  return (
    `Not enough stock to produce "${productName}":\n\n` +
    lines.join('\n') +
    '\n\nYou can proceed anyway — deduction will be clamped to available stock.'
  );
}
