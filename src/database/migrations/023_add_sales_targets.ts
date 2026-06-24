/**
 * Migration 023 — Create sales_targets table
 *
 * Stores the user's income-based sales target configuration. Only one active
 * target row is expected per device (the store always upserts into id = 1).
 * A full table is used rather than AsyncStorage so the target survives
 * app reinstalls when the SQLite DB is backed up, and so it participates in
 * any future cloud-sync pipeline without schema changes.
 *
 * Columns:
 *   id              — always 1 (single-row singleton pattern)
 *   daily_target    — net income the user wants to earn per day (₱)
 *   target_product_id — optional FK-by-value to inventory_items.id;
 *                       when set, units_needed is calculated from that
 *                       product's net income per unit; when NULL the store
 *                       uses the blended average from all-time sales.
 *   created_at / updated_at — ISO 8601 timestamps
 */

import type { SQLiteDatabase } from 'expo-sqlite';

export const version     = 23;
export const description = 'Create sales_targets table for income-based sales target feature';

export async function up(db: SQLiteDatabase): Promise<void> {
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS sales_targets (
      id                 INTEGER PRIMARY KEY,
      daily_target       REAL    NOT NULL DEFAULT 0,
      target_product_id  TEXT,
      created_at         TEXT    NOT NULL,
      updated_at         TEXT    NOT NULL
    );
  `);

  // Seed the singleton row so every subsequent access is a plain UPDATE.
  // INSERT OR IGNORE ensures this is a no-op on every subsequent launch.
  await db.execAsync(`
    INSERT OR IGNORE INTO sales_targets (id, daily_target, target_product_id, created_at, updated_at)
    VALUES (1, 0, NULL, datetime('now'), datetime('now'));
  `);
}

export async function down(db: SQLiteDatabase): Promise<void> {
  await db.execAsync('DROP TABLE IF EXISTS sales_targets;');
}
