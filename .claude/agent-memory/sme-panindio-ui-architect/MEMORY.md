# SME Panindio UI Architect — Agent Memory

## Brand Identity (Session 2)
- Primary Blue (navy):  `#1E4D8C` → `theme.colors.primary[500]`
- Accent Green:         `#27AE60` → `theme.colors.accent[500]`
- Highlight Amber:      `#F5A623` → `theme.colors.highlight[400]`
- Orange i-dot:         `#F39C12` → `theme.colors.highlight[500]`
- Text dark navy:       `#1A3A6B` → `theme.colors.text`
- Background:           `#F8F9FA` → `theme.colors.background`
- Surface:              `#FFFFFF` → `theme.colors.surface`

## Theme Changes (Session 2)
- Added `accent` scale (greens) and `highlight` scale (ambers/oranges)
- Added `surfaceSubtle`, `borderSubtle` flat tokens
- Added `[400]` and `[600]` keys to `error`, `warning`, `success`, `info` scales
- Added `borderRadius['2xl']: 24` key
- Shadow `shadowColor` changed from `'#000'` to `'#1E4D8C'` (brand tinted shadows)

## New Components (Session 2)
- `BrandLogo` atom: `src/components/atoms/BrandLogo/BrandLogo.tsx`
  - Variants: `full` | `icon` | `wordmark`; Sizes: `xs`–`xl`
  - Storybook: `src/components/atoms/BrandLogo/BrandLogo.stories.tsx`

## Screen Designs (Session 2)
- `src/app/index.tsx` — Branded splash
- `src/app/onboarding.tsx` — 4-slide onboarding
- `src/app/(auth)/login.tsx` — Navy header, floating form card
- `src/app/(auth)/register.tsx` — See Session 4 below for current state

## Pre-existing TypeScript Errors (do NOT fix without dedicated task)
- `src/components/molecules/ListItem.stories.tsx` — exactOptionalPropertyTypes on `backgroundColor`
- `src/components/atoms/Chip.tsx` — unused `View` import, exactOptionalPropertyTypes on icon color
- `src/components/molecules/Alert.tsx` — exactOptionalPropertyTypes on lucide icon props
- `src/store/index.ts` — unused `initializeNotifications` import
- `src/components/atoms/BrandLogo/BrandLogo.stories.tsx` — Meta/StoryObj not exported from storybook/react-native

## Session 4 — Business/Role Normalisation
### Schema changes (`supabase/schema.sql` — full rewrite)
- Added `public.business_types` lookup table with `pos_enabled` flag; seeded with 21 PH SME types
- Added `public.job_roles` lookup table; seeded with 12 roles
- Added `public.businesses` table linked to `business_types`; `owner_id` nullable (circular dep avoidance)
- `public.users`: removed `businessCategory`/`enterpriseType` columns; added `business_id UUID` + `job_role_id INTEGER` FKs
- Added `register_business_owner` SECURITY DEFINER RPC — single round-trip for business + user creation
- `handle_new_user` trigger now inserts only name/username (no category/enterprise fields)
- New `handle_updated_at_snake()` trigger function for snake_case `updated_at` columns

### Type changes (`src/types/index.ts`)
- Removed `BUSINESS_CATEGORIES`, `BusinessCategory`
- Added `BusinessType`, `JobRole`, `Business` interfaces
- `UserProfile`: replaced `businessCategory`/`enterpriseType` with `business_id`, `job_role_id`, optional joins
- `RegisterCredentials`: replaced `businessCategory` with `businessName`, `businessTypeId`, `jobRoleId`, `enterpriseType`
- `User`: replaced `businessCategory`/`enterpriseType` with `businessId`, `jobRoleId`, `businessName`, `businessTypeName`, `jobRoleName`, `posEnabled`

### New hook (`src/hooks/useRegistrationSetup.ts`)
- Fetches `business_types` and `job_roles` in parallel on mount
- Returns `{ businessTypes, jobRoles, loading, error }`
- Cancelled guard prevents state update on unmounted component

### Auth service (`src/features/auth/services/auth.service.ts`)
- `register()`: removed manual upsert; now calls `register_business_owner` RPC after signUp
- `fetchUserProfile()`: upgraded select to join businesses + business_types + job_roles
- `login()` and `refreshToken()`: map `business_id`, `job_role_id`, joined names/posEnabled onto User
- `validateRegisterCredentials()`: validates `businessName` (min 2), `businessTypeId` (>0), `jobRoleId` (>0)

### Register screen (`src/app/(auth)/register.tsx`)
- Two separate picker modals: `BusinessTypePickerModal` (shows green POS badge) + `JobRolePickerModal`
- Both are `React.memo`; data sourced from `useRegistrationSetup`
- `PickerTrigger` extracted as a memoised sub-component for DRY picker trigger rendering
- `PickerSkeleton` shown while `setupLoading` is true — disables pickers until data arrives
- `watch()` used to derive display names; no extra state for selected names
- Field order: FirstName/LastName | Username | Email | BusinessName | BusinessType | JobRole | EnterpriseType | Password | ConfirmPassword

