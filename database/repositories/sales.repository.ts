/**
 * sales.repository.ts
 *
 * All SQLite access for `sales_orders` and `sales_order_items` lives here.
 * No SQL may appear in screens, hooks, or Zustand stores — they call
 * these functions exclusively.
 *
 * Atomic checkout guarantee:
 *   `createSalesOrder` runs a single `withTransactionAsync` that:
 *     1. Generates the next order number (MAX query + increment).
 *     2. Inserts the `sales_orders` header row.
 *     3. Inserts one `sales_order_items` row per cart line.
 *     4. Deducts `inventory_items.quantity` for each product sold.
 *   If any step throws, the entire transaction rolls back — no partial orders
 *   or phantom stock deductions are possible.
 *
 *   NOTE: `withTransactionAsync` cannot be nested (Expo SQLite limitation).
 *   Do not call any other function that itself calls `withTransactionAsync`
 *   from inside this one.
 *
 * Order number format:
 *   "ORD-NNNN" — zero-padded to 4 digits (ORD-0001 … ORD-9999).
 *   When the sequence exceeds 9999 it continues without truncation
 *   (ORD-10000, ORD-10001, …) so the column never overflows.
 *   The current max is determined by querying MAX(order_number) and parsing
 *   the numeric suffix — no AUTOINCREMENT is involved.
 *
 * Stock deduction policy:
 *   `inventory_items.quantity` is decremented by the sold quantity.
 *   Stock is floored at 0 via MAX(0, quantity - sold) so negative stock
 *   is never written. When `cancelSalesOrder` is called the sold quantities
 *   are restored (added back) with no floor — restoring to the exact
 *   pre-sale value requires knowing what was sold, which is read from
 *   `sales_order_items`.
 *
 * Ingredient auto-consumption:
 *   When `consumeIngredients = true` is passed to `createSalesOrder`, the
 *   repository calls `consumeIngredients()` from product_ingredients for each
 *   product line. This deducts raw ingredients based on the product recipe
 *   (e.g. a smoothie uses 200 g of bananas per unit). This is OPTIONAL —
 *   callers that manage raw-material stock separately may omit it.
 *   Because `withTransactionAsync` cannot be nested, ingredient deductions
 *   run AFTER the outer transaction commits, wrapped in their own
 *   per-product transactions inside `consumeIngredients()`.
 */

import { getDatabase } from '../database';
import type {
  SalesOrderRow,
  SalesOrderItemRow,
} from '../schemas/sales_orders.schema';
import type {
  SalesOrder,
  SalesOrderItem,
  SalesOrderDetail,
  PaymentMethod,
} from '@/types';
import { consumeIngredients } from './product_ingredients.repository';

// ─── UUID helper ──────────────────────────────────────────────────────────────

function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// ─── Order number helper ──────────────────────────────────────────────────────

/**
 * Derives the next order number from the highest existing one.
 * Must be called inside a transaction to prevent races with concurrent inserts.
 *
 * Parsing strategy:
 *   MAX(order_number) returns the lexicographically highest value ("ORD-0999").
 *   We split on '-', parse the numeric part, increment, and reformat.
 *   Rows with a malformed order_number (no '-') are ignored — the fallback
 *   is sequence 1.
 */
async function nextOrderNumber(db: import('expo-sqlite').SQLiteDatabase): Promise<string> {
  const row = await db.getFirstAsync<{ max_num: string | null }>(
    `SELECT MAX(order_number) AS max_num FROM sales_orders`,
    [],
  );

  const maxRaw = row?.max_num ?? null;

  if (maxRaw === null) {
    return 'ORD-0001';
  }

  const parts  = maxRaw.split('-');
  const suffix = parts[1] ?? '0';
  const next   = parseInt(suffix, 10) + 1;
  const padded = next <= 9999 ? String(next).padStart(4, '0') : String(next);
  return `ORD-${padded}`;
}

// ─── Domain mapping ───────────────────────────────────────────────────────────

function orderToDomain(row: SalesOrderRow): SalesOrder {
  return {
    id:             row.id,
    orderNumber:    row.order_number,
    status:         row.status,
    subtotal:       row.subtotal,
    discountAmount: row.discount_amount,
    totalAmount:    row.total_amount,
    paymentMethod:  row.payment_method,
    isSynced:       row.is_synced === 1,
    createdAt:      row.created_at,
    updatedAt:      row.updated_at,
    ...(row.amount_tendered !== null ? { amountTendered: row.amount_tendered } : {}),
    ...(row.change_amount   !== null ? { changeAmount:   row.change_amount   } : {}),
    ...(row.notes           !== null ? { notes:          row.notes           } : {}),
  };
}

