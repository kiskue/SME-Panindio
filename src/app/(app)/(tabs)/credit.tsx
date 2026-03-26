/**
 * CreditLedgerScreen  ("Utang")
 *
 * Main screen for the Credit Sales / Receivables module.
 *
 * Layout:
 *   1. Outstanding total badge in a hero summary card
 *   2. Customer rankings (FlatList) — sorted by outstanding balance descending
 *      Each card: rank medal, customer name/phone, credit/paid/balance, progress bar
 *   3. FAB — "Add Customer" triggers AddCustomerSheet
 *   4. AddCustomerSheet — name, phone (optional), notes (optional)
 *
 * TypeScript constraints honoured:
 *   - exactOptionalPropertyTypes: conditional spread for every optional prop
 *   - noUncheckedIndexedAccess: `?? fallback` on all array/object access
 *   - noUnusedLocals/Parameters: unused vars prefixed with `_`
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
import { useFocusEffect, useRouter } from 'expo-router';
import {
  CreditCard,
  Plus,
  X,
  User,
  Phone,
  FileText,
  TrendingUp,
  ChevronRight,
  AlertCircle,
} from 'lucide-react-native';
import { Text } from '@/components/atoms/Text';
import {
  useThemeStore,
  selectThemeMode,
  useCreditStore,
  selectCustomerSummaries,
  selectTotalOutstandingBalance,
  selectCreditLoading,
} from '@/store';
import type { CustomerCreditSummary } from '@/types';
import { theme as staticTheme } from '@/core/theme';

// ─── Module accent colour (violet) ────────────────────────────────────────────

const VIOLET_DARK  = '#7C3AED';
const VIOLET_LIGHT = '#6D28D9';
const AMBER        = '#F59E0B';
const GREEN        = '#10B981';
const RED          = '#EF4444';

// ─── Layout constants ─────────────────────────────────────────────────────────

// ─── Color tokens ─────────────────────────────────────────────────────────────

const DARK_CARD_BG  = '#151A27';
const DARK_ROOT_BG  = '#0A0A0F';
const DARK_BORDER   = 'rgba(255,255,255,0.08)';
const DARK_TEXT     = '#F1F5F9';
const DARK_TEXT_SEC = '#94A3B8';

// ─── Types imported from @/types ──────────────────────────────────────────────
// CustomerCreditSummary shape:
//   { customer: CreditCustomer, totalCredit, totalPaid, balance, isFullyPaid }

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatCurrency(value: number): string {
  return `₱${value.toLocaleString('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}
// suppress unused — used as fallback reference
void todayISO;

// ─── Skeleton ─────────────────────────────────────────────────────────────────

const Skeleton = React.memo<{
  width:   number | `${number}%`;
  height:  number;
  radius?: number;
  isDark:  boolean;
}>(({ width, height, radius = 8, isDark }) => {
  const anim = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1,   duration: 800, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0.4, duration: 800, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [anim]);

  return (
    <Animated.View style={{ opacity: anim }}>
      <View style={{ width, height, borderRadius: radius, backgroundColor: isDark ? '#2A3347' : staticTheme.colors.gray[200] }} />
    </Animated.View>
  );
});
Skeleton.displayName = 'CreditSkeleton';

// ─── Medal colours for top-3 ranks ────────────────────────────────────────────

function medalColor(rank: number): string {
  if (rank === 1) return '#FFD700';
  if (rank === 2) return '#C0C0C0';
  if (rank === 3) return '#CD7F32';
  return '';
}

// ─── Customer Rank Card ────────────────────────────────────────────────────────

interface RankCardProps {
  item:   CustomerCreditSummary;
  rank:   number;
  isDark: boolean;
  violet: string;
  onPress: () => void;
}

const RankCard = React.memo<RankCardProps>(({ item, rank, isDark, violet, onPress }) => {
  const cardBg    = isDark ? DARK_CARD_BG : '#FFFFFF';
  const border    = isDark ? DARK_BORDER  : staticTheme.colors.gray[200];
  const textMain  = isDark ? DARK_TEXT     : staticTheme.colors.gray[800];
  const textMuted = isDark ? DARK_TEXT_SEC : staticTheme.colors.gray[500];

  const medal   = medalColor(rank);
  const hasMedal = medal !== '';

  // Progress: what fraction of totalCredit has been paid
  const progressFraction =
    item.totalCredit > 0 ? Math.min(1, item.totalPaid / item.totalCredit) : 1;

  const balanceColor = item.isFullyPaid ? GREEN : (item.balance >= 1000 ? RED : AMBER);

  return (
    <Pressable
      style={({ pressed }) => [
        rankCardStyles.card,
        {
          backgroundColor: cardBg,
          borderColor:     hasMedal
            ? (isDark ? `${medal}28` : `${medal}25`)
            : border,
          opacity: pressed ? 0.88 : 1,
        },
        isDark && {
          shadowColor:   violet,
          shadowOffset:  { width: 0, height: 2 },
          shadowOpacity: 0.08,
          shadowRadius:  8,
          elevation:     3,
        },
      ]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`View credit details for ${item.customer.name}`}
    >
      {/* Left accent bar — medal color or violet */}
      <View style={[rankCardStyles.accentBar, {
        backgroundColor: hasMedal ? medal : violet,
      }]} />

      <View style={rankCardStyles.body}>
        {/* Top row: rank badge + customer info + balance + chevron */}
        <View style={rankCardStyles.topRow}>
          {/* Rank badge */}
          <View style={[rankCardStyles.rankBadge, {
            backgroundColor: hasMedal ? `${medal}22` : (isDark ? `${violet}1A` : `${violet}12`),
            borderColor:     hasMedal ? `${medal}44` : `${violet}30`,
          }]}>
            <Text
              variant="body-xs"
              weight="bold"
              style={{ color: hasMedal ? medal : violet }}
            >
              {`#${rank}`}
            </Text>
          </View>

          {/* Customer name + phone */}
          <View style={rankCardStyles.nameWrap}>
            <Text
              variant="body"
              weight="semibold"
              style={{ color: textMain }}
              numberOfLines={1}
            >
              {item.customer.name}
            </Text>
            {item.customer.phone !== undefined && (
              <View style={rankCardStyles.phonePill}>
                <Phone size={10} color={textMuted} />
                <Text variant="body-xs" style={{ color: textMuted }}>
                  {item.customer.phone}
                </Text>
              </View>
            )}
          </View>

          {/* Balance */}
          <View style={rankCardStyles.balanceWrap}>
            {item.isFullyPaid ? (
              <View style={[rankCardStyles.paidChip, {
                backgroundColor: isDark ? `${GREEN}1A` : `${GREEN}15`,
                borderColor:     `${GREEN}35`,
              }]}>
                <Text variant="body-xs" weight="bold" style={{ color: GREEN }}>
                  FULLY PAID
                </Text>
              </View>
            ) : (
              <Text
                variant="h6"
                weight="bold"
                style={{ color: balanceColor }}
                numberOfLines={1}
                adjustsFontSizeToFit
              >
                {formatCurrency(item.balance)}
              </Text>
            )}
            <ChevronRight size={16} color={textMuted} />
          </View>
        </View>

        {/* Progress bar */}
        <View style={[rankCardStyles.progressTrack, {
          backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : staticTheme.colors.gray[100],
        }]}>
          <View
            style={[rankCardStyles.progressFill, {
              width:           `${Math.round(progressFraction * 100)}%`,
              backgroundColor: item.isFullyPaid ? GREEN : violet,
            }]}
          />
        </View>

        {/* Credit / paid / balance row */}
        <View style={rankCardStyles.statRow}>
          <View style={rankCardStyles.statItem}>
            <Text variant="body-xs" style={{ color: textMuted }}>Credit</Text>
            <Text variant="body-xs" weight="semibold" style={{ color: textMain }}>
              {formatCurrency(item.totalCredit)}
            </Text>
          </View>
          <View style={[rankCardStyles.statDivider, { backgroundColor: isDark ? DARK_BORDER : staticTheme.colors.gray[200] }]} />
          <View style={rankCardStyles.statItem}>
            <Text variant="body-xs" style={{ color: textMuted }}>Paid</Text>
            <Text variant="body-xs" weight="semibold" style={{ color: GREEN }}>
              {formatCurrency(item.totalPaid)}
            </Text>
          </View>
          <View style={[rankCardStyles.statDivider, { backgroundColor: isDark ? DARK_BORDER : staticTheme.colors.gray[200] }]} />
          <View style={rankCardStyles.statItem}>
            <Text variant="body-xs" style={{ color: textMuted }}>Balance</Text>
            <Text
              variant="body-xs"
              weight="semibold"
              style={{ color: item.isFullyPaid ? GREEN : balanceColor }}
            >
              {formatCurrency(item.balance)}
            </Text>
          </View>
        </View>
      </View>
    </Pressable>
  );
});
RankCard.displayName = 'RankCard';

