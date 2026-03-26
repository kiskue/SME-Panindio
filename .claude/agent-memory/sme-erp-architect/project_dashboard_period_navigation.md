---
name: Dashboard Period Navigation
description: Architecture for the navigable period selector upgrade — DashboardPeriodState, anchor normalisation, goToPrev/goToNext store actions, repository signature changes.
type: project
---

`selectedPeriod: DashboardPeriod` replaced by `periodState: DashboardPeriodState` in the dashboard store. `DashboardPeriodState = { type: DashboardPeriod; anchor: string }` where anchor is a canonical YYYY-MM-DD.

**Why:** The old design always queried "now", so users couldn't view historical periods. ERP dashboards require backward navigation (QuickBooks/Odoo pattern).

**How to apply:** Any code that reads the dashboard period must use `periodState.type` for the pill-tab and `kpis.periodLabel` (from repository) for the display string. Never recompute the label in screen components.

## Key design decisions

- **Anchor = single YYYY-MM-DD string**, always normalised to period start:
  - day → the day itself
  - week → Monday of the ISO week
  - month → 1st of the month
  - year → Jan 1 of the year
- **No future navigation**: `canGoNext` is false when `anchor === currentAnchor(type)`. `goToNext` is a no-op in that case. The "next" arrow is visually dimmed at `opacity: 0.28`.
- **Earliest allowed period**: no hard floor enforced in code — business has data from whatever date records exist. SQLite queries simply return zero aggregates for empty periods.
- **`getPeriodLabel` now takes three args**: `(period, anchorDate, now)`. The `now` argument is used only for the "is current period" check (to produce "Today" / "This Week" etc.). Never pass `anchorDate` as `now`.
- **`DashboardData.period`** field type changed from `DashboardPeriod` to `DashboardPeriodState`. Any code reading `data.period` must treat it as an object.
- **Back-compat alias**: `selectDashboardPeriod` still exported as alias for `selectDashboardPeriodType` to avoid breaking any existing selector imports.

## Store actions

| Action | Behaviour |
|--------|-----------|
| `setPeriod(type)` | Resets anchor to current period of that type + loads |
| `goToPrev()` | Shifts anchor -1 unit + loads |
| `goToNext()` | Shifts anchor +1 unit + loads; no-op if already current period |
| `refreshDashboard()` | Reloads current periodState |
| `loadDashboard(periodState)` | Internal — sets state, calls repository |

## PeriodSelector molecule

Added optional navigator chrome props: `periodLabel`, `onPrev`, `onNext`, `canGoNext`. All four must be provided together to activate navigator mode. When present, a `< label >` row renders below the pills. Backward-compatible: existing callers without nav props still work identically.

## Files changed

- `src/types/dashboard.types.ts` — added `DashboardPeriodState` type, changed `DashboardData.period` field type
- `src/types/index.ts` — added `DashboardPeriodState` to barrel export
- `database/repositories/dashboard.repository.ts` — `getDashboardData` now accepts `DashboardPeriodState`; `getPeriodBounds`, `buildSubIntervals`, `queryUtilitiesKPI` all use `anchorDate` parameter; `getPeriodLabel` takes `(period, anchorDate, now)`
- `src/store/dashboard.store.ts` — full rewrite: `periodState` replaces `selectedPeriod`, added `canGoNext`, `goToPrev`, `goToNext`, anchor normalisation helpers
- `src/store/index.ts` — exports `selectDashboardPeriodType`, `selectDashboardPeriodState`, `selectDashboardCanGoNext`
- `src/components/molecules/PeriodSelector/PeriodSelector.tsx` — added navigator chrome
- `src/app/(app)/(tabs)/index.tsx` — wired `goToPrev`/`goToNext`/`canGoNext`, removed `formatPeriodDescription`, fade keyed on `periodState` object instead of `period` string
