---
name: Gorhom BottomSheet Handle Chrome Occludes First Content Row
description: The @gorhom/bottom-sheet handle container occupies ~24 pt at the top of the sheet; SafeAreaView edges={['bottom']} does NOT compensate for this, so any title or first content row is painted behind the drag indicator.
type: feedback
---

The `BottomSheet.tsx` organism wraps `BottomSheetModal` from `@gorhom/bottom-sheet`. The drag-handle indicator is rendered by the library _above_ the consumer's content tree, inside a `handleStyle` container whose default height is ~24 pt (4 pt indicator + 10 pt paddingTop + 10 pt paddingBottom).

The inner `SafeAreaView` uses `edges={['bottom']}`, which only compensates for the home-indicator inset at the bottom. It does NOT add any top inset. Without an explicit `paddingTop`, the first child of `SafeAreaView` (the sheet header with the title and close button) renders flush to the top of the content area — overlapping the handle chrome.

**Fix:** apply a `paddingTop` to the `SafeAreaView` based on whether the handle is shown:

```ts
const HANDLE_CHROME_HEIGHT = 24; // 4 pt bar + 10 pt above + 10 pt below (gorhom defaults)

safeAreaHandleOffset: { paddingTop: HANDLE_CHROME_HEIGHT }   // showHandle=true
safeAreaNoHandle:     { paddingTop: staticTheme.spacing.sm } // showHandle=false
```

Then on `SafeAreaView`:
```tsx
style={[styles.safeArea, showHandle ? styles.safeAreaHandleOffset : styles.safeAreaNoHandle]}
```

**Why:** gorhom renders its handle container as part of the modal chrome, outside the consumer JSX tree. `SafeAreaView` knows nothing about it.

**How to apply:** Any time the `BottomSheet` organism is modified or a new sheet-level header is added, verify that `paddingTop` on the SafeAreaView is at least `HANDLE_CHROME_HEIGHT` when `showHandle` is true. If the library's handle padding defaults are changed (via `handleStyle`), update `HANDLE_CHROME_HEIGHT` accordingly.

**Never:**
- Assume `SafeAreaView edges={['bottom']}` clears the gorhom handle area.
- Use a `<View style={{ height: X }} />` spacer rendered as a sibling inside the content tree to work around this — the correct fix is `paddingTop` on the `SafeAreaView` itself, keyed off the `showHandle` prop.

Fixed in: `src/components/organisms/BottomSheet.tsx` (2026-03-25).
