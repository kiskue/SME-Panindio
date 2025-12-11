import React from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { theme } from '../../core/theme';
import { Text } from '../atoms/Text';
import { Card } from '../atoms/Card';
import { Notification } from '../../../types';

interface NotificationItemProps {
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
      case 'ERROR':
        return '❌';
      case 'SUCCESS':
        return '✅';
      default:
        return '📢';
    }
  };

  const getBorderColor = () => {
    switch (notification.type) {
      case 'INFO':
        return theme.colors.info[500];
      case 'WARNING':
        return theme.colors.warning[500];
      case 'ERROR':
        return theme.colors.error[500];
      case 'SUCCESS':
        return theme.colors.success[500];
      default:
        return theme.colors.primary[500];
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

  return (
    <Card
      variant={notification.read ? 'default' : 'filled'}
      padding="md"
      style={[
        styles.container,
        !notification.read && { borderLeftWidth: 4, borderLeftColor: getBorderColor() },
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
          {notification.message}
        </Text>
        
        {notification.data && Object.keys(notification.data).length > 0 && (
          <View style={styles.dataContainer}>
            {Object.entries(notification.data).slice(0, 2).map(([key, value]) => (
              <View key={key} style={styles.dataItem}>
                <Text variant="caption" color="gray" style={styles.dataKey}>
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
  container: {
    marginBottom: theme.spacing.sm,
  },
  content: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: theme.spacing.xs,
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  icon: {
    marginRight: theme.spacing.xs,
    fontSize: 16,
  },
  title: {
    flex: 1,
  },
  time: {
    marginLeft: theme.spacing.sm,
  },
  message: {
    marginBottom: theme.spacing.xs,
  },
  dataContainer: {
    marginTop: theme.spacing.xs,
    marginBottom: theme.spacing.sm,
  },
  dataItem: {
    flexDirection: 'row',
    marginBottom: theme.spacing.xs,
  },
  dataKey: {
    marginRight: theme.spacing.xs,
    fontWeight: theme.typography.weights.medium,
  },
  dataValue: {
    flex: 1,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: theme.spacing.xs,
  },
  dismissButton: {
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
  },
});