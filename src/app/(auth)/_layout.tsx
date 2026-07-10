import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { useThemeStore } from '@/store/theme.store';

// Access to this group is gated declaratively by <Stack.Protected> in the root
// layout (app/_layout.tsx); this layout only configures the auth screens.
export default function AuthLayout() {
  // Auth is intentionally un-themed: marking it active forces theming to resolve
  // to light/brand for every screen and shared component rendered here, even
  // right after a dark-mode user logs out. Write-only (no subscription).
  useEffect(() => {
    useThemeStore.getState().setActiveContext('auth');
  }, []);

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
        gestureEnabled: true,
      }}
    >
      <Stack.Screen name="login" />
      <Stack.Screen name="customer-register" />
    </Stack>
  );
}
