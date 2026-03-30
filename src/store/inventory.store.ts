/**
 * inventory.store.ts
 *
 * Zustand v5 store for Inventory Management.
 *
 * Architecture change: store actions now delegate to the SQLite repository
 * layer (`database/repositories/inventory_items.repository.ts`) for all
 * persistence. The Zustand `items` array is an in-memory cache that mirrors
 * the DB state — it is NOT persisted via AsyncStorage anymore (SQLite is the
 * source of truth).
 *
 * Boot sequence:
 *   1. `initDatabase()` runs in `_layout.tsx` before stores are initialised.
 *   2. `initializeInventory()` hydrates the store from SQLite.
 *   3. All subsequent mutations write to SQLite first, then update the cache.
 *
 * Design decisions:
 *   - `selectAllItems` returns the raw `items` array — stable reference from Zustand.
 *   - Category/filter selectors are selector factories so callers can memoize
 *     them with `useMemo` rather than triggering inline `.filter()` each render.
 *   - `selectLowStockItems` includes only ingredients that have a `reorderLevel`
 *     set and whose `quantity` has dropped to or below that threshold.
 *   - Async actions surface errors via an `error` field; callers may check it.
 */

import { create } from 'zustand';
import type { InventoryItem, InventoryCategory, InventoryFilter, BomValidationResult } from '@/types';
import {
  insertItem,
  getAllItems,
  getItemById,
  updateItem as dbUpdateItem,
  deleteItem as dbDeleteItem,
  toDomain,
  reduceProductStock,
  addIngredientStock as dbAddIngredientStock,
  reduceIngredientStock as dbReduceIngredientStock,
  addProductStock as dbAddProductStock,
} from '../../database/repositories/inventory_items.repository';
import type {
  IngredientReturnInput,
  RawMaterialReturnInput,
  ReduceStockResult,
  IngredientStockResult,
} from '../../database/repositories/inventory_items.repository';
import type { CreateInventoryItemInput } from '../../database/schemas/inventory_items.schema';
import type { StockReductionReason } from '@/types';
import { addStockMovement } from '../../database/repositories/stock_movements.repository';
import type { StockMovement } from '../../database/schemas/stock_movements.schema';

// ─── State shape ─────────────────────────────────────────────────────────────

interface InventoryState {
  items:        InventoryItem[];
  filter:       InventoryFilter;
  isLoading:    boolean;
  error:        string | null;

  // ── Initialisation ─────────────────────────────────────────────────────────
  /** Hydrate items from SQLite on app start. */
  initializeInventory: () => Promise<void>;

  // ── Mutations ──────────────────────────────────────────────────────────────
  /**
   * Persists a new item to SQLite and prepends it to the cache.
   * The caller builds a `CreateInventoryItemInput` (snake_case DB shape);
   * the repository assigns `id`, timestamps, and audit fields.
   */
  addItem:    (input: CreateInventoryItemInput) => Promise<InventoryItem>;
  /**
   * Patches an existing item in SQLite and refreshes the cache entry.
   * `updates` accepts the camelCase domain-model fields that map to DB columns.
   */
  updateItem: (id: string, updates: Partial<InventoryItem>) => Promise<void>;
  /**
   * Soft-deletes an item in SQLite and removes it from the cache.
   */
  deleteItem: (id: string) => Promise<void>;

  /**
   * Reduces a product's stock quantity atomically.
   *
   * The `reason` controls whether linked ingredient and raw-material stock is
   * returned to inventory ('correction') or only audit-logged (all other reasons).
   * Throws when quantityToReduce exceeds current product stock.
   */
  reduceStock: (
    productId:        string,
    productName:      string,
    quantityToReduce: number,
    reason:           StockReductionReason,
    ingredients:      IngredientReturnInput[],
    rawMaterials:     RawMaterialReturnInput[],
    notes?:           string,
  ) => Promise<ReduceStockResult>;

  /**
   * Increases an ingredient's stock quantity by a given amount.
   * Writes a RETURN entry in ingredient_consumption_logs for the audit trail.
   * Patches the Zustand cache after the DB write succeeds.
   */
  addIngredientStock: (
    ingredientId: string,
    quantity:     number,
    notes?:       string,
  ) => Promise<IngredientStockResult>;

