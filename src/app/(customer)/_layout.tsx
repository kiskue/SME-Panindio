import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { useThemeStore } from '@/store/theme.store';

// Access to this group is gated declaratively by <Stack.Protected> in the root
// layout (app/_layout.tsx): when the customer logs out the group is removed and
// the router falls back to the index anchor, which forwards to login.
//
// The customer experience is split in two:
//   • `(tabs)` — the bottom-tab shell (Home / Orders / Profile). Because it is a
//     route *group*, its screens keep flat URLs: `/(customer)/home`,
//     `/(customer)/orders`, `/(customer)/profile` all still resolve, so existing
//     post-login redirects to `/(customer)/home` are unaffected.
//   • The remaining screens below are pushed on top of the tab shell as full
//     Stack screens (no tab bar): cart, checkout success, order detail, the
//     standalone product browser, and the verification flow.
export default function CustomerLayout() {
  // Mark the customer context active so theming resolves to `customerMode`,
  // independent of the business side. Write-only via getState() — no theme
  // subscription here, so toggling never re-renders the navigator.
  useEffect(() => {
    useThemeStore.getState().setActiveContext('customer');
  }, []);

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="notifications" />
      <Stack.Screen name="products" />
      <Stack.Screen name="cart" />
      <Stack.Screen name="order-confirm" />
      <Stack.Screen name="orders/[id]" />
      <Stack.Screen name="verify-id" />
      <Stack.Screen name="verify-liveness" />
    </Stack>
  );
}
