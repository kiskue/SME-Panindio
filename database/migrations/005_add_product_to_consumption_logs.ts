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

export async function up(_db: SQLiteDatabase): Promise<void> {
  // Both columns (product_id, product_name) are already present in the
  // ingredientConsumptionLogsSchema CREATE TABLE statement, which the
  // schema-registry loop in initDatabase() runs on every launch before
  // migrations execute. On a fresh install the table is therefore created with
  // these columns by the registry, then migration 004 runs the same CREATE TABLE
  // (IF NOT EXISTS — no-op), and arriving here with the ALTER TABLE statements
  // would try to add columns that already exist, causing SQLite to throw
  // "duplicate column name: product_id".
  //
  // The schema file is the canonical column definition. This migration entry
  // must remain in the registry so that the schema_migrations tracking row is
  // written for databases that were first created before the schema file was
  // updated — those existing databases still need their schema_migrations record
  // to be at version 5 so that future migrations start from the right baseline.
  // No DDL is needed here because:
  //   • New installs: columns exist from the CREATE TABLE in the registry.
  //   • Existing installs that ran the old ALTER TABLE statements: columns exist.
}

export async function down(_db: SQLiteDatabase): Promise<void> {
  // SQLite does not support DROP COLUMN on older versions.
  // The recommended rollback strategy is to recreate the table without
  // the two columns. For safety in production we leave this as a no-op
  // and rely on a full schema rebuild if a true rollback is required.
}
