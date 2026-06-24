import { Stack } from 'expo-router';

// Access to this group is gated declaratively by <Stack.Protected> in the root
// layout (app/_layout.tsx); this layout only configures the auth screens.
export default function AuthLayout() {
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
