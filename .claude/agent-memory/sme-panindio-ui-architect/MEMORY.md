# SME Panindio UI Architect — Agent Memory

## Quick Reference — Key Files
- Theme: `src/core/theme/index.ts` — `theme` (light), `darkTheme`, `useAppTheme()`, `getTheme(mode)`
- Theme store: `src/store/theme.store.ts` — `useThemeStore`, `selectThemeMode`
- Inventory store: `src/store/inventory.store.ts` — all selectors re-exported from `src/store/index.ts`
- Inventory screens: `src/app/(app)/(tabs)/inventory/` — `index.tsx`, `add.tsx`, `[id].tsx`
- Inventory card: `src/components/organisms/InventoryItemCard.tsx`
- Navigation: `src/app/(app)/(tabs)/_layout.tsx` wraps Stack + TopNavBar + AppDrawer inside DrawerProvider
- Raw Materials screens: `src/app/(app)/(tabs)/inventory/raw-materials/` — `index.tsx`, `add.tsx`, `[id].tsx`
- Raw Materials molecules: `src/components/molecules/RawMaterialCard/`, `StockAdjustModal/`, `RawMaterialPicker/`

## Brand Colors
- Primary navy: `#1E4D8C` → `theme.colors.primary[500]`
- Accent green: `#27AE60` → `theme.colors.accent[500]`
- Highlight amber: `#F5A623` → `theme.colors.highlight[400]`
- Dark neon palette: product `#4F9EFF` | ingredient `#3DD68C` | equipment `#FFB020`
- Dark health: out `#FF6B6B` | low `#FFB020` | healthy `#3DD68C`
- Dark card bg: `#151A27`; glow border: `rgba(accent,0.22)`; left accent bar: 3px

## Critical TypeScript Rules
- `exactOptionalPropertyTypes: true` — NEVER `{ prop: undefined }`; use `...(v !== undefined ? { prop: v } : {})`
- `noUncheckedIndexedAccess: true` — always `?? fallback` on index access
- `noUnusedLocals/Parameters: true` — prefix unused params with `_`
- `theme.colors.primary` is an OBJECT — always `theme.colors.primary[500]`, never `.primary` alone
- `StyleSheet.create()` returns style objects — derive plain strings BEFORE passing as `color` string props

## isDark Detection Pattern
```ts
const mode   = useThemeStore(selectThemeMode);
const isDark = mode === 'dark';
```
NEVER compare `theme.colors.background === '#0F172A'` — TypeScript knows the literal type is always `'#F8F9FA'`.

## Inventory UI Patterns
- `DARK_CATEGORY_CONFIG` / `LIGHT_CATEGORY_CONFIG` records in InventoryItemCard — reuse same structure
- Stock health: `out` (qty=0) → error; `low` (qty<=reorderLevel) → warning; `healthy` → success
- Stock bar fill: `Math.min(1, quantity / (reorderLevel * 3))`
- `formatCurrency`: `₱${value.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`
- `formatDate(iso)`: `new Date(iso).toLocaleDateString('en-PH', { year:'numeric', month:'short', day:'numeric' })`
- `SectionCard` + `SectionHeader` with `iconPill` (28×28, borderRadius 8) for all detail panels
- `InfoRow`: icon (20px fixed) + label (110px fixed) + value (flex 1) — for read-only field display
- `CollapsibleEdit` pattern: accordion wrapping edit form; `ChevronRight` rotates 90° via inline transform

## Navigation + Layout
- No bottom tab bar — TopNavBar (fixed top) + AppDrawer (slide-in left)
- `DrawerContext` in `src/context/DrawerContext.tsx`; `useDrawer()` hook
- AppDrawer `navigate()` uses 50ms `setTimeout` after `onClose()` to let animation settle
- Inventory sub-items call `store.getState().setFilter()` imperatively before `navigate()`
- Screens inside `(tabs)/_layout.tsx`: `edges={['bottom','left','right']}` on `SafeAreaView`
- `StatusBar style`: `isDark ? 'light' : 'dark'` — NOT hardcoded `'light'`

## Store Selectors Available
Auth: `selectCurrentUser`, `selectAuth`, `selectAuthLoading`, `selectAuthError`
Notifications: `selectNotifications`, `selectUnreadNotifications`, `selectNotificationLoading`, `selectNotificationError`, `selectPushToken`
Onboarding: `selectOnboarding`, `selectOnboardingProgress`
Inventory: `selectAllItems`, `selectFilteredItems`, `selectItemById` (factory), `selectItemsByCategory` (factory), `selectProducts`, `selectIngredients`, `selectEquipment`, `selectLowStockItems`, `selectLowStockCount`, `selectInventoryCount`, `selectInventoryLoading`, `selectInventoryError`
Theme: `selectThemeMode`
Ingredient Consumption: `selectConsumptionLogs`, `selectConsumptionSummary`, `selectConsumptionTrend`, `selectConsumptionFilters`, `selectConsumptionHasMore`, `selectConsumptionLoading`, `selectConsumptionLoadingMore`, `selectConsumptionError`, `selectConsumptionTotalCount`

