---
name: SQLite JOIN column alias drift
description: When a JOIN query selects aliased columns (e.g. rm.is_synced AS rm_is_synced), the alias in the SQL must match exactly what is read in the mapping code — and the column name in the SQL must match the actual schema column, not a field that was renamed or removed.
type: feedback
---

When writing JOIN queries that alias columns from joined tables, two things must be consistent:

1. The SQL column name must match the actual schema (e.g., `rm.is_synced`, NOT `rm.synced_at` if the column is named `is_synced`).
2. The alias used in the SELECT must match what the mapping code reads via the `Record<string, T>` cast pattern.

In `raw_materials.repository.ts` / `getRawMaterialsByProduct`, the original code had:
```sql
rm.synced_at AS rm_synced_at
```
But the `raw_materials` schema column is `is_synced`, not `synced_at`. This causes a runtime SQLite "no such column" crash.

Additionally, the inline `RawMaterial` object built from JOIN results must include ALL required fields. The `isSynced: boolean` field (required) was missing, which is a TypeScript compile error. It must be mapped from the aliased `rm_is_synced` column.

**Why:** The schema column `is_synced` was named differently from what the join query referenced, causing a hard runtime crash.

**How to apply:** When adding columns to a JOIN query, always cross-reference the schema file to confirm the exact column names, and ensure every non-optional field in the domain type is populated in the inline object literal.