## Session 5 — Drawer + TopNavBar Navigation Refactor
### Architecture decision
- Bottom tab bar REMOVED; replaced with: TopNavBar (fixed top) + AppDrawer (slide-in left)
- Did NOT use `@react-navigation/drawer` (not installed; no native rebuild needed)
- Reused existing modal-based `Drawer` organism via a `DrawerContext` provider

### New files
- `src/context/DrawerContext.tsx` — `DrawerProvider` + `useDrawer()` hook
- `src/components/organisms/TopNavBar.tsx` — fixed top bar (hamburger, logo/title, bell+badge)
- `src/components/organisms/AppDrawer.tsx` — wires auth user + unread count into `Drawer`
- `src/components/organisms/TopNavBar.stories.tsx` — 8 story variants

### Key patterns
- `(tabs)/_layout.tsx`: `<DrawerProvider>` wraps `<Stack>` + `<TopNavBar>` + `<AppDrawer>`
- Screens inside this layout must use `edges={['bottom','left','right']}` on `SafeAreaView`
- `StatusBar style="light"` on all screens (white icons on navy bar)
- Home screen shows BrandLogo wordmark; named screens show title text in TopNavBar
- `exactOptionalPropertyTypes` fix: `{...(title !== undefined ? { title } : {})}` for optional string prop
- AppDrawer `navigate()` uses 50ms `setTimeout` after `onClose()` so drawer animation settles before push
- `@/context/*` resolves via the existing `@/*` → `src/*` tsconfig path (no Babel changes needed)

## Storybook Notes
- Storybook folder excluded from tsconfig — story files will show TS errors in `tsc --noEmit` (expected)
- Story files use `Meta`/`StoryObj` from `@storybook/react-native` which has different typings

## Session 6 — Inventory Module
### New types (`src/types/index.ts`)
- `InventoryCategory`: `'product' | 'ingredient' | 'equipment'`
- `EquipmentCondition`: `'good' | 'fair' | 'poor'`
- `StockUnit`: 13-value union (`pcs`, `kg`, `g`, `L`, `mL`, `box`, `bag`, `bottle`, `pack`, `dozen`, `roll`, `meter`, `set`)
- `InventoryItem` interface — full shape including optional `price`, `costPrice`, `sku`, `reorderLevel`, `condition`, `serialNumber`, `purchaseDate`, `imageUri`
- `InventoryFilter` interface — `{ category: InventoryCategory | 'all'; searchQuery: string }`
- `AppRoute` extended with inventory routes

### Store (`src/store/inventory.store.ts`)
- `useInventoryStore` — SQLite-backed (NOT AsyncStorage); hydrated via `initializeInventory()`
- Selectors: `selectAllItems`, `selectInventoryFilter`, `selectItemsByCategory` (factory), `selectProducts`, `selectIngredients`, `selectEquipment`, `selectLowStockItems`, `selectItemById` (factory), `selectFilteredItems`, `selectInventoryCount`, `selectLowStockCount`, `selectInventoryLoading`, `selectInventoryError`
- All selectors exported from `src/store/index.ts`
- Low-stock logic: `quantity <= reorderLevel` (only items with `reorderLevel` set)

### Screens (`src/app/(app)/(tabs)/inventory/`)
- `index.tsx` — REDESIGNED (Session 7): stats bar + segmented tabs + sort modal + alert banner + FlatList + FAB
- `add.tsx` — RHF + Yup form; GenericPickerModal pattern; dynamic fields per category
- `[id].tsx` — Pre-populated edit form; delete with Alert confirmation; `isDirty` disables save when no changes

### InventoryItemCard redesign (Session 7, `src/components/organisms/InventoryItemCard.tsx`)
- Left accent border (4px wide) = category accent color — visually distinguishes rows at a glance
- Quantity block (top-right): colored bg + text based on stock health (error/warning/success)
- Stock health: `out` (qty=0) → error[500]; `low` (qty<=reorderLevel) → warning[500]; `healthy` → success[500]
- Stock progress bar: 4px height, fills proportionally (qty / reorderLevel*3), capped at 100%
- MetaChip sub-component: gray pill with icon + small text — used for SKU (Tag icon) and serial# (Hash icon)
- Bottom row: price | cost | condition badge | stock badge | chevron
- `React.memo` + `displayName` set; all sub-components also memoised

### Inventory index redesign (Session 7)
- Stats bar: 4 `StatCard` tiles (Total Items / Low Stock / Out of Stock / Total Value)
  - `StatCard` is a memoised sub-component with `bgColor`/`borderColor`/`valueColor` props
  - Total Value = sum of `quantity * (costPrice ?? price ?? 0)` — computed in screen-level `useMemo`
- Category tabs: horizontal ScrollView of pill buttons with per-tab count badge
  - Active state: solid `accentColor` bg; count badge uses `rgba(255,255,255,0.25)` bg on active
  - Inactive state: white bg, gray border; count badge uses category `accentBg`
