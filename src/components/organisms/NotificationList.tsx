import React, { useMemo } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  RefreshControl,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { Bell } from 'lucide-react-native';
import { useAppTheme, useThemeMode } from '@/core/theme';
import { Text } from '../atoms/Text';
import { Button } from '../atoms/Button/Button';
import { EmptyState } from '../molecules/EmptyState';
import { NotificationItem } from './NotificationItem';
import { Notification } from '@/types';

export interface NotificationListProps {
  notifications: Notification[];
  /** Pull-to-refresh handler. Refresh control is only shown when provided. */
  onRefresh?: () => void | Promise<void>;
  refreshing?: boolean;
  onPressItem: (notification: Notification) => void;
  onDismissItem?: (notification: Notification) => void;
  /** Enables the "Mark all read" action (shown only when there are unread rows). */
  onMarkAllRead?: () => void;
  /** Enables the "Clear all" action. */
  onClearAll?: () => void;
  emptyTitle?: string;
  emptyDescription?: string;
  /** Extra bottom padding so the last row clears a tab bar / floating bar. */
  contentBottomInset?: number;
  style?: StyleProp<ViewStyle>;
}

type Group = { key: string; label: string; items: Notification[] };

/**
 * Reusable, self-theming notification inbox body: a grouped (Today / Yesterday /
 * This Week / Older) list of `NotificationItem`s with pull-to-refresh, a bulk
 * action bar (Mark all read / Clear all) and a refined empty state. Rendered by
 * both the business tab and the customer inbox so the two stay in lockstep.
 * Reads `useAppTheme()` so it auto-resolves to the active context's palette.
 */
export const NotificationList: React.FC<NotificationListProps> = ({
  notifications,
  onRefresh,
  refreshing = false,
  onPressItem,
  onDismissItem,
  onMarkAllRead,
  onClearAll,
  emptyTitle = 'No notifications yet',
  emptyDescription = "When something happens, it'll show up right here.",
  contentBottomInset = 0,
  style,
}) => {
  const theme = useAppTheme();
  const isDark = useThemeMode() === 'dark';
  const spinnerColor = isDark ? theme.colors.primary[400] : theme.colors.primary[500];

  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.isRead).length,
    [notifications],
  );

  const groups = useMemo<Group[]>(() => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfYesterday = new Date(startOfToday);
    startOfYesterday.setDate(startOfYesterday.getDate() - 1);
    const startOfWeek = new Date(startOfToday);
    startOfWeek.setDate(startOfWeek.getDate() - 7);

    const buckets: Record<string, Notification[]> = {
      today: [],
      yesterday: [],
      thisWeek: [],
      older: [],
    };

    notifications.forEach((n) => {
      const d = new Date(n.createdAt);
      if (d >= startOfToday) buckets.today!.push(n);
      else if (d >= startOfYesterday) buckets.yesterday!.push(n);
      else if (d >= startOfWeek) buckets.thisWeek!.push(n);
      else buckets.older!.push(n);
    });

    return [
      { key: 'today', label: 'Today', items: buckets.today! },
      { key: 'yesterday', label: 'Yesterday', items: buckets.yesterday! },
      { key: 'thisWeek', label: 'This Week', items: buckets.thisWeek! },
      { key: 'older', label: 'Older', items: buckets.older! },
    ].filter((g) => g.items.length > 0);
  }, [notifications]);

  const dyn = useMemo(
    () =>
      StyleSheet.create({
        actionBar: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'flex-end',
          gap: theme.spacing.xs,
          paddingHorizontal: theme.spacing.lg,
          paddingTop: theme.spacing.sm,
        },
        sectionLabel: {
          color: theme.colors.textSecondary,
          textTransform: 'uppercase',
          letterSpacing: 0.6,
          marginBottom: theme.spacing.sm,
          marginTop: theme.spacing.md,
        },
      }),
    [theme],
  );

  const showMarkAll = onMarkAllRead !== undefined && unreadCount > 0;
  const showClearAll = onClearAll !== undefined && notifications.length > 0;
  const showActionBar = showMarkAll || showClearAll;

  const refreshControl = onRefresh
    ? (
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            void onRefresh();
          }}
          tintColor={spinnerColor}
          colors={[spinnerColor]}
        />
      )
    : undefined;

  if (notifications.length === 0) {
    return (
      <ScrollView
        style={style}
        contentContainerStyle={styles.emptyContainer}
        {...(refreshControl ? { refreshControl } : {})}
        showsVerticalScrollIndicator={false}
      >
        <EmptyState
          size="lg"
          icon={<Bell size={34} color={spinnerColor} />}
          iconBackgroundColor={isDark ? theme.colors.surfaceSubtle : theme.colors.primary[50]}
          title={emptyTitle}
          description={emptyDescription}
          {...(onRefresh
            ? {
                action: {
                  label: 'Refresh',
                  onPress: () => {
                    void onRefresh();
                  },
                  variant: 'outline' as const,
                },
              }
            : {})}
        />
      </ScrollView>
    );
  }

  return (
    <ScrollView
      style={style}
      contentContainerStyle={[
        styles.scrollContent,
        { paddingBottom: theme.spacing.lg + contentBottomInset },
      ]}
      {...(refreshControl ? { refreshControl } : {})}
      showsVerticalScrollIndicator={false}
    >
      {showActionBar && (
        <View style={dyn.actionBar}>
          {showMarkAll && (
            <Button
              title="Mark all read"
              variant="ghost"
              size="sm"
              onPress={onMarkAllRead!}
            />
          )}
          {showClearAll && (
            <Button title="Clear all" variant="ghost" size="sm" onPress={onClearAll!} />
          )}
        </View>
      )}

      <View style={styles.body}>
        {groups.map((group) => (
          <View key={group.key} style={styles.group}>
            <Text variant="caption" weight="semibold" style={dyn.sectionLabel}>
              {group.label}
            </Text>
            <View style={styles.groupItems}>
              {group.items.map((notification) => (
                <NotificationItem
                  key={notification.id}
                  notification={notification}
                  onPress={onPressItem}
                  {...(onDismissItem ? { onDismiss: onDismissItem } : {})}
                />
              ))}
            </View>
          </View>
        ))}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 4,
  },
  emptyContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 48,
  },
  body: {
    marginTop: 4,
  },
  group: {
    marginBottom: 4,
  },
  groupItems: {
    gap: 10,
  },
});
