import React, { useEffect, useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { useNotificationStore } from '@/store';
import { useAppTheme } from '@/core/theme';
import { Text } from '@/components/atoms/Text';
import { Badge } from '@/components/atoms/Badge';
import { NotificationList } from '@/components/organisms/NotificationList';
import { useRefreshControl } from '@/hooks';
import { Notification } from '@/types';

export default function NotificationsScreen() {
  const { notifications, markAsRead, markAllAsRead, clearAll, refreshNotifications } =
    useNotificationStore();
  const theme = useAppTheme();
  const router = useRouter();

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  useEffect(() => {
    // Load once on mount. Access via getState() so the effect has no reactive
    // dependencies — it intentionally runs a single time.
    void useNotificationStore.getState().refreshNotifications();
  }, []);

  const { refreshing, onRefresh } = useRefreshControl(refreshNotifications);

  const handleNotificationPress = (notification: Notification) => {
    markAsRead(notification.id);
    // Business notifications may carry no route → only navigate when present.
    const route = notification.data?.route;
    if (typeof route === 'string' && route.length > 0) {
      router.push(route);
    }
  };

  const dyn = useMemo(
    () =>
      StyleSheet.create({
        container: {
          flex: 1,
          backgroundColor: theme.colors.background,
        },
        header: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: theme.spacing.sm,
          paddingHorizontal: theme.spacing.lg,
          paddingTop: theme.spacing.lg,
          paddingBottom: theme.spacing.md,
        },
        title: {
          color: theme.colors.text,
        },
      }),
    [theme],
  );

  return (
    <View style={dyn.container}>
      <StatusBar style="light" />

      <View style={dyn.header}>
        <Text variant="h3" weight="bold" style={dyn.title}>
          Notifications
        </Text>
        {unreadCount > 0 && <Badge count={unreadCount} variant="error" size="md" />}
      </View>

      <NotificationList
        notifications={notifications}
        refreshing={refreshing}
        onRefresh={onRefresh}
        onPressItem={handleNotificationPress}
        onMarkAllRead={markAllAsRead}
        onClearAll={clearAll}
        emptyTitle="No notifications yet"
        emptyDescription="When you receive notifications, they'll appear here."
        style={styles.list}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    flex: 1,
  },
});
