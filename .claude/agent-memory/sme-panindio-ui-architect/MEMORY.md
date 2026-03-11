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

## Storybook Notes
- Storybook folder excluded from tsconfig — story files will show TS errors in `tsc --noEmit` (expected)
- Story files use `Meta`/`StoryObj` from `@storybook/react-native` which has different typings

## Key Patterns
- Use inline SVG via `react-native-svg` (v15.12.1 installed) for illustrations
- Brand colour constants defined as `const NAVY = '#1E4D8C'` inside screen files
- Picker modals: `FlatList` inside bottom-sheet `Modal`; `keyboardShouldPersistTaps="handled"`
- POS badge chip: `backgroundColor: '#D1FAE5'`, `color: '#065F46'`
- RPC calls via `supabase.rpc('function_name', { p_param: value })` — snake_case param names
- `useRegistrationSetup` pattern: parallel fetch + cancellation guard — reuse for other lookup fetches
- `fetchUserProfile` join syntax: `.select('*, relation:table(col1, col2, nested:other_table(col))')`
