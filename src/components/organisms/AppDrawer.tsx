import React, { useCallback, useMemo } from 'react';
import {
  View,
  ScrollView,
  Pressable,
  Switch as RNSwitch,
  StyleSheet,
} from 'react-native';
import type { DrawerContentComponentProps } from '@react-navigation/drawer';
import {
  LayoutDashboard,
  Bell,
  Settings,
  User,
  LogOut,
  Package,
  ShoppingBag,
  Wheat,
  Wrench,
  ShoppingCart,
  Zap,
  Building2,
  Wallet,
  TrendingUp,
  BarChart2,
  Target,
  Moon,
} from 'lucide-react-native';
import { useRouter, usePathname } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Avatar } from '../atoms/Avatar';
import { Badge } from '../atoms/Badge';
import { Text } from '../atoms/Text';
import { Button } from '../atoms/Button';
import { useAppTheme, useThemeMode } from '../../core/theme';
import {
  useAuthStore,
  selectCurrentUser,
  useNotificationStore,
  useInventoryStore,
  selectLowStockCount,
  useThemeStore,
} from '@/store';
import type { AuthState } from '@/store';
import { isProductionBusiness } from '@/types';
import { useAppDialog } from '@/hooks';

const selectLogout = (state: AuthState): AuthState['logout'] => state.logout;

const selectUnreadCount = (state: { notifications: { isRead: boolean }[] }) =>
  state.notifications.filter(n => !n.isRead).length;

const ICON_SIZE = 20;

interface NavItem {
  key:           string;
  label:         string;
  icon:          React.ReactNode;
  href:          string;
  badge?:        number;
  onPress:       () => void;
  dividerBefore?: boolean;
  destructive?:   boolean;
}

