/**
 * online_sales.repository.ts
 *
 * All SQLite access for `online_sales` and `online_sale_items` lives here.
 * No SQL may appear in screens, hooks, or Zustand stores — they call these
 * functions exclusively.
 *
 * This is the LOCAL ledger for completed online "Suki" orders, kept separate from
 * the POS `sales_orders` ledger (see sales.repository.ts). It is written on the
 * owner's device when an online order is marked Completed.
 *
 * Atomic + idempotent guarantee:
 *   `recordOnlineSale` runs a single `withTransactionAsync` that:
 *     1. Skips entirely if a row for this server `order_id` already exists
 *        (idempotency — re-completion / reconciliation never double-records).
 *     2. Inserts the `online_sales` header row.
 *     3. Inserts one `online_sale_items` row per order line.
 *     4. Deducts `inventory_items.quantity` for each line (floored at 0).
 *   If any step throws, the whole transaction rolls back — no partial sale, no
 *   phantom stock deduction. `online_sales.order_id` is UNIQUE, so even a race
 *   cannot create a duplicate.
 *
 * Stock deduction policy (mirrors the POS ledger):
 *   `inventory_items.quantity = MAX(0, quantity - sold)` — never negative. The
 *   online order-item `productId` equals the local `inventory_items.id`. A product
 *   missing locally (deleted) is skipped for deduction but its sale line is still
 *   recorded, so revenue history stays complete.
 */

import { getDatabase } from '../database';
import type {
  OnlineSaleRow,
  OnlineSaleItemRow,
} from '../schemas/online_sales.schema';
import type { BusinessOrder } from '@/types';

// ─── UUID helper ──────────────────────────────────────────────────────────────

function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// ─── Domain types ─────────────────────────────────────────────────────────────

export interface OnlineSale {
  id:            string;
  orderId:       string;
  orderNumber:   string;
  customerId:    string | null;
  customerName:  string | null;
  subtotal:      number;
  vatAmount:     number;
  totalAmount:   number;
  paymentMethod: string;
  paymentStatus: string;
  source:        string;
  completedAt:   string | null;
  createdAt:     string;
  isSynced:      boolean;
}

export interface OnlineSaleItem {
  id:           string;
  onlineSaleId: string;
  productId:    string;
  productName:  string;
  quantity:     number;
  unitPrice:    number;
  lineTotal:    number;
  createdAt:    string;
}

export interface OnlineSaleDetail extends OnlineSale {
  items: OnlineSaleItem[];
}

// ─── Domain mapping ───────────────────────────────────────────────────────────

function saleToDomain(row: OnlineSaleRow): OnlineSale {
  return {
    id:            row.id,
    orderId:       row.order_id,
    orderNumber:   row.order_number,
    customerId:    row.customer_id,
    customerName:  row.customer_name,
    subtotal:      row.subtotal,
    vatAmount:     row.vat_amount,
    totalAmount:   row.total_amount,
    paymentMethod: row.payment_method,
    paymentStatus: row.payment_status,
    source:        row.source,
    completedAt:   row.completed_at,
    createdAt:     row.created_at,
    isSynced:      row.is_synced === 1,
  };
}

function itemToDomain(row: OnlineSaleItemRow): OnlineSaleItem {
  return {
    id:           row.id,
    onlineSaleId: row.online_sale_id,
    productId:    row.product_id,
    productName:  row.product_name,
    quantity:     row.quantity,
    unitPrice:    row.unit_price,
    lineTotal:    row.line_total,
    createdAt:    row.created_at,
  };
}

// ─── Repository functions ─────────────────────────────────────────────────────

/**
 * Records a completed online order into the local ledger and deducts local stock,
 * atomically and idempotently. Returns `true` if a new sale was written, `false`
 * if one already existed for this order (no-op).
 *
 * Deduction is clamped to MAX(0, current - sold). The order's `items` must be
 * present (the business order detail/list already loads them); an order with no
 * items records a header only.
 */
