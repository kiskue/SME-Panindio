---
name: bottom-sheet-migration
description: @gorhom/bottom-sheet migration details — patterns, API, and per-file locations
type: project
---

## @gorhom/bottom-sheet Migration (completed)

### Version
`@gorhom/bottom-sheet` v5.2.8 — supports `react-native-reanimated >= 3.16.0 || >= 4.0.0-`
Project uses reanimated v4.1.6 — fully compatible.

### Root Layout Provider (REQUIRED)
`src/app/_layout.tsx` — `BottomSheetModalProvider` added inside `GestureHandlerRootView > SafeAreaProvider > ThemeProvider`, wrapping the `Stack` navigator:
```tsx
<GestureHandlerRootView>
  <SafeAreaProvider>
    <ThemeProvider>
      <BottomSheetModalProvider>
        <Stack>...</Stack>
      </BottomSheetModalProvider>
    </ThemeProvider>
  </SafeAreaProvider>
</GestureHandlerRootView>
```
`GestureHandlerRootView` was already present before migration.

### BottomSheet Organism — new API
`src/components/organisms/BottomSheet.tsx`
- Uses `BottomSheetModal` (programmatic) + `BottomSheetBackdrop` + `BottomSheetView`/`BottomSheetScrollView`
- Exposes `BottomSheetHandle` via `forwardRef`: `{ present(), dismiss() }`
- Still accepts `visible` + `onClose` props for controlled usage (synced to imperative API in `useEffect`)
- `SnapPoint` type: `'25%' | '50%' | '75%' | '90%'` (unchanged)
- Story file updated to use `useRef<BottomSheetHandle>` + `ref.current?.present()`

### ManualEntryBottomSheet — migrated
`src/components/organisms/ManualEntryBottomSheet.tsx`
- Uses `BottomSheetModal` + `BottomSheetScrollView` directly (not via the BottomSheet wrapper)
- Exports new `ManualEntryBottomSheetHandle` type (`{ present, dismiss }`) from organisms index
- `IngredientPicker` sub-component INTENTIONALLY kept as plain RN `Modal` (nested picker, not a sheet)
- snapPoints: `['88%']`

### Inline Sheet Components — all migrated
Each screen had its own private slide-up sheet built with `Modal` + `Animated`. All migrated to `BottomSheetModal`:
- `pos.tsx` → `CheckoutSheet` — snapPoints `['88%']`
- `utilities.tsx` → `AddEditBottomSheet` — snapPoints `['85%']`
- `overhead.tsx` → `LogExpenseSheet` — snapPoints `['92%']`
- `credit.tsx` → `AddCustomerSheet` — snapPoints `['75%']`
- `credit/[id].tsx` → `RecordPaymentSheet` — snapPoints `['80%']`

### Migration Pattern (applied to each inline sheet)
1. Remove `Modal`, `KeyboardAvoidingView`, `Platform`, `Animated`, `Dimensions`, `SCREEN_HEIGHT` references
2. Add `BottomSheetModal`, `BottomSheetScrollView`/`BottomSheetView`, `BottomSheetBackdrop` imports from `@gorhom/bottom-sheet`
3. Replace `const slideAnim = useRef(new Animated.Value(N)).current` with `const modalRef = useRef<BottomSheetModalRef>(null)`
4. Replace `Animated.spring/timing` effect with `modalRef.current?.present()` / `modalRef.current?.dismiss()`
5. Replace `<Modal>` + `<KAV>` + `<Pressable backdrop>` + `<Animated.View>` with `<BottomSheetModal>` + header outside scroll + `<BottomSheetScrollView>`
6. Replace `<SafeAreaView edges={['bottom']}>` with `useSafeAreaInsets()` and `paddingBottom: Math.max(insets.bottom, spacing.md)` on footer
7. Add `renderBackdrop` via `useCallback` returning `<BottomSheetBackdrop appearsOnIndex={0} disappearsOnIndex={-1} />`
8. Add `backgroundStyle`, `handleIndicatorStyle`, `snapPoints` as memoized values
9. Set `enablePanDownToClose`, `keyboardBehavior="interactive"`, `keyboardBlurBehavior="restore"`, `android_keyboardInputMode="adjustResize"`
10. Remove obsolete styles: `overlay`, `backdrop`, `sheet` (position:absolute), `sheetInner`, `handle` from StyleSheet.create

### StockAdjustModal & GenericPickerModal
NOT migrated — these are centered dialog-style modals (not slide-up sheets). Keep as plain RN `Modal`.

### Safe Footer Pattern (bottom inset)
```tsx
const insets = useSafeAreaInsets();
// In footer View style:
paddingBottom: Math.max(insets.bottom, staticTheme.spacing.md)
```
Never hardcode `paddingBottom: 24` — use insets so notch phones get proper spacing.

### Why: Benefits over old Modal+Animated pattern
- Native gesture-driven dismissal (swipe down) for free
- Proper keyboard avoidance built in (`keyboardBehavior="interactive"`)
- Consistent backdrop, handle indicator, and spring animation out of the box
- No frame-drop risk from JS-driven animation during open/close
