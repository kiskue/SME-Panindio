import { useEffect, useState } from 'react';
import { useAuthStore } from '@/store/auth.store';
import { useOnboardingStore } from '@/store/onboarding.store';
import { useSukiStore } from '@/store/suki.store';

/**
 * Resolves to `true` once every persisted Zustand store has rehydrated from
 * AsyncStorage.
 *
 * Until then the auth / onboarding / customer flags still hold their in-memory
 * defaults (all `false`), so any routing decision taken earlier would wrongly
 * treat a returning user as logged-out. The root layout holds the splash until
 * this flips true, which is what makes both business and customer sessions
 * persist across app restarts.
 */
export function useStoresHydrated(): boolean {
  const allHydrated = () =>
    useAuthStore.persist.hasHydrated() &&
    useOnboardingStore.persist.hasHydrated() &&
    useSukiStore.persist.hasHydrated();

  const [hydrated, setHydrated] = useState(allHydrated);

  useEffect(() => {
    if (hydrated) return;

    const check = () => {
      if (allHydrated()) setHydrated(true);
    };

    const unsubs = [
      useAuthStore.persist.onFinishHydration(check),
      useOnboardingStore.persist.onFinishHydration(check),
      useSukiStore.persist.onFinishHydration(check),
    ];

    // Re-check synchronously in case hydration finished between the initial
    // useState evaluation and this effect running.
    check();

    return () => unsubs.forEach((unsub) => unsub());
  }, [hydrated]);

  return hydrated;
}