const rankCardStyles = StyleSheet.create({
  card: {
    flexDirection:    'row',
    borderRadius:     16,
    marginHorizontal: staticTheme.spacing.md,
    marginVertical:   5,
    overflow:         'hidden',
    borderWidth:      1,
  },
  accentBar: {
    width:    3,
    flexShrink: 0,
  },
  body: {
    flex:              1,
    paddingHorizontal: staticTheme.spacing.md,
    paddingVertical:   12,
    gap:               10,
  },
  topRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           10,
  },
  rankBadge: {
    borderRadius:      8,
    borderWidth:       1,
    paddingHorizontal: 8,
    paddingVertical:   4,
    minWidth:          36,
    alignItems:        'center',
    flexShrink:        0,
  },
  nameWrap: {
    flex:    1,
    gap:     3,
    minWidth: 0,
  },
  phonePill: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           3,
  },
  balanceWrap: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           6,
    flexShrink:    0,
  },
  paidChip: {
    borderRadius:      staticTheme.borderRadius.full,
    borderWidth:       1,
    paddingHorizontal: 8,
    paddingVertical:   3,
  },
  progressTrack: {
    height:       8,
    borderRadius: 4,
    overflow:     'hidden',
  },
  progressFill: {
    height:       8,
    borderRadius: 4,
  },
  statRow: {
    flexDirection: 'row',
    alignItems:    'center',
  },
  statItem: {
    flex:    1,
    gap:     2,
    alignItems: 'center',
  },
  statDivider: {
    width:  1,
    height: 24,
    marginHorizontal: 4,
  },
});

