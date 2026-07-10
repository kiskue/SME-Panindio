import React from 'react';
import { Tabs } from 'expo-router';
import { Home, ClipboardList, User } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '@/core/theme';
import { LiquidGlassTabBackground } from '@/features/customer/components/LiquidGlassTabBackground';
import { CUSTOMER_TAB_BAR_HEIGHT } from '@/features/customer/constants/tabBar';

/**
 * Customer (suki) bottom tab navigation.
 *
 * This is the first expo-router `<Tabs>` in the project — the owner side's
 * `(app)/(tabs)` is actually a Drawer. Each screen renders its own
 * `CustomerHeader`, so the tab navigator header is hidden. The cart is reached
 * from the header `CartButton`, NOT a tab. Because `(tabs)` is a route *group*,
 * the URLs stay flat: `/(customer)/home`, `/(customer)/orders`,
 * `/(customer)/profile` all still resolve unchanged after the move.
 *
 * The bar itself is rendered as a transparent, absolutely-positioned overlay
 * with a liquid-glass background (`LiquidGlassTabBackground`): true Liquid Glass
 * on iOS 26, frosted blur on older iOS, solid translucent surface on Android.
 */
export default function CustomerTabsLayout() {
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.colors.primary[500],
        tabBarInactiveTintColor: theme.colors.textSecondary,
        tabBarBackground: () => <LiquidGlassTabBackground />,
        tabBarStyle: {
          position: 'absolute',
          backgroundColor: 'transparent',
          borderTopColor: 'transparent',
          // Remove the default Android drop shadow so the glass/surface reads cleanly.
          elevation: 0,
          // Hard-coding `height` overrides the safe-area padding React Navigation
          // normally adds, so we must fold the bottom inset back in: grow the bar
          // by the inset and pad the icons/labels up so they clear the home
          // indicator. The glass background fills the full (inset-inclusive) bar.
          height: CUSTOMER_TAB_BAR_HEIGHT + insets.bottom,
          paddingBottom: insets.bottom,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
        },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, size }) => <Home size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="orders"
        options={{
          title: 'Orders',
          tabBarIcon: ({ color, size }) => <ClipboardList size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, size }) => <User size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}
