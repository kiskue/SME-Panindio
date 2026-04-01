/**
 * CreditCustomerDetailScreen
 *
 * Shows a single customer's full credit history:
 *   1. Header card — customer name, phone, outstanding balance (big)
 *   2. Summary cards row — Total Credit | Total Paid | Balance
 *   3. "Record Payment" button → RecordPaymentSheet
 *   4. Unified transaction timeline (FlatList) — credit sales + payments
 *      chronologically, newest first.
 *
 * TypeScript constraints honoured:
 *   - exactOptionalPropertyTypes: conditional spread throughout
 *   - noUncheckedIndexedAccess: `?? fallback` on all array/object access
 *   - noUnusedLocals/Parameters: unused vars prefixed `_`
 *   - theme.colors.primary[500] pattern (numeric keys)
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
  ListRenderItemInfo,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  BottomSheetModal,
  BottomSheetScrollView,
  BottomSheetBackdrop,
  type BottomSheetBackdropProps,
  type BottomSheetModalRef,
} from '@gorhom/bottom-sheet';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import {
  Phone,
  FileText,
  ArrowDownLeft,
  ArrowUpRight,
  X,
  PhilippinePeso,
  CalendarDays,
  CreditCard,
  CheckCircle2,
  Clock,
  ChevronDown,
} from 'lucide-react-native';
import { Text } from '@/components/atoms/Text';
import { SkeletonBox } from '@/components/atoms/SkeletonBox';
import { LoaderOverlay } from '@/components/molecules/LoaderOverlay';
import { DatePickerField } from '@/components/molecules/DatePickerField';
import {
  useThemeStore,
  selectThemeMode,
  useCreditStore,
  selectCustomerSummaries,
  selectSelectedCustomerSales,
  selectSelectedCustomerPayments,
  selectCreditDetailLoading,
} from '@/store';
import type { CustomerCreditSummary, CreditSaleWithItems, CreditPayment } from '@/types';
import { theme as staticTheme } from '@/core/theme';

// ─── Module accent (same as credit.tsx) ───────────────────────────────────────

const VIOLET_DARK  = '#7C3AED';
const VIOLET_LIGHT = '#6D28D9';
const GREEN        = '#10B981';
const RED          = '#EF4444';

// ─── Color tokens ─────────────────────────────────────────────────────────────

const DARK_CARD_BG  = '#151A27';
const DARK_ROOT_BG  = '#0A0A0F';
const DARK_BORDER   = 'rgba(255,255,255,0.08)';
const DARK_TEXT     = '#F1F5F9';
const DARK_TEXT_SEC = '#94A3B8';

// ─── Types imported from @/types ──────────────────────────────────────────────
// CustomerCreditSummary: { customer: CreditCustomer, totalCredit, totalPaid, balance, isFullyPaid }
// CreditSaleWithItems: CreditSale + items: CreditSaleItem[]
// CreditPayment: { id, customerId, amount, paidAt, createdAt, notes? }

// ─── Unified timeline item ─────────────────────────────────────────────────────

type TimelineEntry =
  | { kind: 'credit';  data: CreditSaleWithItems }
  | { kind: 'payment'; data: CreditPayment };

// ─── Store binding (real store, no stubs) ─────────────────────────────────────

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatCurrency(value: number): string {
  return `₱${value.toLocaleString('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-PH', {
    year:  'numeric',
    month: 'short',
    day:   'numeric',
  });
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

// ─── Skeleton — delegated to shared SkeletonBox atom ─────────────────────────

const Skeleton = React.memo<{
  width:   number | `${number}%`;
  height:  number;
  radius?: number;
  isDark:  boolean; // kept for call-site compat
}>(({ width, height, radius = 8, isDark: _isDark }) => (
  <SkeletonBox width={width} height={height} borderRadius={radius} />
));
Skeleton.displayName = 'DetailSkeleton';

// ─── Summary Card Row ─────────────────────────────────────────────────────────

const SummaryCardRow = React.memo<{
  totalCredit: number;
  totalPaid:   number;
  balance:     number;
  isDark:      boolean;
  violet:      string;
}>(({ totalCredit, totalPaid, balance, isDark, violet }) => {
  const textMuted = isDark ? DARK_TEXT_SEC : staticTheme.colors.gray[500];

  const items = [
    { label: 'Total Credit', value: totalCredit, color: violet           },
    { label: 'Total Paid',   value: totalPaid,   color: GREEN            },
    { label: 'Balance',      value: balance,     color: balance > 0 ? RED : GREEN },
  ];

  return (
    <View style={summaryRowStyles.row}>
      {items.map((item) => (
        <View
          key={item.label}
          style={[summaryRowStyles.card, {
            backgroundColor: isDark ? DARK_CARD_BG : '#FFFFFF',
            borderColor:     isDark ? `${item.color}1A` : `${item.color}22`,
            flex: 1,
            ...(isDark
              ? {
                  shadowColor:   item.color,
                  shadowOffset:  { width: 0, height: 2 },
                  shadowOpacity: 0.08,
                  shadowRadius:  6,
                  elevation:     2,
                }
              : staticTheme.shadows.sm),
          }]}
        >
          {/* Top accent bar */}
          <View style={[summaryRowStyles.topBar, { backgroundColor: item.color }]} />
          <View style={summaryRowStyles.inner}>
            <Text variant="body-xs" style={{ color: textMuted }} numberOfLines={1}>
              {item.label}
            </Text>
            <Text
              variant="h6"
              weight="bold"
              style={{ color: item.color }}
              numberOfLines={1}
              adjustsFontSizeToFit
            >
              {formatCurrency(item.value)}
            </Text>
          </View>
        </View>
      ))}
    </View>
  );
});
SummaryCardRow.displayName = 'SummaryCardRow';

