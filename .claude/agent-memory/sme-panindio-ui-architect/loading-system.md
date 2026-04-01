---
name: Loading System — Skeleton & Overlay Architecture
description: Documents the modern loading system added across SME Panindio (atoms, molecules, screens)
type: project
---

## Loading System Architecture

### SkeletonBox atom
- Location: `src/components/atoms/SkeletonBox/SkeletonBox.tsx`
- Powered by `react-native-reanimated` (withRepeat + withSequence)
- Exported from `src/components/atoms/index.ts`
- Theme-aware: dark=`#2A3347`, light=`#E5E7EB` (gray[200])
- Props: `width` (DimensionValue), `height` (number), `borderRadius?`, `style?`
- Also exports `SkeletonSpacer` for layout preservation without animation

### LoadingSpinner molecule (modernized)
- Location: `src/components/molecules/LoadingSpinner.tsx`
- Default `variant="dots"` — 3-dot wave using Reanimated (scale + opacity stagger 160ms)
- `variant="ring"` — compact ActivityIndicator for inline/button use
- Sizes: `small` (6px dots) | `large` (10px dots)
- `fullScreen` / `overlay` props for full-screen blocking states
- Dark/light-aware backdrop and card colors

### LoaderOverlay molecule (modernized)
- Location: `src/components/molecules/LoaderOverlay.tsx`
- Props: `visible`, `message?`, `color?` (removed `blurred`, `opacity`)
- Always uses the dot-pulse variant of LoadingSpinner
- Uses `Modal` with `animationType="fade"` + `statusBarTranslucent`
- Dark-aware backdrop: `rgba(10,14,26,0.82)` dark / `rgba(248,249,250,0.82)` light
- Card bg: `#1A2235` dark / `#FFFFFF` light

### Skeleton molecules (new)
- Directory: `src/components/molecules/Skeletons/`
- Barrel: `src/components/molecules/Skeletons/index.ts`
- Components:
  - `CardRowSkeleton` — list card rows with icon pill + text lines + right value
  - `StatCardSkeleton` — 4-up stat tile row (inventory / raw materials)
  - `DashboardSkeleton` — full dashboard layout (period strip + KPIs + banner + chart + quick actions)
  - `FormSkeleton` — section cards with label+input blocks + save button
  - `InventoryListSkeleton` — stat row + category nav strip + search + card rows
- Storybook: `src/components/molecules/Skeletons/Skeletons.stories.tsx`

## Application Pattern

### showSkeleton guard (use everywhere)
```ts
const showSkeleton = isLoading && items.length === 0;
```
Avoids re-showing skeleton on refresh when data already exists.

### Skeleton render pattern (list screens)
```tsx
{showSkeleton && (
  <View style={StyleSheet.absoluteFill}>
    <InventoryListSkeleton />  {/* or CardRowSkeleton */}
  </View>
)}
```

### LoaderOverlay pattern (CRUD mutations)
```tsx
// In the return JSX, after all modals:
<LoaderOverlay visible={isSaving} message="Saving changes…" />
// or for RHF forms:
<LoaderOverlay visible={isSubmitting} message="Saving item…" />
```

### Button loading — no change needed
Button atom already has `loading` prop that shows ActivityIndicator ring. Keep using it.

### Inline footer loaders (paginated lists)
Replace `<ActivityIndicator>` with:
```tsx
<LoadingSpinner size="small" color={accent} variant="dots" />
```

### Old Skeleton replacements
Screens that had hand-rolled Skeleton components using `Animated.loop` pattern:
- `overhead.tsx` — replaced with `SkeletonBox` delegation wrapper
- `credit.tsx` — replaced with `SkeletonBox` delegation wrapper
- `credit/[id].tsx` — replaced with `SkeletonBox` delegation wrapper
- `business-roi.tsx` — replaced with `SkeletonBox` delegation wrapper
- `index.tsx` (dashboard) — replaced with `SkeletonBox` delegation wrapper
- `raw-materials/index.tsx` — replaced with `CardRowSkeleton` molecule (removed hand-rolled SkeletonCard entirely)

### Storybook stories (updated)
- `LoadingSpinner.stories.tsx` — new stories: Default, DifferentSizes, RingVariant, Colors, Overlay, Loading, Disabled, Error
- `LoaderOverlay.stories.tsx` — updated: removed blurred/opacity argTypes, added All Variants
- `Skeletons.stories.tsx` — new file covering all 5 skeleton molecules

## Why: motivation
Pre-existing code used `ActivityIndicator` (grey ring, non-branded) inconsistently across screens with no skeleton loading. The redesign delivers:
1. Consistent 60fps shimmer via Reanimated across all list screens
2. `LoaderOverlay` blocks mutation interactions (form saves, stock adjustments)
3. All `ActivityIndicator` usages in screens replaced — components (Button, IconButton, SearchBar) kept their ring because they're in tight spaces
