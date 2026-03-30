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
- DatePickerField molecule: `src/components/molecules/DatePickerField/` — hybrid text+native picker; see DatePickerField patterns below
- PeriodSelector molecule: `src/components/molecules/PeriodSelector/` — full-width pill tabs for Day/Week/Month/Year; props: `period`, `onSelect`, `isDark`; active=primary[500] fill, inactive=primary[50] light / `#1E2435` dark
- AppDialog molecule: `src/components/molecules/AppDialog/index.tsx` — modal dialog replacing Alert.alert(); use via `useAppDialog` hook
- useAppDialog hook: `src/hooks/useAppDialog.ts` — imperative API: `dialog.show(opts)`, `dialog.confirm(opts)`, `dialog.hide()`, render `{dialog.Dialog}` in JSX
- Hooks barrel: `src/hooks/index.ts` — exports `useAuth`, `useRegistrationSetup`, `useAppDialog`

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
- `Stack.Screen options={{ title }}` has NO EFFECT here — the header is the Drawer's custom `CustomHeader` (TopNavBar)
- To set a title for a new screen: add its normalized path to `ROUTE_TITLES` in `(tabs)/_layout.tsx`
- Dynamic segment title fallback logic in `CustomHeader`: raw-materials paths → `'Edit Material'`; inventory item paths → `'Item Details'`
- `isNestedScreen` regex is `/^\/inventory\/.+/` — any path under `/inventory/` gets a back button instead of hamburger
- NEVER build a custom header View inside a screen that lives under the Drawer — the Drawer already provides one

## Store Selectors Available
Auth: `selectCurrentUser`, `selectAuth`, `selectAuthLoading`, `selectAuthError`
Notifications: `selectNotifications`, `selectUnreadNotifications`, `selectNotificationLoading`, `selectNotificationError`, `selectPushToken`
Onboarding: `selectOnboarding`, `selectOnboardingProgress`
Inventory: `selectAllItems`, `selectFilteredItems`, `selectItemById` (factory), `selectItemsByCategory` (factory), `selectProducts`, `selectIngredients`, `selectEquipment`, `selectLowStockItems`, `selectLowStockCount`, `selectInventoryCount`, `selectInventoryLoading`, `selectInventoryError`
Theme: `selectThemeMode`
Ingredient Consumption: `selectConsumptionLogs`, `selectConsumptionSummary`, `selectConsumptionTrend`, `selectConsumptionFilters`, `selectConsumptionHasMore`, `selectConsumptionLoading`, `selectConsumptionLoadingMore`, `selectConsumptionError`, `selectConsumptionTotalCount`, `selectIngredientWasteCost`
Raw Materials: `selectRawMaterials`, `selectLowStockMaterials`, `selectFilteredRawMaterials`, `selectSelectedMaterial`, `selectRawMaterialsLoading`, `selectRawMaterialsSaving`, `selectRawMaterialsError`, `selectRawMaterialsSearch`, `selectRawMaterialsCategory`, `selectRawMaterialsLowStockCount`, `selectRawMaterialStockValue`
Raw Material Logs: `selectRawMaterialLogs`, `selectRawMaterialLogSummary`, `selectRawMaterialLogTrend`, `selectRawMaterialLogFilters`, `selectRawMaterialLogHasMore`, `selectRawMaterialLogLoading`, `selectRawMaterialLogLoadingMore`, `selectRawMaterialLogError`, `selectRawMaterialLogTotalCount`, `selectRawMaterialWasteCost`
Overhead: `selectOverheadExpenses`, `selectOverheadLoading`, `selectOverheadLoadingMore`, `selectOverheadError`, `selectOverheadTotalCount`, `selectOverheadHasMore`, `selectOverheadFilters`, `selectOverheadSummary`

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
- Screen: `src/app/(app)/(tabs)/utilities.tsx`; local stub store `useUtilitiesStoreLocal` — swap when real store lands
- Month navigator: ChevronBtn (40×40) + centered label; Summary pills: 3×flex-1 (Total/Paid/Unpaid)
- UtilityCard: 4px left accent bar; icon pill `${color}1A` bg; StatusBadge (Paid=green|Unpaid=amber|Overdue=red)
- `success[300]` does NOT exist — palette skips 200→400. Use `success[200]` for light borders.

