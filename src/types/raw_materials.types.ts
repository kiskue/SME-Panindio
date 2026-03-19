/**
 * raw_materials.types.ts
 *
 * Domain types for the Raw Materials module.
 * Raw materials are consumable operational supplies (containers, packaging,
 * paper plates, sauce packets, rolls, etc.) used when producing or selling
 * products — distinct from food ingredients.
 */

// ─── Enum-like union types ────────────────────────────────────────────────────

export type RawMaterialUnit =
  | 'piece'
  | 'pack'
  | 'roll'
  | 'box'
  | 'kg'
  | 'liter'
  | 'sheet'
  | 'bag'
  | 'bottle'
  | 'set'
  | 'other';

export type RawMaterialCategory =
  | 'packaging'
  | 'cleaning'
  | 'utensils'
  | 'office'
  | 'other';

/** Business event that triggered a stock change. */
export type RawMaterialReason =
  | 'sale'
  | 'production'
  | 'waste'
  | 'adjustment';

// ─── Core domain types ────────────────────────────────────────────────────────

/** A raw material item as used by the store and UI layer. */
export interface RawMaterial {
  id:                 string;
  name:               string;
  description?:       string;
  unit:               RawMaterialUnit;
  quantityInStock:    number;
  minimumStockLevel:  number;
  costPerUnit:        number;
  category?:          RawMaterialCategory;
  isActive:           boolean;
  isSynced:           boolean;
  createdAt:          string; // ISO 8601
  updatedAt:          string; // ISO 8601
}

/** Input for creating a new raw material. */
export interface CreateRawMaterialInput {
  name:               string;
  unit:               RawMaterialUnit;
  quantityInStock:    number;
  minimumStockLevel:  number;
  costPerUnit:        number;
  description?:       string;
  category?:          RawMaterialCategory;
}

/** Partial update — all business fields are patchable. */
export type UpdateRawMaterialInput = Partial<CreateRawMaterialInput>;

// ─── Product–RawMaterial link ─────────────────────────────────────────────────

/**
 * A single raw material requirement for a product.
 * Stored in `product_raw_materials`; defines how much of the material
 * is consumed per 1 unit of the product sold/produced.
 */
export interface ProductRawMaterial {
  id:               string;
  productId:        string;
  rawMaterialId:    string;
  quantityRequired: number;
  unit:             RawMaterialUnit;
  createdAt:        string;
  updatedAt:        string;
  /** Joined raw material detail — present when fetched with a JOIN. */
  rawMaterial?:     RawMaterial;
}

/** Used when setting the raw material requirements of a product. */
export interface ProductRawMaterialInput {
  rawMaterialId:    string;
  quantityRequired: number;
}

// ─── Consumption log ─────────────────────────────────────────────────────────

/** Domain model for a single raw material stock movement event. */
export interface RawMaterialConsumptionLog {
  id:            string;
  rawMaterialId: string;
  quantityUsed:  number;
  reason:        RawMaterialReason;
  referenceId?:  string;
  notes?:        string;
  /** Cost snapshot frozen at the moment of recording. Never recomputed. */
  costPerUnit:   number;
  consumedAt:    string; // ISO 8601
  createdAt:     string; // ISO 8601
}

/** Input for logging a consumption event. */
export interface CreateRawMaterialConsumptionLogInput {
  rawMaterialId: string;
  quantityUsed:  number;
  reason:        RawMaterialReason;
  referenceId?:  string;
  notes?:        string;
  /**
   * Cost snapshot at the moment of recording.
   * Pass the raw material's current `costPerUnit` so the figure is frozen
   * in the log row and never affected by future price changes.
   * Defaults to 0 when omitted (e.g. production path where cost is tracked
   * separately in production_log_ingredients).
   */
  costPerUnit?:  number;
}

// ─── Consumption log — enriched / aggregate types ────────────────────────────

/**
 * A single consumption log row joined with raw_material details.
 * Returned by `getRawMaterialConsumptionLogs()`.
 * `costPerUnit` is inherited from `RawMaterialConsumptionLog` (snapshot field).
 */
export interface RawMaterialConsumptionLogDetail extends RawMaterialConsumptionLog {
  /** Denormalised material name from the JOIN (falls back to raw_material_id). */
  rawMaterialName: string;
  unit:            RawMaterialUnit;
  /** quantity_used × cost_per_unit (both snapshot values from the log row). */
  totalCost:       number;
}

/**
 * Per-material aggregate across all (or recent) consumption events.
 * Returned by `getRawMaterialConsumptionSummary()`.
 */
export interface RawMaterialConsumptionSummary {
  rawMaterialId:   string;
  rawMaterialName: string;
  unit:            RawMaterialUnit;
  totalConsumed:   number;
  totalCost:       number;
  /** Number of consumption events included in the aggregate. */
  eventCount:      number;
}

/**
 * Daily consumption aggregate for trend charts.
 * Returned by `getRawMaterialConsumptionTrend()`.
 * Days with zero consumption are included (gaps are filled by the repository).
 */
export interface RawMaterialConsumptionTrend {
  /** Calendar date in YYYY-MM-DD format. */
  date:          string;
  totalConsumed: number;
  totalCost:     number;
}

// ─── Query options ────────────────────────────────────────────────────────────

/** Options accepted by `getRawMaterialConsumptionLogs()`. */
export interface GetRawMaterialLogsOptions {
  limit:   number;
  offset:  number;
  reason?: RawMaterialReason;
}

// ─── UI helpers ──────────────────────────────────────────────────────────────

/** Transient UI state for a raw material row being built in a product form. */
export interface SelectedRawMaterial {
  rawMaterialId:    string;
  rawMaterialName:  string;
  quantityRequired: number;
  unit:             RawMaterialUnit;
  costPerUnit:      number;
  /** quantityRequired × costPerUnit */
  lineCost:         number;
}
