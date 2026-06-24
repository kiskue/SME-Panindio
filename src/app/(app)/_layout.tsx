import { Stack } from 'expo-router';

// Access to this group is gated declaratively by <Stack.Protected> in the root
// layout (app/_layout.tsx); this layout only configures the business app shell.
export default function AppLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
    </Stack>
  );
}
