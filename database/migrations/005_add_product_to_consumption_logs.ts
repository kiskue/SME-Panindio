/**
 * Migration 005 — Add product_id and product_name to ingredient_consumption_logs
 *
 * Enhances the consumption audit ledger so that every ingredient reduction
 * caused by a production run records which finished product it was consumed
 * for — without requiring a JOIN back to production_logs at query time.
 *
 * Columns added:
 *   product_id   TEXT  nullable — FK reference to inventory_items(id)
 *   product_name TEXT  nullable — denormalized snapshot of the product name
 *
 * Both columns are nullable so existing rows (pre-migration) remain valid
 * with NULL values for non-production events (manual adjustments, wastage, etc.).
 */

import type { SQLiteDatabase } from 'expo-sqlite';

export const version     = 5;
export const description = 'Add product_id and product_name to ingredient_consumption_logs';

export async function up(db: SQLiteDatabase): Promise<void> {
  await db.execAsync(
    `ALTER TABLE ingredient_consumption_logs ADD COLUMN product_id TEXT;`,
  );
  await db.execAsync(
    `ALTER TABLE ingredient_consumption_logs ADD COLUMN product_name TEXT;`,
  );
}

export async function down(_db: SQLiteDatabase): Promise<void> {
  // SQLite does not support DROP COLUMN on older versions.
  // The recommended rollback strategy is to recreate the table without
  // the two columns. For safety in production we leave this as a no-op
  // and rely on a full schema rebuild if a true rollback is required.
}
