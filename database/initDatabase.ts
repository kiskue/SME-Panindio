/**
 * initDatabase.ts
 *
 * Runs all registered schema migrations on app start.
 * Called once from `src/app/_layout.tsx` inside `initializeApp()`.
 *
 * Strategy:
 *   Uses `CREATE TABLE IF NOT EXISTS` / `CREATE INDEX IF NOT EXISTS` so it is
 *   safe to re-run on every launch. A `schema_migrations` table tracks which
 *   versioned migration files have been applied to detect schema drift in CI
 *   and future ALTER TABLE migrations.
 *
 * Usage:
 *   import { initDatabase } from '@/database/initDatabase';
 *   await initDatabase();
 */

import { getDatabase } from './database';
import { schemaRegistry } from './registry/schemaRegistry';
import * as migration001 from './migrations/001_create_inventory_items';
import * as migration002 from './migrations/002_add_product_ingredients';
import * as migration003 from './migrations/003_add_production_logs';
import * as migration004 from './migrations/004_add_ingredient_consumption_logs';
import * as migration005 from './migrations/005_add_product_to_consumption_logs';
import * as migration006 from './migrations/006_add_stock_unit_to_product_ingredients';
import * as migration007 from './migrations/007_add_sales_orders';
import * as migration008 from './migrations/008_add_utilities';
import * as migration009 from './migrations/009_add_dashboard_indexes';
import * as migration010 from './migrations/010_add_raw_materials';
import * as migration011 from './migrations/011_add_cost_per_unit_to_raw_material_logs';
import * as migration012 from './migrations/012_add_stock_reduction_logs';
import * as migration013 from './migrations/013_extend_stock_reduction_logs_for_ingredients';
import * as migration014 from './migrations/014_add_overhead_expenses';
import * as migration015 from './migrations/015_add_pnl_indexes';
import * as migration016 from './migrations/016_add_receivables';
import * as migration017 from './migrations/017_add_roi_scenarios';
import * as migration018 from './migrations/018_add_product_stock_additions';
// ADD NEW MIGRATION IMPORTS HERE

// ─── Migration manifest ───────────────────────────────────────────────────────

interface Migration {
  version:     number;
  description: string;
  up:          (db: import('expo-sqlite').SQLiteDatabase) => Promise<void>;
  down:        (db: import('expo-sqlite').SQLiteDatabase) => Promise<void>;
}

const MIGRATIONS: Migration[] = [
  migration001,
  migration002,
  migration003,
  migration004,
  migration005,
  migration006,
  migration007,
  migration008,
  migration009,
  migration010,
  migration011,
  migration012,
  migration013,
  migration014,
  migration015,
  migration016,
  migration017,
  migration018,
  // ADD NEW MIGRATIONS HERE (keep sorted by version number)
];

// ─── Bootstrap ────────────────────────────────────────────────────────────────

/**
 * 1. Ensures the schema_migrations tracking table exists.
 * 2. Runs any pending versioned migrations in ascending order.
 * 3. Iterates all registered schemas and applies CREATE TABLE / INDEX
 *    (idempotent — IF NOT EXISTS guards make re-runs safe).
 *
 * IMPORTANT — why migrations run before the schema registry:
 *   The schema registry always reflects the latest (post-migration) table
 *   shape. On an existing install, a table may still be in its old shape
 *   when the registry tries to create indexes against columns that do not
 *   yet exist (e.g. idx_srl_item_type → item_type before migration 013).
 *   SQLite validates column references at CREATE INDEX time even for
 *   "IF NOT EXISTS" indexes, causing an immediate "no such column" crash.
 *   Running migrations first brings every table to its current shape so
 *   the subsequent registry pass is always a safe no-op.
 */
export async function initDatabase(): Promise<void> {
  const db = await getDatabase();

  // Create the migrations tracking table first
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version     INTEGER PRIMARY KEY,
      description TEXT    NOT NULL,
      applied_at  TEXT    NOT NULL
    );
  `);

  // Fetch already-applied migration versions
  const applied = await db.getAllAsync<{ version: number }>(
    'SELECT version FROM schema_migrations ORDER BY version ASC',
  );
  const appliedVersions = new Set(applied.map((r) => r.version));

  // Run pending migrations BEFORE the schema registry.
  //
  // Why this ordering matters:
  //   The schema registry always reflects the latest (post-migration) table
  //   shape. On an existing install where a table was created by an earlier
  //   migration in its old shape, the registry's CREATE INDEX statements can
  //   reference columns that do not yet exist on the old table (e.g.
  //   idx_srl_item_type referencing item_type before migration 013 runs).
  //   SQLite validates column references at CREATE INDEX time even when the
  //   index does not already exist, so the execAsync call crashes with
  //   "no such column". Running migrations first brings every table to its
  //   current shape; the subsequent schema registry pass then sees the
  //   correct columns and all CREATE TABLE / CREATE INDEX calls are no-ops.
  const pending = MIGRATIONS
    .filter((m) => !appliedVersions.has(m.version))
    .sort((a, b) => a.version - b.version);

  for (const migration of pending) {
    // withTransactionAsync acquires an exclusive lock on the serialized queue,
    // then any db.runAsync / db.execAsync called inside the callback (including
    // those inside migration.up()) are queued behind the same lock — deadlock.
    // Using explicit BEGIN / COMMIT / ROLLBACK avoids that lock entirely while
    // still guaranteeing atomicity: if migration.up() throws, ROLLBACK fires and
    // the version is not recorded, so the migration will retry on next launch.
    await db.execAsync('BEGIN');
    try {
      await migration.up(db);
      await db.runAsync(
        `INSERT INTO schema_migrations (version, description, applied_at) VALUES (?, ?, ?)`,
        [migration.version, migration.description, new Date().toISOString()],
      );
      await db.execAsync('COMMIT');
    } catch (err) {
      await db.execAsync('ROLLBACK');
      throw err;
    }
  }

  // Apply all registered schemas (idempotent — runs after migrations so every
  // table is already in its latest shape and all CREATE TABLE / INDEX calls
  // are guaranteed to be no-ops on existing installs).
  for (const entry of schemaRegistry) {
    await db.execAsync(entry.schema);
    for (const index of entry.indexes) {
      await db.execAsync(index);
    }
  }
}
