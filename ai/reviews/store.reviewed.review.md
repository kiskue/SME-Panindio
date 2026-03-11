# store.reviewed.review.md
**Status:** reviewed
**Reviewer:** Senior Software Engineer
**Date:** 2026-02-20

---

## MODULE OVERVIEW

**Domain:** Global State Management
**Responsibility:** Manages auth session, notifications, and onboarding state using Zustand with AsyncStorage persistence. Provides selectors, helper functions, and coordinated initialization via `store/index.ts`.
**System Fit:** The store is the single shared memory of the app. Bugs here affect every consumer — screens, guards, and services.

---

## STRENGTHS

- **Selector pattern adopted correctly.** `selectAuth`, `selectAuthLoading`, `selectNotifications`, etc. follow the Zustand selector convention for granular subscriptions. When consumers use these, they avoid re-rendering on unrelated state changes.
- **`partialize` used to limit persistence scope.** Only relevant state keys are persisted (e.g., auth token, user, notifications). Transient state like `isLoading` and `error` is not stored. This is the correct pattern.
- **Centralized initialization with `Promise.all`.** `initializeStores()` runs all store initializations in parallel, reducing startup latency. The pattern is correct.
- **`addNotification` enforces a 100-notification cap.** Preventing unbounded growth of the notifications array in AsyncStorage is a thoughtful production consideration.
- **`markAllAsRead` and `deleteNotification` are pure immutable updates.** Using `.map()` and `.filter()` with spread avoids direct mutation, consistent with Zustand's update model.

---

## ISSUES FOUND

### BUGS

**1. CRITICAL: `selectCurrentUser` is not exported but is used in `profile.tsx`**
`auth.store.ts` exports: `selectAuth`, `selectAuthLoading`, `selectAuthError`. It does **not** export `selectCurrentUser`.
`profile.tsx:5` imports:
```ts
import { useAuthStore, selectCurrentUser } from '@/store';
```
`selectCurrentUser` resolves to `undefined`. Calling `useAuthStore(undefined)` returns the entire store object rather than a selector result — or throws depending on Zustand's version behavior. This means the profile screen either crashes or renders no user data.

**Fix:**
```ts
// auth.store.ts
export const selectCurrentUser = (state: AuthState) => state.user;
```

**2. CRITICAL: `initializeOnboarding` is exported from `store/index.ts` but never defined in `onboarding.store.ts`**
`store/index.ts:4`:
```ts
export { ..., initializeOnboarding } from './onboarding.store';
```
No `initializeOnboarding` function exists in `onboarding.store.ts`. This is a named export of `undefined`. Calling `initializeOnboarding()` in `initializeStores()` via `Promise.all` throws `TypeError: initializeOnboarding is not a function` on every app startup.

**Fix:** Either add the function to the store:
```ts
export const initializeOnboarding = async (): Promise<void> => {
  // Onboarding state rehydrates automatically via persist middleware
  // No explicit initialization needed
};
```
Or remove it from `store/index.ts` and from the `Promise.all` call.

**3. CRITICAL: Token stored in both SecureStore AND AsyncStorage**
`auth.store.ts` line 48 writes the token to SecureStore:
```ts
await SecureStore.setItemAsync(APP_CONSTANTS.TOKEN_KEY, response.token);
```
AND lines 140-144 persist the token to AsyncStorage via Zustand's `partialize`:
```ts
partialize: (state) => ({
  user: state.user,
  isAuthenticated: state.isAuthenticated,
  authToken: state.authToken,  // ← also written to AsyncStorage
}),
```
AsyncStorage on Android is stored in plaintext in the app's SQLite database. The token is available unencrypted. This negates the purpose of SecureStore.

**Fix:** Remove `authToken` from `partialize`. The token should be read exclusively from SecureStore on initialization via `initializeAuth()`. Only `user` and `isAuthenticated` (or none at all — recompute from token) need persistence.

**4. `loadNotifications` has a type violation — returns value from a `Promise<void>`**
`notification.store.ts:99`:
```ts
loadNotifications: async () => { ... return notifications; }
```
The interface declares `loadNotifications: () => Promise<void>`. The return value is silently discarded. TypeScript should flag this with `noImplicitReturns` enabled. If callers ever try to use the return value, they get `void`.

**Fix:** Either change the return type to `Promise<Notification[]>` or remove the `return` statement.

**5. `resetAllStores` resets onboarding on logout — UX regression**
`store/index.ts:32`:
```ts
resetOnboarding();
```
Called inside `resetAllStores()` which runs on logout. This means every time a user logs out, they will see the onboarding flow again on next app open. For a multi-user device scenario, resetting onboarding may be intentional, but in a standard SaaS app it is a serious UX regression. Onboarding completion is a device-level state, not a session-level state.

