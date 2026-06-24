/**
 * 022_add_vat_columns.ts
 *
 * Adds VAT-related columns to `inventory_items` (product VAT treatment) and
 * a `vat_amount` total column to `sales_orders` (per-order VAT component).
 *
 * Why ALTER TABLE instead of a schema-only change:
 *   Both tables already exist on every installed device. SQLite's
 *   `CREATE TABLE IF NOT EXISTS` is a no-op on existing tables, so the only
 *   way to extend them is via `ALTER TABLE … ADD COLUMN`. Each ADD COLUMN
 *   statement below is wrapped in a try/catch so that running this migration
 *   twice (or on a fresh install where the CREATE TABLE in the schema registry
 *   has already included these columns) is safe and produces no error.
 *
 * Defaults applied to pre-existing rows:
 *   - vat_type:         'vatable'  (most SME products are VAT-registered)
 *   - is_vat_inclusive: 0          (exclusive pricing is the common default)
 *   - vat_rate:         0.12       (12 % Philippine standard VAT rate)
 *   - vat_amount:       0.0        (historical orders recorded before VAT was tracked)
 */

import type { SQLiteDatabase } from 'expo-sqlite';

export const version     = 22;
export const description = 'add_vat_columns';

/**
 * Attempts a single ALTER TABLE ADD COLUMN, silently ignoring the error when
 * the column already exists (SQLite error code: "duplicate column name").
 * This makes the migration re-entrant — safe to run on fresh installs where
 * the schema registry's CREATE TABLE already includes the new columns.
 */
async function addColumnIfMissing(
  db:         SQLiteDatabase,
  table:      string,
  columnDDL:  string,
): Promise<void> {
  try {
    await db.execAsync(`ALTER TABLE ${table} ADD COLUMN ${columnDDL};`);
  } catch (err) {
    // SQLite throws "duplicate column name" when the column already exists.
    // Any other error is a genuine problem and should be re-thrown.
    const msg = err instanceof Error ? err.message : String(err);
    if (!msg.toLowerCase().includes('duplicate column name')) {
      throw err;
    }
  }
}

export async function up(db: SQLiteDatabase): Promise<void> {
  // ── inventory_items ────────────────────────────────────────────────────────
  await addColumnIfMissing(db, 'inventory_items', `vat_type         TEXT    NOT NULL DEFAULT 'vatable'`);
  await addColumnIfMissing(db, 'inventory_items', `is_vat_inclusive INTEGER NOT NULL DEFAULT 0`);
  await addColumnIfMissing(db, 'inventory_items', `vat_rate         REAL    NOT NULL DEFAULT 0.12`);

  // ── sales_orders ───────────────────────────────────────────────────────────
  await addColumnIfMissing(db, 'sales_orders', `vat_amount REAL NOT NULL DEFAULT 0.0`);
}

export async function down(db: SQLiteDatabase): Promise<void> {
  // SQLite does not support DROP COLUMN on versions < 3.35.0 (bundled with
  // older Android WebView). A full table rebuild would be needed to reverse
  // this migration. For now, down() is intentionally a no-op — the columns
  // carry safe defaults and do not break any existing query when present.
  // If a hard rollback is ever required, replace this with a table rebuild.
  //
  // Note: Expo SQLite on Android uses SQLite 3.39+ (bundled in the Expo Go
  // SDK), so DROP COLUMN would technically work — but we keep this as a no-op
  // to avoid accidental data loss in any production rollback scenario.
}