  /**
   * Decreases an ingredient's stock quantity by a given amount.
   * Pre-flight guard: throws if quantity > current stock.
   * Writes MANUAL_ADJUSTMENT consumption log + stock_reduction_logs audit entry.
   * Patches the Zustand cache after the DB write succeeds.
   */
  reduceIngredientStock: (
    ingredientId:   string,
    ingredientName: string,
    quantity:       number,
    reason:         StockReductionReason,
    notes?:         string,
  ) => Promise<IngredientStockResult>;

  /**
   * Records an opening-balance / initial stock-in movement for a product.
   *
   * Writes a `stock_movements` row with `movementType='initial'` and atomically
   * increments `inventory_items.quantity`. Updates the Zustand cache so the
   * product list reflects the new quantity without a full re-hydration.
   *
   * Use this immediately after creating a product to set its starting stock.
   * Unlike `addProductStock`, no BOM deductions are performed.
   *
   * Throws if quantity <= 0 or the product does not exist.
   */
  addInitialStock: (
    productId:    string,
    productName:  string,
    quantity:     number,
    costPrice?:   number,
    notes?:       string,
    movedAt?:     string,
  ) => Promise<StockMovement>;

  /**
   * Adds stock to a product by recording a production run.
   * The repository validates BOM constraints inside a transaction.
   *
   * Returns `null` on success. Returns a `BomValidationResult` when the DB
   * refuses the write due to insufficient materials (structured error path).
   * Re-throws unexpected errors for the caller to handle.
   *
   * On success the Zustand cache is patched with the latest quantity so all
   * screens reflect the updated stock immediately.
   */
  addProductStock: (
    productId:  string,
    unitsToAdd: number,
    notes?:     string,
  ) => Promise<BomValidationResult | null>;

  // ── Filter ─────────────────────────────────────────────────────────────────
  setFilter:   (filter: Partial<InventoryFilter>) => void;
  clearFilter: () => void;
}

// ─── Default filter ───────────────────────────────────────────────────────────

const DEFAULT_FILTER: InventoryFilter = {
  category:    'all',
  searchQuery: '',
};

// ─── Mapping helper: camelCase domain → snake_case DB column names ────────────

/**
 * Maps the subset of `InventoryItem` fields that a UI update may touch
 * to their corresponding `UpdateInventoryItemInput` (snake_case) equivalents.
 * Only fields that are actually present in `updates` are included.
 */
function toDbUpdates(
  updates: Partial<InventoryItem>,
): import('../../database/schemas/inventory_items.schema').UpdateInventoryItemInput {
  const out: Record<string, string | number | null> = {};

  if (updates.name        !== undefined) out['name']          = updates.name;
  if (updates.category    !== undefined) out['category']      = updates.category;
  if (updates.quantity    !== undefined) out['quantity']      = updates.quantity;
  if (updates.unit        !== undefined) out['unit']          = updates.unit;
  if (updates.description !== undefined) out['description']   = updates.description;
  if (updates.costPrice   !== undefined) out['cost_price']    = updates.costPrice;
  if (updates.imageUri    !== undefined) out['image_uri']     = updates.imageUri;
  if (updates.price       !== undefined) out['price']         = updates.price;
  if (updates.sku         !== undefined) out['sku']           = updates.sku;
  if (updates.reorderLevel !== undefined) out['reorder_level'] = updates.reorderLevel;
  if (updates.condition   !== undefined) out['condition']     = updates.condition;
  if (updates.serialNumber !== undefined) out['serial_number'] = updates.serialNumber;
  if (updates.purchaseDate !== undefined) out['purchase_date'] = updates.purchaseDate;

  return out as import('../../database/schemas/inventory_items.schema').UpdateInventoryItemInput;
}

// ─── Store ───────────────────────────────────────────────────────────────────

