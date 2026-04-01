/**
 * ScanResultSheet
 *
 * Bottom-anchored modal presented immediately after a barcode scan in the POS
 * screen. Handles two modes:
 *
 * FOUND mode (scanResult.product !== null):
 *   - Shows product details, quantity stepper, Add/Update Cart.
 *
 * NOT FOUND mode (scanResult.product === null):
 *   - Barcode had no inventory match. Shows an inline quick-add form so the
 *     cashier can create the product without leaving the POS screen.
 *   - Required fields: Name, Price, Stock, Unit.
 *   - Tapping "Save & Add to Cart" calls onAddProduct with the form data.
 *
 * Business rules (FOUND):
 *   - Minimum quantity: 1
 *   - Maximum quantity: product.quantity - units already in cart
 *   - "Add to Cart" → "Update Cart" when product already in cart
 *   - Out-of-stock: Add button disabled
 */

import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  View,
  Modal,
  StyleSheet,
  Pressable,
  TextInput,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  X,
  Plus,
  Minus,
  Package,
  Tag,
  AlertCircle,
  CheckCircle,
  ScanBarcode,
  ChevronDown,
} from 'lucide-react-native';
import { Text } from '@/components/atoms/Text';
import { Button } from '@/components/atoms/Button';
import { theme as staticTheme } from '@/core/theme';
import type { ScanResult } from '@/store/pos.store';
import type { StockUnit } from '@/types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatCurrency(value: number): string {
  return `₱${value.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
}

// ─── Dark-mode colour tokens ───────────────────────────────────────────────────

const DARK_ACCENT   = '#4F9EFF';
const DARK_GREEN    = '#3DD68C';
const DARK_AMBER    = '#FFB020';
const DARK_CARD_BG  = '#151A27';
const DARK_SURFACE  = '#1A2035';
const DARK_OVERLAY  = 'rgba(0,0,0,0.72)';

// ─── Quick-add form data ───────────────────────────────────────────────────────

export interface QuickAddData {
  name:     string;
  price:    number;
  stock:    number;
  unit:     StockUnit;
  /** Quantity to add to cart immediately after creation. */
  quantity: number;
}

const UNIT_OPTIONS: StockUnit[] = [
  'pcs', 'kg', 'g', 'L', 'mL', 'box', 'bag', 'bottle',
  'pack', 'dozen', 'roll', 'meter', 'set', 'cup',
];

// ─── Props ────────────────────────────────────────────────────────────────────

export interface ScanResultSheetProps {
  visible:         boolean;
  scanResult:      ScanResult | null;
  /** Units of this product already in the open cart. */
  existingCartQty: number;
  /** Called with the chosen quantity when the user taps "Add to Cart". */
  onConfirm:       (quantity: number) => void;
  /**
   * Called when the cashier fills the quick-add form and taps "Save & Add to Cart".
   * Should create the inventory item and add it to the cart.
   */
  onAddProduct:    (data: QuickAddData) => Promise<void>;
  /** Called when the user cancels or dismisses the sheet. */
  onDismiss:       () => void;
  isDark:          boolean;
}

// ─── Component ────────────────────────────────────────────────────────────────

export const ScanResultSheet: React.FC<ScanResultSheetProps> = ({
  visible,
  scanResult,
  existingCartQty,
  onConfirm,
  onAddProduct,
  onDismiss,
  isDark,
}) => {
  const insets = useSafeAreaInsets();

  // ── Theme tokens ───────────────────────────────────────────────────────────

  const accent       = isDark ? DARK_ACCENT  : staticTheme.colors.primary[500];
  const bgColor      = isDark ? DARK_CARD_BG : '#FFFFFF';
  const surfaceColor = isDark ? DARK_SURFACE  : staticTheme.colors.gray[50];
  const textMain     = isDark ? '#FFFFFF'     : staticTheme.colors.gray[900];
  const textMuted    = isDark ? 'rgba(255,255,255,0.45)' : staticTheme.colors.gray[500];
  const borderColor  = isDark ? 'rgba(255,255,255,0.09)' : staticTheme.colors.gray[200];
  const successColor = isDark ? DARK_GREEN    : staticTheme.colors.success[600];
  const warningColor = isDark ? DARK_AMBER    : staticTheme.colors.warning[600];
  const overlayColor = isDark ? DARK_OVERLAY  : 'rgba(0,0,0,0.5)';
  const inputBg      = isDark ? DARK_SURFACE  : '#FFFFFF';

  // ── Quantity stepper state (FOUND mode) ────────────────────────────────────

  const [quantity, setQuantity] = useState(1);

  useEffect(() => {
    if (scanResult !== null) {
      setQuantity(existingCartQty > 0 ? existingCartQty : 1);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scanResult]);

  // ── Quick-add form state (NOT FOUND mode) ──────────────────────────────────

  const [qaName,       setQaName]       = useState('');
  const [qaPriceText,  setQaPriceText]  = useState('');
  const [qaStockText,  setQaStockText]  = useState('1');
  const [qaQtyText,    setQaQtyText]    = useState('1');
  const [qaUnit,       setQaUnit]       = useState<StockUnit>('pcs');
  const [qaUnitOpen,   setQaUnitOpen]   = useState(false);
  const [qaSubmitting, setQaSubmitting] = useState(false);
  const [qaErrors,     setQaErrors]     = useState<Partial<Record<'name'|'price'|'stock'|'qty', string>>>({});

  // Reset quick-add form whenever the sheet opens in not-found mode.
  useEffect(() => {
    if (scanResult !== null && scanResult.product === null) {
      setQaName('');
      setQaPriceText('');
      setQaStockText('1');
      setQaQtyText('1');
      setQaUnit('pcs');
      setQaErrors({});
      setQaUnitOpen(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  // ── FOUND mode derived values ──────────────────────────────────────────────

  const product = scanResult?.product ?? null;

  const maxQty = useMemo(() => {
    if (product === null) return 0;
    return existingCartQty > 0
      ? product.quantity
      : Math.max(0, product.quantity - existingCartQty);
  }, [product, existingCartQty]);

  const isOutOfStock  = product !== null && product.quantity <= 0;
  const atMax         = quantity >= maxQty;
  const unitPrice     = product?.price ?? 0;
  const lineSubtotal  = unitPrice * quantity;

  const stockLabel = product !== null
    ? isOutOfStock
      ? 'Out of stock'
      : `${product.quantity} ${product.unit} available`
    : '';

  // ── Stepper handlers ───────────────────────────────────────────────────────

  const handleIncrement = useCallback(() => {
    setQuantity((prev) => (prev < maxQty ? prev + 1 : prev));
  }, [maxQty]);

  const handleDecrement = useCallback(() => {
    setQuantity((prev) => Math.max(1, prev - 1));
  }, []);

  // ── FOUND mode confirm ─────────────────────────────────────────────────────

  const handleConfirm = useCallback(() => {
    onConfirm(quantity);
  }, [onConfirm, quantity]);

  // ── Quick-add submit ───────────────────────────────────────────────────────

  const handleQuickAddSubmit = useCallback(async () => {
    const errors: typeof qaErrors = {};
    const name  = qaName.trim();
    const price = parseFloat(qaPriceText);
    const stock = parseInt(qaStockText, 10);
    const qty   = parseInt(qaQtyText,   10);

    if (name === '')        errors['name']  = 'Product name is required';
    if (isNaN(price) || price < 0) errors['price'] = 'Enter a valid price';
    if (isNaN(stock) || stock < 0) errors['stock'] = 'Enter a valid stock quantity';
    if (isNaN(qty)   || qty < 1)   errors['qty']   = 'Quantity must be at least 1';
    if (qty > stock && stock > 0)  errors['qty']   = `Cannot exceed available stock (${stock})`;

    if (Object.keys(errors).length > 0) {
      setQaErrors(errors);
      return;
    }

    setQaErrors({});
    setQaSubmitting(true);
    try {
      await onAddProduct({ name, price, stock, unit: qaUnit, quantity: qty });
    } finally {
      setQaSubmitting(false);
    }
  }, [qaName, qaPriceText, qaStockText, qaQtyText, qaUnit, onAddProduct]);

  // ── Render guard ───────────────────────────────────────────────────────────

  if (scanResult === null && !visible) return null;

  const isNotFound = scanResult !== null && scanResult.product === null;

  // ── Styles ─────────────────────────────────────────────────────────────────

  const sheetStyle = {
    backgroundColor: bgColor,
    paddingBottom: Math.max(insets.bottom, 16),
  };

  const inputStyle = {
    backgroundColor: inputBg,
    borderColor,
    color: textMain,
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onDismiss}
      statusBarTranslucent
    >
      {/* Overlay backdrop */}
      <Pressable
        style={[styles.backdrop, { backgroundColor: overlayColor }]}
        onPress={onDismiss}
      />

      {/* Sheet panel */}
      <View style={[styles.sheet, sheetStyle]}>

          {/* Handle indicator */}
          <View style={[styles.handle, { backgroundColor: borderColor }]} />

          {/* ── Header ──────────────────────────────────────────────────── */}
          <View style={[styles.header, { borderBottomColor: borderColor }]}>
            <View style={styles.headerLeft}>
              <Text variant="h5" weight="bold" style={{ color: textMain }}>
                {isNotFound ? 'Product Not Found' : 'Scanned Product'}
              </Text>
              <Text variant="body-xs" style={{ color: textMuted }}>
                {isNotFound
                  ? `Barcode: ${scanResult?.rawBarcode ?? ''}`
                  : 'Confirm details before adding to cart'}
              </Text>
            </View>
            <Pressable
              onPress={onDismiss}
              hitSlop={12}
              style={[styles.closeBtn, { backgroundColor: surfaceColor }]}
              accessibilityRole="button"
              accessibilityLabel="Dismiss"
            >
              <X size={16} color={textMuted} />
            </Pressable>
          </View>

          {/* ── NOT FOUND: quick-add form ──────────────────────────────── */}
          {isNotFound && (
            <View style={styles.qaScrollContent}>
              {/* Barcode badge */}
              <View
                style={[
                  styles.notFoundBadge,
                  {
                    backgroundColor: `${staticTheme.colors.warning[500]}14`,
                    borderColor:     `${staticTheme.colors.warning[500]}30`,
                  },
                ]}
              >
                <ScanBarcode size={14} color={warningColor} />
                <Text variant="body-xs" weight="medium" style={{ color: warningColor }}>
                  No matching product — fill in details to create it
                </Text>
              </View>

              {/* Name */}
              <View style={styles.fieldGroup}>
                <Text variant="body-sm" weight="medium" style={{ color: textMuted }}>
                  Product Name *
                </Text>
                <TextInput
                  style={[styles.input, inputStyle, qaErrors['name'] !== undefined && styles.inputError]}
                  placeholder="e.g. Bottled Water 500mL"
                  placeholderTextColor={textMuted}
                  value={qaName}
                  onChangeText={(v) => { setQaName(v); setQaErrors(({ name: _n, ...rest }) => rest); }}
                  returnKeyType="next"
                />
                {qaErrors['name'] !== undefined && (
                  <Text variant="body-xs" style={{ color: staticTheme.colors.error[500] }}>
                    {qaErrors['name']}
                  </Text>
                )}
              </View>

              {/* Price + Unit row */}
              <View style={styles.rowFields}>
                <View style={[styles.fieldGroup, { flex: 1 }]}>
                  <Text variant="body-sm" weight="medium" style={{ color: textMuted }}>
                    Selling Price *
                  </Text>
                  <TextInput
                    style={[styles.input, inputStyle, qaErrors['price'] !== undefined && styles.inputError]}
                    placeholder="0.00"
                    placeholderTextColor={textMuted}
                    keyboardType="decimal-pad"
                    value={qaPriceText}
                    onChangeText={(v) => { setQaPriceText(v); setQaErrors(({ price: _p, ...rest }) => rest); }}
                  />
                  {qaErrors['price'] !== undefined && (
                    <Text variant="body-xs" style={{ color: staticTheme.colors.error[500] }}>
                      {qaErrors['price']}
                    </Text>
                  )}
                </View>

                <View style={[styles.fieldGroup, { flex: 1 }]}>
                  <Text variant="body-sm" weight="medium" style={{ color: textMuted }}>
                    Unit *
                  </Text>
                  <Pressable
                    style={[styles.input, styles.unitPicker, inputStyle]}
                    onPress={() => setQaUnitOpen((o) => !o)}
                    accessibilityRole="button"
                    accessibilityLabel={`Unit: ${qaUnit}`}
                  >
                    <Text variant="body-sm" style={{ color: textMain, flex: 1 }}>{qaUnit}</Text>
                    <ChevronDown size={14} color={textMuted} />
                  </Pressable>
                  {qaUnitOpen && (
                    <View
                      style={[
                        styles.unitDropdown,
                        { backgroundColor: bgColor, borderColor },
                      ]}
                    >
                      {UNIT_OPTIONS.map((u) => (
                        <Pressable
                          key={u}
                          style={[
                            styles.unitOption,
                            { borderBottomColor: borderColor },
                            qaUnit === u && { backgroundColor: `${accent}18` },
                          ]}
                          onPress={() => { setQaUnit(u); setQaUnitOpen(false); }}
                        >
                          <Text
                            variant="body-sm"
                            style={{ color: qaUnit === u ? accent : textMain }}
                          >
                            {u}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  )}
                </View>
              </View>

              {/* Stock + Cart Qty row */}
              <View style={styles.rowFields}>
                <View style={[styles.fieldGroup, { flex: 1 }]}>
                  <Text variant="body-sm" weight="medium" style={{ color: textMuted }}>
                    Stock Qty *
                  </Text>
                  <TextInput
                    style={[styles.input, inputStyle, qaErrors['stock'] !== undefined && styles.inputError]}
                    placeholder="0"
                    placeholderTextColor={textMuted}
                    keyboardType="number-pad"
                    value={qaStockText}
                    onChangeText={(v) => { setQaStockText(v); setQaErrors(({ stock: _s, ...rest }) => rest); }}
                  />
                  {qaErrors['stock'] !== undefined && (
                    <Text variant="body-xs" style={{ color: staticTheme.colors.error[500] }}>
                      {qaErrors['stock']}
                    </Text>
                  )}
                </View>

                <View style={[styles.fieldGroup, { flex: 1 }]}>
                  <Text variant="body-sm" weight="medium" style={{ color: textMuted }}>
                    Add to Cart
                  </Text>
                  <TextInput
                    style={[styles.input, inputStyle, qaErrors['qty'] !== undefined && styles.inputError]}
                    placeholder="1"
                    placeholderTextColor={textMuted}
                    keyboardType="number-pad"
                    value={qaQtyText}
                    onChangeText={(v) => { setQaQtyText(v); setQaErrors(({ qty: _q, ...rest }) => rest); }}
                  />
                  {qaErrors['qty'] !== undefined && (
                    <Text variant="body-xs" style={{ color: staticTheme.colors.error[500] }}>
                      {qaErrors['qty']}
                    </Text>
                  )}
                </View>
              </View>

              {/* Actions */}
              <View style={styles.actions}>
                <View style={styles.cancelBtn}>
                  <Button
                    title="Cancel"
                    onPress={onDismiss}
                    variant="outline"
                    size="md"
                    fullWidth
                  />
                </View>
                <View style={styles.confirmBtn}>
                  <Button
                    title={qaSubmitting ? 'Saving…' : 'Save & Add to Cart'}
                    onPress={handleQuickAddSubmit}
                    variant="primary"
                    size="md"
                    fullWidth
                    {...(qaSubmitting ? { disabled: true } : {})}
                  />
                </View>
              </View>
            </View>
          )}

          {/* ── FOUND: product confirmation ────────────────────────────── */}
          {product !== null && (
            <>
              {/* Product card */}
              <View style={[styles.productCard, { backgroundColor: surfaceColor, borderColor }]}>
                <View style={styles.productCardTop}>
                  <View
                    style={[
                      styles.productIcon,
                      { backgroundColor: `${accent}18`, borderColor: `${accent}30` },
                    ]}
                  >
                    <Package size={22} color={accent} />
                  </View>

                  <View style={styles.productMeta}>
                    <Text
                      variant="body"
                      weight="semibold"
                      style={{ color: textMain }}
                      numberOfLines={2}
                    >
                      {product.name}
                    </Text>
                    <View style={styles.categoryRow}>
                      <Tag size={11} color={textMuted} />
                      <Text variant="body-xs" style={{ color: textMuted }}>
                        {product.category}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.priceBlock}>
                    <Text variant="h5" weight="bold" style={{ color: accent }}>
                      {formatCurrency(unitPrice)}
                    </Text>
                    <Text variant="body-xs" style={{ color: textMuted }}>
                      per {product.unit}
                    </Text>
                  </View>
                </View>

                {/* Stock availability badge */}
                <View
                  style={[
                    styles.stockBadge,
                    {
                      backgroundColor: isOutOfStock
                        ? `${staticTheme.colors.error[500]}14`
                        : `${successColor}14`,
                      borderColor: isOutOfStock
                        ? `${staticTheme.colors.error[500]}30`
                        : `${successColor}30`,
                    },
                  ]}
                >
                  {isOutOfStock ? (
                    <AlertCircle size={13} color={staticTheme.colors.error[500]} />
                  ) : (
                    <CheckCircle size={13} color={successColor} />
                  )}
                  <Text
                    variant="body-xs"
                    weight="medium"
                    style={{
                      color: isOutOfStock
                        ? staticTheme.colors.error[500]
                        : successColor,
                    }}
                  >
                    {stockLabel}
                  </Text>
                  {existingCartQty > 0 && (
                    <Text variant="body-xs" style={{ color: warningColor }}>
                      {` · ${existingCartQty} already in cart`}
                    </Text>
                  )}
                </View>
              </View>

              {/* Quantity stepper */}
              {!isOutOfStock && (
                <View style={styles.stepperSection}>
                  <Text variant="body-sm" weight="medium" style={{ color: textMuted }}>
                    Quantity
                  </Text>

                  <View style={styles.stepperRow}>
                    <Pressable
                      onPress={handleDecrement}
                      disabled={quantity <= 1}
                      style={[
                        styles.stepBtn,
                        {
                          backgroundColor: surfaceColor,
                          borderColor,
                          opacity: quantity <= 1 ? 0.4 : 1,
                        },
                      ]}
                      accessibilityRole="button"
                      accessibilityLabel="Decrease quantity"
                    >
                      <Minus size={18} color={textMain} />
                    </Pressable>

                    <View style={[styles.qtyDisplay, { borderColor }]}>
                      <Text variant="h5" weight="bold" style={{ color: textMain }}>
                        {quantity}
                      </Text>
                      <Text variant="body-xs" style={{ color: textMuted }}>
                        {product.unit}
                      </Text>
                    </View>

                    <Pressable
                      onPress={handleIncrement}
                      disabled={atMax}
                      style={[
                        styles.stepBtn,
                        {
                          backgroundColor: surfaceColor,
                          borderColor,
                          opacity: atMax ? 0.4 : 1,
                        },
                      ]}
                      accessibilityRole="button"
                      accessibilityLabel="Increase quantity"
                    >
                      <Plus size={18} color={textMain} />
                    </Pressable>

                    <View style={styles.subtotalBlock}>
                      <Text variant="body-xs" style={{ color: textMuted }}>Subtotal</Text>
                      <Text variant="body" weight="bold" style={{ color: accent }}>
                        {formatCurrency(lineSubtotal)}
                      </Text>
                    </View>
                  </View>

                  {atMax && (
                    <Text variant="body-xs" style={{ color: warningColor, marginTop: 4 }}>
                      Stock limit reached
                    </Text>
                  )}
                </View>
              )}

              {/* Action buttons */}
              <View style={styles.actions}>
                <View style={styles.cancelBtn}>
                  <Button
                    title="Cancel"
                    onPress={onDismiss}
                    variant="outline"
                    size="md"
                    fullWidth
                  />
                </View>
                <View style={styles.confirmBtn}>
                  <Button
                    title={existingCartQty > 0 ? 'Update Cart' : 'Add to Cart'}
                    onPress={handleConfirm}
                    variant="primary"
                    size="md"
                    fullWidth
                    {...(isOutOfStock ? { disabled: true } : {})}
                  />
                </View>
              </View>
            </>
          )}
      </View>
    </Modal>
  );
};

ScanResultSheet.displayName = 'ScanResultSheet';

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },

  sheet: {
    position:     'absolute',
    bottom:       0,
    left:         0,
    right:        0,
    borderTopLeftRadius:  20,
    borderTopRightRadius: 20,
    paddingHorizontal: staticTheme.spacing.md,
    paddingTop:   12,
    gap:          staticTheme.spacing.md,

    // Shadow (iOS)
    shadowColor:   '#000',
    shadowOffset:  { width: 0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius:  12,
    // Elevation (Android)
    elevation: 16,
  },

  handle: {
    width:        40,
    height:       4,
    borderRadius: 2,
    alignSelf:    'center',
    marginBottom: 4,
  },

  // ── Header ─────────────────────────────────────────────────────────────────
  header: {
    flexDirection:     'row',
    alignItems:        'flex-start',
    justifyContent:    'space-between',
    paddingBottom:     staticTheme.spacing.md,
    borderBottomWidth: 1,
  },
  headerLeft: {
    gap:  2,
    flex: 1,
  },
  closeBtn: {
    width:          32,
    height:         32,
    borderRadius:   16,
    alignItems:     'center',
    justifyContent: 'center',
  },

  // ── Not-found badge ─────────────────────────────────────────────────────────
  notFoundBadge: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               8,
    paddingHorizontal: 12,
    paddingVertical:   8,
    borderRadius:      staticTheme.borderRadius.md,
    borderWidth:       1,
  },

  // ── Quick-add form ──────────────────────────────────────────────────────────
  qaScrollContent: {
    gap:          staticTheme.spacing.md,
    paddingBottom: staticTheme.spacing.sm,
  },

  fieldGroup: {
    gap: 6,
  },

  rowFields: {
    flexDirection: 'row',
    gap:           staticTheme.spacing.sm,
  },

  input: {
    height:           44,
    borderRadius:     staticTheme.borderRadius.md,
    borderWidth:      1,
    paddingHorizontal: 12,
    fontSize:         14,
  },

  inputError: {
    borderColor: staticTheme.colors.error[500],
  },

  unitPicker: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
  },

  unitDropdown: {
    position:     'absolute',
    top:          50,
    left:         0,
    right:        0,
    borderWidth:  1,
    borderRadius: staticTheme.borderRadius.md,
    zIndex:       999,
    maxHeight:    180,
    overflow:     'scroll',
  },

  unitOption: {
    paddingHorizontal: 12,
    paddingVertical:   10,
    borderBottomWidth: 1,
  },

  // ── Product card ────────────────────────────────────────────────────────────
  productCard: {
    borderRadius: staticTheme.borderRadius.lg,
    borderWidth:  1,
    padding:      staticTheme.spacing.md,
    gap:          staticTheme.spacing.sm,
  },
  productCardTop: {
    flexDirection: 'row',
    alignItems:    'flex-start',
    gap:           staticTheme.spacing.sm,
  },
  productIcon: {
    width:          44,
    height:         44,
    borderRadius:   12,
    borderWidth:    1,
    alignItems:     'center',
    justifyContent: 'center',
  },
  productMeta: {
    flex: 1,
    gap:  4,
  },
  categoryRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           4,
  },
  priceBlock: {
    alignItems: 'flex-end',
    gap:        2,
  },
  stockBadge: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               6,
    paddingHorizontal: 10,
    paddingVertical:   6,
    borderRadius:      staticTheme.borderRadius.full,
    borderWidth:       1,
    alignSelf:         'flex-start',
  },

  // ── Stepper ─────────────────────────────────────────────────────────────────
  stepperSection: {
    gap: staticTheme.spacing.sm,
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           staticTheme.spacing.sm,
  },
  stepBtn: {
    width:          44,
    height:         44,
    borderRadius:   12,
    borderWidth:    1,
    alignItems:     'center',
    justifyContent: 'center',
  },
  qtyDisplay: {
    minWidth:       72,
    height:         44,
    borderRadius:   12,
    borderWidth:    1,
    alignItems:     'center',
    justifyContent: 'center',
    gap:            1,
  },
  subtotalBlock: {
    flex:       1,
    alignItems: 'flex-end',
    gap:        2,
  },

  // ── Actions ─────────────────────────────────────────────────────────────────
  actions: {
    flexDirection: 'row',
    gap:           staticTheme.spacing.sm,
    paddingTop:    staticTheme.spacing.xs,
  },
  cancelBtn: {
    flex: 1,
  },
  confirmBtn: {
    flex: 2,
  },
});