// ─── Hero Summary Card ─────────────────────────────────────────────────────────

const HeroCard = React.memo<{
  totalOutstanding: number;
  totalCustomers:   number;
  fullyPaid:        number;
  hasBalance:       number;
  isDark:           boolean;
  violet:           string;
}>(({ totalOutstanding, totalCustomers, fullyPaid, hasBalance, isDark, violet }) => {
  const textMuted = isDark ? DARK_TEXT_SEC : staticTheme.colors.gray[500];
  const cardBg    = isDark ? '#1A1F2E' : '#FFFFFF';

  return (
    <View style={[heroStyles.card, {
      backgroundColor: cardBg,
      borderColor:     isDark ? `${violet}22` : `${violet}25`,
      ...(isDark
        ? {
            shadowColor:   violet,
            shadowOffset:  { width: 0, height: 4 },
            shadowOpacity: 0.18,
            shadowRadius:  16,
            elevation:     6,
          }
        : staticTheme.shadows.md),
    }]}>
      {/* Top stripe */}
      <View style={[heroStyles.topStripe, { backgroundColor: violet }]} />

      <View style={heroStyles.inner}>
        {/* Icon + label */}
        <View style={heroStyles.labelRow}>
          <View style={[heroStyles.iconPill, { backgroundColor: `${violet}1A` }]}>
            <CreditCard size={20} color={violet} />
          </View>
          <Text variant="body-sm" weight="semibold" style={{ color: violet }}>
            Total Outstanding
          </Text>
        </View>

        {/* Big balance number */}
        <Text
          variant="h2"
          weight="bold"
          style={{ color: totalOutstanding > 0 ? RED : GREEN, marginTop: 4 }}
          numberOfLines={1}
          adjustsFontSizeToFit
        >
          {formatCurrency(totalOutstanding)}
        </Text>

        {/* Stat pills */}
        <View style={heroStyles.pillRow}>
          <View style={[heroStyles.pill, {
            backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : staticTheme.colors.gray[50],
            borderColor:     isDark ? DARK_BORDER : staticTheme.colors.gray[200],
          }]}>
            <User size={12} color={textMuted} />
            <Text variant="body-xs" style={{ color: textMuted }}>{totalCustomers} Customers</Text>
          </View>
          <View style={[heroStyles.pill, {
            backgroundColor: isDark ? `${AMBER}0D` : `${AMBER}0F`,
            borderColor:     isDark ? `${AMBER}28` : `${AMBER}30`,
          }]}>
            <AlertCircle size={12} color={AMBER} />
            <Text variant="body-xs" style={{ color: AMBER }}>{hasBalance} Has Balance</Text>
          </View>
          <View style={[heroStyles.pill, {
            backgroundColor: isDark ? `${GREEN}0D` : `${GREEN}0F`,
            borderColor:     isDark ? `${GREEN}28` : `${GREEN}30`,
          }]}>
            <TrendingUp size={12} color={GREEN} />
            <Text variant="body-xs" style={{ color: GREEN }}>{fullyPaid} Fully Paid</Text>
          </View>
        </View>

        {/* Muted subtitle */}
        <Text variant="body-xs" style={{ color: textMuted, marginTop: 2 }}>
          {totalOutstanding > 0 ? 'Monitor and collect outstanding credit balances.' : 'All balances have been settled.'}
        </Text>
      </View>
    </View>
  );
});
HeroCard.displayName = 'HeroCard';

