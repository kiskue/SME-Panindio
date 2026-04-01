/**
 * DashboardScreen — ERP Home
 *
 * Comprehensive business dashboard for SME Panindio. Surfaces KPIs, a
 * period-based trend chart, net profit summary, and quick navigation.
 *
 * Data layer: useDashboardStore (dashboard.store.ts) — being built in
 * parallel. This file uses a LOCAL STUB store (useDashboardStoreLocal)
 * that mirrors the expected public API exactly. Swap the import when     
 * dashboard.store.ts lands:
 *   - Remove useDashboardStoreLocal and its type block below
 *   - Uncomment the '@/store' import lines for the dashboard selectors
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
  Calculator,
  ChevronRight,
} from 'lucide-react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Text } from '@/components/atoms/Text';
import { SkeletonBox } from '@/components/atoms/SkeletonBox';
import { LoadingSpinner } from '@/components/molecules/LoadingSpinner';
import { PeriodSelector } from '@/components/molecules/PeriodSelector';
import { DayPicker, WeekPicker, MonthPicker, YearPicker } from '@/components/molecules/PeriodPicker';
import { BottomSheet } from '@/components/organisms/BottomSheet';
import type { BottomSheetHandle } from '@/components/organisms/BottomSheet';
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
  selectDashboardPeriodState,
  selectDashboardCanGoNext,
  selectDashboardSetAnchor,
} from '@/store';
import { useShallow } from 'zustand/react/shallow';
import { useAppTheme } from '@/core/theme';
import { theme as staticTheme } from '@/core/theme';

// ─── Types ─────────────────────────────────────────────────────────────────────

import type { DashboardPeriod, DashboardPeriodState, DashboardKPIs, DashboardTrendPoint } from '@/types';
import { useROIStore, selectROIInsight, selectROIResults, selectROILoading } from '@/store/roi.store';
import {
  useBusinessROIStore,
  selectBusinessROIPercent,
  selectBusinessROILoading as selectBizROILoading,
  selectBusinessROIRiskLevel,
} from '@/store';

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

// ─── Skeleton placeholder — delegated to SkeletonBox atom ─────────────────────
// SkeletonBox reads theme mode itself via the store, so `isDark` is no longer
// needed here. The prop is prefixed with `_` to satisfy noUnusedParameters.

interface SkeletonProps {
  width:   number | `${number}%`;
  height:  number;
  radius?: number;
  isDark:  boolean; // kept for call-site compat; SkeletonBox reads theme internally
}

const Skeleton = React.memo<SkeletonProps>(({ width, height, radius = 8, isDark: _isDark }) => (
  <SkeletonBox width={width} height={height} borderRadius={radius} />
));

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

interface PLWaterfallCardProps {
  kpis:   DashboardKPIs;
  isDark: boolean;
}

const PLWaterfallCard = React.memo<PLWaterfallCardProps>(({ kpis, isDark }) => {
  const isNetNeg     = kpis.netProfit < 0;
  const isGrossNeg   = kpis.grossProfit < 0;
  const accentColor  = isNetNeg
    ? staticTheme.colors.error[500]
    : staticTheme.colors.success[500];
  const cardBg       = isDark ? DARK_CARD_BG : '#FFFFFF';
  const border       = isDark ? DARK_BORDER  : staticTheme.colors.border;
  const textMain     = isDark ? DARK_TEXT    : staticTheme.colors.text;
  const textSec      = isDark ? DARK_TEXT_SEC : staticTheme.colors.gray[500];
  const dividerColor = isDark ? DARK_BORDER  : staticTheme.colors.gray[200];

  const incomeColor    = staticTheme.colors.success[500];
  const costColor      = staticTheme.colors.error[500];
  const wasteColor     = staticTheme.colors.warning[500];
  const grossProfitClr = isGrossNeg
    ? staticTheme.colors.error[500]
    : staticTheme.colors.primary[500];
  const netProfitClr   = isNetNeg
    ? staticTheme.colors.error[500]
    : staticTheme.colors.success[500];

  const showIngredientWaste   = kpis.ingredientWastePeriod   > 0;
  const showRawMaterialWaste  = kpis.rawMaterialWastePeriod  > 0;

  return (
    <View
      style={[
        bannerStyles.card,
        {
          backgroundColor: cardBg,
          borderColor:     border,
          ...(isDark ? {} : staticTheme.shadows.sm),
        },
      ]}
    >
      {/* Top accent bar — green if profitable, red if loss */}
      <View style={[bannerStyles.topBar, { backgroundColor: accentColor }]} />

      <View style={bannerStyles.inner}>
        {/* ── Header ── */}
        <Text variant="h6" weight="semibold" style={{ color: textMain }}>
          P&L Summary — {kpis.periodLabel}
        </Text>
        <Text variant="body-xs" style={{ color: textSec, marginTop: 2, marginBottom: 14 }}>
          Showing data for this period
        </Text>

        {/* ── Gross Income ── */}
        <View style={bannerStyles.row}>
          <Text variant="body-sm" weight="semibold" style={{ color: textMain }}>
            Gross Income
          </Text>
          <Text variant="body-sm" weight="semibold" style={{ color: incomeColor }}>
            {formatCurrency(kpis.grossSales)}
          </Text>
        </View>
        <Text variant="body-xs" style={{ color: textSec, marginLeft: 0, marginTop: 2, marginBottom: 12 }}>
          from {formatUnits(kpis.totalOrders)} completed {kpis.totalOrders === 1 ? 'order' : 'orders'}
        </Text>

        {/* ── COGS header ── */}
        <Text
          variant="body-xs"
          weight="semibold"
          style={{ color: textSec, letterSpacing: 0.6, marginBottom: 6, textTransform: 'uppercase' }}
        >
          COGS (Cost of Goods Sold)
        </Text>

        {/* Ingredient Cost */}
        <View style={bannerStyles.row}>
          <Text variant="body-sm" style={{ color: textMain, marginLeft: 12 }}>
            Ingredient Cost
          </Text>
          <Text variant="body-sm" style={{ color: costColor }}>
            {formatCurrency(kpis.ingredientCost)}
          </Text>
        </View>

        {showIngredientWaste && (
          <View style={[bannerStyles.row, { marginTop: 2 }]}>
            <Text variant="body-xs" style={{ color: wasteColor, marginLeft: 24 }}>
              · Waste
            </Text>
            <Text variant="body-xs" style={{ color: wasteColor }}>
              {formatCurrency(kpis.ingredientWastePeriod)}
            </Text>
          </View>
        )}

        {/* Raw Material Cost */}
        <View style={[bannerStyles.row, { marginTop: 6 }]}>
          <Text variant="body-sm" style={{ color: textMain, marginLeft: 12 }}>
            Raw Material Cost
          </Text>
          <Text variant="body-sm" style={{ color: costColor }}>
            {formatCurrency(kpis.rawMaterialCost)}
          </Text>
        </View>

        {showRawMaterialWaste && (
          <View style={[bannerStyles.row, { marginTop: 2 }]}>
            <Text variant="body-xs" style={{ color: wasteColor, marginLeft: 24 }}>
              · Waste
            </Text>
            <Text variant="body-xs" style={{ color: wasteColor }}>
              {formatCurrency(kpis.rawMaterialWastePeriod)}
            </Text>
          </View>
        )}

        {/* ── Gross Profit subtotal ── */}
        <View style={[bannerStyles.divider, { backgroundColor: dividerColor, marginTop: 10, marginBottom: 10 }]} />

        <View style={bannerStyles.row}>
          <Text variant="body-sm" weight="semibold" style={{ color: textMain }}>
            Gross Profit
          </Text>
          <Text variant="body-sm" weight="semibold" style={{ color: grossProfitClr }}>
            {isGrossNeg ? '-' : ''}{formatCurrency(kpis.grossProfit)}
          </Text>
        </View>

        {/* ── Operating Expenses ── */}
        <Text
          variant="body-xs"
          weight="semibold"
          style={{ color: textSec, letterSpacing: 0.6, marginTop: 14, marginBottom: 6, textTransform: 'uppercase' }}
        >
          Operating Expenses
        </Text>

        <View style={bannerStyles.row}>
          <Text variant="body-sm" style={{ color: textMain, marginLeft: 12 }}>
            Utilities
          </Text>
          <Text variant="body-sm" style={{ color: costColor }}>
            {formatCurrency(kpis.utilitiesCost)}
          </Text>
        </View>

        <View style={[bannerStyles.row, { marginTop: 6 }]}>
          <Text variant="body-sm" style={{ color: textMain, marginLeft: 12 }}>
            Overhead
          </Text>
          <Text variant="body-sm" style={{ color: costColor }}>
            {formatCurrency(kpis.opexThisPeriod)}
          </Text>
        </View>

        {/* ── Net Profit total ── */}
        <View style={[bannerStyles.thickDivider, { backgroundColor: dividerColor, marginTop: 10, marginBottom: 10 }]} />

        <View style={bannerStyles.row}>
          <Text variant="body" weight="bold" style={{ color: textMain }}>
            NET PROFIT
          </Text>
          <Text variant="body" weight="bold" style={{ color: netProfitClr }}>
            {isNetNeg ? '-' : ''}{formatCurrency(kpis.netProfit)}
          </Text>
        </View>
      </View>
    </View>
  );
});

