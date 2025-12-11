import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { APP_CONSTANTS, NOTIFICATION_CONSTANTS } from '@/core/constants';

class NotificationService {
  private pushToken: string | null = null;

  constructor() {
    this.initializeNotifications();
  }

  private async initializeNotifications(): Promise<void> {
    try {
      // Configure notification handler
      Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowAlert: true,
          shouldPlaySound: true,
          shouldSetBadge: true,
        }),
      });

      // Request permissions
      await this.requestPermissions();
    } catch (error) {
      console.error('Failed to initialize notifications:', error);
    }
  }

  async requestPermissions(): Promise<boolean> {
    try {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync({
          ios: {
            allowAlert: true,
            allowBadge: true,
            allowSound: true,
            allowAnnouncements: true,
          },
          android: {
            importance: Notifications.AndroidImportance.MAX,
            vibrationPattern: [0, 250, 250, 250],
            lightColor: '#FF231F7C',
          },
        });
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        console.log('Notification permissions not granted');
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error requesting notification permissions:', error);
      return false;
    }
  }

  async registerForPushNotifications(): Promise<string> {
    try {
      // Check if we're on a physical device
      if (!Device.isDevice) {
        console.log('Push notifications require a physical device');
        return 'simulator_token_' + Date.now();
      }

      // Request permissions
      const hasPermission = await this.requestPermissions();
      if (!hasPermission) {
        throw new Error('Notification permissions not granted');
      }

      // Get push token
      const projectId = 'your-project-id'; // Replace with your Expo project ID
      const tokenData = await Notifications.getExpoPushTokenAsync({
        projectId,
      });

      this.pushToken = tokenData.data;
      console.log('Push token registered:', this.pushToken);

      return this.pushToken;
    } catch (error) {
      console.error('Failed to register for push notifications:', error);
      throw error;
    }
  }

  async scheduleLocalNotification(
    title: string,
    body: string,
    data: Record<string, any> = {},
    delay: number = 0
  ): Promise<string> {
    try {
      const notificationId = await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          data,
          sound: APP_CONSTANTS.NOTIFICATION_SOUND,
          badge: 1,
        },
        trigger: delay > 0 ? { seconds: delay } : null,
      });

      console.log('Local notification scheduled:', notificationId);
      return notificationId;
    } catch (error) {
      console.error('Failed to schedule local notification:', error);
      throw error;
    }
  }

  async cancelScheduledNotification(notificationId: string): Promise<void> {
    try {
      await Notifications.cancelScheduledNotificationAsync(notificationId);
      console.log('Scheduled notification cancelled:', notificationId);
    } catch (error) {
      console.error('Failed to cancel scheduled notification:', error);
      throw error;
    }
  }

  async cancelAllScheduledNotifications(): Promise<void> {
    try {
      await Notifications.cancelAllScheduledNotificationsAsync();
      console.log('All scheduled notifications cancelled');
    } catch (error) {
      console.error('Failed to cancel all scheduled notifications:', error);
      throw error;
    }
  }

  async getBadgeCountAsync(): Promise<number> {
    try {
      if (Platform.OS === 'ios') {
        return await Notifications.getBadgeCountAsync();
      }
      return 0;
    } catch (error) {
      console.error('Failed to get badge count:', error);
      return 0;
    }
  }

  async setBadgeCountAsync(badgeCount: number): Promise<void> {
    try {
      if (Platform.OS === 'ios') {
        await Notifications.setBadgeCountAsync(badgeCount);
      }
    } catch (error) {
      console.error('Failed to set badge count:', error);
    }
  }

  async clearBadge(): Promise<void> {
    await this.setBadgeCountAsync(0);
  }

  // Notification listeners
  addNotificationReceivedListener(
    callback: (notification: Notifications.Notification) => void
  ): Notifications.Subscription {
    return Notifications.addNotificationReceivedListener(callback);
  }

  addNotificationsDroppedListener(
    callback: () => void
  ): Notifications.Subscription {
    return Notifications.addNotificationsDroppedListener(callback);
  }

  addNotificationResponseReceivedListener(
    callback: (response: Notifications.NotificationResponse) => void
  ): Notifications.Subscription {
    return Notifications.addNotificationResponseReceivedListener(callback);
  }

  // Create notification channels (Android)
  async createNotificationChannels(): Promise<void> {
    if (Platform.OS === 'android') {
      try {
        // Default channel
        await Notifications.setNotificationChannelAsync(
          NOTIFICATION_CONSTANTS.DEFAULT_CHANNEL_ID,
          {
            name: 'Default Notifications',
            importance: Notifications.AndroidImportance.DEFAULT,
            vibrationPattern: [0, 250, 250, 250],
            lightColor: '#FF231F7C',
          }
        );

        // High priority channel
        await Notifications.setNotificationChannelAsync(
          NOTIFICATION_CONSTANTS.HIGH_PRIORITY_CHANNEL_ID,
          {
            name: 'High Priority Notifications',
            importance: Notifications.AndroidImportance.HIGH,
            vibrationPattern: [0, 500, 500, 500],
            lightColor: '#FF231F7C',
            sound: 'default',
          }
        );

        console.log('Notification channels created');
      } catch (error) {
        console.error('Failed to create notification channels:', error);
      }
    }
  }

  // Handle notification routing
  handleNotificationResponse(response: Notifications.NotificationResponse): void {
    try {
      const { data } = response.notification.request.content;
      
      if (data && data.type) {
        this.routeNotification(data.type, data);
      }
    } catch (error) {
      console.error('Failed to handle notification response:', error);
    }
  }

  private routeNotification(type: string, data: Record<string, any>): void {
    switch (type) {
      case NOTIFICATION_CONSTANTS.CHAT_MESSAGE:
        // Navigate to chat screen
        console.log('Routing to chat:', data);
        break;
      case NOTIFICATION_CONSTANTS.ALERT:
        // Navigate to alerts screen
        console.log('Routing to alerts:', data);
        break;
      default:
        // Default navigation
        console.log('Default notification routing:', data);
    }
  }

  // Utility method to create a sample notification
  async createSampleNotification(): Promise<void> {
    try {
      await this.scheduleLocalNotification(
        'Sample Notification',
        'This is a sample notification to test the notification system.',
        {
          type: 'INFO',
          sample: 'data',
        },
        2 // 2 seconds delay
      );
      
      console.log('Sample notification created');
    } catch (error) {
      console.error('Failed to create sample notification:', error);
    }
  }

  // Get push token
  getPushToken(): string | null {
    return this.pushToken;
  }

  // Check if notifications are enabled
  async isNotificationsEnabled(): Promise<boolean> {
    try {
      const { status } = await Notifications.getPermissionsAsync();
      return status === 'granted';
    } catch (error) {
      console.error('Failed to check notification status:', error);
      return false;
    }
  }
}

export const notificationService = new NotificationService();