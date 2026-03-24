/**
 * OverheadExpensesScreen
 *
 * Logs and displays recurring and one-off business overhead costs:
 * rent, renovation, utilities, insurance, maintenance, and other.
 *
 * Layout:
 *   1. Stat pills row (horizontal scroll) — This Month | This Year | All Time
 *   2. Category filter chips (horizontal scroll)
 *   3. FlatList of ExpenseCard items (newest first, paginated)
 *   4. FAB — "+ Log Expense" triggers LogExpenseSheet
 *
 * Data flow: SQLite → overhead_expenses.repository → overhead_expenses.store → this screen.
 *
 * Design notes:
 *   - Entries are immutable once written (no edit/delete, matching repo design).
 *     A correction is a new entry that offsets the original.
 *   - Filter state maps to store `OverheadFilters` — category, fromDate, toDate, isRecurring.
 *   - The screen category filter chip drives `filters.category`.
 *
 * TypeScript constraints honoured:
 *   - exactOptionalPropertyTypes: no `prop: undefined`, conditional spread throughout
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
  RefreshControl,
  Platform,
  ActivityIndicator,
  TextInput,
  Modal,
  KeyboardAvoidingView,
  Switch,
  Alert,
  Animated,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useFocusEffect } from 'expo-router';
import {
  Building2,
  Home,
  Hammer,
  Shield,
  Wrench,
  MoreHorizontal,
  Filter,
  Plus,
  X,
  Check,
  AlertCircle,
  PhilippinePeso,
  CalendarDays,
  RefreshCw,
} from 'lucide-react-native';
import { Text } from '@/components/atoms/Text';
import { DatePickerField } from '@/components/molecules/DatePickerField';
import {
  useOverheadExpensesStore,
  selectOverheadExpenses,
  selectOverheadLoading,
  selectOverheadLoadingMore,
  selectOverheadError,
  selectOverheadTotalCount,
  selectOverheadHasMore,
  selectOverheadFilters,
  selectOverheadSummary,
  useThemeStore,
  selectThemeMode,
} from '@/store';
import { useAppTheme } from '@/core/theme';
import { theme as staticTheme } from '@/core/theme';
import type {
  OverheadCategory,
  OverheadExpense,
  OverheadFrequency,
  OverheadExpenseSummary,
} from '@/types';
import type { OverheadFilters } from '@/store';

// ─── Color tokens ─────────────────────────────────────────────────────────────

const DARK_CARD_BG  = '#151A27';
const DARK_ROOT_BG  = '#0F0F14';
const DARK_BORDER   = 'rgba(255,255,255,0.08)';
const DARK_TEXT     = '#F1F5F9';
const DARK_TEXT_SEC = '#94A3B8';
const PURPLE        = '#8B5CF6';
const ORANGE        = '#F97316';
const BLUE          = '#3B82F6';

const CATEGORY_COLOR: Record<OverheadCategory, string> = {
  rent:        PURPLE,
  renovation:  ORANGE,
  insurance:   staticTheme.colors.success[500],
  maintenance: staticTheme.colors.warning[500],
  other:       staticTheme.colors.gray[500],
};

const CATEGORY_LABEL: Record<OverheadCategory, string> = {
  rent:        'Rent',
  renovation:  'Renovation',
  insurance:   'Insurance',
  maintenance: 'Maintenance',
  other:       'Other',
};

// OverheadFrequency from the domain uses underscores: 'one_time' | 'monthly' | 'quarterly' | 'annual'
const FREQUENCY_LABEL: Record<OverheadFrequency, string> = {
  one_time:  'One-time',
  monthly:   'Monthly',
  quarterly: 'Quarterly',
  annual:    'Annual',
};

const ALL_CATEGORIES: OverheadCategory[] = [
  'rent', 'renovation', 'insurance', 'maintenance', 'other',
];

const ALL_FREQUENCIES: OverheadFrequency[] = [
  'one_time', 'monthly', 'quarterly', 'annual',
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatCurrency(value: number): string {
  return `₱${value.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
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

function CategoryIcon({
  category,
  color,
  size,
}: {
  category: OverheadCategory;
  color:    string;
  size:     number;
}) {
  switch (category) {
    case 'rent':        return <Home           size={size} color={color} />;
    case 'renovation':  return <Hammer         size={size} color={color} />;
    case 'insurance':   return <Shield         size={size} color={color} />;
    case 'maintenance': return <Wrench         size={size} color={color} />;
    case 'other':       return <MoreHorizontal size={size} color={color} />;
  }
}

const keyExtractor = (item: OverheadExpense): string => item.id;

// ─── Skeleton ─────────────────────────────────────────────────────────────────

const Skeleton = React.memo<{
  width:   number | string;
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
    <Animated.View
      style={{
        width,
        height,
        borderRadius:    radius,
        backgroundColor: isDark ? '#2A3347' : staticTheme.colors.gray[200],
        opacity:         anim,
      }}
    />
  );
});
Skeleton.displayName = 'OverheadSkeleton';

// ─── Stat Pill ────────────────────────────────────────────────────────────────

const StatPillRow = React.memo<{
  summary: OverheadExpenseSummary;
  isDark:  boolean;
}>(({ summary, isDark }) => {
  const textMuted = isDark ? DARK_TEXT_SEC : staticTheme.colors.gray[500];

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={statStyles.scroll}
    >
      {/* This Month */}
      <View style={[statStyles.pill, {
        backgroundColor: isDark ? `${PURPLE}0D` : `${PURPLE}0F`,
        borderColor:     isDark ? `${PURPLE}28` : `${PURPLE}30`,
      }]}>
        <View style={[statStyles.icon, { backgroundColor: `${PURPLE}18` }]}>
          <Building2 size={13} color={PURPLE} />
        </View>
        <Text variant="body-xs" numberOfLines={1} style={{ color: textMuted }}>This Month</Text>
        <Text variant="body-sm" weight="bold" style={{ color: PURPLE }}>
          {formatCurrency(summary.thisMonth)}
        </Text>
      </View>

      {/* This Year */}
      <View style={[statStyles.pill, {
        backgroundColor: isDark ? `${BLUE}0D` : `${BLUE}0F`,
        borderColor:     isDark ? `${BLUE}28` : `${BLUE}30`,
      }]}>
        <View style={[statStyles.icon, { backgroundColor: `${BLUE}18` }]}>
          <CalendarDays size={13} color={BLUE} />
        </View>
        <Text variant="body-xs" numberOfLines={1} style={{ color: textMuted }}>This Year</Text>
        <Text variant="body-sm" weight="bold" style={{ color: BLUE }}>
          {formatCurrency(summary.thisYear)}
        </Text>
      </View>

      {/* All Time */}
      <View style={[statStyles.pill, {
        backgroundColor: isDark ? `${staticTheme.colors.success[500]}0D` : `${staticTheme.colors.success[500]}0F`,
        borderColor:     isDark ? `${staticTheme.colors.success[500]}28` : `${staticTheme.colors.success[500]}30`,
      }]}>
        <View style={[statStyles.icon, { backgroundColor: `${staticTheme.colors.success[500]}18` }]}>
          <PhilippinePeso size={13} color={staticTheme.colors.success[500]} />
        </View>
        <Text variant="body-xs" numberOfLines={1} style={{ color: textMuted }}>All Time</Text>
        <Text variant="body-sm" weight="bold" style={{ color: staticTheme.colors.success[500] }}>
          {formatCurrency(summary.allTime)}
        </Text>
      </View>
    </ScrollView>
  );
});
StatPillRow.displayName = 'OverheadStatPillRow';