const bannerStyles = StyleSheet.create({
  card: {
    borderRadius: 12,
    borderWidth:  1,
    overflow:     'hidden',
    marginBottom: 16,
  },
  topBar: {
    height: 4,
  },
  inner: {
    padding: 16,
  },
  row: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    alignItems:     'center',
  },
  divider: {
    height: 1,
  },
  thickDivider: {
    height: 2,
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
}

interface QuickAction {
  label:    string;
  icon:     React.ReactNode;
  onPress:  () => void;
  disabled: boolean;
  color:    string;
}

const QuickActions = React.memo<QuickActionsProps>(({
  isDark,
  onPressPOS,
  onPressInventory,
  onPressUtilities,
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
      label:    'Reports',
      icon:     <BarChart2 size={22} color={isDark ? DARK_TEXT_SEC : staticTheme.colors.gray[400]} />,
      onPress:  () => {},
      disabled: true,
      color:    isDark ? DARK_TEXT_SEC : staticTheme.colors.gray[400],
    },
  ], [isDark, onPressPOS, onPressInventory, onPressUtilities]);

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

// ─── ROI Outlook Card (Dashboard summary) ──────────────────────────────────────

interface ROIOutlookCardProps {
  isDark:    boolean;
  onPress:   () => void;
}

const ROIOutlookCard = React.memo<ROIOutlookCardProps>(({ isDark, onPress }) => {
  const insight   = useROIStore(selectROIInsight);
  const results   = useROIStore(selectROIResults);
  const isLoading = useROIStore(selectROILoading);

  const cardBg  = isDark ? DARK_CARD_BG : '#FFFFFF';
  const border  = isDark ? DARK_BORDER  : staticTheme.colors.border;
  const textMain = isDark ? DARK_TEXT    : staticTheme.colors.text;
  const textSec  = isDark ? DARK_TEXT_SEC : staticTheme.colors.textSecondary;
  const accentPurple = isDark ? '#A78BFA' : '#7C3AED';

  const riskLevel   = results?.riskLevel ?? 'low';
  const riskColor   = riskLevel === 'low'
    ? (isDark ? '#3DD68C' : staticTheme.colors.success[500])
    : riskLevel === 'medium'
    ? (isDark ? '#FFB020' : staticTheme.colors.warning[500])
    : (isDark ? '#FF6B6B' : staticTheme.colors.error[500]);

  const periodStr = results !== null
    ? (results.breakevenMonths >= 999
      ? 'Not recoverable'
      : `Break-even: ${results.breakevenMonths}mo ${results.breakevenDays > 0 ? `${results.breakevenDays}d` : ''}`)
    : 'Configure to see analysis';

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        roiCardStyles.card,
        {
          backgroundColor: cardBg,
          borderColor:     border,
          opacity: pressed ? 0.88 : 1,
          ...(isDark ? {} : staticTheme.shadows.sm),
        },
      ]}
      accessibilityRole="button"
      accessibilityLabel="Open ROI Calculator"
    >
      {/* Left accent bar */}
      <View style={[roiCardStyles.accentBar, { backgroundColor: accentPurple }]} />

      <View style={roiCardStyles.inner}>
        {/* Header row */}
        <View style={roiCardStyles.headerRow}>
          <View style={[roiCardStyles.iconPill, { backgroundColor: `${accentPurple}1A` }]}>
            <Calculator size={16} color={accentPurple} />
          </View>
          <Text
            variant="h6"
            weight="semibold"
            style={{ flex: 1, marginLeft: 8, color: textMain }}
          >
            ROI Outlook
          </Text>
          <View style={[roiCardStyles.riskChip, { backgroundColor: `${riskColor}1A` }]}>
            <Text variant="body-xs" weight="semibold" style={{ color: riskColor }}>
              {riskLevel.charAt(0).toUpperCase() + riskLevel.slice(1)} Risk
            </Text>
          </View>
        </View>

        {/* Period line */}
        <Text
          variant="body-xs"
          weight="medium"
          style={{ color: textSec, marginBottom: 8 }}
        >
          {periodStr}
        </Text>

        {/* Insight text */}
        {isLoading ? (
          <View style={roiCardStyles.shimmerBlock}>
            <View style={[roiCardStyles.shimmerLine, { width: '90%', backgroundColor: isDark ? '#2A3347' : staticTheme.colors.gray[200] }]} />
            <View style={[roiCardStyles.shimmerLine, { width: '70%', marginTop: 6, backgroundColor: isDark ? '#2A3347' : staticTheme.colors.gray[200] }]} />
          </View>
        ) : (
          <Text
            variant="body-xs"
            style={{ color: textSec, lineHeight: 18 }}
            numberOfLines={2}
          >
            {insight}
          </Text>
        )}

        {/* CTA */}
        <View style={roiCardStyles.ctaRow}>
          <Text variant="body-xs" weight="semibold" style={{ color: accentPurple }}>
            Configure ROI
          </Text>
          <ChevronRight size={14} color={accentPurple} />
        </View>
      </View>
    </Pressable>
  );
});