const heroStyles = StyleSheet.create({
  card: {
    marginHorizontal: staticTheme.spacing.md,
    marginBottom:     staticTheme.spacing.sm,
    borderRadius:     20,
    overflow:         'hidden',
    borderWidth:      1,
  },
  topStripe: {
    height: 4,
  },
  inner: {
    padding:    staticTheme.spacing.md,
    gap:        10,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           8,
  },
  iconPill: {
    width:          36,
    height:         36,
    borderRadius:   12,
    alignItems:     'center',
    justifyContent: 'center',
  },
  pillRow: {
    flexDirection: 'row',
    gap:           6,
    flexWrap:      'wrap',
  },
  pill: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               5,
    paddingHorizontal: 10,
    paddingVertical:   5,
    borderRadius:      staticTheme.borderRadius.full,
    borderWidth:       1,
  },
});

// ─── Add Customer Sheet ────────────────────────────────────────────────────────

interface AddCustomerSheetProps {
  visible:  boolean;
  isDark:   boolean;
  violet:   string;
  onClose:  () => void;
  onSave:   (data: { name: string; phone?: string; notes?: string }) => Promise<void>;
  isSaving: boolean;
}

const AddCustomerSheet = React.memo<AddCustomerSheetProps>(
  ({ visible, isDark, violet, onClose, onSave, isSaving }) => {
    const modalRef = useRef<BottomSheetModalRef>(null);
    const insets   = useSafeAreaInsets();

    const cardBg    = isDark ? '#1C2333' : '#FFFFFF';
    const inputBg   = isDark ? '#242D42' : '#F8F9FC';
    const inputBdr  = isDark ? 'rgba(255,255,255,0.12)' : staticTheme.colors.gray[200];
    const textMain  = isDark ? DARK_TEXT     : staticTheme.colors.gray[800];
    const textMuted = isDark ? DARK_TEXT_SEC : staticTheme.colors.gray[500];
    const labelClr  = isDark ? 'rgba(255,255,255,0.60)' : staticTheme.colors.gray[600];

    const [name,     setName]     = useState('');
    const [phone,    setPhone]    = useState('');
    const [notes,    setNotes]    = useState('');
    const [nameErr,  setNameErr]  = useState('');

    useEffect(() => {
      if (visible) {
        modalRef.current?.present();
      } else {
        modalRef.current?.dismiss();
        setName('');
        setPhone('');
        setNotes('');
        setNameErr('');
      }
    }, [visible]);

    const validate = useCallback((): boolean => {
      if (name.trim() === '') {
        setNameErr('Customer name is required');
        return false;
      }
      setNameErr('');
      return true;
    }, [name]);

    const handleSave = useCallback(async () => {
      if (!validate()) return;
      await onSave({
        name: name.trim(),
        ...(phone.trim() !== '' ? { phone: phone.trim() } : {}),
        ...(notes.trim() !== '' ? { notes: notes.trim() } : {}),
      });
    }, [validate, name, phone, notes, onSave]);

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

    const snapPoints      = useMemo(() => ['75%'], []);
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
        <View style={addSheetStyles.titleRow}>
          <View style={[addSheetStyles.titleIcon, { backgroundColor: `${violet}1A` }]}>
            <User size={18} color={violet} />
          </View>
          <Text variant="h5" weight="bold" style={{ color: textMain, flex: 1 }}>
            Add Credit Customer
          </Text>
          <Pressable
            style={({ pressed }) => [addSheetStyles.closeBtn, { opacity: pressed ? 0.6 : 1 }]}
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Close"
          >
            <X size={20} color={textMuted} />
          </Pressable>
        </View>

        <BottomSheetScrollView
          style={addSheetStyles.formScroll}
          contentContainerStyle={addSheetStyles.formContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
              {/* Name */}
              <Text
                variant="body-sm"
                weight="semibold"
                style={{ color: labelClr, marginBottom: 8 }}
              >
                Customer Name *
              </Text>
              <View style={[
                addSheetStyles.inputWrap,
                {
                  backgroundColor: inputBg,
                  borderColor:     nameErr !== '' ? staticTheme.colors.error[500] : inputBdr,
                },
              ]}>
                <User size={16} color={textMuted} />
                <TextInput
                  style={[addSheetStyles.input, { color: textMain }]}
                  value={name}
                  onChangeText={setName}
                  placeholder="e.g. Maria Santos"
                  placeholderTextColor={isDark ? 'rgba(255,255,255,0.30)' : staticTheme.colors.gray[400]}
                  returnKeyType="next"
                  accessibilityLabel="Customer name"
                />
              </View>
              {nameErr !== '' && (
                <Text
                  variant="body-xs"
                  style={{ color: staticTheme.colors.error[500], marginTop: 4 }}
                >
                  {nameErr}
                </Text>
              )}

              {/* Phone */}
              <Text
                variant="body-sm"
                weight="semibold"
                style={[addSheetStyles.fieldLabel, { color: labelClr }]}
              >
                Phone (Optional)
              </Text>
              <View style={[
                addSheetStyles.inputWrap,
                { backgroundColor: inputBg, borderColor: inputBdr },
              ]}>
                <Phone size={16} color={textMuted} />
                <TextInput
                  style={[addSheetStyles.input, { color: textMain }]}
                  value={phone}
                  onChangeText={setPhone}
                  placeholder="09XXXXXXXXX"
                  placeholderTextColor={isDark ? 'rgba(255,255,255,0.30)' : staticTheme.colors.gray[400]}
                  keyboardType="phone-pad"
                  returnKeyType="next"
                  accessibilityLabel="Phone number"
                />
              </View>

              {/* Notes */}
              <Text
                variant="body-sm"
                weight="semibold"
                style={[addSheetStyles.fieldLabel, { color: labelClr }]}
              >
                Notes (Optional)
              </Text>
              <View style={[
                addSheetStyles.inputWrap,
                addSheetStyles.textAreaWrap,
                { backgroundColor: inputBg, borderColor: inputBdr },
              ]}>
                <FileText size={16} color={textMuted} style={{ marginTop: 2 }} />
                <TextInput
                  style={[addSheetStyles.input, addSheetStyles.textArea, { color: textMain }]}
                  value={notes}
                  onChangeText={setNotes}
                  placeholder="Any notes about this customer..."
                  placeholderTextColor={isDark ? 'rgba(255,255,255,0.30)' : staticTheme.colors.gray[400]}
                  multiline
                  numberOfLines={3}
                  returnKeyType="done"
                  accessibilityLabel="Notes"
                />
              </View>
        </BottomSheetScrollView>

        {/* Footer */}
        <View style={[addSheetStyles.footer, {
          borderTopColor: isDark ? DARK_BORDER : staticTheme.colors.gray[200],
          paddingBottom: Math.max(insets.bottom, staticTheme.spacing.md),
        }]}>
          <Pressable
            style={[addSheetStyles.cancelBtn, {
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
            style={[addSheetStyles.saveBtn, {
              backgroundColor: isSaving ? `${violet}88` : violet,
              opacity:         isSaving ? 0.8 : 1,
            }]}
            onPress={handleSave}
            disabled={isSaving}
            accessibilityRole="button"
            accessibilityLabel="Save customer"
          >
            {isSaving ? (
              <Text variant="body" weight="bold" style={{ color: '#FFFFFF' }}>
                Saving...
              </Text>
            ) : (
              <Text variant="body" weight="bold" style={{ color: '#FFFFFF' }}>
                Add Customer
              </Text>
            )}
          </Pressable>
        </View>
      </BottomSheetModal>
    );
  },
);
AddCustomerSheet.displayName = 'AddCustomerSheet';

const addSheetStyles = StyleSheet.create({
  titleRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           12,
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
  formScroll: {
    flex: 1,
  },
  formContent: {
    paddingHorizontal: staticTheme.spacing.md,
    paddingBottom:     staticTheme.spacing.md,
    gap:               4,
  },
  fieldLabel: {
    marginTop:    16,
    marginBottom: 8,
  },
  inputWrap: {
    flexDirection:  'row',
    alignItems:     'center',
    gap:            10,
    borderRadius:   12,
    borderWidth:    1,
    paddingHorizontal: 14,
    paddingVertical:   12,
    minHeight:      48,
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
    minHeight: 60,
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
    flex:              1,
    borderRadius:      12,
    borderWidth:       1,
    alignItems:        'center',
    justifyContent:    'center',
    minHeight:         52,
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

export default function CreditLedgerScreen() {
  const mode   = useThemeStore(selectThemeMode);
  const isDark = mode === 'dark';
  const router = useRouter();

  const violet = isDark ? VIOLET_DARK : VIOLET_LIGHT;

  const customers       = useCreditStore(selectCustomerSummaries);
  const totalOutstanding = useCreditStore(selectTotalOutstandingBalance);
  const isLoading       = useCreditStore(selectCreditLoading);
  const addCustomer     = useCreditStore(s => s.addCustomer);
  const refreshAll      = useCreditStore(s => s.refreshAll);

  const [sheetVisible, setSheetVisible] = useState(false);
  const [isSaving,     setIsSaving]     = useState(false);

  useFocusEffect(
    useCallback(() => {
      void refreshAll();
    }, [refreshAll]),
  );

  // selectCustomerSummaries already sorts by balance desc; keep local for FlatList data
  const ranked = customers;

  const fullyPaid  = useMemo(() => customers.filter(c => c.isFullyPaid).length,  [customers]);
  const hasBalance = useMemo(() => customers.filter(c => !c.isFullyPaid).length, [customers]);

  const handleAddCustomer = useCallback(
    async (data: { name: string; phone?: string; notes?: string }) => {
      setIsSaving(true);
      try {
        await addCustomer({ name: data.name, ...(data.phone !== undefined ? { phone: data.phone } : {}), ...(data.notes !== undefined ? { notes: data.notes } : {}) });
        setSheetVisible(false);
      } finally {
        setIsSaving(false);
      }
    },
    [addCustomer],
  );

  const rootBg  = isDark ? DARK_ROOT_BG : '#F8F9FF';
  const textMain = isDark ? DARK_TEXT : staticTheme.colors.gray[800];
  const textMuted = isDark ? DARK_TEXT_SEC : staticTheme.colors.gray[500];

  // ── FlatList helpers ──────────────────────────────────────────────────────

  const keyExtractor = useCallback(
    (item: CustomerCreditSummary) => item.customer.id,
    [],
  );

  const renderItem = useCallback(
    ({ item, index }: ListRenderItemInfo<CustomerCreditSummary>) => (
      <RankCard
        item={item}
        rank={index + 1}
        isDark={isDark}
        violet={violet}
        onPress={() =>
          router.push(`/(app)/(tabs)/credit/${item.customer.id}` as Parameters<typeof router.push>[0])
        }
      />
    ),
    [isDark, violet, router],
  );

  const ListHeader = useMemo(
    () => (
      <>
        {/* Hero summary */}
        <HeroCard
          totalOutstanding={totalOutstanding}
          totalCustomers={customers.length}
          fullyPaid={fullyPaid}
          hasBalance={hasBalance}
          isDark={isDark}
          violet={violet}
        />

        {/* Section label */}
        <View style={screenStyles.sectionHeader}>
          <TrendingUp size={14} color={violet} />
          <Text variant="body-sm" weight="semibold" style={{ color: isDark ? textMain : staticTheme.colors.gray[700] }}>
            Customer Rankings
          </Text>
          <Text variant="body-xs" style={{ color: textMuted }}>
            by outstanding balance
          </Text>
        </View>

        {/* Skeleton state */}
        {isLoading && customers.length === 0 && (
          <View style={{ gap: 10, marginHorizontal: staticTheme.spacing.md }}>
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} width="100%" height={110} radius={16} isDark={isDark} />
            ))}
          </View>
        )}

        {/* Empty state */}
        {!isLoading && customers.length === 0 && (
          <View style={screenStyles.emptyState}>
            <View style={[screenStyles.emptyIcon, { backgroundColor: `${violet}15` }]}>
              <CreditCard size={32} color={violet} />
            </View>
            <Text variant="h5" weight="semibold" style={{ color: isDark ? DARK_TEXT : staticTheme.colors.gray[700] }}>
              No Credit Customers Yet
            </Text>
            <Text variant="body-sm" style={{ color: textMuted, textAlign: 'center' }}>
              Tap the + button to add your first credit customer and start tracking balances.
            </Text>
          </View>
        )}
      </>
    ),
    [
      totalOutstanding, customers.length, fullyPaid, hasBalance,
      isDark, violet, isLoading, textMain, textMuted,
    ],
  );

  const ListFooter = <View style={{ height: 100 }} />;

  return (
    <View style={[screenStyles.root, { backgroundColor: rootBg }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />

      <FlatList
        data={ranked}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        ListHeaderComponent={ListHeader}
        ListFooterComponent={ListFooter}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={screenStyles.listContent}
      />

      {/* FAB */}
      <Pressable
        style={({ pressed }) => [
          screenStyles.fab,
          {
            backgroundColor: violet,
            opacity:         pressed ? 0.85 : 1,
            shadowColor:     violet,
          },
        ]}
        onPress={() => setSheetVisible(true)}
        accessibilityRole="button"
        accessibilityLabel="Add credit customer"
      >
        <Plus size={24} color="#FFFFFF" />
      </Pressable>

      {/* Add Customer Sheet */}
      <AddCustomerSheet
        visible={sheetVisible}
        isDark={isDark}
        violet={violet}
        onClose={() => setSheetVisible(false)}
        onSave={handleAddCustomer}
        isSaving={isSaving}
      />
    </View>
  );
}

const screenStyles = StyleSheet.create({
  root: {
    flex: 1,
  },
  listContent: {
    paddingTop: staticTheme.spacing.sm,
  },
  sectionHeader: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               6,
    paddingHorizontal: staticTheme.spacing.md,
    paddingTop:        staticTheme.spacing.sm,
    paddingBottom:     6,
  },
  emptyState: {
    alignItems:   'center',
    paddingTop:   48,
    paddingBottom: 32,
    paddingHorizontal: 32,
    gap:          16,
  },
  emptyIcon: {
    width:          80,
    height:         80,
    borderRadius:   24,
    alignItems:     'center',
    justifyContent: 'center',
  },
  fab: {
    position:       'absolute',
    bottom:         28,
    right:          24,
    width:          60,
    height:         60,
    borderRadius:   30,
    alignItems:     'center',
    justifyContent: 'center',
    shadowOffset:   { width: 0, height: 4 },
    shadowOpacity:  0.40,
    shadowRadius:   12,
    elevation:      8,
  },
});
