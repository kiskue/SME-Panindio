import React, { useMemo } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { useAppTheme } from '@/core/theme';
import { theme as staticTheme } from '@/core/theme';
import { Text } from '../atoms/Text';
import { Card } from '../atoms/Card';
import { Notification } from '@/types';

export interface NotificationItemProps {
  notification: Notification;
  onPress?: (notification: Notification) => void;
  onDismiss?: (notification: Notification) => void;
  showTime?: boolean;
}

export const NotificationItem: React.FC<NotificationItemProps> = ({
  notification,
  onPress,
  onDismiss,
  showTime = true,
}) => {
  const theme = useAppTheme();

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));

    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;

    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours}h ago`;

    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 7) return `${diffInDays}d ago`;

    return date.toLocaleDateString();
  };

  const getNotificationIcon = () => {
    switch (notification.type) {
      case 'INFO':
        return 'ℹ️';
      case 'WARNING':
        return '⚠️';
      case 'ALERT':
        return '❌';
      case 'CHAT_MESSAGE':
        return '💬';
      default:
        return '📢';
    }
  };

  const getBorderColor = () => {
    switch (notification.type) {
      case 'INFO':
        return staticTheme.colors.info[500];
      case 'WARNING':
        return staticTheme.colors.warning[500];
      case 'ALERT':
        return staticTheme.colors.error[500];
      case 'CHAT_MESSAGE':
        return staticTheme.colors.primary[500];
      default:
        return staticTheme.colors.primary[500];
    }
  };

  const handlePress = () => {
    if (onPress) {
      onPress(notification);
    }
  };

  const handleDismiss = () => {
    if (onDismiss) {
      onDismiss(notification);
    }
  };

  const dynStyles = useMemo(() => StyleSheet.create({
    container: {
      marginBottom: theme.spacing.sm,
    },
    dataKey: {
      marginRight: theme.spacing.xs,
      fontWeight: staticTheme.typography.weights.medium,
    },
  }), [theme]);

  return (
    <Card
      variant={notification.isRead ? 'default' : 'filled'}
      padding="md"
      style={[
        dynStyles.container,
        !notification.isRead && { borderLeftWidth: 4, borderLeftColor: getBorderColor() },
      ]}
      onPress={handlePress}
    >
      <View style={styles.content}>
        <View style={styles.header}>
          <View style={styles.titleContainer}>
            <Text style={styles.icon}>{getNotificationIcon()}</Text>
            <Text variant="h6" weight="medium" style={styles.title}>
              {notification.title}
            </Text>
          </View>
          {showTime && (
            <Text variant="caption" color="gray" style={styles.time}>
              {formatTime(notification.createdAt)}
            </Text>
          )}
        </View>

        <Text variant="body-sm" color="gray" style={styles.message} numberOfLines={2}>
          {notification.body}
        </Text>

        {notification.data && Object.keys(notification.data).length > 0 && (
          <View style={styles.dataContainer}>
            {Object.entries(notification.data).slice(0, 2).map(([key, value]) => (
              <View key={key} style={styles.dataItem}>
                <Text variant="caption" color="gray" style={dynStyles.dataKey}>
                  {key}:
                </Text>
                <Text variant="caption" style={styles.dataValue}>
                  {String(value)}
                </Text>
              </View>
            ))}
          </View>
        )}

        {onDismiss && (
          <View style={styles.actions}>
            <Pressable
              onPress={handleDismiss}
              style={styles.dismissButton}
            >
              <Text variant="caption" color="gray">
                Dismiss
              </Text>
            </Pressable>
          </View>
        )}
      </View>
    </Card>
  );
};

const styles = StyleSheet.create({
  content: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: staticTheme.spacing.xs,
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  icon: {
    marginRight: staticTheme.spacing.xs,
    fontSize: 16,
  },
  title: {
    flex: 1,
  },
  time: {
    marginLeft: staticTheme.spacing.sm,
  },
  message: {
    marginBottom: staticTheme.spacing.xs,
  },
  dataContainer: {
    marginTop: staticTheme.spacing.xs,
    marginBottom: staticTheme.spacing.sm,
  },
  dataItem: {
    flexDirection: 'row',
    marginBottom: staticTheme.spacing.xs,
  },
  dataValue: {
    flex: 1,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: staticTheme.spacing.xs,
  },
  dismissButton: {
    paddingHorizontal: staticTheme.spacing.sm,
    paddingVertical: staticTheme.spacing.xs,
  },
});
