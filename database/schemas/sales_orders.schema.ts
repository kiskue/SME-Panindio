/**
 * sales_orders.schema.ts
 *
 * Two-table schema for POS sales:
 *
 *   sales_orders       — one row per completed sale (header)
 *   sales_order_items  — product line items for that sale
 *
 * Design decisions:
 *   - `order_number` is a TEXT column storing a zero-padded sequence
 *     ("ORD-0001"). The next value is derived at insert time by querying
 *     MAX(order_number) — no SQLite sequence/autoincrement is used because
 *     the prefix format makes numeric sorting unreliable without the leading
 *     zeros anyway.  The repository formats the number with padStart(4, '0').
 *   - `product_name`, `unit_price` on `sales_order_items` are immutable
 *     snapshots captured at time of sale. They must NOT be updated even if
 *     the product name or price changes later.
 *   - `amount_tendered` and `change_amount` are only meaningful for cash
 *     payments. They are stored as nullable REAL columns.
 *   - `is_synced` INTEGER 0/1 drives the background Supabase sync queue.
 *   - `deleted_at` is intentionally omitted from `sales_orders` — orders
 *     are cancelled (status='cancelled') rather than soft-deleted, which
 *     preserves revenue/audit history.
 */

// ─── sales_orders ─────────────────────────────────────────────────────────────

export const salesOrdersSchema = `
  CREATE TABLE IF NOT EXISTS sales_orders (
    id               TEXT    PRIMARY KEY,
    order_number     TEXT    NOT NULL UNIQUE,
    status           TEXT    NOT NULL DEFAULT 'completed',
    subtotal         REAL    NOT NULL DEFAULT 0,
    discount_amount  REAL    NOT NULL DEFAULT 0,
    total_amount     REAL    NOT NULL DEFAULT 0,
    payment_method   TEXT    NOT NULL,
    amount_tendered  REAL,
    change_amount    REAL,
    notes            TEXT,
    created_at       TEXT    NOT NULL,
    updated_at       TEXT    NOT NULL,
    is_synced        INTEGER NOT NULL DEFAULT 0
  );
`;

export const salesOrdersIndexes: string[] = [
  `CREATE INDEX IF NOT EXISTS idx_sales_orders_status
     ON sales_orders (status);`,
  `CREATE INDEX IF NOT EXISTS idx_sales_orders_created_at
     ON sales_orders (created_at);`,
  `CREATE INDEX IF NOT EXISTS idx_sales_orders_order_number
     ON sales_orders (order_number);`,
  `CREATE INDEX IF NOT EXISTS idx_sales_orders_is_synced
     ON sales_orders (is_synced);`,
  // Composite index for dashboard period+status queries (querySalesKPI, queryTrendPoint)
  `CREATE INDEX IF NOT EXISTS idx_sales_orders_status_created_at
     ON sales_orders (status, created_at);`,
];

// ─── sales_order_items ────────────────────────────────────────────────────────

export const salesOrderItemsSchema = `
  CREATE TABLE IF NOT EXISTS sales_order_items (
    id             TEXT    PRIMARY KEY,
    sales_order_id TEXT    NOT NULL REFERENCES sales_orders(id),
    product_id     TEXT    NOT NULL REFERENCES inventory_items(id),
    product_name   TEXT    NOT NULL,
    quantity       REAL    NOT NULL,
    unit_price     REAL    NOT NULL,
    subtotal       REAL    NOT NULL,
    created_at     TEXT    NOT NULL
  );
`;

export const salesOrderItemsIndexes: string[] = [
  `CREATE INDEX IF NOT EXISTS idx_sales_order_items_order_id
     ON sales_order_items (sales_order_id);`,
  `CREATE INDEX IF NOT EXISTS idx_sales_order_items_product_id
     ON sales_order_items (product_id);`,
];

// ─── Row types ────────────────────────────────────────────────────────────────

export interface SalesOrderRow {
  id:              string;
  order_number:    string;
  status:          'pending' | 'completed' | 'cancelled';
  subtotal:        number;
  discount_amount: number;
  total_amount:    number;
  payment_method:  'cash' | 'gcash' | 'maya' | 'card';
  amount_tendered: number | null;
  change_amount:   number | null;
  notes:           string | null;
  created_at:      string;
  updated_at:      string;
  is_synced:       0 | 1;
}

export interface SalesOrderItemRow {
  id:             string;
  sales_order_id: string;
  product_id:     string;
  product_name:   string;
  quantity:       number;
  unit_price:     number;
  subtotal:       number;
  created_at:     string;
}
