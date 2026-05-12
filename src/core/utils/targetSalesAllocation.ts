/**
 * targetSalesAllocation.ts
 *
 * Pure allocation algorithm for the Target Sales feature.
 *
 * Three strategies are implemented:
 *
 *   1. Even distribution (`allocateUnitsEvenly`)
 *      ─ Divides `totalUnits` equally across all products.
 *      ─ Used when no prior-day sales data exist, or when there is only one product.
 *
 *   2. History-weighted distribution (`allocateUnitsByHistory`)
 *      ─ Products that sold more yesterday get proportionally more units today.
 *      ─ Falls back to even distribution when ALL previous-day sales are zero
 *        (new products with no history).
 *
 *   3. Smart next-day distribution (`allocateUnitsSmartNextDay`)
 *      ─ Starts from history-weighted allocation.
 *      ─ Applies a day-of-week multiplier per product before rounding.
 *        weekends (+10 %) reward fast movers; midweek day Tuesday has a slight
 *        dip multiplier (-5 %) which reflects the typical F&B lull.
 *        The multipliers are intentionally mild — they adjust priorities rather
 *        than dramatically changing the distribution.
 *      ─ Falls back to even distribution when ALL previous-day sales are zero.
 *
 * Rounding strategy — Largest Remainder Method (Hamilton method):
 *   ─ Floor each product's raw (decimal) allocation to get an integer base.
 *   ─ Compute each product's remainder (raw - floor).
 *   ─ Sum up the floors. The difference between totalUnits and the floor sum is
 *     the number of extra units to distribute.
 *   ─ Sort products by remainder descending, give +1 unit to the top N products.
 *   ─ This guarantees SUM(targetUnits) === totalUnits with no off-by-one.
 *
 * Business rule: every selected product gets at least 1 unit.
 *   The minimum-1 enforcement happens BEFORE the proportional allocation so the
 *   proportional math operates on the remainder after reserving 1 unit each.
 *
 * TypeScript strict-mode compliance:
 *   - exactOptionalPropertyTypes: no undefined passed to optional props.
 *   - noUncheckedIndexedAccess: all array index accesses guarded with ?? fallbacks.
 *   - noUnusedLocals/Parameters: unused params prefixed with _.
 */

import type { AllocationStrategy, InventoryItem, ProductTarget } from '@/types';

// ─── Day-of-week multipliers ──────────────────────────────────────────────────

/**
 * Day-of-week multipliers for the 'smart' next-day strategy.
 * Index matches JavaScript's `Date.prototype.getDay()` (0=Sunday, 6=Saturday).
 *
 * Rationale (Philippine SME food/retail context):
 *   - Weekends (0, 6): +10 % — higher foot traffic, family purchases
 *   - Friday (5):      +5 %  — end-of-week payday spending bump
 *   - Tuesday (2):     -5 %  — slowest midweek day in most F&B/retail studies
 *   - Other weekdays:  0 %   — no adjustment
 *
 * These multipliers are applied per-product and then the entire vector is
 * re-normalised (divide by sum), so the multipliers affect priority weights
 * rather than absolute unit counts. The total still sums to exactly
 * `totalUnits` after the largest-remainder rounding pass.
 */
const DOW_MULTIPLIERS: Readonly<Record<number, number>> = {
  0: 1.10, // Sunday   +10 %
  1: 1.00, // Monday    0 %
  2: 0.95, // Tuesday  -5 %
  3: 1.00, // Wednesday 0 %
  4: 1.00, // Thursday  0 %
  5: 1.05, // Friday   +5 %
  6: 1.10, // Saturday +10 %
};

/**
 * Returns the day-of-week multiplier for the given date.
 * Falls back to 1.0 (no adjustment) for any unexpected day index.
 */
