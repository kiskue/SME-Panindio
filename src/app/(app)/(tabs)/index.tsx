/**
 * DashboardScreen — ERP Home
 *
 * Comprehensive business dashboard for SME Panindio. Surfaces KPIs, a
 * period-based trend chart, net profit summary, and quick navigation.
 *
 * Data sources:
 *   - useDashboardStore  → period-scoped KPIs (sales, ingredient cost, utilities,
 *                          production, net profit) + trend chart data
 *   - useIngredientConsumptionStore → all-time ingredient waste cost
 *   - useRawMaterialConsumptionLogsStore → all-time raw material waste cost
 *   - useRawMaterialsStore → point-in-time raw material stock value
 *
 * TypeScript constraints honoured:
 *   - exactOptionalPropertyTypes: no `prop: undefined`, conditional spread
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
  ScrollView,
  StyleSheet,
  Pressable,
  RefreshControl,
  Animated,
  Dimensions,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import {
  TrendingUp,
  ShoppingBag,
  Package,
  Zap,
  ShoppingCart,
  BarChart2,
  RefreshCw,
  Trash2,
  AlertTriangle,
  Boxes,
  Building2,
} from 'lucide-react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Text } from '@/components/atoms/Text';
import {
  useAuthStore,
  selectCurrentUser,
  useThemeStore,
  selectThemeMode,
  useDashboardStore,
  selectDashboardKPIs,
  selectDashboardTrend,
  selectDashboardLoading,
  selectDashboardPeriod,
  useIngredientConsumptionStore,
  selectIngredientWasteCost,
  useRawMaterialConsumptionLogsStore,
  selectRawMaterialWasteCost,
  useRawMaterialsStore,
  selectRawMaterialStockValue,
  useOverheadExpensesStore,
  selectOverheadSummary,
} from '@/store';
import { useShallow } from 'zustand/react/shallow';
import { useAppTheme } from '@/core/theme';
import { theme as staticTheme } from '@/core/theme';

// ─── Types ─────────────────────────────────────────────────────────────────────

import type { DashboardPeriod, DashboardKPIs, DashboardTrendPoint } from '@/types';

// ─── Color tokens ──────────────────────────────────────────────────────────────

const DARK_CARD_BG  = '#151A27';
const DARK_ROOT_BG  = '#0F0F14';
const DARK_SURFACE  = '#1E2435';
const DARK_BORDER   = 'rgba(255,255,255,0.08)';
const DARK_TEXT     = '#F1F5F9';
const DARK_TEXT_SEC = '#94A3B8';

// ─── Helpers ───────────────────────────────────────────────────────────────────

function formatCurrency(value: number): string {
  return `₱${Math.abs(value).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatUnits(value: number): string {
  return value.toLocaleString('en-PH', { maximumFractionDigits: 0 });
}

const EMPTY_KPIS: DashboardKPIs = {
  grossSales:             0,
  ingredientCost:         0,
  rawMaterialCost:        0,
  ingredientWastePeriod:  0,
  rawMaterialWastePeriod: 0,
  cogs:                   0,
  grossProfit:            0,
  utilitiesCost:          0,
  opexThisPeriod:         0,
  netProfit:              0,
  totalOrders:            0,
  totalProductsSold:      0,
  productsMade:           0,
  ingredientWasteCost:    0,
  rawMaterialWasteCost:   0,
  rawMaterialStockValue:  0,
  overheadThisMonth:      0,
  overheadThisYear:       0,
  periodLabel:            '—',
};

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

function formatTodayDate(): string {
  return new Date().toLocaleDateString('en-PH', {
    weekday: 'long',
    year:    'numeric',
    month:   'long',
    day:     'numeric',
  });
}

const SCREEN_WIDTH = Dimensions.get('window').width;
const isTablet = SCREEN_WIDTH >= 768;

// ─── Skeleton placeholder ──────────────────────────────────────────────────────

interface SkeletonProps {
  width:   number | string;
  height:  number;
  radius?: number;
  isDark:  boolean;
}

const Skeleton = React.memo<SkeletonProps>(({ width, height, radius = 8, isDark }) => {
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

  const bg = isDark ? '#2A3347' : staticTheme.colors.gray[200];

  return (
    <Animated.View
      style={{
        width,
        height,
        borderRadius: radius,
        backgroundColor: bg,
        opacity: anim,
      }}
    />
  );
});

// ─── Period Selector ───────────────────────────────────────────────────────────

interface PeriodSelectorProps {
  period:   DashboardPeriod;
  onSelect: (p: DashboardPeriod) => void;
  isDark:   boolean;
}

const PERIODS: { key: DashboardPeriod; label: string }[] = [
  { key: 'day',   label: 'Today' },
  { key: 'week',  label: 'Week'  },
  { key: 'month', label: 'Month' },
  { key: 'year',  label: 'Year'  },
];

const PeriodSelector = React.memo<PeriodSelectorProps>(({ period, onSelect, isDark }) => {
  const activeBg    = staticTheme.colors.primary[500];
  const inactiveBg  = isDark ? DARK_SURFACE : staticTheme.colors.gray[100];
  const inactiveBdr = isDark ? DARK_BORDER  : staticTheme.colors.gray[200];

  return (
    <View style={periodStyles.row}>
      {PERIODS.map(p => {
        const isActive = p.key === period;
        return (
          <Pressable
            key={p.key}
            onPress={() => onSelect(p.key)}
            style={[
              periodStyles.pill,
              {
                backgroundColor: isActive ? activeBg : inactiveBg,
                borderColor:     isActive ? activeBg : inactiveBdr,
              },
            ]}
            accessibilityRole="button"
            accessibilityState={{ selected: isActive }}
          >
            <Text
              variant="body-sm"
              weight={isActive ? 'semibold' : 'normal'}
              style={{
                color: isActive
                  ? '#FFFFFF'
                  : (isDark ? DARK_TEXT_SEC : staticTheme.colors.gray[600]),
              }}
            >
              {p.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
});

const periodStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 8,
  },
  pill: {
    flex:              1,
    paddingVertical:   8,
    paddingHorizontal: 4,
    borderRadius:      20,
    borderWidth:       1,
    alignItems:        'center',
  },
});

// ─── KPI Card ──────────────────────────────────────────────────────────────────

interface KpiCardProps {
  label:       string;
  value:       string;
  icon:        React.ReactNode;
  accentColor: string;
  isDark:      boolean;
  negative?:   boolean;
}

const KpiCard = React.memo<KpiCardProps>(({ label, value, icon, accentColor, isDark, negative }) => {
  const cardBg   = isDark ? DARK_CARD_BG : '#FFFFFF';
  const border   = isDark ? DARK_BORDER  : staticTheme.colors.border;
  const valColor = negative === true ? staticTheme.colors.error[500] : accentColor;
  const iconBg   = `${accentColor}1A`;

  return (
    <View
      style={[
        kpiStyles.card,
        {
          backgroundColor: cardBg,
          borderColor:     border,
          ...(isDark ? {} : staticTheme.shadows.sm),
        },
      ]}
    >
      {/* Left accent bar */}
      <View style={[kpiStyles.accentBar, { backgroundColor: accentColor }]} />

      <View style={kpiStyles.inner}>
        <View style={[kpiStyles.iconPill, { backgroundColor: iconBg }]}>
          {icon}
        </View>

        <Text
          variant="body-xs"
          weight="medium"
          style={{
            color:     isDark ? DARK_TEXT_SEC : staticTheme.colors.gray[500],
            marginTop: 8,
          }}
          numberOfLines={1}
        >
          {label}
        </Text>

        <Text
          variant="h5"
          weight="bold"
          style={{ color: valColor, marginTop: 2 }}
          numberOfLines={1}
          adjustsFontSizeToFit
        >
          {value}
        </Text>
      </View>
    </View>
  );
});

