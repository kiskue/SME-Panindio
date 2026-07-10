/**
 * Notification Service  (expo-notifications wrapper)
 * ==================================================
 * Thin, defensive wrapper around `expo-notifications`. Every native call is
 * guarded so the app degrades gracefully — most importantly in **Expo Go on SDK
 * 54, which cannot do remote push / custom sounds** (the socket-driven in-app
 * toast + badge + inbox still work there). All native calls are wrapped in
 * try/catch so a missing capability never crashes.
 *
 * Foreground presentation is intentionally quiet: the banner is SUPPRESSED
 * (an in-app toast is shown instead by `RealtimeProvider`) while the list entry
 * and app-icon badge are kept. Background / app-closed delivery is owned by the
 * remote push (OS banner + custom sound), de-duplicated against the socket entry
 * by the shared server-generated notification id.
 */

import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants, { AppOwnership, ExecutionEnvironment } from 'expo-constants';
import { router } from 'expo-router';
import { APP_CONSTANTS, NOTIFICATION_CONSTANTS } from '@/core/constants';

/** Resolve the EAS projectId that `getExpoPushTokenAsync` needs. */
function getProjectId(): string | undefined {
  const extra = Constants.expoConfig?.extra as
    | { eas?: { projectId?: string } }
    | undefined;
  return extra?.eas?.projectId;
}

class NotificationService {
  private pushToken: string | null = null;
  private handlerConfigured = false;
  private loggedExpoGoSkip = false;

  /**
   * True when running under Expo Go (or the store client), where remote push and
   * custom sounds are unavailable on SDK 54. Used to short-circuit token
   * registration gracefully instead of throwing.
   */
  private isExpoGo(): boolean {
    return (
      Constants.appOwnership === AppOwnership.Expo ||
      Constants.executionEnvironment === ExecutionEnvironment.StoreClient
    );
  }

