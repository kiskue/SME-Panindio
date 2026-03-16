/**
 * AppDrawer
 *
 * Drawer content component for expo-router/drawer.
 * Renders the user header, nav items, dark-mode toggle, and footer
 * inside the native drawer panel.
 *
 * All colors are sourced from useAppTheme() so the drawer reacts
 * immediately when the user toggles dark mode.
 */
import React, { useCallback, useMemo } from 'react';
import {
  View,
  ScrollView,
  Pressable,
  StyleSheet,
  Alert,
  Switch,
} from 'react-native';
import type { DrawerContentComponentProps } from '@react-navigation/drawer';
import {
  Home,
  LayoutDashboard,
  Bell,
  Settings,
  User,
  LogOut,
  Package,
  ShoppingBag,
  Wheat,
  Wrench,
  Moon,
  ShoppingCart,
  Zap,
} from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { Avatar } from '../atoms/Avatar';
import { Badge } from '../atoms/Badge';
import { Text } from '../atoms/Text';
import { Button } from '../atoms/Button';
import { useAppTheme } from '../../core/theme';
import {
  useAuthStore,
  selectCurrentUser,
  useNotificationStore,
  useInventoryStore,
  selectLowStockCount,
  useThemeStore,
  selectThemeMode,
} from '@/store';

const selectUnreadCount = (state: { notifications: { isRead: boolean }[] }) =>
  state.notifications.filter(n => !n.isRead).length;

const ICON_SIZE = 20;

interface NavItem {
  key:          string;
  label:        string;
  icon:         React.ReactNode;
  badge?:       number;
  onPress:      () => void;
  dividerBefore?: boolean;
  destructive?:   boolean;
}

