---
name: Fabric viewState Crash on Theme Toggle — Definitive rAF-deferral Fix
description: "Unable to find viewState for tag X" on theme toggle is caused by two concurrent Zustand subscriptions (ThemeProvider + RootLayout) pushing context/prop updates synchronously in the same frame as a Fabric surface teardown. Fix: rAF-deferred context commit in ThemeProvider + remove the RootLayout Zustand subscription.
type: feedback
---

## History of attempts

### Attempt 1: InteractionManager + Appearance.setColorScheme
- ThemeProvider used `useColorScheme()` driven by `Appearance.setColorScheme()`.
- AppDrawer wrapped `toggleMode()` in `InteractionManager.runAfterInteractions()`.
- **Still crashed** — `InteractionManager` drains after animations complete on the JS thread,
  but does not await the Fabric surface decommit, which is a separate async operation driven
  by the native thread. The two queues are not synchronized.

### Attempt 2: setTimeout(400) after closeDrawer()
- AppDrawer called `navigation.closeDrawer()` then fired `toggleMode()` after 400 ms.
- **Still crashed** — `setTimeout` is a JS event-loop timer with no relationship to when
  Fabric finishes tearing down a surface. On a busy JS thread or slow device, the 400 ms
  window fires before the native Fabric decommit completes. Additionally, `RootLayout`
  subscribed to `useThemeStore(selectThemeMode)` to drive `StatusBar`, creating a second
  synchronous Zustand listener that pushed a native prop update outside the deferred window.

## Root cause (precise)

Two independent Zustand subscribers fire simultaneously when `toggleMode()` is called:

1. **ThemeProvider** — re-renders, produces new `Theme` object, publishes new `ThemeContext`
   value. Every `useAppTheme()` consumer (including `AppDrawer`) re-renders and writes new
   native props to their Fabric nodes. If the drawer surface is still mid-teardown, those nodes
   no longer have a valid `viewState` — crash.

2. **RootLayout** — re-renders, passes a new `style` prop to `<StatusBar>`. Same problem: the
   StatusBar Fabric node gets a prop update in the same commit batch as the teardown.

`drawerType: 'front'` keeps `AppDrawer` **mounted even when the drawer is closed**. This means
drawer Fabric nodes remain live during the close animation and can still receive (and crash on)
re-render-driven prop updates.

### Attempt 3 (REGRESSION): useMemo
- ThemeProvider used `useMemo(() => getTheme(mode), [mode])` to compute the theme synchronously.
- **Still crashes** — `useMemo` runs during the render triggered by Zustand, which is synchronous.
  Context propagation to consumers fires in the same commit, not the next frame. The race
  between Fabric surface teardown and the commit-time prop update is NOT resolved.

## Correct Fix (implemented 2026-04-14, re-confirmed 2026-04-14)

### ThemeProvider.tsx — rAF-deferred context propagation

`ThemeProvider` now maintains two values:
- `storeMode` — the raw Zustand value (may change at any moment, used only to schedule work).
- `committedMode` — the value actually provided via `ThemeContext`, updated only inside a
  `requestAnimationFrame` callback.

A `useEffect([storeMode])` schedules a rAF each time the store changes. The rAF fires at the
start of the next frame. Fabric flushes its commit queue at the END of each frame — so by the
time any rAF fires, all Fabric work from the previous frame (including surface teardown) is
complete. No viewState is ever locked when `setCommittedMode` triggers the context re-render.

A `storeModeRef` mirrors `storeMode` to avoid stale closures in the rAF callback. The rAF
handle is stored in `rafRef` and cancelled in the effect cleanup to handle rapid toggles and
unmount correctly.

**Key invariant:** Fabric surfaces are torn down in the frame that their parent component
unmounts. The rAF fires in the NEXT frame. Therefore context propagation always arrives one
frame after the surface teardown — they can never be in the same commit.

### _layout.tsx (RootLayout) — removed Zustand subscription

Removed `useThemeStore(selectThemeMode)` and the direct `<StatusBar>` usage from `RootLayout`.
`RootLayout` now has no theme subscriptions at all, so it never re-renders on toggle.

### ThemedStatusBar.tsx — new component inside ThemeProvider

A tiny `ThemedStatusBar` component reads the status bar style from `useAppTheme()` (which reads
`ThemeContext`, not Zustand). Because it is rendered inside `ThemeProvider`, it receives the
rAF-deferred `committedMode` value automatically. No direct Zustand subscription, no race.

## Pattern rule

**Any component that converts a Zustand store change into a native prop update (including
context consumers inside Drawer/Modal/Stack navigators) must buffer the update by one rAF.**

The canonical pattern:

```tsx
// ThemeProvider.tsx
const storeMode = useThemeStore(selectThemeMode);
const [committedMode, setCommittedMode] = useState<ThemeMode>(storeMode);
const storeModeRef = useRef<ThemeMode>(storeMode);
storeModeRef.current = storeMode;
const rafRef = useRef<ReturnType<typeof requestAnimationFrame> | null>(null);

useEffect(() => {
  if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
  rafRef.current = requestAnimationFrame(() => {
    rafRef.current = null;
    setCommittedMode(storeModeRef.current);
  });
  return () => {
    if (rafRef.current !== null) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
  };
}, [storeMode]);
```

**Never** subscribe to `useThemeStore` in a component that sits OUTSIDE `ThemeProvider` in the
tree (e.g. `RootLayout`) if that subscription drives any native prop. Use `ThemeContext` instead
so the rAF deferral applies automatically.

## Files changed
- `src/core/theme/ThemeProvider.tsx` — rAF deferral added
- `src/app/_layout.tsx` — Zustand subscription removed, ThemedStatusBar substituted
- `src/core/theme/ThemedStatusBar.tsx` — new component (context-driven StatusBar)
