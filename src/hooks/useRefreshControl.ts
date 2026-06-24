import { useCallback, useState } from 'react';

/**
 * Standardizes pull-to-refresh state for list/scroll screens.
 *
 * Replaces the repeated `const [refreshing, setRefreshing] = useState(false)`
 * + `setRefreshing(true); await fetch(); setRefreshing(false)` boilerplate.
 * The `finally` guarantees the spinner is cleared even if the refresh throws.
 *
 * @example
 * const { refreshing, onRefresh } = useRefreshControl(refreshExpenses);
 * // ...
 * <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
 */
export function useRefreshControl(
  refreshFn: () => void | Promise<void>,
): { refreshing: boolean; onRefresh: () => Promise<void> } {
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refreshFn();
    } finally {
      setRefreshing(false);
    }
  }, [refreshFn]);

  return { refreshing, onRefresh };
}
