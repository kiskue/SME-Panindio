import { useCallback, useEffect, useState } from 'react';
import { useRouter, useSegments, useFocusEffect } from 'expo-router';
import { useAuthStore } from '@/store/auth.store';
import { useOnboardingStore } from '@/store/onboarding.store';

export enum RouteGroup {
  PUBLIC = 'public',
  AUTH = 'auth',
  APP = 'app',
}

/** Waits for Zustand persist stores to rehydrate from AsyncStorage. */
function useHydration(): boolean {
  const [hydrated, setHydrated] = useState(
    () => useAuthStore.persist.hasHydrated() && useOnboardingStore.persist.hasHydrated(),
  );

  useEffect(() => {
    if (hydrated) return;

    const check = () => {
      if (useAuthStore.persist.hasHydrated() && useOnboardingStore.persist.hasHydrated()) {
        setHydrated(true);
      }
    };

    const unsub1 = useAuthStore.persist.onFinishHydration(check);
    const unsub2 = useOnboardingStore.persist.onFinishHydration(check);

    // Re-check synchronously in case both stores hydrated between the useState
    // initialiser call and this effect running.
    check();

    return () => {
      unsub1();
      unsub2();
    };
  }, [hydrated]);

  return hydrated;
}

/**
 * Route guard hook.
 *
 * Uses `useFocusEffect` (expo-router's fork specifically designed for
 * "native redirects") instead of plain `useEffect`.  This defers the
 * navigation call until the screen is focused, which guarantees that
 * `navigationRef.isReady()` is true and avoids the "navigate before
 * mounting the Root Layout" error.
 *
 * The inner `useCallback` includes all reactive deps so the guard
 * re-evaluates whenever auth state or hydration changes while the
 * screen is focused.
 */
export const useRouteGuards = () => {
  const segments = useSegments();
  const router = useRouter();
  const isHydrated = useHydration();

  const isAuthenticated = useAuthStore(state => state.isAuthenticated);
  const isOnboardingCompleted = useOnboardingStore(state => state.isCompleted);

  useFocusEffect(
    useCallback(() => {
      if (!isHydrated) return;

      const inAuthGroup = segments[0] === '(auth)';
      const inAppGroup = segments[0] === '(app)';
      const isOnboardingRoute = segments[0] === 'onboarding';
      // At the root index or any unrecognised route
      const atRoot = !inAuthGroup && !inAppGroup && !isOnboardingRoute;

      if (!isOnboardingCompleted && !isOnboardingRoute) {
        // Onboarding not done → go to onboarding
        router.replace('/onboarding');
      } else if (isOnboardingCompleted && !isAuthenticated && (inAppGroup || atRoot)) {
        // Done onboarding, not logged in, landed on app or root → go to login
        router.replace('/(auth)/login');
      } else if (isOnboardingCompleted && isAuthenticated && inAuthGroup) {
        // Already logged in, on auth screen → go to app
        router.replace('/(app)/(tabs)');
      } else if (isOnboardingCompleted && isOnboardingRoute) {
        // Onboarding already completed but still showing it → skip ahead
        router.replace(isAuthenticated ? '/(app)/(tabs)' : '/(auth)/login');
      }
    }, [isHydrated, segments, isAuthenticated, isOnboardingCompleted, router]),
  );
};

export const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  useRouteGuards();
  return <>{children}</>;
};

export const PublicRoute = ({ children }: { children: React.ReactNode }) => {
  useRouteGuards();
  return <>{children}</>;
};

export const AuthRoute = ({ children }: { children: React.ReactNode }) => {
  useRouteGuards();
  return <>{children}</>;
};
