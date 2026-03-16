/**
 * IngredientLogsScreen
 *
 * Paginated audit log of all ingredient consumption events.
 * Shows a per-ingredient summary header, a 7-day trend bar chart,
 * filter chips (trigger type), and a scrollable event list.
 *
 * The "+ Manual Entry" FAB opens ManualEntryBottomSheet for ad-hoc
 * consumption recording (MANUAL_ADJUSTMENT, WASTAGE, RETURN, TRANSFER).
 *
 * Data flows: SQLite → ingredient_consumption.store → this screen.
 * No direct DB calls here.
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
  ScrollView,
  RefreshControl,
  Platform,
  ActivityIndicator,
  LayoutAnimation,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import {
  Wheat,
  TrendingDown,
  DollarSign,
  AlertCircle,
  Filter,
  ChevronDown,
  ChevronUp,
  Plus,
} from 'lucide-react-native';
import { Text } from '@/components/atoms/Text';
import {
  IngredientConsumptionLogCard,
  TriggerIcon,
  TRIGGER_LABELS,
  ManualEntryBottomSheet,
} from '@/components/organisms';
import {
  useIngredientConsumptionStore,
  selectConsumptionLogs,
  selectConsumptionSummary,
  selectConsumptionTrend,
  selectConsumptionFilters,
  selectConsumptionHasMore,
  selectConsumptionLoading,
  selectConsumptionLoadingMore,
  selectConsumptionError,
  selectConsumptionTotalCount,
  useThemeStore,
  selectThemeMode,
} from '@/store';
import { useAppTheme } from '@/core/theme';
import { theme as staticTheme } from '@/core/theme';
import type {
  IngredientConsumptionLogDetail,
  IngredientConsumptionSummary,
  IngredientConsumptionTrigger,
} from '@/types';
import type { ConsumptionDailyTrend } from '@/store/ingredient_consumption.store';

// ─── Constants ────────────────────────────────────────────────────────────────

const DARK_ACCENT  = '#4F9EFF';
const DARK_GREEN   = '#3DD68C';
const DARK_AMBER   = '#FFB020';
const DARK_RED     = '#FF6B6B';
const DARK_CARD_BG = '#151A27';

const ALL_TRIGGERS: IngredientConsumptionTrigger[] = [
  'PRODUCTION',
  'MANUAL_ADJUSTMENT',
  'WASTAGE',
  'RETURN',
  'TRANSFER',
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatCurrency(value: number): string {
  return `₱${value.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
}

function formatDayLabel(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00`);
  return d.toLocaleDateString('en-PH', { weekday: 'short' });
}

function triggerColorLocal(
  trigger: IngredientConsumptionTrigger,
  isDark:  boolean,
): string {
  switch (trigger) {
    case 'PRODUCTION':        return isDark ? DARK_ACCENT : staticTheme.colors.primary[500];
    case 'MANUAL_ADJUSTMENT': return isDark ? DARK_AMBER  : staticTheme.colors.warning[500];
    case 'WASTAGE':           return isDark ? DARK_RED    : staticTheme.colors.error[500];
    case 'RETURN':            return isDark ? DARK_GREEN  : staticTheme.colors.success[500];
    case 'TRANSFER':          return isDark ? '#A78BFA'   : staticTheme.colors.info[500];
  }
}

const keyExtractor = (item: IngredientConsumptionLogDetail): string => item.id;

// ─── Bar Chart ────────────────────────────────────────────────────────────────

const BarChart = React.memo<{ data: ConsumptionDailyTrend[]; isDark: boolean; accent: string }>(
  ({ data, isDark, accent }) => {
    const maxVal   = useMemo(
      () => data.reduce((m, d) => Math.max(m, d.totalConsumed), 0),
      [data],
    );
    const todayStr = new Date().toISOString().slice(0, 10);

    if (data.length === 0) {
      return (
        <View style={barStyles.empty}>
          <Text variant="body-xs"
            style={{ color: isDark ? 'rgba(255,255,255,0.30)' : staticTheme.colors.gray[400] }}>
            No trend data yet
          </Text>
        </View>
      );
    }

    return (
      <View style={barStyles.container}>
        <View style={barStyles.yAxis}>
          <Text variant="body-xs"
            style={{ color: isDark ? 'rgba(255,255,255,0.35)' : staticTheme.colors.gray[400] }}>
            {maxVal % 1 === 0 ? String(maxVal) : maxVal.toFixed(1)}
          </Text>
          <Text variant="body-xs"
            style={{ color: isDark ? 'rgba(255,255,255,0.35)' : staticTheme.colors.gray[400] }}>
            0
          </Text>
        </View>
        <View style={barStyles.barsWrap}>
          <View style={[barStyles.barsBg, { backgroundColor: isDark ? 'rgba(79,158,255,0.07)' : `${accent}0A` }]}>
            {data.map((point) => {
              const ratio   = maxVal > 0 ? point.totalConsumed / maxVal : 0;
              const isToday = point.date === todayStr;
              const barClr  = isToday ? accent : (isDark ? `${accent}60` : `${accent}80`);
              return (
                <View key={point.date} style={barStyles.barCol}>
                  <View style={{ flex: 1 }} />
                  <View style={[
                    barStyles.bar,
                    {
                      height: Math.max(4, Math.round(ratio * 80)),
                      backgroundColor: barClr,
                      ...(isToday ? {
                        shadowColor:   accent,
                        shadowOffset:  { width: 0, height: -2 },
                        shadowOpacity: 0.45,
                        shadowRadius:  6,
                        elevation:     4,
                      } : {}),
                    },
                  ]} />
                  <Text variant="body-xs"
                    style={[barStyles.dayLabel, {
                      color:      isToday ? accent : (isDark ? 'rgba(255,255,255,0.38)' : staticTheme.colors.gray[500]),
                      fontWeight: isToday ? '600' : '400',
                    }]}
                    numberOfLines={1}>
                    {formatDayLabel(point.date)}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>
      </View>
    );
  },
);
BarChart.displayName = 'ConsumptionBarChart';

const barStyles = StyleSheet.create({
  container: { flexDirection: 'row', height: 120, gap: 6 },
  yAxis:     { width: 32, justifyContent: 'space-between', alignItems: 'flex-end', paddingBottom: 20 },
  barsWrap:  { flex: 1 },
  barsBg:    { flex: 1, flexDirection: 'row', alignItems: 'flex-end', borderRadius: staticTheme.borderRadius.lg, paddingHorizontal: 6, paddingTop: 8 },
  barCol:    { flex: 1, alignItems: 'center', height: '100%' },
  bar:       { width: '70%', borderTopLeftRadius: 4, borderTopRightRadius: 4 },
  dayLabel:  { marginTop: 4, fontSize: 10 },
  empty:     { height: 80, alignItems: 'center', justifyContent: 'center' },
});

// ─── Summary Row ──────────────────────────────────────────────────────────────

const SummaryRow = React.memo<{
  item:    IngredientConsumptionSummary;
  isDark:  boolean;
  accent:  string;
}>(({ item, isDark, accent }) => {
  const cardBg    = isDark ? DARK_CARD_BG : '#FFFFFF';
  const border    = isDark ? `${accent}20` : `${accent}28`;
  const textMain  = isDark ? '#FFFFFF' : staticTheme.colors.gray[800];
  const textMuted = isDark ? 'rgba(255,255,255,0.45)' : staticTheme.colors.gray[500];

  return (
    <View style={[sumStyles.row, { backgroundColor: cardBg, borderColor: border }]}>
      <View style={[sumStyles.iconWrap, { backgroundColor: `${accent}18` }]}>
        <Wheat size={14} color={accent} />
      </View>
      <View style={sumStyles.info}>
        <Text variant="body-sm" weight="semibold" style={{ color: textMain }} numberOfLines={1}>
          {item.ingredientName}
        </Text>
        <Text variant="body-xs" style={{ color: textMuted }}>
          {item.eventCount} event{item.eventCount !== 1 ? 's' : ''}
        </Text>
      </View>
      <View style={sumStyles.amounts}>
        <Text variant="body-sm" weight="bold" style={{ color: accent }}>
          {item.totalConsumed} {item.unit}
        </Text>
        {item.totalCost > 0 && (
          <Text variant="body-xs" style={{ color: textMuted }}>
            {formatCurrency(item.totalCost)}
          </Text>
        )}
      </View>
    </View>
  );
});
SummaryRow.displayName = 'SummaryRow';

const sumStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: staticTheme.spacing.sm,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: staticTheme.borderRadius.lg,
    borderWidth: 1,
    marginBottom: 6,
  },
  iconWrap: {
    width: 32, height: 32, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  info:    { flex: 1, gap: 2 },
  amounts: { alignItems: 'flex-end', gap: 2, flexShrink: 0 },
});

// ─── Filter Chips ─────────────────────────────────────────────────────────────

interface FilterChipsProps {
  active:   IngredientConsumptionTrigger | undefined;
  onSelect: (t: IngredientConsumptionTrigger | undefined) => void;
  isDark:   boolean;
  accent:   string;
}

const FilterChips = React.memo<FilterChipsProps>(({ active, onSelect, isDark, accent }) => {
  const textMuted = isDark ? 'rgba(255,255,255,0.45)' : staticTheme.colors.gray[500];
  const allBg     = active === undefined
    ? (isDark ? `${accent}22` : `${accent}15`)
    : (isDark ? 'rgba(255,255,255,0.07)' : staticTheme.colors.gray[100]);

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={chipStyles.row}
    >
      {/* All */}
      <Pressable
        style={[chipStyles.chip, { backgroundColor: allBg, borderColor: active === undefined ? `${accent}40` : 'transparent' }]}
        onPress={() => onSelect(undefined)}
        accessibilityRole="button"
        accessibilityState={{ selected: active === undefined }}
      >
        <Filter size={11} color={active === undefined ? accent : textMuted} />
        <Text variant="body-xs" weight="medium"
          style={{ color: active === undefined ? accent : textMuted }}>
          All
        </Text>
      </Pressable>

      {ALL_TRIGGERS.map((t) => {
        const isActive = active === t;
        const clr      = triggerColorLocal(t, isDark);
        const bg       = isActive
          ? (isDark ? `${clr}22` : `${clr}15`)
          : (isDark ? 'rgba(255,255,255,0.07)' : staticTheme.colors.gray[100]);
        return (
          <Pressable
            key={t}
            style={[chipStyles.chip, { backgroundColor: bg, borderColor: isActive ? `${clr}40` : 'transparent' }]}
            onPress={() => onSelect(isActive ? undefined : t)}
            accessibilityRole="button"
            accessibilityState={{ selected: isActive }}
          >
            <TriggerIcon trigger={t} color={isActive ? clr : textMuted} size={11} />
            <Text variant="body-xs" weight="medium"
              style={{ color: isActive ? clr : textMuted }}>
              {TRIGGER_LABELS[t]}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
});
FilterChips.displayName = 'FilterChips';

const chipStyles = StyleSheet.create({
  row:  { gap: 6, paddingHorizontal: staticTheme.spacing.md, paddingVertical: staticTheme.spacing.xs },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 6, borderRadius: staticTheme.borderRadius.full, borderWidth: 1 },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function IngredientLogsScreen() {
  const appTheme = useAppTheme();
  const isDark   = useThemeStore(selectThemeMode) === 'dark';

  const logs          = useIngredientConsumptionStore(selectConsumptionLogs);
  const summary       = useIngredientConsumptionStore(selectConsumptionSummary);
  const dailyTrend    = useIngredientConsumptionStore(selectConsumptionTrend);
  const filters       = useIngredientConsumptionStore(selectConsumptionFilters);
  const hasMore       = useIngredientConsumptionStore(selectConsumptionHasMore);
  const isLoading     = useIngredientConsumptionStore(selectConsumptionLoading);
  const isLoadingMore = useIngredientConsumptionStore(selectConsumptionLoadingMore);
  const error         = useIngredientConsumptionStore(selectConsumptionError);
  const totalCount    = useIngredientConsumptionStore(selectConsumptionTotalCount);

  const { initializeLogs, refreshLogs, loadMore, setFilters } =
    useIngredientConsumptionStore();

  const [refreshing, setRefreshing]           = useState(false);
  const [summaryExpanded, setSummaryExpanded] = useState(true);
  const [entrySheetVisible, setEntrySheetVisible] = useState(false);
  // Incremented each time the sheet opens so the component remounts with fresh
  // form state (ensures defaultValues picks up the latest initialTrigger).
  const [sheetKey, setSheetKey] = useState(0);
  // Track which log card the user last tapped so its trigger can pre-fill the
  // manual entry form.  Stored as the log id rather than the trigger so we can
  // both highlight the card and derive the trigger in one place.
  const [selectedLogId, setSelectedLogId] = useState<string | undefined>(undefined);

  useEffect(() => { void initializeLogs(); }, [initializeLogs]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await refreshLogs();
    setRefreshing(false);
  }, [refreshLogs]);

  const handleEndReached = useCallback(() => {
    if (hasMore && !isLoadingMore) {
      void loadMore();
    }
  }, [hasMore, isLoadingMore, loadMore]);

  const handleTriggerFilter = useCallback(
    (t: IngredientConsumptionTrigger | undefined) => {
      // exactOptionalPropertyTypes: omit the key entirely when undefined
      const { triggerType: _removed, ...rest } = filters;
      void setFilters(
        t !== undefined ? { ...rest, triggerType: t } : rest,
      );
    },
    [filters, setFilters],
  );

  const accent      = isDark ? DARK_ACCENT  : staticTheme.colors.primary[500];
  const greenAccent = isDark ? DARK_GREEN   : staticTheme.colors.success[500];
  const amberAccent = isDark ? DARK_AMBER   : staticTheme.colors.warning[500];

  // Derive the ManualTrigger from the selected log, if any.
  // PRODUCTION is excluded because it is not a valid manual entry trigger.
  const MANUAL_TRIGGER_SET: ReadonlySet<IngredientConsumptionTrigger> = useMemo(
    () => new Set<IngredientConsumptionTrigger>(['MANUAL_ADJUSTMENT', 'WASTAGE', 'RETURN', 'TRANSFER']),
    [],
  );

  const selectedLog = useMemo(
    () => (selectedLogId !== undefined ? logs.find((l) => l.id === selectedLogId) : undefined),
    [selectedLogId, logs],
  );

  // Only pass a trigger hint when it is a manually-enterable trigger type.
  const prefilledTrigger = useMemo(() => {
    if (selectedLog === undefined) return undefined;
    return MANUAL_TRIGGER_SET.has(selectedLog.triggerType)
      ? (selectedLog.triggerType as 'MANUAL_ADJUSTMENT' | 'WASTAGE' | 'RETURN' | 'TRANSFER')
      : undefined;
  }, [selectedLog, MANUAL_TRIGGER_SET]);

  const handleOpenEntrySheet = useCallback(() => {
    setSheetKey((k) => k + 1); // remount sheet so defaultValues picks up initialTrigger
    setEntrySheetVisible(true);
  }, []);

  const handleCloseEntrySheet = useCallback(() => {
    setEntrySheetVisible(false);
    // Clear the selection so the next open starts fresh unless the user taps a
    // card again before opening.
    setSelectedLogId(undefined);
  }, []);

  const handleCardPress = useCallback((id: string) => {
    // Toggle off if same card tapped again
    setSelectedLogId((prev) => (prev === id ? undefined : id));
  }, []);

  const totalConsumedCost = useMemo(
    () => summary.reduce((s, r) => s + r.totalCost, 0),
    [summary],
  );

  const sectionCardStyle = useMemo(() => ({
    backgroundColor:  isDark ? DARK_CARD_BG : appTheme.colors.surface,
    borderColor:      isDark ? `${accent}18` : appTheme.colors.border,
    borderWidth:      1,
    borderRadius:     staticTheme.borderRadius.xl,
    marginHorizontal: staticTheme.spacing.md,
    marginTop:        staticTheme.spacing.sm,
    overflow:         'hidden' as const,
  }), [isDark, accent, appTheme.colors]);

  // ── "+ Manual Entry" header row ──────────────────────────────────────────────
  const HeaderActions = useMemo(() => (
    <View style={scStyles.actionHeader}>
      {/* Screen title */}
      <View style={scStyles.titleBlock}>
        <Text
          variant="h5"
          weight="bold"
          style={{ color: isDark ? '#FFFFFF' : staticTheme.colors.gray[900] }}
          numberOfLines={1}
        >
          Consumption Logs
        </Text>
        <Text
          variant="body-xs"
          style={{ color: isDark ? 'rgba(255,255,255,0.40)' : staticTheme.colors.gray[500] }}
        >
          {totalCount} total event{totalCount !== 1 ? 's' : ''}
        </Text>
      </View>

      {/* Manual Entry button */}
      <Pressable
        style={({ pressed }) => [
          scStyles.manualEntryBtn,
          {
            backgroundColor: pressed
              ? isDark ? `${accent}35` : `${accent}20`
              : isDark ? `${accent}22` : `${accent}12`,
            borderColor: isDark ? `${accent}50` : `${accent}40`,
          },
        ]}
        onPress={handleOpenEntrySheet}
        accessibilityRole="button"
        accessibilityLabel="Add manual consumption entry"
      >
        <Plus size={15} color={accent} />
        <Text variant="body-sm" weight="semibold" style={{ color: accent }}>
          Manual Entry
        </Text>
      </Pressable>
    </View>
  ), [isDark, accent, totalCount, handleOpenEntrySheet]);

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
          <AlertCircle size={15} color={isDark ? DARK_RED : staticTheme.colors.error[500]} />
          <Text variant="body-xs" numberOfLines={2}
            style={{ color: isDark ? DARK_RED : staticTheme.colors.error[500], flex: 1 }}>
            {error}
          </Text>
        </View>
      )}

      {/* Stat pills */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false}
        contentContainerStyle={scStyles.statsScroll}>
        {/* Total events */}
        <View style={[scStyles.statPill, {
          backgroundColor: isDark ? `${accent}0D` : `${accent}0F`,
          borderColor:     isDark ? `${accent}28` : `${accent}30`,
        }]}>
          <View style={[scStyles.statIcon, { backgroundColor: `${accent}18` }]}>
            <TrendingDown size={13} color={accent} />
          </View>
          <Text variant="body-xs" numberOfLines={1}
            style={{ color: isDark ? 'rgba(255,255,255,0.50)' : staticTheme.colors.gray[500] }}>
            Events
          </Text>
          <Text variant="body-sm" weight="bold" style={{ color: accent }}>
            {totalCount}
          </Text>
        </View>

        {/* Total cost */}
        <View style={[scStyles.statPill, {
          backgroundColor: isDark ? `${greenAccent}0D` : `${greenAccent}0F`,
          borderColor:     isDark ? `${greenAccent}28` : `${greenAccent}30`,
        }]}>
          <View style={[scStyles.statIcon, { backgroundColor: `${greenAccent}18` }]}>
            <DollarSign size={13} color={greenAccent} />
          </View>
          <Text variant="body-xs" numberOfLines={1}
            style={{ color: isDark ? 'rgba(255,255,255,0.50)' : staticTheme.colors.gray[500] }}>
            Total Cost
          </Text>
          <Text variant="body-sm" weight="bold" style={{ color: greenAccent }}>
            {formatCurrency(totalConsumedCost)}
          </Text>
        </View>

        {/* Unique ingredients */}
        <View style={[scStyles.statPill, {
          backgroundColor: isDark ? `${amberAccent}0D` : `${amberAccent}0F`,
          borderColor:     isDark ? `${amberAccent}28` : `${amberAccent}30`,
        }]}>
          <View style={[scStyles.statIcon, { backgroundColor: `${amberAccent}18` }]}>
            <Wheat size={13} color={amberAccent} />
          </View>
          <Text variant="body-xs" numberOfLines={1}
            style={{ color: isDark ? 'rgba(255,255,255,0.50)' : staticTheme.colors.gray[500] }}>
            Ingredients
          </Text>
          <Text variant="body-sm" weight="bold" style={{ color: amberAccent }}>
            {summary.length}
          </Text>
        </View>
      </ScrollView>

      {/* 7-Day Trend Chart */}
      <View style={sectionCardStyle}>
        <View style={scStyles.sectionHeader}>
          <View style={[scStyles.sectionIconPill, { backgroundColor: `${accent}18` }]}>
            <TrendingDown size={14} color={accent} />
          </View>
          <View>
            <Text variant="body-sm" weight="semibold"
              style={{ color: isDark ? '#FFFFFF' : staticTheme.colors.gray[800] }}>
              Last 7 Days
            </Text>
            <Text variant="body-xs"
              style={{ color: isDark ? 'rgba(255,255,255,0.40)' : staticTheme.colors.gray[500] }}>
              Qty consumed per day
            </Text>
          </View>
        </View>
        <View style={{ paddingHorizontal: staticTheme.spacing.md, paddingBottom: staticTheme.spacing.md }}>
          <BarChart data={dailyTrend} isDark={isDark} accent={accent} />
        </View>
      </View>

      {/* Per-ingredient summary (collapsible) */}
      {summary.length > 0 && (
        <View style={sectionCardStyle}>
          <Pressable
            style={scStyles.sectionHeader}
            onPress={() => {
              LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
              setSummaryExpanded((p) => !p);
            }}
            accessibilityRole="button"
            accessibilityLabel={summaryExpanded ? 'Collapse ingredient summary' : 'Expand ingredient summary'}
          >
            <View style={[scStyles.sectionIconPill, { backgroundColor: `${greenAccent}18` }]}>
              <Wheat size={14} color={greenAccent} />
            </View>
            <View style={{ flex: 1 }}>
              <Text variant="body-sm" weight="semibold"
                style={{ color: isDark ? '#FFFFFF' : staticTheme.colors.gray[800] }}>
                By Ingredient
              </Text>
              <Text variant="body-xs"
                style={{ color: isDark ? 'rgba(255,255,255,0.40)' : staticTheme.colors.gray[500] }}>
                {summary.length} ingredient{summary.length !== 1 ? 's' : ''} consumed
              </Text>
            </View>
            {summaryExpanded
              ? <ChevronUp   size={16} color={isDark ? 'rgba(255,255,255,0.40)' : staticTheme.colors.gray[500]} style={{ marginRight: staticTheme.spacing.md }} />
              : <ChevronDown size={16} color={isDark ? 'rgba(255,255,255,0.40)' : staticTheme.colors.gray[500]} style={{ marginRight: staticTheme.spacing.md }} />
            }
          </Pressable>
          {summaryExpanded && (
            <View style={{ paddingHorizontal: staticTheme.spacing.md, paddingBottom: staticTheme.spacing.md }}>
              {summary.map((s) => (
                <SummaryRow key={s.ingredientId} item={s} isDark={isDark} accent={greenAccent} />
              ))}
            </View>
          )}
        </View>
      )}

      {/* Event log label + filter chips */}
      <View style={scStyles.sectionHeader}>
        <View style={[scStyles.sectionIconPill, { backgroundColor: `${accent}18` }]}>
          <Filter size={14} color={accent} />
        </View>
        <View>
          <Text variant="body-sm" weight="semibold"
            style={{ color: isDark ? '#FFFFFF' : staticTheme.colors.gray[800] }}>
            Event Log
          </Text>
          <Text variant="body-xs"
            style={{ color: isDark ? 'rgba(255,255,255,0.40)' : staticTheme.colors.gray[500] }}>
            {logs.length} of {totalCount} events
          </Text>
        </View>
      </View>

      <FilterChips
        active={filters.triggerType}
        onSelect={handleTriggerFilter}
        isDark={isDark}
        accent={accent}
      />

      {/* Selection hint banner — shown when a card is selected and its trigger
          is a valid manual entry type */}
      {prefilledTrigger !== undefined && (
        <View style={[
          scStyles.selectionHint,
          {
            backgroundColor: isDark ? `${triggerColorLocal(prefilledTrigger, isDark)}14` : `${triggerColorLocal(prefilledTrigger, isDark)}0D`,
            borderColor:     isDark ? `${triggerColorLocal(prefilledTrigger, isDark)}35` : `${triggerColorLocal(prefilledTrigger, isDark)}30`,
          },
        ]}>
          <TriggerIcon
            trigger={prefilledTrigger}
            color={triggerColorLocal(prefilledTrigger, isDark)}
            size={12}
          />
          <Text variant="body-xs" weight="medium"
            style={{ color: triggerColorLocal(prefilledTrigger, isDark), flex: 1 }}>
            Tap "Manual Entry" — form will open with{' '}
            <Text variant="body-xs" weight="semibold"
              style={{ color: triggerColorLocal(prefilledTrigger, isDark) }}>
              {TRIGGER_LABELS[prefilledTrigger]}
            </Text>
            {' '}pre-selected
          </Text>
          <Pressable
            onPress={() => setSelectedLogId(undefined)}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Clear pre-selection"
          >
            <Text variant="body-xs" style={{ color: isDark ? 'rgba(255,255,255,0.35)' : staticTheme.colors.gray[400] }}>
              ✕
            </Text>
          </Pressable>
        </View>
      )}
    </View>
  ), [
    error, isDark, accent, greenAccent, amberAccent,
    totalCount, totalConsumedCost, summary, dailyTrend, sectionCardStyle,
    filters.triggerType, handleTriggerFilter, logs.length, summaryExpanded,
    prefilledTrigger,
  ]);

  const ListEmpty = useMemo(() => (
    isLoading ? null : (
      <View style={scStyles.emptyContainer}>
        <View style={[scStyles.emptyIcon, { backgroundColor: `${accent}15` }]}>
          <Wheat size={32} color={`${accent}80`} />
        </View>
        <Text variant="body" weight="semibold"
          style={{ color: isDark ? 'rgba(255,255,255,0.60)' : staticTheme.colors.gray[600] }}>
          No consumption events
        </Text>
        <Text variant="body-sm" align="center"
          style={{ color: isDark ? 'rgba(255,255,255,0.30)' : staticTheme.colors.gray[400] }}>
          Ingredient consumption is logged automatically when production runs
          are recorded. Use Manual Entry to record ad-hoc events.
        </Text>
      </View>
    )
  ), [isLoading, isDark, accent]);

  const ListFooter = useMemo(() => {
    if (!isLoadingMore) return null;
    return (
      <View style={scStyles.footerLoader}>
        <ActivityIndicator size="small" color={accent} />
      </View>
    );
  }, [isLoadingMore, accent]);

  const renderItem = useCallback(
    ({ item }: { item: IngredientConsumptionLogDetail }) => (
      <IngredientConsumptionLogCard
        item={item}
        isDark={isDark}
        selected={selectedLogId === item.id}
        onPress={() => handleCardPress(item.id)}
      />
    ),
    [isDark, selectedLogId, handleCardPress],
  );

  return (
    <View style={[scStyles.root, { backgroundColor: isDark ? '#0F0F14' : appTheme.colors.background }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />

      {/* Header actions row (title + Manual Entry button) */}
      {HeaderActions}

      <FlatList
        data={logs}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        ListHeaderComponent={ListHeader}
        ListEmptyComponent={ListEmpty}
        ListFooterComponent={ListFooter}
        onEndReached={handleEndReached}
        onEndReachedThreshold={0.3}
        contentContainerStyle={[
          scStyles.content,
          logs.length === 0 && scStyles.contentEmpty,
        ]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={accent}
            colors={[accent]}
          />
        }
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        removeClippedSubviews={Platform.OS === 'android'}
        maxToRenderPerBatch={15}
        windowSize={8}
        initialNumToRender={15}
      />

      {/* Manual Entry bottom sheet — initialTrigger is pre-filled from the
          selected log card when applicable (excludes PRODUCTION). */}
      <ManualEntryBottomSheet
        key={sheetKey}
        visible={entrySheetVisible}
        onClose={handleCloseEntrySheet}
        isDark={isDark}
        {...(prefilledTrigger !== undefined ? { initialTrigger: prefilledTrigger } : {})}
      />
    </View>
  );
}

const scStyles = StyleSheet.create({
  root:         { flex: 1 },
  content:      { paddingBottom: staticTheme.spacing.xl },
  contentEmpty: { flexGrow: 1 },

  // Header actions bar (title + button row)
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
  manualEntryBtn: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               6,
    paddingHorizontal: 12,
    paddingVertical:   8,
    borderRadius:      staticTheme.borderRadius.full,
    borderWidth:       1,
    flexShrink:        0,
  },

  // Stats row
  statsScroll: { gap: 6, paddingHorizontal: staticTheme.spacing.md, paddingVertical: staticTheme.spacing.sm },
  statPill: {
    borderRadius: staticTheme.borderRadius.xl,
    borderWidth:  1,
    padding:      staticTheme.spacing.sm,
    gap:          4,
    minWidth:     90,
  },
  statIcon: {
    width: 28, height: 28, borderRadius: 9,
    alignItems: 'center', justifyContent: 'center',
  },

  // Section header
  sectionHeader:   { flexDirection: 'row', alignItems: 'center', gap: staticTheme.spacing.sm, paddingHorizontal: staticTheme.spacing.md, paddingTop: staticTheme.spacing.md, paddingBottom: staticTheme.spacing.xs },
  sectionIconPill: { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },

  // Banners
  errorBanner: { flexDirection: 'row', alignItems: 'center', gap: staticTheme.spacing.sm, marginHorizontal: staticTheme.spacing.md, marginTop: staticTheme.spacing.sm, borderWidth: 1, borderRadius: staticTheme.borderRadius.xl, paddingHorizontal: staticTheme.spacing.md, paddingVertical: staticTheme.spacing.sm },

  // Selection hint (shown below filter chips when a card is selected)
  selectionHint: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               staticTheme.spacing.xs,
    marginHorizontal:  staticTheme.spacing.md,
    marginTop:         staticTheme.spacing.xs,
    marginBottom:      staticTheme.spacing.xs,
    borderWidth:       1,
    borderRadius:      staticTheme.borderRadius.lg,
    paddingHorizontal: staticTheme.spacing.sm,
    paddingVertical:   8,
  },

  // Empty state
  emptyContainer: { alignItems: 'center', paddingVertical: staticTheme.spacing.xl, paddingHorizontal: staticTheme.spacing.xl, gap: staticTheme.spacing.sm },
  emptyIcon:      { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', marginBottom: staticTheme.spacing.xs },
  emptyAction:    { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingVertical: 10, borderRadius: staticTheme.borderRadius.full, borderWidth: 1, marginTop: staticTheme.spacing.xs },

  // Footer
  footerLoader: { paddingVertical: staticTheme.spacing.md, alignItems: 'center' },
});
