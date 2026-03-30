/**
 * stock_movements.schema.ts
 *
 * Append-only ledger of every product stock change.
 *
 * This table implements the ERP "inventory movement" pattern:
 *   - Products are created with quantity = 0 in inventory_items.
 *   - Every stock change (initial stock-in, restock, manual adjustment,
 *     production output, sale, correction, wastage) is recorded here as
 *     an immutable movement row.
 *   - inventory_items.quantity remains the authoritative running total and
 *     is always updated atomically alongside the movement insert. This keeps
 *     read performance on the product list fast (no SUM on every render)
 *     while giving a complete audit trail for reconciliation.
 *
 * Movement types:
 *   initial    — First stock recorded when a product is stocked for the
 *                first time after creation.
 *   restock    — Routine replenishment (buy more finished goods or produce
 *                a new batch externally).
 *   adjustment — Manual correction by an operator (positive or negative
 *                quantity_delta).
 *   wastage    — Spoilage, damage, or expiry; always negative.
 *   sale       — Units sold through POS; always negative.
 *   production — Units added via the BOM-driven Add Stock flow; always
 *                positive. Superseded by product_stock_additions for the
 *                full audit blob; this row is the lightweight movement entry.
 *   return     — Units returned to stock (e.g. customer return); positive.
 *
 * Foreign key:
 *   product_id → inventory_items(id)
 *   No ON DELETE CASCADE — movement rows must survive a product soft-delete
 *   so historical stock reports remain accurate.
 *
 * Timestamps: TEXT ISO 8601 (project convention — NOT INTEGER UNIX ms).
 */

// ─── DDL ──────────────────────────────────────────────────────────────────────

export const stockMovementsSchema = `
  CREATE TABLE IF NOT EXISTS stock_movements (
    id               TEXT    PRIMARY KEY,

    -- Which product this movement belongs to
    product_id       TEXT    NOT NULL REFERENCES inventory_items(id),

    -- Snapshot of the product name at the time of the movement.
    -- Denormalised so reports survive product rename / soft-delete.
    product_name     TEXT    NOT NULL,

    -- Direction and magnitude.
    -- Positive = stock added, negative = stock removed.
    -- Constrained: must not be zero (a zero-delta movement has no meaning).
    quantity_delta   REAL    NOT NULL CHECK(quantity_delta != 0),

    -- Running total AFTER this movement was applied.
    -- Stored as a snapshot to allow point-in-time stock reconstruction
    -- without re-summing the entire ledger.
    quantity_after   REAL    NOT NULL,

    -- Business classification of the movement event.
    movement_type    TEXT    NOT NULL,

    -- Optional cost snapshot per unit at the time of the movement.
    -- NULL when not applicable (e.g. manual adjustments without a cost basis).
    cost_price       REAL,

    -- Polymorphic link to the source document that triggered this movement.
    -- e.g. reference_type='sales_order'  + reference_id=<sales_orders.id>
    --      reference_type='production'   + reference_id=<product_stock_additions.id>
    reference_id     TEXT,
    reference_type   TEXT,

    -- Freeform notes — visible in the movement history screen.
    notes            TEXT,

    -- Who performed the action (display name or user id).
    performed_by     TEXT,

    -- Business timestamp: when the physical movement occurred.
    -- May differ from created_at (e.g. backdated adjustments).
    moved_at         TEXT    NOT NULL,

    -- Standard audit / sync fields
    created_at       TEXT    NOT NULL,
    is_synced        INTEGER NOT NULL DEFAULT 0
  );
`;

// ─── Indexes ──────────────────────────────────────────────────────────────────

export const stockMovementsIndexes: string[] = [
  // Primary query axis: all movements for a product, newest first
  `CREATE INDEX IF NOT EXISTS idx_stock_movements_product_id
     ON stock_movements (product_id);`,

  // Movement type filter (e.g. show only sales or only wastage)
  `CREATE INDEX IF NOT EXISTS idx_stock_movements_movement_type
     ON stock_movements (movement_type);`,

  // Date-range queries on the movement history screen
  `CREATE INDEX IF NOT EXISTS idx_stock_movements_moved_at
     ON stock_movements (moved_at);`,

  // Background sync queue
  `CREATE INDEX IF NOT EXISTS idx_stock_movements_is_synced
     ON stock_movements (is_synced);`,

  // Composite: product + date — covers "movement history for product in period"
  `CREATE INDEX IF NOT EXISTS idx_stock_movements_product_moved_at
     ON stock_movements (product_id, moved_at);`,
];

// ─── Movement type ────────────────────────────────────────────────────────────

/**
 * All recognised movement types.
 *
 * 'initial'    — First ever stock-in for a product (quantity was 0 before).
 * 'restock'    — Routine replenishment without BOM deduction.
 * 'adjustment' — Manual correction; quantity_delta may be positive or negative.
 * 'wastage'    — Spoilage / damage / expiry; quantity_delta is always negative.
 * 'sale'       — Sold through POS; quantity_delta is always negative.
 * 'production' — Added via the BOM-driven production flow; always positive.
 * 'return'     — Customer or supplier return; always positive.
 */
export type StockMovementType =
  | 'initial'
  | 'restock'
  | 'adjustment'
  | 'wastage'
  | 'sale'
  | 'production'
  | 'return';

// ─── TypeScript interfaces ─────────────────────────────────────────────────────

/**
 * Raw DB row shape — snake_case, matches column names exactly.
 * Only used inside the repository; the domain type `StockMovement` is
 * what the rest of the app consumes.
 */
export interface StockMovementRow {
  id:             string;
  product_id:     string;
  product_name:   string;
  quantity_delta: number;
  quantity_after: number;
  movement_type:  StockMovementType;
  cost_price:     number | null;
  reference_id:   string | null;
  reference_type: string | null;
  notes:          string | null;
  performed_by:   string | null;
  moved_at:       string;        // ISO 8601
  created_at:     string;        // ISO 8601
  is_synced:      0 | 1;
}

/**
 * Camel-case domain type consumed by the UI and Zustand store.
 */
export interface StockMovement {
  id:            string;
  productId:     string;
  productName:   string;
  /** Positive = stock added, negative = stock removed. */
  quantityDelta: number;
  /** Running total after this movement. */
  quantityAfter: number;
  movementType:  StockMovementType;
  costPrice?:    number;
  referenceId?:  string;
  referenceType?: string;
  notes?:        string;
  performedBy?:  string;
  movedAt:       string;  // ISO 8601
  createdAt:     string;  // ISO 8601
  isSynced:      boolean;
}

// ─── Input types ──────────────────────────────────────────────────────────────

/**
 * What the caller must provide to record a new movement.
 * `id`, `created_at`, `is_synced`, and `quantity_after` are managed
 * by the repository.
 */
export interface CreateStockMovementInput {
  productId:      string;
  productName:    string;
  /** Positive to add stock, negative to remove. Must not be 0. */
  quantityDelta:  number;
  movementType:   StockMovementType;
  costPrice?:     number;
  referenceId?:   string;
  referenceType?: string;
  notes?:         string;
  performedBy?:   string;
  /** Defaults to now() when omitted. */
  movedAt?:       string;
}

/**
 * Options for the `getStockMovements` query.
 */
export interface GetStockMovementsOptions {
  productId?:    string;
  movementType?: StockMovementType;
  /** ISO 8601 — inclusive lower bound on moved_at. */
  fromDate?:     string;
  /** ISO 8601 — inclusive upper bound on moved_at. */
  toDate?:       string;
  limit?:        number;
  offset?:       number;
}
