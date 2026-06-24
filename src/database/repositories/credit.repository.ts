/**
 * credit.repository.ts
 *
 * All SQL for the Receivables (Utang) module lives here.
 * No SQL may appear in screens, hooks, or stores — this is the sole
 * data-access boundary for the three credit tables.
 *
 * Tables:
 *   credit_customers  — master data for credit customers
 *   credit_sales      — append-only credit transaction ledger
 *   credit_payments   — append-only payment ledger
 *
 * Design decisions:
 *   - Balance is ALWAYS computed as SUM(credit_sales) - SUM(credit_payments)
 *     for a given customer. It is never stored as a mutable column.
 *   - `getCustomerSummaries` returns all customers with their computed balance
 *     in a single SQL round-trip using LEFT JOINs and GROUP BY. The caller
 *     sorts the result array (balance DESC) in the Zustand store so the UI
 *     can re-sort without a new DB call.
 *   - `createCreditSaleFromPOS` records a credit sale created at POS checkout.
 *     It is intentionally NOT wrapped in a transaction here because the POS
 *     store's `checkout` action already writes the sales_order row inside its
 *     own implicit WAL transaction. Nesting transactions in SQLite via this
 *     repository would produce "cannot start a transaction within a transaction"
 *     errors (same pattern documented in overhead_expenses.repository.ts).
 *   - `recordPayment` inserts into credit_payments and returns the full row.
 *   - All reads return camelCase domain objects; raw row types stay in the schema file.
 *   - TypeScript strict mode enforced throughout:
 *       exactOptionalPropertyTypes:  conditional spread for optional fields
 *       noUncheckedIndexedAccess:    ?? fallbacks on all row field access
 *       noUnusedLocals/Parameters:   unused params prefixed with _
 */

import { getDatabase } from '../database';
import type {
  CreditCustomerRow,
  CreditSaleRow,
  CreditPaymentRow,
  CustomerSummaryRow,
} from '../schemas/credit.schema';
import type {
  CreditCustomer,
  CreditSale,
  CreditSaleItem,
  CreditSaleWithItems,
  CreditPayment,
  CustomerCreditSummary,
  CreateCreditCustomerInput,
  UpdateCreditCustomerInput,
  CreateCreditSaleInput,
  CreateCreditPaymentInput,
} from '@/types';

// ─── ID helper ────────────────────────────────────────────────────────────────

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

// ─── Row → Domain mappers ─────────────────────────────────────────────────────

function customerRowToDomain(row: CreditCustomerRow): CreditCustomer {
  return {
    id:        row.id,
    name:      row.name,
    status:    row.status as CreditCustomer['status'],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    ...(row.phone !== null ? { phone: row.phone } : {}),
    ...(row.notes !== null ? { notes: row.notes } : {}),
  };
}

function saleRowToDomain(row: CreditSaleRow): CreditSale {
  return {
    id:          row.id,
    customerId:  row.customer_id,
    totalAmount: row.total_amount,
    saleDate:    row.sale_date,
    createdAt:   row.created_at,
    ...(row.pos_transaction_id !== null ? { posTransactionId: row.pos_transaction_id } : {}),
    ...(row.notes              !== null ? { notes:            row.notes              } : {}),
  };
}

function paymentRowToDomain(row: CreditPaymentRow): CreditPayment {
  return {
    id:         row.id,
    customerId: row.customer_id,
    amount:     row.amount,
    paidAt:     row.paid_at,
    createdAt:  row.created_at,
    ...(row.notes !== null ? { notes: row.notes } : {}),
  };
}

function summaryRowToDomain(row: CustomerSummaryRow): CustomerCreditSummary {
  const totalCredit  = row.total_credit  ?? 0;
  const totalPaid    = row.total_paid    ?? 0;
  const balance      = Math.max(0, totalCredit - totalPaid);
  const isFullyPaid  = totalCredit > 0 && balance === 0;

  return {
    customer: {
      id:        row.id,
      name:      row.name,
      status:    row.status as CreditCustomer['status'],
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      ...(row.phone !== null ? { phone: row.phone } : {}),
      ...(row.notes !== null ? { notes: row.notes } : {}),
    },
    totalCredit,
    totalPaid,
    balance,
    isFullyPaid,
  };
}

// ─── Customer CRUD ─────────────────────────────────────────────────────────────

/**
 * Inserts a new credit customer and reads it back.
 *
 * @throws If the insert fails (e.g. constraint violation).
 */
