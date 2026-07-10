/**
 * Shared inventory sorting utilities.
 *
 * Consolidates the previously duplicated `SortKey` / `SORT_OPTIONS` / sort
 * function that lived in both `CategoryInventoryScreen` and the inventory
 * overview screen. Use these everywhere an `InventoryItem[]` needs sorting so
 * the option list and ordering logic stay in sync across screens.
 */

import type { InventoryItem } from '@/types';

export type SortKey =
  | 'name-asc'
  | 'name-desc'
  | 'qty-asc'
  | 'qty-desc'
  | 'recently-added';

export interface SortOption {
  key: SortKey;
  label: string;
}

export const SORT_OPTIONS: SortOption[] = [
  { key: 'name-asc',       label: 'Name A → Z' },
  { key: 'name-desc',      label: 'Name Z → A' },
  { key: 'qty-asc',        label: 'Qty: Low to High' },
  { key: 'qty-desc',       label: 'Qty: High to Low' },
  { key: 'recently-added', label: 'Recently Added' },
];

/**
 * Returns a new array of inventory items ordered by the given sort key.
 * Does not mutate the input array.
 */
export function applyInventorySort(items: InventoryItem[], sort: SortKey): InventoryItem[] {
  const copy = [...items];
  switch (sort) {
    case 'name-asc':       return copy.sort((a, b) => a.name.localeCompare(b.name));
    case 'name-desc':      return copy.sort((a, b) => b.name.localeCompare(a.name));
    case 'qty-asc':        return copy.sort((a, b) => a.quantity - b.quantity);
    case 'qty-desc':       return copy.sort((a, b) => b.quantity - a.quantity);
    case 'recently-added': return copy.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  }
}