  /**
   * Register the foreground presentation handler. Banner suppressed (toast shown
   * instead), list + badge kept, sound off in foreground. Safe to call more than
   * once; only the first call takes effect. Call as early as possible on startup.
   */
  setNotificationHandler(): void {
    if (this.handlerConfigured) return;
    try {
      Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowBanner: false,
          shouldShowList: true,
          shouldPlaySound: false,
          shouldSetBadge: true,
        }),
      });
      this.handlerConfigured = true;
    } catch (error) {
      if (__DEV__) console.warn('[notifications] setNotificationHandler failed:', error);
    }
  }

  async requestPermissions(): Promise<boolean> {
    try {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync({
          ios: { allowAlert: true, allowBadge: true, allowSound: true },
        });
        finalStatus = status;
      }
      return finalStatus === 'granted';
    } catch (error) {
      if (__DEV__) console.warn('[notifications] requestPermissions failed:', error);
      return false;
    }
  }

  /**
   * Register for remote push and return the Expo push token, or `null` when
   * unavailable (Expo Go, simulator/non-device, permission denied, or any native
   * failure). Never throws — the caller treats `null` as "no remote push".
   */
  async registerForPushNotifications(): Promise<string | null> {
    // Expo Go on SDK 54 can't obtain a remote-push token — skip quietly (once).
    if (this.isExpoGo()) {
      if (!this.loggedExpoGoSkip) {
        console.log('[notifications] Expo Go detected — remote push disabled (toast + badge + inbox still work)');
        this.loggedExpoGoSkip = true;
      }
      return null;
    }

    try {
      if (!Device.isDevice) {
        if (__DEV__) console.log('[notifications] push requires a physical device — skipping');
        return null;
      }

      const hasPermission = await this.requestPermissions();
      if (!hasPermission) {
        if (__DEV__) console.log('[notifications] permission not granted — no push token');
        return null;
      }

      // Ensure Android channels exist before requesting a token.
      await this.createNotificationChannels();

      const projectId = getProjectId();
      const tokenData = await Notifications.getExpoPushTokenAsync(
        projectId ? { projectId } : {},
      );
      this.pushToken = tokenData.data;
      if (__DEV__) console.log('[notifications] Expo push token registered');
      return this.pushToken;
    } catch (error) {
      if (__DEV__) console.warn('[notifications] registerForPushNotifications failed:', error);
      return null;
    }
  }

  async scheduleLocalNotification(
    title: string,
    body: string,
    data: Record<string, unknown> = {},
    delay = 0,
  ): Promise<string | null> {
    try {
      return await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          data,
          sound: APP_CONSTANTS.NOTIFICATION_SOUND,
        },
        trigger:
          delay > 0
            ? {
                type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
                seconds: delay,
                repeats: false,
              }
            : null,
      });
    } catch (error) {
      if (__DEV__) console.warn('[notifications] scheduleLocalNotification failed:', error);
      return null;
    }
  }

  async cancelScheduledNotification(notificationId: string): Promise<void> {
    try {
      await Notifications.cancelScheduledNotificationAsync(notificationId);
    } catch (error) {
      if (__DEV__) console.warn('[notifications] cancelScheduledNotification failed:', error);
    }
  }

  async cancelAllScheduledNotifications(): Promise<void> {
    try {
      await Notifications.cancelAllScheduledNotificationsAsync();
    } catch (error) {
      if (__DEV__) console.warn('[notifications] cancelAllScheduledNotifications failed:', error);
    }
  }

  async getBadgeCountAsync(): Promise<number> {
    try {
      return await Notifications.getBadgeCountAsync();
    } catch {
      return 0;
    }
  }

  async setBadgeCountAsync(badgeCount: number): Promise<void> {
    try {
      await Notifications.setBadgeCountAsync(Math.max(0, badgeCount));
    } catch (error) {
      if (__DEV__) console.warn('[notifications] setBadgeCountAsync failed:', error);
    }
  }

  async clearBadge(): Promise<void> {
    await this.setBadgeCountAsync(0);
  }

  addNotificationReceivedListener(
    callback: (notification: Notifications.Notification) => void,
  ): { remove: () => void } {
    try {
      return Notifications.addNotificationReceivedListener(callback);
    } catch {
      return { remove: () => {} };
    }
  }

  addNotificationResponseReceivedListener(
    callback: (response: Notifications.NotificationResponse) => void,
  ): { remove: () => void } {
    try {
      return Notifications.addNotificationResponseReceivedListener(callback);
    } catch {
      return { remove: () => {} };
    }
  }

  /**
   * Create the Android notification channels. The high-priority channel carries
   * the bundled custom sound. No-op on iOS (channels are Android-only) and
   * swallows failures so Expo Go never crashes.
   */
  async createNotificationChannels(): Promise<void> {
    if (Platform.OS !== 'android') return;
    try {
      await Notifications.setNotificationChannelAsync(
        NOTIFICATION_CONSTANTS.DEFAULT_CHANNEL_ID,
        {
          name: 'Default',
          importance: Notifications.AndroidImportance.DEFAULT,
          lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
          showBadge: true,
        },
      );
      await Notifications.setNotificationChannelAsync(
        NOTIFICATION_CONSTANTS.HIGH_PRIORITY_CHANNEL_ID,
        {
          name: 'Important',
          importance: Notifications.AndroidImportance.HIGH,
          lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
          sound: APP_CONSTANTS.NOTIFICATION_SOUND,
          vibrationPattern: [0, 250, 250, 250],
          enableVibrate: true,
          showBadge: true,
        },
      );
    } catch (error) {
      if (__DEV__) console.warn('[notifications] createNotificationChannels failed:', error);
    }
  }

  /**
   * Handle a notification the user tapped: navigate to `data.route` if present.
   * Shared by the live response listener and the cold-start path.
   */
  handleNotificationResponse(
    response: Notifications.NotificationResponse,
  ): void {
    const data = response?.notification?.request?.content?.data;
    this.routeFromData(data);
  }

  /**
   * Cold-start entry point: if the app was launched by tapping a notification,
   * return the deep-link route from its data (or `null`). Read once on startup.
   */
  async getInitialRouteFromLastResponse(): Promise<string | null> {
    try {
      const last = await Notifications.getLastNotificationResponseAsync();
      const route = last?.notification?.request?.content?.data?.['route'];
      return typeof route === 'string' && route.length > 0 ? route : null;
    } catch {
      return null;
    }
  }

  /** Navigate to a route string from notification data (guarded). */
  routeTo(route: string): void {
    if (!route) return;
    try {
      router.push(route);
    } catch (error) {
      if (__DEV__) console.warn('[notifications] routeTo failed for', route, error);
    }
  }

  private routeFromData(data: unknown): void {
    const route = (data as { route?: unknown } | null | undefined)?.route;
    if (typeof route === 'string' && route.length > 0) this.routeTo(route);
  }

  getPushToken(): string | null {
    return this.pushToken;
  }

  async isNotificationsEnabled(): Promise<boolean> {
    try {
      const { status } = await Notifications.getPermissionsAsync();
      return status === 'granted';
    } catch {
      return false;
    }
  }
}

export const notificationService = new NotificationService();
