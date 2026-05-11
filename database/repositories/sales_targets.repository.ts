/**
 * sales_targets.repository.ts
 *
 * All SQLite access for the `sales_targets` singleton table.
 *
 * Design:
 *   - The table always contains exactly one row with id = 1 (seeded by
 *     migration 023). All writes are UPDATE statements — never INSERT.
 *   - `getSalesTarget()` returns the single row (or a safe zero-default if the
 *     row is somehow absent).
 *   - `saveSalesTarget()` updates the row atomically. No partial writes.
 *
 * TypeScript strict-mode notes:
 *   - exactOptionalPropertyTypes: optional fields use conditional spread.
 *   - noUncheckedIndexedAccess: getFirstAsync result is nullable; callers
 *     receive a guaranteed non-null object via the ?? default pattern.
 */

import { getDatabase } from '../database';

// ─── Row type ─────────────────────────────────────────────────────────────────

export interface SalesTargetRow {
  id:                number;
  daily_target:      number;
  target_product_id: string | null;
  created_at:        string;
  updated_at:        string;
}

// ─── Default row (returned when the table row is unexpectedly absent) ─────────

const DEFAULT_ROW: SalesTargetRow = {
  id:                1,
  daily_target:      0,
  target_product_id: null,
  created_at:        new Date().toISOString(),
  updated_at:        new Date().toISOString(),
};

// ─── Read ─────────────────────────────────────────────────────────────────────

/**
 * Reads the singleton sales target row.
 * Always returns a valid object — falls back to DEFAULT_ROW if the row is
 * absent (should not happen after migration 023 seeds it, but guards against
 * edge cases on first launch before migrations complete).
 */
export async function getSalesTarget(): Promise<SalesTargetRow> {
  try {
    const db  = await getDatabase();
    const row = await db.getFirstAsync<SalesTargetRow>(
      'SELECT id, daily_target, target_product_id, created_at, updated_at FROM sales_targets WHERE id = 1',
    );
    return row ?? DEFAULT_ROW;
  } catch {
    return DEFAULT_ROW;
  }
}

// ─── Write ────────────────────────────────────────────────────────────────────

export interface UpdateSalesTargetInput {
  daily_target:       number;
  target_product_id?: string | null;
}

/**
 * Persists a new sales target configuration.
 * Always updates the singleton row (id = 1). The INSERT OR REPLACE fallback
 * handles the edge case where the seed row is absent.
 */
export async function saveSalesTarget(input: UpdateSalesTargetInput): Promise<void> {
  const db        = await getDatabase();
  const now       = new Date().toISOString();
  const productId = input.target_product_id ?? null;

  await db.runAsync(
    `INSERT INTO sales_targets (id, daily_target, target_product_id, created_at, updated_at)
     VALUES (1, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       daily_target      = excluded.daily_target,
       target_product_id = excluded.target_product_id,
       updated_at        = excluded.updated_at`,
    [input.daily_target, productId, now, now],
  );
}
