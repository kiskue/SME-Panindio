/**
 * Migration 012 — Create stock_reduction_logs table
 *
 * Adds an immutable audit ledger that records every product stock reduction
 * event. A reduction is triggered when a user needs to correct an over-entry
 * of product stock, or to log damage, expiry, or other inventory losses.
 *
 * When a reduction is recorded:
 *   1. A row is inserted into this table (handled by this migration).
 *   2. The product's `quantity` in `inventory_items` is decremented.
 *   3. Linked ingredients in `ingredient_consumption_logs` may receive a
 *      RETURN entry (proportional to units_reduced × recipe quantity).
 *   4. Linked raw materials in `raw_material_consumption_logs` may receive a
 *      signed adjustment entry for the same reason.
 * Steps 2–4 are orchestrated by the calling service layer, not by this table.
 *
 * Depends on: migration 001 (inventory_items table must exist for the
 *             REFERENCES constraint to resolve at CREATE TABLE time).
 */

import type { SQLiteDatabase } from 'expo-sqlite';
import {
  stockReductionLogsSchema,
  stockReductionLogsIndexes,
} from '../schemas/stock_reduction_logs.schema';

export const version     = 12;
export const description = 'Create stock_reduction_logs table for product stock reduction audit trail';

export async function up(db: SQLiteDatabase): Promise<void> {
  await db.execAsync(stockReductionLogsSchema);

  for (const index of stockReductionLogsIndexes) {
    await db.execAsync(index);
  }
}

export async function down(db: SQLiteDatabase): Promise<void> {
  await db.execAsync('DROP TABLE IF EXISTS stock_reduction_logs;');
}
