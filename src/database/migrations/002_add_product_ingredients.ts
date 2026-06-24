/**
 * Migration 002 — Create product_ingredients table
 *
 * Adds the junction table that links products to their ingredient items,
 * storing the quantity consumed per unit of product for cost calculation.
 *
 * Depends on: migration 001 (inventory_items must exist first).
 */

import type { SQLiteDatabase } from 'expo-sqlite';
import {
  productIngredientsSchema,
  productIngredientsIndexes,
} from '../schemas/product_ingredients.schema';

export const version     = 2;
export const description = 'Create product_ingredients junction table for ingredient-based cost calculation';

export async function up(db: SQLiteDatabase): Promise<void> {
  await db.execAsync(productIngredientsSchema);

  for (const index of productIngredientsIndexes) {
    await db.execAsync(index);
  }
}

export async function down(db: SQLiteDatabase): Promise<void> {
  await db.execAsync('DROP TABLE IF EXISTS product_ingredients;');
}
