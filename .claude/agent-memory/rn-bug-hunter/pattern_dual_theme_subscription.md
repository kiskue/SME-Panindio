---
name: Dual Theme Subscription Anti-Pattern
description: Components that call both useThemeStore(selectThemeMode) AND useAppTheme() get two separate re-renders per theme toggle. Use context hooks exclusively; reserve useThemeStore for ThemeProvider only.
type: feedback
---

Any component that calls `useThemeStore(selectThemeMode)` AND `useAppTheme()` (or `useThemeMode()`) fires two separate renders on every theme change:

1. The Zustand store subscription fires immediately and synchronously.
2. The context subscription fires after `ThemeProvider` commits the rAF-deferred update (one frame later).

This results in: wasted renders (every subscriber renders twice), and — worse — bypasses the rAF deferral for the store-side render, recreating the Fabric viewState crash for components that live inside a Drawer or Modal surface.

**Rule:** Only `ThemeProvider.tsx` reads from `useThemeStore`. All other components read from context only.

- Use `useThemeMode()` for dark-mode flag only.
- Use `useAppTheme()` for the full theme object.
- Never import `useThemeStore` or `selectThemeMode` in a screen or component — only in `ThemeProvider.tsx`.

**Files that had this violation (fixed 2026-04-14):**
- `src/components/organisms/AIInsightCard.tsx`
- `src/components/organisms/CategoryInventoryScreen.tsx`
- `src/components/molecules/AddInitialStockSheet/index.tsx`
- `src/app/(app)/(tabs)/inventory/index.tsx`
- `src/app/(app)/(tabs)/credit/[id].tsx`

**Why:** `useThemeStore` is a Zustand subscription — it fires synchronously when `toggleMode` is called, before `ThemeProvider` has applied the rAF deferral. `useThemeMode()` / `useAppTheme()` are context hooks — they fire only after the rAF fires, safely after Fabric surface teardown.
