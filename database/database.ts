/**
 * database.ts
 *
 * Expo SQLite connection singleton.
 * Opens (or creates) the app database once and returns the same instance
 * on every subsequent call. This prevents multiple file handles and
 * WAL-mode conflicts across the lifetime of the app process.
 *
 * Usage:
 *   import { getDatabase } from '@/database/database';
 *   const db = await getDatabase();
 */

import * as SQLite from 'expo-sqlite';

const DB_NAME = 'sme_panindio.db';

let _db: SQLite.SQLiteDatabase | null = null;

/**
 * Returns the singleton SQLiteDatabase instance, opening it on first call.
 * Safe to call concurrently — the module-level guard ensures only one open
 * call is ever issued.
 */
export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (_db !== null) {
    return _db;
  }

  _db = await SQLite.openDatabaseAsync(DB_NAME, {
    useNewConnection: false,
  });

  // Enable WAL mode for better concurrent read performance on mobile.
  await _db.execAsync('PRAGMA journal_mode = WAL;');
  await _db.execAsync('PRAGMA foreign_keys = ON;');

  return _db;
}
