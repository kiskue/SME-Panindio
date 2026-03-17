---
name: Expo SQLite Empty Params Array Causes prepareAsync Rejection
description: Passing an empty array [] as the params argument to getAllAsync/getFirstAsync on a no-parameter SQL statement causes "NativeDatabase.prepareAsync has been rejected" on the Expo SQLite v14 native module (Expo SDK 54).
type: feedback
---

Never pass an empty array `[]` as the second argument to `db.getAllAsync` or `db.getFirstAsync` when the SQL statement has no `?` bind parameters. The Expo SQLite v14 native module (bundled with Expo SDK 54 / React Native 0.81) routes the two-argument call through the `prepareAsync` + `bindAsync` path. When `bindAsync` is called on a statement with zero markers, the native layer throws "NativeDatabase.prepareAsync has been rejected".

**Why:** The single-argument overload (`db.getAllAsync(sql)`) skips the bind step entirely. The two-argument overload always goes through `prepareAsync → bindAsync`, and binding zero params to a param-less statement triggers the rejection on the Android SQLite native module path.

**How to apply:** Any `getAllAsync` or `getFirstAsync` call whose SQL has no `?` markers must omit the second argument entirely:

```ts
// WRONG — causes prepareAsync rejection
const rows = await db.getAllAsync<T>(sql, []);

// CORRECT
const rows = await db.getAllAsync<T>(sql);
```

Grep for `getAllAsync.*\[\]` or `getFirstAsync.*\[\]` after adding a new repository to catch violations early. The bug was first caught in `database/repositories/raw_materials.repository.ts` in the `getAllRawMaterials` and `getLowStockRawMaterials` functions.
