/**
 * InventoryStockAddSheet
 *
 * Add-only stock-entry bottom sheet for any inventory item (product /
 * ingredient / equipment). Opened from the inventory tap-to-choose chooser
 * (`InventoryActionSheet`) or the tablet detail pane.
 *
 * It is a single reusable sheet that adapts to the item it is given and routes
 * the confirm to the correct, already-audited store action:
 *
 *   ingredient                  → addIngredientStock  (consumption RETURN log)
 *   product · ready_to_sell     → restockProduct      (stock_movements 'restock')
 *   product · manufactured      → addProductStock     (BOM production run)
 *   equipment                   → updateItem(+qty)     (asset count, no ledger)
 *
 * For a manufactured product it runs in "production mode": as the operator
 * types a quantity, a debounced `validateStockAddition()` preflight surfaces a
 * BOM shortage panel and blocks confirm when nothing can be produced. This
 * re-uses the BOM warning pattern previously embedded in inventory/[id].tsx.
 *
 * Visual language mirrors `AddInitialStockSheet` (large centered quantity, optional
 * cost, notes, primary confirm) with full dark/light support and the item's
 * category accent.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Modal,
  StyleSheet,
  Pressable,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { X, PackagePlus, Factory, FileText, DollarSign, AlertTriangle } from 'lucide-react-native';
import { Text } from '@/components/atoms/Text';
import { Button } from '@/components/atoms/Button';
import { theme as staticTheme } from '@/core/theme';
import { useAppTheme, useThemeMode } from '@/core/theme';
import { getInventoryAccent } from '@/core/theme/inventoryAccents';
import { useInventoryStore } from '@/store';
import { useAppDialog } from '@/hooks';
import { validateStockAddition } from '@/core/utils/bomValidation';
import type { InventoryItem, BomShortageItem, BomValidationResult } from '@/types';

// ─── Props ────────────────────────────────────────────────────────────────────

export interface InventoryStockAddSheetProps {
  visible:   boolean;
  /** The item to add stock to. `null` while the sheet is closing. */
  item:      InventoryItem | null;
  /** Called after a successful stock-in with the item's new quantity. */
  onSuccess: (newQuantity: number) => void;
  onClose:   () => void;
}

// ─── BOM shortage panel (manufactured products only) ──────────────────────────

const BomShortageRow: React.FC<{ shortage: BomShortageItem; isDark: boolean }> = ({ shortage, isDark }) => {
  // Ingredient shortages → red dot; raw-material shortages → amber dot.
  const dotColor = shortage.isRawMaterial
    ? (isDark ? '#FFB020' : staticTheme.colors.warning[500])
    : (isDark ? '#FF6B6B' : staticTheme.colors.error[500]);
  const labelColor = isDark ? 'rgba(255,255,255,0.75)' : staticTheme.colors.gray[700];
  const subColor   = isDark ? 'rgba(255,255,255,0.45)' : staticTheme.colors.gray[500];
  return (
    <View style={bomStyles.row}>
      <View style={[bomStyles.dot, { backgroundColor: dotColor }]} />
      <Text variant="body-xs" weight="medium" style={[bomStyles.rowName, { color: labelColor }]} numberOfLines={1}>
        {shortage.ingredientName}
      </Text>
      <Text variant="body-xs" style={{ color: subColor }}>
        short {shortage.shortage % 1 === 0 ? shortage.shortage : shortage.shortage.toFixed(2)} {shortage.unit}
      </Text>
    </View>
  );
};

