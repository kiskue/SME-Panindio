// Must be the very first import — patches globalThis.URL before any
// Supabase or fetch code runs. Placing it here (the Expo Router root layout)
// guarantees it loads before any screen or service module.
import 'react-native-url-polyfill/auto';

import { Stack } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { useEffect } from 'react';
import { initializeStores, setupAuthListener, initializeSalesTarget } from '@/store';
import { initDatabase } from '../../database/initDatabase';
import { ThemeProvider } from '../core/theme/ThemeProvider';
import { ThemedStatusBar } from '../core/theme/ThemedStatusBar';
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
            <Stack
              screenOptions={{
                headerShown: false,
                animation: 'slide_from_right',
                gestureEnabled: true,
                gestureDirection: 'horizontal',
              }}
            >
              <Stack.Screen name="index" options={{ headerShown: false }} />
              <Stack.Screen name="onboarding" options={{ headerShown: false }} />
              <Stack.Screen name="(auth)" options={{ headerShown: false }} />
              <Stack.Screen name="(app)" options={{ headerShown: false }} />
            </Stack>
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