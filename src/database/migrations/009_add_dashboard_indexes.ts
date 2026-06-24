/**
 * Migration 009 — Add composite indexes for dashboard period queries
 *
 * These indexes cover the three hottest query paths in dashboard.repository.ts:
 *
 *   idx_sales_orders_status_created_at
 *     Serves querySalesKPI and the sales leg of queryTrendPoint.
 *     Both queries filter on `status = 'completed' AND created_at BETWEEN ? AND ?`.
 *     A composite index on (status, created_at) lets SQLite resolve the equality
 *     predicate on status via index seek, then range-scan created_at within the
 *     matching rows — far cheaper than the separate single-column indexes
 *     already present on each column individually.
 *
 *   idx_icl_cancelled_at_consumed_at
 *     Serves queryIngredientKPI and the costs leg of queryTrendPoint.
 *     Both queries filter on `cancelled_at IS NULL AND consumed_at BETWEEN ? AND ?`.
 *     Placing cancelled_at first means the IS NULL predicate narrows the index
 *     to non-cancelled rows before the range scan on consumed_at begins.
 *
 *   idx_utility_logs_created_at
 *     Serves the unpaid-bill branch of queryUtilitiesKPI:
 *       `paid_at IS NULL AND created_at BETWEEN ? AND ?`
 *     The paid-bill branch is already covered by the existing idx_utility_logs_paid_at.
 *
 * These are additive-only changes. The `up` function uses CREATE INDEX IF NOT EXISTS
 * so the migration is safe to re-run. The `down` function drops the three indexes.
 *
 * Depends on: migrations 007 (sales_orders) and 008 (utilities) must have run first.
 */

import type { SQLiteDatabase } from 'expo-sqlite';

export const version     = 9;
export const description = 'Add composite indexes on sales_orders, ingredient_consumption_logs, and utility_logs for dashboard period queries';

// ─── Index DDL ────────────────────────────────────────────────────────────────

const INDEXES_UP = [
  `CREATE INDEX IF NOT EXISTS idx_sales_orders_status_created_at
     ON sales_orders (status, created_at);`,

  `CREATE INDEX IF NOT EXISTS idx_icl_cancelled_at_consumed_at
     ON ingredient_consumption_logs (cancelled_at, consumed_at);`,

  `CREATE INDEX IF NOT EXISTS idx_utility_logs_created_at
     ON utility_logs (created_at);`,
] as const;

const INDEXES_DOWN = [
  'DROP INDEX IF EXISTS idx_sales_orders_status_created_at;',
  'DROP INDEX IF EXISTS idx_icl_cancelled_at_consumed_at;',
  'DROP INDEX IF EXISTS idx_utility_logs_created_at;',
] as const;

// ─── Migration ────────────────────────────────────────────────────────────────

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
