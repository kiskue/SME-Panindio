/**
 * product.service.ts
 *
 * Application-layer service for product / inventory-item lookups.
 *
 * This is the only permitted import point for inventory_items.repository
 * within the application layer (screens, stores, hooks). If the repository
 * path or lookup logic changes, only this file needs updating.
 *
 * Architectural rule (enforced project-wide):
 *   No SQL, no repository imports, and no getDatabase() calls may appear in
 *   screens, Zustand stores, or React hooks. They call these service functions.
 */

import {
  findBySku,
  getItemById,
} from '../../database/repositories/inventory_items.repository';
import type { InventoryItem } from '@/types';

/**
 * Resolves a raw barcode string to an InventoryItem, or null on a miss.
 *
 * Queries the `sku` column which holds barcode values for product-category
 * inventory items. The query hits the partial unique index
 * `idx_inventory_items_sku` so the lookup is O(log n) at any catalogue size.
 *
 * @param barcode  Raw string emitted by the camera scanner.
 */
export async function getProductByBarcode(
  barcode: string,
): Promise<InventoryItem | null> {
  if (barcode.trim().length === 0) return null;
  return findBySku(barcode.trim());
}

/**
 * Fetches a single inventory item by its UUID primary key.
 * Returns null when no live (non-deleted) row exists for that id.
 *
 * @param id  The UUID stored in inventory_items.id.
 */
export async function getProductById(
  id: string,
): Promise<InventoryItem | null> {
  if (id.trim().length === 0) return null;
  return getItemById(id.trim());
}
