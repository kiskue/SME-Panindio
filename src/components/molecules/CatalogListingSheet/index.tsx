/**
 * CatalogListingSheet
 *
 * Bottom-sheet modal for MANAGING a product's online ("Suki") catalog listing:
 * the manually-allocated online stock, availability, and optional price. Opened
 * from the Online Catalog screen's "Manage" action.
 *
 * Unlike the on/off Switch (which just toggles availability), this sheet lets the
 * owner set exactly HOW MANY units are listed online — an allocation independent
 * of on-hand inventory (e.g. list 20 of 100). The number is NOT auto-derived from
 * inventory; the owner controls it. On save it is pushed to the server and synced
 * to customers live over the socket.
 *
 * Fields:
 *   Available    — toggle (out of stock = off, or stock 0)
 *   Online stock — large numeric input with − / + steppers (set / add / deduct)
 *   Price        — optional per-listing price (defaults to the POS price)
 *
 * Shows on-hand for reference and WARNS (but still allows) when the allocation
 * exceeds on-hand. Delegates the write to `updateCatalogListing`. Follows the
 * established AddInitialStockSheet layout for visual consistency.
 */

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
  View,
  Modal,
  StyleSheet,
  Pressable,
  TextInput,
  ScrollView,
  Switch,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  X,
  Store,
  Minus,
  Plus,
  Tag,
  AlertTriangle,
} from 'lucide-react-native';
import { Text } from '@/components/atoms/Text';
import { Button } from '@/components/atoms/Button';
import { theme as staticTheme } from '@/core/theme';
import { useAppTheme, useThemeMode } from '@/core/theme';
import { useSukiBusinessStore } from '@/store';
import { useAppDialog } from '@/hooks';
import { formatCurrency } from '@/core/utils/format';
import type { InventoryItem, OnlineCatalogItem } from '@/types';

// ─── Props ────────────────────────────────────────────────────────────────────

