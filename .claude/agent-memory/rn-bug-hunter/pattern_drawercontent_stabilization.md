---
name: Drawer drawerContent Prop Must Be Stable
description: drawerContent={(props) => <AppDrawer {...props} />} creates a new function on every TabsLayout render, forcing the Drawer to treat AppDrawer as a new component and remount it. Always stabilize with useCallback([], []).
type: feedback
---

In `src/app/(app)/(tabs)/_layout.tsx` the `drawerContent` prop of the `<Drawer>` navigator must be a stable function reference.

An inline arrow `(props) => <AppDrawer {...props} />` creates a new function object on every render of `TabsLayout` (which re-renders on every pathname change because `CustomHeader` calls `usePathname()`). The Drawer navigator uses referential equality to detect content changes, so every new function causes it to unmount and remount the entire `AppDrawer` — wiping all scroll position and local state inside the drawer.

**Fix:** Extract with `useCallback([], [])`:

```tsx
const renderDrawer = useCallback(
  (props: DrawerContentComponentProps) => <AppDrawer {...props} />,
  [],
);
// ...
<Drawer drawerContent={renderDrawer} ...>
```

The empty dep array is correct because `AppDrawer` reads everything it needs from stores and context internally — it does not depend on any value in `TabsLayout`'s closure.
