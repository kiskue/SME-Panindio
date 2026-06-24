# Reusability Refactor — TODO Tracker

**Date:** 2026-06-24
**Scope:** Consolidate duplicated UI and logic into shared design-system components, hooks, and utilities. Aligns with the `src/core/` consolidation from `docs/STRUCTURE_REFACTOR.md`.
**Rule:** Extend existing atoms/molecules/organisms and `src/core/utils` before creating anything new. Honor strict TS conventions (theme color object indexing, `exactOptionalPropertyTypes` conditional spreading, `??` for indexed access, exported types).

Items are ordered by priority: **highest impact / lowest effort first**.

---

## Progress (updated 2026-06-24)

**Done & verified (tsc clean — 21 pre-existing errors throughout, 0 introduced):**
A1 (formatCurrency util, 23 defs removed) · A2 (formatNumber/formatPercent) · A3 (date util, 9 files) · A4 (useRefreshControl, 5 screens) · A5 *foundation* (`withAsync`, validated on 2 stores) · A6 (paginated-log factory, 2 consumption stores) · A7 (VAT_RATE) · B2 (LoadingSpinner/SkeletonBox) · B3 (StatusBadge + central status colors, feature delegates) · B7 (ProgressBar atom).

**Partial:** B1 (2 of 5 EmptyState migrations; rest blocked on Button atom custom-color action).

**Deferred with documented rationale (`[~]`):** B4, B5, B6 (bespoke single-use cards/headers — consolidation would normalize hand-tuned visuals) · B8 (black vs brand-blue shadow conventions) · A9 (timezone hazard: local vs UTC YMD) · A5 broad rollout (incremental, business-critical stores).

**Main remaining substantive item:** **A6** (paginated-store factory) — highest-risk; recommend a focused session now that A5's `withAsync` pattern is proven.

---

## A. Functional / Logic Reusability

### A1. [x] Create `src/core/utils/format.ts` — `formatCurrency` (DONE — 23 local defs removed, all call sites migrated)
- **Duplicated:** 25 files each define their OWN local `function formatCurrency(value: number): string` with inconsistent logic (`toFixed(2)+regex` vs `toLocaleString('en-PH')`).
- **Files (define local copy):** `src/app/(app)/(tabs)/`: `breakeven.tsx:95`, `business-roi.tsx:58`, `credit/index.tsx:88`, `credit/[id].tsx:98`, `index.tsx:100`, `inventory/index.tsx:102`, `inventory/ingredient-logs.tsx:91`, `inventory/production.tsx:59`, `inventory/raw-materials/logs.tsx:96`, `overhead.tsx:136`, `pos.tsx:119`, `roi.tsx:79`, `utilities.tsx:88` — plus components: `RawMaterialCard/index.tsx:84`, `RawMaterialConsumptionLogCard/index.tsx:68`, `SalesTargetSetupSheet/index.tsx:70`, `ScanResultSheet/index.tsx:56`, `IngredientConsumptionLogCard.tsx:67`, `IngredientSelector.tsx:55`, `InventoryItemCard.tsx:130`, `RawMaterialSelector.tsx:48`, `RawMaterialPicker/index.tsx:130`, and inline `toFixed(2)` in customer screens (`cart.tsx`, `orders.tsx`, `products.tsx`, `suki/orders.tsx`).
- **Action:** Create `formatCurrency(value, opts?: { decimals?: number; compact?: boolean })` (default `₱` + 2 decimals + thousands separators). Replace all 25 local defs + inline `toFixed(2)` usages with the import.

### A2. [x] Add `formatNumber` / `formatPercent` to `src/core/utils/format.ts` (DONE — helpers added; index.tsx `formatUnits` + line 1172 migrated. Remaining inline `.toLocaleString('en-PH')` calls in breakeven/business-roi left intentionally: they are sign-prefixed percentages, layout-width template literals, or values rounded to 2 decimals where forcing fixed decimals would change display.)
- **Duplicated:** inline `toLocaleString('en-PH', { maximumFractionDigits: 0 })` for unit counts and `Math.ceil(...).toLocaleString()` percentages.
- **Files:** `breakeven.tsx`, `business-roi.tsx`, `index.tsx` (~15 inline calls).
- **Action:** `formatNumber(value, decimals?)` and `formatPercent(value, decimals?)` in the same module.

