/**
 * Migration 004 — Create ingredient_consumption_logs table
 *
 * Adds the immutable audit ledger that records every ingredient quantity
 * reduction (or return) regardless of the business event that triggered it.
 *
 * Depends on: migration 001 (inventory_items must exist first).
 * Companion tables: production_logs (migration 003) — production runs write
 * into this table but it has no hard FK on production_logs so it can also
 * receive manual_adjustment, wastage, and transfer events.
 */

import type { SQLiteDatabase } from 'expo-sqlite';
import {
  ingredientConsumptionLogsSchema,
  ingredientConsumptionLogsIndexes,
} from '../schemas/ingredient_consumption_logs.schema';

export const version     = 4;
export const description = 'Create ingredient_consumption_logs table for immutable ingredient audit trail';

export async function up(db: SQLiteDatabase): Promise<void> {
  await db.execAsync(ingredientConsumptionLogsSchema);

  for (const index of ingredientConsumptionLogsIndexes) {
    await db.execAsync(index);
  }
}

export async function down(db: SQLiteDatabase): Promise<void> {
  await db.execAsync('DROP TABLE IF EXISTS ingredient_consumption_logs;');
}
