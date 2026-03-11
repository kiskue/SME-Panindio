// Must be the very first import — patches globalThis.URL before any
// Supabase or fetch code runs. Placing it here (the Expo Router root layout)
// guarantees it loads before any screen or service module.
import 'react-native-url-polyfill/auto';

import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useEffect } from 'react';
import { initializeStores, setupAuthListener } from '@/store';
// TODO: re-enable when not using Expo Go
// import { notificationService } from '@/features/notifications/services/notification.service';

export default function RootLayout() {
  useEffect(() => {
    const initializeApp = async () => {
      try {
        await initializeStores();
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
        <StatusBar style="auto" />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}