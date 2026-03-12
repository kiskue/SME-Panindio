import React, { useState, useEffect, useMemo } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useNotificationStore } from '@/store';
import { useAppTheme } from '@/core/theme';
import { Text } from '@/components/atoms/Text';
import { NotificationItem } from '@/components/organisms/NotificationItem';
import { Card } from '@/components/atoms/Card';
import { Button } from '@/components/atoms/Button/Button';
import { Notification } from '@/types';

type NotificationGroups = {
  today: Notification[];
  yesterday: Notification[];
  thisWeek: Notification[];
  older: Notification[];
};

export default function NotificationsScreen() {
  const { notifications, markAsRead, clearAll, refreshNotifications } = useNotificationStore();
  const theme = useAppTheme();
  const [refreshing, setRefreshing] = useState(false);

  const unreadCount = notifications.filter(n => !n.isRead).length;

  useEffect(() => {
    // Load notifications on mount. Access via getState() so the effect has no
    // reactive dependencies — it intentionally runs once on mount only.
    void useNotificationStore.getState().refreshNotifications();
  }, []);

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    try {
      await refreshNotifications();
    } catch (error) {
      console.error('Failed to refresh notifications:', error);
    } finally {
      setRefreshing(false);
    }
  }, [refreshNotifications]);

  const handleNotificationPress = (notification: Notification) => {
    markAsRead(notification.id);

    // Handle notification routing based on type/data
    if (notification.data?.route) {
      // Navigate to specific route
      console.log('Would navigate to:', notification.data.route);
    }
  };

  const handleDismissNotification = (notification: Notification) => {
    // In a real app, this would call an API to dismiss the notification
    console.log('Dismissing notification:', notification.id);
  };

  const handleClearAll = () => {
    clearAll();
  };

  const groupedNotifications = React.useMemo((): NotificationGroups => {
    const groups: NotificationGroups = {
      today: [],
      yesterday: [],
      thisWeek: [],
      older: [],
    };

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const thisWeek = new Date(today);
    thisWeek.setDate(thisWeek.getDate() - 7);

    notifications.forEach(notification => {
      const notificationDate = new Date(notification.createdAt);

      if (notificationDate >= today) {
        groups.today.push(notification);
      } else if (notificationDate >= yesterday) {
        groups.yesterday.push(notification);
      } else if (notificationDate >= thisWeek) {
        groups.thisWeek.push(notification);
      } else {
        groups.older.push(notification);
      }
    });

    return groups;
  }, [notifications]);

  const renderNotificationGroup = (title: string, items: Notification[]) => {
    if (items.length === 0) return null;

    return (
      <View key={title} style={styles.group}>
        <Text variant="h6" weight="medium" style={dynStyles.groupTitle}>
          {title}
        </Text>
        {items.map(notification => (
          <NotificationItem
            key={notification.id}
            notification={notification}
            onPress={handleNotificationPress}
            onDismiss={handleDismissNotification}
            showTime={false}
          />
        ))}
      </View>
    );
  };

  const dynStyles = useMemo(() => StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: theme.spacing.lg,
      paddingVertical: theme.spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    title: {
      color: theme.colors.text,
    },
    badge: {
      backgroundColor: theme.colors.primary[500],
      borderRadius: 12,
      paddingHorizontal: 8,
      paddingVertical: 4,
      marginRight: theme.spacing.sm,
    },
    groupTitle: {
      color: theme.colors.textSecondary,
      marginBottom: theme.spacing.sm,
      marginTop: theme.spacing.md,
    },
    emptyTitle: {
      marginBottom: theme.spacing.sm,
      color: theme.colors.text,
      textAlign: 'center',
    },
  }), [theme]);

  return (
    <View style={dynStyles.container}>
      <StatusBar style="light" />

      {/* Header */}
      <View style={dynStyles.header}>
        <Text variant="h3" weight="bold" style={dynStyles.title}>
          Notifications
        </Text>
        <View style={styles.headerActions}>
          {unreadCount > 0 && (
            <View style={dynStyles.badge}>
              <Text variant="body-xs" weight="medium" color="white">
                {unreadCount}
              </Text>
            </View>
          )}
          {notifications.length > 0 && (
            <Button
              title="Clear All"
              variant="ghost"
              size="sm"
              onPress={handleClearAll}
            />
          )}
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollViewContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        showsVerticalScrollIndicator={false}
      >
        {notifications.length === 0 ? (
          <Card variant="elevated" padding="xl" style={styles.emptyState}>
            <Text style={styles.emptyIcon}>🔔</Text>
            <Text variant="h5" weight="medium" style={dynStyles.emptyTitle}>
              No notifications yet
            </Text>
            <Text variant="body-sm" color="gray" style={styles.emptyText}>
              When you receive notifications, they'll appear here.
            </Text>
            <Button
              title="Refresh"
              variant="outline"
              size="sm"
              onPress={onRefresh}
              style={styles.refreshButton}
            />
          </Card>
        ) : (
          <View style={styles.notificationsList}>
            {renderNotificationGroup('Today', groupedNotifications.today)}
            {renderNotificationGroup('Yesterday', groupedNotifications.yesterday)}
            {renderNotificationGroup('This Week', groupedNotifications.thisWeek)}
            {renderNotificationGroup('Older', groupedNotifications.older)}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  scrollViewContent: {
    padding: 24,
  },
  notificationsList: {
    gap: 16,
  },
  group: {
    gap: 8,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 96,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyText: {
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  refreshButton: {
    marginTop: 16,
  },
});
