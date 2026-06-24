/**
 * Migration 001 — Create inventory_items table
 *
 * This is the initial migration that establishes the inventory_items table
 * and all supporting indexes.
 *
 * down() drops the table entirely (safe in development; in production a
 * more granular rollback may be required if data must be preserved).
 */

import type { SQLiteDatabase } from 'expo-sqlite';
import {
  inventoryItemsSchema,
  inventoryItemsIndexes,
} from '../schemas/inventory_items.schema';

export const version = 1;
export const description = 'Create inventory_items table with category-specific columns and performance indexes';

export async function up(db: SQLiteDatabase): Promise<void> {
  await db.execAsync(inventoryItemsSchema);

  for (const index of inventoryItemsIndexes) {
    await db.execAsync(index);
  }
}

export async function down(db: SQLiteDatabase): Promise<void> {
  await db.execAsync('DROP TABLE IF EXISTS inventory_items;');
}
