# _index.reviewed.review.md
**Status:** reviewed
**Reviewer:** Senior Software Engineer
**Date:** 2026-02-20
**Project:** SME-Panindio (Enterprise Expo RN Boilerplate)
**Stack:** React Native · Expo SDK 54 · TypeScript · Expo Router · Zustand · React Hook Form · Yup

---

## REVIEW SCOPE

| Module | File | Status |
|---|---|---|
| Folder Structure | `ai/reviews/folder-structure.reviewed.review.md` | ✅ reviewed |
| Theme & Constants | `ai/reviews/theme-constants.reviewed.review.md` | ✅ reviewed |
| Store (State Management) | `ai/reviews/store.reviewed.review.md` | ✅ reviewed |
| Auth Module | `ai/reviews/auth.reviewed.review.md` | ✅ reviewed |
| Navigation & Guards | `ai/reviews/navigation.reviewed.review.md` | ✅ reviewed |
| Components (Atomic Design) | `ai/reviews/components.reviewed.review.md` | ✅ reviewed |
| Services Layer | `ai/reviews/services.reviewed.review.md` | ✅ reviewed |
| Screens / Pages | `ai/reviews/screens.reviewed.review.md` | ✅ reviewed |
| Types | `ai/reviews/types.reviewed.review.md` | ✅ reviewed |

---

## CRITICAL BUGS (App will crash or is broken by default)

These must be fixed before the app can function correctly. Listed in order of blast radius.

| # | Severity | Location | Issue |
|---|---|---|---|
| 1 | 🔴 CRITICAL | `theme/index.ts` + all components | Theme is flat strings; components access `primary[500]`, `gray[500]`, `white` — all `undefined`. Every component renders broken. |
| 2 | 🔴 CRITICAL | `store/index.ts` | `initializeOnboarding` exported but never defined → app crashes on every startup via `Promise.all`. |
| 3 | 🔴 CRITICAL | `notifications.tsx` | Calls `clearAll()` and `refreshNotifications()` — neither exists in the store. Screen crashes on mount. |
| 4 | 🔴 CRITICAL | `auth.store.ts` | `selectCurrentUser` not exported; `profile.tsx` imports it → profile screen broken. |
| 5 | 🔴 CRITICAL | `navigation/route-guards.tsx` | `useRouteGuards()` is never mounted — zero route protection active in the app. |
| 6 | 🔴 CRITICAL | `Input.tsx:96` | Syntax error: `theme.colors.gray[700 }]` — mismatched bracket, compile failure. |
| 7 | 🔴 CRITICAL | `auth.service.ts:68` | `APP_CONSTANTS.VALIDATION_CONSTANTS` is `undefined`; password validation never runs. |
| 8 | 🔴 CRITICAL | `notification.service.ts:80` | `projectId: 'your-project-id'` placeholder; push notifications broken on all physical devices. |
| 9 | 🔴 CRITICAL | `auth.store.ts:140-144` | Auth token persisted in unencrypted AsyncStorage AND SecureStore simultaneously. |
| 10 | 🔴 CRITICAL | `_layout.tsx:25` | `useEffect` cleanup for notification listener never registered — leaks listener on remount. |

---

## HIGH SEVERITY ISSUES (Significant functional gaps)

| # | Severity | Location | Issue |
|---|---|---|---|
| 11 | 🟠 HIGH | `constants/index.ts:126` | `Platform` import at bottom of file, after it is used. |
| 12 | 🟠 HIGH | `notifications.tsx:17` | `n.read` instead of `n.isRead` — unread count always equals total count. |
| 13 | 🟠 HIGH | `notifications.tsx:46` | `handleDismissNotification` calls `console.log` only — notification never deleted. |
| 14 | 🟠 HIGH | `route-guards.tsx` | Race condition: guards evaluate before AsyncStorage rehydration completes. |
| 15 | 🟠 HIGH | `route-guards.tsx:73-101` | `ProtectedRoute`, `PublicRoute`, `AuthRoute` are identical — no enforcement difference. |
| 16 | 🟠 HIGH | `notification.service.ts` | Async `initializeNotifications()` in constructor — failures silently swallowed. |
| 17 | 🟠 HIGH | `auth.service.ts:130-135` | `validateToken` checks for `'mock'` substring — always `false` for real tokens. |
| 18 | 🟠 HIGH | `profile.tsx:104` | `user?.role` — `User` type has no `role` field; always shows 'User'. |
| 19 | 🟠 HIGH | `Button.tsx`, `Input.tsx` | `theme.typography.sizes.base` doesn't exist → default font size `undefined`. |
| 20 | 🟠 HIGH | `Input.tsx:181` | `theme.typography.fontFamily` doesn't exist → `fontFamily: undefined`. |

---

## MEDIUM SEVERITY ISSUES (Code quality and correctness)

