---
name: Business Type Differentiation
description: Production vs Reseller business mode — types, helpers, feature gating across registration, inventory add, drawer nav, and inventory overview screens.
type: project
---

Two operation modes are now supported, gating production-only features.

**Why:** Reseller businesses (sari-sari store, grocery) do not use BOM, ingredients, raw materials, or production logs. Showing those features to resellers creates confusion and noise. Production businesses (bakery, restaurant, food stall) need all features.

**How to apply:** Always use `isProductionBusiness(user.businessOperationMode)` to gate features. Never compare category strings inline — the helpers are the single source of truth.

## Type System (src/types/index.ts)

```ts
export type BusinessOperationMode = 'production' | 'reseller';

export function getBusinessOperationMode(category: string): BusinessOperationMode
// 'food_beverage' → 'production'; everything else → 'reseller'

export function isProductionBusiness(mode: BusinessOperationMode): boolean
export function isResellerBusiness(mode: BusinessOperationMode): boolean
```

`User` now carries two optional fields:
- `businessTypeCategory?: string` — raw DB category string (e.g. 'food_beverage')
- `businessOperationMode?: BusinessOperationMode` — derived, persisted for offline use

`RegisterCredentials` now carries:
- `businessTypeCategory: string` — passed from the picker so the auth service can derive the mode without an extra DB call (critical for the email-confirmation-pending path where no session is returned)

## Registration / Onboarding

`useRegistrationSetup` (src/hooks/useRegistrationSetup.ts):
- Filters out `'services'` category from both DB and fallback data via `filterSupportedTypes()`
- Exports `groupedBusinessTypes: GroupedBusinessTypes` with `.production[]` and `.reseller[]` arrays
- Each item is `BusinessTypeWithMode extends BusinessType` with an `operationMode` field

`register.tsx`:
- Replaced `BusinessTypePickerModal` (flat list) with `GroupedBusinessTypeSheet` (two-section bottom sheet)
- Section 1: "I make my products" (food_beverage types) with 🍳 emoji
- Section 2: "I resell products" (retail/digital/other) with 🛒 emoji
- Each item shows description subtitle, POS badge, and checkmark
- `selectedBusinessTypeCategory` state tracked alongside RHF `businessTypeId` field
- Both passed to `RegisterCredentials` on submit

## Auth Service (src/features/auth/services/auth.service.ts)

- `fetchUserProfile` query now selects `category` from `business_types`: `business_type:business_types (name, category, pos_enabled)`
- All three User-building callsites (login, register, refreshToken) now include:
  ```ts
  businessTypeCategory: ...,
  businessOperationMode: getBusinessOperationMode(...),
  ```
- The `register()` path uses `credentials.businessTypeCategory` directly (no DB needed)

## Feature Gating

Default behavior when `businessOperationMode` is undefined (pre-existing users):
**defaults to 'production'** — no features are accidentally hidden.

### inventory/add.tsx
- `showProduction = isProductionBusiness(operationMode)`
- `IngredientSelector` and `RawMaterialSelector` wrapped in `{showProduction && <> ... </>}`
- `costPrice` helperText: 'Auto-calculated from ingredients' only shown when `showProduction && selectedIngredients.length > 0`

### inventory/index.tsx (category nav cards)
- Ingredients card: `{showProduction && <CategoryNavCard ... />}`
- Production Log, Consumption Logs, Raw Materials cards: all wrapped in `{showProduction && <> ... </>}`

### AppDrawer.tsx
- Nav items split into `baseNavItems`, `productionNavItems`, `tailNavItems`
- Final `navItems = [...base, ...(showProduction ? production : []), ...tail]`
- `inventory-ingredients` is in `productionNavItems`

## Unsupported Categories

`'services'` category is excluded from the registration picker. Affected types:
Beauty Salon, Laundry Shop, Printing Shop, Repair Shop, Carwash, Catering Services.
These require appointment/booking flows not yet implemented.
