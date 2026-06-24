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
  useState,
} from 'react';
import {
  View,
  FlatList,
  StyleSheet,
  Pressable,
  TextInput,
  ListRenderItemInfo,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BottomSheet } from '@/components/organisms/BottomSheet';
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
import { useTranslation } from 'react-i18next';
import { Text } from '@/components/atoms/Text';
import { SkeletonBox } from '@/components/atoms/SkeletonBox';
import { ProgressBar } from '@/components/atoms/ProgressBar';
import { LoaderOverlay } from '@/components/molecules/LoaderOverlay';
import {
  useCreditStore,
  selectCustomerSummaries,
  selectTotalOutstandingBalance,
  selectCreditLoading,
} from '@/store';
import type { CustomerCreditSummary } from '@/types';
import { theme as staticTheme, useThemeMode } from '@/core/theme';
import { formatCurrency } from '@/core/utils/format';

// ─── Module accent colour (violet) ────────────────────────────────────────────

const VIOLET_DARK  = '#7C3AED';
const VIOLET_LIGHT = '#6D28D9';
const AMBER        = '#F59E0B';
const GREEN        = '#10B981';
const RED          = '#EF4444';

// ─── Filter type ──────────────────────────────────────────────────────────────

type CustomerFilter = 'all' | 'has_balance' | 'fully_paid';

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

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}
// suppress unused — used as fallback reference
void todayISO;

// ─── Skeleton — delegated to shared SkeletonBox atom ─────────────────────────

const Skeleton = React.memo<{
  width:   number | `${number}%`;
  height:  number;
  radius?: number;
  isDark:  boolean; // kept for call-site compat
}>(({ width, height, radius = 8, isDark: _isDark }) => (
  <SkeletonBox width={width} height={height} borderRadius={radius} />
));
Skeleton.displayName = 'CreditSkeleton';

// ─── Medal colours for top-3 ranks ────────────────────────────────────────────

function medalColor(rank: number): string {
  if (rank === 1) return '#FFD700';
  if (rank === 2) return '#C0C0C0';
  if (rank === 3) return '#CD7F32';
  return '';
}
// ─── Small translated sub-components (hooks require function components) ──────

const FullyPaidChip: React.FC<{ isDark: boolean }> = ({ isDark }) => {
  const { t } = useTranslation();
  return (
    <View style={[rankChipStyles.chip, {
      backgroundColor: isDark ? `${GREEN}1A` : `${GREEN}15`,
      borderColor:     `${GREEN}35`,
    }]}>
      <Text variant="body-xs" weight="bold" style={{ color: GREEN }}>
        {t('credit.timeline.fullyPaidTag')}
      </Text>
    </View>
  );
};

const rankChipStyles = StyleSheet.create({
  chip: {
    borderRadius:      staticTheme.borderRadius.full,
    borderWidth:       1,
    paddingHorizontal: 8,
    paddingVertical:   3,
  },
});

interface StatRowProps {
  item:        CustomerCreditSummary;
  isDark:      boolean;
  textMuted:   string;
  textMain:    string;
  balanceColor:string;
}

const StatRow: React.FC<StatRowProps> = ({ item, isDark, textMuted, textMain, balanceColor }) => {
  const { t } = useTranslation();
  const divBg = isDark ? DARK_BORDER : staticTheme.colors.gray[200];
  return (
    <View style={statRowStyles.row}>
      <View style={statRowStyles.col}>
        <Text variant="body-xs" style={{ color: textMuted }}>{t('credit.detail.totalCredit')}</Text>
        <Text variant="body-xs" weight="semibold" style={{ color: textMain }}>
          {formatCurrency(item.totalCredit)}
        </Text>
      </View>
      <View style={[statRowStyles.divider, { backgroundColor: divBg }]} />
      <View style={statRowStyles.col}>
        <Text variant="body-xs" style={{ color: textMuted }}>{t('common.paid')}</Text>
        <Text variant="body-xs" weight="semibold" style={{ color: GREEN }}>
          {formatCurrency(item.totalPaid)}
        </Text>
      </View>
      <View style={[statRowStyles.divider, { backgroundColor: divBg }]} />
      <View style={statRowStyles.col}>
        <Text variant="body-xs" style={{ color: textMuted }}>{t('common.balance')}</Text>
        <Text variant="body-xs" weight="semibold" style={{ color: item.isFullyPaid ? GREEN : balanceColor }}>
          {formatCurrency(item.balance)}
        </Text>
      </View>
    </View>
  );
};