- Sort: `SortModal` (bottom sheet Modal, transparent overlay, fade animation)
  - Options: Name A-Z / Z-A, Qty low-high / high-low, Recently Added
  - `Check` icon marks active sort; local `sortKey` state in the screen, not in store
  - `applySortOrder()` pure function sorts a copy of the filtered array
- Low-stock banner: redesigned with icon circle, title+subtitle, "View" CTA text
- Controls row: sort button (left) + result count (right), between tabs and list
- `selectInventoryLoading` used to suppress `ListEmpty` during initial hydration

### AppDrawer updates (`src/components/organisms/AppDrawer.tsx`)
- Inventory parent item (with `lowStockCount` badge) + 3 sub-items (Products/Ingredients/Equipment)
- Sub-items call `useInventoryStore.getState().setFilter()` BEFORE navigating — filter pre-set without query params
- Pattern: call `store.getState().action()` imperatively from drawer items when no React context is available

### _layout.tsx
- Added inventory route titles to `ROUTE_TITLES`
- `resolveTitle()` extended with regex pattern match for `[id]` dynamic route → "Item Details"

### ID generation (no external dep)
- `inv_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}` — used in add.tsx `onSubmit`

### exactOptionalPropertyTypes patterns
- In `updateItem` calls: ONLY spread fields when value is not undefined: `...(val !== undefined ? { key: val } : {})`
- Do NOT spread `{ key: undefined }` — this violates exactOptionalPropertyTypes
- Text `weight` prop valid values: `'light' | 'normal' | 'medium' | 'semibold' | 'bold'` — NOT `'regular'`

### Pre-existing error (do NOT fix without dedicated task)
- `database/repositories/inventory_items.repository.ts(48)` — exactOptionalPropertyTypes on `condition` field of reconstructed InventoryItem

## Session 8 — Dark Mode / Theme System

### New files
- `src/store/theme.store.ts` — `useThemeStore`, `selectThemeMode`, `ThemeMode` type; persists via AsyncStorage key `'theme-store'`
- `src/core/theme/ThemeProvider.tsx` — reads mode from store, provides resolved theme via `ThemeContext`, applies `backgroundColor` to root View

### Theme file changes (`src/core/theme/index.ts`)
- Added `darkTheme` export — same palette scales, dark flat tokens: `background: #0F172A`, `surface: #1E293B`, `text: #F1F5F9`, `border: #334155`
- Added `getTheme(mode)` factory — returns `darkTheme` or `theme`
- Added `ThemeContext` (React createContext, defaults to light `theme`)
- Added `useAppTheme()` hook — `useContext(ThemeContext)`
- Added `ThemeMode` type export (`'light' | 'dark'`)
- Static `theme` export UNCHANGED — backward compat for all existing screens

### Store index (`src/store/index.ts`)
- Added `export { useThemeStore, selectThemeMode }` and `export type { ThemeMode, ThemeState }` from `./theme.store`

### Root layout (`src/app/_layout.tsx`)
- Wrapped `<Stack>` with `<ThemeProvider>` (inside `SafeAreaProvider`)
- `StatusBar style` now reactive: `mode === 'dark' ? 'light' : 'dark'`

### AppDrawer (`src/components/organisms/AppDrawer.tsx`)
- All static `theme.colors.*` references replaced with `useAppTheme()` hook
- `dynStyles` object memoised with `useMemo([appTheme])` — layout styles remain in `StyleSheet.create` (no colors)
- Dark Mode toggle row: Moon icon + label + RN `Switch`, between ScrollView and footer
- `Switch` colors: `trackColor.true = primary[500]`, `thumbColor` = `highlight[400]` (dark) or `white` (light)
- Icon colors (`iconActive`, `iconInactive`, `iconDanger`) derived from `appTheme` at render time — no module-level constants

### Verification method
- `git stash` + `npx tsc --noEmit` to confirm navigation.navigate errors in AppDrawer pre-existed
- Zero new TypeScript errors introduced by these changes

### Pre-existing error added to known list
- `src/app/(app)/(tabs)/inventory/index.tsx(495)` — `shadows.xs` does not exist (pre-existing)

## Key Patterns
- Use inline SVG via `react-native-svg` (v15.12.1 installed) for illustrations
- Brand colour constants defined as `const NAVY = '#1E4D8C'` inside screen files
- Picker modals: `FlatList` inside bottom-sheet `Modal`; `keyboardShouldPersistTaps="handled"`
- POS badge chip: `backgroundColor: '#D1FAE5'`, `color: '#065F46'`
- RPC calls via `supabase.rpc('function_name', { p_param: value })` — snake_case param names
- `useRegistrationSetup` pattern: parallel fetch + cancellation guard — reuse for other lookup fetches
- `fetchUserProfile` join syntax: `.select('*, relation:table(col1, col2, nested:other_table(col))')`
