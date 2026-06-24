# Structure Refactor — Option B (High-Value, Low-Risk Consolidation)

**Date:** 2026-06-24
**Scope:** Option B only. NOT a full feature-based migration (Option A). Expo Router (`src/app/`) left structurally intact.
**Baseline:** `npx tsc --noEmit` reports **22 pre-existing errors** (see "Baseline" below). These are intentionally **left untouched**. Success criterion: after the refactor, the error count is still **exactly the same 22** — no new (regression) errors introduced.

---

## Baseline (pre-existing errors — DO NOT FIX, used as regression detector)

These 22 errors existed before any change. They must remain (unchanged) at the end; anything beyond them is a regression I introduced.

- `database/migrations/022_add_vat_columns.ts(60,28)` TS6133 `db` unused
- `database/repositories/raw_materials.repository.ts(650,5)` TS2345 string[] vs SQLiteBindValue
- `src/app/(app)/(tabs)/inventory/raw-materials/add.tsx(126,9)` TS6133 `insets` unused
- `src/app/(app)/(tabs)/overhead.tsx(48,10)` TS6133 `SafeAreaView` unused
- `src/app/(app)/(tabs)/overhead.tsx(88,1)` TS6133 `OverheadFilters` unused
- `src/app/(app)/(tabs)/utilities.tsx(66,15)` TS6196 `UtilityMonthlySummary` unused
- `src/components/atoms/BrandLogo/BrandLogo.stories.tsx` — Storybook v7 `Meta`/`StoryObj`/implicit any (4 errors)
- `src/components/molecules/DatePickerField/DatePickerField.stories.tsx` — Storybook v7 (3 errors)
- `src/components/molecules/ListItem.stories.tsx(137,12)` TS2375 exactOptionalPropertyTypes
- `src/components/molecules/PhoneInput/PhoneInput.stories.tsx` — Storybook v7 (3 errors)
- `src/components/molecules/ROIScenarioCard/ROIScenarioCard.stories.tsx` — Storybook v7 (3 errors)
- `src/components/organisms/ManualEntryBottomSheet.tsx(554,11)` TS6133 `handleBg` unused

> Note: the Storybook `Meta`/`StoryObj` failures are a dependency/version mismatch (installed `@storybook/react-native` v7), NOT a structural issue. Out of scope by direction.

---

## Runtime alias resolution note (important safety fact)

There is **no `babel-plugin-module-resolver`** in `babel.config.js`. Metro (Expo SDK 54) resolves `@/*` aliases natively from **`tsconfig.json` `paths`**. Therefore:
- Adding a new alias requires only a `tsconfig.json` `paths` entry — Metro picks it up.
- Moving a folder into `src/` and pointing an alias at it is the **safest** way to make it importable (no resolver config drift).

---

## Migration moves (planned)

1. **`database/` (repo root) → `src/database/`** + new `@/database/*` alias. Eliminates `../../database`, `../../../database`, `../../../../database`, `../../../../../database` relative climbs (17 files).
2. **`src/lib/api.ts` → `src/core/api/api.ts`**, **`src/lib/vat.ts` → `src/core/vat.ts`**. Consolidates infra into `core/`. Consumers `@/lib/*` → `@/core/api` / `@/core/vat`.
3. **`src/services/product.service.ts` → `src/core/services/product.service.ts`**. Removes orphan top-level `src/services/`. Consumer `@/services/product.service` → `@/core/services/product.service`.
4. **`src/utils/*` → `src/core/utils/*`**. Merges duplicate util roots (`src/utils` + `src/core/utils`). Consumers `@/utils/*` → `@/core/utils/*`.
5. **Flesh out existing `features/`**: co-locate feature-owned stores/types into their feature folders (auth, customer, business-suki, notifications) — only existing features, none invented.
6. **Barrels**: add `index.ts` barrels where they reduce import churn (database, core).

---

## Before structure (verified)

