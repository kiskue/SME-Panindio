import React, { useCallback, useMemo } from 'react';
import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Drawer } from 'expo-router/drawer';
import { useNavigation, usePathname, useRouter } from 'expo-router';
import { DrawerActions } from '@react-navigation/native';
import type { DrawerContentComponentProps } from '@react-navigation/drawer';
import { TopNavBar } from '@/components/organisms/TopNavBar';
import { AppDrawer } from '@/components/organisms/AppDrawer';
import { useNotificationStore } from '@/store';

const selectUnreadCount = (state: { notifications: { isRead: boolean }[] }) =>
  state.notifications.filter(n => !n.isRead).length;

// ── Route → title map ─────────────────────────────────────────────────────────
const ROUTE_TITLES: Record<string, string | undefined> = {
  '/':                              undefined, // Home → show BrandLogo
  '/notifications':                 'Notifications',
  '/profile':                       'Profile',
  '/inventory':                     'Inventory',
  '/inventory/add':                 'Add Item',
  '/inventory/products':            'Products',
  '/inventory/ingredients':         'Ingredients',
  '/inventory/equipment':           'Equipment',
  '/inventory/raw-materials':       'Raw Materials',
  '/inventory/raw-materials/add':   'New Raw Material',
  '/inventory/production':          'Product Logs',
  '/inventory/ingredient-logs':     'Ingredient Consumption',
  '/inventory/raw-materials/logs':  'Usage Logs',
  '/pos':                           'Point of Sale',
  '/utilities':                     'Utilities',
};

// ── Shared header rendered for every drawer screen ────────────────────────────
const CustomHeader: React.FC = () => {
  const navigation  = useNavigation();
  const pathname    = usePathname();
  const router      = useRouter();
  const unreadCount = useNotificationStore(selectUnreadCount);

  // Strip the group prefix so we get a clean path like '/inventory/add'
  const normalized = pathname.replace(/^\/\(app\)\/\(tabs\)/, '');

  // Any path deeper than a top-level route shows a back button instead of the menu hamburger.
  // Named sub-routes resolve their title from ROUTE_TITLES; only the dynamic [id] segment
  // falls back to 'Item Details'.
  const isNestedScreen = /^\/inventory\/.+/.test(normalized);

  let title: string | undefined = ROUTE_TITLES[normalized];
  if (title === undefined && isNestedScreen) {
    // Dynamic segment fallback — distinguish raw-material edits from inventory item details
    title = /^\/inventory\/raw-materials\/.+/.test(normalized) ? 'Edit Material' : 'Item Details';
  }

  return (
    <TopNavBar
      {...(title !== undefined ? { title } : {})}
      showMenuButton={!isNestedScreen}
      showBackButton={isNestedScreen}
      onMenuPress={() => navigation.dispatch(DrawerActions.openDrawer())}
      onBackPress={() => router.back()}
      notificationCount={unreadCount}
      onNotificationPress={() => router.push('/(app)/(tabs)/notifications')}
    />
  );
};

// ── Layout ────────────────────────────────────────────────────────────────────
export default function TabsLayout() {
  // Stabilize the drawerContent factory so the Drawer navigator receives the
  // same function reference on every render. An inline arrow here would create
  // a new function object every render, forcing the Drawer to unmount/remount
  // the entire AppDrawer on every parent re-render (e.g. pathname changes).
  const renderDrawer = useCallback(
    (props: DrawerContentComponentProps) => <AppDrawer {...props} />,
    [],
  );

  // Stable screenOptions object — no deps, so it never changes reference.
  // An inline object literal here would be re-created on every render and
  // force the Drawer navigator to diff options unnecessarily.
  // `header` is also stable: CustomHeader is a module-level component, so
  // wrapping it in a useCallback-stable factory prevents new function objects.
  const renderHeader = useCallback(() => <CustomHeader />, []);
  const screenOptions = useMemo(() => ({
    header: renderHeader,
    drawerType: 'front' as const,
    // Width only — AppDrawer's own container style handles background color.
    // A dynamic backgroundColor here causes the Drawer to push a native style
    // update to its panel while it is open, triggering the Fabric viewState crash.
    drawerStyle: styles.drawer,
    swipeEnabled: true,
    swipeEdgeWidth: 50,
  }), [renderHeader]);

  return (
    <SafeAreaView style={styles.root} edges={['bottom', 'left', 'right']}>
      <Drawer
        drawerContent={renderDrawer}
        screenOptions={screenOptions}
      >
        <Drawer.Screen name="index"         options={{ title: 'Home' }} />
        <Drawer.Screen name="notifications" options={{ title: 'Notifications' }} />
        <Drawer.Screen name="profile"       options={{ title: 'Profile' }} />
        <Drawer.Screen name="inventory"     options={{ title: 'Inventory' }} />
        <Drawer.Screen name="pos"           options={{ title: 'Point of Sale' }} />
        <Drawer.Screen name="utilities"     options={{ title: 'Utilities' }} />
      </Drawer>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  drawer: {
    width: 300,
  },
});