**Fix:** Remove `resetOnboarding()` from `resetAllStores()`. Onboarding should be reset only on explicit account deletion or device wipe.

### LOGIC PROBLEMS

**6. Race condition between `initializeStores` and `useRouteGuards`**
`_layout.tsx` calls `initializeStores()` inside a `useEffect`. Zustand's `persist` middleware rehydrates asynchronously from AsyncStorage. If `useRouteGuards` runs before rehydration completes, `isAuthenticated()` returns `false` (initial state), triggering a redirect to `/auth/login` even for authenticated users.

`initializeAuth()` reads from SecureStore but only calls `setToken()` — it doesn't set `isAuthenticated: true`. So even if SecureStore has a token, the guard sees `isAuthenticated === false` from AsyncStorage hydration lag.

**Risk:** Authenticated users get flashed to the login screen on every cold start.

**Fix:** Gate navigation rendering on a rehydration flag:
```ts
const [isHydrated, setIsHydrated] = useState(false);
useEffect(() => {
  useAuthStore.persist.onFinishHydration(() => setIsHydrated(true));
}, []);
if (!isHydrated) return <SplashScreen />;
```

**7. `setLoading` and `setToken` exposed as public store actions**
These are implementation details of `login()` and `initializeAuth()`. Exposing them publicly allows any consumer to set loading or inject tokens without going through the validation logic in `login()`. This breaks encapsulation.

**Fix:** Remove `setLoading` and `setToken` from the `AuthState` interface. Keep them internal to the store closure.

### CODE SMELLS

**8. `logout` hardcodes the AsyncStorage key `'auth-storage'`**
`auth.store.ts:86`:
```ts
await AsyncStorage.removeItem('auth-storage');
```
The key `'auth-storage'` is the `name` passed to the `persist` middleware on line 138. If the middleware key ever changes, this hardcoded string becomes stale silently. The correct approach is `useAuthStore.persist.clearStorage()`.

**9. `createSampleNotification` has a hardcoded `userId`**
`notification.store.ts:165`: `userId: 'sample-user-id'`. This is a test utility that leaks into production code. It should be either removed from the store or accept a `userId` parameter derived from the auth store.

**10. `isAuthenticated`, `getAuthToken`, `getCurrentUser` are helpers that bypass React's subscription model**
These functions call `useAuthStore.getState()` synchronously. They are useful for non-React contexts (services, guards), but are named like React hooks (`isAuthenticated` should be `getIsAuthenticated` to prevent confusion with `useIsAuthenticated` hook patterns). The naming violates React naming conventions for state-reading functions.

---

## ANTI-PATTERNS IDENTIFIED

- **Dual storage for the same value (token in SecureStore + AsyncStorage).** Classic security anti-pattern.
- **Public exposure of internal state setters (`setLoading`, `setToken`, `setUser`).** Breaks encapsulation.
- **Cross-store coupling in `resetAllStores`.** `logout()` triggering `resetOnboarding()` is an implicit side effect.
- **Missing selector causes `useAuthStore(undefined)` call.** Runtime error in profile screen.
- **Undefined function exported (`initializeOnboarding`).** Runtime crash on startup.

---

## BEST-PRACTICE RECOMMENDATIONS

**Minimal, clean AuthState interface:**
```ts
export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: ApiError | null;
  // Only expose business-level actions:
  login: (credentials: LoginCredentials) => Promise<void>;
  logout: () => Promise<void>;
  updateProfile: (userData: Partial<User>) => void;
  clearError: () => void;
}
```

**Token should not appear in state at all:**
Store only `user` and `isAuthenticated`. Read the token from SecureStore in interceptors:
```ts
// lib/axios.ts
instance.interceptors.request.use(async (config) => {
  const token = await SecureStore.getItemAsync(TOKEN_KEY);
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});
```

**Handle hydration before routing:**
```ts
// _layout.tsx
const hasHydrated = useAuthStore(state => state._hasHydrated);
```

---

## SUGGESTED REFACTOR PLAN

1. **Add `selectCurrentUser`** to `auth.store.ts` exports immediately — this is a production crash.
2. **Add `initializeOnboarding`** to `onboarding.store.ts` or remove its reference — app crashes on startup.
3. **Remove `authToken` from `partialize`** — eliminate insecure token storage in AsyncStorage.
4. **Remove `setLoading`, `setToken`, `setUser`** from the public `AuthState` interface.
5. **Fix `logout` to use `useAuthStore.persist.clearStorage()`** instead of hardcoded key.
6. **Remove `resetOnboarding()` from `resetAllStores()`** — decouple logout from onboarding state.
7. **Fix `loadNotifications` return type** — `Promise<void>` vs returning `notifications`.
8. **Implement hydration guard** in `_layout.tsx` before routing logic runs.
9. **Move `createSampleNotification`** to a test utility file outside the store.