function itemToDomain(row: SalesOrderItemRow): SalesOrderItem {
  return {
    id:           row.id,
    salesOrderId: row.sales_order_id,
    productId:    row.product_id,
    productName:  row.product_name,
    quantity:     row.quantity,
    unitPrice:    row.unit_price,
    subtotal:     row.subtotal,
    createdAt:    row.created_at,
  };
}

// ─── Input types ──────────────────────────────────────────────────────────────

export interface CreateSalesOrderItemInput {
  productId:   string;
  productName: string;
  quantity:    number;
  unitPrice:   number;
  subtotal:    number;
}

export interface CreateSalesOrderInput {
  items:           CreateSalesOrderItemInput[];
  paymentMethod:   PaymentMethod;
  /** Pre-discount total (sum of item subtotals). */
  subtotal:        number;
  discountAmount:  number;
  /** Final amount charged: subtotal - discountAmount. */
  totalAmount:     number;
  /** Cash received — only for cash payments. */
  amountTendered?: number;
  /** Change returned — only for cash payments. */
  changeAmount?:   number;
  notes?:          string;
  /**
   * When true, ingredient stock is auto-deducted via the product recipe
   * after the order transaction commits. Defaults to false.
   */
  consumeIngredients?: boolean;
}

// ─── Repository functions ─────────────────────────────────────────────────────

/**
 * Creates a complete sales order — header + all item lines + stock deductions
 * — atomically. Returns the persisted header as a domain `SalesOrder`.
 *
 * Stock deduction is clamped to MAX(0, current - sold) to prevent negative
 * stock values in the database. The actual deducted amount may therefore be
 * less than `quantity` when stock is insufficient.
 *
 * Ingredient auto-consumption (optional):
 *   When `input.consumeIngredients` is true, the repository calls
 *   `consumeIngredients(productId, quantity)` per item line AFTER the order
 *   transaction commits. These run in their own per-product transactions
 *   (implementation detail of the product_ingredients repository).
 *   A failure here does NOT roll back the completed order — callers should
 *   treat ingredient deduction as a best-effort operation or implement
 *   compensating logic if strict consistency is required.
 */
export async function createSalesOrder(
  input: CreateSalesOrderInput,
): Promise<SalesOrder> {
  const db  = await getDatabase();
  const id  = generateUUID();
  const now = new Date().toISOString();

  await db.withTransactionAsync(async () => {
    // Derive the next order number inside the transaction to prevent races
    const orderNumber = await nextOrderNumber(db);

    // Insert the order header
    await db.runAsync(
      `INSERT INTO sales_orders
         (id, order_number, status, subtotal, discount_amount, total_amount,
          payment_method, amount_tendered, change_amount, notes,
          created_at, updated_at, is_synced)
       VALUES (?, ?, 'completed', ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
      [
        id,
        orderNumber,
        input.subtotal,
        input.discountAmount,
        input.totalAmount,
        input.paymentMethod,
        input.amountTendered ?? null,
        input.changeAmount   ?? null,
        input.notes          ?? null,
        now,
        now,
      ],
    );

    // Insert line items and deduct product stock in a single pass
    for (const item of input.items) {
      // Insert the line item
      await db.runAsync(
        `INSERT INTO sales_order_items
           (id, sales_order_id, product_id, product_name,
            quantity, unit_price, subtotal, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          generateUUID(),
          id,
          item.productId,
          item.productName,
          item.quantity,
          item.unitPrice,
          item.subtotal,
          now,
        ],
      );

      // Deduct product stock — floor at 0 to prevent negative quantities
      await db.runAsync(
        `UPDATE inventory_items
         SET quantity   = MAX(0, quantity - ?),
             updated_at = ?,
             is_synced  = 0
         WHERE id = ?
           AND deleted_at IS NULL`,
        [item.quantity, now, item.productId],
      );
    }
  });

  // Optional: auto-consume raw ingredient stock per product recipe.
  // Runs OUTSIDE the order transaction because withTransactionAsync cannot nest.
  if (input.consumeIngredients === true) {
    for (const item of input.items) {
      // Non-fatal — ingredient deduction failure does not void the completed sale
      try {
        await consumeIngredients(item.productId, item.quantity);
      } catch {
        // Swallow: ingredient deduction is best-effort when called from POS.
        // A future background-sync pass can reconcile discrepancies.
      }
    }
  }

  // Re-read the freshly inserted row to confirm the write and return the domain object
  const row = await db.getFirstAsync<SalesOrderRow>(
    `SELECT id, order_number, status, subtotal, discount_amount, total_amount,
            payment_method, amount_tendered, change_amount, notes,
            created_at, updated_at, is_synced
     FROM sales_orders WHERE id = ?`,
    [id],
  );

  if (row === null) {
    throw new Error(`[sales_orders] INSERT succeeded but SELECT returned null for id=${id}`);
  }

  return orderToDomain(row);
}

