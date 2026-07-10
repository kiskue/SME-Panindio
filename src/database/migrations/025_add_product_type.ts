/**
 * Migration 025 — Add product_type column to inventory_items
 *
 * Introduces type discrimination for the 'product' inventory category.
 * Two variants:
 *
 *   'manufactured'   — assembled/cooked from ingredients and raw materials.
 *                      Requires a Bill of Materials (BOM). Examples: baked
 *                      goods, cooked meals, assembled goods.
 *
 *   'ready_to_sell'  — purchased finished goods resold as-is, with no
 *                      production step. Examples: packaged snacks, beverages,
 *                      merchandise.
 *
 * Default is 'ready_to_sell' so all existing product rows remain valid
 * without a data backfill. Businesses that rely on BOM-linked products
 * will need to edit those records to update the type — this is intentional
 * because we cannot infer the type from legacy data (a product might have
 * a BOM purely as a cost reference even for resellers who configured it
 * before this distinction existed).
 *
 * The column is nullable for non-product categories (ingredients,
 * equipment) — the application layer never reads it in that context.
 * Using NOT NULL DEFAULT on ALL rows (not a partial column) keeps the
 * schema simple and avoids a nullable type union in the domain model.
 */

import type { SQLiteDatabase } from 'expo-sqlite';

export const version = 25;
export const description = 'Add product_type column to inventory_items';

export async function up(db: SQLiteDatabase): Promise<void> {
  // ALTER TABLE ADD COLUMN is NOT idempotent and SQLite has no
  // "ADD COLUMN IF NOT EXISTS". On a fresh install the schema registry's
  // CREATE TABLE (inventoryItemsSchema) already defines product_type, so a
  // bare ADD COLUMN here throws "duplicate column name: product_type".
  // Swallow that specific error to make the migration re-entrant (same
  // pattern as migration 022). The column gets the default value for all
  // existing rows automatically.
  try {
    await db.execAsync(`
      ALTER TABLE inventory_items
      ADD COLUMN product_type TEXT NOT NULL DEFAULT 'ready_to_sell';
    `);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (!msg.toLowerCase().includes('duplicate column name')) {
      throw err;
    }
  }

  // Index for the product list filter — type is only queried alongside category,
  // so a compound index on (category, product_type) covers the common case.
  await db.execAsync(`
    CREATE INDEX IF NOT EXISTS idx_inventory_items_product_type
    ON inventory_items (category, product_type);
  `);
}

export async function down(db: SQLiteDatabase): Promise<void> {
  // SQLite does not support DROP COLUMN in older engine versions bundled with
  // Expo. Dropping and re-creating the table would be the correct approach for
  // a full rollback, but migrations are never rolled back in production — this
  // stub satisfies the Migration interface shape.
  await db.execAsync(`
    DROP INDEX IF EXISTS idx_inventory_items_product_type;
  `);
}
