---
name: supabase-partial-index-upsert
description: Supabase upsert onConflict does not resolve partial (WHERE-filtered) unique indexes — use INSERT + catch(23505) + UPDATE fallback
metadata:
  type: feedback
---

Supabase PostgREST `upsert({ onConflict: 'col1,col2' })` only works when the named columns have a **non-partial** unique constraint. Partial indexes (i.e. `CREATE UNIQUE INDEX ... WHERE deleted_at IS NULL`) are invisible to the conflict-resolution path.

**Why:** PostgREST translates `onConflict` into a PostgreSQL `ON CONFLICT (col1, col2) DO UPDATE` clause. PostgreSQL requires an exact constraint match for this syntax — a partial index is not a constraint and cannot be targeted by `ON CONFLICT`.

**Consequence in this project:** `online_catalog` has `uq_online_catalog_product_per_business` defined as `(business_owner_id, product_id) WHERE deleted_at IS NULL`. An `upsert` with `onConflict: 'business_owner_id,product_id'` will fail at runtime with a Supabase error because no non-partial unique constraint covers those two columns.

**How to apply:** When the target table uses a partial unique index for soft-delete isolation, replace `upsert` with an INSERT-then-fallback pattern:
1. Attempt `insert(payload).select().single()`.
2. If error code is `'23505'` (unique_violation), fall back to `update(payload).eq(...).is('deleted_at', null).select().single()`.
3. Always filter UPDATE calls with `.is('deleted_at', null)` to target only the active row.

Also: always add `.is('deleted_at', null)` to any `update()` call on soft-delete tables to avoid accidentally patching deleted rows that share the same logical key.

**Related:** [[pattern_zustand_action_proxy_object]]