const summaryRowStyles = StyleSheet.create({
  row: {
    flexDirection:     'row',
    gap:               8,
    paddingHorizontal: staticTheme.spacing.md,
    marginBottom:      staticTheme.spacing.sm,
  },
  card: {
    borderRadius:  14,
    borderWidth:   1,
    overflow:      'hidden',
  },
  topBar: {
    height: 3,
  },
  inner: {
    paddingHorizontal: 10,
    paddingVertical:   10,
    gap:               4,
    alignItems:        'center',
  },
});

// ─── Timeline Item ─────────────────────────────────────────────────────────────

const TimelineItem = React.memo<{
  entry:  TimelineEntry;
  isDark: boolean;
  violet: string;
}>(({ entry, isDark, violet }) => {
  const cardBg    = isDark ? DARK_CARD_BG : '#FFFFFF';
  const border    = isDark ? DARK_BORDER  : staticTheme.colors.gray[200];
  const textMain  = isDark ? DARK_TEXT     : staticTheme.colors.gray[800];
  const textMuted = isDark ? DARK_TEXT_SEC : staticTheme.colors.gray[500];

  const isCredit  = entry.kind === 'credit';
  const accentClr = isCredit ? violet : GREEN;
  const dateStr   = isCredit
    ? formatDate(entry.data.createdAt)
    : formatDate((entry.data as CreditPayment).paidAt);
  const amount    = isCredit
    ? entry.data.totalAmount
    : (entry.data as CreditPayment).amount;
  const notes     = isCredit
    ? entry.data.notes
    : (entry.data as CreditPayment).notes;
  const posId     = isCredit ? (entry.data.posTransactionId ?? null) : null;
  const items     = isCredit ? entry.data.items : [];
  const hasItems  = items.length > 0;

  const [expanded, setExpanded]   = useState(false);
  const chevronAnim               = useRef(new Animated.Value(0)).current;

  const toggleItems = useCallback(() => {
    const toValue = expanded ? 0 : 1;
    Animated.spring(chevronAnim, {
      toValue,
      useNativeDriver: true,
      damping:  15,
      stiffness: 180,
    }).start();
    setExpanded(prev => !prev);
  }, [expanded, chevronAnim]);

  const chevronRotate = chevronAnim.interpolate({
    inputRange:  [0, 1],
    outputRange: ['0deg', '180deg'],
  });

  return (
    <View style={[timelineStyles.card, {
      backgroundColor: cardBg,
      borderColor:     isDark ? `${accentClr}1A` : border,
    }]}>
      {/* Left accent bar */}
      <View style={[timelineStyles.accentBar, { backgroundColor: accentClr }]} />

      <View style={timelineStyles.body}>
        <View style={timelineStyles.mainRow}>
          {/* Icon pill */}
          <View style={[timelineStyles.iconPill, { backgroundColor: `${accentClr}1A` }]}>
            {isCredit
              ? <ArrowUpRight size={18} color={accentClr} />
              : <ArrowDownLeft size={18} color={accentClr} />
            }
          </View>

          {/* Label + date */}
          <View style={timelineStyles.labelWrap}>
            <Text variant="body" weight="semibold" style={{ color: textMain }} numberOfLines={1}>
              {isCredit ? 'Credit Sale' : 'Payment Received'}
            </Text>
            <View style={timelineStyles.metaRow}>
              <CalendarDays size={11} color={textMuted} />
              <Text variant="body-xs" style={{ color: textMuted, flexShrink: 1 }} numberOfLines={1}>
                {dateStr}
              </Text>
              {posId !== null && (
                <>
                  <View style={[timelineStyles.dot, { backgroundColor: textMuted }]} />
                  <Text variant="body-xs" style={{ color: textMuted, flexShrink: 1 }} numberOfLines={1}>
                    {`POS #${posId}`}
                  </Text>
                </>
              )}
            </View>
          </View>

          {/* Amount */}
          <View style={timelineStyles.amountWrap}>
            <Text
              variant="h6"
              weight="bold"
              style={{ color: accentClr }}
              numberOfLines={1}
              adjustsFontSizeToFit
            >
              {isCredit ? `+${formatCurrency(amount)}` : `-${formatCurrency(amount)}`}
            </Text>
          </View>
        </View>

        {/* Badge row + optional expand toggle */}
        <View style={timelineStyles.badgeRow}>
          <View style={[timelineStyles.badge, {
            backgroundColor: `${accentClr}15`,
            borderColor:     `${accentClr}30`,
          }]}>
            {isCredit
              ? <CreditCard  size={10} color={accentClr} />
              : <CheckCircle2 size={10} color={accentClr} />
            }
            <Text variant="body-xs" weight="semibold" style={{ color: accentClr }}>
              {isCredit ? 'CREDIT' : 'PAYMENT'}
            </Text>
          </View>

          {notes !== undefined && (
            <Text
              variant="body-xs"
              style={{ color: textMuted, flex: 1 }}
              numberOfLines={1}
            >
              {notes}
            </Text>
          )}

          {/* "N items" expand pill — only for credit sales that have items */}
          {hasItems && (
            <Pressable
              onPress={toggleItems}
              style={[timelineStyles.expandPill, {
                backgroundColor: `${accentClr}12`,
                borderColor:     `${accentClr}30`,
              }]}
              hitSlop={8}
            >
              <Text variant="body-xs" weight="semibold" style={{ color: accentClr }}>
                {`${items.length} item${items.length !== 1 ? 's' : ''}`}
              </Text>
              <Animated.View style={{ transform: [{ rotate: chevronRotate }] }}>
                <ChevronDown size={11} color={accentClr} />
              </Animated.View>
            </Pressable>
          )}
        </View>

        {/* Collapsible product line items */}
        {hasItems && expanded && (
          <View style={[timelineStyles.itemsTable, {
            borderTopColor: isDark ? 'rgba(255,255,255,0.06)' : staticTheme.colors.gray[100],
          }]}>
            {/* Column headers */}
            <View style={timelineStyles.itemsHeader}>
              <Text variant="body-xs" weight="semibold" style={[timelineStyles.colProduct, { color: textMuted }]}>
                PRODUCT
              </Text>
              <Text variant="body-xs" weight="semibold" style={[timelineStyles.colQty, { color: textMuted }]}>
                QTY
              </Text>
              <Text variant="body-xs" weight="semibold" style={[timelineStyles.colPrice, { color: textMuted }]}>
                PRICE
              </Text>
              <Text variant="body-xs" weight="semibold" style={[timelineStyles.colSubtotal, { color: textMuted }]}>
                SUBTOTAL
              </Text>
            </View>

            {/* Item rows */}
            {items.map((item, idx) => (
              <View
                key={idx}
                style={[timelineStyles.itemRow, {
                  borderTopColor: isDark ? 'rgba(255,255,255,0.04)' : staticTheme.colors.gray[100],
                }]}
              >
                <Text
                  variant="body-xs"
                  style={[timelineStyles.colProduct, { color: textMain }]}
                  numberOfLines={2}
                >
                  {item.productName}
                </Text>
                <Text variant="body-xs" style={[timelineStyles.colQty, { color: textMuted }]}>
                  {item.quantity % 1 === 0
                    ? item.quantity.toString()
                    : item.quantity.toFixed(2)}
                </Text>
                <Text variant="body-xs" style={[timelineStyles.colPrice, { color: textMuted }]}>
                  {formatCurrency(item.unitPrice)}
                </Text>
                <Text variant="body-xs" weight="semibold" style={[timelineStyles.colSubtotal, { color: textMain }]}>
                  {formatCurrency(item.subtotal)}
                </Text>
              </View>
            ))}

            {/* Total row */}
            <View style={[timelineStyles.itemsTotalRow, {
              borderTopColor: isDark ? `${accentClr}30` : `${accentClr}40`,
            }]}>
              <Text variant="body-xs" weight="semibold" style={{ color: accentClr, flex: 1 }}>
                Total
              </Text>
              <Text variant="body-xs" weight="bold" style={{ color: accentClr }}>
                {formatCurrency(amount)}
              </Text>
            </View>
          </View>
        )}
      </View>
    </View>
  );
});
TimelineItem.displayName = 'TimelineItem';

