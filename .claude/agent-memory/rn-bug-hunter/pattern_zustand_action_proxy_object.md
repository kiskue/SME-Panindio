---
name: Zustand Action Proxy Object Anti-Pattern
description: Grouping Zustand actions into a plain object literal per render makes every useCallback dependency stale on every render
type: feedback
---

This project's screens previously used a pattern like:
```ts
const store = { logs, types, upsertLog, markPaid, deleteLog };
const handleSave = useCallback(async (...) => { await store.upsertLog(...) }, [store, year, month]);
```

The `store` plain object literal is reconstructed on every render (new reference). Any `useCallback` that lists `store` as a dependency is also recreated on every render, defeating memoisation entirely.

**Why:** Zustand actions are stable references (they do not change identity between renders), but wrapping them in an object literal always produces a new object.

**How to apply:** Always extract Zustand actions as individual top-level `const` variables:
```ts
const upsertLog  = useUtilitiesStore((s) => s.upsertLog);
const markPaid   = useUtilitiesStore((s) => s.markPaid);
```
Then list the individual action variables in `useCallback`/`useEffect` dependency arrays. This gives the linter accurate dependency information and keeps callbacks stable across renders.
