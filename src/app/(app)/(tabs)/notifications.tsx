import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useNotificationStore } from '@/store';
import { theme } from '@/core/theme';
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
  const [refreshing, setRefreshing] = useState(false);

  const unreadCount = notifications.filter(n => !n.isRead).length;

  useEffect(() => {
    // Load notifications on mount. Access via getState() so the effect has no
    // reactive dependencies — it intentionally runs once on mount only.
    // Including the action in deps ([refreshNotifications]) is fragile because
    // any future change that makes the reference unstable would cause infinite loops.
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

  const renderNotificationGroup = (title: string, notifications: Notification[]) => {
    if (notifications.length === 0) return null;

    return (
      <View key={title} style={styles.group}>
        <Text variant="h6" weight="medium" style={styles.groupTitle}>
          {title}
        </Text>
        {notifications.map(notification => (
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

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="auto" />
      
      {/* Header */}
      <View style={styles.header}>
        <Text variant="h3" weight="bold" style={styles.title}>
          Notifications
        </Text>
        <View style={styles.headerActions}>
          {unreadCount > 0 && (
            <View style={styles.badge}>
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
            <Text variant="h5" weight="medium" style={styles.emptyTitle}>
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
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
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  badge: {
    backgroundColor: theme.colors.primary[500],
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginRight: theme.spacing.sm,
  },
  scrollViewContent: {
    padding: theme.spacing.lg,
  },
  notificationsList: {
    gap: theme.spacing.md,
  },
  group: {
    gap: theme.spacing.sm,
  },
  groupTitle: {
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.sm,
    marginTop: theme.spacing.md,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: theme.spacing.xxl * 2,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: theme.spacing.md,
  },
  emptyTitle: {
    marginBottom: theme.spacing.sm,
    color: theme.colors.text,
    textAlign: 'center',
  },
  emptyText: {
    textAlign: 'center',
    marginBottom: theme.spacing.lg,
    lineHeight: 20,
  },
  refreshButton: {
    marginTop: theme.spacing.md,
  },
});