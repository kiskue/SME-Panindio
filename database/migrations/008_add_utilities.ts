/**
 * Migration 008 — Create utility_types and utility_logs tables
 *
 * Adds the Utilities Consumption module:
 *   - utility_types:  master list of utility categories (electricity, water, etc.)
 *   - utility_logs:   monthly billing/consumption records per utility per month
 *
 * Key design choices:
 *
 *   Seeding utility_types:
 *     Five default utility types are inserted in this migration using
 *     INSERT OR IGNORE so the migration is safe to re-run and does not
 *     overwrite any user edits to those rows.
 *
 *   UNIQUE constraint on utility_logs(utility_type_id, period_year, period_month):
 *     Enforces one record per utility per calendar month. The repository uses
 *     INSERT OR REPLACE to implement upsert semantics — updating a bill for a
 *     month that already has a record replaces the old row atomically.
 *
 *   No `updated_at` / `is_synced` on utility_types:
 *     The built-in seeds are immutable. User-created types (`is_custom = 1`)
 *     are append-only in v1 — no sync requirement yet.
 *
 * Depends on: no prior table dependencies (no FK to existing tables).
 */

import type { SQLiteDatabase } from 'expo-sqlite';
import {
  utilityTypesSchema,
  utilityTypesIndexes,
  utilityLogsSchema,
  utilityLogsIndexes,
} from '../schemas/utilities.schema';

export const version     = 8;
export const description = 'Create utility_types and utility_logs tables for Utilities Consumption module';

// ─── Default utility type seeds ───────────────────────────────────────────────

const SEED_UTILITY_TYPES = [
  {
    id:        'ut-electricity',
    name:      'Electricity',
    icon:      'Zap',
    unit:      'kWh',
    color:     '#F59E0B',
    is_custom: 0,
  },
  {
    id:        'ut-water',
    name:      'Water',
    icon:      'Droplets',
    unit:      'm³',
    color:     '#3B82F6',
    is_custom: 0,
  },
  {
    id:        'ut-gas',
    name:      'Gas',
    icon:      'Flame',
    unit:      'm³',
    color:     '#EF4444',
    is_custom: 0,
  },
  {
    id:        'ut-internet',
    name:      'Internet',
    icon:      'Wifi',
    unit:      'Mbps',
    color:     '#8B5CF6',
    is_custom: 0,
  },
  {
    id:        'ut-rent',
    name:      'Rent',
    icon:      'Home',
    unit:      'month',
    color:     '#10B981',
    is_custom: 0,
  },
] as const;

// ─── Migration ────────────────────────────────────────────────────────────────

export async function up(db: SQLiteDatabase): Promise<void> {
  // Create tables
  await db.execAsync(utilityTypesSchema);
  await db.execAsync(utilityLogsSchema);

  // Create indexes
  for (const index of utilityTypesIndexes) {
    await db.execAsync(index);
  }
  for (const index of utilityLogsIndexes) {
    await db.execAsync(index);
  }

  // Seed default utility types — INSERT OR IGNORE is idempotent
  const seedTime = new Date().toISOString();
  for (const seed of SEED_UTILITY_TYPES) {
    await db.runAsync(
      `INSERT OR IGNORE INTO utility_types
         (id, name, icon, unit, color, is_custom, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [seed.id, seed.name, seed.icon, seed.unit, seed.color, seed.is_custom, seedTime],
    );
  }
}

export async function down(db: SQLiteDatabase): Promise<void> {
  // Drop child table first to respect the FK constraint
  await db.execAsync('DROP TABLE IF EXISTS utility_logs;');
  await db.execAsync('DROP TABLE IF EXISTS utility_types;');
}