const statRowStyles = StyleSheet.create({
  row:     { flexDirection: 'row', alignItems: 'center' },
  col:     { flex: 1, gap: 2, alignItems: 'center' },
  divider: { width: 1, height: 24, marginHorizontal: 4 },
});

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
              <FullyPaidChip isDark={isDark} />
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
        <ProgressBar
          fraction={progressFraction}
          color={item.isFullyPaid ? GREEN : violet}
          trackColor={isDark ? 'rgba(255,255,255,0.06)' : staticTheme.colors.gray[100]}
          height={8}
        />
        {/* Credit / paid / balance row */}
        <StatRow item={item} isDark={isDark} textMuted={textMuted} textMain={textMain} balanceColor={balanceColor} />
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
  totalCredit:    number;
  totalPaid:      number;
  totalBalance:   number;
  totalCustomers: number;
  fullyPaid:      number;
  hasBalance:     number;
  activeFilter:   CustomerFilter;
  onFilterChange: (filter: CustomerFilter) => void;
  isDark:         boolean;
  violet:         string;
}>(({ totalCredit, totalPaid, totalBalance, totalCustomers, fullyPaid, hasBalance,
       activeFilter, onFilterChange, isDark, violet }) => {
  const { t }     = useTranslation();
  const textMuted = isDark ? DARK_TEXT_SEC : staticTheme.colors.gray[500];
  const cardBg    = isDark ? '#1A1F2E' : '#FFFFFF';
  const divider   = isDark ? DARK_BORDER : staticTheme.colors.gray[200];

  const allActive     = activeFilter === 'all';
  const balanceActive = activeFilter === 'has_balance';
  const paidActive    = activeFilter === 'fully_paid';

  const handlePillPress = useCallback(
    (filter: CustomerFilter) => {
      onFilterChange(activeFilter === filter ? 'all' : filter);
    },
    [activeFilter, onFilterChange],
  );

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
            {t('credit.summary.title')}
          </Text>
        </View>

        {/* 3-column stat row */}
        <View style={[heroStyles.statBlock, {
          backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : staticTheme.colors.gray[50],
          borderColor:     divider,
        }]}>
          <View style={heroStyles.statCol}>
            <Text variant="body-xs" style={{ color: textMuted }} numberOfLines={1}>
              {t('credit.summary.outstanding')}
            </Text>
            <Text variant="body-sm" weight="bold" style={{ color: violet }} numberOfLines={1} adjustsFontSizeToFit>
              {formatCurrency(totalCredit)}
            </Text>
          </View>

          <View style={[heroStyles.statDivider, { backgroundColor: divider }]} />

          <View style={heroStyles.statCol}>
            <Text variant="body-xs" style={{ color: textMuted }} numberOfLines={1}>
              {t('credit.summary.totalPaid')}
            </Text>
            <Text variant="body-sm" weight="bold" style={{ color: GREEN }} numberOfLines={1} adjustsFontSizeToFit>
              {formatCurrency(totalPaid)}
            </Text>
          </View>

          <View style={[heroStyles.statDivider, { backgroundColor: divider }]} />

          <View style={heroStyles.statCol}>
            <Text variant="body-xs" style={{ color: textMuted }} numberOfLines={1}>
              {t('credit.summary.balance')}
            </Text>
            <Text variant="body-sm" weight="bold" style={{ color: totalBalance > 0 ? RED : GREEN }} numberOfLines={1} adjustsFontSizeToFit>
              {formatCurrency(totalBalance)}
            </Text>
          </View>
        </View>

        {/* Filter pills — tappable; active pill re-tapped resets to 'all' */}
        <View style={heroStyles.pillRow}>
          {/* All Customers */}
          <Pressable
            style={({ pressed }) => [
              heroStyles.pill,
              {
                backgroundColor: allActive
                  ? (isDark ? `${violet}30` : `${violet}18`)
                  : (isDark ? 'rgba(255,255,255,0.05)' : staticTheme.colors.gray[50]),
                borderColor: allActive
                  ? violet
                  : (isDark ? DARK_BORDER : staticTheme.colors.gray[200]),
                opacity: pressed ? 0.70 : 1,
              },
            ]}
            onPress={() => onFilterChange('all')}
            accessibilityRole="button"
            accessibilityLabel="Show all customers"
            accessibilityState={{ selected: allActive }}
          >
            <User size={12} color={allActive ? violet : textMuted} />
            <Text
              variant="body-xs"
              weight={allActive ? 'semibold' : 'normal'}
              style={{ color: allActive ? violet : textMuted }}
            >
              {`${totalCustomers} ${t('credit.filters.all')}`}
            </Text>
          </Pressable>

          {/* Has Balance */}
          <Pressable
            style={({ pressed }) => [
              heroStyles.pill,
              {
                backgroundColor: balanceActive
                  ? (isDark ? `${AMBER}28` : `${AMBER}1A`)
                  : (isDark ? `${AMBER}0D` : `${AMBER}0F`),
                borderColor: balanceActive
                  ? AMBER
                  : (isDark ? `${AMBER}28` : `${AMBER}30`),
                opacity: pressed ? 0.70 : 1,
              },
            ]}
            onPress={() => handlePillPress('has_balance')}
            accessibilityRole="button"
            accessibilityLabel="Filter customers with balance"
            accessibilityState={{ selected: balanceActive }}
          >
            <AlertCircle size={12} color={AMBER} />
            <Text
              variant="body-xs"
              weight={balanceActive ? 'semibold' : 'normal'}
              style={{ color: AMBER }}
            >
              {`${hasBalance} ${t('credit.filters.hasBalance')}`}
            </Text>
          </Pressable>

          {/* Fully Paid */}
          <Pressable
            style={({ pressed }) => [
              heroStyles.pill,
              {
                backgroundColor: paidActive
                  ? (isDark ? `${GREEN}28` : `${GREEN}1A`)
                  : (isDark ? `${GREEN}0D` : `${GREEN}0F`),
                borderColor: paidActive
                  ? GREEN
                  : (isDark ? `${GREEN}28` : `${GREEN}30`),
                opacity: pressed ? 0.70 : 1,
              },
            ]}
            onPress={() => handlePillPress('fully_paid')}
            accessibilityRole="button"
            accessibilityLabel="Filter fully paid customers"
            accessibilityState={{ selected: paidActive }}
          >
            <TrendingUp size={12} color={GREEN} />
            <Text
              variant="body-xs"
              weight={paidActive ? 'semibold' : 'normal'}
              style={{ color: GREEN }}
            >
              {`${fullyPaid} ${t('credit.filters.fullyPaid')}`}
            </Text>
          </Pressable>
        </View>

        {/* Muted subtitle */}
        <Text variant="body-xs" style={{ color: textMuted, marginTop: 2 }}>
          {totalBalance > 0 ? t('credit.summary.monitorNote') : t('credit.summary.allSettled')}
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
  statBlock: {
    flexDirection: 'row',
    borderRadius:  12,
    borderWidth:   1,
    overflow:      'hidden',
  },
  statCol: {
    flex:           1,
    alignItems:     'center',
    paddingVertical: 10,
    gap:            3,
  },
  statDivider: {
    width: 1,
    marginVertical: 10,
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
    const { t } = useTranslation();
    const insets = useSafeAreaInsets();

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
      if (!visible) {
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

    const sheetFooter = (
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
            {t('common.cancel')}
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
          <Text variant="body" weight="bold" style={{ color: '#FFFFFF' }}>
            {isSaving ? t('common.saving') : t('credit.addCustomer.submit')}
          </Text>
        </Pressable>
      </View>
    );

    return (
      <BottomSheet
        visible={visible}
        onClose={onClose}
        defaultSnapPoint="75%"
        scrollable
        contentPadding={false}
        backdropOpacity={isDark ? 0.70 : 0.45}
        footer={sheetFooter}
      >
        {/* Title */}
        <View style={addSheetStyles.titleRow}>
          <View style={[addSheetStyles.titleIcon, { backgroundColor: `${violet}1A` }]}>
            <User size={18} color={violet} />
          </View>
          <Text variant="h5" weight="bold" style={{ color: textMain, flex: 1 }}>
            {t('credit.addCustomer.title')}
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

        <View style={[addSheetStyles.formScroll, addSheetStyles.formContent]}>
          {/* Name */}
          <Text
            variant="body-sm"
            weight="semibold"
            style={{ color: labelClr, marginBottom: 8 }}
          >
            {t('credit.addCustomer.nameLabel')}
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
              placeholder={t('credit.addCustomer.namePlaceholder')}
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
            {t('credit.addCustomer.phoneLabel')}
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
              placeholder={t('credit.addCustomer.phonePlaceholder')}
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
            {t('credit.addCustomer.notesLabel')}
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
              placeholder={t('credit.addCustomer.notesPlaceholder')}
              placeholderTextColor={isDark ? 'rgba(255,255,255,0.30)' : staticTheme.colors.gray[400]}
              multiline
              numberOfLines={3}
              returnKeyType="done"
              accessibilityLabel="Notes"
            />
          </View>
        </View>
      </BottomSheet>
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
  const { t } = useTranslation();
  const mode   = useThemeMode();
  const isDark = mode === 'dark';
  const router = useRouter();

  const violet = isDark ? VIOLET_DARK : VIOLET_LIGHT;

  const customers       = useCreditStore(selectCustomerSummaries);
  const totalOutstanding = useCreditStore(selectTotalOutstandingBalance);
  const isLoading       = useCreditStore(selectCreditLoading);
  const addCustomer     = useCreditStore(s => s.addCustomer);
  const refreshAll      = useCreditStore(s => s.refreshAll);

  const [sheetVisible,  setSheetVisible]  = useState(false);
  const [isSaving,      setIsSaving]      = useState(false);
  const [activeFilter,  setActiveFilter]  = useState<CustomerFilter>('all');

  const handleFilterChange = useCallback((filter: CustomerFilter) => {
    setActiveFilter(filter);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void refreshAll();
    }, [refreshAll]),
  );

  const fullyPaid        = useMemo(() => customers.filter(c => c.isFullyPaid).length,  [customers]);
  const hasBalance       = useMemo(() => customers.filter(c => !c.isFullyPaid).length, [customers]);
  const grandTotalCredit = useMemo(() => customers.reduce((sum, c) => sum + c.totalCredit, 0), [customers]);
  const grandTotalPaid   = useMemo(() => customers.reduce((sum, c) => sum + c.totalPaid,   0), [customers]);

  const filteredCustomers = useMemo(() => {
    if (activeFilter === 'has_balance') return customers.filter(c => !c.isFullyPaid);
    if (activeFilter === 'fully_paid')  return customers.filter(c => c.isFullyPaid);
    return customers;
  }, [customers, activeFilter]);

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

  const sectionSubtitle = activeFilter === 'has_balance'
    ? t('credit.rankings.withBalance')
    : activeFilter === 'fully_paid'
      ? t('credit.rankings.fullyPaid')
      : t('credit.rankings.byBalance');

  const ListHeader = useMemo(
    () => (
      <>
        {/* Hero summary */}
        <HeroCard
          totalCredit={grandTotalCredit}
          totalPaid={grandTotalPaid}
          totalBalance={totalOutstanding}
          totalCustomers={customers.length}
          fullyPaid={fullyPaid}
          hasBalance={hasBalance}
          activeFilter={activeFilter}
          onFilterChange={handleFilterChange}
          isDark={isDark}
          violet={violet}
        />

        {/* Section label */}
        <View style={screenStyles.sectionHeader}>
          <TrendingUp size={14} color={violet} />
          <Text variant="body-sm" weight="semibold" style={{ color: isDark ? textMain : staticTheme.colors.gray[700] }}>
            {t('credit.rankings.title')}
          </Text>
          <Text variant="body-xs" style={{ color: textMuted }}>
            {sectionSubtitle}
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

        {/* Empty state — no customers at all */}
        {!isLoading && customers.length === 0 && (
          <View style={screenStyles.emptyState}>
            <View style={[screenStyles.emptyIcon, { backgroundColor: `${violet}15` }]}>
              <CreditCard size={32} color={violet} />
            </View>
            <Text variant="h5" weight="semibold" style={{ color: isDark ? DARK_TEXT : staticTheme.colors.gray[700] }}>
              {t('credit.empty.noCustomers')}
            </Text>
            <Text variant="body-sm" style={{ color: textMuted, textAlign: 'center' }}>
              {t('credit.empty.noCustomersDesc')}
            </Text>
          </View>
        )}

        {/* Empty state — filter produced no results */}
        {!isLoading && customers.length > 0 && filteredCustomers.length === 0 && (
          <View style={screenStyles.emptyState}>
            <View style={[screenStyles.emptyIcon, { backgroundColor: `${violet}15` }]}>
              <AlertCircle size={32} color={violet} />
            </View>
            <Text variant="h5" weight="semibold" style={{ color: isDark ? DARK_TEXT : staticTheme.colors.gray[700] }}>
              {activeFilter === 'has_balance' ? t('credit.empty.noBalance') : t('credit.empty.noFullyPaid')}
            </Text>
            <Text variant="body-sm" style={{ color: textMuted, textAlign: 'center' }}>
              {activeFilter === 'has_balance'
                ? t('credit.empty.noBalanceDesc')
                : t('credit.empty.noFullyPaidDesc')}
            </Text>
          </View>
        )}
      </>
    ),
    [
      totalOutstanding, grandTotalCredit, grandTotalPaid,
      customers.length, filteredCustomers.length, fullyPaid, hasBalance,
      activeFilter, handleFilterChange, sectionSubtitle,
      isDark, violet, isLoading, textMain, textMuted,
    ],
  );

  const ListFooter = <View style={{ height: 100 }} />;

  return (
    <View style={[screenStyles.root, { backgroundColor: rootBg }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />

      <FlatList
        data={filteredCustomers}
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

      {/* Saving overlay — shown while add-customer mutation is in-flight */}
      <LoaderOverlay visible={isSaving} message="Adding customer…" />
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
