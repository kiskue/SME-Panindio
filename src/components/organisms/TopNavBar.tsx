import React, { useMemo } from 'react';
import {
  View,
  StyleSheet,
  Pressable,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Menu, Bell, ArrowLeft } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { Text } from '../atoms/Text';
import { BrandLogo } from '../atoms/BrandLogo';
import { useAppTheme } from '../../core/theme';
import { ComponentProps } from '@/types';

export interface TopNavBarProps extends ComponentProps {
  /** Screen title shown in the center. When omitted the BrandLogo wordmark is rendered. */
  title?: string;
  /** Called when the hamburger button is pressed. Required when showMenuButton is true. */
  onMenuPress?: () => void;
  /** Show the hamburger menu icon on the left. Default true. */
  showMenuButton?: boolean;
  /** Show a back-chevron instead of the hamburger (for nested/modal screens). Default false. */
  showBackButton?: boolean;
  /** Called when the back button is pressed. Falls back to router.back() if not provided. */
  onBackPress?: () => void;
  /** Notification bell badge count. 0 hides the badge dot. */
  notificationCount?: number;
  /** Called when the bell icon is pressed. */
  onNotificationPress?: () => void;
  /** Extra action node rendered to the right of the bell (e.g. search, avatar). */
  rightAction?: React.ReactNode;
  /** Background colour override — defaults to theme.colors.primary[500] */
  backgroundColor?: string;
}

const HIT_SLOP = { top: 8, bottom: 8, left: 8, right: 8 };
const MAX_BADGE = 99;

export const TopNavBar: React.FC<TopNavBarProps> = ({
  title,
  onMenuPress,
  showMenuButton = true,
  showBackButton = false,
  onBackPress,
  notificationCount = 0,
  onNotificationPress,
  rightAction,
  backgroundColor,
  style,
}) => {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const theme  = useAppTheme();

  const bgColor = backgroundColor ?? theme.colors.primary[500];

  const handleBackPress = () => {
    if (onBackPress) {
      onBackPress();
    } else {
      router.back();
    }
  };

  const showBadge = notificationCount > 0;
  const badgeLabel = notificationCount > MAX_BADGE ? `${MAX_BADGE}+` : String(notificationCount);

  const dynStyles = useMemo(() => StyleSheet.create({
    titleText: {
      color: theme.colors.white,
    },
    badge: {
      position: 'absolute',
      top: -4,
      right: -4,
      backgroundColor: theme.colors.highlight[400],
      borderRadius: theme.borderRadius.full,
      minWidth: 18,
      height: 18,
      paddingHorizontal: 4,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1.5,
      borderColor: theme.colors.primary[500],
    },
    badgeText: {
      color: theme.colors.white,
      fontSize: 10,
      lineHeight: 12,
    },
  }), [theme]);

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: bgColor, paddingTop: insets.top },
        style,
      ]}
    >
      <View style={styles.inner}>
        {/* ── Left: hamburger OR back ── */}
        <View style={styles.leftSlot}>
          {showBackButton ? (
            <Pressable
              onPress={handleBackPress}
              hitSlop={HIT_SLOP}
              style={styles.iconBtn}
              accessibilityRole="button"
              accessibilityLabel="Go back"
            >
              <ArrowLeft size={24} color={theme.colors.white} />
            </Pressable>
          ) : showMenuButton ? (
            <Pressable
              onPress={onMenuPress}
              hitSlop={HIT_SLOP}
              style={styles.iconBtn}
              accessibilityRole="button"
              accessibilityLabel="Open navigation menu"
            >
              <Menu size={24} color={theme.colors.white} />
            </Pressable>
          ) : (
            /* Reserve the same width so center stays centred */
            <View style={styles.iconBtn} />
          )}
        </View>

        {/* ── Center: title or BrandLogo ── */}
        <View style={styles.centerSlot} pointerEvents="none">
          {title !== undefined ? (
            <Text
              variant="h5"
              weight="semibold"
              numberOfLines={1}
              style={dynStyles.titleText}
            >
              {title}
            </Text>
          ) : (
            <BrandLogo variant="wordmark" size="xs" />
          )}
        </View>

        {/* ── Right: bell + optional extra action ── */}
        <View style={styles.rightSlot}>
          {onNotificationPress !== undefined && (
            <Pressable
              onPress={onNotificationPress}
              hitSlop={HIT_SLOP}
              style={styles.iconBtn}
              accessibilityRole="button"
              accessibilityLabel={
                showBadge
                  ? `Notifications, ${notificationCount} unread`
                  : 'Notifications'
              }
            >
              <View>
                <Bell size={24} color={theme.colors.white} />
                {showBadge && (
                  <View style={dynStyles.badge}>
                    <Text variant="body-xs" weight="bold" style={dynStyles.badgeText}>
                      {badgeLabel}
                    </Text>
                  </View>
                )}
              </View>
            </Pressable>
          )}
          {rightAction !== undefined && (
            <View style={styles.rightActionSlot}>{rightAction}</View>
          )}
        </View>
      </View>
    </View>
  );
};

const BAR_HEIGHT = Platform.OS === 'ios' ? 44 : 56;

const styles = StyleSheet.create({
  container: {
    width: '100%',
    // shadow so the bar sits above screen content
    shadowColor: '#1E4D8C',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.10,
    shadowRadius: 6,
    elevation: 4,
    zIndex: 100,
  },
  inner: {
    height: BAR_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  leftSlot: {
    width: 44,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  centerSlot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  rightSlot: {
    width: 'auto',
    minWidth: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 4,
  },
  iconBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rightActionSlot: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