| # | Severity | Location | Issue |
|---|---|---|---|
| 21 | 🟡 MEDIUM | `store/index.ts:32` | `resetAllStores()` resets onboarding on logout — users re-shown onboarding after every logout. |
| 22 | 🟡 MEDIUM | `LoginForm.tsx` | yup schema says min 6 chars; `VALIDATION_CONSTANTS` says 8; service intends 8. Three thresholds. |
| 23 | 🟡 MEDIUM | `LoginForm.tsx` | `yupResolver` active + inline `rules` prop on Controller — redundant double validation. |
| 24 | 🟡 MEDIUM | `auth.store.ts:86` | `AsyncStorage.removeItem('auth-storage')` hardcodes the persist key — fragile on rename. |
| 25 | 🟡 MEDIUM | `auth.service.ts:79-83` | Hardcoded plaintext credentials in source (`password123`, `demo1234`, `testpass`). |
| 26 | 🟡 MEDIUM | `notification.service.ts:8` | `this.pushToken` duplicates store state — two sources of truth. |
| 27 | 🟡 MEDIUM | `notifications.tsx` | `ScrollView + map` for up to 100 notifications — no virtualization. |
| 28 | 🟡 MEDIUM | `profile.tsx:116` | `key={index}` on menu items — unstable render identity. |
| 29 | 🟡 MEDIUM | `notification.store.ts:112` | `loadNotifications` returns `notifications` but is typed as `Promise<void>`. |
| 30 | 🟡 MEDIUM | `notification.service.ts:47,199` | `lightColor: '#FF231F7C'` — suspicious 8-char value for Android LED color. |
| 31 | 🟡 MEDIUM | `Input.tsx:107` | `minHeight: 'auto'` — not a valid React Native style dimension. |
| 32 | 🟡 MEDIUM | `types/index.ts` | `ComponentProps.style?: any` — removes type safety on most-used prop. |
| 33 | 🟡 MEDIUM | `types/index.ts` | `Notification.createdAt: Date` — becomes string after JSON serialization in AsyncStorage. |
| 34 | 🟡 MEDIUM | `types/index.ts` | `ButtonProps.size` uses `'small'|'medium'|'large'`; `Button.tsx` uses `'sm'|'md'|'lg'`. |
| 35 | 🟡 MEDIUM | `notification.service.ts:109` | Badge always set to `1` regardless of actual unread count. |

---

## ARCHITECTURAL GAPS

| Gap | Description |
|---|---|
| No HTTP client configured | `axios` installed but no `AxiosInstance` with interceptors exists. Token injection, retry logic, and error normalization are absent. |
| No real API integration | 100% of network calls are mocked. The architecture promises a service layer but delivers stubs. |
| Features not feature-sliced | `features/` contains only services. Stores, hooks, and feature-level components live outside feature boundaries. |
| No React Query integration | `@tanstack/react-query` installed but `QueryClient` is not configured. No caching, deduplication, or background refetch. |
| No RBAC implementation | Route guards don't check roles. No role-based UI rendering. `User.role` is not even in the type. |
| No error boundary | No `ErrorBoundary` component. A thrown error in any component will crash the entire app with no recovery UI. |
| No test coverage | Jest configured but no tests exist. Zero coverage across a feature-complete boilerplate. |
| No CI/CD configuration | No GitHub Actions workflow for lint, type-check, or test on PR. |

---

## PRIORITY REFACTOR ROADMAP

### Phase 1 — Fix Crashes (Blockers)
1. Fix `initializeOnboarding` — add export or remove reference
2. Fix `selectCurrentUser` — add to auth store exports
3. Fix notification screen store method names (`clearNotifications`, `loadNotifications`)
4. Fix `Input.tsx:96` syntax error
5. Fix theme color access — either adopt color scale or fix component references
6. Mount `useRouteGuards()` in root layout
7. Fix `useEffect` cleanup for notification listener

### Phase 2 — Fix Security & Correctness
8. Remove `authToken` from AsyncStorage `partialize`
9. Fix `APP_CONSTANTS.VALIDATION_CONSTANTS` path in auth service
10. Gate mock credentials behind `__DEV__`
11. Fix `projectId` placeholder in notification service
12. Align password minimum across yup schema, service, and constants (all = 8)
13. Fix `n.read` → `n.isRead` in notifications screen
14. Fix `Platform` import to top of constants file

### Phase 3 — Architecture & Quality
15. Implement `useAppInit` hook to clean up root layout
16. Add hydration guard before route evaluation
17. Implement real HTTP client (`src/lib/axios.ts`) with token interceptor
18. Configure React Query `QueryClient`
19. Split `types/index.ts` into domain files
20. Move stores into `features/<domain>/` directories
21. Add `ErrorBoundary` at root
22. Replace `ScrollView + map` with `FlatList` in notifications
23. Add `role` to `User` type and implement basic RBAC in route guards
24. Write unit tests for stores, services, and utility functions

---

## WHAT IS WELL-IMPLEMENTED

Despite the volume of issues, the following represent genuine quality decisions worth preserving:

- **Atomic design component hierarchy** — correctly scoped and composed
- **Zustand `partialize`** — correct approach to selective persistence
- **`useForm` + `yupResolver` pattern** — correct form management architecture
- **Service class pattern with singleton exports** — right DI approach for React Native
- **`ONBOARDING_STEPS` as a data-driven config** — correct separation of content from logic
- **`AsyncState<T>` and `PaginatedResponse<T>` types** — correct domain modeling for async UI
- **`as const` on the theme object** — correct use of TypeScript literal inference
- **Expo Router file-based routing with route groups** — correctly leverages the router's native capabilities
- **`notificationService.handleNotificationResponse` as a separate method** — independently testable, correctly separated from listener registration
