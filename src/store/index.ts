import { initializeAuth, useAuthStore } from './auth.store';
import { useNotificationStore } from './notification.store';
import { useOnboardingStore } from './onboarding.store';
import { initializeInventory } from './inventory.store';
import { initializeProduction } from './production.store';
import { initializeIngredientConsumption } from './ingredient_consumption.store';

// Main store exports
export { useAuthStore, selectAuth, selectAuthLoading, selectAuthError, selectCurrentUser, isAuthenticated, getAuthToken, getCurrentUser, initializeAuth, setupAuthListener } from './auth.store';
export { useNotificationStore, selectNotifications, selectUnreadNotifications, selectNotificationLoading, selectNotificationError, selectPushToken, getUnreadNotificationCount, hasPushToken, createSampleNotification, initializeNotifications } from './notification.store';
export { useOnboardingStore, selectOnboarding, selectOnboardingProgress, isOnboardingCompleted, getCurrentStep, getTotalSteps, ONBOARDING_STEPS,  } from './onboarding.store';
export {
  useInventoryStore,
  selectAllItems,
  selectInventoryFilter,
  selectItemsByCategory,
  selectProducts,
  selectIngredients,
  selectEquipment,
  selectLowStockItems,
  selectItemById,
  selectFilteredItems,
  selectInventoryCount,
  selectLowStockCount,
  selectInventoryLoading,
  selectInventoryError,
  initializeInventory,
  inventoryRowToDomain,
} from './inventory.store';

export {
  useProductionStore,
  selectTodaySummary,
  selectDailyTrend,
  selectProductionLogs,
  selectProductionLoading,
  selectProductionError,
  initializeProduction,
} from './production.store';
export type { ProductionSummary, DailyTrendPoint } from './production.store';

export {
  useIngredientConsumptionStore,
  selectConsumptionLogs,
  selectConsumptionSummary,
  selectConsumptionTrend,
  selectConsumptionFilters,
  selectConsumptionHasMore,
  selectConsumptionLoading,
  selectConsumptionLoadingMore,
  selectConsumptionError,
  selectConsumptionTotalCount,
  initializeIngredientConsumption,
} from './ingredient_consumption.store';
export type { ConsumptionFilters, ConsumptionDailyTrend } from './ingredient_consumption.store';

export { useThemeStore, selectThemeMode } from './theme.store';
export type { ThemeMode, ThemeState } from './theme.store';

// Store initialization
export const initializeStores = async (): Promise<void> => {
  try {
    // Initialize all stores
    await Promise.all([
      initializeAuth(),
      initializeInventory(),
      initializeProduction(),
      initializeIngredientConsumption(),
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