import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useEffect } from 'react';
import { initializeStores } from '@/store';
// TODO: re-enable when not using Expo Go
// import { notificationService } from '@/features/notifications/services/notification.service';

export default function RootLayout() {
  useEffect(() => {
    // let subscription: { remove: () => void } | null = null;

    const initializeApp = async () => {
      try {
        await initializeStores();
        // TODO: re-enable when not using Expo Go
        // await notificationService.createNotificationChannels();

        // Set up notification listeners
        // subscription = notificationService.addNotificationResponseReceivedListener(
        //   (response) => {
        //     notificationService.handleNotificationResponse(response);
        //   }
        // );
      } catch (error) {
        console.error('Failed to initialize app:', error);
      }
    };

    void initializeApp();

    // return () => {
    //   subscription?.remove();
    // };
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