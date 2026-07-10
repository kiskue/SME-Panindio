import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Notification, NotificationType } from '@/types';
import { notificationService } from '@/features/notifications/services/notification.service';
import {
  fetchNotifications,
  markNotificationsRead,
} from '@/features/notifications/services/notification.api';

/**
 * Sync the OS app-icon badge to the current unread count (best-effort, guarded
 * inside the service). Fired after any mutation that changes read state.
 */
function syncBadge(notifications: Notification[]): void {
  const unread = notifications.reduce((n, item) => (item.isRead ? n : n + 1), 0);
  void notificationService.setBadgeCountAsync(unread);
}

/**
 * Idempotent merge of two notification lists keyed by `id` (server entries win),
 * sorted newest-first by `createdAt`, capped at 100. Used to reconcile socket-
 * delivered entries with server history without ever double-inserting.
 */
function mergeNotifications(
  existing: Notification[],
  incoming: Notification[],
): Notification[] {
  const byId = new Map<string, Notification>();
  for (const n of existing) byId.set(n.id, n);
  for (const n of incoming) byId.set(n.id, n);
  return Array.from(byId.values())
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0))
    .slice(0, 100);
}

export interface NotificationState {
  pushToken: string | null;
  notifications: Notification[];
  isLoading: boolean;
  error: string | null;

  // Actions
  registerPushToken: () => Promise<void>;
  addNotification: (notification: Notification) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  clearNotifications: () => void;
  clearAll: () => void;
  deleteNotification: (id: string) => void;
  loadNotifications: () => Promise<void>;
  refreshNotifications: () => Promise<void>;
  clearError: () => void;
  setLoading: (loading: boolean) => void;
}

export const useNotificationStore = create<NotificationState>()(
  persist(
    (set, get) => ({
      pushToken: null,
      notifications: [],
      isLoading: false,
      error: null,

      registerPushToken: async () => {
        // registerForPushNotifications never throws — it returns null when a
        // token is unavailable (Expo Go, simulator, permission denied). Treat
        // null as "no remote push" rather than an error so init never rejects.
        set({ isLoading: true, error: null });
        const token = await notificationService.registerForPushNotifications();
        set({ pushToken: token, isLoading: false, error: null });
      },

      addNotification: (notification: Notification) => {
        const { notifications } = get();

        // Idempotent by id: a socket-delivered entry and a push/history entry
        // share the same server id — never double-insert.
        if (notifications.some(n => n.id === notification.id)) return;

        // Keep only the latest 100 notifications to prevent storage bloat.
        const trimmedNotifications = [notification, ...notifications].slice(0, 100);
        set({ notifications: trimmedNotifications });
        syncBadge(trimmedNotifications);
      },

      markAsRead: (id: string) => {
        const { notifications } = get();
        const updatedNotifications = notifications.map(notification =>
          notification.id === id ? { ...notification, isRead: true } : notification
        );

        set({ notifications: updatedNotifications });
        syncBadge(updatedNotifications);
        // Keep the server in sync (best-effort — local state drives the UI).
        void markNotificationsRead([id]);
      },

      markAllAsRead: () => {
        const { notifications } = get();
        const updatedNotifications = notifications.map(notification => ({
          ...notification,
          isRead: true,
        }));

        set({ notifications: updatedNotifications });
        syncBadge(updatedNotifications);
        void markNotificationsRead();
      },

      clearNotifications: () => {
        set({ notifications: [] });
      },

      clearAll: () => {
        set({ notifications: [] });
      },

      deleteNotification: (id: string) => {
        const { notifications } = get();
        const updatedNotifications = notifications.filter(
          notification => notification.id !== id
        );
        
        set({ notifications: updatedNotifications });
      },

      loadNotifications: async () => {
        // loadNotifications and refreshNotifications share the same fetch + merge
        // path (POST /notifications/list, idempotent by id). Kept as distinct
        // actions so callers can express intent (initial load vs pull-to-refresh).
        await get().refreshNotifications();
      },

      refreshNotifications: async () => {
        try {
          set({ isLoading: true, error: null });

          // fetchNotifications is best-effort (returns [] on error / no session),
          // so a transient failure never wipes locally-cached notifications.
          const server = await fetchNotifications();
          const merged = mergeNotifications(get().notifications, server);

          set({ notifications: merged, isLoading: false, error: null });
          syncBadge(merged);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Failed to refresh notifications';
          set({
            error: errorMessage,
            isLoading: false,
          });
        }
      },

      clearError: () => {
        set({ error: null });
      },

      setLoading: (loading: boolean) => {
        set({ isLoading: loading });
      },
    }),
    {
      name: 'notification-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        pushToken: state.pushToken,
        notifications: state.notifications,
      }),
    }
  )
);

// Selectors
export const selectNotifications = (state: NotificationState) => state.notifications;
export const selectUnreadNotifications = (state: NotificationState) => 
  state.notifications.filter(notification => !notification.isRead);
export const selectNotificationLoading = (state: NotificationState) => state.isLoading;
export const selectNotificationError = (state: NotificationState) => state.error;
export const selectPushToken = (state: NotificationState) => state.pushToken;

// Helper functions
export const getUnreadNotificationCount = (): number => {
  const notifications = useNotificationStore.getState().notifications;
  return notifications.filter(notification => !notification.isRead).length;
};

export const hasPushToken = (): boolean => {
  return useNotificationStore.getState().pushToken !== null;
};

// Create a sample notification (for testing)
export const createSampleNotification = (type: NotificationType = 'INFO'): Notification => ({
  id: Date.now().toString(),
  userId: 'sample-user-id',
  title: 'Sample Notification',
  body: 'This is a sample notification for testing purposes.',
  type,
  data: { sample: 'data' },
  isRead: false,
  createdAt: new Date().toISOString(),
});

// Initialize notifications
export const initializeNotifications = async (): Promise<void> => {
  try {
    // Register for push notifications if not already registered
    const { pushToken, registerPushToken } = useNotificationStore.getState();
    if (!pushToken) {
      await registerPushToken();
    }
  } catch (error) {
    console.error('Failed to initialize notifications:', error);
  }
};