/**
 * Migration 015 — Add P&L composite indexes
 *
 * Adds indexes that cover the three aggregate queries in
 * `database/repositories/dashboard.repository.ts` (getGrossIncome,
 * getCOGS, getOpEx). All DDL uses CREATE INDEX IF NOT EXISTS so the
 * migration is safe to re-run.
 *
 * Indexes added:
 *   idx_icl_trigger_consumed_at    — ingredient leg of getCOGS
 *   idx_rmcl_reason_consumed_at    — raw-material waste leg of getCOGS
 *   idx_utility_logs_period_ordinal — utility ordinal range for getOpEx
 *
 * Depends on: 004, 010, 008, 014
 */

import type { SQLiteDatabase } from 'expo-sqlite';

export const version     = 15;
export const description = 'Add composite indexes on ingredient_consumption_logs, raw_material_consumption_logs, and utility_logs for P&L dashboard queries';

const INDEXES_UP = [
  `CREATE INDEX IF NOT EXISTS idx_icl_trigger_consumed_at
     ON ingredient_consumption_logs (trigger_type, consumed_at);`,

  `CREATE INDEX IF NOT EXISTS idx_rmcl_reason_consumed_at
     ON raw_material_consumption_logs (reason, consumed_at);`,

  `CREATE INDEX IF NOT EXISTS idx_utility_logs_period_ordinal
     ON utility_logs (period_year * 12 + period_month);`,
] as const;

const INDEXES_DOWN = [
  'DROP INDEX IF EXISTS idx_icl_trigger_consumed_at;',
  'DROP INDEX IF EXISTS idx_rmcl_reason_consumed_at;',
  'DROP INDEX IF EXISTS idx_utility_logs_period_ordinal;',
] as const;

export async function up(db: SQLiteDatabase): Promise<void> {
  for (const ddl of INDEXES_UP) {
    await db.execAsync(ddl);
  }
}

export async function down(db: SQLiteDatabase): Promise<void> {
  for (const ddl of INDEXES_DOWN) {
    await db.execAsync(ddl);
  }
}