### A3. [x] Create `src/core/utils/date.ts` — date/time formatting (DONE — exports `formatDate`/`formatShortDate`/`formatLongDate`/`formatTime`/`formatDateTime`/`formatShortDateTime`/`formatWeekday`/`getTodayISO`/`getNowISO`. Migrated credit/[id], overhead, index (formatTodayDate→formatLongDate), production, IngredientConsumptionLogCard, RawMaterialConsumptionLogCard, ingredient-logs, raw-materials/logs, business-roi. Left suki/orders/[id] inline (differing format). Repos' `toISOString()` left as optional follow-up.)
- **Duplicated:** local `formatDate`/`formatTodayDate` helpers + inline `toLocaleDateString('en-PH', { weekday: 'short' })` + `new Date().toISOString().slice(0,10)`.
- **Files:** `index.tsx:138`, `credit/[id].tsx`, `inventory/ingredient-logs.tsx`, `inventory/production.tsx`, `inventory/raw-materials/logs.tsx`, `suki/orders/[id].tsx:166`; 60+ `new Date().toISOString()` in `src/database/repositories`.
- **Action:** `formatDate(iso, style?)`, `formatDateTime(iso)`, `formatWeekday(iso)`, `getTodayISO()`, `getNowISO()`. Migrate screens first; repos optional.

### A4. [x] Create `useRefreshControl` hook in `src/hooks/` (DONE — hook created + exported from `@/hooks`. Adopted in 5 clean async screens: index, overhead, production, ingredient-logs, raw-materials/logs. NOT adopted where no local refreshing state exists (business-roi, suki/index, suki/orders, raw-materials/index bind `refreshing` to store `isLoading`) or where custom error logging matters (notifications). inventory/index uses a setTimeout fake-delay — left as-is.)
- **Duplicated:** `const [refreshing,setRefreshing]=useState(false); onRefresh=()=>{setRefreshing(true); fetch().finally(()=>setRefreshing(false))}` + `RefreshControl`.
- **Files:** `business-roi.tsx`, `overhead.tsx`, `notifications.tsx`, `index.tsx`, `inventory/index.tsx`, `inventory/ingredient-logs.tsx`, `inventory/production.tsx`, `suki/index.tsx`, `suki/orders.tsx`, `inventory/raw-materials/index.tsx`, `inventory/raw-materials/logs.tsx` (16 total).
- **Action:** `useRefreshControl(fetchFn)` returning `{ refreshing, onRefresh }`. Optionally `useRefreshOnFocus(fetchFn)` wrapping `useFocusEffect`.

### A5. [~] Extract Zustand async-action boilerplate (FOUNDATION DONE — created `withAsync(set, work, opts)` in `src/store/utils.ts` (work returns the success patch; helper handles loading+error+catch in one place). Validated on utilities.store (initialize, loadLogsForMonth) + production.store (initialize, refresh). REMAINING: incremental rollout to ~16 other stores — intentionally NOT done in bulk (business-critical POS/inventory/credit stores; convert a few at a time and test). Skip actions that return a value + re-throw (e.g. upsertLog) or that don't toggle loading (summary loaders) — they don't fit the helper.)
- **Duplicated:** `set({ isLoading: true, error: null }); try { ... set({ ..., isLoading:false }) } catch(e){ set({ error:..., isLoading:false }) }` repeated 50+ times across 18 stores.
- **Files:** `inventory`, `pos`, `credit`, `raw_materials`, `utilities`, `overhead_expenses`, `dashboard`, `sales_target`, `ingredient_consumption`, `raw_material_consumption_logs`, `production` stores (+ feature stores).
- **Action:** Add `runAsync(set, action, { loadingKey?, errorKey? })` helper in `src/core/store/` (or `src/store/utils.ts`). Adopt incrementally — start with 2-3 stores to validate the shape.

