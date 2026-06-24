/**
 * Migration 013 — Extend stock_reduction_logs to support ingredients
 *
 * Problem:
 *   The original table was designed exclusively for products. Three issues
 *   blocked ingredient support:
 *     1. `product_id TEXT NOT NULL` — the NOT NULL constraint prevents
 *        inserting ingredient rows (ingredients have no product_id).
 *     2. `product_name TEXT NOT NULL` — same constraint problem; ingredient
 *        rows have no product_name to denormalise.
 *     3. No `item_type` discriminator — impossible to filter product vs
 *        ingredient reductions without an extra JOIN to inventory_items.
 *
 * Solution — table rebuild (rename-copy-drop-rename):
 *   SQLite does not support ALTER COLUMN to remove NOT NULL constraints.
 *   The only safe path is:
 *     1. Create `stock_reduction_logs_new` with the corrected schema.
 *     2. Copy all existing rows, backfilling item_type = 'product' and
 *        item_name = product_name for backward compatibility.
 *     3. Drop the old table.
 *     4. Rename the new table.
 *     5. Recreate indexes.
 *
 * Post-migration schema:
 *   - `product_id`   TEXT  (nullable) — FK for product rows only
 *   - `product_name` TEXT  (nullable) — legacy snapshot for product rows only
 *   - `item_type`    TEXT  NOT NULL DEFAULT 'product'
 *   - `item_name`    TEXT  NOT NULL — generic name snapshot for all rows
 *
 * Depends on: migration 012 (stock_reduction_logs table must exist).
 */

import type { SQLiteDatabase } from 'expo-sqlite';

export const version     = 13;
export const description = 'Extend stock_reduction_logs: nullable product_id, add item_type + item_name for ingredient support';

export async function up(db: SQLiteDatabase): Promise<void> {
  // Idempotency guard — if item_type already exists the migration completed
  // previously (or the DB was created fresh from the post-013 schema). Either
  // way there is nothing to do.
  const cols = await db.getAllAsync<{ name: string }>(
    'PRAGMA table_info(stock_reduction_logs)',
  );
  const hasItemType = cols.some((c) => c.name === 'item_type');
  if (hasItemType) return;

  // Clean up any half-built table left by a previous failed run so the
  // CREATE TABLE below starts from a known-clean state.
  await db.execAsync('DROP TABLE IF EXISTS stock_reduction_logs_new;');

  // Step 1 — Create the replacement table with the corrected schema.
  // Note: this migration runs inside an explicit BEGIN/COMMIT in initDatabase.ts
  // so we do NOT call withTransactionAsync() here (it would deadlock).
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS stock_reduction_logs_new (
      id            TEXT    PRIMARY KEY,
      item_type     TEXT    NOT NULL DEFAULT 'product',
      item_name     TEXT    NOT NULL,
      product_id    TEXT    REFERENCES inventory_items(id),
      product_name  TEXT,
      units_reduced REAL    NOT NULL,
      reason        TEXT    NOT NULL DEFAULT 'correction',
      notes         TEXT,
      performed_by  TEXT,
      reduced_at    TEXT    NOT NULL,
      created_at    TEXT    NOT NULL,
      is_synced     INTEGER NOT NULL DEFAULT 0
    );
  `);

  // Step 2 — Copy all existing rows.
  // Backfill: item_type = 'product', item_name = product_name (which was NOT
  // NULL in the old schema, so COALESCE is a safety net only).
  await db.execAsync(`
    INSERT INTO stock_reduction_logs_new
      (id, item_type, item_name, product_id, product_name,
       units_reduced, reason, notes, performed_by,
       reduced_at, created_at, is_synced)
    SELECT
      id,
      'product'                                  AS item_type,
      COALESCE(product_name, '')                 AS item_name,
      product_id,
      product_name,
      units_reduced,
      reason,
      notes,
      performed_by,
      reduced_at,
      created_at,
      is_synced
    FROM stock_reduction_logs;
  `);

  // Step 3 — Drop the old table.
  await db.execAsync('DROP TABLE stock_reduction_logs;');

  // Step 4 — Rename the new table into place.
  await db.execAsync('ALTER TABLE stock_reduction_logs_new RENAME TO stock_reduction_logs;');

  // Step 5 — Recreate indexes (they were dropped with the old table).
  await db.execAsync(`
    CREATE INDEX IF NOT EXISTS idx_srl_product_id
      ON stock_reduction_logs (product_id);
  `);
  await db.execAsync(`
    CREATE INDEX IF NOT EXISTS idx_srl_item_type
      ON stock_reduction_logs (item_type);
  `);
  await db.execAsync(`
    CREATE INDEX IF NOT EXISTS idx_srl_reduced_at
      ON stock_reduction_logs (reduced_at);
  `);
  await db.execAsync(`
    CREATE INDEX IF NOT EXISTS idx_srl_is_synced
      ON stock_reduction_logs (is_synced);
  `);
}

export async function down(db: SQLiteDatabase): Promise<void> {
  // Reverse: rebuild the original NOT NULL product-only schema.
  // Ingredient rows (item_type = 'ingredient') are discarded — they cannot
  // be represented in the old schema.
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS stock_reduction_logs_old (
      id            TEXT    PRIMARY KEY,
      product_id    TEXT    NOT NULL REFERENCES inventory_items(id),
      product_name  TEXT    NOT NULL,
      units_reduced REAL    NOT NULL,
      reason        TEXT    NOT NULL DEFAULT 'correction',
      notes         TEXT,
      performed_by  TEXT,
      reduced_at    TEXT    NOT NULL,
      created_at    TEXT    NOT NULL,
      is_synced     INTEGER NOT NULL DEFAULT 0
    );
  `);

  await db.execAsync(`
    INSERT INTO stock_reduction_logs_old
      (id, product_id, product_name, units_reduced, reason,
       notes, performed_by, reduced_at, created_at, is_synced)
    SELECT
      id,
      COALESCE(product_id, ''),
      COALESCE(product_name, item_name),
      units_reduced,
      reason,
      notes,
      performed_by,
      reduced_at,
      created_at,
      is_synced
    FROM stock_reduction_logs
    WHERE item_type = 'product';
  `);

  await db.execAsync('DROP TABLE stock_reduction_logs;');
  await db.execAsync('ALTER TABLE stock_reduction_logs_old RENAME TO stock_reduction_logs;');

  await db.execAsync(`
    CREATE INDEX IF NOT EXISTS idx_srl_product_id
      ON stock_reduction_logs (product_id);
  `);
  await db.execAsync(`
    CREATE INDEX IF NOT EXISTS idx_srl_reduced_at
      ON stock_reduction_logs (reduced_at);
  `);
  await db.execAsync(`
    CREATE INDEX IF NOT EXISTS idx_srl_is_synced
      ON stock_reduction_logs (is_synced);
  `);
}
