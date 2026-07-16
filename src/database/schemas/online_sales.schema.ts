/**
 * online_sales.schema.ts
 *
 * Local (on-device) ledger for COMPLETED online "Suki" orders, kept SEPARATE
 * from the POS `sales_orders` ledger so online and in-store revenue can be
 * reported independently. A row is written on the owner's device when the owner
 * marks an online order Completed (see online_sales.repository.recordOnlineSale),
 * which also deducts local `inventory_items.quantity`.
 *
 *   online_sales       — one row per completed online order (header)
 *   online_sale_items  — product line items for that order
 *
 * Design decisions:
 *   - `order_id` (the server OnlineOrder id) is UNIQUE — it is the idempotency
 *     key. Re-completing / reconciling the same order can never create a second
 *     local sale or double-deduct stock.
 *   - `product_name`, `unit_price` are immutable snapshots captured at completion.
 *   - `product_id` mirrors the server order-item productId, which equals the
 *     local `inventory_items.id`. It is intentionally NOT a hard FK: an online
 *     order may reference a product that was deleted locally, and the sale line
 *     must still be recorded (the deduction for that line is simply skipped).
 *   - `source` is fixed 'suki' today; reserved so a future online channel can be
 *     distinguished without a schema change.
 *   - `is_synced` INTEGER 0/1 mirrors the POS ledger's background-sync flag.
 */

// ─── online_sales ─────────────────────────────────────────────────────────────

export const onlineSalesSchema = `
  CREATE TABLE IF NOT EXISTS online_sales (
    id              TEXT    PRIMARY KEY,
    order_id        TEXT    NOT NULL UNIQUE,
    order_number    TEXT    NOT NULL,
    customer_id     TEXT,
    customer_name   TEXT,
    subtotal        REAL    NOT NULL DEFAULT 0,
    vat_amount      REAL    NOT NULL DEFAULT 0,
    total_amount    REAL    NOT NULL DEFAULT 0,
    payment_method  TEXT    NOT NULL,
    payment_status  TEXT    NOT NULL,
    source          TEXT    NOT NULL DEFAULT 'suki',
    completed_at    TEXT,
    created_at      TEXT    NOT NULL,
    is_synced       INTEGER NOT NULL DEFAULT 0
  );
`;

export const onlineSalesIndexes: string[] = [
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_online_sales_order_id
     ON online_sales (order_id);`,
  `CREATE INDEX IF NOT EXISTS idx_online_sales_created_at
     ON online_sales (created_at);`,
  `CREATE INDEX IF NOT EXISTS idx_online_sales_is_synced
     ON online_sales (is_synced);`,
];

// ─── online_sale_items ────────────────────────────────────────────────────────

export const onlineSaleItemsSchema = `
  CREATE TABLE IF NOT EXISTS online_sale_items (
    id             TEXT    PRIMARY KEY,
    online_sale_id TEXT    NOT NULL REFERENCES online_sales(id),
    product_id     TEXT    NOT NULL,
    product_name   TEXT    NOT NULL,
    quantity       REAL    NOT NULL,
    unit_price     REAL    NOT NULL,
    line_total     REAL    NOT NULL,
    created_at     TEXT    NOT NULL
  );
`;

export const onlineSaleItemsIndexes: string[] = [
  `CREATE INDEX IF NOT EXISTS idx_online_sale_items_sale_id
     ON online_sale_items (online_sale_id);`,
  `CREATE INDEX IF NOT EXISTS idx_online_sale_items_product_id
     ON online_sale_items (product_id);`,
];

// ─── Row types ────────────────────────────────────────────────────────────────

export interface OnlineSaleRow {
  id:             string;
  order_id:       string;
  order_number:   string;
  customer_id:    string | null;
  customer_name:  string | null;
  subtotal:       number;
  vat_amount:     number;
  total_amount:   number;
  payment_method: string;
  payment_status: string;
  source:         string;
  completed_at:   string | null;
  created_at:     string;
  is_synced:      0 | 1;
}

export interface OnlineSaleItemRow {
  id:             string;
  online_sale_id: string;
  product_id:     string;
  product_name:   string;
  quantity:       number;
  unit_price:     number;
  line_total:     number;
  created_at:     string;
}
