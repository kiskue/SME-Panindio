import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  ScrollView,
  Pressable,
  StyleSheet,
  Animated,
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
  ChevronDown,
  Heart,
} from 'lucide-react-native';
import { useRouter, usePathname } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Avatar } from '../atoms/Avatar';
import { Badge } from '../atoms/Badge';
import { Text } from '../atoms/Text';
import { Button } from '../atoms/Button';
import { ThemeToggle } from '../atoms/ThemeToggle';
import { useAppTheme, useThemeMode } from '../../core/theme';
import {
  useAuthStore,
  selectCurrentUser,
  useNotificationStore,
  useInventoryStore,
  selectLowStockCount,
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

// ── Sub-item renderer (module-level to avoid re-creation inside the map) ──
interface SubItemProps {
  itemKey:   string;
  label:     string;
  icon:      React.ReactNode;
  isActive:  boolean;
  onPress:   () => void;
  dynStyles: {
    subItemActive:       { backgroundColor: string };
    subItemPressed:      { backgroundColor: string };
    subItemLabel:        { color: string };
    subItemLabelActive:  { color: string };
    subItemBullet:       { backgroundColor: string };
    subItemBulletActive: { backgroundColor: string };
  };
}

function renderSubItem(props: SubItemProps): React.ReactElement {
  const { itemKey, label, icon, isActive, onPress, dynStyles } = props;
  return (
    <Pressable
      key={itemKey}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: isActive }}
      style={({ pressed }) => [
        styles.subItem,
        isActive  && [styles.subItemActive, dynStyles.subItemActive],
        pressed && !isActive && dynStyles.subItemPressed,
      ]}
    >
      {/* Bullet dot instead of accent bar */}
      <View style={[styles.subItemBullet, isActive ? dynStyles.subItemBulletActive : dynStyles.subItemBullet]} />
      <View style={styles.itemIcon}>{icon}</View>
      <Text
        variant="body"
        weight={isActive ? 'semibold' : 'normal'}
        style={[
          styles.itemLabel,
          isActive ? dynStyles.subItemLabelActive : dynStyles.subItemLabel,
        ]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </Pressable>
  );
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

  // useThemeMode()/useAppTheme() read from Zustand directly (not React context),
  // so toggling only re-renders subscribing leaves — navigation containers never
  // re-render (avoids the Fabric "viewState for tag X" crash). The ThemeToggle
  // atom owns the toggle action itself, so no handler is needed here.
  const themeMode  = useThemeMode();
  const isDark     = themeMode === 'dark';

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

  // ── Inventory accordion ──────────────────────────────────────────────────
  // Start expanded when the current path is under /inventory/
  const isUnderInventory = normalizedPath.startsWith('/inventory/');
  // Active when on the inventory index itself or any of its child screens.
  const isInventoryActive = normalizedPath === '/inventory' || isUnderInventory;
  const [inventoryExpanded, setInventoryExpanded] = useState<boolean>(isUnderInventory);

  // Animated value: 0 = collapsed, 1 = expanded
  const accordionAnim = useRef(new Animated.Value(isUnderInventory ? 1 : 0)).current;

  // Chevron rotation: 0deg (collapsed) → 180deg (expanded)
  const chevronRotation = accordionAnim.interpolate({
    inputRange:  [0, 1],
    outputRange: ['0deg', '180deg'],
  });

  // Sub-item count drives the maxHeight: Products + Equipment always shown,
  // Ingredients only when showProduction is true.
  const subItemCount = showProduction ? 3 : 2;
  const SUB_ITEM_HEIGHT = 42; // px per sub-item row

  const maxHeight = accordionAnim.interpolate({
    inputRange:  [0, 1],
    outputRange: [0, subItemCount * SUB_ITEM_HEIGHT],
  });

  const toggleInventoryAccordion = useCallback(() => {
    const nextOpen = !inventoryExpanded;
    setInventoryExpanded(nextOpen);
    Animated.timing(accordionAnim, {
      toValue:         nextOpen ? 1 : 0,
      duration:        200,
      useNativeDriver: false,
    }).start();
  }, [inventoryExpanded, accordionAnim]);

  // Smart inventory row tap:
  //  • Not in the inventory section yet → first tap navigates straight there.
  //  • Already on inventory → the tap reveals/hides the collapsible submenu
  //    instead, surfacing Products / Ingredients / Equipment without leaving
  //    the screen. (The chevron always toggles the submenu regardless.)
  const handleInventoryPress = useCallback(() => {
    if (isInventoryActive) {
      toggleInventoryAccordion();
    } else {
      navigate('/(app)/(tabs)/inventory');
    }
  }, [isInventoryActive, toggleInventoryAccordion, navigate]);

  // The drawer content is persistent (it never unmounts across navigation), so
  // the useState/useRef seeds above only ever reflect the route at first mount.
  // Re-sync the accordion whenever we cross in/out of an inventory *child*
  // screen — so reaching a child by any path (e.g. a category card on the index)
  // reveals the submenu with its active row, and it collapses once we leave.
  // Note: the bare /inventory index intentionally stays collapsed, preserving
  // the "tap again to reveal the menu" behavior.
  useEffect(() => {
    setInventoryExpanded(isUnderInventory);
    Animated.timing(accordionAnim, {
      toValue:         isUnderInventory ? 1 : 0,
      duration:        200,
      useNativeDriver: false,
    }).start();
  }, [isUnderInventory, accordionAnim]);

  // Navigate to an inventory child screen.
  // Push inventory index first so the Stack has a back-destination, then push
  // the child after a short frame delay so the index screen mounts before we
  // push on top of it.
  const navigateToInventoryChild = useCallback(
    (child: 'products' | 'ingredients' | 'equipment') => {
      closeDrawer();
      setTimeout(() => {
        router.push('/(app)/(tabs)/inventory');
        setTimeout(() => {
          router.push(`/(app)/(tabs)/inventory/${child}` as Parameters<typeof router.push>[0]);
        }, 100);
      }, 50);
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
      key:           'suki',
      label:         'Suki (Loyal Customers)',
      href:          '/suki',
      icon:          <Heart size={ICON_SIZE} color="#EC4899" />,
      onPress:       () => navigate('/(app)/(tabs)/suki'),
      dividerBefore: false,
    },
    {
      key:           'inventory',
      label:         t('drawer.inventory'),
      href:          '/inventory',
      icon:          <Package size={ICON_SIZE} color={iconInactive} />,
      ...(lowStockCount > 0 ? { badge: lowStockCount } : {}),
      onPress:       handleInventoryPress,
      dividerBefore: false,
    },
  ];

  const tailNavItems: NavItem[] = [
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
    ...tailNavItems,
  ];

  // ── Dynamic styles that react to theme changes ──────────────────────────
  const dynStyles = useMemo(() => ({
    container:              { backgroundColor: appTheme.colors.surface },
    header:                 { borderBottomColor: appTheme.colors.border },
    userName:               { color: appTheme.colors.text },
    businessName:           { color: appTheme.colors.primary[400] },
    divider:                { backgroundColor: appTheme.colors.border },
    itemPressed:            { backgroundColor: isDark ? appTheme.colors.gray[700] : appTheme.colors.gray[100] },
    itemLabel:              { color: appTheme.colors.text },
    itemLabelActive:        { color: isDark ? appTheme.colors.primary[300] : appTheme.colors.primary[700] },
    itemActive:             {
      backgroundColor: isDark
        ? `${appTheme.colors.primary[500]}22`
        : appTheme.colors.primary[50],
    },
    itemActiveBar:          { backgroundColor: appTheme.colors.primary[500] },
    footer:                 { borderTopColor: appTheme.colors.border },
    themeToggleRow:         { borderTopColor: appTheme.colors.border },
    themeToggleLabel:       { color: appTheme.colors.text },
    // Accordion sub-item specific
    subItemLabel:           { color: appTheme.colors.text },
    subItemLabelActive:     { color: isDark ? appTheme.colors.primary[300] : appTheme.colors.primary[700] },
    subItemActive:          {
      backgroundColor: isDark
        ? `${appTheme.colors.primary[500]}18`
        : appTheme.colors.primary[50],
    },
    subItemPressed:         { backgroundColor: isDark ? appTheme.colors.gray[700] : appTheme.colors.gray[100] },
    subItemBullet:          { backgroundColor: appTheme.colors.gray[400] },
    subItemBulletActive:    { backgroundColor: appTheme.colors.primary[500] },
    accordionChevron:       { color: appTheme.colors.gray[400] },
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
          const isActive =
            item.key === 'inventory'
              ? isInventoryActive
              : item.href === normalizedPath;

          // The inventory row is a smart trigger: the first tap navigates to the
          // inventory screen, and a subsequent tap (while already there) toggles
          // the collapsible submenu. The chevron always toggles the submenu.
          const isInventoryRow = item.key === 'inventory';

          return (
            <React.Fragment key={item.key}>
              {item.dividerBefore === true && (
                <View style={[styles.divider, dynStyles.divider]} />
              )}
              <Pressable
                onPress={item.onPress}
                accessibilityRole="button"
                accessibilityState={{
                  selected: isActive,
                  ...(isInventoryRow ? { expanded: inventoryExpanded } : {}),
                }}
                {...(isInventoryRow
                  ? { accessibilityHint: isInventoryActive
                      ? t('drawer.inventoryToggleHint')
                      : t('drawer.inventoryOpenHint') }
                  : {})}
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
                {/* Chevron — dedicated tap target that always toggles the
                    submenu, so the user can preview Products / Ingredients /
                    Equipment without navigating away from the current screen. */}
                {isInventoryRow && (
                  <Pressable
                    onPress={toggleInventoryAccordion}
                    hitSlop={10}
                    accessibilityRole="button"
                    accessibilityLabel={t('drawer.inventory')}
                    accessibilityState={{ expanded: inventoryExpanded }}
                    style={styles.accordionChevronBtn}
                  >
                    <Animated.View style={{ transform: [{ rotate: chevronRotation }] }}>
                      <ChevronDown size={16} color={dynStyles.accordionChevron.color} />
                    </Animated.View>
                  </Pressable>
                )}
              </Pressable>

              {/* ── Inventory accordion sub-items ── */}
              {isInventoryRow && (
                <Animated.View style={[styles.accordionContainer, { maxHeight }]}>
                  {/* Products */}
                  {renderSubItem({
                    itemKey:  'inventory-products',
                    label:    t('drawer.products'),
                    icon:     <ShoppingBag size={ICON_SIZE - 2} color={appTheme.colors.primary[400]} />,
                    isActive: normalizedPath === '/inventory/products',
                    onPress:  () => navigateToInventoryChild('products'),
                    dynStyles,
                  })}
                  {/* Ingredients — production businesses only */}
                  {showProduction && renderSubItem({
                    itemKey:  'inventory-ingredients',
                    label:    t('drawer.ingredients'),
                    icon:     <Wheat size={ICON_SIZE - 2} color={appTheme.colors.success[500]} />,
                    isActive: normalizedPath === '/inventory/ingredients',
                    onPress:  () => navigateToInventoryChild('ingredients'),
                    dynStyles,
                  })}
                  {/* Equipment */}
                  {renderSubItem({
                    itemKey:  'inventory-equipment',
                    label:    t('drawer.equipment'),
                    icon:     <Wrench size={ICON_SIZE - 2} color={appTheme.colors.highlight[400]} />,
                    isActive: normalizedPath === '/inventory/equipment',
                    onPress:  () => navigateToInventoryChild('equipment'),
                    dynStyles,
                  })}
                </Animated.View>
              )}
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
          <ThemeToggle compact accessibilityLabel="Toggle dark mode" />
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
  // ── Accordion ───────────────────────────────────────────────────────────
  accordionChevronBtn: {
    padding: 4,
  },
  accordionContainer: {
    overflow: 'hidden',
  },
  subItem: {
    flexDirection:    'row',
    alignItems:       'center',
    paddingHorizontal: 16,
    paddingVertical:   10,
    paddingLeft:       32,  // extra left indent (32px base → visually 32 + itemIcon region)
    gap:               12,
    borderRadius:      10,
    marginHorizontal:  8,
    marginVertical:    1,
  },
  subItemActive: {
    borderRadius: 10,
  },
  subItemBullet: {
    width:        5,
    height:       5,
    borderRadius: 3,
  },
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
