---
name: Post-Save Side Effect Isolation
description: markPaid and summary reload after upsertLog must each have their own try/catch; an error in either must not surface as "failed to save entry"
type: feedback
---

When a screen's `handleSave` chains multiple async operations after a successful upsert (`upsertLog` → `markPaid` → `loadMonthlySummary`), each post-save operation must be wrapped in its own try/catch. If `markPaid` or `loadMonthlySummary` throws and the outer `handleSave` has no wrapping try/catch, the error propagates to the sheet's generic catch block which shows "Failed to save entry" — even though the entry was already saved.

**Why:** `store.upsertLog` re-throws on failure (correct). `store.markPaid` does not have a try/catch internally and also throws on DB failure. When the screen's `handleSave` awaits both in sequence without isolation, a markPaid failure is indistinguishable from a save failure at the sheet level.

**How to apply:**
- `upsertLog(payload)` — let this throw; the sheet catches it and keeps the form open for retry.
- `markPaid(saved.id)` — wrap in its own try/catch; on failure show `Alert.alert('Warning', ...)` with "Entry saved but could not mark as paid: …" and still allow the sheet to close (entry is saved).
- `loadMonthlySummary` — wrap in its own try/catch and swallow the error silently; it is a non-critical cache refresh.
