/**
 * unitConversion.ts
 *
 * Converts quantities between units within the same measurement dimension.
 *
 * Supported dimensions and their canonical base units:
 *   Weight  → grams   (g)
 *   Volume  → millilitres (mL)
 *   Count   → pieces  (pcs)
 *
 * Unit string casing matches the StockUnit type in src/types/index.ts exactly:
 *   'g' | 'kg' | 'mg' | 'lb' | 'oz'
 *   'mL' | 'L' | 'cl' | 'fl_oz'
 *   'pcs' | 'dozen'
 *
 * Usage:
 *   convertUnit(200, 'g', 'kg')   // → 0.2
 *   convertUnit(1.5, 'L', 'mL')  // → 1500
 *   canConvert('g', 'kg')         // → true
 *   canConvert('g', 'mL')         // → false
 */

// ─── Dimension maps ────────────────────────────────────────────────────────────

/**
 * Each map converts from the keyed unit TO the canonical base unit for that
 * dimension. To convert between any two units in the same dimension:
 *   1. Convert `fromUnit` → base: multiply by toBase[fromUnit]
 *   2. Convert base → `toUnit`: divide by toBase[toUnit]
 */

const WEIGHT_TO_GRAMS: Readonly<Record<string, number>> = {
  mg:  0.001,
  g:   1,
  kg:  1_000,
  lb:  453.592_37,
  oz:  28.349_523_125,
};

const VOLUME_TO_ML: Readonly<Record<string, number>> = {
  mL:     1,
  cl:     10,
  L:      1_000,
  fl_oz:  29.573_529_562_5,
};

const COUNT_TO_PCS: Readonly<Record<string, number>> = {
  pcs:    1,
  dozen:  12,
};

// ─── Dimension resolver ───────────────────────────────────────────────────────

type DimensionMap = Readonly<Record<string, number>>;

/**
 * Returns the conversion map for `unit`, or `null` if `unit` is not
 * recognised in any dimension.
 */
function getDimensionMap(unit: string): DimensionMap | null {
  if (Object.prototype.hasOwnProperty.call(WEIGHT_TO_GRAMS, unit)) return WEIGHT_TO_GRAMS;
  if (Object.prototype.hasOwnProperty.call(VOLUME_TO_ML, unit))    return VOLUME_TO_ML;
  if (Object.prototype.hasOwnProperty.call(COUNT_TO_PCS, unit))    return COUNT_TO_PCS;
  return null;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Returns `true` when both units belong to the same measurement dimension
 * and a conversion factor is known for both.
 *
 * @example
 *   canConvert('g', 'kg')   // true  — both are weight
 *   canConvert('g', 'mL')   // false — different dimensions
 *   canConvert('g', 'box')  // false — 'box' is not a known unit
 */
export function canConvert(fromUnit: string, toUnit: string): boolean {
  if (fromUnit === toUnit) return true;
  const fromMap = getDimensionMap(fromUnit);
  if (fromMap === null) return false;
  return Object.prototype.hasOwnProperty.call(fromMap, toUnit);
}

/**
 * Converts `quantity` from `fromUnit` to `toUnit`.
 *
 * Throws a `RangeError` if:
 *   - either unit is unrecognised, OR
 *   - the units belong to different dimensions (e.g. weight ↔ volume).
 *
 * @param quantity  The value to convert (must be finite; may be negative for
 *                  return/correction entries).
 * @param fromUnit  Source unit string (e.g. 'g', 'mL', 'dozen').
 * @param toUnit    Target unit string (e.g. 'kg', 'L', 'pcs').
 * @returns         The converted value, rounded to 10 significant decimal
 *                  places to avoid floating-point noise accumulation.
 *
 * @example
 *   convertUnit(200,  'g',   'kg')    // → 0.2
 *   convertUnit(1.5,  'L',   'mL')   // → 1500
 *   convertUnit(2,    'dozen', 'pcs') // → 24
 *   convertUnit(0.2,  'kg',  'g')    // → 200
 */
export function convertUnit(quantity: number, fromUnit: string, toUnit: string): number {
  if (fromUnit === toUnit) return quantity;

  const fromMap = getDimensionMap(fromUnit);
  if (fromMap === null) {
    throw new RangeError(
      `[unitConversion] Unknown source unit: "${fromUnit}". ` +
      `Supported units: ${[...Object.keys(WEIGHT_TO_GRAMS), ...Object.keys(VOLUME_TO_ML), ...Object.keys(COUNT_TO_PCS)].join(', ')}.`,
    );
  }

  if (!Object.prototype.hasOwnProperty.call(fromMap, toUnit)) {
    const toMap = getDimensionMap(toUnit);
    if (toMap === null) {
      throw new RangeError(
        `[unitConversion] Unknown target unit: "${toUnit}". ` +
        `Supported units: ${[...Object.keys(WEIGHT_TO_GRAMS), ...Object.keys(VOLUME_TO_ML), ...Object.keys(COUNT_TO_PCS)].join(', ')}.`,
      );
    }
    throw new RangeError(
      `[unitConversion] Cannot convert between different dimensions: "${fromUnit}" and "${toUnit}".`,
    );
  }

  const fromFactor = fromMap[fromUnit] ?? 1;
  const toFactor   = fromMap[toUnit]   ?? 1;

  // quantity × (fromFactor / toFactor) converts via the shared base unit.
  // Round to 10 decimal places to suppress IEEE 754 trailing noise.
  const result = (quantity * fromFactor) / toFactor;
  return Math.round(result * 1e10) / 1e10;
}

/**
 * Returns all unit strings recognised in the weight dimension.
 * Useful for building unit-picker dropdowns filtered by dimension.
 */
export function weightUnits(): string[] {
  return Object.keys(WEIGHT_TO_GRAMS);
}

/**
 * Returns all unit strings recognised in the volume dimension.
 */
export function volumeUnits(): string[] {
  return Object.keys(VOLUME_TO_ML);
}

/**
 * Returns all unit strings recognised in the count dimension.
 */
export function countUnits(): string[] {
  return Object.keys(COUNT_TO_PCS);
}