## Dashboard KPI Type — DashboardKPIs
Fields: `grossSales`, `ingredientCost`, `utilitiesCost`, `netProfit`, `totalOrders`, `totalProductsSold`, `productsMade`, `ingredientWasteCost`, `rawMaterialWasteCost`, `rawMaterialStockValue`, `overheadThisMonth`, `overheadThisYear`, `periodLabel`
- `ingredientWasteCost` / `rawMaterialWasteCost` / `rawMaterialStockValue` are all-time aggregates — NOT period-filtered
- `overheadThisMonth` / `overheadThisYear` defined in type but dashboard screen sources them from `useOverheadExpensesStore(selectOverheadSummary)` directly — NOT from `kpis` object
- `DashboardKPIs` type lives in `src/types/dashboard.types.ts`; `EMPTY_KPIS` in the dashboard screen must include all fields

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
- `QuickActions`: 4 active buttons (POS/Inventory/Utilities/Overhead); `${color}1A` bg + `${color}33` border pattern; `onPressOverhead` prop added (2026-03-19)
- `isTablet`: `Dimensions.get('window').width >= 768` — widens KPI row gap from 12→16
- `formatCurrency`: uses `Math.abs(value)` — caller prepends '-' sign when negative
- `getGreeting()`: hour < 12 = morning, < 18 = afternoon, else evening
- `DARK_ROOT_BG = '#0F0F14'` (slightly darker than card bg `#151A27`) — creates depth between root and cards
- Overhead KPI cards on dashboard use `useOverheadExpensesStore(selectOverheadSummary)` — NOT `kpis.overheadThisMonth/Year`

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


## Raw Materials 2025 Redesign Patterns
→ See `raw-materials-redesign.md` for full detail.
- Card: NO accent bar; 44×44 solid icon; 10px stock bar; dot-separated meta row; `borderRadius:20`
- `CATEGORY_CONFIG`: `{ label, emoji, color }` only — no `lightBg/darkBg`
- List bg: `#0F1117` dark / `#F8FAFC` light; card bg: `#1A2235` dark / `#FFFFFF` light
- `SelectedRawMaterial`: fields `rawMaterialId`, `rawMaterialName`, `quantityRequired`, `unit`, `costPerUnit`, `lineCost` — NO `name`

## Credit Ledger Module ("Utang")
→ See `credit-ledger.md` for full detail.
- Accent: `#7C3AED`; screens `credit.tsx` + `credit/[id].tsx`; stub store pattern

## @gorhom/bottom-sheet Migration
→ See `bottom-sheet-migration.md` for full detail.
- `BottomSheet` organism: `forwardRef<BottomSheetHandle>` + `visible`/`onClose` props
- `SnapPoint` type: `'25%' | '50%' | '60%' | '75%' | '90%'` — '60%' added for period pickers

## Dashboard Period Picker
- Components: `src/components/molecules/PeriodPicker/` — `DayPicker`, `WeekPicker`, `MonthPicker`, `YearPicker` + `index.ts`
- Store: `setAnchor(anchor: string)` action added to `dashboard.store.ts`; exported as `selectDashboardSetAnchor` from `store/index.ts`
- `PeriodSelector`: new `onLabelPress?` prop — renders `ChevronDown` indicator inline with label when provided
- Dashboard screen: `BottomSheet` with `visible` + `onClose` pattern; `pickerSnapPoint` `'75%'` for Day, `'60%'` for others; `scrollable` for Week/Month/Year, non-scrollable for Day (FlatList handles its own scroll)
- Day anchor = the day itself; Week anchor = Monday of ISO week; Month anchor = YYYY-MM-01; Year anchor = YYYY-01-01

