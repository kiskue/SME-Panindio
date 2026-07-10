/**
 * useInventoryItemActions
 *
 * Centralises the "tap an inventory item → choose Add Stock or View Details"
 * flow so the inventory hub and the shared CategoryInventoryScreen don't each
 * duplicate the sheet state and handlers.
 *
 * Usage:
 *   const { openActions, actionSheetProps, stockSheetProps } =
 *     useInventoryItemActions({ onViewDetails: (item) => navigateToDetail(item.id) });
 *
 *   <InventoryItemCard onPress={openActions} ... />
 *   <InventoryActionSheet {...actionSheetProps} />
 *   <InventoryStockAddSheet {...stockSheetProps} />
 *
 * The chooser does not branch on category — the stock sheet self-adapts
 * (manufactured products run the BOM production flow, everything else gets a
 * simple add). Navigation is injected so each screen keeps its own router/stack
 * behaviour.
 */

import { useCallback, useMemo, useState } from 'react';
import type { InventoryItem } from '@/types';

export interface UseInventoryItemActionsOptions {
  /** Navigate to the item's full detail/edit screen. */
  onViewDetails: (item: InventoryItem) => void;
}

/** Props shaped for <InventoryActionSheet />. */
interface ActionSheetProps {
  visible:       boolean;
  item:          InventoryItem | null;
  onAddStock:    (item: InventoryItem) => void;
  onViewDetails: (item: InventoryItem) => void;
  onClose:       () => void;
}

/** Props shaped for <InventoryStockAddSheet />. */
interface StockSheetProps {
  visible:   boolean;
  item:      InventoryItem | null;
  onSuccess: (newQuantity: number) => void;
  onClose:   () => void;
}

export interface UseInventoryItemActions {
  /** Use as the card `onPress`: opens the Add Stock / View Details chooser. */
  openActions:      (item: InventoryItem) => void;
  /** Open the stock-entry sheet directly (e.g. a tablet detail-pane button). */
  openStockSheet:   (item: InventoryItem) => void;
  /** Spread onto `<InventoryActionSheet />`. */
  actionSheetProps: ActionSheetProps;
  /** Spread onto `<InventoryStockAddSheet />`. */
  stockSheetProps:  StockSheetProps;
}

export function useInventoryItemActions(
  { onViewDetails }: UseInventoryItemActionsOptions,
): UseInventoryItemActions {
  const [actionItem, setActionItem] = useState<InventoryItem | null>(null);
  const [stockItem,  setStockItem]  = useState<InventoryItem | null>(null);

  const openActions    = useCallback((item: InventoryItem) => setActionItem(item), []);
  const openStockSheet = useCallback((item: InventoryItem) => setStockItem(item), []);
  const closeActions   = useCallback(() => setActionItem(null), []);
  const closeStock     = useCallback(() => setStockItem(null), []);

  const handleAddStock = useCallback((item: InventoryItem) => {
    setActionItem(null);
    setStockItem(item);
  }, []);

  const handleViewDetails = useCallback((item: InventoryItem) => {
    setActionItem(null);
    onViewDetails(item);
  }, [onViewDetails]);

  const handleStockSuccess = useCallback(() => {
    // Store actions already patch the Zustand cache, so the list/detail reflect
    // the new quantity automatically; we just dismiss the sheet.
    setStockItem(null);
  }, []);

  const actionSheetProps = useMemo<ActionSheetProps>(() => ({
    visible:       actionItem !== null,
    item:          actionItem,
    onAddStock:    handleAddStock,
    onViewDetails: handleViewDetails,
    onClose:       closeActions,
  }), [actionItem, handleAddStock, handleViewDetails, closeActions]);

  const stockSheetProps = useMemo<StockSheetProps>(() => ({
    visible:   stockItem !== null,
    item:      stockItem,
    onSuccess: handleStockSuccess,
    onClose:   closeStock,
  }), [stockItem, handleStockSuccess, closeStock]);

  return { openActions, openStockSheet, actionSheetProps, stockSheetProps };
}
