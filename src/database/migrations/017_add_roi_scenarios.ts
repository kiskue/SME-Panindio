/**
 * Migration 017 — Create ROI Scenarios table
 *
 * Adds the `roi_scenarios` table for the ROI Calculator module.
 * Each row is a named snapshot of the user's calculator inputs, the computed
 * results, the three-scenario comparison, and the natural language insight
 * string, all captured at the moment the user tapped "Save Scenario".
 *
 * Design decisions:
 *   - Formula inputs and computed outputs are stored as JSON strings rather
 *     than individual columns. This keeps the schema stable as the formula
 *     evolves (new input fields do not require a schema migration) and avoids
 *     wide tables with many nullable columns.
 *   - There is no dependency on any other table — roi_scenarios stands alone.
 *   - `is_synced` is consistent with every other table in this project.
 *
 * No dependencies on prior migrations.
 */

import type { SQLiteDatabase } from 'expo-sqlite';
import {
  roiScenariosSchema,
  roiScenariosIndexes,
} from '../schemas/roi.schema';

export const version     = 17;
export const description = 'Create roi_scenarios table for the ROI Calculator module';

export async function up(db: SQLiteDatabase): Promise<void> {
  await db.execAsync(roiScenariosSchema);
  for (const index of roiScenariosIndexes) {
    await db.execAsync(index);
  }
}

export async function down(db: SQLiteDatabase): Promise<void> {
  await db.execAsync('DROP TABLE IF EXISTS roi_scenarios;');
}