export async function createCreditCustomer(
  input: CreateCreditCustomerInput,
): Promise<CreditCustomer> {
  const db  = await getDatabase();
  const id  = generateId();
  const now = new Date().toISOString();

  await db.runAsync(
    `INSERT INTO credit_customers
       (id, name, phone, notes, status, created_at, updated_at, is_synced)
     VALUES (?, ?, ?, ?, 'active', ?, ?, 0)`,
    [
      id,
      input.name,
      input.phone ?? null,
      input.notes ?? null,
      now,
      now,
    ],
  );

  const row = await db.getFirstAsync<CreditCustomerRow>(
    'SELECT * FROM credit_customers WHERE id = ?',
    [id],
  );

  if (row == null) {
    throw new Error(`credit_customers: readback after insert failed for id=${id}`);
  }

  return customerRowToDomain(row);
}

/**
 * Updates mutable fields on an existing credit customer.
 * Only name, phone, notes, and status may be changed.
 *
 * @throws If the customer does not exist.
 */
export async function updateCreditCustomer(
  id:    string,
  input: UpdateCreditCustomerInput,
): Promise<CreditCustomer> {
  const db  = await getDatabase();
  const now = new Date().toISOString();

  await db.runAsync(
    `UPDATE credit_customers
     SET name       = ?,
         phone      = ?,
         notes      = ?,
         status     = ?,
         updated_at = ?,
         is_synced  = 0
     WHERE id = ?`,
    [
      input.name,
      input.phone ?? null,
      input.notes ?? null,
      input.status ?? 'active',
      now,
      id,
    ],
  );

  const row = await db.getFirstAsync<CreditCustomerRow>(
    'SELECT * FROM credit_customers WHERE id = ?',
    [id],
  );

  if (row == null) {
    throw new Error(`credit_customers: customer not found after update for id=${id}`);
  }

  return customerRowToDomain(row);
}

/**
 * Soft-deletes a credit customer by setting status = 'inactive'.
 * Does not delete ledger rows — the financial history is preserved.
 */
export async function deactivateCreditCustomer(id: string): Promise<void> {
  const db  = await getDatabase();
  const now = new Date().toISOString();

  await db.runAsync(
    `UPDATE credit_customers
     SET status = 'inactive', updated_at = ?, is_synced = 0
     WHERE id = ?`,
    [now, id],
  );
}

/**
 * Returns all active credit customers ordered by name.
 */
export async function getActiveCreditCustomers(): Promise<CreditCustomer[]> {
  const db = await getDatabase();

  const rows = await db.getAllAsync<CreditCustomerRow>(
    `SELECT * FROM credit_customers
     WHERE status = 'active'
     ORDER BY name COLLATE NOCASE ASC`,
  );

  return rows.map(customerRowToDomain);
}

/**
 * Returns a single credit customer by ID, or null if not found.
 */
export async function getCreditCustomerById(id: string): Promise<CreditCustomer | null> {
  const db  = await getDatabase();
  const row = await db.getFirstAsync<CreditCustomerRow>(
    'SELECT * FROM credit_customers WHERE id = ?',
    [id],
  );

  return row != null ? customerRowToDomain(row) : null;
}

// ─── Customer summaries (balance computation) ─────────────────────────────────

/**
 * Returns all customers (active and inactive) with their computed balances.
 *
 * Balance = SUM(credit_sales.total_amount) - SUM(credit_payments.amount)
 * Computed in a single SQL round-trip using LEFT JOINs and COALESCE.
 *
 * Only active customers are returned by default. Pass `includeInactive: true`
 * to include deactivated customers who still have outstanding balances.
 */
export async function getCustomerSummaries(
  options: { includeInactive?: boolean } = {},
): Promise<CustomerCreditSummary[]> {
  const db = await getDatabase();

  const whereClause = options.includeInactive === true
    ? ''
    : "WHERE c.status = 'active'";

  const rows = await db.getAllAsync<CustomerSummaryRow>(
    `SELECT
       c.id,
       c.name,
       c.phone,
       c.notes,
       c.status,
       c.created_at,
       c.updated_at,
       COALESCE(SUM(DISTINCT cs.total_amount), 0) AS total_credit,
       COALESCE(SUM(DISTINCT cp.amount),       0) AS total_paid
     FROM credit_customers c
     LEFT JOIN credit_sales    cs ON cs.customer_id = c.id
     LEFT JOIN credit_payments cp ON cp.customer_id = c.id
     ${whereClause}
     GROUP BY c.id
     ORDER BY c.name COLLATE NOCASE ASC`,
  );

  return rows.map(summaryRowToDomain);
}