export const AppDrawer: React.FC<DrawerContentComponentProps> = ({ navigation }) => {
  const { t }      = useTranslation();
  const router     = useRouter();
  const pathname   = usePathname();
  const appTheme   = useAppTheme();
  const dialog     = useAppDialog();

  // Strip the group prefix to get a clean path like '/inventory/products'
  const normalizedPath = pathname.replace(/^\/\(app\)\/\(tabs\)/, '') || '/';

  const user          = useAuthStore(selectCurrentUser);
  const logout        = useAuthStore(selectLogout);
  const unreadCount   = useNotificationStore(selectUnreadCount);
  const lowStockCount = useInventoryStore(selectLowStockCount);

  // Theme toggle — useThemeMode() and useAppTheme() read from Zustand directly,
  // not from React context, so toggling mode only re-renders leaf components that
  // subscribe to the store. Navigation containers (Drawer, Stack) never re-render,
  // which eliminates the Fabric "Unable to find viewState for tag X" crash.
  const themeMode  = useThemeMode();
  const { toggleMode } = useThemeStore();
  const isDark     = themeMode === 'dark';

  const handleThemeToggle = useCallback((_value: boolean) => {
    toggleMode();
  }, [toggleMode]);

  // Feature gate: production-only nav items are hidden for reseller businesses.
  // Default to true when the mode is unknown (user logged in before this field
  // was introduced) so no features are accidentally removed for existing users.
  const operationMode  = user?.businessOperationMode ?? 'production';
  const showProduction = isProductionBusiness(operationMode);

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
    dialog.confirm({
      title:       t('drawer.signOut'),
      message:     t('drawer.signOutConfirm'),
      confirmText: t('drawer.signOut'),
      cancelText:  t('common.cancel'),
      onConfirm:   async () => {
        closeDrawer();
        try {
          await logout();
        } catch {
          dialog.show({ variant: 'error', title: t('common.error'), message: t('drawer.signOutError') });
        }
      },
    });
  }, [logout, closeDrawer, dialog, t]);

  const initials = useMemo(() => {
    if (!user?.name) return 'U';
    const parts = user.name.trim().split(' ');
    const first = parts[0]?.[0] ?? '';
    const last  = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : '';
    return (first + last).toUpperCase() || 'U';
  }, [user?.name]);

  // Base nav items — always visible to all business types.
  const baseNavItems: NavItem[] = [
    {
      key:     'dashboard',
      label:   t('drawer.dashboard'),
      href:    '/',
      icon:    <LayoutDashboard size={ICON_SIZE} color={iconActive} />,
      onPress: () => navigate('/(app)/(tabs)/'),
    },
    {
      key:     'notifications',
      label:   t('drawer.notifications'),
      href:    '/notifications',
      icon:    <Bell size={ICON_SIZE} color={iconInactive} />,
      ...(unreadCount > 0 ? { badge: unreadCount } : {}),
      onPress: () => navigate('/(app)/(tabs)/notifications'),
    },
    {
      key:           'pos',
      label:         t('drawer.pos'),
      href:          '/pos',
      icon:          <ShoppingCart size={ICON_SIZE} color={appTheme.colors.accent[500]} />,
      onPress:       () => navigate('/(app)/(tabs)/pos'),
      dividerBefore: true,
    },
    {
      key:           'utilities',
      label:         t('drawer.utilities'),
      href:          '/utilities',
      icon:          <Zap size={ICON_SIZE} color={appTheme.colors.highlight[400]} />,
      onPress:       () => navigate('/(app)/(tabs)/utilities'),
      dividerBefore: false,
    },
    {
      key:           'overhead',
      label:         t('drawer.overhead'),
      href:          '/overhead',
      icon:          <Building2 size={ICON_SIZE} color="#8B5CF6" />,
      onPress:       () => navigate('/(app)/(tabs)/overhead'),
      dividerBefore: false,
    },
    {
      key:           'credit',
      label:         t('drawer.credit'),
      href:          '/credit',
      icon:          <Wallet size={ICON_SIZE} color="#7C3AED" />,
      onPress:       () => navigate('/(app)/(tabs)/credit'),
      dividerBefore: false,
    },
    {
      key:           'roi',
      label:         t('drawer.roi'),
      href:          '/roi',
      icon:          <TrendingUp size={ICON_SIZE} color="#0EA5E9" />,
      onPress:       () => navigate('/(app)/(tabs)/roi'),
      dividerBefore: false,
    },
    {
      key:           'business-roi',
      label:         t('drawer.businessRoi'),
      href:          '/business-roi',
      icon:          <BarChart2 size={ICON_SIZE} color="#10B981" />,
      onPress:       () => navigate('/(app)/(tabs)/business-roi'),
      dividerBefore: false,
    },
    {
      key:           'breakeven',
      label:         t('drawer.breakeven'),
      href:          '/breakeven',
      icon:          <Target size={ICON_SIZE} color="#F59E0B" />,
      onPress:       () => navigate('/(app)/(tabs)/breakeven'),
      dividerBefore: false,
    },
    {
      key:           'inventory',
      label:         t('drawer.inventory'),
      href:          '/inventory',
      icon:          <Package size={ICON_SIZE} color={iconInactive} />,
      ...(lowStockCount > 0 ? { badge: lowStockCount } : {}),
      onPress:       () => navigate('/(app)/(tabs)/inventory'),
      dividerBefore: false,
    },
    {
      key:     'inventory-products',
      label:   t('drawer.products'),
      href:    '/inventory/products',
      icon:    <ShoppingBag size={ICON_SIZE - 2} color={appTheme.colors.primary[400]} />,
      onPress: () => navigate('/(app)/(tabs)/inventory/products'),
    },
  ];

  // Production-only nav items — hidden for reseller businesses.
  const productionNavItems: NavItem[] = [
    {
      key:     'inventory-ingredients',
      label:   t('drawer.ingredients'),
      href:    '/inventory/ingredients',
      icon:    <Wheat size={ICON_SIZE - 2} color={appTheme.colors.success[500]} />,
      onPress: () => navigate('/(app)/(tabs)/inventory/ingredients'),
    },
  ];

  const tailNavItems: NavItem[] = [
    {
      key:     'inventory-equipment',
      label:   t('drawer.equipment'),
      href:    '/inventory/equipment',
      icon:    <Wrench size={ICON_SIZE - 2} color={appTheme.colors.highlight[400]} />,
      onPress: () => navigate('/(app)/(tabs)/inventory/equipment'),
    },
    {
      key:           'profile',
      label:         t('drawer.profile'),
      href:          '/profile',
      icon:          <User size={ICON_SIZE} color={iconInactive} />,
      onPress:       () => navigate('/(app)/(tabs)/profile'),
      dividerBefore: true,
    },
    {
      key:     'settings',
      label:   t('drawer.settings'),
      href:    '/settings',
      icon:    <Settings size={ICON_SIZE} color={iconInactive} />,
      onPress: () => navigate('/(app)/(tabs)/settings'),
    },
  ];

  const navItems: NavItem[] = [
    ...baseNavItems,
    ...(showProduction ? productionNavItems : []),
    ...tailNavItems,
  ];

  // ── Dynamic styles that react to theme changes ──────────────────────────
  const dynStyles = useMemo(() => ({
    container:           { backgroundColor: appTheme.colors.surface },
    header:              { borderBottomColor: appTheme.colors.border },
    userName:            { color: appTheme.colors.text },
    businessName:        { color: appTheme.colors.primary[400] },
    divider:             { backgroundColor: appTheme.colors.border },
    itemPressed:         { backgroundColor: isDark ? appTheme.colors.gray[700] : appTheme.colors.gray[100] },
    itemLabel:           { color: appTheme.colors.text },
    itemLabelActive:     { color: isDark ? appTheme.colors.primary[300] : appTheme.colors.primary[700] },
    itemActive:          {
      backgroundColor: isDark
        ? `${appTheme.colors.primary[500]}22`
        : appTheme.colors.primary[50],
    },
    itemActiveBar:       { backgroundColor: appTheme.colors.primary[500] },
    footer:              { borderTopColor: appTheme.colors.border },
    themeToggleRow:      { borderTopColor: appTheme.colors.border },
    themeToggleLabel:    { color: appTheme.colors.text },
  }), [appTheme, isDark]);

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
        {navItems.map((item) => {
          const isActive = item.href === normalizedPath;
          return (
            <React.Fragment key={item.key}>
              {item.dividerBefore === true && (
                <View style={[styles.divider, dynStyles.divider]} />
              )}
              <Pressable
                onPress={item.onPress}
                accessibilityRole="button"
                accessibilityState={{ selected: isActive }}
                style={({ pressed }) => [
                  styles.item,
                  isActive && [styles.itemActive, dynStyles.itemActive],
                  pressed && !isActive && [styles.itemPressed, dynStyles.itemPressed],
                ]}
              >
                {/* Left accent bar — only visible on the active item */}
                <View style={[styles.itemActiveBar, isActive && dynStyles.itemActiveBar]} />
                <View style={styles.itemIcon}>{item.icon}</View>
                <Text
                  variant="body"
                  weight={isActive ? 'semibold' : 'medium'}
                  style={[
                    styles.itemLabel,
                    isActive ? dynStyles.itemLabelActive : dynStyles.itemLabel,
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
          );
        })}
      </ScrollView>

      {/* ── Footer ── */}
      <View style={[styles.footer, dynStyles.footer]}>

        {/* Dark mode toggle row */}
        <View style={[styles.themeToggleRow, dynStyles.themeToggleRow]}>
          <View style={[styles.themeIconPill, { backgroundColor: isDark ? 'rgba(245,166,35,0.15)' : 'rgba(30,77,140,0.10)' }]}>
            <Moon
              size={16}
              color={isDark ? appTheme.colors.highlight[400] : appTheme.colors.primary[500]}
            />
          </View>
          <Text
            variant="body"
            weight="medium"
            style={[styles.themeToggleLabel, dynStyles.themeToggleLabel]}
          >
            {t('drawer.darkMode')}
          </Text>
          <RNSwitch
            value={isDark}
            onValueChange={handleThemeToggle}
            trackColor={{
              false: appTheme.colors.gray[300],
              true:  appTheme.colors.primary[500],
            }}
            thumbColor={isDark ? appTheme.colors.highlight[400] : appTheme.colors.white}
            ios_backgroundColor={appTheme.colors.gray[300]}
          />
        </View>

        <View style={[styles.divider, dynStyles.divider]} />

        <Button
          title={t('drawer.signOut')}
          variant="ghost"
          size="sm"
          onPress={handleLogout}
          leftIcon={<LogOut size={16} color={appTheme.colors.error[500]} />}
          fullWidth
        />
        <Text variant="caption" color="gray" style={styles.versionText}>
          {t('drawer.version')}
        </Text>
      </View>
      {dialog.Dialog}
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
    gap: 12,
    borderRadius: 10,
    marginHorizontal: 8,
    marginVertical: 1,
  },
  itemActive: {
    borderRadius: 10,
  },
  itemActiveBar: {
    width: 3,
    height: 20,
    borderRadius: 2,
    // color applied via dynStyles.itemActiveBar when active;
    // transparent when inactive so layout is unchanged
    backgroundColor: 'transparent',
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
  // ── Footer ─────────────────────────────────────────────────────────────
  footer: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
    gap: 4,
    alignItems: 'center',
    borderTopWidth: 1,
  },
  themeToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    paddingVertical: 10,
    gap: 12,
  },
  themeIconPill: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  themeToggleLabel: {
    flex: 1,
  },
  versionText: {
    marginTop: 4,
  },
});
