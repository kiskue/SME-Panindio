/**
 * ProductionScreen
 *
 * Daily production monitoring dashboard inside the Inventory stack.
 * Shows today's stat bar, a 7-day bar chart, and today's production run cards
 * with expandable ingredient breakdowns.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  FlatList,
  StyleSheet,
  Pressable,
  RefreshControl,
  ScrollView,
  Platform,
  LayoutAnimation,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import {
  Factory,
  Package,
  Wheat,
  TrendingUp,
  DollarSign,
  Clock,
  ChevronDown,
  ChevronUp,
  BarChart2,
  AlertCircle,
  Layers,
} from 'lucide-react-native';
import { Text } from '@/components/atoms/Text';
import {
  useProductionStore,
  selectTodaySummary,
  selectDailyTrend,
  selectProductionLogs,
  selectProductionLoading,
  selectProductionError,
  useThemeStore,
  selectThemeMode,
} from '@/store';
import { useAppTheme } from '@/core/theme';
import { theme as staticTheme } from '@/core/theme';
import type { ProductionLogWithDetails, ProductionLogIngredientDetail, RawMaterialConsumedDetail } from '@/types';
import type { DailyTrendPoint } from '@/store/production.store';

// ─── Constants ────────────────────────────────────────────────────────────────

const DARK_ACCENT  = '#4F9EFF';
const DARK_GREEN   = '#3DD68C';
const DARK_AMBER   = '#FFB020';
const DARK_CARD_BG = '#151A27';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatCurrency(value: number): string {
  return `₱${value.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  let h = d.getHours();
  const m = d.getMinutes();
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12;
  if (h === 0) h = 12;
  return `${h}:${m.toString().padStart(2, '0')} ${ampm}`;
}

function formatDayLabel(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00`);
  return d.toLocaleDateString('en-PH', { weekday: 'short' });
}

const keyExtractor = (item: ProductionLogWithDetails) => item.id;

// ─── StatCard ─────────────────────────────────────────────────────────────────

interface StatCardProps {
  label:       string;
  value:       string;
  icon:        React.ReactNode;
  accentColor: string;
  isDark:      boolean;
}

const StatCard = React.memo<StatCardProps>(({ label, value, icon, accentColor, isDark }) => (
  <View style={[
    statStyles.card,
    {
      backgroundColor: isDark ? `${accentColor}0D` : `${accentColor}0F`,
      borderColor:     isDark ? `${accentColor}28` : `${accentColor}30`,
    },
  ]}>
    <View style={[statStyles.iconWrap, { backgroundColor: `${accentColor}18` }]}>
      {icon}
    </View>
    <Text variant="body-xs" numberOfLines={1}
      style={{ color: isDark ? 'rgba(255,255,255,0.50)' : staticTheme.colors.gray[500] }}>
      {label}
    </Text>
    <Text variant="body-sm" weight="bold" numberOfLines={1} style={{ color: accentColor }}>
      {value}
    </Text>
  </View>
));
StatCard.displayName = 'StatCard';

const statStyles = StyleSheet.create({
  card: {
    borderRadius: staticTheme.borderRadius.xl,
    borderWidth: 1,
    padding: staticTheme.spacing.sm,
    gap: 4,
    minWidth: 90,
  },
  iconWrap: {
    width: 28, height: 28, borderRadius: 9,
    alignItems: 'center', justifyContent: 'center',
  },
});

// ─── Bar Chart ────────────────────────────────────────────────────────────────

const BarChart = React.memo<{ data: DailyTrendPoint[]; isDark: boolean; accent: string }>(
  ({ data, isDark, accent }) => {
    const maxUnits = useMemo(() => data.reduce((m, d) => Math.max(m, d.totalUnits), 0), [data]);
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
          <Text variant="body-xs" style={{ color: isDark ? 'rgba(255,255,255,0.35)' : staticTheme.colors.gray[400] }}>
            {maxUnits}
          </Text>
          <Text variant="body-xs" style={{ color: isDark ? 'rgba(255,255,255,0.35)' : staticTheme.colors.gray[400] }}>
            0
          </Text>
        </View>
        <View style={barStyles.barsWrap}>
          <View style={[barStyles.barsBg, { backgroundColor: isDark ? 'rgba(79,158,255,0.07)' : `${accent}0A` }]}>
            {data.map((point) => {
              const ratio   = maxUnits > 0 ? point.totalUnits / maxUnits : 0;
              const isToday = point.date === todayStr;
              const barColor = isToday ? accent : (isDark ? `${accent}60` : `${accent}80`);
              return (
                <View key={point.date} style={barStyles.barCol}>
                  <View style={{ flex: 1 }} />
                  <View style={[
                    barStyles.bar,
                    {
                      height: Math.max(4, Math.round(ratio * 80)),
                      backgroundColor: barColor,
                      ...(isToday ? {
                        shadowColor: accent,
                        shadowOffset: { width: 0, height: -2 },
                        shadowOpacity: 0.45,
                        shadowRadius: 6,
                        elevation: 4,
                      } : {}),
                    },
                  ]} />
                  <Text variant="body-xs" style={[barStyles.dayLabel, {
                    color: isToday ? accent : (isDark ? 'rgba(255,255,255,0.38)' : staticTheme.colors.gray[500]),
                    fontWeight: isToday ? '600' : '400',
                  }]} numberOfLines={1}>
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
BarChart.displayName = 'BarChart';

const barStyles = StyleSheet.create({
  container: { flexDirection: 'row', height: 120, gap: 6 },
  yAxis:     { width: 28, justifyContent: 'space-between', alignItems: 'flex-end', paddingBottom: 20 },
  barsWrap:  { flex: 1 },
  barsBg:    { flex: 1, flexDirection: 'row', alignItems: 'flex-end', borderRadius: staticTheme.borderRadius.lg, paddingHorizontal: 6, paddingTop: 8 },
  barCol:    { flex: 1, alignItems: 'center', height: '100%' },
  bar:       { width: '70%', borderTopLeftRadius: 4, borderTopRightRadius: 4 },
  dayLabel:  { marginTop: 4, fontSize: 10 },
  empty:     { height: 80, alignItems: 'center', justifyContent: 'center' },
});

// ─── Ingredient Row ───────────────────────────────────────────────────────────

const IngredientRow = React.memo<{ ingredient: ProductionLogIngredientDetail; isDark: boolean }>(
  ({ ingredient, isDark }) => {
    const green  = isDark ? DARK_GREEN : staticTheme.colors.success[500];
    const muted  = isDark ? 'rgba(255,255,255,0.42)' : staticTheme.colors.gray[500];
    const dim    = isDark ? 'rgba(255,255,255,0.28)' : staticTheme.colors.gray[400];
    return (
      <View style={ingStyles.row}>
        <View style={[ingStyles.dot, { backgroundColor: `${green}30` }]}>
          <Wheat size={9} color={green} />
        </View>
        <Text variant="body-xs" style={{ flex: 1, color: muted }} numberOfLines={1}>
          {ingredient.ingredientName}
        </Text>
        <Text variant="body-xs" style={{ color: dim }}>
          {ingredient.quantityConsumed} {ingredient.unit}
        </Text>
        {ingredient.lineCost > 0 && (
          <Text variant="body-xs" weight="medium" style={{ color: green }}>
            {formatCurrency(ingredient.lineCost)}
          </Text>
        )}
      </View>
    );
  },
);
IngredientRow.displayName = 'IngredientRow';

const ingStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: staticTheme.spacing.sm, paddingVertical: 5 },
  dot: { width: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
});

// ─── Raw Material Row ─────────────────────────────────────────────────────────

const RawMaterialRow = React.memo<{ item: RawMaterialConsumedDetail; isDark: boolean }>(
  ({ item, isDark }) => {
    const amber = isDark ? DARK_AMBER : staticTheme.colors.highlight[500];
    const muted = isDark ? 'rgba(255,255,255,0.42)' : staticTheme.colors.gray[500];
    const dim   = isDark ? 'rgba(255,255,255,0.28)' : staticTheme.colors.gray[400];
    return (
      <View style={ingStyles.row}>
        <View style={[ingStyles.dot, { backgroundColor: `${amber}30` }]}>
          <Layers size={9} color={amber} />
        </View>
        <Text variant="body-xs" style={{ flex: 1, color: muted }} numberOfLines={1}>
          {item.rawMaterialName}
        </Text>
        <Text variant="body-xs" style={{ color: dim }}>
          {item.quantityUsed} {item.unit}
        </Text>
        {item.totalCost > 0 && (
          <Text variant="body-xs" weight="medium" style={{ color: amber }}>
            {formatCurrency(item.totalCost)}
          </Text>
        )}
      </View>
    );
  },
);
RawMaterialRow.displayName = 'RawMaterialRow';

// ─── Production Log Card ──────────────────────────────────────────────────────

const ProductionLogCard = React.memo<{ log: ProductionLogWithDetails; isDark: boolean }>(
  ({ log, isDark }) => {
    const [expanded, setExpanded] = useState(false);

    const accent      = isDark ? DARK_ACCENT : staticTheme.colors.primary[500];
    const green       = isDark ? DARK_GREEN  : staticTheme.colors.success[500];
    const cardBg      = isDark ? DARK_CARD_BG : '#FFFFFF';
    const textPrimary = isDark ? '#FFFFFF' : staticTheme.colors.gray[800];
    const textMuted   = isDark ? 'rgba(255,255,255,0.42)' : staticTheme.colors.gray[500];
    const divider     = isDark ? 'rgba(255,255,255,0.07)' : staticTheme.colors.gray[100];

    const toggle = useCallback(() => {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setExpanded((p) => !p);
    }, []);

    return (
      <View style={[
        cardStyles.card,
        {
          backgroundColor: cardBg,
          borderColor: isDark ? `${accent}22` : `${accent}25`,
          ...(isDark ? {
            shadowColor: accent,
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.10,
            shadowRadius: 8,
            elevation: 3,
          } : {}),
        },
      ]}>
        <View style={[cardStyles.accentBar, { backgroundColor: accent }]} />
        <View style={cardStyles.body}>

          {/* Header */}
          <View style={cardStyles.headerRow}>
            <View style={[cardStyles.iconCircle, { backgroundColor: `${accent}18` }]}>
              <Factory size={16} color={accent} />
            </View>
            <View style={cardStyles.nameWrap}>
              <Text variant="body" weight="semibold" style={{ color: textPrimary }} numberOfLines={1}>
                {log.productName}
              </Text>
              <View style={[cardStyles.pill, { backgroundColor: `${accent}12`, borderColor: `${accent}22` }]}>
                <Package size={9} color={accent} />
                <Text variant="body-xs" weight="medium" style={{ color: accent }}>Product</Text>
              </View>
            </View>
            <View style={[cardStyles.unitsBadge, { backgroundColor: `${accent}15`, borderColor: `${accent}30` }]}>
              <Text weight="bold" style={{ color: accent, fontSize: 20, lineHeight: 24 }}>
                {log.unitsProduced}
              </Text>
              <Text variant="body-xs" style={{ color: textMuted }}>units</Text>
            </View>
          </View>

          {/* Meta */}
          <View style={cardStyles.metaRow}>
            <DollarSign size={11} color={green} />
            <Text variant="body-sm" weight="semibold" style={{ color: green }}>
              {formatCurrency(log.totalCost)}
            </Text>
            <View style={[cardStyles.metaDot, { backgroundColor: isDark ? 'rgba(255,255,255,0.12)' : staticTheme.colors.gray[300] }]} />
            <Clock size={11} color={textMuted} />
            <Text variant="body-xs" style={{ color: textMuted }}>{formatTime(log.producedAt)}</Text>
          </View>

          {/* Expandable ingredients + raw materials */}
          {(log.ingredients.length > 0 || log.rawMaterials.length > 0) && (
            <>
              <View style={[cardStyles.divider, { backgroundColor: divider }]} />
              <Pressable
                style={({ pressed }) => [cardStyles.expandBtn, { opacity: pressed ? 0.7 : 1 }]}
                onPress={toggle}
                accessibilityRole="button"
              >
                <Wheat size={12} color={textMuted} />
                <Text variant="body-xs" weight="medium" style={{ color: textMuted, flex: 1 }}>
                  {log.ingredients.length} ingredient{log.ingredients.length !== 1 ? 's' : ''}
                  {log.rawMaterials.length > 0
                    ? ` · ${log.rawMaterials.length} raw material${log.rawMaterials.length !== 1 ? 's' : ''}`
                    : ''}
                </Text>
                {expanded ? <ChevronUp size={13} color={textMuted} /> : <ChevronDown size={13} color={textMuted} />}
              </Pressable>

              {expanded && (
                <View style={[cardStyles.ingList, { borderTopColor: divider }]}>
                  {log.ingredients.map((ing) => (
                    <IngredientRow key={ing.id} ingredient={ing} isDark={isDark} />
                  ))}
                  {log.rawMaterials.length > 0 && (
                    <>
                      <View style={[cardStyles.subSectionLabel, { borderTopColor: divider }]}>
                        <Layers size={10} color={textMuted} />
                        <Text variant="body-xs" weight="medium" style={{ color: textMuted }}>
                          Raw Materials
                        </Text>
                      </View>
                      {log.rawMaterials.map((rm) => (
                        <RawMaterialRow key={rm.rawMaterialId} item={rm} isDark={isDark} />
                      ))}
                    </>
                  )}
                </View>
              )}
            </>
          )}
        </View>
      </View>
    );
  },
);
ProductionLogCard.displayName = 'ProductionLogCard';

