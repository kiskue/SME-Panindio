/**
 * AddInitialStockSheet
 *
 * Bottom-sheet modal that captures the opening-balance stock entry for a
 * newly created product. Shown immediately after product creation so the
 * operator can record how many units are physically on hand without the
 * add-product form growing into a two-concern form.
 *
 * ERP rationale:
 *   Product creation (item master) and initial stock-in (inventory movement)
 *   are separate transactions in all standard ERP systems. This sheet handles
 *   the second transaction: it writes a `stock_movements` row with
 *   `movementType = 'initial'` via the `addInitialStock` store action.
 *
 * Fields:
 *   Quantity  *  — units to add (must be > 0)
 *   Cost Price   — per-unit purchase cost (optional, defaults to existing costPrice)
 *   Date         — business date of the stock entry (defaults to today)
 *   Notes        — free text (optional)
 *
 * Layout:
 *   Handle bar
 *   Header: product name + close button
 *   ─────────────────────────────────
 *   Quantity input (large, numeric)
 *   Cost price input
 *   Date row
 *   Notes input
 *   ─────────────────────────────────
 *   [Skip]  [Add Stock →]
 *
 * Full dark/light mode. Follows the established StockAdjustModal pattern.
 */

import React, { useState, useCallback, useMemo } from 'react';
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
import { X, PackagePlus, CalendarDays, FileText, DollarSign } from 'lucide-react-native';
import { Text } from '@/components/atoms/Text';
import { Button } from '@/components/atoms/Button';
import { theme as staticTheme } from '@/core/theme';
import { useAppTheme } from '@/core/theme';
import { useThemeStore, selectThemeMode, useInventoryStore } from '@/store';
import { useAppDialog } from '@/hooks';

// ─── Props ────────────────────────────────────────────────────────────────────