export interface CatalogListingSheetProps {
  visible: boolean;
  /** The local product being listed (the catalog productId is its `id`). */
  item: InventoryItem;
  /** Existing catalog entry, if the product is already on the catalog. */
  existing?: OnlineCatalogItem;
  businessId: string;
  onClose: () => void;
  /** Called after a successful save (parent may refetch / close). */
  onSuccess?: () => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toOnHand(item: InventoryItem): number {
  return Math.max(0, Math.floor(Number(item.quantity ?? 0)));
}

// ─── Component ────────────────────────────────────────────────────────────────

export const CatalogListingSheet: React.FC<CatalogListingSheetProps> = ({
  visible,
  item,
  existing,
  businessId,
  onClose,
  onSuccess,
}) => {
  const insets = useSafeAreaInsets();
  const theme = useAppTheme();
  const isDark = useThemeMode() === 'dark';
  const updateCatalogListing = useSukiBusinessStore((s) => s.updateCatalogListing);
  const dialog = useAppDialog();

  const onHand = toOnHand(item);

  const [available, setAvailable] = useState(true);
  const [stock, setStock] = useState('');
  const [price, setPrice] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Seed fields whenever the sheet opens for a (possibly different) product.
  useEffect(() => {
    if (!visible) return;
    setAvailable(existing?.isAvailable ?? true);
    setStock(
      existing ? String(existing.stockQuantity) : String(onHand),
    );
    const seedPrice = existing?.customPrice ?? item.price;
    setPrice(seedPrice !== undefined ? String(seedPrice) : '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, existing, item.id]);

  const parsedStock = parseInt(stock, 10);
  const stockValid = !isNaN(parsedStock) && parsedStock >= 0;
  const exceedsOnHand = stockValid && parsedStock > onHand;

  const nudge = useCallback((delta: number) => {
    setStock((prev) => {
      const n = parseInt(prev, 10);
      const base = isNaN(n) ? 0 : n;
      return String(Math.max(0, base + delta));
    });
  }, []);

  const handleConfirm = useCallback(async () => {
    if (!stockValid) {
      dialog.show({
        variant: 'warning',
        title: 'Invalid Stock',
        message: 'Enter a whole number of units (0 or more) to list online.',
      });
      return;
    }
    const parsedPrice = price.trim().length > 0 ? Number(price) : undefined;
    if (parsedPrice !== undefined && (isNaN(parsedPrice) || parsedPrice < 0)) {
      dialog.show({
        variant: 'warning',
        title: 'Invalid Price',
        message: 'Enter a valid price, or leave it blank to use the in-store price.',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      await updateCatalogListing(
        item.id,
        {
          isAvailable: available,
          stockQuantity: parsedStock,
          ...(parsedPrice !== undefined ? { customPrice: parsedPrice } : {}),
          productName: item.name,
          ...(item.sku !== undefined ? { productBarcode: item.sku } : {}),
        },
        businessId,
      );
      onSuccess?.();
      onClose();
    } catch (err) {
      dialog.show({
        variant: 'error',
        title: 'Update Failed',
        message:
          err instanceof Error
            ? err.message
            : 'Could not update the listing. Please try again.',
      });
    } finally {
      setIsSubmitting(false);
    }
  }, [
    stockValid,
    parsedStock,
    price,
    available,
    item.id,
    item.name,
    item.sku,
    businessId,
    updateCatalogListing,
    dialog,
    onSuccess,
    onClose,
  ]);

  // ── Colors ──────────────────────────────────────────────────────────────────

  const accent = isDark ? '#4F9EFF' : staticTheme.colors.primary[500];
  const sheetBg = isDark ? '#1A1F2E' : theme.colors.surface;
  const inputBg = isDark ? 'rgba(255,255,255,0.04)' : theme.colors.background;
  const inputBorder = isDark ? 'rgba(255,255,255,0.12)' : theme.colors.border;
  const inputText = isDark ? '#FFFFFF' : theme.colors.text;
  const labelColor = isDark ? 'rgba(255,255,255,0.55)' : theme.colors.gray[600];
  const placeholderColor = isDark ? 'rgba(255,255,255,0.25)' : theme.colors.placeholder;
  const handleColor = isDark ? 'rgba(255,255,255,0.15)' : theme.colors.gray[300];
  const mutedText = isDark ? 'rgba(255,255,255,0.45)' : theme.colors.gray[500];
  const warnColor = isDark ? '#FBBF24' : '#B45309';

  const dynStyles = useMemo(
    () =>
      StyleSheet.create({
        sheet: {
          backgroundColor: sheetBg,
          borderTopLeftRadius: 28,
          borderTopRightRadius: 28,
          paddingHorizontal: staticTheme.spacing.md,
          paddingBottom: insets.bottom + staticTheme.spacing.lg,
          borderTopWidth: 1,
          borderLeftWidth: 1,
          borderRightWidth: 1,
          borderColor: isDark ? 'rgba(255,255,255,0.07)' : theme.colors.border,
          ...(isDark
            ? {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: -4 },
                shadowOpacity: 0.4,
                shadowRadius: 20,
                elevation: 20,
              }
            : staticTheme.shadows.xl),
        },
        handle: {
          width: 36,
          height: 4,
          backgroundColor: handleColor,
          borderRadius: 2,
          alignSelf: 'center' as const,
          marginTop: staticTheme.spacing.sm,
          marginBottom: staticTheme.spacing.md,
        },
        nameText: { color: mutedText },
        stepBtn: {
          width: 48,
          height: 48,
          borderRadius: staticTheme.borderRadius.md,
          borderWidth: 1,
          borderColor: inputBorder,
          backgroundColor: inputBg,
          alignItems: 'center' as const,
          justifyContent: 'center' as const,
        },
        stockInput: {
          flex: 1,
          fontSize: 34,
          fontWeight: '700' as const,
          color: inputText,
          textAlign: 'center' as const,
          letterSpacing: -1,
          paddingVertical: staticTheme.spacing.sm,
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
        inputTextStyle: { flex: 1, color: inputText, fontSize: 15 },
        labelText: { color: labelColor, marginBottom: 6 },
        availabilityRow: {
          flexDirection: 'row' as const,
          alignItems: 'center' as const,
          justifyContent: 'space-between' as const,
          borderWidth: 1,
          borderColor: inputBorder,
          borderRadius: staticTheme.borderRadius.md,
          paddingHorizontal: staticTheme.spacing.md,
          paddingVertical: staticTheme.spacing.sm,
          backgroundColor: inputBg,
          minHeight: 52,
        },
        divider: {
          height: 1,
          backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : theme.colors.borderSubtle,
          marginVertical: staticTheme.spacing.md,
        },
        warnRow: {
          flexDirection: 'row' as const,
          alignItems: 'center' as const,
          gap: 6,
          marginTop: 8,
        },
      }),
    [sheetBg, isDark, theme, insets.bottom, handleColor, inputBg, inputBorder, inputText, labelColor, mutedText],
  );

  return (
    <Modal
      visible={visible}
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

            {/* Header */}
            <View style={staticStyles.header}>
              <View style={staticStyles.headerText}>
                <View style={[staticStyles.iconCircle, { backgroundColor: `${accent}18`, borderColor: `${accent}30` }]}>
                  <Store size={18} color={accent} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text variant="h5" weight="bold" style={{ color: isDark ? '#FFFFFF' : theme.colors.text }}>
                    Online Listing
                  </Text>
                  <Text variant="body-sm" style={dynStyles.nameText} numberOfLines={1}>
                    {item.name}
                  </Text>
                </View>
              </View>
              <Pressable onPress={onClose} hitSlop={8} style={staticStyles.closeBtn}>
                <X size={20} color={mutedText} />
              </Pressable>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={staticStyles.scrollContent}
            >
              {/* Availability */}
              <View style={staticStyles.fieldWrap}>
                <Text variant="body-sm" weight="medium" style={dynStyles.labelText}>
                  Available for online ordering
                </Text>
                <View style={dynStyles.availabilityRow}>
                  <Text variant="body" style={{ color: inputText }}>
                    {available ? 'Available' : 'Unavailable'}
                  </Text>
                  <Switch
                    value={available}
                    onValueChange={setAvailable}
                    trackColor={{ false: isDark ? '#374151' : '#E5E7EB', true: accent }}
                    thumbColor="#FFFFFF"
                  />
                </View>
              </View>

              <View style={dynStyles.divider} />

              {/* Online stock allocation */}
              <View style={staticStyles.fieldWrap}>
                <Text variant="body-sm" weight="medium" style={dynStyles.labelText}>
                  Units listed online
                </Text>
                <View style={staticStyles.stockRow}>
                  <Pressable
                    onPress={() => nudge(-1)}
                    style={dynStyles.stepBtn}
                    accessibilityLabel="Deduct one unit"
                  >
                    <Minus size={18} color={inputText} />
                  </Pressable>
                  <TextInput
                    style={dynStyles.stockInput}
                    value={stock}
                    onChangeText={setStock}
                    placeholder="0"
                    placeholderTextColor={placeholderColor}
                    keyboardType="number-pad"
                    returnKeyType="done"
                    accessibilityLabel="Units listed online"
                  />
                  <Pressable
                    onPress={() => nudge(1)}
                    style={dynStyles.stepBtn}
                    accessibilityLabel="Add one unit"
                  >
                    <Plus size={18} color={inputText} />
                  </Pressable>
                </View>
                <Text variant="caption" style={{ color: mutedText, marginTop: 6 }}>
                  On hand: {onHand} {item.unit}
                </Text>
                {exceedsOnHand && (
                  <View style={dynStyles.warnRow}>
                    <AlertTriangle size={14} color={warnColor} />
                    <Text variant="caption" style={{ color: warnColor, flex: 1 }}>
                      Listing more than you have on hand ({onHand} {item.unit}).
                    </Text>
                  </View>
                )}
              </View>

              {/* Price */}
              <View style={staticStyles.fieldWrap}>
                <Text variant="body-sm" weight="medium" style={dynStyles.labelText}>
                  Online price (optional)
                </Text>
                <View style={dynStyles.inputField}>
                  <Tag size={16} color={mutedText} />
                  <TextInput
                    style={dynStyles.inputTextStyle}
                    value={price}
                    onChangeText={setPrice}
                    placeholder={item.price !== undefined ? formatCurrency(item.price) : '0.00'}
                    placeholderTextColor={placeholderColor}
                    keyboardType="decimal-pad"
                    returnKeyType="done"
                    accessibilityLabel="Online price"
                  />
                </View>
                <Text variant="caption" style={{ color: mutedText, marginTop: 6 }}>
                  Leave blank to use the in-store price.
                </Text>
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
                title={isSubmitting ? 'Saving...' : 'Save Listing'}
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

CatalogListingSheet.displayName = 'CatalogListingSheet';

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
  fieldWrap: {
    marginBottom: staticTheme.spacing.md,
  },
  stockRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: staticTheme.spacing.sm,
  },
  actions: {
    flexDirection: 'row',
    gap: staticTheme.spacing.sm,
    paddingTop: staticTheme.spacing.sm,
  },
  cancelBtn: {
    flex: 1,
  },
  confirmBtn: {
    flex: 2,
  },
});