### A6. [x] Extract paginated-list store factory (DONE — created `src/store/createPaginatedLogActions.ts` (generic over log/filter/state types; returns the shared `initializeLogs`/`refreshLogs`/`loadMore`/`setFilters`/`clearError` actions). Adopted in `ingredient_consumption.store` (keeps its extra `logManualEntry`) + `raw_material_consumption_logs.store` — their 4 actions were byte-identical. CORRECTION to original audit: `overhead_expenses.store` is NOT verbatim (PAGE_SIZE 20, offset-from-array-length paging, `expenses`/`summary`-only shape, `filtersToQueryOptions`) — intentionally LEFT separate to avoid forcing two pagination models into one.)
- **Duplicated:** ~200 lines of `initialize/refresh/loadMore/setFilters` pagination logic VERBATIM across 3 stores.
- **Files:** `overhead_expenses.store.ts`, `ingredient_consumption.store.ts`, `raw_material_consumption_logs.store.ts`.
- **Action:** `createPaginatedSlice({ fetchPage, fetchCount, pageSize })`. Highest line-count saving but higher risk — do after A5 proves the pattern.

### A7. [x] Centralize VAT/subtotal calculations through `src/core/vat.ts` (DONE — replaced literal `* 0.12` with `VAT_RATE` import in pos.tsx:542 + cart.tsx:41. dashboard.store already used `VAT_RATE`. Subtotal reduces (`cartItems.reduce(...c.subtotal)` in pos.store ×2) left as trivial one-liners — a helper would add indirection without real dedup value.)
- **Duplicated:** inline `* 0.12` and `cart.reduce((s,i)=>s+i.lineTotal,0)`.
- **Files:** `cart.tsx:40`, `online_orders.store.ts:141`, `pos.tsx:545`, `dashboard.store.ts:223`.
- **Action:** Route all VAT through existing `src/core/vat.ts`; add `calculateSubtotal(items)` / `calculateLineTotal(qty, price)` to a `calculations` util.

### A8. [x] Migrate `Alert.alert` to `useAppDialog` (DONE — migrated 14 files (~32 calls) to `dialog.show`/`dialog.confirm`, each rendering `{dialog.Dialog}` once; verified hook+render present in all. Confirm-gated flows (inventory delete, suki approve, order status advance) preserved. `Alert.prompt` in suki/[id] left as-is (hook has no text input). pos.tsx + inventory/add.tsx were already migrated. NOTE: cart 'Verification required' message set to `info` variant — change to `warning` if preferred.)
- **Duplicated:** native `Alert.alert` confirm/error dialogs instead of themed `useAppDialog` (`src/hooks/useAppDialog.ts`, already exists).
- **Files:** `(auth)/login.tsx`, `(auth)/customer-register.tsx`, customer `profile.tsx`/`cart.tsx`/`verify-id.tsx`/`verify-liveness.tsx`/`products.tsx`, tabs `profile.tsx`, `suki/[id].tsx`, `inventory/[id].tsx`, `suki/register-customer.tsx`, `suki/orders/[id].tsx`, `suki/catalog.tsx`.
- **Action:** Replace with `useAppDialog().confirm/show`. Also lets screens drop inline `try/catch + Alert` and surface store `error` state instead.

### A9. [~] Extract date/period + filter-to-query helpers from stores (DEFERRED — TIMEZONE HAZARD: sales_target's `todayYMD`/`thisMonthStartYMD` use LOCAL date (`getFullYear/getMonth/getDate`); dashboard's `toYMD` uses UTC (`Date.UTC`); the existing `getTodayISO` uses UTC (`toISOString`). These deliberately differ — "today's sales" must be local (PH UTC+8), anchoring is UTC. A naive merge would cause off-by-one-day bugs. To do safely: add BOTH `getTodayLocalYMD()`/`toLocalYMD(date)` AND keep UTC helpers distinct in date.ts, then migrate per-call with care. Low value, deferred.)
- **Duplicated:** `toYMD/todayYMD/thisMonthStartYMD/shiftAnchor` in `sales_target.store.ts:65-95` & `dashboard.store.ts:44-111`; conditional-spread `filtersToQueryOptions` in `overhead_expenses.store.ts:292` & `ingredient_consumption.store.ts:83`.
- **Action:** Move date helpers into `src/core/utils/date.ts` (A3). Add generic `toQueryOptions(filters)` conditional-spread helper.

