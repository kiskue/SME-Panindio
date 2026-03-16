---
name: useState sentinel + fallback effect for late-hydrating store data
description: When a useState initialiser reads from a Zustand store that may still be hydrating, use '' as a sentinel and add a fallback useEffect that backfills the value once the store data arrives
type: feedback
---

`useState(() => store.types[0]?.id ?? '')` runs exactly once at component mount. If the store is still hydrating, it produces `''` and stays `''` — no re-render fires from useState when the store later populates.

**Why:** React's `useState` initialiser is only evaluated on the *first* render of that component instance. Subsequent store updates do not re-trigger it.

**How to apply:** Two-effect pattern:
1. Primary `useEffect([editingLog, types, visible])` — handles intentional form resets. Guard with `if (!visible) return` so it only fires on open.
2. Fallback `useEffect([types, visible])` — catches the late-hydration case:
```ts
useEffect(() => {
  if (visible && editingLog === null && form.selectedTypeId === '' && types.length > 0) {
    setForm(prev => ({ ...prev, selectedTypeId: types[0]?.id ?? '' }));
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [types, visible]);
```
The eslint-disable is intentional: `form.selectedTypeId` and `editingLog` are read inside but excluded from deps to prevent the effect from firing on every form keystroke.
