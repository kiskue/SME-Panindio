/**
 * POSScreen
 *
 * Point-of-Sale interface for SME Panindio.
 * Tablet: split view — Products Grid (left 60%) + Cart Panel (right 40%).
 * Phone:  stacked — Products Grid (scrollable top) + sticky Cart footer.
 *
 * Data flows: InventoryStore (products) → usePosStore (cart) → CheckoutBottomSheet.
 * All cart and checkout state is owned by usePosStore (pos.store.ts).
 *
 * TypeScript constraints honoured:
 *   - exactOptionalPropertyTypes: no `prop: undefined`, use conditional spread
 *   - noUncheckedIndexedAccess: all array/object access uses `?? fallback`
 *   - noUnusedLocals: unused vars prefixed with `_`
 */

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  View,
  FlatList,
  StyleSheet,
  Pressable,
  ScrollView,
  TextInput,
  Animated,
  Dimensions,
  Platform,
  ActivityIndicator,
} from 'react-native';
import {
  BottomSheetModal,
  BottomSheetScrollView,
  BottomSheetBackdrop,
  type BottomSheetBackdropProps,
  type BottomSheetModalRef,
} from '@gorhom/bottom-sheet';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ShoppingCart,
  Search,
  X,
  Plus,
  Minus,
  Trash2,
  CreditCard,
  Smartphone,
  Wallet,
  Banknote,
  CheckCircle,
  Package,
  ChevronUp,
  ChevronDown,
  Receipt,
  Tag,
  StickyNote,
  AlertCircle,
  Users,
  ChevronRight,
} from 'lucide-react-native';
import { Text } from '@/components/atoms/Text';
import {
  useInventoryStore,
  selectProducts,
  useThemeStore,
  selectThemeMode,
  usePosStore,
  selectCartItems,
  selectCartTotal,
  selectCartCount,
  useCreditStore,
  selectCreditCustomers,
} from '@/store';
import { useShallow } from 'zustand/react/shallow';
import { useAppTheme } from '@/core/theme';
import { theme as staticTheme } from '@/core/theme';
import type { InventoryItem, CartItem, PaymentMethod, CreditCustomer } from '@/types';

// ─── Local checkout payload type ─────────────────────────────────────────────

interface CheckoutPayload {
  paymentMethod:    PaymentMethod;
  amountTendered?:  number;
  notes?:           string;
  /** Present when paymentMethod === 'credit'. */
  creditCustomerId?: string;
}

// ─── Color tokens (dark/light) ────────────────────────────────────────────────

const DARK_ACCENT  = '#4F9EFF';
const DARK_GREEN   = '#3DD68C';
const DARK_AMBER   = '#FFB020';
const DARK_RED     = '#FF6B6B';
const DARK_CARD_BG = '#151A27';
const DARK_ROOT_BG = '#0F0F14';

// ─── Payment methods ──────────────────────────────────────────────────────────

