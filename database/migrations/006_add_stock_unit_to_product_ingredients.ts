/**
 * Migration 006 — Add stock_unit column to product_ingredients
 *
 * Context:
 *   The UOM conversion feature requires knowing the ingredient's canonical
 *   stock unit (e.g. 'kg') independently of the recipe unit (e.g. 'g').
 *   Previously `unit` stored the recipe unit but there was no persistent
 *   record of what unit the ingredient is stocked in — callers had to JOIN
 *   inventory_items on every deduction calculation to retrieve it.
 *
 *   Adding `stock_unit` as a nullable column snapshotted at link time means:
 *     1. calculateStockDeductions() reads a single product_ingredients row
 *        and has enough information to apply convertUnit(quantity_used, unit, stock_unit).
 *     2. Rows inserted before this migration have stock_unit = NULL; the
 *        repository treats NULL stock_unit as equal to `unit` (no conversion
 *        needed — legacy rows were always inserted with matching units).
 *
 * SQLite constraints:
 *   SQLite ALTER TABLE only supports ADD COLUMN, not DROP COLUMN or RENAME
 *   COLUMN on the version shipped with React Native 0.81 / Expo SDK 54.
 *   The new column is nullable so existing rows remain valid without back-fill.
 *
 * down() guidance:
 *   Dropping a column is not safe on SQLite < 3.35.0 (pre-dates RN 0.81).
 *   The down migration is intentionally left as a no-op; a full schema rebuild
 *   would be required if a true rollback is ever needed in production.
 *
 * Depends on: migration 002 (product_ingredients table must exist).
 */

import type { SQLiteDatabase } from 'expo-sqlite';

export const version     = 6;
export const description = 'Add stock_unit column to product_ingredients for UOM conversion support';

export async function up(db: SQLiteDatabase): Promise<void> {
  // ADD COLUMN is idempotent-safe when wrapped in a try/catch because SQLite
  // throws "duplicate column name" if the column already exists (e.g. on a
  // fresh install where the schema registry CREATE TABLE already includes
  // stock_unit). We catch only that specific error code and re-throw anything
  // else so real errors are never silently swallowed.
  try {
    await db.execAsync(
      `ALTER TABLE product_ingredients ADD COLUMN stock_unit TEXT;`,
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    // SQLite error text for a duplicate column is "duplicate column name: stock_unit"
    if (!message.toLowerCase().includes('duplicate column name')) {
      throw err;
    }
    // Column already exists (fresh install via schema registry) — no-op.
  }
}

export async function down(_db: SQLiteDatabase): Promise<void> {
  // SQLite ALTER TABLE does not support DROP COLUMN on Expo SDK 54 / RN 0.81.
  // A rollback here would require recreating the table. Leave as no-op and
  // rely on a full schema rebuild if a true rollback is required in production.
}
