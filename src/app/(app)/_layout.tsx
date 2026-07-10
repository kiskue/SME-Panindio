import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { useThemeStore } from '@/store/theme.store';

// Access to this group is gated declaratively by <Stack.Protected> in the root
// layout (app/_layout.tsx); this layout only configures the business app shell.
export default function AppLayout() {
  // Mark the business context active so theming resolves to `businessMode`.
  // Write-only via getState() — this layout never subscribes to the theme
  // store, so toggling the mode never re-renders the navigator (Fabric guard).
  useEffect(() => {
    useThemeStore.getState().setActiveContext('business');
  }, []);

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
    </Stack>
  );
}
