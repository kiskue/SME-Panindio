import { initializeAuth, useAuthStore } from './auth.store';
import { initializeNotifications, useNotificationStore } from './notification.store';
import { useOnboardingStore } from './onboarding.store';

// Main store exports
export { useAuthStore, selectAuth, selectAuthLoading, selectAuthError, selectCurrentUser, isAuthenticated, getAuthToken, getCurrentUser, initializeAuth, setupAuthListener } from './auth.store';
export { useNotificationStore, selectNotifications, selectUnreadNotifications, selectNotificationLoading, selectNotificationError, selectPushToken, getUnreadNotificationCount, hasPushToken, createSampleNotification, initializeNotifications } from './notification.store';
export { useOnboardingStore, selectOnboarding, selectOnboardingProgress, isOnboardingCompleted, getCurrentStep, getTotalSteps, ONBOARDING_STEPS,  } from './onboarding.store';

// Store initialization
export const initializeStores = async (): Promise<void> => {
  try {
    // Initialize all stores
    await Promise.all([
      initializeAuth(),
      // TODO: re-enable when not using Expo Go
      // initializeNotifications(),
    ]);
    
    console.log('All stores initialized successfully');
  } catch (error) {
    console.error('Failed to initialize stores:', error);
    throw error;
  }
};

// Store reset (useful for logout)
export const resetAllStores = async (): Promise<void> => {
  try {
    // Reset all stores to their initial state
    const { logout } = useAuthStore.getState();
    const { clearNotifications } = useNotificationStore.getState();
    const { resetOnboarding } = useOnboardingStore.getState();
    
    await logout();
    clearNotifications();
    resetOnboarding();
    
    console.log('All stores reset successfully');
  } catch (error) {
    console.error('Failed to reset stores:', error);
    throw error;
  }
};