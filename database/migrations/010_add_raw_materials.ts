/**
 * Migration 010 — Create raw_materials, product_raw_materials, and
 *                 raw_material_consumption_logs tables
 *
 * Adds the Raw Materials module:
 *   - raw_materials:                   master catalog of consumable supplies
 *   - product_raw_materials:           many-to-many link: product ↔ raw material
 *   - raw_material_consumption_logs:   immutable audit ledger of stock movements
 *
 * Key design choices:
 *
 *   Soft-delete in raw_materials:
 *     Rows are never hard-deleted (is_active = 0 instead) so product links
 *     and consumption logs reference valid rows indefinitely.
 *
 *   UNIQUE (product_id, raw_material_id) in product_raw_materials:
 *     Enforces one requirement row per material per product. The repository
 *     uses INSERT OR REPLACE for upsert semantics.
 *
 *   raw_material_consumption_logs is append-only:
 *     Corrections use a new row with a negative quantity_used — no UPDATE.
 *
 * Depends on: no FK to inventory_items; self-contained module.
 */

import type { SQLiteDatabase } from 'expo-sqlite';
import {
  rawMaterialsSchema,
  rawMaterialsIndexes,
} from '../schemas/raw_materials.schema';
import {
  productRawMaterialsSchema,
  productRawMaterialsIndexes,
} from '../schemas/product_raw_materials.schema';
import {
  rawMaterialConsumptionLogsSchema,
  rawMaterialConsumptionLogsIndexes,
} from '../schemas/raw_material_consumption_logs.schema';

export const version     = 10;
export const description = 'Create raw_materials, product_raw_materials, and raw_material_consumption_logs tables';

export async function up(db: SQLiteDatabase): Promise<void> {
  // Create tables in dependency order
  await db.execAsync(rawMaterialsSchema);
  await db.execAsync(productRawMaterialsSchema);
  await db.execAsync(rawMaterialConsumptionLogsSchema);

  // Create indexes
  for (const index of rawMaterialsIndexes) {
    await db.execAsync(index);
  }
  for (const index of productRawMaterialsIndexes) {
    await db.execAsync(index);
  }
  for (const index of rawMaterialConsumptionLogsIndexes) {
    await db.execAsync(index);
  }
}

export async function down(db: SQLiteDatabase): Promise<void> {
  // Drop child tables first to respect FK constraints
  await db.execAsync('DROP TABLE IF EXISTS raw_material_consumption_logs;');
  await db.execAsync('DROP TABLE IF EXISTS product_raw_materials;');
  await db.execAsync('DROP TABLE IF EXISTS raw_materials;');
}