/**
 * Returns the aggregated balance summary for a single customer.
 *
 * @throws If the customer does not exist.
 */
export async function getCustomerBalance(customerId: string): Promise<CustomerCreditSummary> {
  const db = await getDatabase();

  const row = await db.getFirstAsync<CustomerSummaryRow>(
    `SELECT
       c.id,
       c.name,
       c.phone,
       c.notes,
       c.status,
       c.created_at,
       c.updated_at,
       COALESCE(SUM(DISTINCT cs.total_amount), 0) AS total_credit,
       COALESCE(SUM(DISTINCT cp.amount),       0) AS total_paid
     FROM credit_customers c
     LEFT JOIN credit_sales    cs ON cs.customer_id = c.id
     LEFT JOIN credit_payments cp ON cp.customer_id = c.id
     WHERE c.id = ?
     GROUP BY c.id`,
    [customerId],
  );

  if (row == null) {
    throw new Error(`credit_customers: customer not found for id=${customerId}`);
  }

  return summaryRowToDomain(row);
}

/**
 * Returns the total outstanding balance across ALL active customers.
 * Used for the dashboard KPI tile.
 */
export async function getTotalOutstandingBalance(): Promise<number> {
  const db = await getDatabase();

  interface TotalRow {
    total_credit: number | null;
    total_paid:   number | null;
  }

  const row = await db.getFirstAsync<TotalRow>(
    `SELECT
       COALESCE(SUM(cs.total_amount), 0) AS total_credit,
       COALESCE(SUM(cp.amount),       0) AS total_paid
     FROM credit_customers c
     LEFT JOIN credit_sales    cs ON cs.customer_id = c.id
     LEFT JOIN credit_payments cp ON cp.customer_id = c.id
     WHERE c.status = 'active'`,
  );

  const credit = row?.total_credit ?? 0;
  const paid   = row?.total_paid   ?? 0;
  return Math.max(0, credit - paid);
}

// ─── Credit Sales ─────────────────────────────────────────────────────────────

/**
 * Records a credit sale linked to a POS transaction.
 * Called by the POS checkout flow when the user selects "Credit (Utang)".
 *
 * NOT wrapped in a transaction — the POS store's checkout action handles
 * the sales_order insert. Nesting transactions here would deadlock the SQLite
 * WAL serialisation queue (same pattern as overhead_expenses.repository.ts).
 *
 * @throws If the insert fails or the customer does not exist.
 */
export async function createCreditSaleFromPOS(
  input: CreateCreditSaleInput,
): Promise<CreditSale> {
  const db  = await getDatabase();
  const id  = generateId();
  const now = new Date().toISOString();

  await db.runAsync(
    `INSERT INTO credit_sales
       (id, customer_id, pos_transaction_id, total_amount, notes, sale_date, created_at, is_synced)
     VALUES (?, ?, ?, ?, ?, ?, ?, 0)`,
    [
      id,
      input.customerId,
      input.posTransactionId ?? null,
      input.totalAmount,
      input.notes            ?? null,
      input.saleDate         ?? now,
      now,
    ],
  );

  const row = await db.getFirstAsync<CreditSaleRow>(
    'SELECT * FROM credit_sales WHERE id = ?',
    [id],
  );

  if (row == null) {
    throw new Error(`credit_sales: readback after insert failed for id=${id}`);
  }

  return saleRowToDomain(row);
}

// ─── getCreditSalesByCustomer JOIN types ──────────────────────────────────────

/**
 * Raw row returned by the LEFT JOIN query in getCreditSalesByCustomer.
 * Each credit sale produces N rows — one per sales_order_items row.
 * When the sale has no posTransactionId (or no items), the soi.* columns are NULL.
 */
interface CreditSaleWithItemsRow {
  cs_id:               string;
  customer_id:         string;
  pos_transaction_id:  string | null;
  total_amount:        number;
  cs_notes:            string | null;
  sale_date:           string;
  cs_created_at:       string;
  product_name:        string | null; // NULL when no line items
  quantity:            number | null;
  unit_price:          number | null;
  item_subtotal:       number | null;
}