const BomWarningPanel: React.FC<{ result: BomValidationResult; isDark: boolean }> = ({ result, isDark }) => {
  const blocked = result.maxProducible === 0;
  const accent  = blocked
    ? (isDark ? '#FF6B6B' : staticTheme.colors.error[500])
    : (isDark ? '#FFB020' : staticTheme.colors.warning[600]);
  const bg = blocked
    ? (isDark ? 'rgba(255,107,107,0.10)' : staticTheme.colors.error[50])
    : (isDark ? 'rgba(255,176,32,0.10)'  : staticTheme.colors.warning[50]);
  const border = blocked
    ? (isDark ? 'rgba(255,107,107,0.35)' : staticTheme.colors.error[200])
    : (isDark ? 'rgba(255,176,32,0.35)'  : staticTheme.colors.warning[200]);

  return (
    <View style={[bomStyles.panel, { backgroundColor: bg, borderColor: border }]}>
      <View style={bomStyles.panelHeader}>
        <AlertTriangle size={15} color={accent} />
        <Text variant="body-sm" weight="semibold" style={{ color: accent, flex: 1 }}>
          {blocked
            ? 'Not enough materials to produce any units'
            : `Only ${result.maxProducible} unit${result.maxProducible === 1 ? '' : 's'} can be made now`}
        </Text>
      </View>
      <View style={bomStyles.list}>
        {result.shortages.map((s) => (
          <BomShortageRow key={`${s.isRawMaterial ? 'rm' : 'ing'}-${s.ingredientId}`} shortage={s} isDark={isDark} />
        ))}
      </View>
    </View>
  );
};

// ─── Component ────────────────────────────────────────────────────────────────