const cardStyles = StyleSheet.create({
  card:        { flexDirection: 'row', borderRadius: staticTheme.borderRadius.xl, marginHorizontal: staticTheme.spacing.md, marginVertical: 5, overflow: 'hidden', borderWidth: 1 },
  accentBar:   { width: 3, flexShrink: 0 },
  body:        { flex: 1, paddingHorizontal: staticTheme.spacing.md, paddingVertical: 12, gap: 8 },
  headerRow:   { flexDirection: 'row', alignItems: 'center', gap: staticTheme.spacing.sm },
  iconCircle:  { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  nameWrap:    { flex: 1, gap: 3, minWidth: 0 },
  pill:        { flexDirection: 'row', alignItems: 'center', gap: 3, alignSelf: 'flex-start', borderWidth: 1, borderRadius: staticTheme.borderRadius.sm, paddingHorizontal: 6, paddingVertical: 2 },
  unitsBadge:  { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12, paddingVertical: 6, borderRadius: staticTheme.borderRadius.lg, borderWidth: 1, flexShrink: 0, minWidth: 58 },
  metaRow:     { flexDirection: 'row', alignItems: 'center', gap: 6 },
  metaDot:     { width: 3, height: 3, borderRadius: 2 },
  divider:         { height: 1 },
  expandBtn:       { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 4 },
  ingList:         { borderTopWidth: 1, paddingTop: 4 },
  subSectionLabel: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingTop: 8, paddingBottom: 2, marginTop: 4, borderTopWidth: 1 },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function ProductionScreen() {
  const appTheme = useAppTheme();
  const isDark   = useThemeStore(selectThemeMode) === 'dark';

  const todaySummary = useProductionStore(selectTodaySummary);
  const dailyTrend   = useProductionStore(selectDailyTrend);
  const logs         = useProductionStore(selectProductionLogs);
  const isLoading    = useProductionStore(selectProductionLoading);
  const error        = useProductionStore(selectProductionError);
  const { initializeProduction, refreshProduction } = useProductionStore();

  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => { void initializeProduction(); }, [initializeProduction]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await refreshProduction();
    setRefreshing(false);
  }, [refreshProduction]);

  const accent      = isDark ? DARK_ACCENT : staticTheme.colors.primary[500];
  const greenAccent = isDark ? DARK_GREEN  : staticTheme.colors.success[500];
  const amberAccent = isDark ? DARK_AMBER  : staticTheme.colors.highlight[400];

  const topProductLabel = useMemo(() => {
    if (todaySummary.topProduct === null) return '—';
    const { name, units } = todaySummary.topProduct;
    const short = name.length > 14 ? `${name.slice(0, 12)}…` : name;
    return `${short} (${units})`;
  }, [todaySummary.topProduct]);

  const sectionCardStyle = useMemo(() => ({
    backgroundColor:  isDark ? DARK_CARD_BG : appTheme.colors.surface,
    borderColor:      isDark ? `${accent}18` : appTheme.colors.border,
    borderWidth:      1,
    borderRadius:     staticTheme.borderRadius.xl,
    marginHorizontal: staticTheme.spacing.md,
    marginTop:        staticTheme.spacing.sm,
    overflow:         'hidden' as const,
  }), [isDark, accent, appTheme.colors]);

  const renderCard = useCallback(
    ({ item }: { item: ProductionLogWithDetails }) => (
      <ProductionLogCard log={item} isDark={isDark} />
    ),
    [isDark],
  );

  const ListHeader = useMemo(() => (
    <View>
      {/* Error */}
      {error !== null && (
        <View style={[
          screenStyles.errorBanner,
          {
            backgroundColor: isDark ? 'rgba(255,107,107,0.10)' : staticTheme.colors.error[50],
            borderColor:     isDark ? 'rgba(255,107,107,0.30)' : staticTheme.colors.error[200],
          },
        ]}>
          <AlertCircle size={15} color={isDark ? '#FF6B6B' : staticTheme.colors.error[500]} />
          <Text variant="body-xs" style={{ color: isDark ? '#FF6B6B' : staticTheme.colors.error[500], flex: 1 }} numberOfLines={2}>
            {error}
          </Text>
        </View>
      )}

      {/* Stat tiles */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false}
        contentContainerStyle={screenStyles.statsScroll}>
        <StatCard label="Units Today"  value={String(todaySummary.totalUnitsProduced)} icon={<Factory size={13} color={accent} />}      accentColor={accent}      isDark={isDark} />
        <StatCard label="Prod. Cost"   value={formatCurrency(todaySummary.totalCost)}   icon={<DollarSign size={13} color={greenAccent} />} accentColor={greenAccent} isDark={isDark} />
        <StatCard label="Runs Today"   value={String(todaySummary.productionRuns)}       icon={<BarChart2 size={13} color={amberAccent} />}  accentColor={amberAccent} isDark={isDark} />
        <StatCard label="Top Product"  value={topProductLabel}                           icon={<TrendingUp size={13} color={accent} />}      accentColor={accent}      isDark={isDark} />
      </ScrollView>

      {/* 7-Day Trend */}
      <View style={sectionCardStyle}>
        <View style={screenStyles.sectionHeader}>
          <View style={[screenStyles.sectionIconPill, { backgroundColor: `${accent}18` }]}>
            <BarChart2 size={14} color={accent} />
          </View>
          <View>
            <Text variant="body-sm" weight="semibold"
              style={{ color: isDark ? '#FFFFFF' : staticTheme.colors.gray[800] }}>
              Last 7 Days
            </Text>
            <Text variant="body-xs"
              style={{ color: isDark ? 'rgba(255,255,255,0.40)' : staticTheme.colors.gray[500] }}>
              Daily units produced
            </Text>
          </View>
        </View>
        <View style={{ paddingHorizontal: staticTheme.spacing.md, paddingBottom: staticTheme.spacing.md }}>
          <BarChart data={dailyTrend} isDark={isDark} accent={accent} />
        </View>
      </View>

      {/* Runs label */}
      <View style={screenStyles.sectionHeader}>
        <View style={[screenStyles.sectionIconPill, { backgroundColor: `${greenAccent}18` }]}>
          <Factory size={14} color={greenAccent} />
        </View>
        <View>
          <Text variant="body-sm" weight="semibold"
            style={{ color: isDark ? '#FFFFFF' : staticTheme.colors.gray[800] }}>
            Today's Production Runs
          </Text>
          <Text variant="body-xs"
            style={{ color: isDark ? 'rgba(255,255,255,0.40)' : staticTheme.colors.gray[500] }}>
            {logs.length > 0 ? `${logs.length} run${logs.length !== 1 ? 's' : ''} recorded` : 'No runs yet'}
          </Text>
        </View>
      </View>
    </View>
  ), [
    error, isDark, accent, greenAccent, amberAccent,
    todaySummary, topProductLabel, dailyTrend, logs.length, sectionCardStyle,
  ]);

  const ListEmpty = useMemo(() => (
    isLoading ? null : (
      <View style={screenStyles.emptyContainer}>
        <View style={[screenStyles.emptyIcon, { backgroundColor: `${accent}15` }]}>
          <Factory size={32} color={`${accent}80`} />
        </View>
        <Text variant="body" weight="semibold"
          style={{ color: isDark ? 'rgba(255,255,255,0.60)' : staticTheme.colors.gray[600] }}>
          No production runs today
        </Text>
        <Text variant="body-sm" align="center"
          style={{ color: isDark ? 'rgba(255,255,255,0.30)' : staticTheme.colors.gray[400] }}>
          Production logs will appear here as batches are recorded.
        </Text>
      </View>
    )
  ), [isLoading, isDark, accent]);

  return (
    <View style={[screenStyles.root, { backgroundColor: isDark ? '#0F0F14' : appTheme.colors.background }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <FlatList
        data={logs}
        keyExtractor={keyExtractor}
        renderItem={renderCard}
        ListHeaderComponent={ListHeader}
        ListEmptyComponent={ListEmpty}
        contentContainerStyle={[screenStyles.content, logs.length === 0 && screenStyles.contentEmpty]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh}
            tintColor={accent} colors={[accent]} />
        }
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        removeClippedSubviews={Platform.OS === 'android'}
        maxToRenderPerBatch={10}
        windowSize={8}
        initialNumToRender={8}
      />
    </View>
  );
}

const screenStyles = StyleSheet.create({
  root:          { flex: 1 },
  content:       { paddingBottom: staticTheme.spacing.xl },
  contentEmpty:  { flexGrow: 1 },
  statsScroll:   { gap: 6, paddingHorizontal: staticTheme.spacing.md, paddingVertical: staticTheme.spacing.sm },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: staticTheme.spacing.sm, paddingHorizontal: staticTheme.spacing.md, paddingTop: staticTheme.spacing.md, paddingBottom: staticTheme.spacing.xs },
  sectionIconPill: { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  errorBanner:   { flexDirection: 'row', alignItems: 'center', gap: staticTheme.spacing.sm, marginHorizontal: staticTheme.spacing.md, marginTop: staticTheme.spacing.sm, borderWidth: 1, borderRadius: staticTheme.borderRadius.xl, paddingHorizontal: staticTheme.spacing.md, paddingVertical: staticTheme.spacing.sm },
  emptyContainer: { alignItems: 'center', paddingVertical: staticTheme.spacing.xl, paddingHorizontal: staticTheme.spacing.xl, gap: staticTheme.spacing.sm },
  emptyIcon:     { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', marginBottom: staticTheme.spacing.xs },
});
