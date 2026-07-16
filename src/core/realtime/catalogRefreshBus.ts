/**
 * Tiny module-level event bus that decouples "a realtime event changed the
 * catalog" from "the catalog hook updates its data".
 *
 * Two flavours, both delivered to the same subscribers:
 *   - requestCatalogRefresh()          → re-fetch (used when we don't have the
 *                                         new data, e.g. a brand-new product).
 *   - requestCatalogStockPatch(items)  → merge the given rows IN PLACE, no fetch
 *                                         (used for `catalog:stock_updated`, which
 *                                         carries the fresh rows). This is what
 *                                         makes stock/availability changes update
 *                                         live without a visible reload.
 *
 * `RealtimeProvider` produces these; `useCustomerCatalog` subscribes with
 * `onCatalogRefresh()`. Neither imports the other's internals, and the hook stays
 * the single owner of the fetch/mapping logic.
 */

import type { StockUpdatedItem } from './events';

/** A subscriber receives the changed rows to patch, or `undefined` to re-fetch. */
type RefreshListener = (patch?: StockUpdatedItem[]) => void;

const listeners = new Set<RefreshListener>();

/**
 * Subscribe to catalog updates. Returns an unsubscribe function suitable for
 * direct return from a `useEffect`. The callback receives the changed rows for a
 * patch, or `undefined` when a full re-fetch is requested.
 */
export function onCatalogRefresh(listener: RefreshListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function notify(patch?: StockUpdatedItem[]): void {
  listeners.forEach((listener) => {
    try {
      listener(patch);
    } catch (err) {
      if (__DEV__) console.warn('[catalogRefreshBus] listener threw:', err);
    }
  });
}

/** Ask every subscriber to re-fetch the catalog (no data to patch with). */
export function requestCatalogRefresh(): void {
  notify();
}

/**
 * Ask every subscriber to merge the given changed rows into their catalog in
 * place — no network, no loading state. Rows that are now unavailable are removed
 * from the customer grid; available ones are upserted.
 */
export function requestCatalogStockPatch(items: StockUpdatedItem[]): void {
  if (items.length === 0) return;
  notify(items);
}
