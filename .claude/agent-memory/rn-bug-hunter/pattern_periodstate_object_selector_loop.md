---
name: PeriodState Object Selector Infinite Loop
description: Subscribing to a Zustand selector that returns a plain object re-allocated on every store write causes useSyncExternalStore to loop infinitely — split into primitive selectors and reconstruct with useMemo.
type: feedback
---

Subscribing to `useDashboardStore(selectDashboardPeriodState)` where `selectDashboardPeriodState` returns `s.periodState` — a plain `{ type, anchor }` object — causes an infinite re-render loop.

Every call to `loadDashboard` runs `set({ periodState: state, ... })` with a freshly constructed object. Even when `type` and `anchor` strings are identical, `Object.is` fails on the new reference. `useSyncExternalStore` (Zustand's subscription mechanism) interprets this as a changed snapshot on every render and schedules another render, causing the "Maximum update depth exceeded" crash.

**Fix applied:**
1. Added `selectDashboardPeriodAnchor = (s) => s.periodState.anchor` — a primitive string selector.
2. In the consuming component, subscribe to `selectDashboardPeriod` (type) and `selectDashboardPeriodAnchor` (anchor) as separate primitives.
3. Reconstruct the object with `useMemo(() => ({ type: period, anchor: periodAnchor }), [period, periodAnchor])`.

The `useMemo` result is only a new object reference when `type` or `anchor` actually changes — not on every render. The `useEffect([periodState, fadeAnim])` that drives the fade animation now fires correctly.

**Why:** `useSyncExternalStore` uses `Object.is` to compare selector snapshots between renders. Any selector returning a new object/array literal — even with identical primitive values — will always appear changed.

**How to apply:** Any time a Zustand selector returns an object that is re-created on each `set(...)` call (e.g. a nested config object, a filter state, a period descriptor), split it into primitive selectors and compose the object in the component with `useMemo`. The `useShallow` alternative works too, but `useMemo` is preferred when the object is used as a `useEffect` dependency to avoid stale closure issues.