```
repo-root/
  database/                 <-- AT ROOT (imported via ../../database etc.)
    database.ts initDatabase.ts registry/ migrations/ repositories/ schemas/
  src/
    app/                    <-- Expo Router (auth)/(app)/(tabs)/(customer)
    components/ atoms molecules organisms
    core/ constants navigation theme utils
    features/ auth business-suki customer notifications  (services only)
    hooks/
    i18n/
    lib/ api.ts vat.ts
    services/ product.service.ts   <-- orphan
    store/ (25 flat stores)
    types/
    utils/ bomValidation ingredientPreflight unitConversion
```

## After structure

```
repo-root/
  src/
    app/                    <-- Expo Router — UNCHANGED (routing intact)
    components/ atoms molecules organisms
    core/
      api/      api.ts + index.ts barrel   (was src/lib/api.ts)
      services/ product.service.ts + index.ts barrel  (was src/services/)
      utils/    targetSalesAllocation.ts + bomValidation.ts + ingredientPreflight.ts + unitConversion.ts  (merged src/utils/)
      vat.ts                                (was src/lib/vat.ts)
      constants/ navigation/ theme/
    database/               <-- MOVED IN from repo root; alias @/database/*
      database.ts initDatabase.ts registry/ migrations/ repositories/ schemas/
    features/
      auth/          services/ + store/(auth.store) + index barrel
      business-suki/ services/ + order-status.ts + store/(suki_business, business_orders, business_search) + index barrel
      customer/      services/ + store/(suki, online_orders) + index barrel
      notifications/ services/ + store/(notification) + index barrel
    hooks/
    i18n/
    store/                  <-- app-wide infra stores remain (inventory, pos, roi, dashboard,
                                credit, production, raw_materials, utilities, overhead, sales_target,
                                target_sales_allocation, vat, theme, language, onboarding, business_roi,
                                ingredient_consumption, raw_material_consumption_logs) + index.ts barrel
    types/
  (removed) database/ at repo root
  (removed) src/lib/  src/services/  src/utils/  src/common/  (empty)
```

**Stores deliberately LEFT in `src/store/`** (app-wide infrastructure / boot / cross-cutting, not owned by a single existing feature): `inventory, pos, roi, business_roi, dashboard, credit, production, raw_materials, raw_material_consumption_logs, ingredient_consumption, utilities, overhead_expenses, sales_target, target_sales_allocation, vat, theme, language, onboarding`. Moving these would require inventing new feature folders (e.g. `inventory`, `pos`, `finance`) which is **Option A** and explicitly out of scope. `onboarding` is boot/routing infra and stays for the same reason.

The `@/store` barrel (`src/store/index.ts`) still re-exports every store — including the relocated feature stores via `@/features/...` paths — so the **80 existing `@/store` barrel consumers were not touched**. Only the barrel's internal `from './x.store'` lines and the handful of direct `@/store/x.store` importers were updated.

---

## File-move table (old → new + why)

| # | Old path | New path | Why |
|---|----------|----------|-----|
| 1 | `database/**` (repo root, 63 files) | `src/database/**` | Root-level infra was imported via `../../database` … `../../../../../database`. Now inside `src/`, importable via `@/database/*`. Removes the worst relative-climb smell. |
| 2 | `src/lib/api.ts` | `src/core/api/api.ts` (+ `index.ts` barrel) | `lib/` overlapped `core/` (infrastructure). Axios client is platform/infra → `core/api`. |
| 3 | `src/lib/vat.ts` | `src/core/vat.ts` | Same `lib`→`core` consolidation. VAT calc is a cross-cutting domain util. |
| 4 | `src/services/product.service.ts` | `src/core/services/product.service.ts` (+ barrel) | Orphan top-level `services/` sibling of `features/*/services`. Domain-neutral (reads inventory repo) → `core/services`. Not a member of any existing feature, so not placed in a feature. |
| 5 | `src/utils/bomValidation.ts` | `src/core/utils/bomValidation.ts` | `src/utils` duplicated `src/core/utils`. Merged into one. |
| 6 | `src/utils/ingredientPreflight.ts` | `src/core/utils/ingredientPreflight.ts` | Same merge. |
| 7 | `src/utils/unitConversion.ts` | `src/core/utils/unitConversion.ts` | Same merge. Consumed by `src/database` repos + `IngredientSelector`. |
| 8 | `src/store/auth.store.ts` | `src/features/auth/store/auth.store.ts` (+ barrel) | Already imported `@/features/auth/services/auth.service`; belongs in the auth feature. |
| 9 | `src/store/suki.store.ts` | `src/features/customer/store/suki.store.ts` (+ barrel) | Customer-side suki session; `customer` feature already existed. |
| 10 | `src/store/online_orders.store.ts` | `src/features/customer/store/online_orders.store.ts` | Customer online-ordering cart/orders. |
| 11 | `src/store/suki_business.store.ts` | `src/features/business-suki/store/suki_business.store.ts` (+ barrel) | Business-owner suki state; `business-suki` feature existed. |
| 12 | `src/store/business_orders.store.ts` | `src/features/business-suki/store/business_orders.store.ts` | Business incoming-orders state. |
| 13 | `src/store/business_search.store.ts` | `src/features/business-suki/store/business_search.store.ts` | Business search state. |
| 14 | `src/store/notification.store.ts` | `src/features/notifications/store/notification.store.ts` (+ barrel) | Already imported `@/features/notifications/services`; belongs in the notifications feature. |
| 15 | `src/common/**` (empty dirs) | (removed) | Empty dead scaffolding with a dead `@/common/*` alias. |