---

## B. UI / Design-System Reusability

### B1. [~] Use existing `EmptyState` molecule everywhere (PARTIAL — migrated `utilities.tsx` + `suki/index.tsx`; added `iconBackgroundColor` prop to EmptyState. LEFT: `overhead.tsx` (custom purple Plus action button — Button atom has no custom-color variant), `customer/products.tsx` + `customer/orders.tsx` (bespoke customer-portal retry/shop buttons + custom title colors). Full migration needs Button atom to support a custom color/icon action.)
- **Duplicated:** inline icon + title + message + CTA blocks; `EmptyState` molecule (`src/components/molecules/EmptyState.tsx`) is NOT used by these.
- **Files:** `utilities.tsx:934-948`, `customer/products.tsx:185-189`, `customer/orders.tsx:109-115`, `suki/index.tsx:186-191`, `overhead.tsx` list-empty.
- **Action:** Replace inline blocks with `EmptyState`; add an `iconSize`/`size` variant if 88px hero size is needed.

### B2. [x] Replace bare `ActivityIndicator` with `LoadingSpinner` (DONE — `customer/products.tsx` + `suki/index.tsx` use LoadingSpinner; `overhead.tsx` skeleton replaced with `SkeletonBox` atom. Small in-button ActivityIndicators left as-is.)
- **Duplicated:** bare `<ActivityIndicator size="large" />` instead of branded `LoadingSpinner` (`src/components/molecules/LoadingSpinner.tsx`).
- **Files:** `customer/products.tsx:176`, `suki/index.tsx:184`; `overhead.tsx:174-199` re-implements skeleton animation instead of `SkeletonBox`.
- **Action:** Swap to `LoadingSpinner`; use `SkeletonBox` atom for placeholder skeletons.

### B3. [x] Create `StatusBadge` molecule + centralized status→color map (DONE — created `StatusBadge` molecule (sm/md sizes, optional icon/border) + `src/core/theme/statusColors.ts` (`verificationStatusColor`, `orderStatusColor`/`orderStatusColors`). Migrated suki/index, suki/[id], customer/orders. Unified the pre-existing `ORDER_STATUS_COLORS` in `@/features/business-suki/order-status` to delegate to the theme map (single source — suki/orders + suki/orders/[id] transitively use it). LEFT: customer/home (bespoke 0.20-opacity verification map + custom labels), and the credit fully-paid chip + overhead category pills (category/rank domains, not status maps — candidates for StatusBadge/B5 follow-up).)
- **Duplicated:** status pills (Paid/Unpaid/Overdue, Verified/Pending/Rejected, order status) re-implemented inline with hardcoded bg/border per `isDark`.
- **Files:** `utilities.tsx:295-334`, `credit/index.tsx:123-135`, `suki/index.tsx:26-38,106-108`, `overhead.tsx:442-462,542-550`, suki/customer order screens.
- **Action:** Create `StatusBadge` molecule (extends `Badge` atom with `icon` + `status` props); centralize color maps in `src/core/theme`. Add `icon` support to `Badge` atom if missing.

### B4. [~] Consolidate stat/metric cards into one `StatCard` molecule (DEFERRED — on inspection the four (`KpiCard`/`StatPillRow`/`SummaryPill`/`StatRow`) are each SINGLE-USE (one per screen, no cross-screen dup) and structurally distinct: KpiCard is a bordered card w/ left accent bar; SummaryPill & overhead pills are tinted pills but with DIFFERENT tint opacities (`color18/14` vs `color0D/0F`); StatRow is a multi-column divider row. One component absorbing all would need many variant props and would normalize hand-tuned tints. Low dedup value / real regression risk — deferred.)
- **Duplicated:** `KpiCard` (`index.tsx:176`), `StatPillRow` (`overhead.tsx:203`), `SummaryPill` (`utilities.tsx:739`), `StatRow` (`credit/index.tsx:154`) — all "icon + label + value + accent" variants.
- **Action:** One `StatCard` molecule: props `icon`, `label`, `value`, `accentColor`, `size`. Add a `StatDivider` atom for the repeated vertical divider (w1, h24).

