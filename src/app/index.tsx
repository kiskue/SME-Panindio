import { Redirect } from 'expo-router';
import { useAuthStore } from '@/features/auth/store/auth.store';
import { useOnboardingStore } from '@/store/onboarding.store';
import { useSukiStore } from '@/features/customer/store/suki.store';

/**
 * Entry route ("/") and navigation anchor.
 *
 * By the time this renders the root layout has already waited for store
 * hydration (see `useStoresHydrated`), so the persisted flags are trustworthy.
 * This screen is the single source of truth for "where should a user land",
 * while the `<Stack.Protected>` guards in the root layout enforce access
 * reactively — e.g. a logout removes the `(app)`/`(customer)` group and the
 * router falls back here, which then forwards to login.
 *
 * Business sessions take priority over customer sessions when both somehow
 * coexist, matching the guard order in the root layout.
 */
export default function Index() {
  const isOnboardingCompleted = useOnboardingStore((s) => s.isCompleted);
  const isBusinessLoggedIn = useAuthStore((s) => s.isAuthenticated);
  const isCustomerLoggedIn = useSukiStore((s) => s.isCustomerLoggedIn);

  if (!isOnboardingCompleted) return <Redirect href="/onboarding" />;
  if (isBusinessLoggedIn) return <Redirect href="/(app)/(tabs)" />;
  if (isCustomerLoggedIn) return <Redirect href="/(customer)/home" />;
  return <Redirect href="/(auth)/login" />;
}
