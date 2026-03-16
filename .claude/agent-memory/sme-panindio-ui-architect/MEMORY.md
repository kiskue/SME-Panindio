# SME Panindio UI Architect — Agent Memory

## Quick Reference — Key Files
- Theme: `src/core/theme/index.ts` — `theme` (light), `darkTheme`, `useAppTheme()`, `getTheme(mode)`
- Theme store: `src/store/theme.store.ts` — `useThemeStore`, `selectThemeMode`
- Inventory store: `src/store/inventory.store.ts` — all selectors re-exported from `src/store/index.ts`
- Inventory screens: `src/app/(app)/(tabs)/inventory/` — `index.tsx`, `add.tsx`, `[id].tsx`
- Inventory card: `src/components/organisms/InventoryItemCard.tsx`
- Navigation: `src/app/(app)/(tabs)/_layout.tsx` wraps Stack + TopNavBar + AppDrawer inside DrawerProvider

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

## Detailed Session History
→ See `sessions.md` for per-session change logs and pre-existing error list