export async function recordOnlineSale(order: BusinessOrder): Promise<boolean> {
  const db  = await getDatabase();
  const id  = generateUUID();
  const now = new Date().toISOString();
  const items = order.items ?? [];

  let recorded = false;

  await db.withTransactionAsync(async () => {
    // Idempotency guard inside the transaction — never double-record / double-deduct.
    const existing = await db.getFirstAsync<{ id: string }>(
      `SELECT id FROM online_sales WHERE order_id = ?`,
      [order.id],
    );
    if (existing !== null) {
      return; // recorded stays false
    }

    // Insert the sale header (snapshot of the server order at completion).
    await db.runAsync(
      `INSERT INTO online_sales
         (id, order_id, order_number, customer_id, customer_name,
          subtotal, vat_amount, total_amount, payment_method, payment_status,
          source, completed_at, created_at, is_synced)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'suki', ?, ?, 0)`,
      [
        id,
        order.id,
        order.orderNumber,
        order.customerId ?? null,
        order.customerName ?? null,
        order.subtotal,
        order.vatAmount,
        order.totalAmount,
        order.paymentMethod,
        order.paymentStatus,
        order.completedAt ?? now,
        now,
      ],
    );

    // Insert line items and deduct local product stock in a single pass.
    for (const item of items) {
      await db.runAsync(
        `INSERT INTO online_sale_items
           (id, online_sale_id, product_id, product_name,
            quantity, unit_price, line_total, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          generateUUID(),
          id,
          item.productId,
          item.productName,
          item.quantity,
          item.unitPrice,
          item.lineTotal,
          now,
        ],
      );

      // The online order-item productId equals the local inventory_items.id.
      // Floor at 0; a product missing locally simply matches no row (0 changes).
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

    recorded = true;
  });

  return recorded;
}

/** Whether a local online sale has already been recorded for this server order. */
export async function hasOnlineSale(orderId: string): Promise<boolean> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ id: string }>(
    `SELECT id FROM online_sales WHERE order_id = ?`,
    [orderId],
  );
  return row !== null;
}

/**
 * Total online-sales revenue (net of VAT) and order count for today.
 * Mirrors `getTodaySalesTotal` for the POS ledger, including its UTC-date
 * prefix convention (`toISOString().slice(0, 10)` — NOT the device-local day).
 * Attribution uses COALESCE(completed_at, created_at) so a reconcile-backfilled
 * sale counts on the day it was completed, matching the dashboard's period
 * aggregates rather than the day the local row happened to be written.
 */
export async function getTodayOnlineSalesTotal(): Promise<{
  total:      number;
  orderCount: number;
}> {
  const db          = await getDatabase();
  const todayPrefix = new Date().toISOString().slice(0, 10);

  const row = await db.getFirstAsync<{
    total:       number | null;
    order_count: number;
  }>(
    `SELECT SUM(total_amount - vat_amount) AS total,
            COUNT(*)                       AS order_count
     FROM online_sales
     WHERE COALESCE(completed_at, created_at) LIKE ?`,
    [`${todayPrefix}%`],
  );

  return {
    total:      row?.total       ?? 0,
    orderCount: row?.order_count ?? 0,
  };
}

// ─── Period aggregates (dashboard) ────────────────────────────────────────────
//
// The dashboard combines this ledger with the POS `sales_orders` ledger at read
// time. All period filters use COALESCE(completed_at, created_at) — the moment
// the sale economically happened — because `created_at` is when the LOCAL row
// was written, which lags up to the 2-day reconcile window for backfilled
// orders and would attribute the sale to the wrong period.
//
// Revenue basis: `total_amount - vat_amount` (net of VAT). The POS ledger's
// sales_orders.total_amount excludes output VAT (vat_amount is a separate
// column), while this ledger's total_amount INCLUDES the VAT the server added
// on top of the subtotal — summing raw total_amount would inflate every online
// sale by its VAT relative to an identical in-store sale.

export interface OnlineSalesKPI {
  /** SUM(total_amount - vat_amount) for the range — net of VAT, POS basis. */
  total:      number;
  /** COUNT(*) of recorded online sales in the range. */
  orderCount: number;
  /** SUM(online_sale_items.quantity) across sales in the range. */
  unitsSold:  number;
}

/**
 * Online-sales totals for an inclusive ISO range. Bounds semantics match the
 * dashboard's in-store `querySalesKPI` (`>= fromISO AND <= toISO`) so the two
 * ledgers aggregate over exactly the same window. Revenue is net of VAT (see
 * the section comment above).
 */
export async function getOnlineSalesKPIForRange(
  fromISO: string,
  toISO:   string,
): Promise<OnlineSalesKPI> {
  const db = await getDatabase();

  // Header revenue/count and item units are two queries on purpose — joining
  // items onto headers would multiply total_amount per line row.
  const [headerRow, unitsRow] = await Promise.all([
    db.getFirstAsync<{ total: number | null; order_count: number }>(
      `SELECT COALESCE(SUM(total_amount - vat_amount), 0) AS total,
              COUNT(*)                                    AS order_count
       FROM online_sales
       WHERE COALESCE(completed_at, created_at) >= ?
         AND COALESCE(completed_at, created_at) <= ?`,
      [fromISO, toISO],
    ),
    db.getFirstAsync<{ units: number | null }>(
      `SELECT COALESCE(SUM(i.quantity), 0) AS units
       FROM online_sale_items i
       JOIN online_sales s ON s.id = i.online_sale_id
       WHERE COALESCE(s.completed_at, s.created_at) >= ?
         AND COALESCE(s.completed_at, s.created_at) <= ?`,
      [fromISO, toISO],
    ),
  ]);

  return {
    total:      headerRow?.total       ?? 0,
    orderCount: headerRow?.order_count ?? 0,
    unitsSold:  unitsRow?.units        ?? 0,
  };
}

/** Trend bucketing granularity, derived from the dashboard period type. */
export type OnlineTrendGranularity = 'hour3' | 'day' | 'month';

/**
 * Online-sales totals bucketed for the dashboard trend chart, keyed so that
 * each bucket key equals a prefix slice of the matching sub-interval's fromISO:
 *   hour3 → 'YYYY-MM-DDTHH' (HH = 3-hour block start: 00, 03, …, 21)
 *   day   → 'YYYY-MM-DD'
 *   month → 'YYYY-MM'
 * One GROUP BY over the whole period (`>= fromISO AND < toISOExclusive`) —
 * the ledger is small, so a single scan beats per-interval queries.
 * Totals are net of VAT (see the section comment above).
 */
export async function getOnlineSalesTrendBuckets(
  fromISO:        string,
  toISOExclusive: string,
  granularity:    OnlineTrendGranularity,
): Promise<Map<string, number>> {
  const db = await getDatabase();
  const ts = `COALESCE(completed_at, created_at)`;
  const keyExpr =
    granularity === 'month'
      ? `substr(${ts}, 1, 7)`
      : granularity === 'day'
        ? `substr(${ts}, 1, 10)`
        : `substr(${ts}, 1, 11) || printf('%02d', (CAST(substr(${ts}, 12, 2) AS INTEGER) / 3) * 3)`;

  const rows = await db.getAllAsync<{ bucket_key: string; total: number | null }>(
    `SELECT ${keyExpr} AS bucket_key,
            COALESCE(SUM(total_amount - vat_amount), 0) AS total
     FROM online_sales
     WHERE ${ts} >= ? AND ${ts} < ?
     GROUP BY bucket_key`,
    [fromISO, toISOExclusive],
  );

  const buckets = new Map<string, number>();
  for (const row of rows) {
    buckets.set(row.bucket_key, row.total ?? 0);
  }
  return buckets;
}

/** Returns a paginated list of online sales, newest first. */
export async function getOnlineSales(
  limit:  number,
  offset: number,
): Promise<OnlineSale[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<OnlineSaleRow>(
    `SELECT id, order_id, order_number, customer_id, customer_name,
            subtotal, vat_amount, total_amount, payment_method, payment_status,
            source, completed_at, created_at, is_synced
     FROM online_sales
     ORDER BY created_at DESC
     LIMIT ? OFFSET ?`,
    [limit, offset],
  );
  return rows.map(saleToDomain);
}

/** Returns a single online sale with its line items, or null if not found. */
export async function getOnlineSaleByOrderId(
  orderId: string,
): Promise<OnlineSaleDetail | null> {
  const db = await getDatabase();
  const saleRow = await db.getFirstAsync<OnlineSaleRow>(
    `SELECT id, order_id, order_number, customer_id, customer_name,
            subtotal, vat_amount, total_amount, payment_method, payment_status,
            source, completed_at, created_at, is_synced
     FROM online_sales WHERE order_id = ?`,
    [orderId],
  );
  if (saleRow === null) return null;

  const itemRows = await db.getAllAsync<OnlineSaleItemRow>(
    `SELECT id, online_sale_id, product_id, product_name,
            quantity, unit_price, line_total, created_at
     FROM online_sale_items
     WHERE online_sale_id = ?
     ORDER BY created_at ASC`,
    [saleRow.id],
  );

  return {
    ...saleToDomain(saleRow),
    items: itemRows.map(itemToDomain),
  };
}