> All 15 moves performed with rename detection preserved in git (`git status` shows `R` for every relocated file). The big `database/` folder was relocated with `Move-Item` (a `git mv` hit a Windows file lock from the running Metro/node watchers — see Risks), then re-detected by git as renames.

---

## Aliases / barrels / imports updated

**tsconfig.json `paths`:**
- ADDED `"@/database/*": ["src/database/*"]`
- REMOVED `"@/services/*": ["src/services/*"]` (folder gone, no consumers)
- REMOVED `"@/common/*": ["src/common/*"]` (empty folder removed, no consumers)
- Unchanged: `@/*`, `@/components/*`, `@/features/*`, `@/store/*`, `@/types/*`, `@/core/*`

**Runtime resolution:** verified there is **no babel module-resolver** — Metro (Expo SDK 54) resolves these aliases from `tsconfig.json paths` natively, so the tsconfig edits are sufficient for both typecheck and runtime. The new `@/database` and `@/core/*` paths resolve through the existing `@/*` → `src/*` catch-all even independent of their explicit entries, giving belt-and-suspenders coverage.

**New barrels created:**
- `src/core/api/index.ts` → re-exports `./api`
- `src/core/services/index.ts` → re-exports `./product.service`
- `src/features/auth/store/index.ts` → re-exports `./auth.store`
- `src/features/customer/store/index.ts` → re-exports `./suki.store`, `./online_orders.store`
- `src/features/business-suki/store/index.ts` → re-exports the 3 business stores
- `src/features/notifications/store/index.ts` → re-exports `./notification.store`

**Import rewrites (by category):**
- `../database/…` → `@/database/…` — 21 files
- `@/lib/api` → `@/core/api`, `@/lib/vat` → `@/core/vat` — 15 files
- `@/services/product.service` → `@/core/services/product.service` — 1 file (`pos.tsx`)
- `@/utils/…` → `@/core/utils/…` — 5 files (incl. 2 `src/database` repos)
- Feature-store relocations — updated `src/store/index.ts` barrel lines + direct importers (`src/app/index.tsx`, `src/core/navigation/useStoresHydrated.ts`, `src/hooks/useAuth.ts`)

**Expo Router (`src/app/`):** no route files moved, no route groups renamed, no `_layout.tsx` relocated. Only import statements *inside* a few route files were updated (alias swaps). Routing graph unchanged.

---

## Checklist (auditable — kept in sync with execution)