const timelineStyles = StyleSheet.create({
  card: {
    flexDirection:    'row',
    borderRadius:     14,
    marginHorizontal: staticTheme.spacing.md,
    marginVertical:   4,
    overflow:         'hidden',
    borderWidth:      1,
  },
  accentBar: {
    width: 3,
    flexShrink: 0,
  },
  body: {
    flex:              1,
    paddingHorizontal: staticTheme.spacing.md,
    paddingVertical:   12,
    gap:               8,
  },
  mainRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           10,
  },
  iconPill: {
    width:          40,
    height:         40,
    borderRadius:   12,
    alignItems:     'center',
    justifyContent: 'center',
    flexShrink:     0,
  },
  labelWrap: {
    flex:     1,
    gap:      3,
    minWidth: 0,
    overflow: 'hidden',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           4,
    flexShrink:    1,
    overflow:      'hidden',
  },
  amountWrap: {
    flexShrink: 0,
    flexGrow:   0,
    maxWidth:   '40%',
    alignItems: 'flex-end',
  },
  dot: {
    width:        3,
    height:       3,
    borderRadius: 2,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           8,
    flexWrap:      'wrap',
  },
  badge: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               4,
    paddingHorizontal: 8,
    paddingVertical:   3,
    borderRadius:      staticTheme.borderRadius.full,
    borderWidth:       1,
  },
  expandPill: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               3,
    paddingHorizontal: 8,
    paddingVertical:   3,
    borderRadius:      staticTheme.borderRadius.full,
    borderWidth:       1,
    marginLeft:        'auto',
  },
  // ── Product line items table ──────────────────────────────────────────────
  itemsTable: {
    borderTopWidth: 1,
    marginTop:      2,
    paddingTop:     8,
    gap:            2,
  },
  itemsHeader: {
    flexDirection:  'row',
    alignItems:     'center',
    paddingBottom:  4,
    gap:            4,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems:    'flex-start',
    borderTopWidth: 1,
    paddingVertical: 5,
    gap:            4,
  },
  itemsTotalRow: {
    flexDirection:  'row',
    alignItems:     'center',
    borderTopWidth: 1,
    paddingTop:     6,
    marginTop:      2,
  },
  colProduct:  { flex: 2, minWidth: 0 },
  colQty:      { width: 32, textAlign: 'center' },
  colPrice:    { width: 72, textAlign: 'right' },
  colSubtotal: { width: 72, textAlign: 'right' },
});

