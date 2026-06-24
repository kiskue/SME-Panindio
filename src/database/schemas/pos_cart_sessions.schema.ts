/**
 * pos_cart_sessions.schema.ts
 *
 * Two-table schema for persisting draft POS carts across app restarts.
 *
 * Design decisions:
 *   - `sales_orders` / `sales_order_items` record COMPLETED sales. This schema
 *     stores IN-PROGRESS carts — the operator's working basket before checkout.
 *     These are two fundamentally different lifecycle states; a separate table
 *     avoids polluting the sales audit trail with abandoned/draft rows.
 *   - Products live in `inventory_items` (category = 'product'). There is NO
 *     separate `products` table — FK references always target `inventory_items`.
 *   - `pos_cart_items.product_name` and `pos_cart_items.unit_price` are
 *     snapshots captured when the item is added to the cart. If the product is
 *     re-priced mid-session the cart reflects the price the operator saw, and
 *     checkout may optionally re-validate against live price before committing.
 *   - At most ONE active cart should exist at a time (status = 'active').
 *     The repository enforces this by auto-abandoning any prior active session
 *     before opening a new one. Multiple rows may exist in 'abandoned' status
 *     for recovery/audit purposes.
 *   - Dates are TEXT (ISO 8601) — consistent with every other table in this
 *     project. See database-level convention notes in project_database_state.md.
 *   - `is_synced` is intentionally omitted from `pos_cart_sessions` and
 *     `pos_cart_items`. Draft carts are purely local and ephemeral; only
 *     completed `sales_orders` rows are synced to the backend.
 */

// ─── pos_cart_sessions ────────────────────────────────────────────────────────

export const posCartSessionsSchema = `
  CREATE TABLE IF NOT EXISTS pos_cart_sessions (
    id              TEXT    PRIMARY KEY,

    status          TEXT    NOT NULL DEFAULT 'active',
    discount_amount REAL    NOT NULL DEFAULT 0,
    notes           TEXT,

    created_at      TEXT    NOT NULL,
    updated_at      TEXT    NOT NULL
  );
`;

export const posCartSessionsIndexes: string[] = [
  // The app always opens the single active session on boot
  `CREATE INDEX IF NOT EXISTS idx_pos_cart_sessions_status
     ON pos_cart_sessions (status);`,
  // Sort/filter by recency for recovery UI
  `CREATE INDEX IF NOT EXISTS idx_pos_cart_sessions_created_at
     ON pos_cart_sessions (created_at);`,
];

// ─── pos_cart_items ───────────────────────────────────────────────────────────

export const posCartItemsSchema = `
  CREATE TABLE IF NOT EXISTS pos_cart_items (
    id              TEXT    PRIMARY KEY,

    session_id      TEXT    NOT NULL REFERENCES pos_cart_sessions(id),
    product_id      TEXT    NOT NULL REFERENCES inventory_items(id),
    product_name    TEXT    NOT NULL,
    quantity        REAL    NOT NULL DEFAULT 1,
    unit_price      REAL    NOT NULL,
    subtotal        REAL    NOT NULL,

    created_at      TEXT    NOT NULL,
    updated_at      TEXT    NOT NULL
  );
`;

export const posCartItemsIndexes: string[] = [
  // Primary access pattern: get all items for a given session
  `CREATE INDEX IF NOT EXISTS idx_pos_cart_items_session_id
     ON pos_cart_items (session_id);`,
  // Secondary: look up whether a product is already in the active cart
  `CREATE INDEX IF NOT EXISTS idx_pos_cart_items_product_id
     ON pos_cart_items (product_id);`,
];

// ─── Row types ────────────────────────────────────────────────────────────────

/** Raw DB row — snake_case column names matching the table exactly. */
export interface PosCartSessionRow {
  id:              string;
  /** 'active' — the current working cart; 'abandoned' — closed without checkout. */
  status:          'active' | 'abandoned';
  discount_amount: number;
  notes:           string | null;
  created_at:      string; // ISO 8601
  updated_at:      string; // ISO 8601
}

/** Raw DB row — snake_case column names matching the table exactly. */
export interface PosCartItemRow {
  id:           string;
  session_id:   string;
  product_id:   string;
  /** Snapshot of inventory_items.name at time of addition. */
  product_name: string;
  quantity:     number;
  /** Snapshot of inventory_items.price at time of addition. */
  unit_price:   number;
  subtotal:     number;
  created_at:   string; // ISO 8601
  updated_at:   string; // ISO 8601
}
