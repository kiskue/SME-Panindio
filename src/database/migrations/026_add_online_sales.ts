/**
 * Migration 026 — Create online_sales and online_sale_items tables
 *
 * Adds the LOCAL ledger for completed online "Suki" orders, separate from the POS
 * `sales_orders` ledger (migration 007). A row is written on the owner's device
 * when an online order is marked Completed; the same transaction deducts
 * `inventory_items.quantity`.
 *
 *   online_sales:       one row per completed online order (header)
 *   online_sale_items:  product line items for that order
 *
 * Key design choices:
 *   order_id (TEXT UNIQUE): the server OnlineOrder id, used as the idempotency
 *     key so re-completing / reconciling never double-records or double-deducts.
 *   product_id is NOT a hard FK to inventory_items: an online order may include a
 *     product deleted locally; the line is still recorded (its deduction skipped).
 *
 * Depends on: nothing (self-contained; product_id is a soft reference).
 */

import type { SQLiteDatabase } from 'expo-sqlite';
import {
  onlineSalesSchema,
  onlineSalesIndexes,
  onlineSaleItemsSchema,
  onlineSaleItemsIndexes,
} from '../schemas/online_sales.schema';

export const version     = 26;
export const description = 'Create online_sales and online_sale_items tables for the Suki online ledger';

export async function up(db: SQLiteDatabase): Promise<void> {
  await db.execAsync(onlineSalesSchema);
  for (const index of onlineSalesIndexes) {
    await db.execAsync(index);
  }

  await db.execAsync(onlineSaleItemsSchema);
  for (const index of onlineSaleItemsIndexes) {
    await db.execAsync(index);
  }
}

export async function down(db: SQLiteDatabase): Promise<void> {
  // Drop child table first to respect the FK constraint.
  await db.execAsync('DROP TABLE IF EXISTS online_sale_items;');
  await db.execAsync('DROP TABLE IF EXISTS online_sales;');
}