const statStyles = StyleSheet.create({
  scroll: {
    gap:               6,
    paddingHorizontal: staticTheme.spacing.md,
    paddingVertical:   staticTheme.spacing.sm,
  },
  pill: {
    borderRadius: staticTheme.borderRadius.xl,
    borderWidth:  1,
    padding:      staticTheme.spacing.sm,
    gap:          4,
    minWidth:     110,
  },
  icon: {
    width:          28,
    height:         28,
    borderRadius:   9,
    alignItems:     'center',
    justifyContent: 'center',
  },
});

// ─── Filter chips ─────────────────────────────────────────────────────────────

interface FilterChipsProps {
  active:   OverheadCategory | 'all';
  onSelect: (c: OverheadCategory | 'all') => void;
  isDark:   boolean;
}

const FilterChips = React.memo<FilterChipsProps>(({ active, onSelect, isDark }) => {
  const textMuted = isDark ? DARK_TEXT_SEC : staticTheme.colors.gray[500];
  const isAllActive = active === 'all';
  const allBg = isAllActive
    ? (isDark ? `${PURPLE}22` : `${PURPLE}15`)
    : (isDark ? 'rgba(255,255,255,0.07)' : staticTheme.colors.gray[100]);

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={chipStyles.row}
    >
      <Pressable
        style={[chipStyles.chip, {
          backgroundColor: allBg,
          borderColor:     isAllActive ? `${PURPLE}40` : 'transparent',
        }]}
        onPress={() => onSelect('all')}
        accessibilityRole="button"
        accessibilityState={{ selected: isAllActive }}
      >
        <Filter size={11} color={isAllActive ? PURPLE : textMuted} />
        <Text variant="body-xs" weight="medium" style={{ color: isAllActive ? PURPLE : textMuted }}>
          All
        </Text>
      </Pressable>

      {ALL_CATEGORIES.map((cat) => {
        const isActive = active === cat;
        const clr      = CATEGORY_COLOR[cat] ?? staticTheme.colors.gray[500];
        const bg       = isActive
          ? (isDark ? `${clr}22` : `${clr}15`)
          : (isDark ? 'rgba(255,255,255,0.07)' : staticTheme.colors.gray[100]);

        return (
          <Pressable
            key={cat}
            style={[chipStyles.chip, {
              backgroundColor: bg,
              borderColor:     isActive ? `${clr}40` : 'transparent',
            }]}
            onPress={() => onSelect(isActive ? 'all' : cat)}
            accessibilityRole="button"
            accessibilityState={{ selected: isActive }}
          >
            <CategoryIcon category={cat} color={isActive ? clr : textMuted} size={11} />
            <Text variant="body-xs" weight="medium" style={{ color: isActive ? clr : textMuted }}>
              {CATEGORY_LABEL[cat]}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
});
FilterChips.displayName = 'OverheadFilterChips';

const chipStyles = StyleSheet.create({
  row: {
    gap:               6,
    paddingHorizontal: staticTheme.spacing.md,
    paddingVertical:   staticTheme.spacing.xs,
  },
  chip: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               5,
    paddingHorizontal: 10,
    paddingVertical:   6,
    borderRadius:      staticTheme.borderRadius.full,
    borderWidth:       1,
    minHeight:         34,
  },
});

// ─── Expense Card ─────────────────────────────────────────────────────────────

interface ExpenseCardProps {
  item:   OverheadExpense;
  isDark: boolean;
}

const ExpenseCard = React.memo<ExpenseCardProps>(({ item, isDark }) => {
  const catColor  = CATEGORY_COLOR[item.category] ?? staticTheme.colors.gray[500];
  const cardBg    = isDark ? DARK_CARD_BG : '#FFFFFF';
  const border    = isDark ? `${catColor}22` : `${catColor}28`;
  const textMain  = isDark ? DARK_TEXT     : staticTheme.colors.gray[800];
  const textMuted = isDark ? DARK_TEXT_SEC : staticTheme.colors.gray[500];

  return (
    <View
      style={[
        cardStyles.card,
        {
          backgroundColor: cardBg,
          borderColor:     border,
          ...(isDark
            ? {
                shadowColor:   catColor,
                shadowOffset:  { width: 0, height: 2 },
                shadowOpacity: 0.10,
                shadowRadius:  8,
                elevation:     3,
              }
            : staticTheme.shadows.sm),
        },
      ]}
    >
      {/* Left accent bar */}
      <View style={[cardStyles.accentBar, { backgroundColor: catColor }]} />

      <View style={cardStyles.body}>
        {/* Header row: icon + description + amount */}
        <View style={cardStyles.headerRow}>
          <View style={[cardStyles.iconPill, { backgroundColor: `${catColor}1A` }]}>
            <CategoryIcon category={item.category} color={catColor} size={18} />
          </View>

          <View style={cardStyles.titleWrap}>
            <Text variant="body" weight="semibold" style={{ color: textMain }} numberOfLines={1}>
              {item.description}
            </Text>
            <View style={cardStyles.metaRow}>
              <Text variant="body-xs" style={{ color: textMuted }}>
                {CATEGORY_LABEL[item.category]}
              </Text>
              <View style={[cardStyles.metaDot, { backgroundColor: textMuted }]} />
              <Text variant="body-xs" style={{ color: textMuted }}>
                {formatDate(item.expenseDate)}
              </Text>
            </View>
          </View>

          <Text
            variant="h6"
            weight="bold"
            style={{ color: catColor, flexShrink: 0, maxWidth: 110 }}
            numberOfLines={1}
            adjustsFontSizeToFit
          >
            {formatCurrency(item.amount)}
          </Text>
        </View>

        {/* Badges row */}
        <View style={cardStyles.badgesRow}>
          {/* Frequency badge */}
          <View style={[cardStyles.badge, {
            backgroundColor: `${catColor}15`,
            borderColor:     `${catColor}30`,
          }]}>
            <CalendarDays size={10} color={catColor} />
            <Text variant="body-xs" weight="medium" style={{ color: catColor }}>
              {FREQUENCY_LABEL[item.frequency]}
            </Text>
          </View>

          {/* Recurring indicator */}
          {item.isRecurring && (
            <View style={[cardStyles.badge, {
              backgroundColor: `${staticTheme.colors.primary[500]}15`,
              borderColor:     `${staticTheme.colors.primary[500]}30`,
            }]}>
              <RefreshCw size={10} color={staticTheme.colors.primary[500]} />
              <Text variant="body-xs" weight="medium" style={{ color: staticTheme.colors.primary[500] }}>
                Recurring
              </Text>
            </View>
          )}

          {/* Reference number */}
          {item.referenceNumber !== undefined && (
            <View style={[cardStyles.badge, {
              backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : staticTheme.colors.gray[100],
              borderColor:     isDark ? DARK_BORDER : staticTheme.colors.gray[200],
            }]}>
              <Text variant="body-xs" style={{ color: textMuted }}>
                #{item.referenceNumber}
              </Text>
            </View>
          )}
        </View>

        {/* Notes (if present) */}
        {item.notes !== undefined && (
          <Text variant="body-xs" style={{ color: textMuted }} numberOfLines={2}>
            {item.notes}
          </Text>
        )}
      </View>
    </View>
  );
});
ExpenseCard.displayName = 'ExpenseCard';

const cardStyles = StyleSheet.create({
  card: {
    flexDirection:    'row',
    borderRadius:     staticTheme.borderRadius.xl,
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
    gap:               8,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           staticTheme.spacing.sm,
  },
  iconPill: {
    width:          40,
    height:         40,
    borderRadius:   12,
    alignItems:     'center',
    justifyContent: 'center',
    flexShrink:     0,
  },
  titleWrap: {
    flex:    1,
    gap:     3,
    minWidth: 0,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           5,
  },
  metaDot: {
    width:        3,
    height:       3,
    borderRadius: 2,
  },
  badgesRow: {
    flexDirection: 'row',
    flexWrap:      'wrap',
    gap:           6,
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
});

// ─── Category picker chip (in form) ──────────────────────────────────────────

const CatChip = React.memo<{
  cat:      OverheadCategory;
  selected: boolean;
  isDark:   boolean;
  onPress:  () => void;
}>(({ cat, selected, isDark, onPress }) => {
  const clr = CATEGORY_COLOR[cat] ?? staticTheme.colors.gray[500];
  const bg  = selected
    ? (isDark ? `${clr}28` : `${clr}18`)
    : (isDark ? 'rgba(255,255,255,0.07)' : staticTheme.colors.gray[100]);

  return (
    <Pressable
      style={[catChipStyles.chip, {
        backgroundColor: bg,
        borderColor:     selected ? `${clr}50` : 'transparent',
      }]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
    >
      <CategoryIcon
        category={cat}
        color={selected ? clr : (isDark ? DARK_TEXT_SEC : staticTheme.colors.gray[400])}
        size={14}
      />
      <Text
        variant="body-xs"
        weight={selected ? 'semibold' : 'normal'}
        style={{ color: selected ? clr : (isDark ? DARK_TEXT_SEC : staticTheme.colors.gray[500]) }}
      >
        {CATEGORY_LABEL[cat]}
      </Text>
    </Pressable>
  );
});
CatChip.displayName = 'CatChip';

const catChipStyles = StyleSheet.create({
  chip: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               6,
    paddingHorizontal: 10,
    paddingVertical:   8,
    borderRadius:      staticTheme.borderRadius.lg,
    borderWidth:       1,
    minHeight:         40,
  },
});

// ─── Frequency chip (in form) ─────────────────────────────────────────────────

const FreqChip = React.memo<{
  freq:     OverheadFrequency;
  selected: boolean;
  isDark:   boolean;
  onPress:  () => void;
}>(({ freq, selected, isDark, onPress }) => {
  const bg = selected
    ? (isDark ? `${PURPLE}28` : `${PURPLE}18`)
    : (isDark ? 'rgba(255,255,255,0.07)' : staticTheme.colors.gray[100]);

  return (
    <Pressable
      style={[freqChipStyles.chip, {
        backgroundColor: bg,
        borderColor:     selected ? `${PURPLE}50` : 'transparent',
      }]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
    >
      <Text
        variant="body-xs"
        weight={selected ? 'semibold' : 'normal'}
        style={{ color: selected ? PURPLE : (isDark ? DARK_TEXT_SEC : staticTheme.colors.gray[500]) }}
      >
        {FREQUENCY_LABEL[freq]}
      </Text>
    </Pressable>
  );
});
FreqChip.displayName = 'FreqChip';

const freqChipStyles = StyleSheet.create({
  chip: {
    paddingHorizontal: 12,
    paddingVertical:   8,
    borderRadius:      staticTheme.borderRadius.lg,
    borderWidth:       1,
    minHeight:         38,
    justifyContent:    'center',
    alignItems:        'center',
  },
});

// ─── Log Expense Sheet ────────────────────────────────────────────────────────

interface LogExpenseSheetProps {
  visible:  boolean;
  isDark:   boolean;
  onClose:  () => void;
  onSave:   (data: {
    category:         OverheadCategory;
    amount:           number;
    description:      string;
    frequency:        OverheadFrequency;
    expenseDate:      string;
    isRecurring:      boolean;
    referenceNumber?: string;
    notes?:           string;
  }) => Promise<void>;
  isSaving: boolean;
}

const LogExpenseSheet = React.memo<LogExpenseSheetProps>(
  ({ visible, isDark, onClose, onSave, isSaving }) => {
    const slideAnim = useRef(new Animated.Value(700)).current;

    const cardBg    = isDark ? '#1C2333' : '#FFFFFF';
    const inputBg   = isDark ? '#242D42' : '#F8F9FC';
    const inputBdr  = isDark ? 'rgba(255,255,255,0.12)' : staticTheme.colors.gray[200];
    const textMain  = isDark ? DARK_TEXT     : staticTheme.colors.gray[800];
    const textMuted = isDark ? DARK_TEXT_SEC : staticTheme.colors.gray[500];
    const labelClr  = isDark ? 'rgba(255,255,255,0.60)' : staticTheme.colors.gray[600];
    const overlayBg = isDark ? 'rgba(0,0,0,0.70)' : 'rgba(0,0,0,0.45)';

    // Form state
    const [category,    setCategory]    = useState<OverheadCategory>('rent');
    const [amount,      setAmount]      = useState('');
    const [description, setDescription] = useState('');
    const [frequency,   setFrequency]   = useState<OverheadFrequency>('one_time');
    const [expenseDate, setExpenseDate] = useState(todayISO());
    const [isRecurring, setIsRecurring] = useState(false);
    const [refNumber,   setRefNumber]   = useState('');
    const [notes,       setNotes]       = useState('');
    const [amountErr,   setAmountErr]   = useState('');
    const [descErr,     setDescErr]     = useState('');

    // Slide in / out animation
    useEffect(() => {
      if (visible) {
        Animated.spring(slideAnim, {
          toValue:         0,
          useNativeDriver: true,
          damping:         20,
          stiffness:       180,
        }).start();
      } else {
        slideAnim.setValue(700);
        // Reset form on close
        setCategory('rent');
        setAmount('');
        setDescription('');
        setFrequency('one_time');
        setExpenseDate(todayISO());
        setIsRecurring(false);
        setRefNumber('');
        setNotes('');
        setAmountErr('');
        setDescErr('');
      }
    }, [visible, slideAnim]);

    const validate = useCallback((): boolean => {
      let ok = true;
      const parsedAmt = parseFloat(amount.replace(/,/g, ''));
      if (isNaN(parsedAmt) || parsedAmt <= 0) {
        setAmountErr('Enter a valid amount greater than 0');
        ok = false;
      } else {
        setAmountErr('');
      }
      if (description.trim() === '') {
        setDescErr('Description is required');
        ok = false;
      } else {
        setDescErr('');
      }
      return ok;
    }, [amount, description]);

    const handleSave = useCallback(async () => {
      if (!validate()) return;
      const parsedAmt = parseFloat(amount.replace(/,/g, ''));

      await onSave({
        category,
        amount:      parsedAmt,
        description: description.trim(),
        frequency,
        expenseDate,
        isRecurring,
        ...(refNumber.trim() !== '' ? { referenceNumber: refNumber.trim() } : {}),
        ...(notes.trim()     !== '' ? { notes:           notes.trim()     } : {}),
      });
    }, [validate, amount, category, description, frequency, expenseDate, isRecurring, refNumber, notes, onSave]);

    if (!visible) return null;

    return (
      <Modal
        visible={visible}
        transparent
        animationType="none"
        onRequestClose={onClose}
        statusBarTranslucent
      >
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          {/* Backdrop */}
          <Pressable
            style={[StyleSheet.absoluteFillObject, { backgroundColor: overlayBg }]}
            onPress={onClose}
          />

          {/* Sheet */}
          <Animated.View
            style={[
              sheetStyles.sheet,
              {
                backgroundColor: cardBg,
                transform:       [{ translateY: slideAnim }],
              },
            ]}
          >
            {/* Handle */}
            <View style={sheetStyles.handle} />

            {/* Title row */}
            <View style={sheetStyles.titleRow}>
              <View style={[sheetStyles.titleIcon, { backgroundColor: `${PURPLE}1A` }]}>
                <Building2 size={18} color={PURPLE} />
              </View>
              <Text variant="h5" weight="bold" style={{ color: textMain, flex: 1 }}>
                Log Overhead Expense
              </Text>
              <Pressable
                style={({ pressed }) => [sheetStyles.closeBtn, { opacity: pressed ? 0.6 : 1 }]}
                onPress={onClose}
                accessibilityRole="button"
                accessibilityLabel="Close"
              >
                <X size={20} color={textMuted} />
              </Pressable>
            </View>

            <ScrollView
              contentContainerStyle={sheetStyles.formContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {/* Category */}
              <Text variant="body-sm" weight="semibold" style={{ color: labelClr, marginBottom: 8 }}>
                Category *
              </Text>
              <View style={sheetStyles.chipGrid}>
                {ALL_CATEGORIES.map((cat) => (
                  <CatChip
                    key={cat}
                    cat={cat}
                    selected={category === cat}
                    isDark={isDark}
                    onPress={() => setCategory(cat)}
                  />
                ))}
              </View>

              {/* Amount */}
              <Text variant="body-sm" weight="semibold" style={[sheetStyles.fieldLabel, { color: labelClr }]}>
                Amount (₱) *
              </Text>
              <View style={[
                sheetStyles.inputWrap,
                {
                  backgroundColor: inputBg,
                  borderColor:     amountErr !== '' ? staticTheme.colors.error[500] : inputBdr,
                },
              ]}>
                <PhilippinePeso size={16} color={textMuted} />
                <TextInput
                  style={[sheetStyles.input, { color: textMain }]}
                  value={amount}
                  onChangeText={setAmount}
                  placeholder="0.00"
                  placeholderTextColor={isDark ? 'rgba(255,255,255,0.30)' : staticTheme.colors.gray[400]}
                  keyboardType="decimal-pad"
                  returnKeyType="next"
                  accessibilityLabel="Amount"
                />
              </View>
              {amountErr !== '' && (
                <Text variant="body-xs" style={{ color: staticTheme.colors.error[500], marginTop: 4 }}>
                  {amountErr}
                </Text>
              )}

              {/* Description */}
              <Text variant="body-sm" weight="semibold" style={[sheetStyles.fieldLabel, { color: labelClr }]}>
                Description *
              </Text>
              <View style={[
                sheetStyles.inputWrap,
                {
                  backgroundColor: inputBg,
                  borderColor:     descErr !== '' ? staticTheme.colors.error[500] : inputBdr,
                },
              ]}>
                <TextInput
                  style={[sheetStyles.input, { color: textMain }]}
                  value={description}
                  onChangeText={setDescription}
                  placeholder="e.g. Monthly rent payment"
                  placeholderTextColor={isDark ? 'rgba(255,255,255,0.30)' : staticTheme.colors.gray[400]}
                  returnKeyType="next"
                  accessibilityLabel="Description"
                />
              </View>
              {descErr !== '' && (
                <Text variant="body-xs" style={{ color: staticTheme.colors.error[500], marginTop: 4 }}>
                  {descErr}
                </Text>
              )}

              {/* Frequency */}
              <Text variant="body-sm" weight="semibold" style={[sheetStyles.fieldLabel, { color: labelClr }]}>
                Frequency
              </Text>
              <View style={sheetStyles.chipGrid}>
                {ALL_FREQUENCIES.map((freq) => (
                  <FreqChip
                    key={freq}
                    freq={freq}
                    selected={frequency === freq}
                    isDark={isDark}
                    onPress={() => setFrequency(freq)}
                  />
                ))}
              </View>

              {/* Expense Date */}
              <DatePickerField
                label="Expense Date"
                value={expenseDate}
                onChange={setExpenseDate}
                maximumDate={new Date()}
                accessibilityLabel="Expense date"
              />

              {/* Is Recurring toggle */}
              <View style={sheetStyles.toggleRow}>
                <View style={{ flex: 1 }}>
                  <Text variant="body-sm" weight="semibold" style={{ color: textMain }}>
                    Recurring
                  </Text>
                  <Text variant="body-xs" style={{ color: textMuted }}>
                    Expense repeats on this frequency
                  </Text>
                </View>
                <Switch
                  value={isRecurring}
                  onValueChange={setIsRecurring}
                  trackColor={{
                    false: isDark ? 'rgba(255,255,255,0.15)' : staticTheme.colors.gray[300],
                    true:  PURPLE,
                  }}
                  thumbColor={isRecurring ? '#FFFFFF' : (isDark ? DARK_TEXT_SEC : '#FFFFFF')}
                  accessibilityLabel="Toggle recurring"
                  accessibilityRole="switch"
                />
              </View>

              {/* Reference number (optional) */}
              <Text variant="body-sm" weight="semibold" style={[sheetStyles.fieldLabel, { color: labelClr }]}>
                Reference Number (optional)
              </Text>
              <View style={[sheetStyles.inputWrap, { backgroundColor: inputBg, borderColor: inputBdr }]}>
                <TextInput
                  style={[sheetStyles.input, { color: textMain }]}
                  value={refNumber}
                  onChangeText={setRefNumber}
                  placeholder="e.g. INV-2025-001"
                  placeholderTextColor={isDark ? 'rgba(255,255,255,0.30)' : staticTheme.colors.gray[400]}
                  returnKeyType="next"
                  accessibilityLabel="Reference number"
                />
              </View>

              {/* Notes (optional) */}
              <Text variant="body-sm" weight="semibold" style={[sheetStyles.fieldLabel, { color: labelClr }]}>
                Notes (optional)
              </Text>
              <View style={[
                sheetStyles.inputWrap,
                sheetStyles.inputMultiline,
                { backgroundColor: inputBg, borderColor: inputBdr },
              ]}>
                <TextInput
                  style={[sheetStyles.input, { color: textMain, textAlignVertical: 'top' }]}
                  value={notes}
                  onChangeText={setNotes}
                  placeholder="Any additional notes…"
                  placeholderTextColor={isDark ? 'rgba(255,255,255,0.30)' : staticTheme.colors.gray[400]}
                  multiline
                  numberOfLines={3}
                  accessibilityLabel="Notes"
                />
              </View>
            </ScrollView>

            {/* Footer save button */}
            <View style={[
              sheetStyles.footer,
              {
                borderTopColor:  isDark ? DARK_BORDER : staticTheme.colors.gray[200],
                backgroundColor: cardBg,
                paddingBottom:   Platform.OS === 'ios' ? 28 : 12,
              },
            ]}>
              <Pressable
                style={({ pressed }) => [
                  sheetStyles.saveBtn,
                  {
                    backgroundColor: isSaving ? `${PURPLE}80` : PURPLE,
                    opacity:         pressed ? 0.8 : 1,
                  },
                ]}
                onPress={handleSave}
                disabled={isSaving}
                accessibilityRole="button"
                accessibilityLabel="Log expense"
              >
                {isSaving ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Check size={18} color="#FFFFFF" />
                    <Text variant="body" weight="bold" style={{ color: '#FFFFFF' }}>
                      Log Expense
                    </Text>
                  </>
                )}
              </Pressable>
            </View>
          </Animated.View>
        </KeyboardAvoidingView>
      </Modal>
    );
  },
);
LogExpenseSheet.displayName = 'LogExpenseSheet';

const sheetStyles = StyleSheet.create({
  sheet: {
    position:             'absolute',
    bottom:               0,
    left:                 0,
    right:                0,
    maxHeight:            '90%',
    borderTopLeftRadius:  24,
    borderTopRightRadius: 24,
    overflow:             'hidden',
  },
  handle: {
    width:           40,
    height:          4,
    borderRadius:    2,
    backgroundColor: 'rgba(150,150,150,0.35)',
    alignSelf:       'center',
    marginTop:       10,
    marginBottom:    4,
  },
  titleRow: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               12,
    paddingHorizontal: staticTheme.spacing.md,
    paddingVertical:   12,
  },
  titleIcon: {
    width:          36,
    height:         36,
    borderRadius:   10,
    alignItems:     'center',
    justifyContent: 'center',
  },
  closeBtn: {
    width:          44,
    height:         44,
    alignItems:     'center',
    justifyContent: 'center',
    borderRadius:   22,
  },
  formContent: {
    paddingHorizontal: staticTheme.spacing.md,
    paddingBottom:     staticTheme.spacing.md,
    gap:               4,
  },
  fieldLabel: {
    marginTop:    12,
    marginBottom:  8,
  },
  chipGrid: {
    flexDirection: 'row',
    flexWrap:      'wrap',
    gap:           8,
  },
  inputWrap: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               8,
    borderRadius:      staticTheme.borderRadius.lg,
    borderWidth:       1,
    paddingHorizontal: 12,
    minHeight:         48,
  },
  inputMultiline: {
    alignItems: 'flex-start',
    paddingTop: 10,
    minHeight:  80,
  },
  input: {
    flex:     1,
    fontSize: 15,
  },
  toggleRow: {
    flexDirection:   'row',
    alignItems:      'center',
    gap:             12,
    marginTop:       12,
    paddingVertical: 4,
  },
  footer: {
    paddingHorizontal: staticTheme.spacing.md,
    paddingTop:        12,
    borderTopWidth:    1,
  },
  saveBtn: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'center',
    gap:            8,
    minHeight:      52,
    borderRadius:   staticTheme.borderRadius.xl,
  },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function OverheadExpensesScreen() {
  const appTheme = useAppTheme();
  const isDark   = useThemeStore(selectThemeMode) === 'dark';

  const expenses       = useOverheadExpensesStore(selectOverheadExpenses);
  const summary        = useOverheadExpensesStore(selectOverheadSummary);
  const isLoading      = useOverheadExpensesStore(selectOverheadLoading);
  const isLoadingMore  = useOverheadExpensesStore(selectOverheadLoadingMore);
  const error          = useOverheadExpensesStore(selectOverheadError);
  const totalCount     = useOverheadExpensesStore(selectOverheadTotalCount);
  const hasMore        = useOverheadExpensesStore(selectOverheadHasMore);
  const filters        = useOverheadExpensesStore(selectOverheadFilters);

  const {
    initializeExpenses,
    refreshExpenses,
    loadMore,
    setFilters,
    logExpense,
  } = useOverheadExpensesStore();

  const [refreshing,    setRefreshing]    = useState(false);
  const [sheetOpen,     setSheetOpen]     = useState(false);
  const [isSavingLocal, setIsSavingLocal] = useState(false);

  // The category chip drives filters.category
  const activeCategory: OverheadCategory | 'all' =
    filters.category !== undefined ? filters.category : 'all';

  useEffect(() => { void initializeExpenses(); }, [initializeExpenses]);

  useFocusEffect(useCallback(() => { void refreshExpenses(); }, [refreshExpenses]));

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await refreshExpenses();
    setRefreshing(false);
  }, [refreshExpenses]);

  const handleEndReached = useCallback(() => {
    if (hasMore && !isLoadingMore) {
      void loadMore();
    }
  }, [hasMore, isLoadingMore, loadMore]);

  const handleCategorySelect = useCallback(
    (cat: OverheadCategory | 'all') => {
      const { category: _prev, ...rest } = filters;
      void setFilters(
        cat !== 'all' ? { ...rest, category: cat } : rest,
      );
    },
    [filters, setFilters],
  );

  const handleOpenSheet = useCallback(() => setSheetOpen(true),  []);
  const handleCloseSheet = useCallback(() => setSheetOpen(false), []);

  const handleSave = useCallback(
    async (data: {
      category:         OverheadCategory;
      amount:           number;
      description:      string;
      frequency:        OverheadFrequency;
      expenseDate:      string;
      isRecurring:      boolean;
      referenceNumber?: string;
      notes?:           string;
    }) => {
      setIsSavingLocal(true);
      try {
        await logExpense(data);
        setSheetOpen(false);
      } catch (err) {
        Alert.alert(
          'Save Failed',
          err instanceof Error ? err.message : 'Could not save the expense. Please try again.',
        );
      } finally {
        setIsSavingLocal(false);
      }
    },
    [logExpense],
  );

  const rootBg    = isDark ? DARK_ROOT_BG : appTheme.colors.background;
  const textMain  = isDark ? DARK_TEXT     : staticTheme.colors.gray[800];
  const textMuted = isDark ? DARK_TEXT_SEC : staticTheme.colors.gray[500];

  // ── Render item ─────────────────────────────────────────────────────────────
  const renderItem = useCallback(
    ({ item }: { item: OverheadExpense }) => (
      <ExpenseCard item={item} isDark={isDark} />
    ),
    [isDark],
  );

  // ── FlatList header ─────────────────────────────────────────────────────────
  const ListHeader = useMemo(() => (
    <View>
      {/* Error banner */}
      {error !== null && (
        <View style={[
          scStyles.errorBanner,
          {
            backgroundColor: isDark ? 'rgba(255,107,107,0.10)' : staticTheme.colors.error[50],
            borderColor:     isDark ? 'rgba(255,107,107,0.30)' : staticTheme.colors.error[200],
          },
        ]}>
          <AlertCircle size={15} color={isDark ? '#FF6B6B' : staticTheme.colors.error[500]} />
          <Text
            variant="body-xs"
            style={{ color: isDark ? '#FF6B6B' : staticTheme.colors.error[500], flex: 1 }}
            numberOfLines={2}
          >
            {error}
          </Text>
        </View>
      )}

      {/* Stat pills */}
      <StatPillRow summary={summary} isDark={isDark} />

      {/* Category filter header */}
      <View style={scStyles.sectionHeader}>
        <View style={[scStyles.sectionIconPill, { backgroundColor: `${PURPLE}18` }]}>
          <Filter size={14} color={PURPLE} />
        </View>
        <View>
          <Text variant="body-sm" weight="semibold"
            style={{ color: isDark ? '#FFFFFF' : staticTheme.colors.gray[800] }}>
            Filter by Category
          </Text>
          <Text variant="body-xs" style={{ color: textMuted }}>
            {totalCount} total expense{totalCount !== 1 ? 's' : ''}
          </Text>
        </View>
      </View>

      <FilterChips
        active={activeCategory}
        onSelect={handleCategorySelect}
        isDark={isDark}
      />

      {/* Expense log label */}
      <View style={[scStyles.sectionHeader, { marginTop: staticTheme.spacing.sm }]}>
        <View style={[scStyles.sectionIconPill, { backgroundColor: `${PURPLE}18` }]}>
          <Building2 size={14} color={PURPLE} />
        </View>
        <View>
          <Text variant="body-sm" weight="semibold"
            style={{ color: isDark ? '#FFFFFF' : staticTheme.colors.gray[800] }}>
            Overhead Log
          </Text>
          <Text variant="body-xs" style={{ color: textMuted }}>
            {expenses.length} of {totalCount} · newest first
          </Text>
        </View>
      </View>
    </View>
  ), [
    error, isDark, summary, textMuted, totalCount,
    activeCategory, handleCategorySelect, expenses.length,
  ]);

  // ── Empty state ─────────────────────────────────────────────────────────────
  const ListEmpty = useMemo(() => (
    isLoading ? (
      <View style={scStyles.skeletonWrap}>
        {[1, 2, 3].map((i) => (
          <View key={i} style={{ marginHorizontal: staticTheme.spacing.md, marginVertical: 5 }}>
            <Skeleton
              width="100%"
              height={110}
              isDark={isDark}
              radius={staticTheme.borderRadius.xl}
            />
          </View>
        ))}
      </View>
    ) : (
      <View style={scStyles.emptyContainer}>
        <View style={[scStyles.emptyIcon, { backgroundColor: `${PURPLE}15` }]}>
          <Building2 size={32} color={`${PURPLE}80`} />
        </View>
        <Text
          variant="body"
          weight="semibold"
          style={{ color: isDark ? 'rgba(255,255,255,0.60)' : staticTheme.colors.gray[600] }}
        >
          No overhead expenses yet
        </Text>
        <Text
          variant="body-sm"
          align="center"
          style={{ color: isDark ? 'rgba(255,255,255,0.30)' : staticTheme.colors.gray[400] }}
        >
          Log your first overhead expense — rent, renovation, insurance, and more — to start tracking fixed business costs.
        </Text>
      </View>
    )
  ), [isLoading, isDark, handleOpenSheet]);

  // ── Footer loader ───────────────────────────────────────────────────────────
  const ListFooter = useMemo(() => {
    if (!isLoadingMore) return null;
    return (
      <View style={scStyles.footerLoader}>
        <ActivityIndicator size="small" color={PURPLE} />
      </View>
    );
  }, [isLoadingMore]);

  return (
    <View style={[scStyles.root, { backgroundColor: rootBg }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />

      {/* Title row */}
      <View style={scStyles.actionHeader}>
        <View style={scStyles.titleBlock}>
          <Text variant="h5" weight="bold" style={{ color: textMain }} numberOfLines={1}>
            Overhead Expenses
          </Text>
          <Text variant="body-xs" style={{ color: textMuted }}>
            {formatCurrency(summary.thisMonth)} this month
          </Text>
        </View>
      </View>

      <FlatList
        data={expenses}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        ListHeaderComponent={ListHeader}
        ListEmptyComponent={ListEmpty}
        ListFooterComponent={ListFooter}
        onEndReached={handleEndReached}
        onEndReachedThreshold={0.3}
        contentContainerStyle={[
          scStyles.content,
          expenses.length === 0 && scStyles.contentEmpty,
        ]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={PURPLE}
            colors={[PURPLE]}
          />
        }
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        removeClippedSubviews={Platform.OS === 'android'}
        maxToRenderPerBatch={15}
        windowSize={8}
        initialNumToRender={10}
      />

      {/* Floating Action Button */}
      <Pressable
        style={({ pressed }) => [
          scStyles.fab,
          {
            backgroundColor: PURPLE,
            opacity:         pressed ? 0.85 : 1,
            ...(isDark
              ? {
                  shadowColor:   PURPLE,
                  shadowOffset:  { width: 0, height: 4 },
                  shadowOpacity: 0.40,
                  shadowRadius:  12,
                  elevation:     8,
                }
              : staticTheme.shadows.lg),
          },
        ]}
        onPress={handleOpenSheet}
        accessibilityRole="button"
        accessibilityLabel="Log overhead expense"
      >
        <Plus size={24} color="#FFFFFF" />
      </Pressable>

      {/* Log Expense Bottom Sheet */}
      <LogExpenseSheet
        visible={sheetOpen}
        isDark={isDark}
        onClose={handleCloseSheet}
        onSave={handleSave}
        isSaving={isSavingLocal}
      />
    </View>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────────

const scStyles = StyleSheet.create({
  root:         { flex: 1 },
  content:      { paddingBottom: 100 }, // ensure last card clears the FAB
  contentEmpty: { flexGrow: 1 },

  actionHeader: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
    paddingHorizontal: staticTheme.spacing.md,
    paddingTop:        staticTheme.spacing.md,
    paddingBottom:     staticTheme.spacing.xs,
    gap:               staticTheme.spacing.sm,
  },
  titleBlock: { flex: 1, gap: 2 },

  sectionHeader: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               staticTheme.spacing.sm,
    paddingHorizontal: staticTheme.spacing.md,
    paddingTop:        staticTheme.spacing.md,
    paddingBottom:     staticTheme.spacing.xs,
  },
  sectionIconPill: {
    width:          28,
    height:         28,
    borderRadius:   8,
    alignItems:     'center',
    justifyContent: 'center',
  },

  errorBanner: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               staticTheme.spacing.sm,
    marginHorizontal:  staticTheme.spacing.md,
    marginTop:         staticTheme.spacing.sm,
    borderWidth:       1,
    borderRadius:      staticTheme.borderRadius.xl,
    paddingHorizontal: staticTheme.spacing.md,
    paddingVertical:   staticTheme.spacing.sm,
  },

  skeletonWrap:  { paddingTop: staticTheme.spacing.sm },

  emptyContainer: {
    alignItems:        'center',
    paddingVertical:   staticTheme.spacing.xl,
    paddingHorizontal: staticTheme.spacing.xl,
    gap:               staticTheme.spacing.sm,
  },
  emptyIcon: {
    width:          80,
    height:         80,
    borderRadius:   40,
    alignItems:     'center',
    justifyContent: 'center',
    marginBottom:   staticTheme.spacing.xs,
  },
  footerLoader: {
    paddingVertical: staticTheme.spacing.md,
    alignItems:      'center',
  },

  fab: {
    position:       'absolute',
    bottom:         staticTheme.spacing.xl,
    right:          staticTheme.spacing.md,
    width:          56,
    height:         56,
    borderRadius:   28,
    alignItems:     'center',
    justifyContent: 'center',
  },
});
