import { Stack } from 'expo-router';
import { useRouteGuards } from '@/core/navigation/route-guards';

export default function AppLayout() {
  useRouteGuards();

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
    </Stack>
  );
}