const roiCardStyles = StyleSheet.create({
  card: {
    borderRadius:  12,
    borderWidth:   1,
    flexDirection: 'row',
    overflow:      'hidden',
    marginBottom:  16,
  },
  accentBar: {
    width:        3,
  },
  inner: {
    flex:              1,
    padding:           14,
  },
  headerRow: {
    flexDirection:  'row',
    alignItems:     'center',
    marginBottom:    6,
  },
  iconPill: {
    width:          28,
    height:         28,
    borderRadius:    8,
    alignItems:     'center',
    justifyContent: 'center',
  },
  riskChip: {
    paddingVertical:   3,
    paddingHorizontal: 8,
    borderRadius:     20,
  },
  shimmerBlock: {
    marginBottom: 8,
  },
  shimmerLine: {
    height:       12,
    borderRadius:  4,
  },
  ctaRow: {
    flexDirection: 'row',
    alignItems:    'center',
    marginTop:     10,
  },
});

// ─── Business ROI summary card (Dashboard) ──────────────────────────────────────

interface BusinessROICardProps {
  isDark:  boolean;
  onPress: () => void;
}

const BusinessROICard = React.memo<BusinessROICardProps>(({ isDark, onPress }) => {
  const roiPercent  = useBusinessROIStore(selectBusinessROIPercent);
  const isLoading   = useBusinessROIStore(selectBizROILoading);
  const riskLevel   = useBusinessROIStore(selectBusinessROIRiskLevel);
  const {
    netProfit,
    breakevenUnits,
    unitsSoldToDate,
    computeBusinessROI,
  } = useBusinessROIStore();

  // Refresh on mount if not yet loaded
  useEffect(() => {
    if (roiPercent === 0 && !isLoading) {
      computeBusinessROI();
    }
  }, [roiPercent, isLoading, computeBusinessROI]);

  const accentGreen  = isDark ? '#10B981' : staticTheme.colors.success[500];
  const cardBg   = isDark ? DARK_CARD_BG : '#FFFFFF';
  const border   = isDark ? DARK_BORDER  : staticTheme.colors.border;
  const textMain = isDark ? DARK_TEXT    : staticTheme.colors.text;
  const textSec  = isDark ? DARK_TEXT_SEC : staticTheme.colors.textSecondary;

  const riskColor =
    riskLevel === 'low'    ? (isDark ? '#3DD68C' : staticTheme.colors.success[500]) :
    riskLevel === 'medium' ? (isDark ? '#FFB020' : staticTheme.colors.warning[500]) :
    (isDark ? '#FF6B6B' : staticTheme.colors.error[500]);

  const breakevenPct = breakevenUnits > 0
    ? Math.min(100, Math.round((unitsSoldToDate / breakevenUnits) * 100))
    : 0;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        bizROIStyles.card,
        {
          backgroundColor: cardBg,
          borderColor:     border,
          opacity: pressed ? 0.88 : 1,
          ...(isDark ? {} : staticTheme.shadows.sm),
        },
      ]}
      accessibilityRole="button"
      accessibilityLabel="Open Business ROI Overview"
    >
      {/* Left accent bar */}
      <View style={[bizROIStyles.accentBar, { backgroundColor: accentGreen }]} />

      <View style={bizROIStyles.inner}>
        {/* Header row */}
        <View style={bizROIStyles.headerRow}>
          <View style={[bizROIStyles.iconPill, { backgroundColor: `${accentGreen}1A` }]}>
            <BarChart2 size={16} color={accentGreen} />
          </View>
          <Text
            variant="h6"
            weight="semibold"
            style={{ flex: 1, marginLeft: 8, color: textMain }}
          >
            Business ROI
          </Text>
          <View style={[bizROIStyles.riskChip, { backgroundColor: `${riskColor}1A` }]}>
            <Text variant="body-xs" weight="semibold" style={{ color: riskColor }}>
              {riskLevel.charAt(0).toUpperCase() + riskLevel.slice(1)} Risk
            </Text>
          </View>
        </View>

        {/* Key metrics row */}
        {isLoading ? (
          <View style={{ gap: 8, marginBottom: 8 }}>
            <View style={[bizROIStyles.shimmerLine, { width: '80%', backgroundColor: isDark ? '#2A3347' : staticTheme.colors.gray[200] }]} />
            <View style={[bizROIStyles.shimmerLine, { width: '60%', backgroundColor: isDark ? '#2A3347' : staticTheme.colors.gray[200] }]} />
          </View>
        ) : (
          <View style={bizROIStyles.metricsRow}>
            {/* ROI% */}
            <View style={bizROIStyles.metricBlock}>
              <Text variant="body-xs" weight="medium" style={{ color: textSec }}>
                ROI
              </Text>
              <Text
                variant="h5"
                weight="bold"
                style={{ color: roiPercent >= 20 ? riskColor : roiPercent >= 10 ? riskColor : riskColor }}
              >
                {roiPercent >= 0 ? '+' : ''}{roiPercent.toFixed(1)}%
              </Text>
            </View>

            {/* Divider */}
            <View style={[bizROIStyles.metricDivider, { backgroundColor: isDark ? DARK_BORDER : staticTheme.colors.borderSubtle }]} />

            {/* Net Profit */}
            <View style={bizROIStyles.metricBlock}>
              <Text variant="body-xs" weight="medium" style={{ color: textSec }}>
                Net Profit
              </Text>
              <Text
                variant="body-sm"
                weight="bold"
                style={{ color: netProfit >= 0 ? riskColor : (isDark ? '#FF6B6B' : staticTheme.colors.error[500]) }}
              >
                {netProfit < 0 ? '-' : ''}₱{Math.abs(netProfit).toLocaleString('en-PH', { maximumFractionDigits: 0 })}
              </Text>
            </View>

            {/* Divider */}
            <View style={[bizROIStyles.metricDivider, { backgroundColor: isDark ? DARK_BORDER : staticTheme.colors.borderSubtle }]} />

            {/* Breakeven % */}
            <View style={bizROIStyles.metricBlock}>
              <Text variant="body-xs" weight="medium" style={{ color: textSec }}>
                Breakeven
              </Text>
              <Text variant="body-sm" weight="bold" style={{ color: accentGreen }}>
                {breakevenPct}%
              </Text>
            </View>
          </View>
        )}

        {/* Mini breakeven track */}
        {!isLoading && (
          <View style={[bizROIStyles.miniTrack, { backgroundColor: isDark ? DARK_SURFACE : staticTheme.colors.gray[100] }]}>
            <View
              style={[
                bizROIStyles.miniFill,
                {
                  width:           `${breakevenPct}%` as `${number}%`,
                  backgroundColor: accentGreen,
                },
              ]}
            />
          </View>
        )}

        {/* CTA */}
        <View style={bizROIStyles.ctaRow}>
          <Text variant="body-xs" weight="semibold" style={{ color: accentGreen }}>
            View Full Analysis
          </Text>
          <ChevronRight size={14} color={accentGreen} />
        </View>
      </View>
    </Pressable>
  );
});

