---
name: Store Initialization Pattern
description: Every new Zustand store bootstrap function must be registered in initializeStores() — omitting it causes empty screens on first mount
type: feedback
---

Every Zustand store that exposes an `initialize*()` bootstrap function **must** be added to the `initializeStores()` call in `src/store/index.ts`.

**Why:** `initDatabase()` is awaited before `initializeStores()` in `src/app/_layout.tsx`. Stores registered inside `initializeStores` are therefore guaranteed to run after all SQLite migrations are applied. A store that is NOT registered there will only initialize when its screen first mounts — creating a race where the screen renders before the DB is ready, or showing a flash of empty data on every cold mount.

**How to apply:** When adding a new store file with a `initialize*` function, immediately add it to the `Promise.all([...])` inside `initializeStores()` and add the import at the top of `src/store/index.ts`. Do not leave it to the screen's `useEffect` as the sole bootstrap path.

Discovered while debugging: `initializeIngredientConsumption` was exported but never registered, causing the Consumption Logs screen to always show empty on initial load.