## Ingredient Consumption Log Organisms
- `IngredientConsumptionLogCard`: `src/components/organisms/IngredientConsumptionLogCard.tsx`
  - Exports `triggerColor(trigger, isDark)`, `TriggerIcon`, `TRIGGER_LABELS` — import from organism, not locally
  - Trigger color map: PRODUCTION→primary | MANUAL_ADJUSTMENT→warning | WASTAGE→error | RETURN→success | TRANSFER→info
- `ManualEntryBottomSheet`: `src/components/organisms/ManualEntryBottomSheet.tsx`
  - RHF + Yup; fields: ingredient (picker), quantity, triggerType, notes
  - RETURN trigger stores negative quantityConsumed automatically
  - Button `leftIcon` with conditional value: use `{...(cond ? { leftIcon: <X/> } : {})}` — never pass `undefined`
- `Text` weight valid values: `'light'|'normal'|'medium'|'semibold'|'bold'` — `'regular'` is NOT valid

## Input Atom Dark-Mode Tokens
`src/components/atoms/Input.tsx` owns its own token block (`INPUT_DARK` / `INPUT_LIGHT` constants) — do NOT route through `useAppTheme()`.
- Dark bg: `#1E2435` (outlined) / `#242A3A` (filled) — one step above card surface
- Dark border rest: `rgba(255,255,255,0.12)` | focus: `rgba(255,255,255,0.30)` | error: `theme.colors.error[500]`
- Dark text: `rgba(255,255,255,0.90)` | disabled: `rgba(255,255,255,0.35)`
- Dark placeholder: `rgba(255,255,255,0.35)` — set via `placeholderTextColor` prop (not style)
- Dark label: `rgba(255,255,255,0.60)` | helperText: `rgba(255,255,255,0.40)`
- Light bg: `#F8F9FC` | border: `#E2E8F0` — soft, distinguishable from white card surfaces
- Derive `borderColor` and `textColor` as plain `string` variables BEFORE JSX to satisfy TypeScript strict mode

## Storybook Notes
- Storybook excluded from tsconfig — story files show TS errors in `tsc --noEmit` (expected, ignore)
- Every component needs: Default, Loading, Disabled, Error, WithIcon, DifferentSizes stories