// ─── Record Payment Sheet ─────────────────────────────────────────────────────

interface RecordPaymentSheetProps {
  visible:     boolean;
  isDark:      boolean;
  violet:      string;
  maxAmount:   number;
  onClose:     () => void;
  onSave:      (data: { amount: number; notes?: string; paidAt: string }) => Promise<void>;
  isSaving:    boolean;
}

const RecordPaymentSheet = React.memo<RecordPaymentSheetProps>(
  ({ visible, isDark, violet: _violet, maxAmount, onClose, onSave, isSaving }) => {
    const modalRef = useRef<BottomSheetModalRef>(null);
    const insets   = useSafeAreaInsets();

    const cardBg    = isDark ? '#1C2333' : '#FFFFFF';
    const inputBg   = isDark ? '#242D42' : '#F8F9FC';
    const inputBdr  = isDark ? 'rgba(255,255,255,0.12)' : staticTheme.colors.gray[200];
    const textMain  = isDark ? DARK_TEXT     : staticTheme.colors.gray[800];
    const textMuted = isDark ? DARK_TEXT_SEC : staticTheme.colors.gray[500];
    const labelClr  = isDark ? 'rgba(255,255,255,0.60)' : staticTheme.colors.gray[600];

    const [amount,    setAmount]    = useState('');
    const [notes,     setNotes]     = useState('');
    const [paidAt,    setPaidAt]    = useState(todayISO());
    const [amountErr, setAmountErr] = useState('');

    useEffect(() => {
      if (visible) {
        modalRef.current?.present();
      } else {
        modalRef.current?.dismiss();
        setAmount('');
        setNotes('');
        setPaidAt(todayISO());
        setAmountErr('');
      }
    }, [visible]);

    const validate = useCallback((): boolean => {
      const parsed = parseFloat(amount.replace(/,/g, ''));
      if (isNaN(parsed) || parsed <= 0) {
        setAmountErr('Enter a valid amount greater than 0');
        return false;
      }
      if (maxAmount > 0 && parsed > maxAmount) {
        setAmountErr(`Amount cannot exceed the outstanding balance (${formatCurrency(maxAmount)})`);
        return false;
      }
      setAmountErr('');
      return true;
    }, [amount, maxAmount]);

    const handleSave = useCallback(async () => {
      if (!validate()) return;
      const parsed = parseFloat(amount.replace(/,/g, ''));
      await onSave({
        amount:  parsed,
        paidAt,
        ...(notes.trim() !== '' ? { notes: notes.trim() } : {}),
      });
    }, [validate, amount, paidAt, notes, onSave]);

    // Quick amount presets as % of balance
    const presets = useMemo(() => {
      if (maxAmount <= 0) return [];
      return [
        { label: 'Full',  value: maxAmount },
        { label: '75%',   value: Math.round(maxAmount * 0.75 * 100) / 100 },
        { label: '50%',   value: Math.round(maxAmount * 0.50 * 100) / 100 },
        { label: '25%',   value: Math.round(maxAmount * 0.25 * 100) / 100 },
      ];
    }, [maxAmount]);

    const renderBackdrop = useCallback(
      (backdropProps: BottomSheetBackdropProps) => (
        <BottomSheetBackdrop
          {...backdropProps}
          appearsOnIndex={0}
          disappearsOnIndex={-1}
          pressBehavior="close"
          opacity={isDark ? 0.70 : 0.45}
        />
      ),
      [isDark],
    );

    const snapPoints      = useMemo(() => ['80%'], []);
    const backgroundStyle = useMemo(() => ({ backgroundColor: cardBg }), [cardBg]);
    const handleIndicator = useMemo(
      () => ({ backgroundColor: 'rgba(150,150,150,0.35)', width: 48, height: 4 }),
      [],
    );

    return (
      <BottomSheetModal
        ref={modalRef}
        snapPoints={snapPoints}
        onDismiss={onClose}
        backdropComponent={renderBackdrop}
        backgroundStyle={backgroundStyle}
        handleIndicatorStyle={handleIndicator}
        enablePanDownToClose
        keyboardBehavior="interactive"
        keyboardBlurBehavior="restore"
        android_keyboardInputMode="adjustResize"
      >
        {/* Title */}
        <View style={paySheetStyles.titleRow}>
          <View style={[paySheetStyles.titleIcon, { backgroundColor: `${GREEN}1A` }]}>
            <ArrowDownLeft size={18} color={GREEN} />
          </View>
          <Text variant="h5" weight="bold" style={{ color: textMain, flex: 1 }}>
            Record Payment
          </Text>
          <Pressable
            style={({ pressed }) => [paySheetStyles.closeBtn, { opacity: pressed ? 0.6 : 1 }]}
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Close"
          >
            <X size={20} color={textMuted} />
          </Pressable>
        </View>

        {/* Outstanding balance reminder */}
        {maxAmount > 0 && (
          <View style={[paySheetStyles.balanceBanner, {
            backgroundColor: isDark ? `${RED}0D` : `${RED}0A`,
            borderColor:     isDark ? `${RED}22` : `${RED}20`,
          }]}>
            <Clock size={13} color={RED} />
            <Text variant="body-xs" style={{ color: RED }}>
              Outstanding Balance:
            </Text>
            <Text variant="body-xs" weight="bold" style={{ color: RED }}>
              {formatCurrency(maxAmount)}
            </Text>
          </View>
        )}

        <BottomSheetScrollView
          style={paySheetStyles.formScroll}
          contentContainerStyle={paySheetStyles.formContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
              {/* Amount presets */}
              {presets.length > 0 && (
                <>
                  <Text
                    variant="body-xs"
                    weight="semibold"
                    style={{ color: labelClr, marginBottom: 8 }}
                  >
                    Quick Amount
                  </Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={paySheetStyles.presetsRow}
                  >
                    {presets.map((p) => (
                      <Pressable
                        key={p.label}
                        style={[paySheetStyles.presetChip, {
                          backgroundColor: isDark ? `${GREEN}1A` : `${GREEN}12`,
                          borderColor:     `${GREEN}35`,
                        }]}
                        onPress={() => setAmount(String(p.value))}
                        accessibilityRole="button"
                      >
                        <Text variant="body-xs" weight="semibold" style={{ color: GREEN }}>
                          {p.label}
                        </Text>
                        <Text variant="body-xs" style={{ color: isDark ? DARK_TEXT_SEC : staticTheme.colors.gray[500] }}>
                          {formatCurrency(p.value)}
                        </Text>
                      </Pressable>
                    ))}
                  </ScrollView>
                </>
              )}

              {/* Amount input */}
              <Text
                variant="body-sm"
                weight="semibold"
                style={[paySheetStyles.fieldLabel, { color: labelClr }]}
              >
                Payment Amount (₱) *
              </Text>
              <View style={[
                paySheetStyles.inputWrap,
                {
                  backgroundColor: inputBg,
                  borderColor: amountErr !== '' ? staticTheme.colors.error[500] : inputBdr,
                },
              ]}>
                <PhilippinePeso size={16} color={textMuted} />
                <TextInput
                  style={[paySheetStyles.input, { color: textMain }]}
                  value={amount}
                  onChangeText={setAmount}
                  placeholder="0.00"
                  placeholderTextColor={isDark ? 'rgba(255,255,255,0.30)' : staticTheme.colors.gray[400]}
                  keyboardType="decimal-pad"
                  returnKeyType="next"
                  accessibilityLabel="Payment amount"
                />
              </View>
              {amountErr !== '' && (
                <Text variant="body-xs" style={{ color: staticTheme.colors.error[500], marginTop: 4 }}>
                  {amountErr}
                </Text>
              )}

              {/* Date */}
              <DatePickerField
                label="Date Paid"
                value={paidAt}
                onChange={setPaidAt}
                maximumDate={new Date()}
                accessibilityLabel="Date paid"
              />

              {/* Notes */}
              <Text
                variant="body-sm"
                weight="semibold"
                style={[paySheetStyles.fieldLabel, { color: labelClr }]}
              >
                Notes (Optional)
              </Text>
              <View style={[
                paySheetStyles.inputWrap,
                paySheetStyles.textAreaWrap,
                { backgroundColor: inputBg, borderColor: inputBdr },
              ]}>
                <FileText size={16} color={textMuted} style={{ marginTop: 2 }} />
                <TextInput
                  style={[paySheetStyles.input, paySheetStyles.textArea, { color: textMain }]}
                  value={notes}
                  onChangeText={setNotes}
                  placeholder="Any notes about this payment..."
                  placeholderTextColor={isDark ? 'rgba(255,255,255,0.30)' : staticTheme.colors.gray[400]}
                  multiline
                  numberOfLines={3}
                  returnKeyType="done"
                  accessibilityLabel="Payment notes"
                />
              </View>
        </BottomSheetScrollView>

        {/* Footer */}
        <View style={[paySheetStyles.footer, {
          borderTopColor: isDark ? DARK_BORDER : staticTheme.colors.gray[200],
          paddingBottom: Math.max(insets.bottom, staticTheme.spacing.md),
        }]}>
          <Pressable
            style={[paySheetStyles.cancelBtn, {
              borderColor: isDark ? DARK_BORDER : staticTheme.colors.gray[200],
            }]}
            onPress={onClose}
            accessibilityRole="button"
          >
            <Text variant="body" weight="medium" style={{ color: textMuted }}>
              Cancel
            </Text>
          </Pressable>
          <Pressable
            style={[paySheetStyles.saveBtn, {
              backgroundColor: isSaving ? `${GREEN}88` : GREEN,
              opacity:         isSaving ? 0.8 : 1,
            }]}
            onPress={handleSave}
            disabled={isSaving}
            accessibilityRole="button"
            accessibilityLabel="Record payment"
          >
            <Text variant="body" weight="bold" style={{ color: '#FFFFFF' }}>
              {isSaving ? 'Saving...' : 'Record Payment'}
            </Text>
          </Pressable>
        </View>
      </BottomSheetModal>
    );
  },
);
RecordPaymentSheet.displayName = 'RecordPaymentSheet';

const paySheetStyles = StyleSheet.create({
  titleRow: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               12,
    paddingHorizontal: staticTheme.spacing.md,
    paddingVertical:   staticTheme.spacing.md,
  },
  titleIcon: {
    width:          40,
    height:         40,
    borderRadius:   12,
    alignItems:     'center',
    justifyContent: 'center',
    flexShrink:     0,
  },
  closeBtn: {
    width:          44,
    height:         44,
    alignItems:     'center',
    justifyContent: 'center',
  },
  balanceBanner: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               6,
    paddingHorizontal: staticTheme.spacing.md,
    paddingVertical:   8,
    borderTopWidth:    1,
    borderBottomWidth: 1,
  },
  formScroll: {
    flex: 1,
  },
  formContent: {
    paddingHorizontal: staticTheme.spacing.md,
    paddingBottom:     staticTheme.spacing.md,
    gap:               4,
  },
  presetsRow: {
    gap:            8,
    paddingBottom:  4,
  },
  presetChip: {
    paddingHorizontal: 12,
    paddingVertical:   8,
    borderRadius:      10,
    borderWidth:       1,
    alignItems:        'center',
    gap:               2,
    minHeight:         44,
    justifyContent:    'center',
  },
  fieldLabel: {
    marginTop:    16,
    marginBottom: 8,
  },
  inputWrap: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               10,
    borderRadius:      12,
    borderWidth:       1,
    paddingHorizontal: 14,
    paddingVertical:   12,
    minHeight:         48,
  },
  textAreaWrap: {
    alignItems: 'flex-start',
    minHeight:  88,
  },
  input: {
    flex:     1,
    fontSize: staticTheme.typography.sizes.base,
    padding:  0,
  },
  textArea: {
    minHeight:         60,
    textAlignVertical: 'top',
  },
  footer: {
    flexDirection:     'row',
    gap:               12,
    paddingHorizontal: staticTheme.spacing.md,
    paddingVertical:   staticTheme.spacing.md,
    borderTopWidth:    1,
  },
  cancelBtn: {
    flex:           1,
    borderRadius:   12,
    borderWidth:    1,
    alignItems:     'center',
    justifyContent: 'center',
    minHeight:      52,
  },
  saveBtn: {
    flex:           2,
    borderRadius:   12,
    alignItems:     'center',
    justifyContent: 'center',
    minHeight:      52,
  },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function CreditCustomerDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const customerId = id ?? '';

  const mode   = useThemeStore(selectThemeMode);
  const isDark = mode === 'dark';

  const violet = isDark ? VIOLET_DARK : VIOLET_LIGHT;

  const customerSummaries = useCreditStore(selectCustomerSummaries);
  const creditSales       = useCreditStore(selectSelectedCustomerSales);
  const payments          = useCreditStore(selectSelectedCustomerPayments);
  const isLoading         = useCreditStore(selectCreditDetailLoading);
  const loadCustomerDetail = useCreditStore(s => s.loadCustomerDetail);
  const clearCustomerDetail = useCreditStore(s => s.clearCustomerDetail);
  const storeRecordPayment  = useCreditStore(s => s.recordPayment);

  const customer: CustomerCreditSummary | null = useMemo(
    () => customerSummaries.find(s => s.customer.id === customerId) ?? null,
    [customerSummaries, customerId],
  );

  const [paySheetVisible, setPaySheetVisible] = useState(false);
  const [isSaving,        setIsSaving]        = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (customerId !== '') {
        void loadCustomerDetail(customerId);
      }
      return () => {
        clearCustomerDetail();
      };
    }, [customerId, loadCustomerDetail, clearCustomerDetail]),
  );

  // Build unified timeline sorted newest first
  const timeline: TimelineEntry[] = useMemo(() => {
    const entries: TimelineEntry[] = [
      ...creditSales.map((s): TimelineEntry => ({ kind: 'credit',  data: s })),
      ...payments.map((p):   TimelineEntry => ({ kind: 'payment', data: p })),
    ];
    return entries.sort((a, b) => {
      const dateA = a.kind === 'credit'
        ? new Date(a.data.createdAt).getTime()
        : new Date((a.data as CreditPayment).paidAt).getTime();
      const dateB = b.kind === 'credit'
        ? new Date(b.data.createdAt).getTime()
        : new Date((b.data as CreditPayment).paidAt).getTime();
      return dateB - dateA; // newest first
    });
  }, [creditSales, payments]);

  const handleRecordPayment = useCallback(
    async (data: { amount: number; notes?: string; paidAt: string }) => {
      if (customer === null) return;
      setIsSaving(true);
      try {
        await storeRecordPayment({
          customerId: customer.customer.id,
          amount:     data.amount,
          ...(data.paidAt !== undefined ? { paidAt: data.paidAt } : {}),
          ...(data.notes  !== undefined ? { notes:  data.notes  } : {}),
        });
        setPaySheetVisible(false);
      } finally {
        setIsSaving(false);
      }
    },
    [customer, storeRecordPayment],
  );

  const rootBg    = isDark ? DARK_ROOT_BG : '#F8F9FF';
  const textMain  = isDark ? DARK_TEXT     : staticTheme.colors.gray[800];
  const textMuted = isDark ? DARK_TEXT_SEC : staticTheme.colors.gray[500];

  // ── FlatList helpers ──────────────────────────────────────────────────────

  const keyExtractor = useCallback(
    (entry: TimelineEntry) =>
      `${entry.kind}-${entry.kind === 'credit' ? entry.data.id : (entry.data as CreditPayment).id}`,
    [],
  );

  const renderEntry = useCallback(
    ({ item }: ListRenderItemInfo<TimelineEntry>) => (
      <TimelineItem entry={item} isDark={isDark} violet={violet} />
    ),
    [isDark, violet],
  );

  // ── List header (everything above the timeline) ───────────────────────────

  const ListHeader = useMemo(() => {
    if (customer === null || isLoading) {
      return (
        <View style={{ gap: 12, padding: staticTheme.spacing.md }}>
          <Skeleton width="100%" height={140} radius={20} isDark={isDark} />
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Skeleton width="31%" height={80} radius={14} isDark={isDark} />
            <Skeleton width="31%" height={80} radius={14} isDark={isDark} />
            <Skeleton width="31%" height={80} radius={14} isDark={isDark} />
          </View>
          <Skeleton width="100%" height={80}  radius={14} isDark={isDark} />
          <Skeleton width="100%" height={80}  radius={14} isDark={isDark} />
        </View>
      );
    }

    const balanceColor = customer.balance > 0 ? RED : GREEN;

    return (
      <>
        {/* ── Customer Hero Card ── */}
        <View style={[headerStyles.heroCard, {
          backgroundColor: isDark ? '#1A1F2E' : '#FFFFFF',
          borderColor:     isDark ? `${violet}22` : `${violet}25`,
          ...(isDark
            ? {
                shadowColor:   violet,
                shadowOffset:  { width: 0, height: 4 },
                shadowOpacity: 0.16,
                shadowRadius:  16,
                elevation:     6,
              }
            : staticTheme.shadows.md),
        }]}>
          {/* Top stripe */}
          <View style={[headerStyles.heroStripe, { backgroundColor: violet }]} />

          <View style={headerStyles.heroInner}>
            {/* Avatar + name/phone */}
            <View style={headerStyles.avatarRow}>
              <View style={[headerStyles.avatar, { backgroundColor: `${violet}20` }]}>
                <Text variant="h4" weight="bold" style={{ color: violet }}>
                  {customer.customer.name.charAt(0).toUpperCase()}
                </Text>
              </View>
              <View style={headerStyles.nameCol}>
                <Text variant="h4" weight="bold" style={{ color: textMain }} numberOfLines={1}>
                  {customer.customer.name}
                </Text>
                {customer.customer.phone !== undefined && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                    <Phone size={12} color={textMuted} />
                    <Text variant="body-sm" style={{ color: textMuted }}>
                      {customer.customer.phone}
                    </Text>
                  </View>
                )}
                {/* Fully paid badge */}
                {customer.isFullyPaid && (
                  <View style={[headerStyles.paidBadge, {
                    backgroundColor: isDark ? `${GREEN}1A` : `${GREEN}15`,
                    borderColor:     `${GREEN}35`,
                  }]}>
                    <CheckCircle2 size={12} color={GREEN} />
                    <Text variant="body-xs" weight="bold" style={{ color: GREEN }}>
                      FULLY PAID
                    </Text>
                  </View>
                )}
              </View>
            </View>

            {/* Outstanding balance */}
            <View style={[headerStyles.balanceBlock, {
              backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : staticTheme.colors.gray[50],
              borderColor:     isDark ? DARK_BORDER : staticTheme.colors.gray[100],
            }]}>
              <Text variant="body-xs" style={{ color: textMuted }}>Outstanding Balance</Text>
              <Text
                variant="h2"
                weight="bold"
                style={{ color: balanceColor }}
                numberOfLines={1}
                adjustsFontSizeToFit
              >
                {formatCurrency(customer.balance)}
              </Text>
            </View>
          </View>
        </View>

        {/* ── Summary cards ── */}
        <SummaryCardRow
          totalCredit={customer.totalCredit}
          totalPaid={customer.totalPaid}
          balance={customer.balance}
          isDark={isDark}
          violet={violet}
        />

        {/* ── Record Payment button ── */}
        {!customer.isFullyPaid && (
          <View style={headerStyles.payBtnWrap}>
            <Pressable
              style={({ pressed }) => [
                headerStyles.payBtn,
                {
                  backgroundColor: pressed ? `${GREEN}DD` : GREEN,
                  shadowColor:     GREEN,
                },
              ]}
              onPress={() => setPaySheetVisible(true)}
              accessibilityRole="button"
              accessibilityLabel="Record a payment"
            >
              <ArrowDownLeft size={20} color="#FFFFFF" />
              <Text variant="body" weight="bold" style={{ color: '#FFFFFF' }}>
                Record Payment
              </Text>
            </Pressable>
          </View>
        )}

        {/* ── Section label ── */}
        <View style={headerStyles.sectionLabel}>
          <Clock size={14} color={violet} />
          <Text
            variant="body-sm"
            weight="semibold"
            style={{ color: isDark ? textMain : staticTheme.colors.gray[700] }}
          >
            Transaction History
          </Text>
          <View style={[headerStyles.countPill, {
            backgroundColor: isDark ? `${violet}18` : `${violet}12`,
            borderColor:     `${violet}30`,
          }]}>
            <Text variant="body-xs" weight="bold" style={{ color: violet }}>
              {String(timeline.length)}
            </Text>
          </View>
        </View>

        {/* Empty timeline */}
        {timeline.length === 0 && (
          <View style={headerStyles.emptyTimeline}>
            <View style={[headerStyles.emptyIcon, { backgroundColor: `${violet}15` }]}>
              <FileText size={28} color={violet} />
            </View>
            <Text
              variant="body"
              weight="semibold"
              style={{ color: isDark ? DARK_TEXT : staticTheme.colors.gray[700] }}
            >
              No transactions yet
            </Text>
            <Text variant="body-xs" style={{ color: textMuted, textAlign: 'center' }}>
              Credit sales and payments will appear here.
            </Text>
          </View>
        )}
      </>
    );
  }, [customer, isLoading, isDark, violet, textMain, textMuted, timeline.length]);

  return (
    <View style={[screenStyles.root, { backgroundColor: rootBg }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />

      <FlatList
        data={timeline}
        keyExtractor={keyExtractor}
        renderItem={renderEntry}
        ListHeaderComponent={ListHeader}
        ListFooterComponent={<View style={{ height: 40 }} />}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={screenStyles.listContent}
      />

      <RecordPaymentSheet
        visible={paySheetVisible}
        isDark={isDark}
        violet={violet}
        maxAmount={customer?.balance ?? 0}
        onClose={() => setPaySheetVisible(false)}
        onSave={handleRecordPayment}
        isSaving={isSaving}
      />

      {/* Saving overlay — shown while payment record mutation is in-flight */}
      <LoaderOverlay visible={isSaving} message="Recording payment…" />
    </View>
  );
}

const headerStyles = StyleSheet.create({
  heroCard: {
    marginHorizontal: staticTheme.spacing.md,
    marginBottom:     staticTheme.spacing.sm,
    borderRadius:     20,
    overflow:         'hidden',
    borderWidth:      1,
  },
  heroStripe: {
    height: 4,
  },
  heroInner: {
    padding: staticTheme.spacing.md,
    gap:     12,
  },
  avatarRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           12,
  },
  avatar: {
    width:          56,
    height:         56,
    borderRadius:   18,
    alignItems:     'center',
    justifyContent: 'center',
    flexShrink:     0,
  },
  nameCol: {
    flex: 1,
    gap:  4,
  },
  paidBadge: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               5,
    paddingHorizontal: 8,
    paddingVertical:   3,
    borderRadius:      staticTheme.borderRadius.full,
    borderWidth:       1,
    alignSelf:         'flex-start',
  },
  balanceBlock: {
    borderRadius: 14,
    borderWidth:  1,
    padding:      14,
    alignItems:   'center',
    gap:          4,
  },
  payBtnWrap: {
    paddingHorizontal: staticTheme.spacing.md,
    paddingBottom:     staticTheme.spacing.sm,
  },
  payBtn: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'center',
    gap:            8,
    borderRadius:   14,
    minHeight:      52,
    shadowOffset:   { width: 0, height: 3 },
    shadowOpacity:  0.30,
    shadowRadius:   10,
    elevation:      5,
  },
  sectionLabel: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               6,
    paddingHorizontal: staticTheme.spacing.md,
    paddingTop:        staticTheme.spacing.sm,
    paddingBottom:     6,
  },
  countPill: {
    borderRadius:      staticTheme.borderRadius.full,
    borderWidth:       1,
    paddingHorizontal: 8,
    paddingVertical:   2,
  },
  emptyTimeline: {
    alignItems:        'center',
    paddingVertical:   32,
    paddingHorizontal: 32,
    gap:               12,
  },
  emptyIcon: {
    width:          64,
    height:         64,
    borderRadius:   20,
    alignItems:     'center',
    justifyContent: 'center',
  },
});

const screenStyles = StyleSheet.create({
  root: {
    flex: 1,
  },
  listContent: {
    paddingTop: staticTheme.spacing.sm,
  },
});
