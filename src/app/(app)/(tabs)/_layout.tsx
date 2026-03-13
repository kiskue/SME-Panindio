import React from 'react';
import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Drawer } from 'expo-router/drawer';
import { useNavigation, usePathname, useRouter } from 'expo-router';
import { DrawerActions } from '@react-navigation/native';
import { TopNavBar } from '@/components/organisms/TopNavBar';
import { AppDrawer } from '@/components/organisms/AppDrawer';
import { useNotificationStore } from '@/store';
import { theme } from '@/core/theme';

const selectUnreadCount = (state: { notifications: { isRead: boolean }[] }) =>
  state.notifications.filter(n => !n.isRead).length;

// ── Route → title map ─────────────────────────────────────────────────────────
const ROUTE_TITLES: Record<string, string | undefined> = {
  '/':                        undefined, // Home → show BrandLogo
  '/notifications':           'Notifications',
  '/profile':                 'Profile',
  '/inventory':               'Inventory',
  '/inventory/add':           'Add Item',
  '/inventory/products':      'Products',
  '/inventory/ingredients':   'Ingredients',
  '/inventory/equipment':     'Equipment',
  '/inventory/production':    'Production Log',
};

// ── Shared header rendered for every drawer screen ────────────────────────────
const CustomHeader: React.FC = () => {
  const navigation = useNavigation();
  const pathname   = usePathname();
  const router     = useRouter();
  const unreadCount = useNotificationStore(selectUnreadCount);

  // Strip the group prefix so we get a clean path like '/inventory/add'
  const normalized = pathname.replace(/^\/\(app\)\/\(tabs\)/, '');

  // Any path deeper than a top-level route shows a back button instead of the menu hamburger.
  // Named sub-routes resolve their title from ROUTE_TITLES; only the dynamic [id] segment
  // falls back to 'Item Details'.
  const isNestedScreen = /^\/inventory\/.+/.test(normalized);

  let title: string | undefined = ROUTE_TITLES[normalized];
  if (title === undefined && isNestedScreen) title = 'Item Details';

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
  return (
    <SafeAreaView style={styles.root} edges={['bottom', 'left', 'right']}>
      <Drawer
        drawerContent={(props) => <AppDrawer {...props} />}
        screenOptions={{
          header: () => <CustomHeader />,
          drawerType: 'front',
          drawerStyle: styles.drawer,
          swipeEnabled: true,
          swipeEdgeWidth: 50,
        }}
      >
        <Drawer.Screen name="index"         options={{ title: 'Home' }} />
        <Drawer.Screen name="notifications" options={{ title: 'Notifications' }} />
        <Drawer.Screen name="profile"       options={{ title: 'Profile' }} />
        <Drawer.Screen name="inventory"     options={{ title: 'Inventory' }} />
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
    backgroundColor: theme.colors.surface,
  },
});