const bizROIStyles = StyleSheet.create({
  card: {
    borderRadius:  12,
    borderWidth:    1,
    flexDirection: 'row',
    overflow:      'hidden',
    marginBottom:  16,
  },
  accentBar: {
    width: 3,
  },
  inner: {
    flex:    1,
    padding: 14,
  },
  headerRow: {
    flexDirection:  'row',
    alignItems:     'center',
    marginBottom:    8,
  },
  iconPill: {
    width:          28,
    height:         28,
    borderRadius:    8,
    alignItems:     'center',
    justifyContent: 'center',
  },
  riskChip: {
    paddingVertical:   3,
    paddingHorizontal: 8,
    borderRadius:     20,
  },
  metricsRow: {
    flexDirection:  'row',
    alignItems:     'center',
    marginBottom:    10,
  },
  metricBlock: {
    flex:    1,
    alignItems: 'flex-start',
  },
  metricDivider: {
    width:  1,
    height: 32,
    marginHorizontal: 8,
  },
  miniTrack: {
    height:       5,
    borderRadius:  3,
    overflow:     'hidden',
    marginBottom:  8,
  },
  miniFill: {
    height:       5,
    borderRadius:  3,
  },
  shimmerLine: {
    height:       12,
    borderRadius:  4,
  },
  ctaRow: {
    flexDirection: 'row',
    alignItems:    'center',
    marginTop:      6,
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

    {/* P&L waterfall card */}
    <Skeleton width="100%" height={200} isDark={isDark} />

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

  // period (type string) — used for pill-tab highlight only, no re-render on anchor change
  const period      = useDashboardStore(selectDashboardPeriod);
  // periodState — used for the navigator label and to seed the animation guard
  const periodState = useDashboardStore(selectDashboardPeriodState);
  const canGoNext   = useDashboardStore(selectDashboardCanGoNext);
  const rawKpis     = useDashboardStore(selectDashboardKPIs);
  const rawTrend    = useDashboardStore(selectDashboardTrend);
  const isLoading   = useDashboardStore(selectDashboardLoading);
  const { setPeriod, goToPrev, goToNext, refreshDashboard } = useDashboardStore(
    useShallow((s) => ({
      setPeriod:        s.setPeriod,
      goToPrev:         s.goToPrev,
      goToNext:         s.goToNext,
      refreshDashboard: s.refreshDashboard,
    })),
  );
  const setAnchor = useDashboardStore(selectDashboardSetAnchor);

  const kpis  = rawKpis  ?? EMPTY_KPIS;
  const trend = rawTrend ?? [];

  // ── Period picker sheet ────────────────────────────────────────────────────
  // The sheet ref + visible flag control the BottomSheet organism.
  const pickerSheetRef                        = useRef<BottomSheetHandle>(null);
  const [pickerVisible, setPickerVisible]     = useState(false);

  const openPicker = useCallback(() => setPickerVisible(true),  []);
  const closePicker = useCallback(() => setPickerVisible(false), []);

  // Snap point: Day calendar needs more vertical space than the others.
  const pickerSnapPoint = period === 'day' ? '75%' as const : '60%' as const;

  // Title for the sheet header
  const pickerTitle = useMemo(() => {
    switch (period) {
      case 'day':   return 'Select Day';
      case 'week':  return 'Select Week';
      case 'month': return 'Select Month';
      case 'year':  return 'Select Year';
    }
  }, [period]);

  // Handle a picker selection: jump to the chosen anchor and close the sheet.
  const handlePickerSelect = useCallback(
    (anchor: string) => {
      void setAnchor(anchor);
      closePicker();
    },
    [setAnchor, closePicker],
  );

  // Trigger initial load on mount only. Period changes are handled by setPeriod,
  // which calls loadDashboard internally — a separate useEffect([period]) would
  // cause a double-fetch race condition on every period selection.
  useEffect(() => {
    void useDashboardStore.getState().loadDashboard(
      useDashboardStore.getState().periodState,
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Refresh BusinessROI when the dashboard comes into focus (stale > 5 min).
  useFocusEffect(
    useCallback(() => {
      const state = useBusinessROIStore.getState();
      const now    = Date.now();
      const lastMs = state.lastRefreshed !== null
        ? new Date(state.lastRefreshed).getTime()
        : 0;
      if (now - lastMs > 5 * 60 * 1000 && !state.isLoading) {
        void state.computeBusinessROI();
      }
    }, []),
  );

  // Fade animation when the viewed period changes (type or anchor).
  const fadeAnim       = useRef(new Animated.Value(1)).current;
  const prevPeriodRef  = useRef<DashboardPeriodState>(periodState);

  useEffect(() => {
    const prev = prevPeriodRef.current;
    if (prev.type !== periodState.type || prev.anchor !== periodState.anchor) {
      prevPeriodRef.current = periodState;
      Animated.sequence([
        Animated.timing(fadeAnim, { toValue: 0, duration: 120, useNativeDriver: true }),
        Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
    }
  }, [periodState, fadeAnim]);

  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    void refreshDashboard().finally(() => setRefreshing(false));
  }, [refreshDashboard]);

  const handleSetPeriod = useCallback((p: DashboardPeriod) => {
    void setPeriod(p);
  }, [setPeriod]);

  const handleGoToPrev = useCallback(() => { void goToPrev(); }, [goToPrev]);
  const handleGoToNext = useCallback(() => { void goToNext(); }, [goToNext]);

  // Expose the picker open handler to PeriodSelector.
  const handleLabelPress = useCallback(() => openPicker(), [openPicker]);

  const goToPOS       = useCallback(() => router.push('/(app)/(tabs)/pos'),       [router]);
  const goToInventory = useCallback(() => router.push('/(app)/(tabs)/inventory'), [router]);
  const goToUtilities = useCallback(() => router.push('/(app)/(tabs)/utilities'), [router]);
  const goToROI          = useCallback(() => router.push('/(app)/(tabs)/roi'),          [router]);
  const goToBusinessROI  = useCallback(() => router.push('/(app)/(tabs)/business-roi'), [router]);

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
              <LoadingSpinner size="small" color={refreshTint} variant="ring" />
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
                periodLabel={kpis.periodLabel}
                onPrev={handleGoToPrev}
                onNext={handleGoToNext}
                canGoNext={canGoNext}
                onLabelPress={handleLabelPress}
              />
            </View>

            {/* ── KPI Grid (2×2) ── */}
            <Animated.View style={[rootStyles.section, { opacity: fadeAnim }]}>
              <View style={[rootStyles.kpiRow, isTablet ? rootStyles.kpiRowTablet : undefined]}>
                <KpiCard
                  label="Gross Income"
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
                  label="Gross Profit"
                  value={formatCurrency(kpis.grossProfit)}
                  icon={<TrendingUp size={14} color={staticTheme.colors.success[500]} />}
                  accentColor={staticTheme.colors.success[500]}
                  isDark={isDark}
                  negative={kpis.grossProfit < 0}
                />
                <KpiCard
                  label="COGS"
                  value={formatCurrency(kpis.cogs)}
                  icon={<Package size={14} color={staticTheme.colors.error[400]} />}
                  accentColor={staticTheme.colors.error[400]}
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

            {/* ── Trend Chart ── */}
            <TrendChart data={trend} isDark={isDark} isLoading={isLoading} />

            {/* ── Quick Actions ── */}
            <QuickActions
              isDark={isDark}
              onPressPOS={goToPOS}
              onPressInventory={goToInventory}
              onPressUtilities={goToUtilities}
            />

            {/* ── ROI Outlook ── */}
            <ROIOutlookCard isDark={isDark} onPress={goToROI} />

            {/* ── Business ROI Summary ── */}
            <BusinessROICard isDark={isDark} onPress={goToBusinessROI} />

            <View style={{ height: Platform.OS === 'ios' ? 16 : 8 }} />
          </>
        )}
      </ScrollView>

      {/* ── Period Picker Sheet ── */}
      <BottomSheet
        ref={pickerSheetRef}
        visible={pickerVisible}
        onClose={closePicker}
        title={pickerTitle}
        defaultSnapPoint={pickerSnapPoint}
        showCloseButton
        scrollable={period !== 'day'}
      >
        {period === 'day' && (
          <DayPicker
            selectedAnchor={periodState.anchor}
            onSelect={handlePickerSelect}
            isDark={isDark}
          />
        )}
        {period === 'week' && (
          <WeekPicker
            selectedAnchor={periodState.anchor}
            onSelect={handlePickerSelect}
            isDark={isDark}
          />
        )}
        {period === 'month' && (
          <MonthPicker
            selectedAnchor={periodState.anchor}
            onSelect={handlePickerSelect}
            isDark={isDark}
          />
        )}
        {period === 'year' && (
          <YearPicker
            selectedAnchor={periodState.anchor}
            onSelect={handlePickerSelect}
            isDark={isDark}
          />
        )}
      </BottomSheet>
    </View>
  );
}

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
