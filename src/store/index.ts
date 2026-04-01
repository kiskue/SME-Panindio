import { initializeAuth, useAuthStore } from './auth.store';
import { initializeROIStore } from './roi.store';
import { initializeRawMaterials } from './raw_materials.store';
import { useNotificationStore } from './notification.store';
import { useOnboardingStore } from './onboarding.store';
import { initializeInventory } from './inventory.store';
import { initializeProduction } from './production.store';
import { initializeIngredientConsumption } from './ingredient_consumption.store';
import { initializeUtilities } from './utilities.store';
import { initializeOverheadExpenses } from './overhead_expenses.store';
import { initializeCreditStore } from './credit.store';

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
  selectIngredientWasteCost,
  initializeIngredientConsumption,
} from './ingredient_consumption.store';
export type { ConsumptionFilters, ConsumptionDailyTrend } from './ingredient_consumption.store';

export {
  useUtilitiesStore,
  selectUtilityLogs,
  selectUtilityTypes,
  selectUtilityLoading,
  selectUtilityError,
  selectMonthlySummary,
  selectYearlySummary,
  initializeUtilities,
} from './utilities.store';
export type { UtilityMonthlySummary, UtilityYearlyPoint } from './utilities.store';

export {
  useRawMaterialsStore,
  initializeRawMaterials,
  selectRawMaterials,
  selectLowStockMaterials,
  selectFilteredRawMaterials,
  selectSelectedMaterial,
  selectRawMaterialsLoading,
  selectRawMaterialsSaving,
  selectRawMaterialsError,
  selectRawMaterialsSearch,
  selectRawMaterialsCategory,
  selectLowStockCount as selectRawMaterialsLowStockCount,
  selectRawMaterialStockValue,
} from './raw_materials.store';

export {
  useRawMaterialConsumptionLogsStore,
  initializeRawMaterialConsumptionLogs,
  selectRawMaterialLogs,
  selectRawMaterialLogSummary,
  selectRawMaterialLogTrend,
  selectRawMaterialLogFilters,
  selectRawMaterialLogHasMore,
  selectRawMaterialLogLoading,
  selectRawMaterialLogLoadingMore,
  selectRawMaterialLogError,
  selectRawMaterialLogTotalCount,
  selectRawMaterialWasteCost,
} from './raw_material_consumption_logs.store';
export type { RawMaterialLogFilters, RawMaterialConsumptionLogDetail, RawMaterialConsumptionSummary, RawMaterialConsumptionTrend } from './raw_material_consumption_logs.store';

export { useThemeStore, selectThemeMode } from './theme.store';
export type { ThemeMode, ThemeState } from './theme.store';

export {
  usePosStore,
  selectCartItems,
  selectCartCount,
  selectCartSubtotal,
  selectCartTotal,
  selectCheckoutLoading,
  selectCheckoutError,
  selectLastOrder,
  selectTodayTotal,
  selectTodayOrderCount,
  selectScanResult,
} from './pos.store';
export type { ScanResult } from './pos.store';

export {
  useOverheadExpensesStore,
  initializeOverheadExpenses,
  selectOverheadExpenses,
  selectOverheadLoading,
  selectOverheadLoadingMore,
  selectOverheadError,
  selectOverheadTotalCount,
  selectOverheadHasMore,
  selectOverheadFilters,
  selectOverheadSummary,
} from './overhead_expenses.store';
export type { OverheadFilters } from './overhead_expenses.store';

export {
  useDashboardStore,
  selectDashboardData,
  selectDashboardLoading,
  selectDashboardError,
  selectDashboardPeriod,
  selectDashboardPeriodType,
  selectDashboardPeriodState,
  selectDashboardCanGoNext,
  selectDashboardKPIs,
  selectDashboardTrend,
  selectDashboardSetAnchor,
} from './dashboard.store';

export {
  useCreditStore,
  initializeCreditStore,
  selectCreditCustomers,
  selectCustomerSummaries,
  selectTotalOutstandingBalance,
  selectSelectedCustomerSales,
  selectSelectedCustomerPayments,
  selectSelectedCustomerId,
  selectCreditLoading,
  selectCreditDetailLoading,
  selectCreditError,
  selectCustomersWithBalance,
  selectFullyPaidCustomers,
} from './credit.store';

export {
  useROIStore,
  initializeROIStore,
  selectROIInputs,
  selectROIResults,
  selectROIInsight,
  selectROILoading,
  selectROIScenarios,
  selectSavedROIScenarios,
  selectROIScenariosLoading,
  selectROIError,
} from './roi.store';

export {
  useBusinessROIStore,
  selectBusinessROI,
  selectBusinessROIInsight,
  selectBusinessROIRiskLevel,
  selectBusinessROILoading,
  selectBusinessROIPercent,
  selectBusinessROIBreakdown,
  selectBusinessROILastRefreshed,
  selectBusinessROIError,
  selectRequiredMonthlySales,
  selectRequiredDailySales,
  selectTargetSalesInsight,
  selectTargetROIPercent,
} from './business_roi.store';
export type { BusinessROIState } from './business_roi.store';

// Store initialization
export const initializeStores = async (): Promise<void> => {
  try {
    // Initialize all stores.
    // NOTE: useDashboardStore is intentionally NOT pre-loaded here.
    // The dashboard screen's own useEffect triggers the first load on mount.
    // Loading it here AND in the screen causes a double-fetch race on every
    // cold start (the screen's loadDashboard fires before the one here resolves,
    // so the store ends up in isLoading=true twice in quick succession).
    await Promise.all([
      initializeAuth(),
      initializeInventory(),
      initializeProduction(),
      initializeIngredientConsumption(),
      initializeUtilities(),
      initializeRawMaterials(),
      initializeOverheadExpenses(),
      initializeCreditStore(),
      initializeROIStore(),
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
