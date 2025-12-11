import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Notification, NotificationType } from '@/types';
import { APP_CONSTANTS, NOTIFICATION_CONSTANTS } from '@/core/constants';
import { notificationService } from '@/features/notifications/services/notification.service';

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
  deleteNotification: (id: string) => void;
  loadNotifications: () => Promise<void>;
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
        try {
          set({ isLoading: true, error: null });
          
          const token = await notificationService.registerForPushNotifications();
          
          set({
            pushToken: token,
            isLoading: false,
            error: null,
          });
          
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Failed to register push token';
          set({
            error: errorMessage,
            isLoading: false,
          });
          
          throw error;
        }
      },

      addNotification: (notification: Notification) => {
        const { notifications } = get();
        const updatedNotifications = [notification, ...notifications];
        
        // Keep only the latest 100 notifications to prevent storage bloat
        const trimmedNotifications = updatedNotifications.slice(0, 100);
        
        set({ notifications: trimmedNotifications });
      },

      markAsRead: (id: string) => {
        const { notifications } = get();
        const updatedNotifications = notifications.map(notification =>
          notification.id === id ? { ...notification, isRead: true } : notification
        );
        
        set({ notifications: updatedNotifications });
      },

      markAllAsRead: () => {
        const { notifications } = get();
        const updatedNotifications = notifications.map(notification => ({
          ...notification,
          isRead: true,
        }));
        
        set({ notifications: updatedNotifications });
      },

      clearNotifications: () => {
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
        try {
          set({ isLoading: true, error: null });
          
          // In a real app, this would fetch from API
          // For now, we'll just return the stored notifications
          const { notifications } = get();
          
          set({
            isLoading: false,
            error: null,
          });
          
          return notifications;
          
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Failed to load notifications';
          set({
            error: errorMessage,
            isLoading: false,
          });
          
          throw error;
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
  createdAt: new Date(),
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