export const useInventoryStore = create<InventoryState>()((set, _get) => ({
  items:     [],
  filter:    DEFAULT_FILTER,
  isLoading: false,
  error:     null,

  // ── Initialisation ─────────────────────────────────────────────────────────

  initializeInventory: async () => {
    set({ isLoading: true, error: null });
    try {
      const rows = await getAllItems();
      set({ items: rows, isLoading: false });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load inventory';
      set({ isLoading: false, error: message });
    }
  },

  // ── Mutations ──────────────────────────────────────────────────────────────

  addItem: async (input) => {
    const item = await insertItem(input);
    set((state) => ({ items: [item, ...state.items] }));
    return item;
  },

  updateItem: async (id, updates) => {
    const dbUpdates = toDbUpdates(updates);
    await dbUpdateItem(id, dbUpdates);
    // Merge the camelCase updates into the cached item
    const now = new Date().toISOString();
    set((state) => ({
      items: state.items.map((item) =>
        item.id === id
          ? { ...item, ...updates, updatedAt: now }
          : item,
      ),
    }));
  },

  deleteItem: async (id) => {
    await dbDeleteItem(id);
    set((state) => ({
      items: state.items.filter((item) => item.id !== id),
    }));
  },

  reduceStock: async (productId, productName, quantityToReduce, reason, ingredients, rawMaterials, notes) => {
    // The repository handles the full atomic transaction and validation.
    // reason determines whether stock is returned ('correction') or only audit-logged.
    const result = await reduceProductStock(
      productId,
      productName,
      quantityToReduce,
      reason,
      ingredients,
      rawMaterials,
      ...(notes !== undefined ? [notes] : []),
    );

    // Update product quantity in cache
    const now = new Date().toISOString();
    set((state) => ({
      items: state.items.map((item) =>
        item.id === productId
          ? { ...item, quantity: result.newProductQuantity, updatedAt: now }
          : item,
      ),
    }));

    // Update ingredient quantities in cache
    if (result.ingredientsReturned.length > 0) {
      set((state) => ({
        items: state.items.map((item) => {
          const returned = result.ingredientsReturned.find((r) => r.ingredientId === item.id);
          if (returned === undefined) return item;
          return { ...item, quantity: item.quantity + returned.returned, updatedAt: now };
        }),
      }));
    }

    return result;
  },

  addIngredientStock: async (ingredientId, quantity, notes) => {
    const result = await dbAddIngredientStock(
      ingredientId,
      quantity,
      ...(notes !== undefined ? [notes] : []),
    );

    const now = new Date().toISOString();
    set((state) => ({
      items: state.items.map((item) =>
        item.id === ingredientId
          ? { ...item, quantity: result.newQuantity, updatedAt: now }
          : item,
      ),
    }));

    return result;
  },

  reduceIngredientStock: async (ingredientId, ingredientName, quantity, reason, notes) => {
    const result = await dbReduceIngredientStock(
      ingredientId,
      ingredientName,
      quantity,
      reason,
      ...(notes !== undefined ? [notes] : []),
    );

    const now = new Date().toISOString();
    set((state) => ({
      items: state.items.map((item) =>
        item.id === ingredientId
          ? { ...item, quantity: result.newQuantity, updatedAt: now }
          : item,
      ),
    }));

    return result;
  },

  addInitialStock: async (productId, productName, quantity, costPrice, notes, movedAt) => {
    const movement = await addStockMovement(
      {
        productId,
        productName,
        quantityDelta: quantity,
        movementType:  'initial',
        ...(costPrice !== undefined ? { costPrice } : {}),
        ...(notes     !== undefined ? { notes }     : {}),
        ...(movedAt   !== undefined ? { movedAt }   : {}),
      },
    );

    const now = new Date().toISOString();
    set((state) => ({
      items: state.items.map((item) =>
        item.id === productId
          ? { ...item, quantity: movement.quantityAfter, updatedAt: now }
          : item,
      ),
    }));

    return movement;
  },

  addProductStock: async (productId, unitsToAdd, notes) => {
    try {
      set({ isLoading: true, error: null });
      await dbAddProductStock(
        productId,
        unitsToAdd,
        ...(notes !== undefined ? [notes] : []),
      );
      const updatedItem = await getItemById(productId);
      if (updatedItem !== null) {
        set((state) => ({
          items: state.items.map((i) => (i.id === productId ? updatedItem : i)),
          isLoading: false,
        }));
      } else {
        set({ isLoading: false });
      }
      return null;
    } catch (err) {
      set({ isLoading: false });
      if (err instanceof Error) {
        try {
          const result = JSON.parse(err.message) as BomValidationResult;
          if ('shortages' in result) return result;
        } catch {
          // not a structured error — fall through to re-throw
        }
      }
      throw err;
    }
  },

  // ── Filter ─────────────────────────────────────────────────────────────────

  setFilter: (partial) =>
    set((state) => ({ filter: { ...state.filter, ...partial } })),

  clearFilter: () => set({ filter: DEFAULT_FILTER }),
}));

