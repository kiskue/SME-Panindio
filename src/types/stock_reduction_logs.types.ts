/**
 * stock_reduction_logs.types.ts
 *
 * Domain types for the Stock Reduction Logs module.
 * A stock reduction event is recorded whenever a user decreases a product's
 * or ingredient's quantity to correct a previous over-entry, log damage,
 * expiry, or other inventory loss.
 *
 * DB layer counterpart: database/schemas/stock_reduction_logs.schema.ts
 * Repository:           database/repositories/stock_reduction_logs.repository.ts
 */

// ─── Enum-like union types ────────────────────────────────────────────────────

/**
 * The business reason for removing units from inventory.
 *   correction — a prior stock-add entry was mistaken; this reverses it
 *   waste      — units discarded due to spoilage, over-production, or process
 *                loss; written as a wastage audit entry (not returned to stock)
 *   damage     — units physically damaged and no longer saleable/usable
 *   expiry     — units passed their expiry date and were discarded
 *   other      — catch-all; a free-text `notes` field should accompany this
 *
 * Return-to-inventory logic:
 *   Only 'correction' reverses the prior stock deduction (re-adds units to
 *   inventory_items). All other reasons — including 'waste' — write a wastage
 *   audit entry and leave the reduced quantity as a permanent loss.
 */
export type StockReductionReason =
  | 'correction'
  | 'waste'
  | 'damage'
  | 'expiry'
  | 'other';

/**
 * Discriminates which inventory_items category the reduced item belongs to.
 *   product    — a finished good sold through POS
 *   ingredient — a raw ingredient used in recipes
 */
export type StockReductionItemType = 'product' | 'ingredient';

// ─── Core domain type ─────────────────────────────────────────────────────────

/**
 * A single stock reduction event as used by the store and UI layers.
 * Field names are camelCase; the repository maps from the snake_case DB row.
 */
export interface StockReductionLog {
  id:           string;
  /**
   * Discriminates between product and ingredient rows.
   * Use this to filter the audit log without joining inventory_items.
   */
  itemType:     StockReductionItemType;
  /** Generic denormalised name snapshot — populated for all rows. */
  itemName:     string;
  /**
   * FK to inventory_items.id — present only for product rows.
   * Absent for ingredient rows (use ingredient_consumption_logs for the
   * full ingredient audit trail if the FK is required).
   */
  productId?:   string;
  /** Legacy denormalised product name — present only for product rows. */
  productName?: string;
  /** Number of units removed from inventory. Always positive. */
  unitsReduced: number;
  reason:       StockReductionReason;
  /** Optional free-text explanation — required when reason = 'other'. */
  notes?:       string;
  /** User ID or display name of the person who performed the reduction. */
  performedBy?: string;
  /** ISO 8601 timestamp of the business event (when the reduction occurred). */
  reducedAt:    string;
  /** ISO 8601 timestamp of the DB write (always set by the repository). */
  createdAt:    string;
  /** Whether this row has been pushed to the remote API. */
  isSynced:     boolean;
}

// ─── Input types ─────────────────────────────────────────────────────────────

/**
 * Fields the caller must supply when recording a new product stock reduction.
 * `id`, `createdAt`, and `isSynced` are managed by the repository and must
 * NOT be supplied by the caller.
 */
export interface CreateProductStockReductionInput {
  /** Must be 'product'. */
  itemType:     'product';
  itemName:     string;
  /** FK to inventory_items.id — required for product rows. */
  productId:    string;
  /** Denormalised product name snapshot. */
  productName:  string;
  unitsReduced: number;
  reason:       StockReductionReason;
  notes?:       string;
  performedBy?: string;
  /**
   * ISO 8601 timestamp of when the reduction occurred.
   * Defaults to the current time when omitted.
   */
  reducedAt?:   string;
}

/**
 * Fields the caller must supply when recording a new ingredient stock reduction.
 * `id`, `createdAt`, and `isSynced` are managed by the repository and must
 * NOT be supplied by the caller.
 */
export interface CreateIngredientStockReductionInput {
  /** Must be 'ingredient'. */
  itemType:     'ingredient';
  itemName:     string;
  unitsReduced: number;
  reason:       StockReductionReason;
  notes?:       string;
  performedBy?: string;
  /**
   * ISO 8601 timestamp of when the reduction occurred.
   * Defaults to the current time when omitted.
   */
  reducedAt?:   string;
}

/**
 * Union input type accepted by `createStockReductionLog()`.
 * The `itemType` discriminant determines which fields are required.
 */
export type CreateStockReductionLogInput =
  | CreateProductStockReductionInput
  | CreateIngredientStockReductionInput;

// ─── Query option types ───────────────────────────────────────────────────────

/** Options accepted by `getStockReductionLogs()`. */
export interface GetStockReductionLogsOptions {
  /** Filter to a specific item type ('product' or 'ingredient'). */
  itemType?:  StockReductionItemType;
  /** Filter to a specific product (only meaningful when itemType = 'product'). */
  productId?: string;
  /** ISO 8601 date prefix lower bound, e.g. '2026-03-01'. */
  fromDate?:  string;
  /** ISO 8601 date prefix upper bound, e.g. '2026-03-31'. */
  toDate?:    string;
  reason?:    StockReductionReason;
  limit?:     number;
  offset?:    number;
}