export interface AddInitialStockSheetProps {
  visible:      boolean;
  productId:    string;
  productName:  string;
  productUnit:  string;
  /** Pre-fill the cost price field from the product master if available. */
  defaultCostPrice?: number;
  onSuccess:    (newQuantity: number) => void;
  onSkip:       () => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function todayISO(): string {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

function formatDateDisplay(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-PH', {
      year:  'numeric',
      month: 'short',
      day:   'numeric',
    });
  } catch {
    return iso;
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

export const AddInitialStockSheet: React.FC<AddInitialStockSheetProps> = ({
  visible,
  productId,
  productName,
  productUnit,
  defaultCostPrice,
  onSuccess,
  onSkip,
}) => {
  const insets      = useSafeAreaInsets();
  const theme       = useAppTheme();
  const mode        = useThemeStore(selectThemeMode);
  const isDark      = mode === 'dark';
  const addInitialStock = useInventoryStore((s) => s.addInitialStock);
  const dialog      = useAppDialog();

  const [quantity,      setQuantity]      = useState('');
  const [costPrice,     setCostPrice]     = useState(
    defaultCostPrice !== undefined ? String(defaultCostPrice) : '',
  );
  const [entryDate,     setEntryDate]     = useState(todayISO());
  const [notes,         setNotes]         = useState('');
  const [isSubmitting,  setIsSubmitting]  = useState(false);

  // Reset all fields when the sheet is opened for a fresh product
  const resetFields = useCallback(() => {
    setQuantity('');
    setCostPrice(defaultCostPrice !== undefined ? String(defaultCostPrice) : '');
    setEntryDate(todayISO());
    setNotes('');
  }, [defaultCostPrice]);

  const handleSkip = useCallback(() => {
    resetFields();
    onSkip();
  }, [resetFields, onSkip]);

  const handleConfirm = useCallback(async () => {
    const qty = parseFloat(quantity);
    if (isNaN(qty) || qty <= 0) {
      dialog.show({ variant: 'warning', title: 'Invalid Quantity', message: 'Please enter a quantity greater than zero.' });
      return;
    }

    setIsSubmitting(true);
    try {
      const parsedCost = costPrice.trim().length > 0 ? parseFloat(costPrice) : undefined;
      const parsedNotes = notes.trim().length > 0 ? notes.trim() : undefined;

      const movement = await addInitialStock(
        productId,
        productName,
        qty,
        parsedCost,
        parsedNotes,
        entryDate,
      );

      resetFields();
      onSuccess(movement.quantityAfter);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to add stock. Please try again.';
      dialog.show({ variant: 'error', title: 'Stock Entry Failed', message });
    } finally {
      setIsSubmitting(false);
    }
  }, [
    quantity,
    costPrice,
    notes,
    entryDate,
    productId,
    productName,
    addInitialStock,
    resetFields,
    onSuccess,
  ]);

  // ── Colors ──────────────────────────────────────────────────────────────────

  const accent      = isDark ? '#4F9EFF' : staticTheme.colors.primary[500];
  const sheetBg     = isDark ? '#1A1F2E' : theme.colors.surface;
  const inputBg     = isDark ? 'rgba(255,255,255,0.04)' : theme.colors.background;
  const inputBorder = isDark ? 'rgba(255,255,255,0.12)' : theme.colors.border;
  const inputText   = isDark ? '#FFFFFF'                 : theme.colors.text;
  const labelColor  = isDark ? 'rgba(255,255,255,0.55)'  : theme.colors.gray[600];
  const placeholderColor = isDark ? 'rgba(255,255,255,0.25)' : theme.colors.placeholder;
  const handleColor = isDark ? 'rgba(255,255,255,0.15)'  : theme.colors.gray[300];

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
      borderRadius: 2, alignSelf: 'center' as const,
      marginTop: staticTheme.spacing.sm,
      marginBottom: staticTheme.spacing.md,
    },
    nameText: { color: isDark ? 'rgba(255,255,255,0.55)' : theme.colors.gray[500] },
    quantityInput: {
      fontSize: 36,
      fontWeight: '700' as const,
      color: inputText,
      textAlign: 'center' as const,
      letterSpacing: -1,
      paddingVertical: staticTheme.spacing.sm,
    },
    unitLabel: {
      color: isDark ? 'rgba(255,255,255,0.38)' : theme.colors.gray[400],
    },
    inputField: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      borderWidth: 1,
      borderColor: inputBorder,
      borderRadius: staticTheme.borderRadius.md,
      paddingHorizontal: staticTheme.spacing.md,
      paddingVertical: staticTheme.spacing.sm,
      backgroundColor: inputBg,
      minHeight: 48,
      gap: staticTheme.spacing.sm,
    },
    inputText: {
      flex: 1,
      color: inputText,
      fontSize: 15,
    },
    labelText: { color: labelColor, marginBottom: 6 },
    divider: {
      height: 1,
      backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : theme.colors.borderSubtle,
      marginVertical: staticTheme.spacing.md,
    },
  }), [
    sheetBg, isDark, theme, insets.bottom, handleColor,
    inputBg, inputBorder, inputText, labelColor,
  ]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleSkip}
      statusBarTranslucent
    >
      <Pressable style={staticStyles.overlay} onPress={handleSkip}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={staticStyles.kbWrapper}
        >
          <Pressable style={dynStyles.sheet} onPress={(e) => e.stopPropagation()}>
            <View style={dynStyles.handle} />

            {/* Header */}
            <View style={staticStyles.header}>
              <View style={staticStyles.headerText}>
                <View style={[staticStyles.iconCircle, { backgroundColor: `${accent}18`, borderColor: `${accent}30` }]}>
                  <PackagePlus size={18} color={accent} />
                </View>
                <View>
                  <Text variant="h5" weight="bold" style={{ color: isDark ? '#FFFFFF' : theme.colors.text }}>
                    Add Initial Stock
                  </Text>
                  <Text variant="body-sm" style={dynStyles.nameText} numberOfLines={1}>
                    {productName}
                  </Text>
                </View>
              </View>
              <Pressable onPress={handleSkip} hitSlop={8} style={staticStyles.closeBtn}>
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
                  onChangeText={setQuantity}
                  placeholder="0"
                  placeholderTextColor={placeholderColor}
                  keyboardType="decimal-pad"
                  returnKeyType="done"
                  accessibilityLabel="Initial stock quantity"
                  autoFocus
                />
                <Text variant="body-sm" weight="medium" style={dynStyles.unitLabel}>
                  {productUnit}
                </Text>
              </View>

              <View style={dynStyles.divider} />

              {/* Cost price */}
              <View style={staticStyles.fieldWrap}>
                <Text variant="body-sm" weight="medium" style={dynStyles.labelText}>
                  Cost Price per Unit (optional)
                </Text>
                <View style={dynStyles.inputField}>
                  <DollarSign size={16} color={isDark ? 'rgba(255,255,255,0.38)' : theme.colors.gray[400]} />
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

              {/* Date display (non-editable for now — always today) */}
              <View style={staticStyles.fieldWrap}>
                <Text variant="body-sm" weight="medium" style={dynStyles.labelText}>
                  Entry Date
                </Text>
                <View style={dynStyles.inputField}>
                  <CalendarDays size={16} color={isDark ? 'rgba(255,255,255,0.38)' : theme.colors.gray[400]} />
                  <Text variant="body" style={[dynStyles.inputText, { opacity: 0.75 }]}>
                    {formatDateDisplay(entryDate)}
                  </Text>
                </View>
              </View>

              {/* Notes */}
              <View style={staticStyles.fieldWrap}>
                <Text variant="body-sm" weight="medium" style={dynStyles.labelText}>
                  Notes (optional)
                </Text>
                <View style={[dynStyles.inputField, staticStyles.notesField]}>
                  <FileText size={16} color={isDark ? 'rgba(255,255,255,0.38)' : theme.colors.gray[400]} style={{ alignSelf: 'flex-start', marginTop: 2 }} />
                  <TextInput
                    style={[dynStyles.inputText, staticStyles.notesInput]}
                    value={notes}
                    onChangeText={setNotes}
                    placeholder="e.g. Opening stock from supplier delivery"
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
                title="Skip"
                onPress={handleSkip}
                variant="outline"
                size="lg"
                style={staticStyles.skipBtn}
              />
              <Button
                title={isSubmitting ? 'Adding...' : 'Add Stock'}
                onPress={handleConfirm}
                variant="primary"
                size="lg"
                loading={isSubmitting}
                style={staticStyles.confirmBtn}
              />
            </View>
            {dialog.Dialog}
          </Pressable>
        </KeyboardAvoidingView>
      </Pressable>
    </Modal>
  );
};

AddInitialStockSheet.displayName = 'AddInitialStockSheet';

// ─── Static styles ────────────────────────────────────────────────────────────

const staticStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.60)',
    justifyContent: 'flex-end',
  },
  kbWrapper: {
    justifyContent: 'flex-end',
  },
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
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  closeBtn: {
    padding: 4,
  },
  scrollContent: {
    paddingBottom: staticTheme.spacing.md,
  },
  quantityBlock: {
    alignItems: 'center',
    paddingVertical: staticTheme.spacing.md,
    gap: 4,
  },
  fieldWrap: {
    marginBottom: staticTheme.spacing.md,
  },
  notesField: {
    alignItems: 'flex-start',
    paddingVertical: staticTheme.spacing.sm,
  },
  notesInput: {
    minHeight: 56,
    textAlignVertical: 'top',
  },
  actions: {
    flexDirection: 'row',
    gap: staticTheme.spacing.sm,
    paddingTop: staticTheme.spacing.sm,
  },
  skipBtn: {
    flex: 1,
  },
  confirmBtn: {
    flex: 2,
  },
});
