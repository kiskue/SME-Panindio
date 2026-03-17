---
name: Zustand Derived Selector New Reference Infinite Loop
description: Calling a Zustand selector that runs .filter()/.map() directly as a naked useStore(selector) call causes a useSyncExternalStore infinite loop whenever a filter is active, because each call returns a new array reference.
type: feedback
---

Never call a derived Zustand selector that can return a new array (via `.filter()`, `.map()`, etc.) as a naked `useStore(selector)` subscription. Zustand's `useSyncExternalStore` compares the previous snapshot to the new one with strict `===`; a new array reference on every call = infinite loop.

**Why:** `selectFilteredRawMaterials` in `raw_materials.store.ts` calls `.filter()` whenever `searchQuery` or `selectedCategory` is non-default. When used as `useRawMaterialsStore(selectFilteredRawMaterials)` in the list screen, every render produces a new array, React schedules another re-render, and the cycle repeats until "Maximum update depth exceeded" crashes the app.

**How to apply:**
- Subscribe only to the stable source array and primitive filter state separately (each returns a stable primitive or the stored array reference unchanged).
- Put the `.filter()` call inside a `useMemo` keyed on those stable values.
- If you must use a derived selector directly as a Zustand subscription, wrap it with `useShallow` from `zustand/react/shallow` — it does element-by-element comparison and breaks the loop.
- The `selectFilteredRawMaterials` export in `raw_materials.store.ts` has an expanded JSDoc warning block that documents this constraint. Follow the same pattern for any new derived selectors added to this codebase.

Pattern applied in: `src/app/(app)/(tabs)/inventory/raw-materials/index.tsx`