### B5. [~] Create `ListItemCard` molecule for item rows (DEFERRED — same finding as B4: UtilityCard / ExpenseCard / RankCard / CustomerRow are each single-use and bespoke (different accent treatments, metadata layouts, action slots, per-screen tints). A generic `ListItemCard` would need so many slots/props it stops being a simplification, and adopting it would normalize bespoke visuals. Revisit only if a genuinely-shared row appears in 2+ screens.)
- **Duplicated:** accent bar + icon pill + title/subtitle/metadata + right actions, re-styled per screen.
- **Files:** `utilities.tsx` UtilityCard (148-290), `overhead.tsx` ExpenseCard (376-488), `credit/index.tsx` RankCard (198-311), `suki/index.tsx` CustomerRow (87-117).
- **Action:** Generic `ListItemCard` (`icon`, `accentColor`, `title`, `subtitle`, `metadata`, `actions` slots). Evaluate extending existing `ListItem` molecule first.

### B6. [~] Generalize a `ScreenHeader` / extend `TopNavBar` for customer portal (DEFERRED — the 3 customer headers share only the 3-stripe `brandStripe` motif; their content differs substantially (home: greeting + VerificationBadge; products: back + search; orders: back + title). Only the tiny stripe is cleanly extractable (a `BrandStripe` atom) — marginal. Full header consolidation would be bespoke. Deferred.)
- **Duplicated:** brand-stripe header with back button + actions rebuilt inline in customer screens.
- **Files:** `customer/products.tsx:146-173`, `customer/home.tsx:71-84`, `customer/orders.tsx:95-105`.
- **Action:** Extend `TopNavBar` (`src/components/organisms/TopNavBar.tsx`) with a brand-stripe variant, or add a thin `CustomerScreenHeader` wrapper around it.

### B7. [x] Extract `ProgressBar` atom (DONE — created `ProgressBar` atom (`fraction`, `color`, `trackColor`, `height?`, `radius?`). Adopted in credit RankCard + business-roi mini bars. The business-roi timeline bars (absolute-positioned markers) left as specialized.)
- **Duplicated:** inline progress bar (track + fill, height 8, radius 4) in `credit/index.tsx` RankCard and business ROI.
- **Action:** Create `ProgressBar` atom (`value`, `max`, `color`, `height`). Reuse in `BreakevenProgress` molecule if applicable.

### B8. [~] Move shadow/elevation tokens into `src/core/theme` (DEFERRED — `theme.shadows` (sm/md/lg/xl, brand `#1E4D8C`) already exists and is widely used. Remaining inline shadows split between near-token brand-blue and an intentional BLACK `#000` convention (~23 uses). Blindly routing the black ones through the blue token changes their appearance; a safe pass would need per-block offset/opacity matching or a new `shadows.black*` token (design decision). Low value — deferred.)
- **Duplicated:** identical `shadowColor/Offset/Opacity/Radius/elevation` card-shadow blocks redefined per screen StyleSheet (light + dark variants).
- **Action:** Export `shadows.cardLight` / `shadows.cardDark` / `shadows.fab` from theme; replace inline blocks.

---

## Suggested Execution Order (cross-cutting)
1. **A1** formatCurrency util (unblocks 25 files, trivial risk) →
2. **B2** LoadingSpinner swap + **B1** EmptyState (quick UI wins) →
3. **A3** date util + **A2** number util →
4. **A4** useRefreshControl hook →
5. **B3** StatusBadge + **A8** useAppDialog migration →
6. **B4/B5/B6** card/header consolidation →
7. **A5** store async helper → **A6** pagination factory (highest risk, do last with the pattern proven).