/**
 * Groups a flat JOIN result into CreditSaleWithItems[].
 * Preserves the ORDER BY cs.created_at DESC ordering from SQL.
 * Uses a Map keyed on cs_id so each unique sale appears exactly once.
 */
function groupSaleRows(rows: CreditSaleWithItemsRow[]): CreditSaleWithItems[] {
  const map = new Map<string, CreditSaleWithItems>();

  for (const row of rows) {
    let sale = map.get(row.cs_id);

    if (sale === undefined) {
      const base: CreditSale = {
        id:          row.cs_id,
        customerId:  row.customer_id,
        totalAmount: row.total_amount,
        saleDate:    row.sale_date,
        createdAt:   row.cs_created_at,
        ...(row.pos_transaction_id !== null
          ? { posTransactionId: row.pos_transaction_id }
          : {}),
        ...(row.cs_notes !== null
          ? { notes: row.cs_notes }
          : {}),
      };
      sale = { ...base, items: [] };
      map.set(row.cs_id, sale);
    }

    // Add the line item if the LEFT JOIN produced a real row (not a null pad).
    if (
      row.product_name  !== null &&
      row.quantity      !== null &&
      row.unit_price    !== null &&
      row.item_subtotal !== null
    ) {
      const item: CreditSaleItem = {
        productName: row.product_name,
        quantity:    row.quantity,
        unitPrice:   row.unit_price,
        subtotal:    row.item_subtotal,
      };
      sale.items.push(item);
    }
  }

  return Array.from(map.values());
}

/**
 * Returns all credit sales for a customer, newest-first, each enriched with
 * the POS line items from sales_order_items (via LEFT JOIN on pos_transaction_id).
 *
 * Sales recorded without a POS receipt (posTransactionId absent) return an
 * empty items array — they will show only the total amount in the UI.
 */
export async function getCreditSalesByCustomer(
  customerId: string,
): Promise<CreditSaleWithItems[]> {
  const db = await getDatabase();

  const rows = await db.getAllAsync<CreditSaleWithItemsRow>(
    `SELECT
       cs.id              AS cs_id,
       cs.customer_id,
       cs.pos_transaction_id,
       cs.total_amount,
       cs.notes           AS cs_notes,
       cs.sale_date,
       cs.created_at      AS cs_created_at,
       soi.product_name,
       soi.quantity,
       soi.unit_price,
       soi.subtotal       AS item_subtotal
     FROM credit_sales cs
     LEFT JOIN sales_order_items soi
            ON soi.sales_order_id = cs.pos_transaction_id
     WHERE cs.customer_id = ?
     ORDER BY cs.created_at DESC, soi.product_name ASC`,
    [customerId],
  );

  return groupSaleRows(rows);
}

// ─── Credit Payments ──────────────────────────────────────────────────────────

/**
 * Records a full or partial payment against a customer's credit balance.
 * The caller is responsible for ensuring `amount` does not exceed the balance;
 * overpayment is NOT blocked at the DB level (it shows as a negative balance
 * in the aggregation query, which is a valid data state for prepayments).
 *
 * @throws If the insert fails or the customer does not exist.
 */
export async function recordCreditPayment(
  input: CreateCreditPaymentInput,
): Promise<CreditPayment> {
  const db  = await getDatabase();
  const id  = generateId();
  const now = new Date().toISOString();

  await db.runAsync(
    `INSERT INTO credit_payments
       (id, customer_id, amount, notes, paid_at, created_at, is_synced)
     VALUES (?, ?, ?, ?, ?, ?, 0)`,
    [
      id,
      input.customerId,
      input.amount,
      input.notes  ?? null,
      input.paidAt ?? now,
      now,
    ],
  );

  const row = await db.getFirstAsync<CreditPaymentRow>(
    'SELECT * FROM credit_payments WHERE id = ?',
    [id],
  );

  if (row == null) {
    throw new Error(`credit_payments: readback after insert failed for id=${id}`);
  }

  return paymentRowToDomain(row);
}

/**
 * Returns all payments for a customer, newest-first.
 */
export async function getCreditPaymentsByCustomer(customerId: string): Promise<CreditPayment[]> {
  const db = await getDatabase();

  const rows = await db.getAllAsync<CreditPaymentRow>(
    `SELECT * FROM credit_payments
     WHERE customer_id = ?
     ORDER BY paid_at DESC, created_at DESC`,
    [customerId],
  );

  return rows.map(paymentRowToDomain);
}
