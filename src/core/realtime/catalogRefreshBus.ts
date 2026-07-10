/**
 * Tiny module-level event bus that decouples "a realtime event says the catalog
 * changed" from "the catalog hook re-fetches".
 *
 * `RealtimeProvider` calls `requestCatalogRefresh()` when a
 * `catalog:product_created` event arrives; `useCustomerCatalog` subscribes with
 * `onCatalogRefresh()` and re-runs its fetch. This keeps the realtime layer and
 * the data hook loosely coupled — neither imports the other's internals, and the
 * hook stays the single owner of the fetch/mapping logic.
 */

type RefreshListener = () => void;

const listeners = new Set<RefreshListener>();

/**
 * Subscribe to catalog-refresh requests. Returns an unsubscribe function
 * suitable for direct return from a `useEffect`.
 */
export function onCatalogRefresh(listener: RefreshListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Notify every subscriber that the catalog should be re-fetched. */
export function requestCatalogRefresh(): void {
  listeners.forEach((listener) => {
    try {
      listener();
    } catch (err) {
      if (__DEV__) console.warn('[catalogRefreshBus] listener threw:', err);
    }
  });
}
