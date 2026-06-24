import { Stack } from 'expo-router';

export default function SukiLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="[id]" />
      <Stack.Screen name="catalog" />
      <Stack.Screen name="orders" />
      <Stack.Screen name="orders/[id]" />
    </Stack>
  );
}