export const InventoryStockAddSheet: React.FC<InventoryStockAddSheetProps> = ({
  visible,
  item,
  onSuccess,
  onClose,
}) => {
  const insets = useSafeAreaInsets();
  const theme  = useAppTheme();
  const isDark = useThemeMode() === 'dark';
  const dialog = useAppDialog();

  const addIngredientStock = useInventoryStore((s) => s.addIngredientStock);
  const restockProduct     = useInventoryStore((s) => s.restockProduct);
  const addProductStock    = useInventoryStore((s) => s.addProductStock);
  const updateItem         = useInventoryStore((s) => s.updateItem);

  const [quantity,     setQuantity]     = useState('');
  const [costPrice,    setCostPrice]    = useState('');
  const [notes,        setNotes]        = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [bomResult,    setBomResult]    = useState<BomValidationResult | null>(null);

  const isProduct          = item?.category === 'product';
  const isManufactured     = isProduct && item?.productType === 'manufactured';
  const showCostField      = isProduct && !isManufactured; // restock captures cost; production derives it from BOM
  const itemId             = item?.id;

  // Reset fields whenever the sheet opens for a (potentially different) item.
  useEffect(() => {
    if (!visible) return;
    setQuantity('');
    setCostPrice(item?.costPrice !== undefined ? String(item.costPrice) : '');
    setNotes('');
    setBomResult(null);
  }, [visible, itemId, item?.costPrice]);

  // Debounced BOM preflight for manufactured products.
  useEffect(() => {
    if (!visible || !isManufactured || itemId === undefined) return;
    const qty = parseFloat(quantity);
    if (isNaN(qty) || qty <= 0) {
      setBomResult(null);
      return;
    }
    const handle = setTimeout(() => {
      validateStockAddition(itemId, qty)
        .then((result) => setBomResult(result))
        .catch(() => setBomResult(null));
    }, 300);
    return () => clearTimeout(handle);
  }, [visible, isManufactured, itemId, quantity]);

  const handleQuantityChange = useCallback((text: string) => {
    setQuantity(text);
    // Clear stale BOM warnings while the operator is still typing.
    if (isManufactured) setBomResult(null);
  }, [isManufactured]);

  const handleConfirm = useCallback(async () => {
    if (!item) return;
    const qty = parseFloat(quantity);
    if (isNaN(qty) || qty <= 0) {
      dialog.show({ variant: 'warning', title: 'Invalid Quantity', message: 'Please enter a quantity greater than zero.' });
      return;
    }

    const parsedNotes = notes.trim().length > 0 ? notes.trim() : undefined;

    setIsSubmitting(true);
    try {
      let newQuantity: number;

      if (item.category === 'ingredient') {
        const result = await addIngredientStock(item.id, qty, parsedNotes);
        newQuantity = result.newQuantity;
      } else if (item.category === 'product' && item.productType === 'manufactured') {
        const blocked = await addProductStock(item.id, qty, parsedNotes);
        if (blocked !== null) {
          // Insufficient materials — keep the sheet open and show the panel.
          setBomResult(blocked);
          return;
        }
        const updated = useInventoryStore.getState().items.find((i) => i.id === item.id);
        newQuantity = updated?.quantity ?? item.quantity + qty;
      } else if (item.category === 'product') {
        const parsedCost = costPrice.trim().length > 0 ? parseFloat(costPrice) : undefined;
        const movement = await restockProduct(item.id, item.name, qty, parsedCost, parsedNotes);
        newQuantity = movement.quantityAfter;
      } else {
        // equipment — simple asset count increase (no movement ledger)
        newQuantity = item.quantity + qty;
        await updateItem(item.id, { quantity: newQuantity });
      }

      onSuccess(newQuantity);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to add stock. Please try again.';
      dialog.show({ variant: 'error', title: 'Stock Entry Failed', message });
    } finally {
      setIsSubmitting(false);
    }
  }, [item, quantity, costPrice, notes, addIngredientStock, addProductStock, restockProduct, updateItem, onSuccess, dialog]);

  // ── Derived UI state ────────────────────────────────────────────────────────

  const qtyNum         = parseFloat(quantity);
  const qtyValid       = !isNaN(qtyNum) && qtyNum > 0;
  const bomBlocked     = isManufactured && bomResult !== null && bomResult.maxProducible === 0;
  const confirmDisabled = !qtyValid || bomBlocked || isSubmitting;

  const accentInfo = getInventoryAccent(item?.category ?? 'product', isDark);
  const accent     = accentInfo.accent;
  const HeaderIcon = isManufactured ? Factory : PackagePlus;
  const title      = isManufactured ? 'Record Production' : 'Add Stock';
  const confirmLabel = isManufactured ? 'Produce' : 'Add Stock';

  // ── Colors (mirrors AddInitialStockSheet) ─────────────────────────────────────

  const sheetBg     = isDark ? '#1A1F2E' : theme.colors.surface;
  const inputBg     = isDark ? 'rgba(255,255,255,0.04)' : theme.colors.background;
  const inputBorder = isDark ? 'rgba(255,255,255,0.12)' : theme.colors.border;
  const inputText   = isDark ? '#FFFFFF'                 : theme.colors.text;
  const labelColor  = isDark ? 'rgba(255,255,255,0.55)'  : theme.colors.gray[600];
  const placeholderColor = isDark ? 'rgba(255,255,255,0.25)' : theme.colors.placeholder;
  const handleColor = isDark ? 'rgba(255,255,255,0.15)'  : theme.colors.gray[300];
  const iconMuted   = isDark ? 'rgba(255,255,255,0.38)'  : theme.colors.gray[400];

  const dynStyles = useMemo(() => StyleSheet.create({
    sheet: {
      backgroundColor: sheetBg,
      borderTopLeftRadius:  28,
      borderTopRightRadius: 28,
      paddingHorizontal: staticTheme.spacing.md,
      paddingBottom: insets.bottom + staticTheme.spacing.lg,
      borderTopWidth:  1,
      borderLeftWidth: 1,
      borderRightWidth: 1,
      borderColor: isDark ? 'rgba(255,255,255,0.07)' : theme.colors.border,
      ...(isDark ? {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.4,
        shadowRadius: 20,
        elevation: 20,
      } : staticTheme.shadows.xl),
    },
    handle: {
      width: 36, height: 4,
      backgroundColor: handleColor,
      borderRadius: 2, alignSelf: 'center',
      marginTop: staticTheme.spacing.sm,
      marginBottom: staticTheme.spacing.md,
    },
    nameText: { color: isDark ? 'rgba(255,255,255,0.55)' : theme.colors.gray[500] },
    quantityInput: {
      fontSize: 36,
      fontWeight: '700',
      color: inputText,
      textAlign: 'center',
      letterSpacing: -1,
      paddingVertical: staticTheme.spacing.sm,
    },
    unitLabel: { color: iconMuted },
    inputField: {
      flexDirection: 'row',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: inputBorder,
      borderRadius: staticTheme.borderRadius.md,
      paddingHorizontal: staticTheme.spacing.md,
      paddingVertical: staticTheme.spacing.sm,
      backgroundColor: inputBg,
      minHeight: 48,
      gap: staticTheme.spacing.sm,
    },
    inputText: { flex: 1, color: inputText, fontSize: 15 },
    labelText: { color: labelColor, marginBottom: 6 },
    divider: {
      height: 1,
      backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : theme.colors.borderSubtle,
      marginVertical: staticTheme.spacing.md,
    },
  }), [sheetBg, isDark, theme, insets.bottom, handleColor, inputBg, inputBorder, inputText, labelColor, iconMuted]);

  return (
    <Modal
      visible={visible && item !== null}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Pressable style={staticStyles.overlay} onPress={onClose}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={staticStyles.kbWrapper}
        >
          <Pressable style={dynStyles.sheet} onPress={(e) => e.stopPropagation()}>
            <View style={dynStyles.handle} />

            {item && (
              <>
                {/* Header */}
                <View style={staticStyles.header}>
                  <View style={staticStyles.headerText}>
                    <View style={[staticStyles.iconCircle, { backgroundColor: `${accent}18`, borderColor: `${accent}30` }]}>
                      <HeaderIcon size={18} color={accent} />
                    </View>
                    <View style={staticStyles.headerLabels}>
                      <Text variant="h5" weight="bold" style={{ color: isDark ? '#FFFFFF' : theme.colors.text }}>
                        {title}
                      </Text>
                      <Text variant="body-sm" style={dynStyles.nameText} numberOfLines={1}>
                        {item.name}
                      </Text>
                    </View>
                  </View>
                  <Pressable onPress={onClose} hitSlop={8} style={staticStyles.closeBtn}>
                    <X size={20} color={isDark ? 'rgba(255,255,255,0.45)' : theme.colors.gray[500]} />
                  </Pressable>
                </View>

                <ScrollView
                  showsVerticalScrollIndicator={false}
                  keyboardShouldPersistTaps="handled"
                  contentContainerStyle={staticStyles.scrollContent}
                >
                  {/* Quantity — large centered input */}
                  <View style={staticStyles.quantityBlock}>
                    <TextInput
                      style={dynStyles.quantityInput}
                      value={quantity}
                      onChangeText={handleQuantityChange}
                      placeholder="0"
                      placeholderTextColor={placeholderColor}
                      keyboardType="decimal-pad"
                      returnKeyType="done"
                      accessibilityLabel={isManufactured ? 'Units to produce' : 'Quantity to add'}
                      autoFocus
                    />
                    <Text variant="body-sm" weight="medium" style={dynStyles.unitLabel}>
                      {isManufactured ? `${item.unit} to produce` : `${item.unit} to add`}
                    </Text>
                  </View>

                  {/* BOM shortage preflight (manufactured) */}
                  {isManufactured && bomResult !== null && !bomResult.isValid && (
                    <BomWarningPanel result={bomResult} isDark={isDark} />
                  )}

                  <View style={dynStyles.divider} />

                  {/* Cost price — ready-to-sell products only */}
                  {showCostField && (
                    <View style={staticStyles.fieldWrap}>
                      <Text variant="body-sm" weight="medium" style={dynStyles.labelText}>
                        Cost Price per Unit (optional)
                      </Text>
                      <View style={dynStyles.inputField}>
                        <DollarSign size={16} color={iconMuted} />
                        <TextInput
                          style={dynStyles.inputText}
                          value={costPrice}
                          onChangeText={setCostPrice}
                          placeholder="0.00"
                          placeholderTextColor={placeholderColor}
                          keyboardType="decimal-pad"
                          returnKeyType="done"
                          accessibilityLabel="Cost price per unit"
                        />
                      </View>
                    </View>
                  )}

                  {/* Notes */}
                  <View style={staticStyles.fieldWrap}>
                    <Text variant="body-sm" weight="medium" style={dynStyles.labelText}>
                      Notes (optional)
                    </Text>
                    <View style={[dynStyles.inputField, staticStyles.notesField]}>
                      <FileText size={16} color={iconMuted} style={staticStyles.notesIcon} />
                      <TextInput
                        style={[dynStyles.inputText, staticStyles.notesInput]}
                        value={notes}
                        onChangeText={setNotes}
                        placeholder={isManufactured ? 'e.g. Morning batch' : 'e.g. Received supplier delivery'}
                        placeholderTextColor={placeholderColor}
                        multiline
                        numberOfLines={2}
                        returnKeyType="done"
                        accessibilityLabel="Notes"
                      />
                    </View>
                  </View>
                </ScrollView>

                {/* Actions */}
                <View style={staticStyles.actions}>
                  <Button
                    title="Cancel"
                    onPress={onClose}
                    variant="outline"
                    size="lg"
                    style={staticStyles.cancelBtn}
                  />
                  <Button
                    title={isSubmitting ? 'Saving...' : confirmLabel}
                    onPress={handleConfirm}
                    variant="primary"
                    size="lg"
                    loading={isSubmitting}
                    disabled={confirmDisabled}
                    style={staticStyles.confirmBtn}
                  />
                </View>
              </>
            )}
            {dialog.Dialog}
          </Pressable>
        </KeyboardAvoidingView>
      </Pressable>
    </Modal>
  );
};

