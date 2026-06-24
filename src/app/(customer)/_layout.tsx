import { Stack } from 'expo-router';

// Access to this group is gated declaratively by <Stack.Protected> in the root
// layout (app/_layout.tsx): when the customer logs out the group is removed and
// the router falls back to the index anchor, which forwards to login. This
// layout only configures the customer screens.
export default function CustomerLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="home" />
      <Stack.Screen name="profile" />
      <Stack.Screen name="verify-id" />
      <Stack.Screen name="verify-liveness" />
      <Stack.Screen name="products" />
      <Stack.Screen name="cart" />
      <Stack.Screen name="order-confirm" />
      <Stack.Screen name="orders" />
      <Stack.Screen name="orders/[id]" />
    </Stack>
  );
}
