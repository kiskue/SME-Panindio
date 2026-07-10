import type { OnlineCatalogItem } from '@/types';

/** How many top-ranked items may be flagged "Popular". */
export const POPULAR_TOP_N = 5;
/** Below this catalog size, "Popular" is meaningless — flag nothing. */
const MIN_CATALOG_FOR_POPULAR = 8;
/** Never flag more than this fraction of the visible catalog. */
const MAX_POPULAR_FRACTION = 0.3;

/**
 * Derive the set of "popular" **productIds** from the merchant-curated
 * `displayOrder` — the only popularity proxy the backend exposes today (lower
 * displayOrder = higher priority). Returns an empty set for small catalogs so a
 * handful of items don't all look flagged, and caps the count at ~30% of the
 * catalog. ProductCard consumes only a boolean, so this source can later be
 * swapped for a real sales-derived signal without touching the card.
 */
export function getPopularProductIds(items: OnlineCatalogItem[]): Set<string> {
  if (items.length < MIN_CATALOG_FOR_POPULAR) return new Set();
  const limit = Math.min(POPULAR_TOP_N, Math.floor(items.length * MAX_POPULAR_FRACTION));
  if (limit <= 0) return new Set();
  const ranked = [...items].sort((a, b) => a.displayOrder - b.displayOrder);
  return new Set(ranked.slice(0, limit).map((i) => i.productId));
}
