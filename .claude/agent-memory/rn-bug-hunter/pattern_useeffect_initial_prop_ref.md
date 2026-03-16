---
name: useEffect Initial Prop via Ref — Correct Pattern
description: The ref-sync + visibility-effect pattern for seeding a form on modal open is BROKEN. Use prevVisibleRef + include the seed prop in deps instead.
type: feedback
---

**Rule:** When a bottom sheet resets a RHF form on open (`visible` false→true transition), do NOT use a separate no-dep ref-sync effect to track the seed prop. Use `prevVisibleRef` to detect the transition, and include the seed prop directly in the effect's dep array.

**Why the ref-sync approach fails:** React runs `useEffect`s in declaration order within a component. If the visibility effect is declared first and the ref-sync effect is declared second (no deps), the ref-sync effect runs AFTER the visibility effect in the same commit. This means when `visible` becomes `true`, the visibility effect reads `initialTriggerRef.current` which still holds the value from the previous render — i.e., it is stale. The new correct value is written to the ref by the second effect, but that fires too late.

**Why:** This bug caused `ManualEntryBottomSheet` to always open with `MANUAL_ADJUSTMENT` instead of the pre-filled trigger from a selected log card, despite two prior fix attempts. It was a subtle React effect execution-order issue, not a state batching issue.

**The correct pattern — prevVisibleRef transition guard:**

```ts
const prevVisibleRef = useRef(false);

useEffect(() => {
  const wasVisible = prevVisibleRef.current;
  prevVisibleRef.current = visible;

  if (visible && !wasVisible) {
    // Opening: initialTrigger is the current prop value in this render — safe to read directly.
    animateIn();
    reset({ triggerType: initialTrigger ?? 'MANUAL_ADJUSTMENT', ... });
  } else if (!visible && wasVisible) {
    // Closing.
    animateOut();
  }
  // initialTrigger MUST be in deps so the closure captures the correct value.
}, [visible, initialTrigger, animateIn, animateOut, reset]);
```

The `prevVisibleRef` tracks the prior `visible` value so only the false→true edge triggers the reset. Since `initialTrigger` is in the dep array, the closure always has the current value. If `initialTrigger` changes while `visible=true`, the effect fires but the `visible && !wasVisible` guard is false (both are true), so the form is NOT reset under the user's hands.

**How to apply:** Any bottom sheet or modal in this project that seeds a RHF form on open must follow this pattern. Never use the separate no-dep ref-sync effect pattern — it is order-dependent and broken.

**File:** `src/components/organisms/ManualEntryBottomSheet.tsx`