## Overhead Expenses Module
→ See `overhead-expenses.md` for full detail.
- Screen: `src/app/(app)/(tabs)/overhead.tsx`; Store: `src/store/overhead_expenses.store.ts`
- `OverheadFrequency`: `'one_time' | 'monthly' | 'quarterly' | 'annual'` — UNDERSCORES not hyphens
- Entries are immutable — `logExpense` is the only mutation (no edit/delete)
- `selectOverheadSummary` → `OverheadExpenseSummary { thisMonth, thisYear, allTime }`
- Dashboard Overhead KPIs use `useOverheadExpensesStore(selectOverheadSummary)` directly
- AppDrawer: `Building2` icon + `#8B5CF6`; registered as `Drawer.Screen name="overhead"`
- QuickActions now has 4 active buttons: POS / Inventory / Utilities / Overhead (Reports removed)

## Business ROI Overview Module
- Screen: `src/app/(app)/(tabs)/business-roi.tsx`; Store: `src/store/business_roi.store.ts` (ERP architect built, real SQLite queries)
- Types: `src/types/business_roi.types.ts` — `BusinessROIData`, `ProductROIBreakdown { name, unitsSold, revenue, contributionMargin }`, `BusinessROIRiskLevel`
- `estimatedMonthsToTarget` is a store state field (months to 20% ROI from current position)
- New molecules: `ROIMetricTile` + `BreakevenProgress` — both in `src/components/molecules/` barrel
- Dashboard `BusinessROICard`: after `ROIOutlookCard` in index.tsx; stale-refresh via `useFocusEffect` (> 5 min threshold)
- AppDrawer: `BarChart2` icon + `#10B981`; `Drawer.Screen name="business-roi"`; `'/business-roi': 'Business ROI Overview'` in ROUTE_TITLES

## BOM-Constrained Add Stock
→ See `bom-stock-addition.md` for full detail.
- Types: `BomShortageItem`, `BomValidationResult` in `src/types/index.ts`
- Util: `validateStockAddition()` in `src/utils/bomValidation.ts` — direct DB SQL, not repo layer
- Store: `addProductStock(productId, unitsToAdd, notes?)` in `inventory.store.ts` — null=success, BomValidationResult=blocked, throws=error
- Repo imports needed: `addProductStock as dbAddProductStock`, `getItemById` (NOT `getInventoryItemById`)
- Screen: debounced 300ms `useEffect` on qty change; `BomWarningPanel` + `BomShortageRow` local memoized components

## ROI Calculator Module
- Screen: `src/app/(app)/(tabs)/roi.tsx`; Store: `src/store/roi.store.ts`
- Types: `src/types/roi.types.ts` — `ROIInputs`, `ROIResults`, `ROIScenarios`, `ROIScenarioItem`, `ROIRiskLevel`
- Organisms: `AIInsightCard` — `src/components/organisms/AIInsightCard.tsx`; props: `insight`, `riskLevel`, `isLoading`
- Molecules: `ROIScenarioCard` — `src/components/molecules/ROIScenarioCard/`; props: `label`, `roi`, `breakevenMonths`, `unitsNeeded`, `grossMargin`, `riskLevel`, `isHighlighted`
- Selectors: `selectROIInputs`, `selectROIResults`, `selectROIInsight`, `selectROILoading`, `selectROIScenarios`, `selectSavedROIScenarios`, `selectROIScenariosLoading`, `selectROIError`
- Actions: `setROIInputs(partial)`, `computeROI()`, `generateAIInsight()`, `saveScenario(name)`, `initializeROIStore()`
- Dashboard card: `ROIOutlookCard` component defined inline in `index.tsx` — imports from `@/store/roi.store` directly
- AppDrawer: `TrendingUp` icon + `#0EA5E9` (sky blue); registered as `Drawer.Screen name="roi"`
- ROUTE_TITLES: `'/roi': 'ROI Calculator'` in `_layout.tsx`
- `ShimmerBlock` pattern: use `widthPercent: number` NOT `width: string|number` — Animated.View style rejects plain strings
- Debounced compute: 800ms `setTimeout` after each input change; manual "Recalculate" button clears the debounce
- `CurrencyField` + `NumericField` inline form components — own dark/light token block (no `useAppTheme()`)

## DatePickerField Molecule Patterns
→ See `datepicker-molecule.md` for full detail.
- Hybrid text+native picker; `value`/`onChange` as ISO YYYY-MM-DD; own dark/light token block (no `useAppTheme()`)

## Detailed Session History
→ See `sessions.md` for per-session change logs and pre-existing error list
