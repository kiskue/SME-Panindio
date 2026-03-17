---
name: getDatabase Concurrent-Open Race
description: getDatabase() needs an in-flight promise guard (_opening) to prevent two concurrent callers from each opening the SQLite file before _db is assigned.
type: feedback
---

`getDatabase()` must guard the async open with both a settled-instance check (`_db !== null`) AND an in-flight promise check (`_opening !== null`).

The original code only had the `_db !== null` guard. Two callers that race before the first `openDatabaseAsync` resolves both see `_db === null`, both enter the open path, and each gets back a different `SQLiteDatabase` instance backed by the same file. Under WAL mode this causes undefined behavior and can trigger `prepareAsync` rejections because one connection's write lock is invisible to the other.

**Why:** Expo SQLite `openDatabaseAsync` with `useNewConnection: false` is meant to return the same logical connection, but calling it twice before the first call resolves still creates two JS-side wrapper objects that each manage their own statement cache.

**How to apply:** Any time `getDatabase` is refactored, ensure the `_opening` promise deduplication pattern is preserved. The fixed pattern:

```ts
let _db: SQLite.SQLiteDatabase | null = null;
let _opening: Promise<SQLite.SQLiteDatabase> | null = null;

export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (_db !== null) return _db;
  if (_opening !== null) return _opening;
  _opening = (async () => {
    const db = await SQLite.openDatabaseAsync(DB_NAME, { useNewConnection: false });
    await db.execAsync('PRAGMA journal_mode = WAL;');
    await db.execAsync('PRAGMA foreign_keys = ON;');
    _db = db;
    _opening = null;
    return db;
  })();
  return _opening;
}
```