interface PaymentOption {
  id:    PaymentMethod;
  label: string;
  icon:  React.ReactNode;
  color: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatCurrency(value: number): string {
  return `₱${value.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
}

function generateOrderNumber(): string {
  const ts  = Date.now().toString(36).toUpperCase();
  const rnd = Math.random().toString(36).slice(2, 5).toUpperCase();
  return `${ts}-${rnd}`;
}

// ─── Product tile accent colors by category / price tier ──────────────────────

function productAccentColor(product: InventoryItem, isDark: boolean): string {
  const price = product.price ?? 0;
  if (isDark) {
    if (price >= 500) return '#A78BFA'; // purple — premium
    if (price >= 100) return DARK_ACCENT; // blue — mid-range
    return DARK_GREEN; // green — budget
  }
  if (price >= 500) return staticTheme.colors.secondary[500];
  if (price >= 100) return staticTheme.colors.primary[500];
  return staticTheme.colors.success[500];
}

// ─── Screen dimension hook ────────────────────────────────────────────────────

function useIsTablet(): boolean {
  const { width } = Dimensions.get('window');
  return width >= 768;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

/**
 * Animated product tile — scales on tap to give haptic-like feedback.
 */
const ProductTile = React.memo<{
  product:  InventoryItem;
  isDark:   boolean;
  onAdd:    (product: InventoryItem) => void;
  onReduce: (productId: string, newQty: number) => void;
  inCart:   boolean;
  cartQty:  number;
}>(({ product, isDark, onAdd, onReduce, inCart, cartQty }) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const accent    = productAccentColor(product, isDark);
  const isOutOfStock = product.quantity <= 0 || cartQty >= product.quantity;

  const cardBg   = isDark ? DARK_CARD_BG : '#FFFFFF';
  const border   = isDark ? 'rgba(255,255,255,0.07)' : staticTheme.colors.border;
  const textMain = isDark ? '#FFFFFF' : staticTheme.colors.gray[900];

  const handleAdd = useCallback(() => {
    if (isOutOfStock) return;
    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 0.94, duration: 80, useNativeDriver: true }),
      Animated.timing(scaleAnim, { toValue: 1,    duration: 120, useNativeDriver: true }),
    ]).start();
    onAdd(product);
  }, [isOutOfStock, onAdd, product, scaleAnim]);

  const handleReduce = useCallback(() => {
    // Pass cartQty - 1; store treats qty <= 0 as removeFromCart
    onReduce(product.id, cartQty - 1);
  }, [onReduce, product.id, cartQty]);

  return (
    <Pressable
      onPress={handleAdd}
      accessibilityRole="button"
      accessibilityLabel={`Add ${product.name} to cart`}
      accessibilityState={{ disabled: isOutOfStock }}
    >
      <Animated.View
        style={[
          tileStyles.card,
          {
            backgroundColor: cardBg,
            borderColor:     inCart ? `${accent}50` : border,
            transform:       [{ scale: scaleAnim }],
            opacity:         isOutOfStock ? 0.6 : 1,
          },
        ]}
      >
        {/* Left accent bar */}
        <View style={[tileStyles.accentBar, { backgroundColor: accent }]} />

        <View style={tileStyles.content}>
          {/* Icon */}
          <View style={[tileStyles.iconWrap, { backgroundColor: `${accent}18` }]}>
            <Package size={22} color={accent} />
          </View>

          {/* Product info */}
          <Text
            variant="body-sm"
            weight="semibold"
            numberOfLines={2}
            style={{ color: textMain, marginTop: 6 }}
          >
            {product.name}
          </Text>

          <Text
            variant="h5"
            weight="bold"
            numberOfLines={1}
            style={{ color: accent, marginTop: 4 }}
          >
            {formatCurrency(product.price ?? 0)}
          </Text>

          {/* Stock badge */}
          <View style={[
            tileStyles.stockBadge,
            {
              backgroundColor: isOutOfStock
                ? (isDark ? 'rgba(255,107,107,0.12)' : staticTheme.colors.error[50])
                : (isDark ? `${DARK_GREEN}12` : staticTheme.colors.success[50]),
            },
          ]}>
            <Text
              variant="body-xs"
              weight="medium"
              style={{
                color: isOutOfStock
                  ? (isDark ? DARK_RED : staticTheme.colors.error[500])
                  : (isDark ? DARK_GREEN : staticTheme.colors.success[500]),
              }}
            >
              {isOutOfStock ? 'Out of Stock' : `${product.quantity} ${product.unit}`}
            </Text>
          </View>

          {/* Inline stepper — only shown when product is in cart */}
          {inCart && (
            <View style={[tileStyles.stepper, { backgroundColor: `${accent}15`, borderColor: `${accent}30` }]}>
              <Pressable
                onPress={(e) => { e.stopPropagation(); handleReduce(); }}
                style={[tileStyles.stepBtn, { backgroundColor: `${accent}20` }]}
                hitSlop={6}
                accessibilityRole="button"
                accessibilityLabel="Remove one"
              >
                <Minus size={12} color={accent} />
              </Pressable>

              <Text variant="body-sm" weight="bold" style={{ color: accent, minWidth: 18, textAlign: 'center' }}>
                {cartQty}
              </Text>

              <Pressable
                onPress={(e) => { e.stopPropagation(); handleAdd(); }}
                disabled={isOutOfStock}
                style={[tileStyles.stepBtn, { backgroundColor: `${accent}20`, opacity: isOutOfStock ? 0.35 : 1 }]}
                hitSlop={6}
                accessibilityRole="button"
                accessibilityLabel="Add one more"
                accessibilityState={{ disabled: isOutOfStock }}
              >
                <Plus size={12} color={accent} />
              </Pressable>
            </View>
          )}
        </View>

        {/* Out-of-stock overlay — only when not in cart so stepper stays tappable */}
        {isOutOfStock && !inCart && (
          <View style={tileStyles.outOfStockOverlay}>
            <Text variant="body-xs" weight="bold" style={{ color: isDark ? DARK_RED : staticTheme.colors.error[500] }}>
              UNAVAILABLE
            </Text>
          </View>
        )}
      </Animated.View>
    </Pressable>
  );
});
ProductTile.displayName = 'ProductTile';

const tileStyles = StyleSheet.create({
  card: {
    borderRadius: staticTheme.borderRadius.xl,
    borderWidth:  1,
    overflow:     'hidden',
    position:     'relative',
  },
  accentBar: {
    position: 'absolute',
    left:     0,
    top:      0,
    bottom:   0,
    width:    3,
    borderTopLeftRadius:    staticTheme.borderRadius.xl,
    borderBottomLeftRadius: staticTheme.borderRadius.xl,
  },
  content: {
    padding:    12,
    paddingLeft: 16,
  },
  iconWrap: {
    width:         40,
    height:        40,
    borderRadius:  10,
    alignItems:    'center',
    justifyContent: 'center',
  },
  stockBadge: {
    alignSelf:    'flex-start',
    marginTop:    6,
    paddingHorizontal: 8,
    paddingVertical:   3,
    borderRadius: staticTheme.borderRadius.full,
  },
  stepper: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
    marginTop:      8,
    borderRadius:   staticTheme.borderRadius.full,
    borderWidth:    1,
    paddingHorizontal: 4,
    paddingVertical:   4,
    gap:            4,
  },
  stepBtn: {
    width:          24,
    height:         24,
    borderRadius:   12,
    alignItems:     'center',
    justifyContent: 'center',
  },
  outOfStockOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.08)',
    alignItems:      'center',
    justifyContent:  'center',
  },
});

// ─── Cart item row ─────────────────────────────────────────────────────────────

const CartRow = React.memo<{
  item:    CartItem;
  isDark:  boolean;
  accent:  string;
  onRemove: (id: string) => void;
  onQtyChange: (id: string, qty: number) => void;
}>(({ item, isDark, accent, onRemove, onQtyChange }) => {
  const textMain  = isDark ? '#FFFFFF' : staticTheme.colors.gray[900];
  const textMuted = isDark ? 'rgba(255,255,255,0.45)' : staticTheme.colors.gray[500];
  const borderClr = isDark ? 'rgba(255,255,255,0.10)' : staticTheme.colors.gray[200];
  const stepperBg = isDark ? 'rgba(255,255,255,0.07)' : staticTheme.colors.gray[100];

  return (
    <View style={[cartRowStyles.row, { borderBottomColor: borderClr }]}>
      {/* Product accent dot */}
      <View style={[cartRowStyles.dot, { backgroundColor: productAccentColor(item.product, isDark) }]} />

      {/* Name + unit price */}
      <View style={cartRowStyles.info}>
        <Text variant="body-sm" weight="semibold" numberOfLines={1} style={{ color: textMain }}>
          {item.product.name}
        </Text>
        <Text variant="body-xs" style={{ color: textMuted }}>
          {formatCurrency(item.product.price ?? 0)} / {item.product.unit}
        </Text>
      </View>

      {/* Qty stepper */}
      <View style={[cartRowStyles.stepper, { backgroundColor: stepperBg }]}>
        <Pressable
          style={cartRowStyles.stepBtn}
          onPress={() => onQtyChange(item.product.id, item.quantity - 1)}
          accessibilityRole="button"
          accessibilityLabel="Decrease quantity"
          hitSlop={4}
        >
          <Minus size={12} color={accent} />
        </Pressable>
        <Text variant="body-sm" weight="bold" style={{ color: textMain, minWidth: 20, textAlign: 'center' }}>
          {item.quantity}
        </Text>
        <Pressable
          style={cartRowStyles.stepBtn}
          onPress={() => onQtyChange(item.product.id, item.quantity + 1)}
          accessibilityRole="button"
          accessibilityLabel="Increase quantity"
          hitSlop={4}
        >
          <Plus size={12} color={accent} />
        </Pressable>
      </View>

      {/* Line subtotal */}
      <Text variant="body-sm" weight="bold" style={{ color: accent, minWidth: 70, textAlign: 'right' }}>
        {formatCurrency(item.subtotal)}
      </Text>

      {/* Remove */}
      <Pressable
        onPress={() => onRemove(item.product.id)}
        style={cartRowStyles.trashBtn}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={`Remove ${item.product.name}`}
      >
        <Trash2 size={14} color={isDark ? DARK_RED : staticTheme.colors.error[400]} />
      </Pressable>
    </View>
  );
});
CartRow.displayName = 'CartRow';

const cartRowStyles = StyleSheet.create({
  row: {
    flexDirection:  'row',
    alignItems:     'center',
    paddingVertical: 10,
    paddingHorizontal: staticTheme.spacing.md,
    borderBottomWidth: 1,
    gap: 8,
  },
  dot: {
    width:        4,
    height:       36,
    borderRadius: 2,
    flexShrink:   0,
  },
  info: {
    flex: 1,
    gap:  2,
  },
  stepper: {
    flexDirection:  'row',
    alignItems:     'center',
    borderRadius:   staticTheme.borderRadius.full,
    paddingHorizontal: 4,
    paddingVertical:   2,
    gap:            2,
    flexShrink:     0,
  },
  stepBtn: {
    width:          28,
    height:         28,
    alignItems:     'center',
    justifyContent: 'center',
  },
  trashBtn: {
    width:          32,
    height:         32,
    alignItems:     'center',
    justifyContent: 'center',
    flexShrink:     0,
  },
});

// ─── Checkout bottom sheet ─────────────────────────────────────────────────────

interface CheckoutSheetProps {
  visible:         boolean;
  onClose:         () => void;
  cartItems:       CartItem[];
  cartTotal:       number;
  cartCount:       number;
  onConfirm:       (payload: CheckoutPayload) => Promise<void>;
  isDark:          boolean;
  orderNumber:     string;
  creditCustomers: CreditCustomer[];
}

const PAYMENT_OPTIONS_DARK: PaymentOption[] = [
  { id: 'cash',   label: 'Cash',   icon: <Banknote   size={18} color="#3DD68C" />, color: '#3DD68C' },
  { id: 'gcash',  label: 'GCash',  icon: <Smartphone size={18} color="#4F9EFF" />, color: '#4F9EFF' },
  { id: 'maya',   label: 'Maya',   icon: <Wallet     size={18} color="#A78BFA" />, color: '#A78BFA' },
  { id: 'card',   label: 'Card',   icon: <CreditCard size={18} color="#FFB020" />, color: '#FFB020' },
  { id: 'credit', label: 'Utang',  icon: <Users      size={18} color="#FF6B6B" />, color: '#FF6B6B' },
];

const PAYMENT_OPTIONS_LIGHT: PaymentOption[] = [
  { id: 'cash',   label: 'Cash',   icon: <Banknote   size={18} color={staticTheme.colors.success[500]}   />, color: staticTheme.colors.success[500]   },
  { id: 'gcash',  label: 'GCash',  icon: <Smartphone size={18} color={staticTheme.colors.primary[500]}   />, color: staticTheme.colors.primary[500]   },
  { id: 'maya',   label: 'Maya',   icon: <Wallet     size={18} color={staticTheme.colors.secondary[500]} />, color: staticTheme.colors.secondary[500] },
  { id: 'card',   label: 'Card',   icon: <CreditCard size={18} color={staticTheme.colors.highlight[400]} />, color: staticTheme.colors.highlight[400] },
  { id: 'credit', label: 'Utang',  icon: <Users      size={18} color={staticTheme.colors.error[500]}     />, color: staticTheme.colors.error[500]     },
];

const CheckoutSheet = React.memo<CheckoutSheetProps>(({
  visible, onClose, cartItems, cartTotal, cartCount, onConfirm, isDark, orderNumber,
  creditCustomers,
}) => {
  const modalRef = useRef<BottomSheetModalRef>(null);
  const insets   = useSafeAreaInsets();

  const [method,             setMethod]             = useState<PaymentMethod>('cash');
  const [tendered,           setTendered]           = useState('');
  const [notes,              setNotes]              = useState('');
  const [confirming,         setConfirming]         = useState(false);
  const [confirmed,          setConfirmed]          = useState(false);
  const [discountPct,        setDiscountPct]        = useState(0);
  const [showDiscount,       setShowDiscount]       = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [showCustomerPicker, setShowCustomerPicker] = useState(false);
  const [customerSearch,     setCustomerSearch]     = useState('');

  useEffect(() => {
    if (visible) {
      setConfirmed(false);
      setTendered('');
      setNotes('');
      setDiscountPct(0);
      setShowDiscount(false);
      setSelectedCustomerId(null);
      setShowCustomerPicker(false);
      setCustomerSearch('');
      modalRef.current?.present();
    } else {
      modalRef.current?.dismiss();
    }
  }, [visible]);

  const paymentOptions = isDark ? PAYMENT_OPTIONS_DARK : PAYMENT_OPTIONS_LIGHT;

  const discountAmount = cartTotal * (discountPct / 100);
  const finalTotal     = Math.max(0, cartTotal - discountAmount);
  const tenderedNum    = parseFloat(tendered) || 0;
  const change         = method === 'cash' ? Math.max(0, tenderedNum - finalTotal) : 0;
  const canConfirm     = method === 'cash'
    ? tenderedNum >= finalTotal
    : method === 'credit'
      ? selectedCustomerId !== null
      : true;

  const selectedCustomer = creditCustomers.find((c) => c.id === selectedCustomerId) ?? null;
  const filteredCustomers = customerSearch.trim() === ''
    ? creditCustomers
    : creditCustomers.filter((c) =>
        c.name.toLowerCase().includes(customerSearch.toLowerCase()),
      );

  const bgColor      = isDark ? '#0D1117' : '#FFFFFF';
  const surfaceColor = isDark ? DARK_CARD_BG : '#F8F9FA';
  const textMain     = isDark ? '#FFFFFF' : staticTheme.colors.gray[900];
  const textMuted    = isDark ? 'rgba(255,255,255,0.45)' : staticTheme.colors.gray[500];
  const borderColor  = isDark ? 'rgba(255,255,255,0.09)' : staticTheme.colors.gray[200];
  const inputBg      = isDark ? '#1E2435' : '#F8F9FC';
  const inputBorder  = isDark ? 'rgba(255,255,255,0.12)' : '#E2E8F0';
  const accent       = isDark ? DARK_ACCENT : staticTheme.colors.primary[500];

  const handleConfirm = useCallback(async () => {
    if (!canConfirm || confirming) return;
    setConfirming(true);
    try {
      const trimmedNotes = notes.trim();
      const payload: CheckoutPayload = {
        paymentMethod: method,
        ...(trimmedNotes !== '' ? { notes: trimmedNotes } : {}),
        ...(method === 'cash' && tendered !== '' ? { amountTendered: tenderedNum } : {}),
        ...(method === 'credit' && selectedCustomerId !== null
          ? { creditCustomerId: selectedCustomerId }
          : {}),
      };
      await onConfirm(payload);
      setConfirmed(true);
      setTimeout(() => {
        onClose();
      }, 1400);
    } finally {
      setConfirming(false);
    }
  }, [canConfirm, confirming, method, notes, tendered, tenderedNum, selectedCustomerId, onConfirm, onClose]);

  const renderBackdrop = useCallback(
    (backdropProps: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop
        {...backdropProps}
        appearsOnIndex={0}
        disappearsOnIndex={-1}
        pressBehavior="close"
        opacity={0.55}
      />
    ),
    [],
  );

  const snapPoints = useMemo(() => ['88%'], []);

  const handleIndicatorStyle = useMemo(
    () => ({ backgroundColor: borderColor, width: 40, height: 4 }),
    [borderColor],
  );

  const backgroundStyle = useMemo(
    () => ({ backgroundColor: bgColor }),
    [bgColor],
  );

  return (
    <BottomSheetModal
      ref={modalRef}
      snapPoints={snapPoints}
      onDismiss={onClose}
      backdropComponent={renderBackdrop}
      handleIndicatorStyle={handleIndicatorStyle}
      backgroundStyle={backgroundStyle}
      enablePanDownToClose
      keyboardBehavior="interactive"
      keyboardBlurBehavior="restore"
      android_keyboardInputMode="adjustResize"
    >
      {/* Header */}
      <View style={[sheetStyles.sheetHeader, { borderBottomColor: borderColor }]}>
        <View>
          <Text variant="h5" weight="bold" style={{ color: textMain }}>
            Checkout
          </Text>
          <Text variant="body-xs" style={{ color: textMuted }}>
            Order #{orderNumber} · {cartCount} item{cartCount !== 1 ? 's' : ''}
          </Text>
        </View>
        <Pressable
          onPress={onClose}
          hitSlop={12}
          style={[sheetStyles.closeBtn, { backgroundColor: surfaceColor }]}
          accessibilityRole="button"
          accessibilityLabel="Close checkout"
        >
          <X size={16} color={textMuted} />
        </Pressable>
      </View>

      <BottomSheetScrollView
        style={sheetStyles.sheetScroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
            {/* Order summary chips */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={sheetStyles.summaryRow}
            >
              {cartItems.slice(0, 4).map((ci) => (
                <View
                  key={ci.product.id}
                  style={[sheetStyles.summaryChip, { backgroundColor: surfaceColor, borderColor }]}
                >
                  <Text variant="body-xs" weight="medium" style={{ color: textMain }} numberOfLines={1}>
                    {ci.quantity}× {ci.product.name}
                  </Text>
                </View>
              ))}
              {cartItems.length > 4 && (
                <View style={[sheetStyles.summaryChip, { backgroundColor: surfaceColor, borderColor }]}>
                  <Text variant="body-xs" style={{ color: textMuted }}>
                    +{cartItems.length - 4} more
                  </Text>
                </View>
              )}
            </ScrollView>

            {/* Payment method */}
            <View style={sheetStyles.section}>
              <View style={sheetStyles.sectionLabel}>
                <CreditCard size={14} color={accent} />
                <Text variant="body-sm" weight="semibold" style={{ color: textMain }}>
                  Payment Method
                </Text>
              </View>
              <View style={sheetStyles.paymentGrid}>
                {paymentOptions.map((opt) => {
                  const isSelected = method === opt.id;
                  return (
                    <Pressable
                      key={opt.id}
                      style={[
                        sheetStyles.paymentChip,
                        {
                          backgroundColor: isSelected ? `${opt.color}18` : surfaceColor,
                          borderColor:     isSelected ? `${opt.color}60` : borderColor,
                        },
                      ]}
                      onPress={() => setMethod(opt.id)}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: isSelected }}
                    >
                      {opt.icon}
                      <Text
                        variant="body-sm"
                        weight={isSelected ? 'semibold' : 'normal'}
                        style={{ color: isSelected ? opt.color : textMuted }}
                      >
                        {opt.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {/* Credit customer picker — shown when Credit (Utang) is selected */}
            {method === 'credit' && (
              <View style={sheetStyles.section}>
                <View style={sheetStyles.sectionLabel}>
                  <Users size={14} color={isDark ? '#FF6B6B' : staticTheme.colors.error[500]} />
                  <Text variant="body-sm" weight="semibold" style={{ color: textMain }}>
                    Charge to Customer
                  </Text>
                </View>

                {/* Customer selector button */}
                <Pressable
                  style={[
                    sheetStyles.customerSelectorBtn,
                    {
                      backgroundColor: inputBg,
                      borderColor:     selectedCustomer !== null
                        ? (isDark ? '#FF6B6B60' : `${staticTheme.colors.error[400]}60`)
                        : inputBorder,
                    },
                  ]}
                  onPress={() => setShowCustomerPicker((p) => !p)}
                  accessibilityRole="button"
                  accessibilityLabel="Select credit customer"
                >
                  <Users size={16} color={isDark ? '#FF6B6B' : staticTheme.colors.error[500]} />
                  <Text
                    variant="body-sm"
                    weight={selectedCustomer !== null ? 'semibold' : 'normal'}
                    style={{
                      flex:  1,
                      color: selectedCustomer !== null
                        ? textMain
                        : (isDark ? 'rgba(255,255,255,0.35)' : staticTheme.colors.gray[400]),
                    }}
                    numberOfLines={1}
                  >
                    {selectedCustomer !== null ? selectedCustomer.name : 'Select customer...'}
                  </Text>
                  <ChevronRight size={14} color={textMuted} />
                </Pressable>

                {/* Inline customer list — shown when picker is open */}
                {showCustomerPicker && (
                  <View style={[
                    sheetStyles.customerPickerPanel,
                    { backgroundColor: surfaceColor, borderColor },
                  ]}>
                    {/* Search within customer list */}
                    <View style={[
                      sheetStyles.customerSearchWrap,
                      { backgroundColor: inputBg, borderColor: inputBorder },
                    ]}>
                      <Search size={13} color={textMuted} />
                      <TextInput
                        style={[sheetStyles.customerSearchInput, { color: textMain }]}
                        value={customerSearch}
                        onChangeText={setCustomerSearch}
                        placeholder="Search customers..."
                        placeholderTextColor={isDark ? 'rgba(255,255,255,0.28)' : staticTheme.colors.gray[400]}
                        accessibilityLabel="Search credit customers"
                      />
                    </View>

                    {filteredCustomers.length === 0 ? (
                      <Text
                        variant="body-xs"
                        align="center"
                        style={{
                          color:   textMuted,
                          padding: staticTheme.spacing.sm,
                        }}
                      >
                        {creditCustomers.length === 0
                          ? 'No credit customers registered yet'
                          : 'No customers match your search'}
                      </Text>
                    ) : (
                      filteredCustomers.map((c) => {
                        const isSelected = c.id === selectedCustomerId;
                        return (
                          <Pressable
                            key={c.id}
                            style={[
                              sheetStyles.customerRow,
                              {
                                backgroundColor: isSelected
                                  ? (isDark ? 'rgba(255,107,107,0.12)' : staticTheme.colors.error[50])
                                  : 'transparent',
                                borderBottomColor: borderColor,
                              },
                            ]}
                            onPress={() => {
                              setSelectedCustomerId(c.id);
                              setShowCustomerPicker(false);
                              setCustomerSearch('');
                            }}
                            accessibilityRole="radio"
                            accessibilityState={{ checked: isSelected }}
                          >
                            <View style={[
                              sheetStyles.customerAvatar,
                              {
                                backgroundColor: isSelected
                                  ? (isDark ? 'rgba(255,107,107,0.25)' : staticTheme.colors.error[100])
                                  : (isDark ? 'rgba(255,255,255,0.08)' : staticTheme.colors.gray[100]),
                              },
                            ]}>
                              <Text
                                variant="body-xs"
                                weight="bold"
                                style={{
                                  color: isSelected
                                    ? (isDark ? '#FF6B6B' : staticTheme.colors.error[600])
                                    : textMuted,
                                }}
                              >
                                {c.name.charAt(0).toUpperCase()}
                              </Text>
                            </View>
                            <View style={{ flex: 1 }}>
                              <Text
                                variant="body-sm"
                                weight={isSelected ? 'semibold' : 'normal'}
                                numberOfLines={1}
                                style={{
                                  color: isSelected
                                    ? (isDark ? '#FF6B6B' : staticTheme.colors.error[600])
                                    : textMain,
                                }}
                              >
                                {c.name}
                              </Text>
                              {c.phone !== undefined && (
                                <Text variant="body-xs" style={{ color: textMuted }} numberOfLines={1}>
                                  {c.phone}
                                </Text>
                              )}
                            </View>
                            {isSelected && (
                              <CheckCircle size={16} color={isDark ? '#FF6B6B' : staticTheme.colors.error[500]} />
                            )}
                          </Pressable>
                        );
                      })
                    )}
                  </View>
                )}

                {/* Validation hint — shown when credit is selected but no customer chosen */}
                {selectedCustomer === null && (
                  <View style={[sheetStyles.changePill, {
                    backgroundColor: isDark ? 'rgba(255,107,107,0.10)' : staticTheme.colors.error[50],
                    borderColor:     isDark ? 'rgba(255,107,107,0.30)' : staticTheme.colors.error[200],
                  }]}>
                    <AlertCircle size={13} color={isDark ? '#FF6B6B' : staticTheme.colors.error[500]} />
                    <Text variant="body-xs" style={{ color: isDark ? '#FF6B6B' : staticTheme.colors.error[500] }}>
                      Select a customer to charge this sale
                    </Text>
                  </View>
                )}
              </View>
            )}

            {/* Cash tendered */}
            {method === 'cash' && (
              <View style={sheetStyles.section}>
                <View style={sheetStyles.sectionLabel}>
                  <Banknote size={14} color={isDark ? DARK_GREEN : staticTheme.colors.success[500]} />
                  <Text variant="body-sm" weight="semibold" style={{ color: textMain }}>
                    Amount Tendered
                  </Text>
                </View>
                <TextInput
                  style={[
                    sheetStyles.tenderedInput,
                    {
                      backgroundColor: inputBg,
                      borderColor:     inputBorder,
                      color:           textMain,
                    },
                  ]}
                  value={tendered}
                  onChangeText={setTendered}
                  keyboardType="decimal-pad"
                  placeholder={`Min. ${formatCurrency(finalTotal)}`}
                  placeholderTextColor={isDark ? 'rgba(255,255,255,0.30)' : staticTheme.colors.gray[400]}
                  accessibilityLabel="Amount tendered"
                />
                {tenderedNum >= finalTotal && tenderedNum > 0 && (
                  <View style={[sheetStyles.changePill, {
                    backgroundColor: isDark ? `${DARK_GREEN}14` : staticTheme.colors.success[50],
                    borderColor:     isDark ? `${DARK_GREEN}35` : staticTheme.colors.success[200],
                  }]}>
                    <Text variant="body-sm" weight="bold" style={{ color: isDark ? DARK_GREEN : staticTheme.colors.success[600] }}>
                      Change: {formatCurrency(change)}
                    </Text>
                  </View>
                )}
                {method === 'cash' && tenderedNum > 0 && tenderedNum < finalTotal && (
                  <View style={[sheetStyles.changePill, {
                    backgroundColor: isDark ? `${DARK_RED}14` : staticTheme.colors.error[50],
                    borderColor:     isDark ? `${DARK_RED}35` : staticTheme.colors.error[200],
                  }]}>
                    <AlertCircle size={13} color={isDark ? DARK_RED : staticTheme.colors.error[500]} />
                    <Text variant="body-xs" style={{ color: isDark ? DARK_RED : staticTheme.colors.error[500] }}>
                      Short by {formatCurrency(finalTotal - tenderedNum)}
                    </Text>
                  </View>
                )}
              </View>
            )}

            {/* Discount */}
            <View style={sheetStyles.section}>
              <Pressable
                style={sheetStyles.sectionLabel}
                onPress={() => setShowDiscount((p) => !p)}
                accessibilityRole="button"
              >
                <Tag size={14} color={isDark ? DARK_AMBER : staticTheme.colors.warning[500]} />
                <Text variant="body-sm" weight="semibold" style={{ color: textMain, flex: 1 }}>
                  Discount
                </Text>
                {discountPct > 0 && (
                  <View style={[sheetStyles.discountBadge, {
                    backgroundColor: isDark ? `${DARK_AMBER}18` : staticTheme.colors.warning[50],
                  }]}>
                    <Text variant="body-xs" weight="bold" style={{ color: isDark ? DARK_AMBER : staticTheme.colors.warning[600] }}>
                      -{discountPct}%
                    </Text>
                  </View>
                )}
                {showDiscount
                  ? <ChevronUp   size={14} color={textMuted} />
                  : <ChevronDown size={14} color={textMuted} />
                }
              </Pressable>
              {showDiscount && (
                <View style={sheetStyles.discountRow}>
                  {[0, 5, 10, 15, 20].map((pct) => (
                    <Pressable
                      key={pct}
                      style={[
                        sheetStyles.discountChip,
                        {
                          backgroundColor: discountPct === pct
                            ? (isDark ? `${DARK_AMBER}20` : staticTheme.colors.warning[50])
                            : surfaceColor,
                          borderColor: discountPct === pct
                            ? (isDark ? `${DARK_AMBER}50` : staticTheme.colors.warning[400])
                            : borderColor,
                        },
                      ]}
                      onPress={() => setDiscountPct(pct)}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: discountPct === pct }}
                    >
                      <Text
                        variant="body-sm"
                        weight={discountPct === pct ? 'bold' : 'normal'}
                        style={{
                          color: discountPct === pct
                            ? (isDark ? DARK_AMBER : staticTheme.colors.warning[600])
                            : textMuted,
                        }}
                      >
                        {pct === 0 ? 'None' : `-${pct}%`}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              )}
            </View>

            {/* Notes */}
            <View style={sheetStyles.section}>
              <View style={sheetStyles.sectionLabel}>
                <StickyNote size={14} color={textMuted} />
                <Text variant="body-sm" weight="semibold" style={{ color: textMain }}>
                  Order Notes
                </Text>
              </View>
              <TextInput
                style={[
                  sheetStyles.notesInput,
                  {
                    backgroundColor: inputBg,
                    borderColor:     inputBorder,
                    color:           textMain,
                  },
                ]}
                value={notes}
                onChangeText={setNotes}
                placeholder="Optional notes for this order..."
                placeholderTextColor={isDark ? 'rgba(255,255,255,0.30)' : staticTheme.colors.gray[400]}
                multiline
                numberOfLines={2}
                accessibilityLabel="Order notes"
              />
            </View>

            {/* Totals block */}
            <View style={[sheetStyles.totalsCard, {
              backgroundColor: surfaceColor,
              borderColor,
            }]}>
              <View style={sheetStyles.totalRow}>
                <Text variant="body-sm" style={{ color: textMuted }}>Subtotal</Text>
                <Text variant="body-sm" weight="medium" style={{ color: textMain }}>{formatCurrency(cartTotal)}</Text>
              </View>
              {discountPct > 0 && (
                <View style={sheetStyles.totalRow}>
                  <Text variant="body-sm" style={{ color: isDark ? DARK_AMBER : staticTheme.colors.warning[500] }}>
                    Discount (-{discountPct}%)
                  </Text>
                  <Text variant="body-sm" weight="medium" style={{ color: isDark ? DARK_AMBER : staticTheme.colors.warning[500] }}>
                    -{formatCurrency(discountAmount)}
                  </Text>
                </View>
              )}
              <View style={[sheetStyles.totalRow, sheetStyles.finalTotalRow, { borderTopColor: borderColor }]}>
                <Text variant="h5" weight="bold" style={{ color: textMain }}>Total</Text>
                <Text variant="h4" weight="bold" style={{ color: accent }}>{formatCurrency(finalTotal)}</Text>
              </View>
            </View>

            <View style={sheetStyles.sheetBottomPad} />
      </BottomSheetScrollView>

      {/* Confirm button — sticky footer outside the scroll view */}
      <View style={[
        sheetStyles.sheetFooter,
        {
          borderTopColor: borderColor,
          backgroundColor: bgColor,
          paddingBottom: Math.max(insets.bottom, staticTheme.spacing.md),
        },
      ]}>
        {confirmed ? (
          <View style={[sheetStyles.successRow, {
            backgroundColor: isDark ? `${DARK_GREEN}18` : staticTheme.colors.success[50],
            borderColor:     isDark ? `${DARK_GREEN}40` : staticTheme.colors.success[200],
          }]}>
            <CheckCircle size={20} color={isDark ? DARK_GREEN : staticTheme.colors.success[500]} />
            <Text variant="body" weight="bold" style={{ color: isDark ? DARK_GREEN : staticTheme.colors.success[600] }}>
              Sale Confirmed!
            </Text>
          </View>
        ) : (
          <Pressable
            style={({ pressed }) => [
              sheetStyles.confirmBtn,
              {
                backgroundColor: canConfirm
                  ? (pressed ? (isDark ? '#3A84D8' : staticTheme.colors.primary[600]) : accent)
                  : (isDark ? 'rgba(255,255,255,0.10)' : staticTheme.colors.gray[200]),
                opacity: confirming ? 0.75 : 1,
              },
            ]}
            onPress={handleConfirm}
            disabled={!canConfirm || confirming}
            accessibilityRole="button"
            accessibilityLabel="Confirm sale"
          >
            {confirming ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <Receipt size={18} color="#FFFFFF" />
                <Text variant="body" weight="bold" style={{ color: '#FFFFFF' }}>
                  Confirm Sale · {formatCurrency(finalTotal)}
                </Text>
              </>
            )}
          </Pressable>
        )}
      </View>
    </BottomSheetModal>
  );
});
CheckoutSheet.displayName = 'CheckoutSheet';

const sheetStyles = StyleSheet.create({
  sheetHeader: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
    paddingHorizontal: staticTheme.spacing.md,
    paddingVertical:   staticTheme.spacing.sm,
    borderBottomWidth: 1,
  },
  closeBtn: {
    width:          36,
    height:         36,
    borderRadius:   18,
    alignItems:     'center',
    justifyContent: 'center',
  },
  sheetScroll: {
    flex: 1,
  },
  summaryRow: {
    gap:             6,
    paddingHorizontal: staticTheme.spacing.md,
    paddingVertical:   10,
  },
  summaryChip: {
    paddingHorizontal: 10,
    paddingVertical:   5,
    borderRadius:      staticTheme.borderRadius.full,
    borderWidth:       1,
  },
  section: {
    paddingHorizontal: staticTheme.spacing.md,
    paddingTop:        staticTheme.spacing.sm,
    gap:               8,
  },
  sectionLabel: {
    flexDirection:  'row',
    alignItems:     'center',
    gap:            6,
  },
  paymentGrid: {
    flexDirection: 'row',
    gap:           8,
  },
  paymentChip: {
    flex:           1,
    flexDirection:  'column',
    alignItems:     'center',
    paddingVertical: 10,
    borderRadius:   staticTheme.borderRadius.xl,
    borderWidth:    1.5,
    gap:            5,
  },
  tenderedInput: {
    borderWidth:   1,
    borderRadius:  staticTheme.borderRadius.lg,
    paddingHorizontal: 14,
    paddingVertical:   10,
    fontSize:      18,
    fontWeight:    '700',
  },
  changePill: {
    flexDirection:  'row',
    alignItems:     'center',
    gap:            6,
    paddingHorizontal: 12,
    paddingVertical:   8,
    borderRadius:   staticTheme.borderRadius.lg,
    borderWidth:    1,
  },
  discountBadge: {
    paddingHorizontal: 8,
    paddingVertical:   2,
    borderRadius:      staticTheme.borderRadius.full,
    marginRight:       4,
  },
  discountRow: {
    flexDirection: 'row',
    gap:           6,
  },
  discountChip: {
    flex:           1,
    alignItems:     'center',
    paddingVertical: 8,
    borderRadius:   staticTheme.borderRadius.lg,
    borderWidth:    1,
  },
  notesInput: {
    borderWidth:   1,
    borderRadius:  staticTheme.borderRadius.lg,
    paddingHorizontal: 14,
    paddingVertical:   10,
    fontSize:      14,
    textAlignVertical: 'top',
    minHeight:     60,
  },
  totalsCard: {
    marginHorizontal: staticTheme.spacing.md,
    marginTop:        staticTheme.spacing.sm,
    borderRadius:     staticTheme.borderRadius.xl,
    borderWidth:      1,
    overflow:         'hidden',
  },
  totalRow: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    alignItems:     'center',
    paddingHorizontal: staticTheme.spacing.md,
    paddingVertical:   10,
  },
  finalTotalRow: {
    borderTopWidth: 1,
    paddingVertical: 14,
  },
  sheetFooter: {
    padding:       staticTheme.spacing.md,
    borderTopWidth: 1,
  },
  confirmBtn: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'center',
    gap:            8,
    paddingVertical: 16,
    borderRadius:   staticTheme.borderRadius.xl,
  },
  successRow: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'center',
    gap:            8,
    paddingVertical: 16,
    borderRadius:   staticTheme.borderRadius.xl,
    borderWidth:    1,
  },
  sheetBottomPad: {
    height: staticTheme.spacing.sm,
  },
  customerSelectorBtn: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               10,
    borderWidth:       1,
    borderRadius:      staticTheme.borderRadius.lg,
    paddingHorizontal: 14,
    paddingVertical:   12,
  },
  customerPickerPanel: {
    borderWidth:   1,
    borderRadius:  staticTheme.borderRadius.lg,
    overflow:      'hidden',
    maxHeight:     220,
  },
  customerSearchWrap: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               8,
    borderBottomWidth: 1,
    paddingHorizontal: 12,
    paddingVertical:   8,
  },
  customerSearchInput: {
    flex:     1,
    fontSize: staticTheme.typography.sizes.sm,
    padding:  0,
  },
  customerRow: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               10,
    paddingHorizontal: 12,
    paddingVertical:   10,
    borderBottomWidth: 1,
  },
  customerAvatar: {
    width:          32,
    height:         32,
    borderRadius:   16,
    alignItems:     'center',
    justifyContent: 'center',
    flexShrink:     0,
  },
});

// ─── Cart panel (full component for tablet — embedded for phone) ───────────────

interface CartPanelProps {
  cartItems:   CartItem[];
  cartTotal:   number;
  cartCount:   number;
  isDark:      boolean;
  accent:      string;
  onRemove:    (id: string) => void;
  onQtyChange: (id: string, qty: number) => void;
  onClear:     () => void;
  onCheckout:  () => void;
  orderNumber: string;
  isCompact?:  boolean; // phone cart summary footer
}

const CartPanel = React.memo<CartPanelProps>(({
  cartItems, cartTotal, cartCount, isDark, accent,
  onRemove, onQtyChange, onClear, onCheckout, orderNumber, isCompact,
}) => {
  const bgColor     = isDark ? '#0A0E1A' : '#FFFFFF';
  const textMain    = isDark ? '#FFFFFF' : staticTheme.colors.gray[900];
  const textMuted   = isDark ? 'rgba(255,255,255,0.45)' : staticTheme.colors.gray[500];
  const borderColor = isDark ? 'rgba(255,255,255,0.09)' : staticTheme.colors.gray[200];

  if (isCompact === true) {
    // Phone compact summary — shown at bottom as sticky footer
    if (cartCount === 0) return null;
    return (
      <View style={[cartStyles.compactFooter, {
        backgroundColor: bgColor,
        borderTopColor:  borderColor,
      }]}>
        <View style={cartStyles.compactLeft}>
          <View style={[cartStyles.compactBadge, { backgroundColor: accent }]}>
            <Text variant="body-xs" weight="bold" style={{ color: '#FFFFFF' }}>{cartCount}</Text>
          </View>
          <Text variant="body-sm" weight="medium" style={{ color: textMain }}>
            {cartCount} item{cartCount !== 1 ? 's' : ''}
          </Text>
        </View>
        <Text variant="h5" weight="bold" style={{ color: accent }}>
          {formatCurrency(cartTotal)}
        </Text>
        <Pressable
          style={({ pressed }) => [
            cartStyles.checkoutBtn,
            {
              backgroundColor: pressed
                ? (isDark ? '#3A84D8' : staticTheme.colors.primary[600])
                : accent,
            },
          ]}
          onPress={onCheckout}
          accessibilityRole="button"
          accessibilityLabel="Proceed to checkout"
        >
          <ShoppingCart size={16} color="#FFFFFF" />
          <Text variant="body-sm" weight="bold" style={{ color: '#FFFFFF' }}>Checkout</Text>
        </Pressable>
      </View>
    );
  }

  // Full cart panel (tablet)
  return (
    <View style={[cartStyles.panel, { backgroundColor: bgColor, borderLeftColor: borderColor }]}>
      {/* Header */}
      <View style={[cartStyles.panelHeader, { borderBottomColor: borderColor }]}>
        <View style={cartStyles.panelHeaderLeft}>
          <ShoppingCart size={18} color={accent} />
          <View>
            <Text variant="body-sm" weight="bold" style={{ color: textMain }}>
              Order #{orderNumber}
            </Text>
            <Text variant="body-xs" style={{ color: textMuted }}>
              {cartCount} item{cartCount !== 1 ? 's' : ''}
            </Text>
          </View>
        </View>
        {cartCount > 0 && (
          <Pressable
            onPress={onClear}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Clear cart"
          >
            <Text variant="body-xs" weight="medium" style={{ color: isDark ? DARK_RED : staticTheme.colors.error[400] }}>
              Clear All
            </Text>
          </Pressable>
        )}
      </View>

      {/* Cart items */}
      {cartCount === 0 ? (
        <View style={cartStyles.emptyCart}>
          <View style={[cartStyles.emptyIcon, { backgroundColor: `${accent}12` }]}>
            <ShoppingCart size={32} color={`${accent}60`} />
          </View>
          <Text variant="body-sm" weight="semibold" style={{ color: isDark ? 'rgba(255,255,255,0.40)' : staticTheme.colors.gray[500] }}>
            Cart is empty
          </Text>
          <Text variant="body-xs" align="center" style={{ color: isDark ? 'rgba(255,255,255,0.25)' : staticTheme.colors.gray[400] }}>
            Tap a product to add it to your order
          </Text>
        </View>
      ) : (
        <FlatList
          data={cartItems}
          keyExtractor={(ci) => ci.product.id}
          renderItem={({ item: ci }) => (
            <CartRow
              item={ci}
              isDark={isDark}
              accent={accent}
              onRemove={onRemove}
              onQtyChange={onQtyChange}
            />
          )}
          style={cartStyles.cartList}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        />
      )}

      {/* Totals + checkout */}
      <View style={[cartStyles.panelFooter, { borderTopColor: borderColor }]}>
        <View style={cartStyles.totalRowPanel}>
          <Text variant="body-sm" style={{ color: textMuted }}>Subtotal</Text>
          <Text variant="body-sm" weight="medium" style={{ color: textMain }}>{formatCurrency(cartTotal)}</Text>
        </View>
        <View style={[cartStyles.totalRowPanel, cartStyles.finalTotal, { borderTopColor: borderColor }]}>
          <Text variant="h5" weight="bold" style={{ color: textMain }}>Total</Text>
          <Text variant="h4" weight="bold" style={{ color: accent }}>{formatCurrency(cartTotal)}</Text>
        </View>
        <Pressable
          style={({ pressed }) => [
            cartStyles.checkoutBtnFull,
            {
              backgroundColor: cartCount === 0
                ? (isDark ? 'rgba(255,255,255,0.08)' : staticTheme.colors.gray[200])
                : (pressed ? (isDark ? '#3A84D8' : staticTheme.colors.primary[600]) : accent),
            },
          ]}
          onPress={cartCount > 0 ? onCheckout : undefined}
          disabled={cartCount === 0}
          accessibilityRole="button"
          accessibilityLabel={cartCount === 0 ? 'Cart is empty' : 'Proceed to checkout'}
        >
          <Receipt size={20} color={cartCount === 0 ? textMuted : '#FFFFFF'} />
          <Text
            variant="body"
            weight="bold"
            style={{ color: cartCount === 0 ? textMuted : '#FFFFFF' }}
          >
            {cartCount === 0 ? 'Add Items to Checkout' : `Checkout · ${formatCurrency(cartTotal)}`}
          </Text>
        </Pressable>
      </View>
    </View>
  );
});
CartPanel.displayName = 'CartPanel';

const cartStyles = StyleSheet.create({
  panel: {
    flex:            2,  // 40% of split on tablet (products flex: 3)
    borderLeftWidth: 1,
  },
  panelHeader: {
    flexDirection:   'row',
    alignItems:      'center',
    justifyContent:  'space-between',
    padding:         staticTheme.spacing.md,
    borderBottomWidth: 1,
    gap:             8,
  },
  panelHeaderLeft: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           8,
    flex:          1,
  },
  cartList: {
    flex: 1,
  },
  emptyCart: {
    flex:           1,
    alignItems:     'center',
    justifyContent: 'center',
    gap:            staticTheme.spacing.sm,
    padding:        staticTheme.spacing.xl,
  },
  emptyIcon: {
    width:          80,
    height:         80,
    borderRadius:   40,
    alignItems:     'center',
    justifyContent: 'center',
    marginBottom:   4,
  },
  panelFooter: {
    borderTopWidth: 1,
    padding:        staticTheme.spacing.md,
    gap:            staticTheme.spacing.sm,
  },
  totalRowPanel: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    alignItems:     'center',
  },
  finalTotal: {
    borderTopWidth: 1,
    paddingTop:     staticTheme.spacing.sm,
  },
  checkoutBtnFull: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'center',
    gap:            8,
    paddingVertical: 16,
    borderRadius:   staticTheme.borderRadius.xl,
    marginTop:      4,
  },
  // Phone compact footer
  compactFooter: {
    flexDirection:  'row',
    alignItems:     'center',
    paddingHorizontal: staticTheme.spacing.md,
    paddingVertical:   12,
    borderTopWidth: 1,
    gap:            staticTheme.spacing.sm,
  },
  compactLeft: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           8,
    flex:          1,
  },
  compactBadge: {
    width:          22,
    height:         22,
    borderRadius:   11,
    alignItems:     'center',
    justifyContent: 'center',
  },
  checkoutBtn: {
    flexDirection:  'row',
    alignItems:     'center',
    gap:            6,
    paddingHorizontal: 16,
    paddingVertical:   10,
    borderRadius:   staticTheme.borderRadius.xl,
  },
});

// ─── Main Screen ───────────────────────────────────────────────────────────────

const PHONE_NUM_COLUMNS  = 2;
const TABLET_NUM_COLUMNS = 3;

export default function POSScreen() {
  const appTheme  = useAppTheme();
  const isDark    = useThemeStore(selectThemeMode) === 'dark';
  const isTablet  = useIsTablet();

  // useShallow prevents the new array reference from .filter() causing an infinite loop
  const products        = useInventoryStore(useShallow(selectProducts));
  const creditCustomers = useCreditStore(useShallow(selectCreditCustomers));

  const cartItems  = usePosStore(selectCartItems);
  const cartTotal  = usePosStore(selectCartTotal);
  const cartCount  = usePosStore(selectCartCount);
  const { addToCart, removeFromCart, updateCartQty, clearCart, checkout } =
    usePosStore(useShallow((s) => ({
      addToCart:      s.addToCart,
      removeFromCart: s.removeFromCart,
      updateCartQty:  s.updateCartQty,
      clearCart:      s.clearCart,
      checkout:       s.checkout,
    })));

  const [search,      setSearch]      = useState('');
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [orderNumber] = useState(() => generateOrderNumber());

  const accent    = isDark ? DARK_ACCENT : staticTheme.colors.primary[500];
  const rootBg    = isDark ? DARK_ROOT_BG : appTheme.colors.background;
  const textMain  = isDark ? '#FFFFFF' : staticTheme.colors.gray[900];
  const textMuted = isDark ? 'rgba(255,255,255,0.45)' : staticTheme.colors.gray[500];
  const borderClr = isDark ? 'rgba(255,255,255,0.09)' : staticTheme.colors.gray[200];
  const inputBg   = isDark ? '#1E2435' : '#F8F9FC';

  const filteredProducts = useMemo(() => {
    if (search.trim() === '') return products;
    const q = search.toLowerCase();
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.sku !== undefined && p.sku.toLowerCase().includes(q)),
    );
  }, [products, search]);

  const cartItemsMap = useMemo<Map<string, CartItem>>(
    () => new Map(cartItems.map((ci) => [ci.product.id, ci])),
    [cartItems],
  );

  const numColumns = isTablet ? TABLET_NUM_COLUMNS : PHONE_NUM_COLUMNS;

  const handleCheckout = useCallback(() => setCheckoutOpen(true), []);

  const handleConfirmCheckout = useCallback(
    async (payload: CheckoutPayload) => {
      const order = await checkout(
        payload.paymentMethod,
        {
          ...(payload.amountTendered !== undefined ? { amountTendered: payload.amountTendered } : {}),
          ...(payload.notes          !== undefined ? { notes:          payload.notes          } : {}),
        },
      );
      if (order !== null) {
        // Refresh inventory store so product stock counts reflect the sale
        await useInventoryStore.getState().initializeInventory();

        // If payment was on credit, record the credit sale ledger entry
        if (payload.paymentMethod === 'credit' && payload.creditCustomerId !== undefined) {
          const { addCreditSale } = useCreditStore.getState();
          await addCreditSale({
            customerId:       payload.creditCustomerId,
            posTransactionId: order.id,
            totalAmount:      order.totalAmount,
            ...(payload.notes !== undefined ? { notes: payload.notes } : {}),
          });
        }
      }
    },
    [checkout],
  );

  // Pad items to fill last row so grid columns are even
  const paddedProducts = useMemo<(InventoryItem | null)[]>(() => {
    const remainder = filteredProducts.length % numColumns;
    if (remainder === 0) return filteredProducts;
    const pads = numColumns - remainder;
    return [
      ...filteredProducts,
      ...Array.from({ length: pads }, () => null as null),
    ];
  }, [filteredProducts, numColumns]);

  const renderPaddedItem = useCallback(
    ({ item }: { item: InventoryItem | null }) => {
      if (item === null) return <View style={{ flex: 1, margin: 5 }} />;
      const ci = cartItemsMap.get(item.id);
      return (
        <View style={{ flex: 1, margin: 5 }}>
          <ProductTile
            product={item}
            isDark={isDark}
            onAdd={addToCart}
            onReduce={updateCartQty}
            inCart={ci !== undefined}
            cartQty={ci?.quantity ?? 0}
          />
        </View>
      );
    },
    [cartItemsMap, isDark, addToCart],
  );

  // Header: search bar + stats
  const ListHeader = useMemo(() => (
    <View style={posStyles.gridHeader}>
      {/* Search */}
      <View style={[posStyles.searchWrap, {
        backgroundColor: inputBg,
        borderColor:     borderClr,
      }]}>
        <Search size={16} color={textMuted} />
        <TextInput
          style={[posStyles.searchInput, { color: textMain }]}
          value={search}
          onChangeText={setSearch}
          placeholder="Search products..."
          placeholderTextColor={isDark ? 'rgba(255,255,255,0.30)' : staticTheme.colors.gray[400]}
          returnKeyType="search"
          clearButtonMode="while-editing"
          accessibilityLabel="Search products"
        />
        {search.length > 0 && Platform.OS === 'android' && (
          <Pressable onPress={() => setSearch('')} hitSlop={8} accessibilityRole="button">
            <X size={14} color={textMuted} />
          </Pressable>
        )}
      </View>

      {/* Stat pills */}
      <View style={posStyles.statRow}>
        <View style={[posStyles.statPill, {
          backgroundColor: isDark ? `${accent}0D` : `${accent}0E`,
          borderColor:     isDark ? `${accent}28` : `${accent}28`,
        }]}>
          <Package size={12} color={accent} />
          <Text variant="body-xs" weight="semibold" style={{ color: accent }}>
            {filteredProducts.length} Product{filteredProducts.length !== 1 ? 's' : ''}
          </Text>
        </View>
        {cartCount > 0 && (
          <View style={[posStyles.statPill, {
            backgroundColor: isDark ? `${DARK_GREEN}0D` : `${staticTheme.colors.success[500]}0E`,
            borderColor:     isDark ? `${DARK_GREEN}28` : `${staticTheme.colors.success[500]}28`,
          }]}>
            <ShoppingCart size={12} color={isDark ? DARK_GREEN : staticTheme.colors.success[500]} />
            <Text variant="body-xs" weight="semibold" style={{ color: isDark ? DARK_GREEN : staticTheme.colors.success[500] }}>
              {cartCount} in cart
            </Text>
          </View>
        )}
      </View>
    </View>
  ), [inputBg, borderClr, textMuted, textMain, search, isDark, accent, filteredProducts.length, cartCount]);

  const ListEmpty = useMemo(() => (
    <View style={posStyles.emptyState}>
      <View style={[posStyles.emptyIcon, { backgroundColor: `${accent}12` }]}>
        <Package size={36} color={`${accent}60`} />
      </View>
      <Text variant="body" weight="semibold" style={{ color: isDark ? 'rgba(255,255,255,0.50)' : staticTheme.colors.gray[600] }}>
        {search.length > 0 ? 'No products match your search' : 'No products yet'}
      </Text>
      <Text variant="body-sm" align="center" style={{ color: isDark ? 'rgba(255,255,255,0.28)' : staticTheme.colors.gray[400] }}>
        {search.length > 0
          ? 'Try a different name or SKU'
          : 'Add products in the Inventory module to start selling'}
      </Text>
    </View>
  ), [accent, isDark, search.length]);

  return (
    <View style={[posStyles.root, { backgroundColor: rootBg }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      {/* ── Page title row ── */}
      <View style={[posStyles.screenHeader, { borderBottomColor: borderClr }]}>
        <View>
          <Text variant="h5" weight="bold" style={{ color: textMain }}>
            Point of Sale
          </Text>
          <Text variant="body-xs" style={{ color: textMuted }}>
            Order #{orderNumber}
          </Text>
        </View>
        {cartCount > 0 && (
          <View style={[posStyles.cartCountBadge, { backgroundColor: accent }]}>
            <ShoppingCart size={14} color="#FFFFFF" />
            <Text variant="body-xs" weight="bold" style={{ color: '#FFFFFF' }}>
              {cartCount}
            </Text>
          </View>
        )}
      </View>

      {/* ── Tablet: horizontal split | Phone: stacked ── */}
      <View style={posStyles.body}>
        {/* Products grid */}
        <View style={posStyles.productsPanel}>
          <FlatList
            data={paddedProducts}
            keyExtractor={(item, idx) => item?.id ?? `pad-${idx}`}
            renderItem={renderPaddedItem as ({ item }: { item: InventoryItem | null }) => React.JSX.Element}
            numColumns={numColumns}
            key={numColumns} // force re-mount when column count changes
            ListHeaderComponent={ListHeader}
            ListEmptyComponent={ListEmpty}
            contentContainerStyle={[
              posStyles.gridContent,
              paddedProducts.length === 0 && posStyles.gridContentEmpty,
            ]}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            removeClippedSubviews={Platform.OS === 'android'}
            maxToRenderPerBatch={12}
            windowSize={6}
            initialNumToRender={12}
          />
        </View>

        {/* Cart panel — full on tablet, hidden on phone (cart lives in compact footer) */}
        {isTablet && (
          <CartPanel
            cartItems={cartItems}
            cartTotal={cartTotal}
            cartCount={cartCount}
            isDark={isDark}
            accent={accent}
            onRemove={removeFromCart}
            onQtyChange={updateCartQty}
            onClear={clearCart}
            onCheckout={handleCheckout}
            orderNumber={orderNumber}
          />
        )}
      </View>

      {/* Phone: compact cart footer */}
      {!isTablet && (
        <CartPanel
          cartItems={cartItems}
          cartTotal={cartTotal}
          cartCount={cartCount}
          isDark={isDark}
          accent={accent}
          onRemove={removeFromCart}
          onQtyChange={updateCartQty}
          onClear={clearCart}
          onCheckout={handleCheckout}
          orderNumber={orderNumber}
          isCompact
        />
      )}

      {/* Checkout bottom sheet */}
      <CheckoutSheet
        visible={checkoutOpen}
        onClose={() => setCheckoutOpen(false)}
        cartItems={cartItems}
        cartTotal={cartTotal}
        cartCount={cartCount}
        onConfirm={handleConfirmCheckout}
        isDark={isDark}
        orderNumber={orderNumber}
        creditCustomers={creditCustomers}
      />
    </View>
  );
}

// ─── Screen-level styles ───────────────────────────────────────────────────────

const posStyles = StyleSheet.create({
  root: {
    flex: 1,
  },
  screenHeader: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
    paddingHorizontal: staticTheme.spacing.md,
    paddingTop:        staticTheme.spacing.md,
    paddingBottom:     staticTheme.spacing.sm,
    borderBottomWidth: 1,
  },
  cartCountBadge: {
    flexDirection:  'row',
    alignItems:     'center',
    gap:            5,
    paddingHorizontal: 10,
    paddingVertical:    6,
    borderRadius:   staticTheme.borderRadius.full,
  },
  body: {
    flex:          1,
    flexDirection: 'row', // side-by-side on tablet, single column fills on phone
  },
  productsPanel: {
    flex: 3, // 60% on tablet
  },
  // Grid header
  gridHeader: {
    paddingHorizontal: staticTheme.spacing.md,
    paddingTop:        staticTheme.spacing.sm,
    paddingBottom:     staticTheme.spacing.xs,
    gap:               staticTheme.spacing.sm,
  },
  searchWrap: {
    flexDirection:  'row',
    alignItems:     'center',
    gap:            8,
    paddingHorizontal: 12,
    paddingVertical:    10,
    borderRadius:   staticTheme.borderRadius.xl,
    borderWidth:    1,
  },
  searchInput: {
    flex:     1,
    fontSize: staticTheme.typography.sizes.sm,
    padding:  0,
  },
  statRow: {
    flexDirection: 'row',
    gap:           8,
  },
  statPill: {
    flexDirection:  'row',
    alignItems:     'center',
    gap:            5,
    paddingHorizontal: 10,
    paddingVertical:    5,
    borderRadius:   staticTheme.borderRadius.full,
    borderWidth:    1,
  },
  gridContent: {
    paddingBottom: staticTheme.spacing.xl,
  },
  gridContentEmpty: {
    flexGrow: 1,
  },
  // Empty state
  emptyState: {
    alignItems:     'center',
    justifyContent: 'center',
    flex:           1,
    gap:            staticTheme.spacing.sm,
    paddingVertical: staticTheme.spacing.xl,
    paddingHorizontal: staticTheme.spacing.xl,
  },
  emptyIcon: {
    width:          88,
    height:         88,
    borderRadius:   44,
    alignItems:     'center',
    justifyContent: 'center',
    marginBottom:   staticTheme.spacing.xs,
  },
});
