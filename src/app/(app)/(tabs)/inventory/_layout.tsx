import { Stack } from 'expo-router';

export default function InventoryLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="add" />
      <Stack.Screen name="[id]" />
      <Stack.Screen name="production"       options={{ title: 'Product Logs' }} />
      <Stack.Screen name="ingredient-logs"  options={{ title: 'Ingredient Consumption' }} />
      <Stack.Screen name="raw-materials/index" />
      <Stack.Screen name="raw-materials/add" />
      <Stack.Screen name="raw-materials/[id]" />
    </Stack>
  );
}