## POS Screen Patterns
- Screen: `src/app/(app)/(tabs)/pos.tsx` — registered as `Drawer.Screen name="pos"` in `_layout.tsx`
- Drawer entry: AppDrawer `navItems` — POS item sits above Inventory, dividerBefore: true, uses `ShoppingCart` icon from lucide + `appTheme.colors.accent[500]`
- Layout: `flexDirection: 'row'` body — `productsPanel` flex:3 + `CartPanel` flex:2 on tablet; phone uses compact sticky footer (CartPanel with `isCompact` prop)
- `useIsTablet()`: `Dimensions.get('window').width >= 768` — used to branch layout and column count
- ProductTile: scale pulse animation via `Animated.sequence` on tap; accentBar (3px left edge); cartBadge overlay shows qty; out-of-stock: opacity 0.5 + overlay text
- Product accent tier: price >= 500 → purple (#A78BFA dark), >= 100 → blue (#4F9EFF dark), else green (#3DD68C dark)
- CartRow: dot (4×36) as product accent color; inline qty stepper; swipe-free trash icon (32×32 tap target)
- CheckoutSheet: Modal + Animated.spring slide-up; payment method grid (2×2); cash tendered + auto change calc; discount % chips (0/5/10/15/20); notes TextInput; success state auto-closes after 1400ms
- `exactOptionalPropertyTypes` pattern for optional string fields: `...(trimmedNotes !== '' ? { notes: trimmedNotes } : {})` — NEVER `notes: undefined`
- FlatList grid: uses padded items array (fills last row) + `numColumns` key prop to force re-mount on breakpoint change
- POS store is a LOCAL STUB in `pos.tsx` (`usePosStoreLocal`) until `pos.store.ts` agent delivers; swap import when ready
- ROUTE_TITLES: `'/pos': 'Point of Sale'` added to `_layout.tsx`

## Utilities Screen Patterns
- Screen: `src/app/(app)/(tabs)/utilities.tsx` — registered as `Drawer.Screen name="utilities"` in `_layout.tsx`
- Drawer entry: AppDrawer `navItems` — Utilities sits between POS and Inventory, uses `Zap` icon + `appTheme.colors.highlight[400]`
- Local stub store `useUtilitiesStoreLocal` in screen file — swap for real store when `utilities.store.ts` lands
- Month navigator: left/right ChevronBtn (40×40 rounded) + centered month/year label
- Summary pills row: 3×flex-1 pills (Total/Paid/Unpaid) with color-coded borders and values
- UtilityCard: 4px left accent bar using `utilityTypeColor`; icon pill (`${color}1A` bg); StatusBadge; action buttons (Check/Trash)
- StatusBadge: Paid=green | Unpaid=amber | Overdue=red with AlertCircle icon
- YearlyTrendChart: pure View bars, `height: percentage` trick, currentMonth bar highlighted amber
- AddEditBottomSheet: `Animated.spring` slide-up; TypePickerChip row; ₱ prefixed amount input; consumption input shows unit; due date text field; Mark as Paid toggle (edit mode only)
- `success[300]` does NOT exist — palette skips 200→400. Use `success[200]` for light borders.
- ROUTE_TITLES: `'/utilities': 'Utilities'` added to `_layout.tsx`

## Dashboard Screen Patterns
- Screen: `src/app/(app)/(tabs)/index.tsx` — ERP home, registered as `Drawer.Screen name="index"` in `_layout.tsx`
- Local stub store `useDashboardStoreLocal` in screen file — bridges `useProductionStore` + `useUtilitiesStore` until `dashboard.store.ts` lands; swap import when ready
- Stub derives: `grossSales = totalCost * 1.4`, `ingredientCost = totalCost`, `utilitiesCost = monthlySummary.total / 30`
- `DashboardPeriod`: `'day' | 'week' | 'month' | 'year'` — period-switch triggers `Animated.sequence` fade (120ms out → 200ms in) on KPI + Orders + Banner sections
- `Skeleton` component: `Animated.loop` opacity 0.4↔1 (800ms each); bg `#2A3347` dark / `gray[200]` light; pulse starts in `useEffect`, stops on cleanup
- `showSkeleton` guard: `isLoading && kpis.grossSales === 0 && trend.length === 0` — avoids re-showing skeleton on refresh when data already exists
- KPI card: 3px left accent bar + 28×28 iconPill (`${accentColor}1A` bg) + label + value; `negative` prop swaps value color to `error[500]`; uses conditional spread `{...(netProfit < 0 ? { negative: true } : {})}`
- `NetProfitBanner`: 3px top bar (green/red) + big ₱ value + inline breakdown "₱X sales − ₱Y ingr − ₱Z util"
- `TrendChart`: pure View bars, two side-by-side bars per data point (sales=green, cost=red), horizontal ScrollView, 80px max height, scales proportionally; empty state shows `BarChart2` icon
- `QuickActions`: 4 buttons (POS/Inventory/Utilities/Reports); Reports disabled with `opacity: 0.4`; `${color}1A` bg + `${color}33` border pattern
- `isTablet`: `Dimensions.get('window').width >= 768` — widens KPI row gap from 12→16
- `formatCurrency`: uses `Math.abs(value)` — caller prepends '-' sign when negative
- `getGreeting()`: hour < 12 = morning, < 18 = afternoon, else evening
- `DARK_ROOT_BG = '#0F0F14'` (slightly darker than card bg `#151A27`) — creates depth between root and cards

## Text Component Valid Variants
ONLY valid variants: `'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' | 'body' | 'body-sm' | 'body-xs' | 'caption'`
- `'body-md'` does NOT exist — use `'body'`
- `'heading-md'` does NOT exist — use `'h3'`
- `'heading-sm'` does NOT exist — use `'h5'`
- `'body-md'` in original raw-materials files was already wrong; fixed to `'body'` during dark mode migration

## Raw Materials UI Dark Mode Patterns
- Category config uses `{ lightBg, darkBg }` instead of single `bg` — both are `color + alpha` in dark
- Dark category alpha for inline icon pills: `rgba(color, 0.15)` format (e.g. `'rgba(99,102,241,0.15)'`)
- Stock health colors dark: healthy `#3DD68C` | low `#FFB020` | critical `#FF6B6B`
- `dynStyles` split from `staticStyles` — `staticStyles` has layout only (no colors), `dynStyles` built in `useMemo([theme, isDark])`
- `StockAdjustModal` REASON_CONFIG: changed static JSX icons to `makeIcon: (color: string) => ReactNode` factory to support dynamic icon color based on selection state
- `RawMaterialPicker` `PickerRow` receives `isDark` prop — avoids calling hooks inside a memoized sub-component
- Danger zone dark bg: `rgba(239,68,68,0.08)` | border: `rgba(239,68,68,0.25)` — keeps red signal without harsh white bg
- Input dark bg: `#1E2435` (same as other form inputs across app — see Input atom token pattern)

## Safe Area + Keyboard Patterns (ALWAYS apply these)
- Screens with custom headers: NEVER use `paddingTop: Platform.OS === 'ios' ? 56 : 24`
  → import `useSafeAreaInsets` from `react-native-safe-area-context`
  → apply `{ paddingTop: insets.top + 12 }` inline on the header View
- Form screen footers: use `{ paddingBottom: Math.max(insets.bottom, staticTheme.spacing.md) }` inline
  → never hardcode `paddingBottom: Platform.OS === 'ios' ? 28 : 12`
- `KeyboardAvoidingView`: ALWAYS `behavior={Platform.OS === 'ios' ? 'padding' : 'height'}`
  → `undefined` on Android does nothing — use `'height'` so fields stay above keyboard
- `ScrollView` with keyboard: put `paddingHorizontal` in `contentContainerStyle`, NOT on `style`
  → `style` on ScrollView affects the scroll container, `contentContainerStyle` affects the inner content
  → getting this wrong causes clipped content on some Android versions

## RawMaterialPicker Two-Row Selection Layout
- When a material is selected, the row expands to show a second row for qty input
- Row layout: `flex column` container → topRow (checkbox + name/meta) → qtyRow (indent spacer + "Qty needed:" + input + unit)
- Indent spacer = `CHECKBOX_SIZE + CHECKBOX_GAP` so qty aligns under the name text, not the checkbox
- `CHECKBOX_SIZE = 24`, `CHECKBOX_GAP = spacing.sm + 2 = 10` → `qtyIndent.width = 34`
- Sheet: `maxHeight: '88%'` + `minHeight: '50%'` — gives enough room on all screen sizes
- Selected count shown as a badge/pill next to the title (not just inline text)
- Done button shows count: "Done — X material(s) selected" vs "Done" when nothing selected

## Touch Target Enforcement
- All action buttons: `minHeight: 44` (buttons) or `minHeight: 52` (primary footer CTAs)
- Back buttons / close buttons: `minWidth: 44, minHeight: 44` with `alignItems`/`justifyContent: 'center'`
- `RawMaterialCard` action buttons: `flex: 1` so they share row evenly + `minHeight: 44`
- Chips / filter pills: `minHeight: 34` is acceptable for secondary UI (not primary actions)

## Raw Materials Premium Redesign Patterns (2026-03-17)
- `RawMaterialCard`: 4px left accent bar (catConf.color) + 40×40 emoji iconPill + status chip + 8px thick progress bar + min marker + cost/value meta row + 2 action btns always visible
- `StockAdjustModal`: preview box shows current→after with delta chip (color-coded) + ArrowRight; confirm btn shows exact action label "Remove 10 pcs" / "Add 10 pcs"; Add active=green `#16A34A`, Remove active stays primary
- `RawMaterialPicker`: trigger btn shows chips for selected materials (uses `sm.rawMaterialName`, NOT `sm.name`); picker modal has category chips + catPill emoji per row; indent spacer now includes catPill width (30 + CHECKBOX_GAP added)
- `SelectedRawMaterial` type fields: `rawMaterialId`, `rawMaterialName`, `quantityRequired`, `unit`, `costPerUnit`, `lineCost` — NO `name` field
- Form screens (add/[id]): ₱ prefix block + unit suffix block attached to TextInput via shared border manipulation (borderTopLeftRadius:0 etc.); live total value preview pill shown when totalValue>0; SectionHeader sub-component with 32×32 iconWrap; category grid is 2-col `flexWrap` with `width:'47%'`+`flexGrow:1`; save btn label includes material name "Save 'Paper Plates'" on add screen
- `[id].tsx` header shows material name + "Unsaved changes" warning when `isDirty`
- Skeleton cards (3 items) shown on first load when `isLoading && rawMaterials.length === 0`; after first load, pull-to-refresh used instead
- `formatValue` shortens to `₱X.Xk` for values >= 1000 in stats row
- Empty state has 88×88 iconWrap (accent bg) + actionable "Add First Material" button

## Detailed Session History
→ See `sessions.md` for per-session change logs and pre-existing error list
