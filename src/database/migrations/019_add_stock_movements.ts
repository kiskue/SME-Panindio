/**
 * 019_add_stock_movements.ts
 *
 * Creates the `stock_movements` table and its indexes.
 *
 * This migration introduces the ERP inventory movement pattern for products:
 *   - Products are created with quantity = 0 in inventory_items.
 *   - Every stock change is recorded as an immutable movement row.
 *   - inventory_items.quantity stays in sync as a denormalised running total.
 *
 * The existing inventory_items.quantity column is RETAINED — removing it
 * would break every current query (POS availability check, BOM validation,
 * low-stock alerts, production pre-flight). It continues to serve as the
 * fast O(1) read path; the movements table is the audit/reconciliation path.
 *
 * No existing rows are altered — this is a pure additive migration.
 */

import type { SQLiteDatabase } from 'expo-sqlite';
import { stockMovementsSchema, stockMovementsIndexes } from '../schemas/stock_movements.schema';

export const version = 19;
export const description = 'add stock_movements table';

export async function up(db: SQLiteDatabase): Promise<void> {
  await db.execAsync(stockMovementsSchema);
  for (const index of stockMovementsIndexes) {
    await db.execAsync(index);
  }
}

export async function down(db: SQLiteDatabase): Promise<void> {
  await db.execAsync('DROP TABLE IF EXISTS stock_movements;');
}
