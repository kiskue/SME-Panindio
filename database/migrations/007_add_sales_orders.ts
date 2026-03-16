/**
 * Migration 007 — Create sales_orders and sales_order_items tables
 *
 * Adds the POS sales recording system:
 *   - sales_orders:       one row per completed sale (header)
 *   - sales_order_items:  product line items for that sale
 *
 * Key design choices documented here:
 *
 *   order_number (TEXT UNIQUE):
 *     Stores a human-readable sequence like "ORD-0001". The repository derives
 *     the next number by querying MAX(order_number) and parsing the numeric
 *     suffix — no SQLite AUTOINCREMENT is involved. TEXT is used (not INTEGER)
 *     because the prefix "ORD-" makes the column non-numeric.
 *
 *   status DEFAULT 'completed':
 *     Most POS sales are recorded after payment is confirmed, so 'completed'
 *     is the natural default. 'pending' is reserved for future held-order
 *     or layaway workflows. 'cancelled' replaces a soft-delete — the row
 *     remains visible in audit reports but stock is restored.
 *
 *   product_name / unit_price snapshots on sales_order_items:
 *     Captured at time of sale. Must never be updated retroactively.
 *     This matches the accounting principle of immutable historical records.
 *
 *   No deleted_at on sales_orders:
 *     Orders are cancelled via status change + stock restoration, not deleted.
 *
 * Depends on: migration 001 (inventory_items must exist for the FK on
 *             sales_order_items.product_id).
 */

import type { SQLiteDatabase } from 'expo-sqlite';
import {
  salesOrdersSchema,
  salesOrdersIndexes,
  salesOrderItemsSchema,
  salesOrderItemsIndexes,
} from '../schemas/sales_orders.schema';

export const version     = 7;
export const description = 'Create sales_orders and sales_order_items tables for POS module';

export async function up(db: SQLiteDatabase): Promise<void> {
  await db.execAsync(salesOrdersSchema);
  for (const index of salesOrdersIndexes) {
    await db.execAsync(index);
  }

  await db.execAsync(salesOrderItemsSchema);
  for (const index of salesOrderItemsIndexes) {
    await db.execAsync(index);
  }
}

export async function down(db: SQLiteDatabase): Promise<void> {
  // Drop child table first to respect the FK constraint
  await db.execAsync('DROP TABLE IF EXISTS sales_order_items;');
  await db.execAsync('DROP TABLE IF EXISTS sales_orders;');
}
