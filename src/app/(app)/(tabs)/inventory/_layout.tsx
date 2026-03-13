import { Stack } from 'expo-router';

export default function InventoryLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="add" />
      <Stack.Screen name="[id]" />
      <Stack.Screen name="production"       options={{ title: 'Production Log' }} />
      <Stack.Screen name="ingredient-logs"  options={{ title: 'Ingredient Consumption' }} />
    </Stack>
  );
}