// ─── Selectors ───────────────────────────────────────────────────────────────

/**
 * Returns the full item array (stable Zustand reference — do not mutate).
 */
export const selectAllItems = (state: InventoryState): InventoryItem[] =>
  state.items;

/**
 * Returns the current filter configuration.
 */
export const selectInventoryFilter = (state: InventoryState): InventoryFilter =>
  state.filter;

/**
 * Factory — returns a selector for a specific category.
 * Use with `useMemo` in components to avoid re-creating the function:
 *   const selector = useMemo(() => selectItemsByCategory('product'), []);
 *   const products = useInventoryStore(selector);
 */
export const selectItemsByCategory =
  (category: InventoryCategory) =>
  (state: InventoryState): InventoryItem[] =>
    state.items.filter((item) => item.category === category);

/** Pre-built category selectors. */
export const selectProducts    = selectItemsByCategory('product');
export const selectIngredients = selectItemsByCategory('ingredient');
export const selectEquipment   = selectItemsByCategory('equipment');

/**
 * Items where `quantity <= reorderLevel`.
 * Only ingredients are considered because only they carry a meaningful reorder level.
 */
export const selectLowStockItems = (state: InventoryState): InventoryItem[] =>
  state.items.filter(
    (item) =>
      item.reorderLevel !== undefined && item.quantity <= item.reorderLevel,
  );

/**
 * Factory — returns the item with the given id, or undefined.
 */
export const selectItemById =
  (id: string) =>
  (state: InventoryState): InventoryItem | undefined =>
    state.items.find((item) => item.id === id);

/**
 * Derived: items filtered by the current `filter` state (category + search).
 * Returns a new array — callers should memoize the result if performance is critical.
 */
export const selectFilteredItems = (state: InventoryState): InventoryItem[] => {
  const { category, searchQuery } = state.filter;
  const q = searchQuery.toLowerCase().trim();

  return state.items.filter((item) => {
    const categoryMatch = category === 'all' || item.category === category;
    const searchMatch =
      q.length === 0 ||
      item.name.toLowerCase().includes(q) ||
      (item.sku?.toLowerCase().includes(q) ?? false) ||
      (item.description?.toLowerCase().includes(q) ?? false);
    return categoryMatch && searchMatch;
  });
};

/** Total count of items currently in the store. */
export const selectInventoryCount = (state: InventoryState): number =>
  state.items.length;

/** Count of low-stock items (badge on drawer). */
export const selectLowStockCount = (state: InventoryState): number =>
  selectLowStockItems(state).length;

/** Whether the store is currently loading from SQLite. */
export const selectInventoryLoading = (state: InventoryState): boolean =>
  state.isLoading;

/** Last error from an async inventory action, or null. */
export const selectInventoryError = (state: InventoryState): string | null =>
  state.error;

// ─── Initialiser (called from initializeStores) ───────────────────────────────

/**
 * Hydrates the inventory store from SQLite.
 * Must be called after `initDatabase()` has completed.
 */
export async function initializeInventory(): Promise<void> {
  await useInventoryStore.getState().initializeInventory();
}

// ─── Re-export toDomain for external consumers ────────────────────────────────

export { toDomain as inventoryRowToDomain };
