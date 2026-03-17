---
name: Dashboard Double-Load Anti-Pattern
description: Do not combine a useEffect([period]) with setPeriod() — setPeriod already calls loadDashboard internally, causing a double-fetch race
type: feedback
---

In `dashboard.store.ts`, `setPeriod(p)` sets `selectedPeriod` then immediately calls `loadDashboard(p)`. If the screen also has a `useEffect([period])` that calls `loadDashboard`, every user period-tap fires two concurrent fetches.

**Why:** The second fetch can race the first, producing loading-state flicker and wasted SQLite reads. In tests or slow devices the second fetch can resolve before the first, leaving stale data in state.

**How to apply:** The screen should have exactly ONE `useEffect([], [])` (empty deps) on mount that triggers the initial load. All subsequent loads are triggered by the store actions themselves (setPeriod → loadDashboard, refreshDashboard). Never add a `useEffect([period])` that calls loadDashboard separately when the store action already does it.