function getDowMultiplier(date: Date): number {
  const dow = date.getDay();
  return DOW_MULTIPLIERS[dow] ?? 1.0;
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

/**
 * Builds a `ProductTarget` for the even-distribution base case.
 * `multiplier` is always 1.0 here — it is only meaningful in 'smart' mode.
 */
function makeProductTarget(
  product:          InventoryItem,
  targetUnits:      number,
  previousDayUnits: number,
  multiplier:       number,
): ProductTarget {
  return {
    productId:        product.id,
    productName:      product.name,
    targetUnits,
    previousDayUnits,
    multiplier,
  };
}

/**
 * Validates and normalises inputs shared by all three allocation functions.
 * Throws if products array is empty or totalUnits is non-positive.
 * Returns the clamped totalUnits (minimum = products.length to satisfy the
 * minimum-1-unit-per-product rule).
 */
function normaliseInputs(products: InventoryItem[], totalUnits: number): number {
  if (products.length === 0) {
    throw new Error('targetSalesAllocation: products array must not be empty.');
  }
  if (totalUnits < 1) {
    throw new Error('targetSalesAllocation: totalUnits must be >= 1.');
  }
  // Guarantee minimum 1 unit per product
  return Math.max(totalUnits, products.length);
}

// ─── Largest-remainder rounding ───────────────────────────────────────────────

/**
 * Distributes `totalUnits` integer units across N weights using the
 * Largest Remainder Method (Hamilton method).
 *
 * Algorithm:
 *   1. Compute raw (decimal) share for each product: weight[i] / sumWeights * totalUnits
 *   2. Floor each share to get integer bases.
 *   3. Compute remainder[i] = raw[i] - floor[i].
 *   4. remainder_units = totalUnits - sum(bases).
 *   5. Sort indices by remainder descending; give +1 to top remainder_units items.
 *   6. Return array of integer allocations in input order.
 *
 * Preconditions:
 *   - weights.length > 0
 *   - sumWeights > 0  (caller is responsible)
 *   - totalUnits > 0
 *
 * Postcondition: sum(result) === totalUnits
 */
function largestRemainder(weights: number[], totalUnits: number): number[] {
  const n = weights.length;
  const sumWeights = weights.reduce((acc, w) => acc + w, 0);

  // Compute raw shares and floor bases
  const raw: number[]     = weights.map((w) => (w / sumWeights) * totalUnits);
  const bases: number[]   = raw.map((r) => Math.floor(r));
  const remainders: number[] = raw.map((r, i) => r - (bases[i] ?? 0));

  const baseSum = bases.reduce((acc, b) => acc + b, 0);
  const extraUnits = totalUnits - baseSum; // always >= 0 due to floor

  // Sort indices by remainder descending to determine who gets the +1 units
  const indices = Array.from({ length: n }, (_, idx) => idx);
  indices.sort((a, b) => (remainders[b] ?? 0) - (remainders[a] ?? 0));

  const result = [...bases];
  for (let k = 0; k < extraUnits; k++) {
    const idx = indices[k] ?? 0;
    result[idx] = (result[idx] ?? 0) + 1;
  }

  return result;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Distributes `totalUnits` evenly across all selected products.
 *
 * Each product receives floor(totalUnits / n) units.
 * Remainder units are distributed one-at-a-time to the first products in the
 * array (stable ordering — avoids random tie-breaking).
 *
 * Every product is guaranteed at least 1 unit. If totalUnits < products.length,
 * it is silently clamped to products.length.
 *
 * @param products   — selected InventoryItem[] (category === 'product')
 * @param totalUnits — total integer units to distribute
 * @returns ProductTarget[] with targetUnits summing exactly to totalUnits
 */
export function allocateUnitsEvenly(
  products:   InventoryItem[],
  totalUnits: number,
): ProductTarget[] {
  const safeTotal = normaliseInputs(products, totalUnits);

  // Equal weight of 1 per product → largestRemainder gives even spread
  const weights  = products.map(() => 1);
  const units    = largestRemainder(weights, safeTotal);

  return products.map((p, i) =>
    makeProductTarget(p, units[i] ?? 1, 0, 1.0),
  );
}

/**
 * Distributes `totalUnits` proportionally by each product's previous-day sales.
 *
 * If ALL previous-day sales are zero (new product launch day), falls back to
 * `allocateUnitsEvenly` — there is no history to weight by.
 *
 * Minimum 1 unit per product is enforced:
 *   Each product starts with 1 unit reserved. The remaining
 *   (totalUnits - products.length) units are then distributed by weight.
 *   This avoids the pathological case where a new product with 0 previous
 *   sales would receive 0 units even when it IS selected by the user.
 *
 * @param products         — selected InventoryItem[]
 * @param totalUnits       — total integer units to distribute
 * @param previousDaySales — map of productId → units sold yesterday
 * @returns ProductTarget[] with targetUnits summing exactly to totalUnits
 */
export function allocateUnitsByHistory(
  products:         InventoryItem[],
  totalUnits:       number,
  previousDaySales: Record<string, number>,
): ProductTarget[] {
  const safeTotal = normaliseInputs(products, totalUnits);

  const prevUnits = products.map(
    (p) => Math.max(0, previousDaySales[p.id] ?? 0),
  );
  const totalPrev = prevUnits.reduce((acc, u) => acc + u, 0);

  // All-zero history → even distribution
  if (totalPrev === 0) {
    return allocateUnitsEvenly(products, safeTotal);
  }

  const n = products.length;

  // Reserve 1 unit per product first, distribute the remainder by weight
  const remainder = safeTotal - n;

  let units: number[];

  if (remainder <= 0) {
    // Not enough units to do proportional weighting — give 1 to everyone
    units = products.map(() => 1);
  } else {
    // prevUnits act as weights; add the reserved units back after rounding
    const proportional = largestRemainder(prevUnits, remainder);
    units = proportional.map((extra) => 1 + extra);
  }

  return products.map((p, i) =>
    makeProductTarget(p, units[i] ?? 1, prevUnits[i] ?? 0, 1.0),
  );
}

/**
 * Distributes `totalUnits` for the NEXT DAY using both sales history and
 * day-of-week seasonality adjustments.
 *
 * Algorithm:
 *   1. Compute per-product day-of-week multiplier from `targetDate`.
 *   2. Compute adjusted weight = prevDaySales[i] * multiplier[i].
 *   3. Apply the same minimum-1 + largest-remainder approach as
 *      `allocateUnitsByHistory`, using the adjusted weights.
 *   4. Fall back to even distribution if ALL adjusted weights are zero.
 *
 * The multipliers are stored on each `ProductTarget` so the UI can explain
 * to the user why certain products received a higher target.
 *
 * @param products         — selected InventoryItem[]
 * @param totalUnits       — total integer units to distribute
 * @param previousDaySales — map of productId → units sold on the most recent day
 * @param targetDate       — the Date object representing the day being planned for
 * @returns ProductTarget[] with targetUnits summing exactly to totalUnits
 */
export function allocateUnitsSmartNextDay(
  products:         InventoryItem[],
  totalUnits:       number,
  previousDaySales: Record<string, number>,
  targetDate:       Date,
): ProductTarget[] {
  const safeTotal = normaliseInputs(products, totalUnits);

  const multiplier = getDowMultiplier(targetDate);

  const prevUnits = products.map(
    (p) => Math.max(0, previousDaySales[p.id] ?? 0),
  );

  // Adjusted weight = prevSales × day-of-week multiplier
  const adjustedWeights = prevUnits.map((u) => u * multiplier);
  const totalAdjusted   = adjustedWeights.reduce((acc, w) => acc + w, 0);

  // All-zero adjusted weights → even distribution (no history to lean on)
  if (totalAdjusted === 0) {
    return products.map((p, i) =>
      makeProductTarget(p, allocateUnitsEvenly(products, safeTotal)[i]?.targetUnits ?? 1, 0, multiplier),
    );
  }

  const n = products.length;
  const remainder = safeTotal - n;

  let units: number[];

  if (remainder <= 0) {
    units = products.map(() => 1);
  } else {
    const proportional = largestRemainder(adjustedWeights, remainder);
    units = proportional.map((extra) => 1 + extra);
  }

  return products.map((p, i) =>
    makeProductTarget(p, units[i] ?? 1, prevUnits[i] ?? 0, multiplier),
  );
}

// ─── Unified entry point ─────────────────────────────────────────────────────

/**
 * Parameters accepted by `computeTargetSalesAllocation`.
 */
export interface ComputeAllocationParams {
  products:          InventoryItem[];
  totalTargetUnits:  number;
  /**
   * Sales volumes from the most recent day that had any sales.
   * Pass an empty object `{}` when no prior sales exist.
   * Keys are `inventory_items.id` strings; values are integer unit counts.
   */
  previousDaySales:  Record<string, number>;
  /**
   * Calendar date the plan covers — determines which strategy is used:
   *   - Same as today → 'weighted' (or 'even' if no history)
   *   - Tomorrow or later → 'smart' (weighted + DoW multiplier)
   */
  targetDate:        Date;
}

export interface ComputeAllocationResult {
  allocations: ProductTarget[];
  strategy:    AllocationStrategy;
}

/**
 * Unified allocation entry point.  Selects the appropriate strategy based on
 * `targetDate` and the presence of historical sales data, then returns the
 * computed `ProductTarget[]` along with the strategy label for display and
 * audit purposes.
 *
 * Strategy selection rules:
 *   ┌──────────────────────────────────────────┬──────────────┐
 *   │ Condition                                │ Strategy     │
 *   ├──────────────────────────────────────────┼──────────────┤
 *   │ targetDate > today (planning ahead)      │ 'smart'      │
 *   │ targetDate <= today AND history exists   │ 'weighted'   │
 *   │ targetDate <= today AND no history       │ 'even'       │
 *   │ Only 1 product selected                  │ 'even'       │
 *   └──────────────────────────────────────────┴──────────────┘
 *
 * @returns `{ allocations, strategy }` — allocations sum exactly to totalTargetUnits.
 */
export function computeTargetSalesAllocation(
  params: ComputeAllocationParams,
): ComputeAllocationResult {
  const { products, totalTargetUnits, previousDaySales, targetDate } = params;

  if (products.length === 0) {
    return { allocations: [], strategy: 'even' };
  }

  // Single-product: all units go to that product
  if (products.length === 1) {
    const product = products[0];
    if (product === undefined) {
      return { allocations: [], strategy: 'even' };
    }
    const safeTotal = Math.max(1, totalTargetUnits);
    return {
      allocations: [
        makeProductTarget(product, safeTotal, previousDaySales[product.id] ?? 0, 1.0),
      ],
      strategy: 'even',
    };
  }

  // Check whether any history exists
  const hasHistory = Object.values(previousDaySales).some((v) => v > 0);

  // Determine if targetDate is strictly in the future (next day or beyond)
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const targetStart = new Date(targetDate);
  targetStart.setHours(0, 0, 0, 0);
  const isNextDay = targetStart.getTime() > todayStart.getTime();

  if (isNextDay && hasHistory) {
    return {
      allocations: allocateUnitsSmartNextDay(
        products,
        totalTargetUnits,
        previousDaySales,
        targetDate,
      ),
      strategy: 'smart',
    };
  }

  if (hasHistory) {
    return {
      allocations: allocateUnitsByHistory(
        products,
        totalTargetUnits,
        previousDaySales,
      ),
      strategy: 'weighted',
    };
  }

  return {
    allocations: allocateUnitsEvenly(products, totalTargetUnits),
    strategy: 'even',
  };
}