const kpiStyles = StyleSheet.create({
  card: {
    flex:          1,
    borderRadius:  12,
    borderWidth:   1,
    overflow:      'hidden',
    flexDirection: 'row',
  },
  accentBar: {
    width: 3,
  },
  inner: {
    flex:    1,
    padding: 12,
  },
  iconPill: {
    width:          28,
    height:         28,
    borderRadius:   8,
    alignItems:     'center',
    justifyContent: 'center',
  },
});

// ─── Trend Chart ───────────────────────────────────────────────────────────────

interface TrendChartProps {
  data:      DashboardTrendPoint[];
  isDark:    boolean;
  isLoading: boolean;
}

const CHART_BAR_MAX_H = 80;
const CHART_BAR_WIDTH = 10;
const CHART_GROUP_GAP = 6;
const CHART_ITEM_W    = CHART_BAR_WIDTH * 2 + CHART_GROUP_GAP + 16;

const TrendChart = React.memo<TrendChartProps>(({ data, isDark, isLoading }) => {
  const cardBg      = isDark ? DARK_CARD_BG : '#FFFFFF';
  const border      = isDark ? DARK_BORDER  : staticTheme.colors.border;
  const textSec     = isDark ? DARK_TEXT_SEC : staticTheme.colors.gray[500];
  const salesClr    = staticTheme.colors.success[500];
  const costClr     = staticTheme.colors.error[400];
  const baseLineClr = isDark ? 'rgba(255,255,255,0.08)' : staticTheme.colors.gray[200];

  if (isLoading) {
    return (
      <View style={[chartStyles.card, { backgroundColor: cardBg, borderColor: border }]}>
        <Skeleton width="40%" height={16} isDark={isDark} />
        <View style={{ height: 12 }} />
        <Skeleton width="100%" height={CHART_BAR_MAX_H + 20} isDark={isDark} radius={6} />
      </View>
    );
  }

  const allSales = data.map(d => d.sales);
  const allCosts = data.map(d => d.cost);
  const maxVal   = Math.max(...allSales, ...allCosts, 1);
  const isEmpty  = data.length === 0 || maxVal === 0;

  return (
    <View
      style={[
        chartStyles.card,
        {
          backgroundColor: cardBg,
          borderColor:     border,
          ...(isDark ? {} : staticTheme.shadows.sm),
        },
      ]}
    >
      <Text
        variant="h6"
        weight="semibold"
        style={{ color: isDark ? DARK_TEXT : staticTheme.colors.text }}
      >
        Sales vs Costs
      </Text>

      {/* Legend */}
      <View style={chartStyles.legend}>
        <View style={chartStyles.legendItem}>
          <View style={[chartStyles.legendDot, { backgroundColor: salesClr }]} />
          <Text variant="body-xs" style={{ color: textSec }}>Sales</Text>
        </View>
        <View style={chartStyles.legendItem}>
          <View style={[chartStyles.legendDot, { backgroundColor: costClr }]} />
          <Text variant="body-xs" style={{ color: textSec }}>Cost</Text>
        </View>
      </View>

      {isEmpty ? (
        <View style={chartStyles.emptyBox}>
          <BarChart2 size={32} color={textSec} />
          <Text variant="body-sm" style={{ color: textSec, marginTop: 8 }}>
            No data for this period
          </Text>
        </View>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={chartStyles.barsContainer}
        >
          {/* Base line */}
          <View
            style={[
              chartStyles.baseLine,
              { backgroundColor: baseLineClr, width: data.length * CHART_ITEM_W },
            ]}
          />

          {data.map((pt, idx) => {
            const salesH = Math.max(2, (pt.sales / maxVal) * CHART_BAR_MAX_H);
            const costH  = Math.max(2, (pt.cost  / maxVal) * CHART_BAR_MAX_H);
            return (
              <View key={`${pt.label}-${idx}`} style={chartStyles.barGroup}>
                <View style={chartStyles.barsRow}>
                  <View
                    style={[
                      chartStyles.bar,
                      {
                        height:               salesH,
                        backgroundColor:      salesClr,
                        borderTopLeftRadius:  3,
                        borderTopRightRadius: 3,
                      },
                    ]}
                  />
                  <View
                    style={[
                      chartStyles.bar,
                      {
                        height:               costH,
                        backgroundColor:      costClr,
                        borderTopLeftRadius:  3,
                        borderTopRightRadius: 3,
                      },
                    ]}
                  />
                </View>
                <Text
                  variant="body-xs"
                  style={{
                    color:     textSec,
                    marginTop: 4,
                    textAlign: 'center',
                    fontSize:  9,
                  }}
                  numberOfLines={1}
                >
                  {pt.label}
                </Text>
              </View>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
});

const chartStyles = StyleSheet.create({
  card: {
    borderRadius: 12,
    borderWidth:  1,
    padding:      16,
    marginBottom: 16,
  },
  legend: {
    flexDirection: 'row',
    gap:           12,
    marginTop:     6,
    marginBottom:  12,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems:   'center',
    gap: 4,
  },
  legendDot: {
    width:        8,
    height:       8,
    borderRadius: 4,
  },
  emptyBox: {
    height:         CHART_BAR_MAX_H + 32,
    alignItems:     'center',
    justifyContent: 'center',
  },
  barsContainer: {
    flexDirection: 'row',
    alignItems:    'flex-end',
    paddingBottom: 20,
    minHeight:     CHART_BAR_MAX_H + 24,
    position:      'relative',
  },
  baseLine: {
    position: 'absolute',
    bottom:   20,
    left:     0,
    height:   1,
  },
  barGroup: {
    width:          CHART_ITEM_W,
    alignItems:     'center',
    justifyContent: 'flex-end',
    height:         CHART_BAR_MAX_H + 20,
  },
  barsRow: {
    flexDirection: 'row',
    gap:           CHART_GROUP_GAP,
    alignItems:    'flex-end',
  },
  bar: {
    width: CHART_BAR_WIDTH,
  },
});

// ─── P&L Waterfall Card ────────────────────────────────────────────────────────
//
// Displays the standard SME P&L waterfall:
//   Gross Income − COGS = Gross Profit − OpEx = Net Profit

interface PLWaterfallCardProps {
  kpis:   DashboardKPIs;
  isDark: boolean;
}

const PLWaterfallCard = React.memo<PLWaterfallCardProps>(({ kpis, isDark }) => {
  const isNetNeg   = kpis.netProfit   < 0;
  const isGrossNeg = kpis.grossProfit < 0;
  const netColor   = isNetNeg   ? staticTheme.colors.error[500]   : staticTheme.colors.success[500];
  const grossColor = isGrossNeg ? staticTheme.colors.error[500]   : staticTheme.colors.success[400];
  const cardBg     = isDark ? DARK_CARD_BG  : '#FFFFFF';
  const border     = isDark ? DARK_BORDER   : staticTheme.colors.border;
  const textMain   = isDark ? DARK_TEXT     : staticTheme.colors.text;
  const textSec    = isDark ? DARK_TEXT_SEC : staticTheme.colors.gray[500];
  const divider    = isDark ? 'rgba(255,255,255,0.06)' : staticTheme.colors.gray[100];

  interface WaterfallRowProps {
    label:   string;
    value:   number;
    color?:  string;
    bold?:   boolean;
    indent?: boolean;
    sign?:   '+' | '−' | '=';
  }

  const WaterfallRow = React.memo<WaterfallRowProps>(({ label, value, color, bold, indent, sign }) => (
    <View style={plStyles.wRow}>
      <View style={plStyles.wLabelWrap}>
        {indent === true && <View style={plStyles.wIndent} />}
        {sign !== undefined && (
          <Text variant="body-xs" weight="semibold" style={{ color: textSec, width: 12 }}>
            {sign}
          </Text>
        )}
        <Text
          variant="body-sm"
          weight={bold === true ? 'semibold' : 'normal'}
          style={{ color: bold === true ? textMain : textSec }}
        >
          {label}
        </Text>
      </View>
      <Text
        variant="body-sm"
        weight={bold === true ? 'bold' : 'medium'}
        style={{ color: color ?? textMain }}
        numberOfLines={1}
        adjustsFontSizeToFit
      >
        {value < 0 ? `−${formatCurrency(Math.abs(value))}` : formatCurrency(value)}
      </Text>
    </View>
  ));

  // Waste sub-line — only shown when waste > 0
  const WasteRow = React.memo<{ value: number }>(({ value }) => {
    if (value <= 0) return null;
    return (
      <View style={plStyles.wasteRow}>
        <View style={plStyles.wLabelWrap}>
          <View style={plStyles.wIndent} />
          <View style={plStyles.wIndent} />
          <Text variant="body-xs" style={{ color: staticTheme.colors.error[400] }}>
            ⚠ incl. waste
          </Text>
        </View>
        <Text variant="body-xs" style={{ color: staticTheme.colors.error[400] }}>
          {formatCurrency(value)}
        </Text>
      </View>
    );
  });

  return (
    <View
      style={[
        plStyles.card,
        {
          backgroundColor: cardBg,
          borderColor:     border,
          ...(isDark ? {} : staticTheme.shadows.sm),
        },
      ]}
    >
      {/* Accent bar — tracks net profit sign */}
      <View style={[plStyles.topBar, { backgroundColor: netColor }]} />

      <View style={plStyles.inner}>
        <Text
          variant="body-sm"
          weight="semibold"
          style={{ color: textSec, marginBottom: 14, letterSpacing: 0.4, textTransform: 'uppercase' }}
        >
          P&L Summary — {kpis.periodLabel}
        </Text>

        {/* Revenue */}
        <WaterfallRow label="Gross Income"      value={kpis.grossSales}      color={staticTheme.colors.success[500]} bold />

        {/* COGS */}
        <View style={[plStyles.divider, { backgroundColor: divider }]} />
        <WaterfallRow label="Ingredient Cost"   value={kpis.ingredientCost}  indent sign="−" />
        <WasteRow value={kpis.ingredientWastePeriod} />
        <WaterfallRow label="Raw Material Cost" value={kpis.rawMaterialCost} indent sign="−" />
        <WasteRow value={kpis.rawMaterialWastePeriod} />
        <View style={[plStyles.divider, { backgroundColor: divider }]} />
        <WaterfallRow label="COGS"              value={kpis.cogs}            color={staticTheme.colors.error[400]} bold />

        {/* Gross Profit */}
        <View style={[plStyles.divider, { backgroundColor: divider }]} />
        <WaterfallRow label="Gross Profit"      value={kpis.grossProfit}     color={grossColor} bold sign="=" />

        {/* OpEx */}
        <View style={[plStyles.divider, { backgroundColor: divider }]} />
        <WaterfallRow label="Utilities"         value={kpis.utilitiesCost}   indent sign="−" />
        <WaterfallRow label="Overhead (period)" value={kpis.opexThisPeriod}  indent sign="−" />

        {/* Net Profit */}
        <View style={[plStyles.divider, { backgroundColor: divider, marginBottom: 4 }]} />
        <WaterfallRow label="Net Profit"        value={kpis.netProfit}       color={netColor} bold sign="=" />
      </View>
    </View>
  );
});

const plStyles = StyleSheet.create({
  card: {
    borderRadius: 12,
    borderWidth:  1,
    overflow:     'hidden',
    marginBottom: 16,
  },
  topBar: {
    height: 3,
  },
  inner: {
    padding: 16,
  },
  wRow: {
    flexDirection:   'row',
    alignItems:      'center',
    justifyContent:  'space-between',
    paddingVertical: 4,
  },
  wLabelWrap: {
    flexDirection: 'row',
    alignItems:    'center',
    flex:          1,
    marginRight:   8,
  },
  wIndent: {
    width: 12,
  },
  wasteRow: {
    flexDirection:   'row',
    alignItems:      'center',
    justifyContent:  'space-between',
    paddingVertical: 2,
    marginBottom:    2,
  },
  divider: {
    height:         1,
    marginVertical: 4,
  },
});

// ─── Orders + Production card ──────────────────────────────────────────────────

interface OrdersProducedCardProps {
  totalOrders:  number;
  productsMade: number;
  isDark:       boolean;
}

const OrdersProducedCard = React.memo<OrdersProducedCardProps>(({ totalOrders, productsMade, isDark }) => {
  const cardBg   = isDark ? DARK_CARD_BG : '#FFFFFF';
  const border   = isDark ? DARK_BORDER  : staticTheme.colors.border;
  const textMain = isDark ? DARK_TEXT    : staticTheme.colors.text;
  const textSec  = isDark ? DARK_TEXT_SEC : staticTheme.colors.gray[500];
  const divider  = isDark ? DARK_BORDER  : staticTheme.colors.gray[200];

  return (
    <View
      style={[
        ordersStyles.card,
        {
          backgroundColor: cardBg,
          borderColor:     border,
          ...(isDark ? {} : staticTheme.shadows.sm),
        },
      ]}
    >
      <View style={ordersStyles.half}>
        <View style={[ordersStyles.iconPill, { backgroundColor: `${staticTheme.colors.primary[500]}1A` }]}>
          <ShoppingCart size={16} color={staticTheme.colors.primary[500]} />
        </View>
        <Text variant="h4" weight="bold" style={{ color: textMain, marginTop: 8 }}>
          {totalOrders}
        </Text>
        <Text variant="body-xs" style={{ color: textSec, marginTop: 2 }}>
          Total Orders
        </Text>
      </View>

      <View style={[ordersStyles.divider, { backgroundColor: divider }]} />

      <View style={ordersStyles.half}>
        <View style={[ordersStyles.iconPill, { backgroundColor: `${staticTheme.colors.accent[500]}1A` }]}>
          <Package size={16} color={staticTheme.colors.accent[500]} />
        </View>
        <Text variant="h4" weight="bold" style={{ color: textMain, marginTop: 8 }}>
          {productsMade}
        </Text>
        <Text variant="body-xs" style={{ color: textSec, marginTop: 2 }}>
          Units Produced
        </Text>
      </View>
    </View>
  );
});

const ordersStyles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    borderRadius:  12,
    borderWidth:   1,
    overflow:      'hidden',
    marginBottom:  16,
  },
  half: {
    flex:       1,
    padding:    16,
    alignItems: 'center',
  },
  divider: {
    width:          1,
    marginVertical: 12,
  },
  iconPill: {
    width:          32,
    height:         32,
    borderRadius:   10,
    alignItems:     'center',
    justifyContent: 'center',
  },
});

// ─── Quick Actions ─────────────────────────────────────────────────────────────

interface QuickActionsProps {
  isDark:           boolean;
  onPressPOS:       () => void;
  onPressInventory: () => void;
  onPressUtilities: () => void;
  onPressOverhead:  () => void;
}

interface QuickAction {
  label:    string;
  icon:     React.ReactNode;
  onPress:  () => void;
  disabled: boolean;
  color:    string;
}

const OVERHEAD_PURPLE = '#8B5CF6';

const QuickActions = React.memo<QuickActionsProps>(({
  isDark,
  onPressPOS,
  onPressInventory,
  onPressUtilities,
  onPressOverhead,
}) => {
  const cardBg = isDark ? DARK_CARD_BG : '#FFFFFF';
  const border = isDark ? DARK_BORDER  : staticTheme.colors.border;

  const actions = useMemo<QuickAction[]>(() => [
    {
      label:    'POS',
      icon:     <ShoppingCart size={22} color={staticTheme.colors.accent[500]} />,
      onPress:  onPressPOS,
      disabled: false,
      color:    staticTheme.colors.accent[500],
    },
    {
      label:    'Inventory',
      icon:     <Package size={22} color={staticTheme.colors.primary[500]} />,
      onPress:  onPressInventory,
      disabled: false,
      color:    staticTheme.colors.primary[500],
    },
    {
      label:    'Utilities',
      icon:     <Zap size={22} color={staticTheme.colors.highlight[400]} />,
      onPress:  onPressUtilities,
      disabled: false,
      color:    staticTheme.colors.highlight[400],
    },
    {
      label:    'Overhead',
      icon:     <Building2 size={22} color={OVERHEAD_PURPLE} />,
      onPress:  onPressOverhead,
      disabled: false,
      color:    OVERHEAD_PURPLE,
    },
  ], [onPressPOS, onPressInventory, onPressUtilities, onPressOverhead]);

  return (
    <View
      style={[
        qaStyles.card,
        {
          backgroundColor: cardBg,
          borderColor:     border,
          ...(isDark ? {} : staticTheme.shadows.sm),
        },
      ]}
    >
      <Text
        variant="h6"
        weight="semibold"
        style={{ color: isDark ? DARK_TEXT : staticTheme.colors.text, marginBottom: 12 }}
      >
        Quick Actions
      </Text>
      <View style={qaStyles.row}>
        {actions.map(action => (
          <Pressable
            key={action.label}
            onPress={action.disabled ? undefined : action.onPress}
            disabled={action.disabled}
            style={({ pressed }) => [
              qaStyles.actionBtn,
              {
                backgroundColor: `${action.color}1A`,
                borderColor:     `${action.color}33`,
                opacity: action.disabled ? 0.4 : pressed ? 0.7 : 1,
              },
            ]}
            accessibilityRole="button"
            accessibilityLabel={action.label}
            {...(action.disabled ? { accessibilityState: { disabled: true } } : {})}
          >
            {action.icon}
            <Text
              variant="body-xs"
              weight="medium"
              style={{ color: action.color, marginTop: 6 }}
            >
              {action.label}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
});

const qaStyles = StyleSheet.create({
  card: {
    borderRadius: 12,
    borderWidth:  1,
    padding:      16,
    marginBottom: 16,
  },
  row: {
    flexDirection: 'row',
    gap: 8,
  },
  actionBtn: {
    flex:            1,
    aspectRatio:     1,
    borderRadius:    12,
    borderWidth:     1,
    alignItems:      'center',
    justifyContent:  'center',
    paddingVertical: 10,
  },
});

// ─── Skeleton Loading layout ────────────────────────────────────────────────────

const DashboardSkeleton = React.memo<{ isDark: boolean }>(({ isDark }) => (
  <View style={{ gap: 16 }}>
    {/* Period pills */}
    <View style={{ flexDirection: 'row', gap: 8 }}>
      {[1, 2, 3, 4].map(i => (
        <Skeleton key={i} width="23%" height={34} isDark={isDark} radius={20} />
      ))}
    </View>

    {/* KPI 2x2 grid */}
    <View style={{ flexDirection: 'row', gap: 12 }}>
      <Skeleton width="48%" height={90} isDark={isDark} />
      <Skeleton width="48%" height={90} isDark={isDark} />
    </View>
    <View style={{ flexDirection: 'row', gap: 12 }}>
      <Skeleton width="48%" height={90} isDark={isDark} />
      <Skeleton width="48%" height={90} isDark={isDark} />
    </View>

    {/* Orders card */}
    <Skeleton width="100%" height={90} isDark={isDark} />

    {/* Net profit banner */}
    <Skeleton width="100%" height={90} isDark={isDark} />

    {/* Waste & Stock section header */}
    <Skeleton width="40%" height={16} isDark={isDark} />

    {/* Waste & Stock KPI row — 3 cards */}
    <View style={{ flexDirection: 'row', gap: 8 }}>
      <Skeleton width="32%" height={90} isDark={isDark} />
      <Skeleton width="32%" height={90} isDark={isDark} />
      <Skeleton width="32%" height={90} isDark={isDark} />
    </View>

    {/* Overhead section header */}
    <Skeleton width="35%" height={16} isDark={isDark} />

    {/* Overhead KPI row — 2 cards */}
    <View style={{ flexDirection: 'row', gap: 12 }}>
      <Skeleton width="48%" height={90} isDark={isDark} />
      <Skeleton width="48%" height={90} isDark={isDark} />
    </View>

    {/* Trend chart */}
    <Skeleton width="100%" height={140} isDark={isDark} />

    {/* Quick actions */}
    <Skeleton width="100%" height={110} isDark={isDark} />
  </View>
));

// ─── Main screen ───────────────────────────────────────────────────────────────

export default function DashboardScreen() {
  const router = useRouter();
  const user   = useAuthStore(selectCurrentUser);
  const mode   = useThemeStore(selectThemeMode);
  const theme  = useAppTheme();
  const isDark = mode === 'dark';

  const period    = useDashboardStore(selectDashboardPeriod);
  const rawKpis   = useDashboardStore(selectDashboardKPIs);
  const rawTrend  = useDashboardStore(selectDashboardTrend);
  const isLoading = useDashboardStore(selectDashboardLoading);
  const { setPeriod, refreshDashboard } = useDashboardStore(
    useShallow((s) => ({ setPeriod: s.setPeriod, refreshDashboard: s.refreshDashboard })),
  );

  // ── Waste & Stock KPIs ─────────────────────────────────────────────────────
  // These are global all-time aggregates drawn from dedicated stores. They are
  // intentionally NOT period-filtered so they reflect the true lifetime figures
  // regardless of which period the dashboard period-selector is set to.
  const ingredientWasteCost   = useIngredientConsumptionStore(selectIngredientWasteCost);
  const rawMaterialWasteCost  = useRawMaterialConsumptionLogsStore(selectRawMaterialWasteCost);
  const rawMaterialStockValue = useRawMaterialsStore(selectRawMaterialStockValue);
  // Overhead summary — calendar-month/year totals sourced directly from the
  // overhead store so they always reflect the current calendar period regardless
  // of the dashboard period-selector setting.
  const overheadSummary       = useOverheadExpensesStore(selectOverheadSummary);

  const kpis  = rawKpis  ?? EMPTY_KPIS;
  const trend = rawTrend ?? [];

  // Reload whenever the tab gains focus so that production/stock changes made
  // on other screens are reflected immediately without a manual pull-to-refresh.
  // Period changes are still handled by setPeriod (which calls loadDashboard
  // internally), so there is no double-fetch race condition.
  useFocusEffect(
    useCallback(() => {
      void useDashboardStore.getState().loadDashboard(
        useDashboardStore.getState().selectedPeriod,
      );
    }, []),
  );

  // Fade animation when period changes
  const fadeAnim   = useRef(new Animated.Value(1)).current;
  const prevPeriod = useRef<DashboardPeriod>(period);

  useEffect(() => {
    if (prevPeriod.current !== period) {
      prevPeriod.current = period;
      Animated.sequence([
        Animated.timing(fadeAnim, { toValue: 0, duration: 120, useNativeDriver: true }),
        Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
    }
  }, [period, fadeAnim]);

  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    void refreshDashboard().finally(() => setRefreshing(false));
  }, [refreshDashboard]);

  const handleSetPeriod = useCallback((p: DashboardPeriod) => {
    setPeriod(p);
  }, [setPeriod]);

  const goToPOS       = useCallback(() => router.push('/(app)/(tabs)/pos'),       [router]);
  const goToInventory = useCallback(() => router.push('/(app)/(tabs)/inventory'), [router]);
  const goToUtilities = useCallback(() => router.push('/(app)/(tabs)/utilities'), [router]);
  const goToOverhead  = useCallback(() => router.push('/(app)/(tabs)/overhead'),  [router]);

  // Derived color tokens
  const rootBg      = isDark ? DARK_ROOT_BG : theme.colors.background;
  const textMain    = isDark ? DARK_TEXT     : theme.colors.text;
  const textSec     = isDark ? DARK_TEXT_SEC : theme.colors.textSecondary;
  const refreshTint = isDark
    ? staticTheme.colors.primary[300]
    : staticTheme.colors.primary[500];

  // Show full skeleton only when no data has loaded yet
  const showSkeleton = isLoading && kpis.grossSales === 0 && trend.length === 0;

  return (
    <View style={[rootStyles.root, { backgroundColor: rootBg }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />

      <ScrollView
        contentContainerStyle={rootStyles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={refreshTint}
            colors={[refreshTint]}
          />
        }
      >
        {/* ── Header ── */}
        <View style={rootStyles.header}>
          <View style={rootStyles.headerLeft}>
            <Text variant="h5" weight="bold" style={{ color: textMain }} numberOfLines={1}>
              {getGreeting()}, {user?.name ?? 'there'}!
            </Text>
            <Text variant="body-sm" style={{ color: textSec, marginTop: 2 }}>
              {formatTodayDate()}
            </Text>
          </View>

          <Pressable
            onPress={() => { void refreshDashboard(); }}
            style={({ pressed }) => [
              rootStyles.refreshBtn,
              {
                backgroundColor: isDark ? DARK_SURFACE : staticTheme.colors.gray[100],
                opacity: pressed ? 0.6 : 1,
              },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Refresh dashboard"
          >
            {isLoading ? (
              <ActivityIndicator size="small" color={refreshTint} />
            ) : (
              <RefreshCw size={18} color={refreshTint} />
            )}
          </Pressable>
        </View>

        {showSkeleton ? (
          <DashboardSkeleton isDark={isDark} />
        ) : (
          <>
            {/* ── Period Selector ── */}
            <View style={rootStyles.section}>
              <PeriodSelector
                period={period}
                onSelect={handleSetPeriod}
                isDark={isDark}
              />
              <Text
                variant="body-xs"
                style={{ color: textSec, marginTop: 6, marginLeft: 4 }}
              >
                Showing data for: {kpis.periodLabel}
              </Text>
            </View>

            {/* ── KPI Grid (2×2) ── */}
            <Animated.View style={[rootStyles.section, { opacity: fadeAnim }]}>
              <View style={[rootStyles.kpiRow, isTablet ? rootStyles.kpiRowTablet : undefined]}>
                <KpiCard
                  label="Gross Sales"
                  value={formatCurrency(kpis.grossSales)}
                  icon={<TrendingUp size={14} color={staticTheme.colors.success[500]} />}
                  accentColor={staticTheme.colors.success[500]}
                  isDark={isDark}
                />
                <KpiCard
                  label="Products Sold"
                  value={formatUnits(kpis.totalProductsSold)}
                  icon={<ShoppingBag size={14} color={staticTheme.colors.primary[500]} />}
                  accentColor={staticTheme.colors.primary[500]}
                  isDark={isDark}
                />
              </View>

              <View
                style={[
                  rootStyles.kpiRow,
                  rootStyles.kpiRowGap,
                  isTablet ? rootStyles.kpiRowTablet : undefined,
                ]}
              >
                <KpiCard
                  label="Ingredient Cost"
                  value={formatCurrency(kpis.ingredientCost)}
                  icon={<Package size={14} color={staticTheme.colors.highlight[400]} />}
                  accentColor={staticTheme.colors.highlight[400]}
                  isDark={isDark}
                />
                <KpiCard
                  label="Utilities"
                  value={formatCurrency(kpis.utilitiesCost)}
                  icon={<Zap size={14} color={staticTheme.colors.accent[500]} />}
                  accentColor={staticTheme.colors.accent[500]}
                  isDark={isDark}
                />
              </View>
            </Animated.View>

            {/* ── Orders + Production (wide card) ── */}
            <Animated.View style={{ opacity: fadeAnim }}>
              <OrdersProducedCard
                totalOrders={kpis.totalOrders}
                productsMade={kpis.productsMade}
                isDark={isDark}
              />
            </Animated.View>

            {/* ── P&L Waterfall ── */}
            <Animated.View style={{ opacity: fadeAnim }}>
              <PLWaterfallCard kpis={kpis} isDark={isDark} />
            </Animated.View>

            {/* ── Waste & Stock KPIs ── */}
            {/* These are all-time global aggregates — not period-filtered. */}
            <View style={rootStyles.section}>
              <Text
                variant="body-sm"
                weight="semibold"
                style={{
                  color:        isDark ? DARK_TEXT_SEC : staticTheme.colors.gray[500],
                  marginBottom: 10,
                  letterSpacing: 0.4,
                  textTransform: 'uppercase',
                }}
              >
                Waste & Stock
              </Text>
              <View style={wasteStyles.row}>
                <KpiCard
                  label="Ingr. Waste"
                  value={formatCurrency(ingredientWasteCost)}
                  icon={<Trash2 size={14} color={staticTheme.colors.error[500]} />}
                  accentColor={staticTheme.colors.error[500]}
                  isDark={isDark}
                />
                <KpiCard
                  label="RM Waste"
                  value={formatCurrency(rawMaterialWasteCost)}
                  icon={<AlertTriangle size={14} color={staticTheme.colors.warning[500]} />}
                  accentColor={staticTheme.colors.warning[500]}
                  isDark={isDark}
                />
                <KpiCard
                  label="RM Stock"
                  value={formatCurrency(rawMaterialStockValue)}
                  icon={<Boxes size={14} color={staticTheme.colors.info[500]} />}
                  accentColor={staticTheme.colors.info[500]}
                  isDark={isDark}
                />
              </View>
            </View>

            {/* ── Overhead KPIs ── */}
            {/* Calendar-month and calendar-year totals from overhead_expenses.
                Not period-filtered — always reflects current month / year. */}
            <View style={rootStyles.section}>
              <Text
                variant="body-sm"
                weight="semibold"
                style={{
                  color:         isDark ? DARK_TEXT_SEC : staticTheme.colors.gray[500],
                  marginBottom:  10,
                  letterSpacing: 0.4,
                  textTransform: 'uppercase',
                }}
              >
                Overhead
              </Text>
              <View style={[wasteStyles.row]}>
                <KpiCard
                  label="This Month"
                  value={formatCurrency(overheadSummary.thisMonth)}
                  icon={<Building2 size={14} color="#8B5CF6" />}
                  accentColor="#8B5CF6"
                  isDark={isDark}
                />
                <KpiCard
                  label="This Year"
                  value={formatCurrency(overheadSummary.thisYear)}
                  icon={<Building2 size={14} color="#3B82F6" />}
                  accentColor="#3B82F6"
                  isDark={isDark}
                />
              </View>
            </View>

            {/* ── Trend Chart ── */}
            <TrendChart data={trend} isDark={isDark} isLoading={isLoading} />

            {/* ── Quick Actions ── */}
            <QuickActions
              isDark={isDark}
              onPressPOS={goToPOS}
              onPressInventory={goToInventory}
              onPressUtilities={goToUtilities}
              onPressOverhead={goToOverhead}
            />

            <View style={{ height: Platform.OS === 'ios' ? 16 : 8 }} />
          </>
        )}
      </ScrollView>
    </View>
  );
}

// ─── Waste & Stock section styles ─────────────────────────────────────────────

const wasteStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap:           8,
  },
});

// ─── Root styles ──────────────────────────────────────────────────────────────

const rootStyles = StyleSheet.create({
  root: {
    flex: 1,
  },
  scroll: {
    paddingHorizontal: 16,
    paddingTop:        12,
    paddingBottom:     32,
  },
  header: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
    marginBottom:   20,
  },
  headerLeft: {
    flex:        1,
    marginRight: 12,
  },
  refreshBtn: {
    width:          40,
    height:         40,
    borderRadius:   20,
    alignItems:     'center',
    justifyContent: 'center',
  },
  section: {
    marginBottom: 16,
  },
  kpiRow: {
    flexDirection: 'row',
    gap:           12,
  },
  kpiRowTablet: {
    gap: 16,
  },
  kpiRowGap: {
    marginTop: 12,
  },
});
