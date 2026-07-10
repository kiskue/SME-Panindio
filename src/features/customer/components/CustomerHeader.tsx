import React from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { ChevronLeft, Bell } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { Text } from '@/components/atoms/Text';
import { IconButton } from '@/components/atoms/IconButton';
import { Badge } from '@/components/atoms/Badge';
import { useNotificationStore } from '@/store';
import { theme } from '@/core/theme';

const BRAND_NAVY = theme.colors.primary[500];
const BRAND_AMBER = theme.colors.highlight[400];
const BRAND_GREEN = theme.colors.accent[500];

export interface CustomerHeaderProps {
  /** Main header title. */
  title: string;
  /** Optional smaller subtitle rendered under the title. */
  subtitle?: string;
  /** Show a back chevron on the left and wire it to this handler. */
  onBack?: () => void;
  /** Optional element rendered on the right (e.g. a CartButton). */
  rightAction?: React.ReactNode;
  /**
   * Render the notification bell (with a live unread badge) in the right slot,
   * alongside any `rightAction`. Defaults to `true`; pass `false` on the inbox
   * screen itself or focused flows where an inbox entry point is redundant.
   */
  showNotificationBell?: boolean;
  /** Custom content rendered below the title row (e.g. a search bar). */
  children?: React.ReactNode;
}

/**
 * Brand header for the customer (suki) experience: the navy band topped with
 * the navy / amber / green awning stripe, a title, an optional back button and
 * a right-side action cluster (notification bell + optional cart, etc). Extracted
 * from the copy-pasted headers in home / products / profile / cart so brand
 * styling lives in one place.
 */
export const CustomerHeader: React.FC<CustomerHeaderProps> = ({
  title,
  subtitle,
  onBack,
  rightAction,
  showNotificationBell = true,
  children,
}) => {
  const router = useRouter();
  // Primitive count keeps this subscription re-rendering only when the number
  // actually changes (not on every notification-store mutation).
  const unreadCount = useNotificationStore((s) => s.notifications.filter((n) => !n.isRead).length);

  const bellEl = showNotificationBell ? (
    <View style={styles.bellWrap}>
      <IconButton
        icon={<Bell size={22} color="#FFFFFF" />}
        onPress={() => router.push('/(customer)/notifications')}
        variant="ghost"
        size="md"
        accessibilityLabel={
          unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications'
        }
      />
      {unreadCount > 0 && (
        <View style={styles.bellBadge} pointerEvents="none">
          <Badge count={unreadCount} variant="error" size="sm" />
        </View>
      )}
    </View>
  ) : null;

  const hasRight = bellEl !== null || rightAction !== undefined;

  return (
    <View style={styles.header}>
      <View style={styles.brandStripe}>
        <View style={[styles.stripe, { backgroundColor: BRAND_NAVY }]} />
        <View style={[styles.stripe, { backgroundColor: BRAND_AMBER }]} />
        <View style={[styles.stripe, { backgroundColor: BRAND_GREEN }]} />
      </View>

      <View style={styles.row}>
        {onBack ? (
          <Pressable
            onPress={onBack}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            style={styles.backBtn}
          >
            <ChevronLeft size={26} color="#FFFFFF" />
          </Pressable>
        ) : null}

        <View style={styles.titleWrap}>
          <Text variant="h5" weight="bold" color="white" numberOfLines={1}>
            {title}
          </Text>
          {subtitle !== undefined && (
            <Text variant="body-xs" color="white" style={styles.subtitle} numberOfLines={1}>
              {subtitle}
            </Text>
          )}
        </View>

        {hasRight ? (
          <View style={styles.rightSlot}>
            {bellEl}
            {rightAction !== undefined ? rightAction : null}
          </View>
        ) : (
          onBack && <View style={styles.rightSpacer} />
        )}
      </View>

      {children !== undefined && <View style={styles.childrenWrap}>{children}</View>}
    </View>
  );
};

const styles = StyleSheet.create({
  header: {
    backgroundColor: BRAND_NAVY,
    paddingTop: theme.spacing.sm,
    paddingBottom: theme.spacing.md,
    paddingHorizontal: theme.spacing.md,
    overflow: 'hidden',
  },
  brandStripe: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 3,
    flexDirection: 'row',
  },
  stripe: { flex: 1 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 44,
  },
  backBtn: {
    width: 36,
    height: 44,
    alignItems: 'flex-start',
    justifyContent: 'center',
    marginLeft: -6,
  },
  titleWrap: { flex: 1 },
  subtitle: { color: 'rgba(255,255,255,0.75)', marginTop: 2 },
  rightSlot: {
    marginLeft: theme.spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  rightSpacer: { width: 36 },
  bellWrap: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bellBadge: {
    position: 'absolute',
    top: 4,
    right: 2,
  },
  childrenWrap: { marginTop: theme.spacing.sm },
});