export const AppDrawer: React.FC<DrawerContentComponentProps> = ({ navigation }) => {
  const router        = useRouter();
  const appTheme      = useAppTheme();
  const mode          = useThemeStore(selectThemeMode);
  const { toggleMode } = useThemeStore();

  const user          = useAuthStore(selectCurrentUser);
  const { logout }    = useAuthStore();
  const unreadCount   = useNotificationStore(selectUnreadCount);
  const lowStockCount = useInventoryStore(selectLowStockCount);

  // Derived icon colors — recalculated whenever the theme changes
  const iconActive   = appTheme.colors.primary[500];
  const iconInactive = appTheme.colors.gray[500];

  const closeDrawer = useCallback(() => navigation.closeDrawer(), [navigation]);

  const navigate = useCallback(
    (href: string) => {
      closeDrawer();
      setTimeout(() => router.push(href as Parameters<typeof router.push>[0]), 50);
    },
    [closeDrawer, router],
  );

  const handleLogout = useCallback(() => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          closeDrawer();
          try {
            await logout();
          } catch {
            Alert.alert('Error', 'Could not sign out. Please try again.');
          }
        },
      },
    ]);
  }, [logout, closeDrawer]);

  const initials = useMemo(() => {
    if (!user?.name) return 'U';
    const parts = user.name.trim().split(' ');
    const first = parts[0]?.[0] ?? '';
    const last  = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : '';
    return (first + last).toUpperCase() || 'U';
  }, [user?.name]);

  const navItems: NavItem[] = [
    {
      key:     'home',
      label:   'Home',
      icon:    <Home size={ICON_SIZE} color={iconActive} />,
      onPress: () => navigate('/(app)/(tabs)/'),
    },
    {
      key:     'dashboard',
      label:   'Dashboard',
      icon:    <LayoutDashboard size={ICON_SIZE} color={iconInactive} />,
      onPress: () => navigate('/(app)/(tabs)/'),
    },
    {
      key:     'notifications',
      label:   'Notifications',
      icon:    <Bell size={ICON_SIZE} color={iconInactive} />,
      ...(unreadCount > 0 ? { badge: unreadCount } : {}),
      onPress: () => navigate('/(app)/(tabs)/notifications'),
    },
    {
      key:          'pos',
      label:        'Point of Sale',
      icon:         <ShoppingCart size={ICON_SIZE} color={appTheme.colors.accent[500]} />,
      onPress:      () => navigate('/(app)/(tabs)/pos'),
      dividerBefore: true,
    },
    {
      key:          'utilities',
      label:        'Utilities',
      icon:         <Zap size={ICON_SIZE} color={appTheme.colors.highlight[400]} />,
      onPress:      () => navigate('/(app)/(tabs)/utilities'),
      dividerBefore: false,
    },
    {
      key:          'inventory',
      label:        'Inventory',
      icon:         <Package size={ICON_SIZE} color={iconInactive} />,
      ...(lowStockCount > 0 ? { badge: lowStockCount } : {}),
      onPress:      () => navigate('/(app)/(tabs)/inventory'),
      dividerBefore: false,
    },
    {
      key:     'inventory-products',
      label:   'Products',
      icon:    <ShoppingBag size={ICON_SIZE - 2} color={appTheme.colors.primary[400]} />,
      onPress: () => navigate('/(app)/(tabs)/inventory/products'),
    },
    {
      key:     'inventory-ingredients',
      label:   'Ingredients',
      icon:    <Wheat size={ICON_SIZE - 2} color={appTheme.colors.success[500]} />,
      onPress: () => navigate('/(app)/(tabs)/inventory/ingredients'),
    },
    {
      key:     'inventory-equipment',
      label:   'Equipment',
      icon:    <Wrench size={ICON_SIZE - 2} color={appTheme.colors.highlight[400]} />,
      onPress: () => navigate('/(app)/(tabs)/inventory/equipment'),
    },
    {
      key:          'profile',
      label:        'Profile',
      icon:         <User size={ICON_SIZE} color={iconInactive} />,
      onPress:      () => navigate('/(app)/(tabs)/profile'),
      dividerBefore: true,
    },
    {
      key:     'settings',
      label:   'Settings',
      icon:    <Settings size={ICON_SIZE} color={iconInactive} />,
      onPress: () => navigate('/(app)/(tabs)/profile'),
    },
  ];

  // ── Dynamic styles that react to theme changes ──────────────────────────
  const dynStyles = useMemo(() => ({
    container:     { backgroundColor: appTheme.colors.surface },
    header:        { borderBottomColor: appTheme.colors.border },
    userName:      { color: appTheme.colors.text },
    businessName:  { color: appTheme.colors.primary[400] },
    divider:       { backgroundColor: appTheme.colors.border },
    itemPressed:   { backgroundColor: appTheme.colors.gray[100] },
    itemLabel:     { color: appTheme.colors.text },
    footer:        { borderTopColor: appTheme.colors.border },
    toggleRow:     { borderTopColor: appTheme.colors.border },
    toggleLabel:   { color: appTheme.colors.text },
  }), [appTheme]);

  const isDark = mode === 'dark';

  return (
    <View style={[styles.container, dynStyles.container]}>
      {/* ── Header ── */}
      <View style={[styles.header, dynStyles.header]}>
        <Avatar
          initials={initials}
          size="lg"
          backgroundColor={appTheme.colors.primary[500]}
          {...(unreadCount > 0
            ? { badge: <Badge count={unreadCount} variant="error" size="sm" /> }
            : {})}
        />
        <View style={styles.headerText}>
          <Text
            variant="h5"
            weight="semibold"
            style={[styles.userName, dynStyles.userName]}
            numberOfLines={1}
          >
            {user?.name ?? 'User'}
          </Text>
          <Text variant="body-sm" color="gray" numberOfLines={1}>
            {user?.email ?? ''}
          </Text>
          {user?.businessName !== undefined && (
            <Text
              variant="body-xs"
              weight="medium"
              numberOfLines={1}
              style={[styles.businessName, dynStyles.businessName]}
            >
              {user.businessName}
            </Text>
          )}
        </View>
      </View>

      {/* ── Nav items ── */}
      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        {navItems.map((item) => (
          <React.Fragment key={item.key}>
            {item.dividerBefore === true && (
              <View style={[styles.divider, dynStyles.divider]} />
            )}
            <Pressable
              onPress={item.onPress}
              style={({ pressed }) => [
                styles.item,
                pressed && [styles.itemPressed, dynStyles.itemPressed],
              ]}
              accessibilityRole="button"
            >
              <View style={styles.itemIcon}>{item.icon}</View>
              <Text
                variant="body"
                weight="medium"
                style={[
                  styles.itemLabel,
                  dynStyles.itemLabel,
                  item.destructive === true && styles.itemDestructive,
                  item.destructive === true && { color: appTheme.colors.error[500] },
                ]}
                numberOfLines={1}
              >
                {item.label}
              </Text>
              {item.badge !== undefined && item.badge > 0 && (
                <View style={[styles.itemBadge, { backgroundColor: appTheme.colors.error[500] }]}>
                  <Text variant="body-xs" weight="bold" style={styles.itemBadgeText}>
                    {item.badge > 99 ? '99+' : String(item.badge)}
                  </Text>
                </View>
              )}
            </Pressable>
          </React.Fragment>
        ))}
      </ScrollView>

      {/* ── Dark Mode Toggle ── */}
      <View style={[styles.toggleRow, dynStyles.toggleRow]}>
        <View style={styles.toggleIcon}>
          <Moon size={ICON_SIZE} color={isDark ? appTheme.colors.highlight[400] : appTheme.colors.gray[500]} />
        </View>
        <Text
          variant="body"
          weight="medium"
          style={[styles.toggleLabel, dynStyles.toggleLabel]}
        >
          Dark Mode
        </Text>
        <Switch
          value={isDark}
          onValueChange={toggleMode}
          trackColor={{
            false: appTheme.colors.gray[300],
            true:  appTheme.colors.primary[500],
          }}
          thumbColor={isDark ? appTheme.colors.highlight[400] : appTheme.colors.white}
          ios_backgroundColor={appTheme.colors.gray[300]}
          accessibilityLabel="Toggle dark mode"
          accessibilityRole="switch"
        />
      </View>

      {/* ── Footer ── */}
      <View style={[styles.footer, dynStyles.footer]}>
        <Button
          title="Sign Out"
          variant="ghost"
          size="sm"
          onPress={handleLogout}
          leftIcon={<LogOut size={16} color={appTheme.colors.error[500]} />}
          fullWidth
        />
        <Text variant="caption" color="gray" style={styles.versionText}>
          SME Panindio v1.0.0
        </Text>
      </View>
    </View>
  );
};

// ── Static styles (layout only — no colors) ────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    padding: 24,
    paddingTop: 32,
    borderBottomWidth: 1,
  },
  headerText: {
    flex: 1,
    gap: 2,
  },
  userName: {},
  businessName: {
    marginTop: 2,
  },
  scroll: {
    flex: 1,
  },
  divider: {
    height: 1,
    marginHorizontal: 16,
    marginVertical: 4,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 16,
  },
  itemPressed: {},
  itemIcon: {
    width: 24,
    alignItems: 'center',
  },
  itemLabel: {
    flex: 1,
  },
  itemDestructive: {},
  itemBadge: {
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    lineHeight: 14,
  },
  // ── Dark mode toggle row ────────────────────────────────────────────────
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 16,
    borderTopWidth: 1,
  },
  toggleIcon: {
    width: 24,
    alignItems: 'center',
  },
  toggleLabel: {
    flex: 1,
  },
  // ── Footer ─────────────────────────────────────────────────────────────
  footer: {
    padding: 16,
    gap: 4,
    alignItems: 'center',
    borderTopWidth: 1,
  },
  versionText: {
    marginTop: 4,
  },
});
