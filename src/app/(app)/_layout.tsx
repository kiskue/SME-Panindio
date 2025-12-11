import { Tabs } from 'expo-router';
import { useColorScheme } from 'react-native';
import { theme } from '@/core/theme';
import { Home, User, Bell } from 'lucide-react-native';

export default function AppLayout() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.textSecondary,
        tabBarStyle: {
          backgroundColor: isDark ? '#000000' : theme.colors.background,
          borderTopColor: isDark ? '#333333' : theme.colors.border,
          borderTopWidth: 1,
          elevation: 0,
          shadowOpacity: 0,
        },
        tabBarLabelStyle: {
          fontSize: theme.typography.sizes.xs,
          fontWeight: theme.typography.weights.medium,
        },
      }}
    >
      <Tabs.Screen
        name="(tabs)"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, size }) => (
            <Home size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}