InventoryStockAddSheet.displayName = 'InventoryStockAddSheet';

// ─── Static styles ────────────────────────────────────────────────────────────

const staticStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.60)',
    justifyContent: 'flex-end',
  },
  kbWrapper: { justifyContent: 'flex-end' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: staticTheme.spacing.md,
  },
  headerText: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: staticTheme.spacing.sm,
    flex: 1,
  },
  headerLabels: { flex: 1, minWidth: 0 },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    flexShrink: 0,
  },
  closeBtn: { padding: 4 },
  scrollContent: { paddingBottom: staticTheme.spacing.md },
  quantityBlock: {
    alignItems: 'center',
    paddingVertical: staticTheme.spacing.md,
    gap: 4,
  },
  fieldWrap: { marginBottom: staticTheme.spacing.md },
  notesField: {
    alignItems: 'flex-start',
    paddingVertical: staticTheme.spacing.sm,
  },
  notesIcon: { alignSelf: 'flex-start', marginTop: 2 },
  notesInput: {
    minHeight: 56,
    textAlignVertical: 'top',
  },
  actions: {
    flexDirection: 'row',
    gap: staticTheme.spacing.sm,
    paddingTop: staticTheme.spacing.sm,
  },
  cancelBtn: { flex: 1 },
  confirmBtn: { flex: 2 },
});

const bomStyles = StyleSheet.create({
  panel: {
    borderWidth: 1,
    borderRadius: staticTheme.borderRadius.lg,
    padding: staticTheme.spacing.sm + 2,
    gap: staticTheme.spacing.sm,
    marginTop: staticTheme.spacing.xs,
  },
  panelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: staticTheme.spacing.sm,
  },
  list: { gap: 6 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: staticTheme.spacing.sm,
  },
  dot: { width: 7, height: 7, borderRadius: 4, flexShrink: 0 },
  rowName: { flex: 1 },
});
