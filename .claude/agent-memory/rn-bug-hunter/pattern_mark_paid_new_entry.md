---
name: Mark Paid on New Entry Pattern
description: When upsert+markPaid are chained in handleSave, use the returned UtilityLog id — not editingLog.id — or the paid flag is silently skipped for new entries
type: feedback
---

Never use `editingLog.id` as the target for `markPaid` when both a new entry and an edit flow share the same `handleSave`. `editingLog` is `null` for new entries, so the `if (markAsPaid && editingLog !== null)` guard silently skips marking paid every time the user adds a new entry.

**Why:** `upsertLog` returns the persisted `UtilityLog` including its `id` (freshly generated for inserts, preserved for updates). That is the authoritative id to pass to `markPaid`.

**How to apply:** In any `handleSave` that calls `upsertLog` followed by an optional `markPaid`, always pattern as:
```ts
const saved = await store.upsertLog(payload);
if (markAsPaid) {
  await store.markPaid(saved.id);
}
```
