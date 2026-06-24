/**
 * Migration 014 — Create overhead_expenses table
 *
 * Adds an immutable ledger for business overhead and operating expenses
 * (rent, renovation, utilities, insurance, maintenance, other).
 *
 * Design decisions carried into this migration:
 *   - Entries are append-only; there is no UPDATE path. Corrections are new
 *     rows with a corrective note, preserving the full audit trail.
 *   - `is_recurring` (INTEGER 0/1) is a flag for the owner's reference only.
 *     The app never auto-creates future entries from it.
 *   - `frequency` is informational metadata — the billing cadence. No
 *     scheduled jobs depend on it in this MVP.
 *   - Indexes on `category`, `expense_date`, and `is_recurring` cover the
 *     primary filter combinations used by both the list screen and the
 *     dashboard KPI queries.
 *
 * Depends on: nothing (no foreign keys to other tables).
 */

import type { SQLiteDatabase } from 'expo-sqlite';
import {
  overheadExpensesSchema,
  overheadExpensesIndexes,
} from '../schemas/overhead_expenses.schema';

export const version     = 14;
export const description = 'Create overhead_expenses table for business overhead and operating cost tracking';

export async function up(db: SQLiteDatabase): Promise<void> {
  await db.execAsync(overheadExpensesSchema);

  for (const index of overheadExpensesIndexes) {
    await db.execAsync(index);
  }
}

export async function down(db: SQLiteDatabase): Promise<void> {
  await db.execAsync('DROP TABLE IF EXISTS overhead_expenses;');
}
