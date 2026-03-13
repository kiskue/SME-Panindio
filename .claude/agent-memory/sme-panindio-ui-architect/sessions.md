---
name: Session History
description: Detailed notes from each working session — changes made, patterns discovered, pre-existing errors logged
type: project
---

## Session 2 — Brand Identity + Theme Foundation
- Primary Blue (navy): `#1E4D8C` → `theme.colors.primary[500]`
- Accent Green: `#27AE60` → `theme.colors.accent[500]`
- Highlight Amber: `#F5A623` → `theme.colors.highlight[400]`
- Orange i-dot: `#F39C12` → `theme.colors.highlight[500]`
- Text dark navy: `#1A3A6B` → `theme.colors.text`; Background: `#F8F9FA`; Surface: `#FFFFFF`
- Added `accent`/`highlight` scales; `surfaceSubtle`/`borderSubtle` flat tokens; `[400]`/`[600]` semantic keys
- Added `borderRadius['2xl']: 24`; shadow `shadowColor` changed to `'#1E4D8C'`
- `BrandLogo` atom: `src/components/atoms/BrandLogo/BrandLogo.tsx` — variants: `full|icon|wordmark`, sizes `xs`–`xl`
- Screens: `index.tsx` (splash), `onboarding.tsx` (4 slides), `(auth)/login.tsx` (navy header/floating card)

## Session 4 — Business/Role Normalisation
- `supabase/schema.sql`: `public.business_types` (21 PH SME types, `pos_enabled`), `public.job_roles` (12 roles), `public.businesses`
- `public.users`: removed `businessCategory`/`enterpriseType`; added `business_id UUID` + `job_role_id INTEGER`
- Added `register_business_owner` SECURITY DEFINER RPC for single-round-trip signup
- `src/types/index.ts`: `BusinessType`, `JobRole`, `Business` interfaces; `UserProfile` + `RegisterCredentials` updated
- `src/hooks/useRegistrationSetup.ts`: parallel fetch + cancellation guard
- `auth.service.ts`: `register()` now calls RPC; `fetchUserProfile()` joins businesses + types + roles
- `register.tsx`: two separate picker modals (`BusinessTypePickerModal` + `JobRolePickerModal`), `PickerSkeleton`, `watch()` for display names

## Session 5 — Drawer + TopNavBar Navigation Refactor
- Bottom tab bar REMOVED; replaced with TopNavBar (fixed top) + AppDrawer (slide-in left)
- No `@react-navigation/drawer` — reused existing modal-based `Drawer` organism via `DrawerContext`
- New files: `src/context/DrawerContext.tsx`, `src/components/organisms/TopNavBar.tsx`, `src/components/organisms/AppDrawer.tsx`
- `(tabs)/_layout.tsx`: `<DrawerProvider>` wraps Stack + TopNavBar + AppDrawer
- Screens inside this layout: `edges={['bottom','left','right']}` on `SafeAreaView`
- AppDrawer `navigate()` uses 50ms `setTimeout` after `onClose()` — lets drawer animation settle before push
- `@/context/*` resolves via existing `@/*` → `src/*` tsconfig path

## Session 6 — Inventory Module Types + Store
- `InventoryCategory`, `EquipmentCondition`, `StockUnit` (13-value union) added to `src/types/index.ts`
- `InventoryItem`: optional `price`, `costPrice`, `sku`, `reorderLevel`, `condition`, `serialNumber`, `purchaseDate`, `imageUri`
- `useInventoryStore` — SQLite-backed; hydrated via `initializeInventory()`
- Selectors exported from `src/store/index.ts` — use them; do not access store state directly
- Low-stock: `quantity <= reorderLevel` (only items with `reorderLevel` defined)

## Session 7 — Inventory UI Redesign
- `InventoryItemCard`: left accent bar (4px), quantity badge (health-coded), stock progress bar, MetaChip (SKU/serial), `React.memo` + `displayName`
- `inventory/index.tsx`: 4-tile stats bar, category pill tabs (horizontal ScrollView), SortModal, low-stock banner, FlatList + FAB
- `StatCard` sub-component: `bgColor`/`borderColor`/`valueColor` props; Total Value = `sum(qty * (costPrice ?? price ?? 0))`
- Category tabs active: solid accentColor bg + `rgba(255,255,255,0.25)` count badge bg
- `SortModal`: `applySortOrder()` pure fn; `sortKey` state local to screen (not in store)
- AppDrawer: inventory parent + 3 sub-items; `store.getState().setFilter()` called imperatively before `navigate()`
- `_layout.tsx`: `ROUTE_TITLES` + `resolveTitle()` regex for `[id]` dynamic route → "Item Details"
- ID generation: `inv_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`

## Session 8 — Dark Mode / Theme System
- `src/store/theme.store.ts`: `useThemeStore`, `selectThemeMode`, persists via AsyncStorage `'theme-store'`
- `src/core/theme/ThemeProvider.tsx`: reads mode, provides resolved theme via `ThemeContext`
- `darkTheme` export: `background: #0F172A`, `surface: #1E293B`, `text: #F1F5F9`, `border: #334155`
- `getTheme(mode)` factory; `ThemeContext`; `useAppTheme()` hook — all in `src/core/theme/index.ts`
- Root `_layout.tsx`: wrapped with `<ThemeProvider>`; `StatusBar style` now reactive
- AppDrawer: all colors via `useAppTheme()`; dark mode `Switch` toggle; `dynStyles` memoised

