/**
 * credit.schema.ts
 *
 * Three-table schema for the Receivables (Utang) module.
 *
 * Design principles:
 *   - `credit_customers` is a master-data table. Customers are soft-deletable
 *     via the `status` column so historical sales records remain referentially
 *     intact even after a customer is "removed" from the active list.
 *   - `credit_sales` is an append-only ledger of credit transactions. A row
 *     is created when a POS sale is charged to a customer. It is NEVER updated.
 *     Void/correction is handled by a new row with a negative amount and a
 *     `void_of_id` reference (future extension).
 *   - `credit_payments` is an append-only payment ledger. Partial payments
 *     are recorded as individual rows. Balance = SUM(credit_sales.total_amount)
 *     - SUM(credit_payments.amount) for a given customer_id.
 *   - The running balance is ALWAYS computed from the ledgers — never stored as
 *     a mutable column. This is the same pattern the project uses for inventory
 *     movements and production costs.
 *   - `pos_transaction_id` on `credit_sales` links back to `sales_orders.id`
 *     so the owner can navigate from a credit record to the original receipt.
 *     It is nullable because a credit sale can also be entered manually without
 *     a POS transaction (e.g. a verbal credit extension recorded after the fact).
 *   - Dates are TEXT (ISO 8601) — consistent with every other table in this project.
 *   - `is_synced` INTEGER 0/1 on each table tracks background Supabase sync status.
 */

// ─── credit_customers ─────────────────────────────────────────────────────────

export const creditCustomersSchema = `
  CREATE TABLE IF NOT EXISTS credit_customers (
    id         TEXT    PRIMARY KEY,
    name       TEXT    NOT NULL,
    phone      TEXT,
    notes      TEXT,
    status     TEXT    NOT NULL DEFAULT 'active',
    created_at TEXT    NOT NULL,
    updated_at TEXT    NOT NULL,
    is_synced  INTEGER NOT NULL DEFAULT 0
  );
`;

export const creditCustomersIndexes: string[] = [
  `CREATE INDEX IF NOT EXISTS idx_credit_customers_status
     ON credit_customers (status);`,
  `CREATE INDEX IF NOT EXISTS idx_credit_customers_name
     ON credit_customers (name COLLATE NOCASE);`,
  `CREATE INDEX IF NOT EXISTS idx_credit_customers_is_synced
     ON credit_customers (is_synced);`,
];

// ─── credit_sales ─────────────────────────────────────────────────────────────

export const creditSalesSchema = `
  CREATE TABLE IF NOT EXISTS credit_sales (
    id                   TEXT    PRIMARY KEY,
    customer_id          TEXT    NOT NULL REFERENCES credit_customers (id),
    pos_transaction_id   TEXT,
    total_amount         REAL    NOT NULL,
    notes                TEXT,
    sale_date            TEXT    NOT NULL,
    created_at           TEXT    NOT NULL,
    is_synced            INTEGER NOT NULL DEFAULT 0
  );
`;

export const creditSalesIndexes: string[] = [
  `CREATE INDEX IF NOT EXISTS idx_credit_sales_customer_id
     ON credit_sales (customer_id);`,
  `CREATE INDEX IF NOT EXISTS idx_credit_sales_sale_date
     ON credit_sales (sale_date);`,
  `CREATE INDEX IF NOT EXISTS idx_credit_sales_pos_transaction_id
     ON credit_sales (pos_transaction_id);`,
  `CREATE INDEX IF NOT EXISTS idx_credit_sales_is_synced
     ON credit_sales (is_synced);`,
];

// ─── credit_payments ──────────────────────────────────────────────────────────

export const creditPaymentsSchema = `
  CREATE TABLE IF NOT EXISTS credit_payments (
    id          TEXT    PRIMARY KEY,
    customer_id TEXT    NOT NULL REFERENCES credit_customers (id),
    amount      REAL    NOT NULL,
    notes       TEXT,
    paid_at     TEXT    NOT NULL,
    created_at  TEXT    NOT NULL,
    is_synced   INTEGER NOT NULL DEFAULT 0
  );
`;

export const creditPaymentsIndexes: string[] = [
  `CREATE INDEX IF NOT EXISTS idx_credit_payments_customer_id
     ON credit_payments (customer_id);`,
  `CREATE INDEX IF NOT EXISTS idx_credit_payments_paid_at
     ON credit_payments (paid_at);`,
  `CREATE INDEX IF NOT EXISTS idx_credit_payments_is_synced
     ON credit_payments (is_synced);`,
];

// ─── Row types (raw SQLite rows — snake_case) ─────────────────────────────────

/** Raw DB row for `credit_customers`. */
export interface CreditCustomerRow {
  id:         string;
  name:       string;
  phone:      string | null;
  notes:      string | null;
  /** 'active' | 'inactive' */
  status:     string;
  created_at: string;
  updated_at: string;
  is_synced:  0 | 1;
}

/** Raw DB row for `credit_sales`. */
export interface CreditSaleRow {
  id:                  string;
  customer_id:         string;
  pos_transaction_id:  string | null;
  total_amount:        number;
  notes:               string | null;
  sale_date:           string;
  created_at:          string;
  is_synced:           0 | 1;
}

/** Raw DB row for `credit_payments`. */
export interface CreditPaymentRow {
  id:          string;
  customer_id: string;
  amount:      number;
  notes:       string | null;
  paid_at:     string;
  created_at:  string;
  is_synced:   0 | 1;
}

/**
 * Raw DB row for the customer summary query.
 * Returned by the aggregation query joining all three tables.
 */
export interface CustomerSummaryRow {
  id:            string;
  name:          string;
  phone:         string | null;
  notes:         string | null;
  status:        string;
  created_at:    string;
  updated_at:    string;
  total_credit:  number | null;
  total_paid:    number | null;
}
