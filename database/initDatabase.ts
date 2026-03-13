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
  // ADD NEW MIGRATIONS HERE (keep sorted by version number)
];

// ─── Bootstrap ────────────────────────────────────────────────────────────────

/**
 * 1. Ensures the schema_migrations tracking table exists.
 * 2. Iterates all registered schemas and applies CREATE TABLE / INDEX
 *    (idempotent — IF NOT EXISTS guards make re-runs safe).
 * 3. Runs any pending versioned migrations in ascending order.
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

  // Apply all registered schemas (idempotent)
  for (const entry of schemaRegistry) {
    await db.execAsync(entry.schema);
    for (const index of entry.indexes) {
      await db.execAsync(index);
    }
  }

  // Fetch already-applied migration versions
  const applied = await db.getAllAsync<{ version: number }>(
    'SELECT version FROM schema_migrations ORDER BY version ASC',
    [],
  );
  const appliedVersions = new Set(applied.map((r) => r.version));

  // Run pending migrations in order
  const pending = MIGRATIONS
    .filter((m) => !appliedVersions.has(m.version))
    .sort((a, b) => a.version - b.version);

  for (const migration of pending) {
    await db.withTransactionAsync(async () => {
      await migration.up(db);
      await db.runAsync(
        `INSERT INTO schema_migrations (version, description, applied_at) VALUES (?, ?, ?)`,
        [migration.version, migration.description, new Date().toISOString()],
      );
    });
  }
}
