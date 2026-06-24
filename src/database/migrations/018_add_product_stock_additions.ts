/**
 * Migration 018 — Create product_stock_additions table
 *
 * Adds the `product_stock_additions` table for the BOM-constrained "Add
 * Product Stock" feature. Each row is an immutable audit record of a single
 * stock addition event, capturing:
 *   - how many units were added to a product
 *   - a JSON snapshot of each ingredient deduction (ingredientsUsed)
 *   - a JSON snapshot of each raw material deduction (rawMaterialsUsed)
 *
 * The JSON blob design keeps the schema stable as the BOM evolves and avoids
 * a proliferation of child tables that would complicate the offline-first
 * sync boundary. Detailed deduction entries are still written to
 * `ingredient_consumption_logs` and `raw_material_consumption_logs` — these
 * blobs are purely for audit display and sync payload construction.
 *
 * Foreign key: product_id → inventory_items(id)
 *   No ON DELETE CASCADE — audit rows must survive product soft-deletion.
 */

import type { SQLiteDatabase } from 'expo-sqlite';
import {
  productStockAdditionsSchema,
  productStockAdditionsIndexes,
} from '../schemas/product_stock_additions.schema';

export const version     = 18;
export const description = 'Create product_stock_additions table for BOM-constrained stock addition audit trail';

export async function up(db: SQLiteDatabase): Promise<void> {
  await db.execAsync(productStockAdditionsSchema);
  for (const index of productStockAdditionsIndexes) {
    await db.execAsync(index);
  }
}

export async function down(db: SQLiteDatabase): Promise<void> {
  await db.execAsync('DROP TABLE IF EXISTS product_stock_additions;');
}