## Session 9 — Inventory Dark Mode Redesign
- `isDark` detection: use `useThemeStore(selectThemeMode) === 'dark'` — NEVER compare `theme.colors.background`
- Dark neon palette: product `#4F9EFF`, ingredient `#3DD68C`, equipment `#FFB020`
- Dark health palette: out `#FF6B6B`, low `#FFB020`, healthy `#3DD68C`
- Cards: `backgroundColor: '#151A27'`, glow border `rgba(accent,0.22)`, left accent bar 3px
- `StyleSheet.create()` returns style objects — derive plain strings BEFORE passing as `color` props to sub-components
- `DARK_CATEGORY_CONFIG` / `LIGHT_CATEGORY_CONFIG` record pattern (see `InventoryItemCard.tsx`)

## Session 10 — Item Detail Screen Redesign (`[id].tsx`)
- Screen split into VIEW ZONE (hero + read-only panels) + EDIT ZONE (collapsible `CollapsibleEdit` form)
- Hero card: 56×56 icon circle (borderRadius 16), item name `h5/bold`, category pill + health pill in badge row, quantity block (health-coded), stock progress bar (8px height, qty/reorderLevel*3 ratio), description card
- Read-only panels use `SectionHeader` with `iconPill` (28×28, borderRadius 8) instead of dot marker
- `InfoRow` sub-component: icon (20px wide fixed) + label (110px fixed) + value (flex 1) — readable aligned layout
- `InfoDivider` sub-component: 1px separator, isDark-aware
- Pricing section: Selling Price + Cost Price + computed Gross Margin row (color-coded green/red)
- Stock Info section: Quantity + Unit + Reorder Level + SKU
- Equipment section: Serial # + Condition (color-coded good/fair/poor) + Purchase Date
- Metadata card: item ID + Created date + Last Updated date
- `CollapsibleEdit`: accordion that wraps the full edit form; `ChevronRight` rotates 90° when expanded; no `LayoutAnimation` — rotation via inline `style.transform`
- Standalone Delete button at bottom of scroll (full-width, destructive red pill row)
- `formatDate(iso)` helper: `toLocaleDateString('en-PH', { year:'numeric', month:'short', day:'numeric' })`; wrapped in try/catch
- Removed `Badge` atom import — replaced with custom category/health pills for full color control
- `StatusBar style` now `isDark ? 'light' : 'dark'` (was hardcoded `'light'`)
- Zero new TS errors introduced — verified with `npx tsc --noEmit | grep "inventory/\[id\]"`

## Session 11 — Ingredient Consumption Logs UI
- `IngredientConsumptionLogCard` organism: `src/components/organisms/IngredientConsumptionLogCard.tsx`
  - Exports: `IngredientConsumptionLogCard`, `triggerColor()`, `TriggerIcon`, `TRIGGER_LABELS`
  - Collapsible detail section for notes/referenceId/performedBy; color-coded left accent bar
- `ManualEntryBottomSheet` organism: `src/components/organisms/ManualEntryBottomSheet.tsx`
  - RHF + Yup form; ingredient picker sub-modal reuses `selectIngredients` from inventory store
  - Trigger type chips: MANUAL_ADJUSTMENT | WASTAGE | RETURN | TRANSFER (not PRODUCTION — that is automatic)
  - RETURN trigger stores negative `quantityConsumed`
  - `leftIcon` on Button: use `{...(condition ? { leftIcon: <...> } : {})}` — NEVER pass `undefined` directly
  - `weight` prop on `Text`: valid values are `'light'|'normal'|'medium'|'semibold'|'bold'` — NOT `'regular'`
  - `style={{ flex: N }}` on Button: valid (Button passes style through)
- `ingredient-logs.tsx` screen updated: removed inline `LogCard`, now imports from organisms; added `HeaderActions` row with title + "Manual Entry" pressable button; `ManualEntryBottomSheet` wired to `entrySheetVisible` state; empty state now has inline call-to-action pressable
- `src/components/organisms/index.ts` updated with both new exports
- TypeScript result: zero errors (excluding pre-existing Storybook + other module issues)

## Pre-existing TypeScript Errors (do NOT fix without dedicated task)
- `src/components/molecules/ListItem.stories.tsx` — exactOptionalPropertyTypes on `backgroundColor`
- `src/components/atoms/Chip.tsx` — unused `View` import + exactOptionalPropertyTypes on icon color
- `src/components/molecules/Alert.tsx` — exactOptionalPropertyTypes on lucide icon props
- `src/store/index.ts` — unused `initializeNotifications` import
- `src/components/atoms/BrandLogo/BrandLogo.stories.tsx` — Meta/StoryObj not exported from storybook/react-native
- `database/repositories/inventory_items.repository.ts(48)` — exactOptionalPropertyTypes on `condition`
- `src/app/(app)/(tabs)/inventory/index.tsx(495)` — `shadows.xs` does not exist
- `src/store/inventory.store.ts` — `get` param unused
- `src/components/organisms/AppDrawer.tsx(151,163,175)` — navigation.navigate type mismatch
