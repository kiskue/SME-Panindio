# navigation.reviewed.review.md
**Status:** reviewed
**Reviewer:** Senior Software Engineer
**Date:** 2026-02-20

---

## MODULE OVERVIEW

**Domain:** Navigation & Routing
**Responsibility:** Defines the app's screen hierarchy using Expo Router file-based routing, enforces route protection via `useRouteGuards`, and provides layout wrappers for each route group.
**System Fit:** Navigation is the structural skeleton of the app. Incorrect guard logic exposes protected screens or locks out valid users. The routing layer spans `src/app/_layout.tsx`, `src/app/(auth)/_layout.tsx`, `src/app/(app)/_layout.tsx`, `src/app/(app)/(tabs)/_layout.tsx`, and `src/core/navigation/route-guards.tsx`.

---

## STRENGTHS

- **File-based routing with Expo Router.** Using route groups `(auth)` and `(app)` with `_layout.tsx` per group is the canonical Expo Router pattern. It maps mental models to filesystem structure cleanly.
- **`GestureHandlerRootView` at the root layout.** Correctly wrapping the entire app for gesture support.
- **`SafeAreaProvider` at the root.** Applied once at the root, consumed by individual screens with `useSafeAreaInsets` or `SafeAreaView`. Correct placement.
- **`useRouteGuards` returns `isChecking` state.** The guard exposes a loading flag to prevent flash-of-wrong-content during async checks. The intent is correct.
- **Stack navigator configured with consistent slide animation.** `animation: 'slide_from_right'` and `gestureEnabled: true` applied globally — consistent native UX.
- **Notification response listener set up in root layout.** Correct placement for a global listener that should persist for the app's lifetime.

---

## ISSUES FOUND

### BUGS

**1. CRITICAL: `useRouteGuards` is never invoked — route protection is not active**
`route-guards.tsx` exports `useRouteGuards()`, `ProtectedRoute`, `PublicRoute`, and `AuthRoute`. None of these are imported or used in any `_layout.tsx` file. The root layout (`src/app/_layout.tsx`) does not call `useRouteGuards()`. There is no route protection active in the app.

An unauthenticated user can directly navigate to `/app/(tabs)/home` without being redirected. An authenticated user who completes onboarding is never redirected to the app.

**Risk:** Complete failure of the authentication perimeter. This is the highest severity navigation issue.

**Fix:** Call `useRouteGuards()` in the root layout:
```tsx
// src/app/_layout.tsx
export default function RootLayout() {
  const { isChecking } = useRouteGuards();
  // ...
  if (isChecking) return <SplashScreen />;
  return ( ... );
}
```

**2. CRITICAL: Race condition — guards run before store rehydration completes**
`useRouteGuards` calls `isAuthenticated()` and `isOnboardingCompleted()` which are synchronous reads of Zustand state. The `useEffect` in `_layout.tsx` that calls `initializeStores()` runs asynchronously. Zustand's `persist` middleware also rehydrates asynchronously.

When the guard runs immediately on mount, both `isAuthenticated()` and `isOnboardingCompleted()` return their initial values (`false` and `false`) before AsyncStorage has been read. This causes:
- Every user redirected to `/onboarding` on cold start regardless of actual state.
- Or alternately, authenticated users flashed to `/auth/login`.

**Risk:** Broken routing behavior on every cold start for users with existing sessions.

**Fix:** Gate the route guard evaluation on Zustand hydration completion:
```ts
const isHydrated = useAuthStore(s => s._hasHydrated);
useEffect(() => {
  if (!isHydrated) return;
  checkAuth();
}, [segments, router, isHydrated]);
```
And set `_hasHydrated` via `onFinishHydration`:
```ts
useAuthStore.persist.onFinishHydration(() =>
  useAuthStore.setState({ _hasHydrated: true })
);
```

**3. Guard condition covers too broad a scope — app root `/` is unhandled**
`route-guards.tsx:43`:
```ts
if (!onboardingCompleted && !isOnboardingRoute && !inAuthGroup) {
  router.replace('/onboarding');
}
```
This condition fires when `segments[0]` is `undefined` (the initial render before any route is matched). The condition `!inAuthGroup` and `!isOnboardingRoute` are both `true` when `segments` is empty, so the guard immediately redirects to `/onboarding` before the router even determines the initial route.

**4. `router.replace('/app/(tabs)/home')` — route path does not match file structure**
`route-guards.tsx:38`:
```ts
router.replace('/app/(tabs)/home');
```
The home tab is at `src/app/(app)/(tabs)/index.tsx` — note the nested group `(app)/(tabs)`. The correct Expo Router path would be `/(app)/(tabs)/` or the named route `/` (index). The path `/app/(tabs)/home` may not resolve correctly.

Similarly, `NAVIGATION_CONSTANTS.HOME` in constants is `/app/(tabs)/home` — this route string is inconsistent with the actual file path `(app)/(tabs)/index.tsx`.

