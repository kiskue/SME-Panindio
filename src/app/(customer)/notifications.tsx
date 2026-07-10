import React, { useEffect, useMemo } from 'react';
import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { useNotificationStore } from '@/store';
import { useAppTheme } from '@/core/theme';
import { NotificationList } from '@/components/organisms/NotificationList';
import { CustomerHeader } from '@/features/customer/components/CustomerHeader';
import { useRefreshControl } from '@/hooks';
import { Notification } from '@/types';

const HOME_ROUTE = '/(customer)/(tabs)/home';

export default function CustomerNotificationsScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const { notifications, markAsRead, markAllAsRead, clearAll, refreshNotifications } =
    useNotificationStore();

  useEffect(() => {
    void useNotificationStore.getState().refreshNotifications();
  }, []);

  const { refreshing, onRefresh } = useRefreshControl(refreshNotifications);

  const handlePress = (notification: Notification) => {
    markAsRead(notification.id);
    const route = notification.data?.route;
    router.push(typeof route === 'string' && route.length > 0 ? route : HOME_ROUTE);
  };

  const containerStyle = useMemo(
    () => [styles.root, { backgroundColor: theme.colors.background }],
    [theme],
  );

  return (
    <SafeAreaView style={containerStyle} edges={['top', 'bottom']}>
      <StatusBar style="light" />

      <CustomerHeader
        title="Notifications"
        subtitle="Updates from your suki merchant"
        onBack={() => router.back()}
        showNotificationBell={false}
      />

      <NotificationList
        notifications={notifications}
        refreshing={refreshing}
        onRefresh={onRefresh}
        onPressItem={handlePress}
        onMarkAllRead={markAllAsRead}
        onClearAll={clearAll}
        emptyTitle="You're all caught up"
        emptyDescription="New product drops and updates from your merchant will appear here."
        style={styles.list}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  list: { flex: 1 },
});
