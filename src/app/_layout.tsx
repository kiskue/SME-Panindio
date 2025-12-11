import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useEffect } from 'react';
import { initializeStores } from '@/store';
import { notificationService } from '@/features/notifications/services/notification.service';
import { useNotificationStore } from '@/store';

export default function RootLayout() {
  useEffect(() => {
    // Initialize stores and services
    const initializeApp = async () => {
      try {
        await initializeStores();
        await notificationService.createNotificationChannels();
        
        // Set up notification listeners
        const subscription = notificationService.addNotificationResponseReceivedListener(
          (response) => {
            notificationService.handleNotificationResponse(response);
          }
        );

        return () => subscription.remove();
      } catch (error) {
        console.error('Failed to initialize app:', error);
      }
    };

    initializeApp();
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
          <Stack.Screen name="onboarding" options={{ headerShown: false }} />
          <Stack.Screen name="(auth)" options={{ headerShown: false }} />
          <Stack.Screen name="(app)" options={{ headerShown: false }} />
        </Stack>
        <StatusBar style="auto" />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}