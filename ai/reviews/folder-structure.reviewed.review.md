# folder-structure.reviewed.review.md
**Status:** reviewed
**Reviewer:** Senior Software Engineer
**Date:** 2026-02-20

---

## MODULE OVERVIEW

**Domain:** Application Architecture
**Responsibility:** Defines the organizational blueprint of the entire codebase — how features, layers, and concerns are separated, discovered, and maintained over time.
**System Fit:** Everything in the app inherits risk or benefit from folder structure decisions. Poor organization here causes friction in every subsequent file added.

---

## STRENGTHS

- **Atomic Design implemented correctly at the component level.** `atoms/`, `molecules/`, `organisms/` are properly scoped. Button is atomic, FormField is a molecule wrapping Controller + Input, LoginForm is an organism with form state. This is sound and scales.
- **Feature-sliced `features/` directory.** Auth and notifications each own their service layer. This is the right instinct — if expanded properly it prevents a flat `services/` folder from becoming a dumping ground.
- **`core/` as a stable-utilities layer.** Placing theme, constants, and navigation guards in `core/` signals an intent to separate foundational cross-cutting concerns from feature business logic. Correct architectural move.
- **Expo Router file-based routing.** Using `(auth)`, `(app)`, and `(tabs)` groups leverages the router's native capabilities. Route group naming aligns with their access level.
- **TypeScript strict mode enabled.** `tsconfig.json` sets `strict: true`, `noUnusedLocals`, `noUnusedParameters`. The foundation for type safety is correctly enforced at the compiler level.

---

## ISSUES FOUND

### ARCHITECTURE VIOLATIONS

**1. Store lives outside the feature boundary**
`src/store/auth.store.ts` is a sibling to `src/features/auth/`. If the auth feature owns its service (`features/auth/services/auth.service.ts`), the store should also live inside `features/auth/store/auth.store.ts`. The current split creates an implicit coupling where the store imports the service from `features/` but lives outside it, violating the feature-slice boundary.

**2. `features/` is under-utilized — it's only a services folder**
`features/auth/` contains only `services/`. A feature slice should contain its own store, hooks, components, and types. The current structure starts a pattern it doesn't complete. As the app grows, devs will add feature-level components to `components/organisms/` instead of collocating them inside `features/`, causing organizational drift.

**3. `types/index.ts` is a global barrel for all types**
`User`, `Notification`, `ApiError`, `ButtonProps`, `CardProps`, `FormFieldProps` — domain-specific and UI types mixed together in one file. `ButtonProps` has no business being next to `AuthResponse`. This creates indiscriminate coupling: importing any one type pulls in the entire type surface.

**4. `App.tsx` at the root is a dead file**
With Expo Router, `src/app/_layout.tsx` is the real entry point. `App.tsx` at the project root is unused. Dead files at the root level mislead new team members and pollute the git tree.

**5. `backup/` directory tracked in git**
`.trae/` backup documents are in git history. These should be `.gitignore`d. Tracking design documents and backup files inflates the repo and may expose planning artifacts to external reviewers.

### CODE SMELLS

**6. `storybook/` at the root level, not inside `src/`**
Storybook configuration lives at the root while component stories (`Button.stories.tsx`) live inside `src/components/`. The storybook entry point (`storybook/index.ts`) is disconnected from the code it documents. Move to `src/.storybook/` or use Storybook's standard `/.storybook/` config pattern.

**7. Missing `hooks/` directory**
There is no `src/hooks/` directory. Route guards are placed in `core/navigation/route-guards.tsx` combining hook logic (`useRouteGuards`) and component wrappers (`ProtectedRoute`, `PublicRoute`). Hooks belong separated from components.

**8. No `api/` or `http/` layer**
`axios` and `@tanstack/react-query` are installed but no HTTP client is configured. There is no `src/api/` or `src/lib/axios.ts`. These dependencies are phantom — installed but unused. Either implement the layer or remove the dependencies.

**9. Missing test colocation**
`tests/` directory exists at the root but is empty. No test files colocated with source. In a production codebase, test files (`*.test.ts`, `*.spec.tsx`) should either colocate with source (`Button.test.tsx` next to `Button.tsx`) or mirror the `src/` structure inside `tests/`.

---

## ANTI-PATTERNS IDENTIFIED

- **God barrel:** `src/types/index.ts` exports all types globally with no domain grouping.
- **Dead code at root:** `App.tsx` is unused and misleading.
- **Phantom dependencies:** `axios`, `react-query` installed but not implemented.
- **Incomplete feature slicing:** Features own only services, not stores, hooks, or types.
- **Mixed concerns in `core/navigation/`:** Hook (`useRouteGuards`) and components (`ProtectedRoute`) in the same file.

---

## BEST-PRACTICE RECOMMENDATIONS

**Move stores inside feature boundaries:**
```
src/features/auth/
  store/auth.store.ts
  services/auth.service.ts
  hooks/useAuth.ts
  components/LoginForm.tsx  ← move from organisms
  types.ts
```

**Split `types/index.ts` by domain:**
```
src/types/
  auth.types.ts       ← User, AuthResponse, LoginCredentials
  notification.types.ts  ← Notification, NotificationType
  api.types.ts        ← ApiError, ApiResponse, PaginatedResponse
  ui.types.ts         ← ComponentProps, Status, AsyncState
```

**Add `src/lib/` for third-party adapters:**
```
src/lib/
  axios.ts      ← configured axios instance with interceptors
  queryClient.ts ← react-query QueryClient
```

**Gitignore cleanup:**
```gitignore
App.tsx        ← if permanently dead
backup/
*.jcgh*        ← appears to be a temp file in git status
```

---

## SUGGESTED REFACTOR PLAN

1. **Delete `App.tsx`** from root — confirm it's unused, then remove.
2. **Move domain types** out of `types/index.ts` into `features/<domain>/types.ts`.
3. **Move stores** from `src/store/` into their respective `features/<domain>/store/` directories.
4. **Create `src/lib/`** with configured axios instance and QueryClient.
5. **Move feature components** (LoginForm, NotificationItem) into `features/<domain>/components/`.
6. **Add `src/hooks/`** for shared cross-feature hooks.
7. **Remove or gitignore** backup and dead files.
8. **Colocate test files** with source or establish `tests/` mirror structure.