- [x] 0. Capture baseline tsc (22 errors) — DONE pre-work
- [x] 1a. Move `database/` → `src/database/` (Move-Item; git detected as rename, history preserved)
- [x] 1b. Add `@/database/*` alias to tsconfig
- [x] 1c. Rewrite all `../database`-style imports → `@/database/...` (21 files touched)
- [x] 1d. Internal `database/` relative imports were all `./`-relative — survived move intact
- [x] 1e. Typecheck == 22 (2 former `database/*` errors now reported under `src/database/*`; no new errors)
- [x] 2a. Move `src/lib/api.ts` → `src/core/api/api.ts`; `src/lib/vat.ts` → `src/core/vat.ts`; removed empty `src/lib/`
- [x] 2b. Update `@/lib/*` consumers → `@/core/api` / `@/core/vat` (15 files)
- [x] 2c. Add `src/core/api/index.ts` barrel
- [x] 2d. Typecheck == 22 (no lib/core/api/vat errors)
- [x] 3a. Move `src/services/product.service.ts` → `src/core/services/product.service.ts`; removed empty `src/services/`; added `src/core/services/index.ts` barrel
- [x] 3b. Update consumer `@/services/product.service` → `@/core/services/product.service` (pos.tsx)
- [x] 3c. Removed dead `@/services/*` tsconfig path (no longer referenced). Left `@/common/*` (pre-existing dead alias, out of scope)
- [x] 3d. Typecheck == 22
- [x] 4a. Move `src/utils/*` (bomValidation, ingredientPreflight, unitConversion) → `src/core/utils/*`; removed empty `src/utils/`
- [x] 4b. Update `@/utils/*` consumers → `@/core/utils/*` (5 files incl. 2 `src/database` repos)
- [x] 4c. Typecheck == 22
- [x] 5a. Co-locate feature stores into existing features (auth, customer, business-suki, notifications) + barrels; left app-wide infra stores in `src/store/`; left monolithic `src/types/index.ts` intact (splitting it is Option A)
- [x] 5b. Typecheck == 22 after each feature batch
- [x] 5c. Removed empty `src/common/` + dead `@/common/*` alias
- [x] 6. Final full typecheck — error SET proven identical to baseline (sorted diff = empty); ZERO regressions

---

## Verification result

- **Baseline:** 22 pre-existing errors.
- **Final `npx tsc --noEmit`:** 22 errors. Sorted set-diff (normalizing the `database/` → `src/database/` path prefix) against baseline is **empty** — the error set is identical. The only changes are (a) two errors now reported under `src/database/*` instead of root `database/*`, and (b) tsc emission ordering. **No new (regression) errors.**
- Error-code tally identical both runs: 8×TS2305, 1×TS2345, 1×TS2375, 5×TS6133, 1×TS6196, 5×TS7006.
- Reference sweep: zero remaining `@/lib`, `@/services`, bare `@/utils/`, `@/common`, `../database`, or old `@/store/<moved>.store` references in `src/`.
- ESLint: project has **no ESLint config file** (`ESLint couldn't find a configuration file`) — pre-existing condition, unrelated to this refactor; `tsc` is the authoritative gate.

## Risks & follow-ups

**Risks (mitigated):**
- *Windows file lock during folder move* — running Metro/node watchers held `database/`, so `git mv` failed with EPERM. Mitigated by `Move-Item` (succeeded) then `git add -A` (git re-detected renames; history preserved). No data loss. If re-running, stop the dev server first or use `Move-Item`.
- *Runtime alias resolution* — no babel resolver; confirmed Metro uses tsconfig paths. The moved code also resolves via the `@/*` catch-all, so resolution is doubly safe. **Recommended manual smoke test:** start the app (`expo start`) and the DB-backed screens (inventory, POS, dashboard) + the suki/customer flows, since `@/database` and the relocated feature stores are exercised at runtime.
- *Storybook* — `.storybook/` and root `storybook/` were not touched; no story files moved. Story imports of components were untouched (components did not move).

**Follow-ups (deliberately deferred — out of Option B scope):**
1. The 22 pre-existing errors remain (esp. Storybook v7 `Meta`/`StoryObj` — a dependency/version mismatch; `@storybook/react-native` v7 doesn't export those CSF3 types). Fix as a separate, isolated task.
2. Full Option A feature migration: the 18 app-wide stores in `src/store/` could move into new feature folders (`inventory`, `pos`, `finance`, `roi`, etc.) and the monolithic `src/types/index.ts` could be split per-domain. Larger blast radius; defer until desired.
3. Consider co-locating `src/features/business-suki/order-status.ts` under a `business-suki/utils/` or `/constants/` subfolder for internal tidiness (cosmetic; 2 importers).
4. `src/hooks/` (`useAuth`, etc.) could later move feature-owned hooks into their features (Option A).
