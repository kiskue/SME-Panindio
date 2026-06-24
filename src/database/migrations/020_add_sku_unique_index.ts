/**
 * 020_add_sku_unique_index.ts
 *
 * Replaces the plain `idx_inventory_items_sku` index (created by migration 001)
 * with a UNIQUE partial index that allows NULL but prevents two items from
 * sharing the same non-null SKU value.
 *
 * Why this migration is needed:
 *   The barcode scanner writes the scanned code into `inventory_items.sku`.
 *   Without a unique constraint, scanning the same barcode twice would silently
 *   create a duplicate product. The partial index (`WHERE sku IS NOT NULL`)
 *   enforces uniqueness only for rows that actually have a SKU, leaving
 *   ingredient and equipment rows (which carry no SKU) completely unaffected.
 *
 * Existing installs:
 *   The non-unique index created by migration 001 must be dropped before the
 *   unique one can be created. `DROP INDEX IF EXISTS` is used so the migration
 *   is safe even if the old index was never created on a fresh install.
 */

import type { SQLiteDatabase } from 'expo-sqlite';

export const version = 20;
export const description = 'replace plain sku index with unique partial index on inventory_items';

export async function up(db: SQLiteDatabase): Promise<void> {
  // Drop the old non-unique index created by migration 001 (or the schema
  // registry on a fresh install that ran before this migration).
  await db.execAsync(
    `DROP INDEX IF EXISTS idx_inventory_items_sku;`,
  );

  // Create the uniqueness-enforcing partial index.
  await db.execAsync(
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_inventory_items_sku ON inventory_items (sku) WHERE sku IS NOT NULL;`,
  );
}

export async function down(db: SQLiteDatabase): Promise<void> {
  // Revert to the plain non-unique index.
  await db.execAsync(
    `DROP INDEX IF EXISTS idx_inventory_items_sku;`,
  );
  await db.execAsync(
    `CREATE INDEX IF NOT EXISTS idx_inventory_items_sku ON inventory_items (sku);`,
  );
}
