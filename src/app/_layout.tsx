// Must be the very first import — patches globalThis.URL before any
// Supabase or fetch code runs. Placing it here (the Expo Router root layout)
// guarantees it loads before any screen or service module.
import 'react-native-url-polyfill/auto';
import '@/i18n';

import { Stack } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { useEffect } from 'react';
import {
  initializeStores,
  setupAuthListener,
  initializeSalesTarget,
  useLanguageStore,
  useAuthStore,
  useOnboardingStore,
  useSukiStore,
} from '@/store';
import { initDatabase } from '../../database/initDatabase';
import { ThemeProvider } from '../core/theme/ThemeProvider';
import { ThemedStatusBar } from '../core/theme/ThemedStatusBar';
import { AppSplash } from '@/components/organisms/AppSplash';
import { useStoresHydrated } from '@/core/navigation/useStoresHydrated';
import i18n from '@/i18n';

// Make the entry route ("/") the navigation anchor: whenever a guard below
// removes the active group (e.g. on logout), the router falls back here and
// `index` forwards the user to the correct destination.
export const unstable_settings = { anchor: 'index' };
// TODO: re-enable when not using Expo Go
// import { notificationService } from '@/features/notifications/services/notification.service';

export default function RootLayout() {
  // NOTE: Do NOT subscribe to useThemeStore here. RootLayout sits outside
  // ThemeProvider in the render tree, so any Zustand theme subscription here
  // would fire a separate re-render of RootLayout simultaneously with the
  // ThemeProvider re-render. That double-render path causes RootLayout to push
  // a native prop update to StatusBar's Fabric node in the same commit batch as
  // the drawer surface teardown, triggering "Unable to find viewState for tag X".
  // StatusBar theming is handled by ThemedStatusBar (inside ThemeProvider) which
  // reads from ThemeContext and is therefore already covered by the rAF deferral.

  const language = useLanguageStore((s) => s.language);

  // Sync persisted language preference into i18next on mount and whenever it changes.
  useEffect(() => {
    void i18n.changeLanguage(language);
  }, [language]);

  useEffect(() => {
    const initializeApp = async () => {
      try {
        await initDatabase();
        await initializeStores();
        // Sales target is initialized AFTER all stores (it reads from business_roi store).
        // Non-fatal — a failure here does not block the rest of the app.
        await initializeSalesTarget().catch((err) =>
          console.warn('[sales_target] init failed:', err),
        );
        // TODO: re-enable when not using Expo Go
        // await notificationService.createNotificationChannels();
      } catch (error) {
        console.error('Failed to initialize app:', error);
      }
    };

    void initializeApp();

    // Keep Zustand in sync with Supabase token refreshes / remote sign-outs.
    const unsubscribeAuth = setupAuthListener();
    return () => unsubscribeAuth();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          {/* BottomSheetModalProvider must be inside SafeAreaProvider and
              ThemeProvider so sheets can read insets and theme, and must be
              outside the Stack so modals can render above all screens. */}
          <BottomSheetModalProvider>
            {/* RootNavigator lives inside ThemeProvider so its auth-driven
                re-renders stay within the themed subtree (see the note above
                about keeping store subscriptions out of RootLayout). */}
            <RootNavigator />
            {/* ThemedStatusBar reads from ThemeContext so it is gated behind
                the rAF deferral in ThemeProvider — no direct Zustand subscription,
                no race with in-flight Fabric work. */}
            <ThemedStatusBar />
          </BottomSheetModalProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

/**
 * Declarative route guard.
 *
 * Each route group is gated by a `<Stack.Protected guard={...}>`: when a guard
 * is false the group's screens are removed from the navigator and the router
 * falls back to the `index` anchor (see `unstable_settings` above), which then
 * redirects to the appropriate destination. This replaces the old imperative
 * if/else redirect chain — there is one obvious place to read each rule, and
 * sign-in / sign-out transitions happen automatically as the flags change.
 */
function RootNavigator() {
  const isHydrated = useStoresHydrated();
  const isOnboardingCompleted = useOnboardingStore((s) => s.isCompleted);
  const isBusinessLoggedIn = useAuthStore((s) => s.isAuthenticated);
  const isCustomerLoggedIn = useSukiStore((s) => s.isCustomerLoggedIn);

  // Hold the splash until the persisted auth/onboarding/customer flags have
  // rehydrated, so the guards never act on stale (logged-out) defaults.
  if (!isHydrated) return <AppSplash />;

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
        gestureEnabled: true,
        gestureDirection: 'horizontal',
      }}
    >
      {/* Anchor: "/" decides the initial destination and is the fallback the
          router returns to whenever a guard below removes the active group. */}
      <Stack.Screen name="index" />

      {/* Onboarding — only before it has been completed. */}
      <Stack.Protected guard={!isOnboardingCompleted}>
        <Stack.Screen name="onboarding" />
      </Stack.Protected>

      {/* Public auth screens — onboarded, but no active session. */}
      <Stack.Protected
        guard={isOnboardingCompleted && !isBusinessLoggedIn && !isCustomerLoggedIn}
      >
        <Stack.Screen name="(auth)" />
      </Stack.Protected>

      {/* Business app — business owner is signed in (takes priority). */}
      <Stack.Protected guard={isOnboardingCompleted && isBusinessLoggedIn}>
        <Stack.Screen name="(app)" />
      </Stack.Protected>

      {/* Customer app — customer is signed in and no business session. */}
      <Stack.Protected
        guard={isOnboardingCompleted && isCustomerLoggedIn && !isBusinessLoggedIn}
      >
        <Stack.Screen name="(customer)" />
      </Stack.Protected>
    </Stack>
  );
}