/**
 * Returns a paginated list of sales orders, newest first.
 * Soft-cancellation is included — filter by `status` in the caller if needed.
 */
export async function getSalesOrders(
  limit:  number,
  offset: number,
): Promise<SalesOrder[]> {
  const db = await getDatabase();

  const rows = await db.getAllAsync<SalesOrderRow>(
    `SELECT id, order_number, status, subtotal, discount_amount, total_amount,
            payment_method, amount_tendered, change_amount, notes,
            created_at, updated_at, is_synced
     FROM sales_orders
     ORDER BY created_at DESC
     LIMIT ? OFFSET ?`,
    [limit, offset],
  );

  return rows.map(orderToDomain);
}

/**
 * Returns a single sales order with all its line items.
 * Returns null when no order with the given id exists.
 */
export async function getSalesOrderById(
  id: string,
): Promise<SalesOrderDetail | null> {
  const db = await getDatabase();

  const orderRow = await db.getFirstAsync<SalesOrderRow>(
    `SELECT id, order_number, status, subtotal, discount_amount, total_amount,
            payment_method, amount_tendered, change_amount, notes,
            created_at, updated_at, is_synced
     FROM sales_orders WHERE id = ?`,
    [id],
  );

  if (orderRow === null) return null;

  const itemRows = await db.getAllAsync<SalesOrderItemRow>(
    `SELECT id, sales_order_id, product_id, product_name,
            quantity, unit_price, subtotal, created_at
     FROM sales_order_items
     WHERE sales_order_id = ?
     ORDER BY created_at ASC`,
    [id],
  );

  return {
    ...orderToDomain(orderRow),
    items: itemRows.map(itemToDomain),
  };
}

/**
 * Returns the total revenue and order count for today (device local date).
 * Only 'completed' orders are included — cancelled orders are excluded.
 */
export async function getTodaySalesTotal(): Promise<{
  total:      number;
  orderCount: number;
}> {
  const db          = await getDatabase();
  const todayPrefix = new Date().toISOString().slice(0, 10);

  const row = await db.getFirstAsync<{
    total:       number | null;
    order_count: number;
  }>(
    `SELECT SUM(total_amount) AS total,
            COUNT(*)          AS order_count
     FROM sales_orders
     WHERE status     = 'completed'
       AND created_at LIKE ?`,
    [`${todayPrefix}%`],
  );

  return {
    total:      row?.total       ?? 0,
    orderCount: row?.order_count ?? 0,
  };
}

/**
 * Cancels a sales order by setting its status to 'cancelled' and restoring
 * the sold quantities back to `inventory_items`.
 *
 * Throws when:
 *   - The order does not exist.
 *   - The order is already cancelled (idempotency guard).
 *
 * Stock restoration is clamped to MAX(0, ...) on the deduct side but
 * restoration simply adds back — there is no upper-bound clamp, which is
 * intentional: if stock was externally modified after the sale, restoring
 * the original sale quantity is still the correct accounting action.
 */
export async function cancelSalesOrder(id: string): Promise<void> {
  const db  = await getDatabase();
  const now = new Date().toISOString();

  // Read current order status and its line items before opening the transaction
  const orderRow = await db.getFirstAsync<{ status: string }>(
    `SELECT status FROM sales_orders WHERE id = ?`,
    [id],
  );

  if (orderRow === null) {
    throw new Error(`[sales_orders] cancelSalesOrder: order not found id=${id}`);
  }
  if (orderRow.status === 'cancelled') {
    throw new Error(`[sales_orders] cancelSalesOrder: order already cancelled id=${id}`);
  }

  const itemRows = await db.getAllAsync<{ product_id: string; quantity: number }>(
    `SELECT product_id, quantity FROM sales_order_items WHERE sales_order_id = ?`,
    [id],
  );

  await db.withTransactionAsync(async () => {
    // Mark order as cancelled
    await db.runAsync(
      `UPDATE sales_orders
       SET status = 'cancelled', updated_at = ?, is_synced = 0
       WHERE id = ?`,
      [now, id],
    );

    // Restore product stock for each line item
    for (const item of itemRows) {
      await db.runAsync(
        `UPDATE inventory_items
         SET quantity   = quantity + ?,
             updated_at = ?,
             is_synced  = 0
         WHERE id = ?
           AND deleted_at IS NULL`,
        [item.quantity, now, item.product_id],
      );
    }
  });
}
