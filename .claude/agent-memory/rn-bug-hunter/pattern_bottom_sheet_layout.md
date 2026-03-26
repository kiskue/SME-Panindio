---
name: Bottom Sheet Layout Contract
description: The correct layout for all bottom sheets in this project — absolute-positioned Animated.View with a concrete-pixel maxHeight inside a flex:1 KAV, never percentage strings or justifyContent:'flex-end' on the KAV wrapper.
type: feedback
---

Every bottom sheet in this project (inline and generic BottomSheet.tsx) must follow this layout contract exactly:

```
Modal (transparent, statusBarTranslucent)
  KeyboardAvoidingView (style={{ flex: 1 }}, behavior="padding" on iOS / undefined on Android)
    Pressable (StyleSheet.absoluteFillObject — backdrop, BEFORE Animated.View in tree)
    Animated.View (position:'absolute', bottom:0, left:0, right:0, maxHeight: SCREEN_HEIGHT * 0.88)
      SafeAreaView (edges={['bottom']}, style={{ flex: 1 }})
        View (handle pill)
        View (header row)
        ScrollView (style={{ flex: 1 }}, keyboardShouldPersistTaps="handled")
          View (contentContainerStyle with paddingHorizontal, paddingBottom)
            ...form fields...
        View (footer — save/cancel, NOT inside ScrollView, NOT position:'absolute')
```

**Why — KAV justifyContent:** `justifyContent: 'flex-end'` on the KAV wrapper fights KAV's own padding mechanism on Android. When the keyboard appears, KAV adds padding to its flex container; if that container also has `justifyContent: 'flex-end'`, the sheet double-moves or jumps off-screen. The fix is `position: 'absolute', bottom: 0` on the `Animated.View`.

**Why — percentage maxHeight:** Percentage strings (e.g. `'88%'`, `'90%'`) on `maxHeight` of an absolutely-positioned child inside a `flex:1` KAV inside a Modal resolve to `0` or an indeterminate value on Android. The KAV has no explicit pixel height — it relies on the flex fill of the Modal viewport — so React Native's layout engine cannot resolve the percentage. Always use a concrete pixel value: `const SCREEN_HEIGHT = Dimensions.get('window').height;` at module level, then `maxHeight: SCREEN_HEIGHT * 0.88`.

**How to apply:**
- Add `Dimensions` to the `react-native` import.
- Add `const SCREEN_HEIGHT = Dimensions.get('window').height;` at module level (not inside a component).
- KAV: `style={{ flex: 1 }}`, `behavior={Platform.OS === 'ios' ? 'padding' : undefined}`
- `Animated.View`: `position: 'absolute', bottom: 0, left: 0, right: 0, maxHeight: SCREEN_HEIGHT * 0.88`
- `SafeAreaView`: `edges={['bottom']}`, `style={{ flex: 1 }}`
- `ScrollView`: `style={{ flex: 1 }}`, `keyboardShouldPersistTaps="handled"` — no maxHeight on ScrollView
- Footer (save button): in normal flow inside SafeAreaView, BELOW ScrollView, NOT `position: 'absolute'`
- Backdrop `Pressable`: rendered BEFORE `Animated.View` in JSX tree (so it is visually beneath the sheet)

**Never:**
- `maxHeight: '88%'` or any percentage string — use `SCREEN_HEIGHT * 0.88` always
- `justifyContent: 'flex-end'` on the KAV wrapper
- `behavior="height"` on Android KAV — use `undefined`
- `maxHeight` or explicit `height` on a `ScrollView` (use `flex: 1` instead)
- `position: 'absolute'` on the footer view

Files fixed (2026-03-25, second pass — percentage maxHeight bug):
- `src/app/(app)/(tabs)/overhead.tsx` — LogExpenseSheet: added Dimensions import + SCREEN_HEIGHT, fixed maxHeight '90%' → SCREEN_HEIGHT * 0.88
- `src/app/(app)/(tabs)/pos.tsx` — CheckoutSheet: added SCREEN_HEIGHT at module level, fixed maxHeight '90%' → SCREEN_HEIGHT * 0.88
- `src/app/(app)/(tabs)/utilities.tsx` — AddEditBottomSheet: added Dimensions import + SCREEN_HEIGHT, fixed maxHeight '92%' → SCREEN_HEIGHT * 0.88
- `src/app/(app)/(tabs)/credit.tsx` — AddCustomerSheet: added Dimensions import + SCREEN_HEIGHT, fixed maxHeight '88%' + minHeight '50%' → pixel values
- `src/app/(app)/(tabs)/credit/[id].tsx` — RecordPaymentSheet: added Dimensions import + SCREEN_HEIGHT, fixed maxHeight '88%' + minHeight '50%' → pixel values
