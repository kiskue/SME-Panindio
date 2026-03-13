/**
 * Migration 003 — Create production_logs and production_log_ingredients tables
 *
 * Adds the production tracking system:
 *   - production_logs: one row per production run
 *   - production_log_ingredients: ingredient consumption line items per run
 *
 * Depends on: migration 001 (inventory_items) and 002 (product_ingredients).
 */

import type { SQLiteDatabase } from 'expo-sqlite';
import {
  productionLogsSchema,
  productionLogsIndexes,
  productionLogIngredientsSchema,
  productionLogIngredientsIndexes,
} from '../schemas/production_logs.schema';

export const version     = 3;
export const description = 'Create production_logs and production_log_ingredients tables for production tracking';

export async function up(db: SQLiteDatabase): Promise<void> {
  await db.execAsync(productionLogsSchema);
  for (const index of productionLogsIndexes) {
    await db.execAsync(index);
  }

  await db.execAsync(productionLogIngredientsSchema);
  for (const index of productionLogIngredientsIndexes) {
    await db.execAsync(index);
  }
}

export async function down(db: SQLiteDatabase): Promise<void> {
  await db.execAsync('DROP TABLE IF EXISTS production_log_ingredients;');
  await db.execAsync('DROP TABLE IF EXISTS production_logs;');
}
