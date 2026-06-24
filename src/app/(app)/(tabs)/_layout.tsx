import React, { useCallback, useMemo } from 'react';
import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Drawer } from 'expo-router/drawer';
import { useNavigation, usePathname, useRouter } from 'expo-router';
import { DrawerActions } from '@react-navigation/native';
import type { DrawerContentComponentProps } from '@react-navigation/drawer';
import { useTranslation } from 'react-i18next';
import { TopNavBar } from '@/components/organisms/TopNavBar';
import { AppDrawer } from '@/components/organisms/AppDrawer';
import { useNotificationStore } from '@/store';

const selectUnreadCount = (state: { notifications: { isRead: boolean }[] }) =>
  state.notifications.filter(n => !n.isRead).length;

// ── Shared header rendered for every drawer screen ────────────────────────────
const CustomHeader: React.FC = () => {
  const { t }      = useTranslation();
  const navigation = useNavigation();
  const pathname   = usePathname();
  const router     = useRouter();
  const unreadCount = useNotificationStore(selectUnreadCount);

  const normalized = pathname.replace(/^\/\(app\)\/\(tabs\)/, '');

  const isNestedScreen =
    /^\/inventory\/.+/.test(normalized) ||
    /^\/credit\/.+/.test(normalized) ||
    /^\/suki\/.+/.test(normalized);

  // Map clean paths to translation keys
  const ROUTE_TITLE_KEYS: Record<string, string | undefined> = {
    '/':                             undefined,
    '/notifications':                'nav.notifications',
    '/profile':                      'nav.profile',
    '/inventory':                    'nav.inventory',
    '/inventory/add':                'nav.addItem',
    '/inventory/products':           'nav.products',
    '/inventory/ingredients':        'nav.ingredients',
    '/inventory/equipment':          'nav.equipment',
    '/inventory/raw-materials':      'nav.rawMaterials',
    '/inventory/raw-materials/add':  'nav.newRawMaterial',
    '/inventory/production':         'nav.productLogs',
    '/inventory/ingredient-logs':    'nav.ingredientLogs',
    '/inventory/raw-materials/logs': 'nav.usageLogs',
    '/pos':                          'nav.pointOfSale',
    '/utilities':                    'nav.utilities',
    '/credit':                       'nav.creditLedger',
    '/settings':                     'nav.settings',
    '/suki/register-customer':       'nav.registerCustomer',
  };

  const titleKey = ROUTE_TITLE_KEYS[normalized];
  let title: string | undefined = titleKey !== undefined ? t(titleKey) : undefined;

  if (title === undefined && isNestedScreen) {
    if (/^\/credit\/.+/.test(normalized)) {
      title = t('nav.customerDetail');
    } else if (/^\/suki\/.+/.test(normalized)) {
      title = t('nav.sukiCustomers');
    } else {
      title = /^\/inventory\/raw-materials\/.+/.test(normalized)
        ? t('nav.editMaterial')
        : t('nav.itemDetails');
    }
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
  const { t } = useTranslation();

  const renderDrawer = useCallback(
    (props: DrawerContentComponentProps) => <AppDrawer {...props} />,
    [],
  );

  const renderHeader  = useCallback(() => <CustomHeader />, []);
  const screenOptions = useMemo(() => ({
    header:        renderHeader,
    drawerType:    'front' as const,
    drawerStyle:   styles.drawer,
    swipeEnabled:  true,
    swipeEdgeWidth: 50,
  }), [renderHeader]);

  return (
    <SafeAreaView style={styles.root} edges={['bottom', 'left', 'right']}>
      <Drawer drawerContent={renderDrawer} screenOptions={screenOptions}>
        <Drawer.Screen name="index"         options={{ title: t('nav.home') }} />
        <Drawer.Screen name="notifications" options={{ title: t('nav.notifications') }} />
        <Drawer.Screen name="profile"       options={{ title: t('nav.profile') }} />
        <Drawer.Screen name="inventory"     options={{ title: t('nav.inventory') }} />
        <Drawer.Screen name="credit"        options={{ title: t('nav.creditLedger') }} />
        <Drawer.Screen name="pos"           options={{ title: t('nav.pointOfSale') }} />
        <Drawer.Screen name="utilities"     options={{ title: t('nav.utilities') }} />
        <Drawer.Screen name="settings"      options={{ title: t('nav.settings') }} />
        <Drawer.Screen name="suki"          options={{ title: 'Suki Customers' }} />
      </Drawer>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root:   { flex: 1 },
  drawer: { width: 300 },
});
