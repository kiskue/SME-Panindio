/**
 * Migration 011 — Add cost_per_unit snapshot column to raw_material_consumption_logs
 *
 * Problem solved:
 *   `getWasteRawMaterialCost()` previously computed cost at query time by
 *   JOIN-ing to raw_materials.cost_per_unit. If a material's cost is 0 (the
 *   column default) at the time of the query, those waste events contribute ₱0
 *   to the aggregate — even if the material had a non-zero cost when the waste
 *   was recorded. This caused the "Total Waste Cost" stat to show only the cost
 *   of whichever material happened to have cost_per_unit > 0 at query time.
 *
 * Fix:
 *   Add `cost_per_unit REAL NOT NULL DEFAULT 0` to the log table so each row
 *   carries a frozen cost snapshot. The repository now writes the caller-supplied
 *   value at INSERT time and reads it back in all aggregate queries — no JOIN
 *   to raw_materials is required for cost computation.
 *
 * Backfill note:
 *   Existing rows are assigned DEFAULT 0. This is intentional: we cannot
 *   retroactively know the cost at the time each event was recorded. The stat
 *   will be accurate for all new waste events from this migration onwards.
 *
 * Depends on: migration 010 (raw_material_consumption_logs table must exist).
 */

import type { SQLiteDatabase } from 'expo-sqlite';

export const version     = 11;
export const description = 'Add cost_per_unit snapshot column to raw_material_consumption_logs';

export async function up(db: SQLiteDatabase): Promise<void> {
  // Guard: SQLite does not support ALTER TABLE ADD COLUMN IF NOT EXISTS.
  // The schema file (raw_material_consumption_logs.schema.ts) already includes
  // this column in its CREATE TABLE statement, so any installation that ran
  // migration 010 after the schema was updated already has the column.
  // Check PRAGMA table_info first to make this migration safe to re-run.
  const tableInfo = await db.getAllAsync<{ name: string }>(
    `PRAGMA table_info(raw_material_consumption_logs)`,
  );
  const hasColumn = tableInfo.some((col) => col.name === 'cost_per_unit');
  if (hasColumn) {
    // Column already exists (created by the schema CREATE TABLE) — nothing to do.
    return;
  }

  // DEFAULT 0 handles the backfill of existing rows atomically.
  // SQLite ignores NOT NULL + DEFAULT for ALTER TABLE ADD COLUMN — both are
  // permitted and the default is applied to every existing row.
  await db.execAsync(
    `ALTER TABLE raw_material_consumption_logs ADD COLUMN cost_per_unit REAL NOT NULL DEFAULT 0;`,
  );
}

export async function down(db: SQLiteDatabase): Promise<void> {
  // SQLite does not support DROP COLUMN before version 3.35.0.
  // The Expo SQLite bundled with SDK 54 uses SQLite 3.45.x, so DROP COLUMN
  // is safe here. However, removing a cost snapshot column is destructive —
  // use with caution in production.
  await db.execAsync(
    `ALTER TABLE raw_material_consumption_logs DROP COLUMN cost_per_unit;`,
  );
}