**5. Cleanup function from `addNotificationResponseReceivedListener` is discarded**
`_layout.tsx:25`:
```ts
return () => subscription.remove();
```
This cleanup is returned from `initializeApp()` — the inner async function — not from the `useEffect` callback itself. The `useEffect` callback `() => { initializeApp(); }` does not return anything. The cleanup is never registered with React.

**Risk:** The notification listener is never removed. On hot reload or component remount, duplicate listeners accumulate.

**Fix:**
```ts
useEffect(() => {
  let subscription: Notifications.Subscription;
  const init = async () => {
    await initializeStores();
    await notificationService.createNotificationChannels();
    subscription = notificationService.addNotificationResponseReceivedListener(
      (response) => notificationService.handleNotificationResponse(response)
    );
  };
  init();
  return () => subscription?.remove();
}, []);
```

### LOGIC PROBLEMS

**6. `ProtectedRoute`, `PublicRoute`, `AuthRoute` are identical components**
All three wrapper components in `route-guards.tsx:73-101` have exactly the same implementation — they call `useRouteGuards()` and render children when not checking. They provide zero differentiation. A `PublicRoute` does not enforce that the user is unauthenticated; it just shows a spinner. The names imply access control they do not implement.

**Risk:** False security confidence. A developer using `<ProtectedRoute>` believes the content is guarded; it is not.

**Fix:** Implement actual guards in each:
```tsx
export const ProtectedRoute = ({ children }) => {
  const { isChecking } = useRouteGuards();
  const isAuth = useAuthStore(s => s.isAuthenticated);
  if (isChecking) return <LoadingSpinner />;
  if (!isAuth) return null; // Guard redirects via useRouteGuards
  return <>{children}</>;
};
```

**7. `notificationService` imported directly into layout — tight coupling**
`_layout.tsx:7-8`:
```ts
import { notificationService } from '@/features/notifications/services/notification.service';
import { useNotificationStore } from '@/store';
```
The `useNotificationStore` is imported but never used in `_layout.tsx`. The notification listener setup should be abstracted into a hook (`useNotificationSetup`) rather than inline async logic in the layout.

### CODE SMELLS

**8. `isChecking` starts as `true` but returns `null` in guard components**
When `isChecking === true`, `ProtectedRoute` returns `null`. This causes a blank screen flash. Should return a proper loading component:
```tsx
if (isChecking) return <LoadingSpinner fullScreen />;
```

**9. Unused import: `useNotificationStore` in `_layout.tsx`**
Line 8 imports `useNotificationStore` but it is never referenced in the file. This will be caught by `noUnusedLocals` in TypeScript, causing a compile error.

---

## ANTI-PATTERNS IDENTIFIED

- **Guard hook defined but never mounted.** The protection exists only as dead code.
- **Three identical wrapper components with different names.** Semantic illusion of access control.
- **Async cleanup returned from inner function, not from `useEffect`.** Classic React cleanup anti-pattern.
- **Synchronous guard reads on async-rehydrated state.** Race condition by design.
- **Direct service import in layout.** Layout should delegate to hooks, not orchestrate services directly.

---

## BEST-PRACTICE RECOMMENDATIONS

**Create a `useAppInit` hook to centralize initialization:**
```ts
export const useAppInit = () => {
  const [isReady, setIsReady] = useState(false);
  useEffect(() => {
    const init = async () => {
      await initializeStores();
      await notificationService.createNotificationChannels();
      setIsReady(true);
    };
    init();
  }, []);
  return { isReady };
};
```

**Create a `useNotificationListener` hook:**
```ts
export const useNotificationListener = () => {
  useEffect(() => {
    const sub = notificationService.addNotificationResponseReceivedListener(
      notificationService.handleNotificationResponse
    );
    return () => sub.remove();
  }, []);
};
```

**Move guards into layout via hook, gated on hydration:**
```tsx
export default function RootLayout() {
  const { isReady } = useAppInit();
  useRouteGuards({ enabled: isReady });
  if (!isReady) return <SplashScreen />;
  return ( ... );
}
```

---

## SUGGESTED REFACTOR PLAN

1. **Mount `useRouteGuards()` in root layout** — without this, there is no auth enforcement.
2. **Fix the `useEffect` cleanup** for the notification listener — prevents memory leaks.
3. **Remove unused `useNotificationStore` import** from `_layout.tsx`.
4. **Gate route guard evaluation** on Zustand hydration completion.
5. **Differentiate `ProtectedRoute`, `PublicRoute`, `AuthRoute`** with actual enforcement logic.
6. **Fix route paths** — verify `/app/(tabs)/home` resolves correctly against actual file structure.
7. **Extract `useAppInit`** and `useNotificationListener` hooks to clean up the layout.
8. **Replace `null` fallback** in guard components with `<LoadingSpinner fullScreen />`.
