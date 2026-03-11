// TODO: re-enable when not using Expo Go
// import { Platform } from 'react-native';
// import * as Notifications from 'expo-notifications';
// import * as Device from 'expo-device';
import { APP_CONSTANTS, NOTIFICATION_CONSTANTS } from '@/core/constants';

class NotificationService {
  private pushToken: string | null = null;

  constructor() {
    // TODO: re-enable when not using Expo Go
    // this.initializeNotifications();
  }

  // private async initializeNotifications(): Promise<void> {
  //   try {
  //     Notifications.setNotificationHandler({
  //       handleNotification: async () => ({
  //         shouldShowAlert: true,
  //         shouldShowBanner: true,
  //         shouldShowList: true,
  //         shouldPlaySound: true,
  //         shouldSetBadge: true,
  //       }),
  //     });
  //     await this.requestPermissions();
  //   } catch (error) {
  //     console.error('Failed to initialize notifications:', error);
  //   }
  // }

  async requestPermissions(): Promise<boolean> {
    // TODO: re-enable when not using Expo Go
    // try {
    //   const { status: existingStatus } = await Notifications.getPermissionsAsync();
    //   let finalStatus = existingStatus;
    //   if (existingStatus !== 'granted') {
    //     const { status } = await Notifications.requestPermissionsAsync({
    //       ios: { allowAlert: true, allowBadge: true, allowSound: true },
    //     });
    //     finalStatus = status;
    //   }
    //   if (finalStatus !== 'granted') {
    //     console.log('Notification permissions not granted');
    //     return false;
    //   }
    //   return true;
    // } catch (error) {
    //   console.error('Error requesting notification permissions:', error);
    //   return false;
    // }
    return false;
  }

  async registerForPushNotifications(): Promise<string> {
    // TODO: re-enable when not using Expo Go
    // try {
    //   if (!Device.isDevice) {
    //     console.log('Push notifications require a physical device');
    //     return 'simulator_token_' + Date.now();
    //   }
    //   const hasPermission = await this.requestPermissions();
    //   if (!hasPermission) throw new Error('Notification permissions not granted');
    //   const projectId = 'your-project-id';
    //   const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
    //   this.pushToken = tokenData.data;
    //   console.log('Push token registered:', this.pushToken);
    //   return this.pushToken;
    // } catch (error) {
    //   console.error('Failed to register for push notifications:', error);
    //   throw error;
    // }
    return 'expo-go-stub-token';
  }

  async scheduleLocalNotification(
    _title: string,
    _body: string,
    _data: Record<string, unknown> = {},
    _delay: number = 0
  ): Promise<string> {
    // TODO: re-enable when not using Expo Go
    // const notificationId = await Notifications.scheduleNotificationAsync({
    //   content: { title, body, data, sound: APP_CONSTANTS.NOTIFICATION_SOUND, badge: 1 },
    //   trigger: delay > 0
    //     ? { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: delay, repeats: false }
    //     : null,
    // });
    // return notificationId;
    void APP_CONSTANTS;
    return 'stub-notification-id';
  }

  async cancelScheduledNotification(_notificationId: string): Promise<void> {
    // TODO: re-enable when not using Expo Go
    // await Notifications.cancelScheduledNotificationAsync(notificationId);
  }

  async cancelAllScheduledNotifications(): Promise<void> {
    // TODO: re-enable when not using Expo Go
    // await Notifications.cancelAllScheduledNotificationsAsync();
  }

  async getBadgeCountAsync(): Promise<number> {
    // TODO: re-enable when not using Expo Go
    // if (Platform.OS === 'ios') return await Notifications.getBadgeCountAsync();
    return 0;
  }

  async setBadgeCountAsync(_badgeCount: number): Promise<void> {
    // TODO: re-enable when not using Expo Go
    // if (Platform.OS === 'ios') await Notifications.setBadgeCountAsync(badgeCount);
  }

  async clearBadge(): Promise<void> {
    await this.setBadgeCountAsync(0);
  }

  // TODO: re-enable when not using Expo Go
  // addNotificationReceivedListener(
  //   callback: (notification: Notifications.Notification) => void
  // ): Notifications.Subscription {
  //   return Notifications.addNotificationReceivedListener(callback);
  // }

  // addNotificationsDroppedListener(callback: () => void): Notifications.Subscription {
  //   return Notifications.addNotificationsDroppedListener(callback);
  // }

  addNotificationResponseReceivedListener(
    _callback: (response: unknown) => void
  ): { remove: () => void } {
    // TODO: re-enable when not using Expo Go
    // return Notifications.addNotificationResponseReceivedListener(callback);
    return { remove: () => {} };
  }

  async createNotificationChannels(): Promise<void> {
    // TODO: re-enable when not using Expo Go
    // if (Platform.OS === 'android') {
    //   await Notifications.setNotificationChannelAsync(NOTIFICATION_CONSTANTS.DEFAULT_CHANNEL_ID, { ... });
    //   await Notifications.setNotificationChannelAsync(NOTIFICATION_CONSTANTS.HIGH_PRIORITY_CHANNEL_ID, { ... });
    // }
    void NOTIFICATION_CONSTANTS;
  }

  handleNotificationResponse(_response: unknown): void {
    // TODO: re-enable when not using Expo Go
    // const { data } = response.notification.request.content;
    // if (data && typeof data['type'] === 'string') {
    //   this.routeNotification(data['type'], data as Record<string, unknown>);
    // }
  }

  // private routeNotification(type: string, data: Record<string, unknown>): void {
  //   switch (type) {
  //     case NOTIFICATION_CONSTANTS.CHAT_MESSAGE:
  //       console.log('Routing to chat:', data);
  //       break;
  //     case NOTIFICATION_CONSTANTS.ALERT:
  //       console.log('Routing to alerts:', data);
  //       break;
  //     default:
  //       console.log('Default notification routing:', data);
  //   }
  // }

  async createSampleNotification(): Promise<void> {
    // TODO: re-enable when not using Expo Go
    // await this.scheduleLocalNotification('Sample Notification', '...', { type: 'INFO' }, 2);
  }

  getPushToken(): string | null {
    return this.pushToken;
  }

  async isNotificationsEnabled(): Promise<boolean> {
    // TODO: re-enable when not using Expo Go
    // const { status } = await Notifications.getPermissionsAsync();
    // return status === 'granted';
    return false;
  }
}

export const notificationService = new NotificationService();
