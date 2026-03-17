---
name: Dashboard Not Loaded in initializeStores
description: useDashboardStore.loadDashboard must not be called inside initializeStores — the dashboard screen's mount useEffect owns the first load.
type: feedback
---

`useDashboardStore.getState().loadDashboard(...)` must NOT be included in the `Promise.all` inside `initializeStores()` in `src/store/index.ts`.

The dashboard screen (`src/app/(app)/(tabs)/index.tsx`) has its own `useEffect([], [])` that calls `loadDashboard` on mount. Calling it again in `initializeStores` means two `getDashboardData()` repository calls fire concurrently on every cold start: one from `initializeApp` (before the screen mounts) and one from the screen's `useEffect` (as soon as it mounts). Both set `isLoading: true` sequentially, and whichever resolves second silently overwrites the first result.

**Why:** `initializeStores` is the right place for stores that hold pre-fetched cache that ALL screens might need before they render (inventory, production, utilities). The dashboard data is screen-specific and should be loaded on demand by the screen that uses it.

**How to apply:** When adding a new module store to `initializeStores`, ask: "does this data need to be in memory before any screen renders?" If it's only used in one screen, let that screen own the load.
