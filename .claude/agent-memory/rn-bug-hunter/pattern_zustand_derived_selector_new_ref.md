---
name: Zustand Derived Selector New Reference Infinite Loop
description: Any Zustand selector that returns a new object or array reference on every call causes a useSyncExternalStore infinite loop — covers .filter()/.map() selectors AND object-literal selectors.
type: feedback
---

Never use a Zustand selector that can return a new object or array reference on every call as a naked `useStore(selector)` subscription. Zustand's `useSyncExternalStore` compares the previous snapshot to the new one with strict `===`; a new reference on every call = render → selector runs → new reference → re-render → infinite loop → "Maximum update depth exceeded".

**Two common shapes of this bug:**

1. **Array-returning selector** — a selector that calls `.filter()` or `.map()`:
   ```ts
   // BAD
   const items = useRawMaterialsStore(selectFilteredRawMaterials); // .filter() inside
   ```

2. **Object-literal selector** — a named exported selector that constructs `=> ({ ... })`:
   ```ts
   // BAD — selectBusinessROI returns `=> ({ totalInventoryValue: s.x, netProfit: s.y, ... })`
   const businessROI = useBusinessROIStore(selectBusinessROI);
   ```
   Every call produces a brand-new object, even when all field values are identical.

**Why:**
- `selectFilteredRawMaterials` in `raw_materials.store.ts` calls `.filter()` (array shape).
- `selectBusinessROI` in `business_roi.store.ts` constructs `=> ({ ... })` (object shape). Used in `breakeven.tsx`, it caused a crash-on-mount infinite loop.

**How to apply:**
- Select only the **primitive(s) you actually need**: `useBusinessROIStore(s => s.netProfit)`.
- If you need multiple fields, select each as a separate primitive subscription or use `useShallow` from `zustand/react/shallow` for an element-wise comparison.
- Put any `.filter()` / `.map()` call inside a `useMemo` keyed on the stable source array.
- Treat every exported selector whose implementation is `=> ({ ... })` as a potential loop source — do not use it directly as a Zustand subscription without `useShallow`.

3. **Inline store object rebuilt on every write** — a store action that calls `set({ progress: { daily: {...}, weekly: {...}, monthly: {...} } })` on every fetch produces a new `progress` object reference even when all field values are numerically identical. Any selector that returns this object directly (e.g. `selectSalesTargetProgress = s => s.progress`) will trigger the loop.
   ```ts
   // BAD — returns nested object rebuilt on every loadProgress() call
   const progress = useSalesTargetStore(selectSalesTargetProgress);
   // GOOD — useShallow does element-wise comparison on the three sub-objects
   const progress = useSalesTargetStore(
     useShallow((s) => ({ daily: s.progress.daily, weekly: s.progress.weekly, monthly: s.progress.monthly })),
   );
   ```

**Why:**
- `selectFilteredRawMaterials` in `raw_materials.store.ts` calls `.filter()` (array shape).
- `selectBusinessROI` in `business_roi.store.ts` constructs `=> ({ ... })` (object shape). Used in `breakeven.tsx`, it caused a crash-on-mount infinite loop.
- `selectSalesTargetProgress` in `sales_target.store.ts` returns `s.progress` — a nested object that `loadProgress()` unconditionally rebuilds on every call. Used in `SalesTargetCard.tsx`, it caused a "Maximum update depth exceeded" crash on dashboard mount.

**How to apply:**
- Select only the **primitive(s) you actually need**: `useBusinessROIStore(s => s.netProfit)`.
- If you need multiple fields, select each as a separate primitive subscription or use `useShallow` from `zustand/react/shallow` for an element-wise comparison.
- Put any `.filter()` / `.map()` call inside a `useMemo` keyed on the stable source array.
- Treat every exported selector whose implementation is `=> ({ ... })` or `=> s.nestedObject` as a potential loop source — do not use it directly as a Zustand subscription without `useShallow`.
- Any store action that unconditionally writes a new inline object literal (`set({ progress: { ... } })`) on every call is inherently unsafe to subscribe to without `useShallow`.

Patterns applied in:
- `src/app/(app)/(tabs)/inventory/raw-materials/index.tsx` (array shape)
- `src/app/(app)/(tabs)/breakeven.tsx` (object-literal selector shape)
- `src/components/organisms/SalesTargetCard.tsx` (nested object rebuilt on every store write)
