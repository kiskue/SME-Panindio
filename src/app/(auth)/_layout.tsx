import { Stack } from 'expo-router';
import { useRouteGuards } from '@/core/navigation/route-guards';

export default function AuthLayout() {
  useRouteGuards();

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
        gestureEnabled: true,
      }}
    >
      <Stack.Screen name="login" options={{ headerShown: false }} />
    </Stack>
  );
}
