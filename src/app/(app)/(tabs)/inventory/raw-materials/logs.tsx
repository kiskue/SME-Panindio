/**
 * RawMaterialLogsScreen
 *
 * Paginated audit log of all raw material consumption events.
 *
 * Sections:
 *   1. Stat pills   — Total Events | Total Cost | Unique Materials
 *   2. 7-day bar chart — qty consumed per day
 *   3. By-material summary — collapsible, per-material totals
 *   4. Filter chips — All | Waste | Adjustment | Production | Sale
 *   5. Event FlatList — RawMaterialConsumptionLogCard per row
 *
 * Data flows: SQLite → raw_material_consumption_logs.store → this screen.
 * No direct DB calls here.
 *
 * Production logging note:
 *   Production entries currently only update `quantity_in_stock` directly
 *   in the `production_logs.repository`. To log raw material consumption
 *   during production, add a call to `logRawMaterialConsumption` inside
 *   `production_logs.repository.createProductionLog` — after the stock
 *   deduction and before the COMMIT — passing `reason: 'production'` and
 *   `referenceId: productionLogId`. The store and this screen will pick them
 *   up automatically on next refresh.
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
import { useFocusEffect } from 'expo-router';
import {
  Package,
  TrendingDown,
  PhilippinePeso,
  Filter,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  Trash2,
  SlidersHorizontal,
  Factory,
  ShoppingCart,
} from 'lucide-react-native';
import { Text } from '@/components/atoms/Text';
import { RawMaterialConsumptionLogCard } from '@/components/molecules/RawMaterialConsumptionLogCard';
import {
  useRawMaterialConsumptionLogsStore,
  selectRawMaterialLogs,
  selectRawMaterialLogSummary,
  selectRawMaterialLogTrend,
  selectRawMaterialLogFilters,
  selectRawMaterialLogHasMore,
  selectRawMaterialLogLoading,
  selectRawMaterialLogLoadingMore,
  selectRawMaterialLogError,
  selectRawMaterialLogTotalCount,
  selectRawMaterialWasteCost,
  useThemeStore,
  selectThemeMode,
} from '@/store';
import { useAppTheme } from '@/core/theme';
import { theme as staticTheme } from '@/core/theme';
import type {
  RawMaterialReason,
  RawMaterialConsumptionLogDetail,
  RawMaterialConsumptionSummary,
  RawMaterialConsumptionTrend,
} from '@/types';

// ─── Constants ────────────────────────────────────────────────────────────────

const DARK_ACCENT  = '#4F9EFF';
const DARK_GREEN   = '#3DD68C';
const DARK_AMBER   = '#FFB020';
const DARK_RED     = '#FF6B6B';
const DARK_CARD_BG = '#151A27';

const ALL_REASONS: RawMaterialReason[] = ['waste', 'adjustment', 'production', 'sale'];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatCurrency(value: number): string {
  return `₱${value.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
}

function formatDayLabel(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00`);
  return d.toLocaleDateString('en-PH', { weekday: 'short' });
}

function reasonColor(reason: RawMaterialReason, isDark: boolean): string {
  switch (reason) {
    case 'waste':      return isDark ? DARK_RED   : '#EF4444';
    case 'adjustment': return isDark ? DARK_AMBER : '#F59E0B';
    case 'production': return isDark ? DARK_ACCENT : staticTheme.colors.primary[500];
    case 'sale':       return isDark ? DARK_GREEN : staticTheme.colors.success[500];
  }
}

function reasonLabel(reason: RawMaterialReason): string {
  switch (reason) {
    case 'waste':      return 'Waste';
    case 'adjustment': return 'Adjustment';
    case 'production': return 'Production';
    case 'sale':       return 'Sale';
  }
}

function ReasonFilterIcon({ reason, color, size }: { reason: RawMaterialReason; color: string; size: number }) {
  switch (reason) {
    case 'waste':      return <Trash2           size={size} color={color} />;
    case 'adjustment': return <SlidersHorizontal size={size} color={color} />;
    case 'production': return <Factory          size={size} color={color} />;
    case 'sale':       return <ShoppingCart     size={size} color={color} />;
  }
}

const keyExtractor = (item: RawMaterialConsumptionLogDetail): string => item.id;

// ─── Bar Chart ────────────────────────────────────────────────────────────────

const BarChart = React.memo<{ data: RawMaterialConsumptionTrend[]; isDark: boolean; accent: string }>(
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
BarChart.displayName = 'RawMaterialConsumptionBarChart';

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
  item:   RawMaterialConsumptionSummary;
  isDark: boolean;
  accent: string;
}>(({ item, isDark, accent }) => {
  const cardBg    = isDark ? DARK_CARD_BG : '#FFFFFF';
  const border    = isDark ? `${accent}20` : `${accent}28`;
  const textMain  = isDark ? '#FFFFFF' : staticTheme.colors.gray[800];
  const textMuted = isDark ? 'rgba(255,255,255,0.45)' : staticTheme.colors.gray[500];

  return (
    <View style={[sumStyles.row, { backgroundColor: cardBg, borderColor: border }]}>
      <View style={[sumStyles.iconWrap, { backgroundColor: `${accent}18` }]}>
        <Package size={14} color={accent} />
      </View>
      <View style={sumStyles.info}>
        <Text variant="body-sm" weight="semibold" style={{ color: textMain }} numberOfLines={1}>
          {item.rawMaterialName}
        </Text>
        <Text variant="body-xs" style={{ color: textMuted }}>
          {item.eventCount} event{item.eventCount !== 1 ? 's' : ''}
        </Text>
      </View>
      <View style={sumStyles.amounts}>
        <Text variant="body-sm" weight="bold" style={{ color: accent }}>
          {Math.abs(item.totalConsumed)} {item.unit}
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
SummaryRow.displayName = 'RawMaterialSummaryRow';

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
  active:   RawMaterialReason | undefined;
  onSelect: (r: RawMaterialReason | undefined) => void;
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
      {/* All chip */}
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

      {ALL_REASONS.map((r) => {
        const isActive = active === r;
        const clr      = reasonColor(r, isDark);
        const bg       = isActive
          ? (isDark ? `${clr}22` : `${clr}15`)
          : (isDark ? 'rgba(255,255,255,0.07)' : staticTheme.colors.gray[100]);
        return (
          <Pressable
            key={r}
            style={[chipStyles.chip, { backgroundColor: bg, borderColor: isActive ? `${clr}40` : 'transparent' }]}
            onPress={() => onSelect(isActive ? undefined : r)}
            accessibilityRole="button"
            accessibilityState={{ selected: isActive }}
          >
            <ReasonFilterIcon reason={r} color={isActive ? clr : textMuted} size={11} />
            <Text variant="body-xs" weight="medium"
              style={{ color: isActive ? clr : textMuted }}>
              {reasonLabel(r)}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
});
FilterChips.displayName = 'RawMaterialFilterChips';

const chipStyles = StyleSheet.create({
  row:  { gap: 6, paddingHorizontal: staticTheme.spacing.md, paddingVertical: staticTheme.spacing.xs },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 6, borderRadius: staticTheme.borderRadius.full, borderWidth: 1 },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function RawMaterialLogsScreen() {
  const appTheme = useAppTheme();
  const isDark   = useThemeStore(selectThemeMode) === 'dark';

  const logs          = useRawMaterialConsumptionLogsStore(selectRawMaterialLogs);
  const summary       = useRawMaterialConsumptionLogsStore(selectRawMaterialLogSummary);
  const dailyTrend    = useRawMaterialConsumptionLogsStore(selectRawMaterialLogTrend);
  const filters       = useRawMaterialConsumptionLogsStore(selectRawMaterialLogFilters);
  const hasMore       = useRawMaterialConsumptionLogsStore(selectRawMaterialLogHasMore);
  const isLoading     = useRawMaterialConsumptionLogsStore(selectRawMaterialLogLoading);
  const isLoadingMore = useRawMaterialConsumptionLogsStore(selectRawMaterialLogLoadingMore);
  const error         = useRawMaterialConsumptionLogsStore(selectRawMaterialLogError);
  const totalCount    = useRawMaterialConsumptionLogsStore(selectRawMaterialLogTotalCount);
  const wasteCost     = useRawMaterialConsumptionLogsStore(selectRawMaterialWasteCost);

  const { initializeLogs, refreshLogs, loadMore, setFilters } =
    useRawMaterialConsumptionLogsStore();

  const [refreshing,       setRefreshing]       = useState(false);
  const [summaryExpanded,  setSummaryExpanded]  = useState(true);

  // Initialize on first mount
  useEffect(() => { void initializeLogs(); }, [initializeLogs]);

  // Refresh every time this screen comes into focus — catches stock adjustments
  // made on the raw-materials list screen without remounting this component.
  useFocusEffect(useCallback(() => { void refreshLogs(); }, [refreshLogs]));

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

  const handleReasonFilter = useCallback(
    (r: RawMaterialReason | undefined) => {
      // exactOptionalPropertyTypes: omit the key entirely when undefined
      const { reason: _removedReason, ...rest } = filters;
      void setFilters(
        r !== undefined ? { ...rest, reason: r } : rest,
      );
    },
    [filters, setFilters],
  );

  const accent      = isDark ? DARK_ACCENT : staticTheme.colors.primary[500];
  const greenAccent = isDark ? DARK_GREEN  : staticTheme.colors.success[500];
  const amberAccent = isDark ? DARK_AMBER  : staticTheme.colors.warning[500];

  const totalCost = useMemo(
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

  // ── Header row (title + event count) ────────────────────────────────────────
  const HeaderActions = useMemo(() => (
    <View style={scStyles.actionHeader}>
      <View style={scStyles.titleBlock}>
        <Text
          variant="h5"
          weight="bold"
          style={{ color: isDark ? '#FFFFFF' : staticTheme.colors.gray[900] }}
          numberOfLines={1}
        >
          Material Usage Logs
        </Text>
        <Text
          variant="body-xs"
          style={{ color: isDark ? 'rgba(255,255,255,0.40)' : staticTheme.colors.gray[500] }}
        >
          {totalCount} total event{totalCount !== 1 ? 's' : ''}
        </Text>
      </View>
    </View>
  ), [isDark, totalCount]);

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

        {/* Total cost — all reasons */}
        <View style={[scStyles.statPill, {
          backgroundColor: isDark ? `${greenAccent}0D` : `${greenAccent}0F`,
          borderColor:     isDark ? `${greenAccent}28` : `${greenAccent}30`,
        }]}>
          <View style={[scStyles.statIcon, { backgroundColor: `${greenAccent}18` }]}>
            <PhilippinePeso size={13} color={greenAccent} />
          </View>
          <Text variant="body-xs" numberOfLines={1}
            style={{ color: isDark ? 'rgba(255,255,255,0.50)' : staticTheme.colors.gray[500] }}>
            Total Cost
          </Text>
          <Text variant="body-sm" weight="bold" style={{ color: greenAccent }}>
            {formatCurrency(totalCost)}
          </Text>
        </View>

        {/* Total waste cost — waste reason only */}
        <View style={[scStyles.statPill, {
          backgroundColor: isDark ? `${DARK_RED}0D` : 'rgba(239,68,68,0.06)',
          borderColor:     isDark ? `${DARK_RED}28` : 'rgba(239,68,68,0.20)',
        }]}>
          <View style={[scStyles.statIcon, { backgroundColor: isDark ? `${DARK_RED}18` : 'rgba(239,68,68,0.10)' }]}>
            <Trash2 size={13} color={isDark ? DARK_RED : '#EF4444'} />
          </View>
          <Text variant="body-xs" numberOfLines={1}
            style={{ color: isDark ? 'rgba(255,255,255,0.50)' : staticTheme.colors.gray[500] }}>
            Total Waste Cost
          </Text>
          <Text variant="body-sm" weight="bold" style={{ color: isDark ? DARK_RED : '#EF4444' }}>
            {formatCurrency(wasteCost)}
          </Text>
        </View>

        {/* Unique materials */}
        <View style={[scStyles.statPill, {
          backgroundColor: isDark ? `${amberAccent}0D` : `${amberAccent}0F`,
          borderColor:     isDark ? `${amberAccent}28` : `${amberAccent}30`,
        }]}>
          <View style={[scStyles.statIcon, { backgroundColor: `${amberAccent}18` }]}>
            <Package size={13} color={amberAccent} />
          </View>
          <Text variant="body-xs" numberOfLines={1}
            style={{ color: isDark ? 'rgba(255,255,255,0.50)' : staticTheme.colors.gray[500] }}>
            Materials
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

      {/* By-material summary (collapsible) */}
      {summary.length > 0 && (
        <View style={sectionCardStyle}>
          <Pressable
            style={scStyles.sectionHeader}
            onPress={() => {
              LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
              setSummaryExpanded((p) => !p);
            }}
            accessibilityRole="button"
            accessibilityLabel={summaryExpanded ? 'Collapse material summary' : 'Expand material summary'}
          >
            <View style={[scStyles.sectionIconPill, { backgroundColor: `${greenAccent}18` }]}>
              <Package size={14} color={greenAccent} />
            </View>
            <View style={{ flex: 1 }}>
              <Text variant="body-sm" weight="semibold"
                style={{ color: isDark ? '#FFFFFF' : staticTheme.colors.gray[800] }}>
                By Material
              </Text>
              <Text variant="body-xs"
                style={{ color: isDark ? 'rgba(255,255,255,0.40)' : staticTheme.colors.gray[500] }}>
                {summary.length} material{summary.length !== 1 ? 's' : ''} consumed
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
                <SummaryRow key={s.rawMaterialId} item={s} isDark={isDark} accent={greenAccent} />
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
        active={filters.reason}
        onSelect={handleReasonFilter}
        isDark={isDark}
        accent={accent}
      />
    </View>
  ), [
    error, isDark, accent, greenAccent, amberAccent,
    totalCount, totalCost, wasteCost, summary, dailyTrend, sectionCardStyle,
    filters.reason, handleReasonFilter, logs.length, summaryExpanded,
  ]);

  const ListEmpty = useMemo(() => (
    isLoading ? null : (
      <View style={scStyles.emptyContainer}>
        <View style={[scStyles.emptyIcon, { backgroundColor: `${accent}15` }]}>
          <Package size={32} color={`${accent}80`} />
        </View>
        <Text variant="body" weight="semibold"
          style={{ color: isDark ? 'rgba(255,255,255,0.60)' : staticTheme.colors.gray[600] }}>
          No consumption events
        </Text>
        <Text variant="body-sm" align="center"
          style={{ color: isDark ? 'rgba(255,255,255,0.30)' : staticTheme.colors.gray[400] }}>
          Raw material usage is logged when stock adjustments are recorded.
          Production consumption will appear here once production logging is wired in.
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
    ({ item }: { item: RawMaterialConsumptionLogDetail }) => (
      <RawMaterialConsumptionLogCard item={item} isDark={isDark} />
    ),
    [isDark],
  );

  return (
    <View style={[scStyles.root, { backgroundColor: isDark ? '#0F0F14' : appTheme.colors.background }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />

      {/* Title row */}
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
    </View>
  );
}

const scStyles = StyleSheet.create({
  root:         { flex: 1 },
  content:      { paddingBottom: staticTheme.spacing.xl },
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

  sectionHeader:   { flexDirection: 'row', alignItems: 'center', gap: staticTheme.spacing.sm, paddingHorizontal: staticTheme.spacing.md, paddingTop: staticTheme.spacing.md, paddingBottom: staticTheme.spacing.xs },
  sectionIconPill: { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },

  errorBanner: { flexDirection: 'row', alignItems: 'center', gap: staticTheme.spacing.sm, marginHorizontal: staticTheme.spacing.md, marginTop: staticTheme.spacing.sm, borderWidth: 1, borderRadius: staticTheme.borderRadius.xl, paddingHorizontal: staticTheme.spacing.md, paddingVertical: staticTheme.spacing.sm },

  emptyContainer: { alignItems: 'center', paddingVertical: staticTheme.spacing.xl, paddingHorizontal: staticTheme.spacing.xl, gap: staticTheme.spacing.sm },
  emptyIcon:      { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', marginBottom: staticTheme.spacing.xs },

  footerLoader: { paddingVertical: staticTheme.spacing.md, alignItems: 'center' },
});
