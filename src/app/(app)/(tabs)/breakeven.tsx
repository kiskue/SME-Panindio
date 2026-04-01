/**
 * BreakevenScreen — breakeven.tsx
 *
 * ERP-standard break-even analysis driven entirely by real business data pulled
 * from useBusinessROIStore.  No manual cost or price entry — the store already
 * aggregates inventory value, overhead, utilities, COGS, and sales history.
 *
 * Only ONE user-adjustable input is retained:
 *   "Monthly Sales Target (units)" — lets the user run "what if I sell X/mo"
 *   simulations without touching any stored data.
 *
 * Sections (scroll order):
 *   1. Header               — title, refresh button, last-refreshed timestamp
 *   2. Business Snapshot    — 3 read-only summary pills (profit, fixed costs, pace)
 *   3. Per-Product Analysis — top-3 products: CM/unit + progress toward recovery
 *   4. Overall Break-Even   — hero card: unitsStillNeeded, unitsToRecoverLoss, total
 *   5. Time to Recovery     — single input + estimated months + required daily sales
 *   6. Progress bar         — BreakevenProgress (unitsSoldToDate vs totalUnitsNeeded)
 *   7. AI Insight           — rule-based AIInsightCard using store aiInsight + riskLevel
 *
 * Zustand v5 selector rule (CRITICAL):
 *   NEVER select via `s => ({ ... })` — new object every render → infinite loop.
 *   Select each primitive individually.
 *
 * TypeScript constraints honoured:
 *   - exactOptionalPropertyTypes: conditional spread for optional props
 *   - noUncheckedIndexedAccess: ?? fallbacks on all array/object access
 *   - noUnusedLocals/Parameters: unused vars prefixed with _
 */

import React, {
  useCallback,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  Platform,
  KeyboardAvoidingView,
  TextInput as RNTextInput,
  Dimensions,
  Animated,
  Pressable,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import {
  Target,
  TrendingUp,
  Package,
  RefreshCw,
  ChevronRight,
  AlertCircle,
  DollarSign,
  BarChart3,
  Clock,
} from 'lucide-react-native';
import { Text } from '@/components/atoms/Text';
import { LoadingSpinner } from '@/components/molecules/LoadingSpinner';
import { AIInsightCard } from '@/components/organisms/AIInsightCard';
import { ROIMetricTile } from '@/components/molecules/ROIMetricTile';
import { BreakevenProgress } from '@/components/molecules/BreakevenProgress';
import {
  useBusinessROIStore,
  useThemeStore,
  selectThemeMode,
} from '@/store';
import { useAppTheme } from '@/core/theme';
import { theme as staticTheme } from '@/core/theme';
import type { ROIRiskLevel } from '@/types/roi.types';

// ─── Color tokens ─────────────────────────────────────────────────────────────

const DARK_CARD_BG      = '#151A27';
const DARK_ROOT_BG      = '#0F0F14';
const DARK_SURFACE      = '#1E2435';
const DARK_BORDER       = 'rgba(255,255,255,0.08)';
const DARK_TEXT         = '#F1F5F9';
const DARK_TEXT_SEC     = '#94A3B8';
const DARK_INPUT_BG     = '#1E2435';
const DARK_INPUT_BORDER = 'rgba(255,255,255,0.12)';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const IS_TABLET = SCREEN_WIDTH >= 768;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatCurrency(value: number): string {
  if (!isFinite(value)) return '—';
  return `₱${value.toLocaleString('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatUnits(value: number): string {
  if (!isFinite(value) || value <= 0) return '—';
  return `${Math.ceil(value).toLocaleString()} units`;
}

function formatTime(months: number): string {
  if (!isFinite(months) || months <= 0) return '—';
  if (months < 1) return `${Math.ceil(months * 30)} days`;
  const m = Math.ceil(months);
  return `${m} month${m !== 1 ? 's' : ''}`;
}

function formatPercent(value: number): string {
  if (!isFinite(value)) return '—';
  return `${value.toFixed(1)}%`;
}

function formatLastRefreshed(iso: string | null): string {
  if (iso === null) return 'Never refreshed';
  const d = new Date(iso);
  return `Updated ${d.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' })}`;
}

// ─── Section card ─────────────────────────────────────────────────────────────

interface SectionCardProps {
  title:        string;
  icon:         React.ReactNode;
  iconColor:    string;
  isDark:       boolean;
  children:     React.ReactNode;
  collapsible?: boolean;
}

const SectionCard: React.FC<SectionCardProps> = ({
  title,
  icon,
  iconColor,
  isDark,
  children,
  collapsible = false,
}) => {
  const [expanded, setExpanded] = useState(true);
  const rotateAnim = useRef(new Animated.Value(1)).current;

  const toggle = useCallback(() => {
    if (!collapsible) return;
    const next = !expanded;
    setExpanded(next);
    Animated.timing(rotateAnim, {
      toValue:         next ? 1 : 0,
      duration:        200,
      useNativeDriver: true,
    }).start();
  }, [expanded, collapsible, rotateAnim]);

  const rotate  = rotateAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '90deg'] });
  const cardBg  = isDark ? DARK_CARD_BG : '#FFFFFF';
  const border  = isDark ? DARK_BORDER  : staticTheme.colors.borderSubtle;

  return (
    <View style={[scStyles.card, { backgroundColor: cardBg, borderColor: border }]}>
      <Pressable
        style={scStyles.header}
        onPress={toggle}
        {...(collapsible ? {} : { disabled: true })}
      >
        <View style={[scStyles.iconPill, { backgroundColor: `${iconColor}1A` }]}>
          {icon}
        </View>
        <Text
          variant="h6"
          weight="semibold"
          style={{ flex: 1, marginLeft: 10, color: isDark ? DARK_TEXT : staticTheme.colors.text }}
        >
          {title}
        </Text>
        {collapsible && (
          <Animated.View style={{ transform: [{ rotate }] }}>
            <ChevronRight size={18} color={isDark ? DARK_TEXT_SEC : staticTheme.colors.textSecondary} />
          </Animated.View>
        )}
      </Pressable>
      {expanded && <View style={scStyles.body}>{children}</View>}
    </View>
  );
};

const scStyles = StyleSheet.create({
  card: {
    borderRadius:  16,
    borderWidth:   1,
    marginBottom:  12,
    overflow:      'hidden',
    shadowColor:   '#1E4D8C',
    shadowOffset:  { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius:  8,
    elevation:     3,
  },
  header: {
    flexDirection:     'row',
    alignItems:        'center',
    paddingHorizontal: 16,
    paddingVertical:   14,
  },
  iconPill: {
    width:          36,
    height:         36,
    borderRadius:   10,
    alignItems:     'center',
    justifyContent: 'center',
  },
  body: {
    paddingHorizontal: 16,
    paddingBottom:     16,
  },
});

// ─── Snapshot pill ────────────────────────────────────────────────────────────

interface SnapshotPillProps {
  label:     string;
  value:     string;
  color:     string;
  isDark:    boolean;
}

const SnapshotPill: React.FC<SnapshotPillProps> = ({ label, value, color, isDark }) => {
  const bg     = isDark ? DARK_SURFACE : `${color}0D`;
  const border = isDark ? DARK_BORDER  : `${color}30`;
  return (
    <View style={[pillStyles.pill, { backgroundColor: bg, borderColor: border }]}>
      <Text variant="body-xs" style={{ color: isDark ? DARK_TEXT_SEC : staticTheme.colors.textSecondary, marginBottom: 2 }}>
        {label}
      </Text>
      <Text variant="body-sm" weight="bold" style={{ color }} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
        {value}
      </Text>
    </View>
  );
};

const pillStyles = StyleSheet.create({
  pill: {
    flex:              1,
    borderRadius:      12,
    borderWidth:       1,
    paddingVertical:   10,
    paddingHorizontal: 12,
    alignItems:        'center',
    minWidth:          90,
  },
});

// ─── Product analysis card ─────────────────────────────────────────────────────

interface ProductCardProps {
  name:            string;
  unitsSold:       number;
  cmPerUnit:       number;
  totalUnitsNeeded: number;
  isDark:          boolean;
  accentColor:     string;
  rank:            number;
}

const ProductCard: React.FC<ProductCardProps> = ({
  name,
  unitsSold,
  cmPerUnit,
  totalUnitsNeeded,
  isDark,
  accentColor,
  rank,
}) => {
  const bg     = isDark ? DARK_SURFACE : '#F8FAFF';
  const border = isDark ? DARK_BORDER  : staticTheme.colors.borderSubtle;
  const ratio  = totalUnitsNeeded > 0 ? Math.min(unitsSold / totalUnitsNeeded, 1) : 0;
  const pct    = Math.round(ratio * 100);

  const fillAnim = useRef(new Animated.Value(0)).current;
  React.useEffect(() => {
    Animated.timing(fillAnim, {
      toValue:         ratio,
      duration:        700,
      delay:           rank * 120,
      useNativeDriver: false,
    }).start();
  }, [fillAnim, ratio, rank]);

  const trackBg   = isDark ? 'rgba(255,255,255,0.08)' : staticTheme.colors.gray[200];
  const fillColor = ratio >= 1 ? '#3DD68C' : ratio >= 0.5 ? '#FFB020' : accentColor;

  return (
    <View style={[prodStyles.card, { backgroundColor: bg, borderColor: border }]}>
      <View style={prodStyles.header}>
        <View style={[prodStyles.rankBadge, { backgroundColor: `${accentColor}20` }]}>
          <Text variant="body-xs" weight="bold" style={{ color: accentColor }}>#{rank}</Text>
        </View>
        <Text variant="body-sm" weight="semibold" style={{ flex: 1, color: isDark ? DARK_TEXT : staticTheme.colors.text, marginLeft: 8 }} numberOfLines={1}>
          {name}
        </Text>
        <View style={[prodStyles.pctBadge, { backgroundColor: `${fillColor}1A` }]}>
          <Text variant="body-xs" weight="bold" style={{ color: fillColor }}>{pct}%</Text>
        </View>
      </View>

      <View style={[prodStyles.track, { backgroundColor: trackBg }]}>
        <Animated.View
          style={[
            prodStyles.fill,
            {
              backgroundColor: fillColor,
              width: fillAnim.interpolate({
                inputRange:  [0, 1],
                outputRange: ['0%', '100%'],
              }) as unknown as `${number}%`,
            },
          ]}
        />
      </View>

      <View style={prodStyles.statsRow}>
        <View style={prodStyles.stat}>
          <Text variant="body-xs" style={{ color: isDark ? DARK_TEXT_SEC : staticTheme.colors.textSecondary }}>Units Sold</Text>
          <Text variant="body-sm" weight="semibold" style={{ color: isDark ? DARK_TEXT : staticTheme.colors.text }}>
            {unitsSold.toLocaleString()}
          </Text>
        </View>
        <View style={prodStyles.divider} />
        <View style={prodStyles.stat}>
          <Text variant="body-xs" style={{ color: isDark ? DARK_TEXT_SEC : staticTheme.colors.textSecondary }}>CM / Unit</Text>
          <Text variant="body-sm" weight="semibold" style={{ color: cmPerUnit > 0 ? '#3DD68C' : '#FF6B6B' }}>
            {cmPerUnit > 0 ? formatCurrency(cmPerUnit) : '—'}
          </Text>
        </View>
        <View style={prodStyles.divider} />
        <View style={prodStyles.stat}>
          <Text variant="body-xs" style={{ color: isDark ? DARK_TEXT_SEC : staticTheme.colors.textSecondary }}>of Target</Text>
          <Text variant="body-sm" weight="semibold" style={{ color: isDark ? DARK_TEXT : staticTheme.colors.text }}>
            {totalUnitsNeeded > 0 ? formatUnits(totalUnitsNeeded) : '—'}
          </Text>
        </View>
      </View>
    </View>
  );
};

const prodStyles = StyleSheet.create({
  card: {
    borderRadius:  12,
    borderWidth:   1,
    padding:       12,
    marginBottom:  10,
  },
  header: {
    flexDirection:  'row',
    alignItems:     'center',
    marginBottom:   10,
  },
  rankBadge: {
    width:          24,
    height:         24,
    borderRadius:    6,
    alignItems:     'center',
    justifyContent: 'center',
  },
  pctBadge: {
    paddingVertical:   2,
    paddingHorizontal: 7,
    borderRadius:     20,
  },
  track: {
    height:       8,
    borderRadius: 4,
    overflow:     'hidden',
    marginBottom: 10,
  },
  fill: {
    height:       8,
    borderRadius: 4,
  },
  statsRow: {
    flexDirection:  'row',
    alignItems:     'center',
  },
  stat: {
    flex:       1,
    alignItems: 'center',
    gap:        2,
  },
  divider: {
    width:        1,
    height:       28,
    backgroundColor: 'rgba(148,163,184,0.2)',
    marginHorizontal: 4,
  },
});

// ─── Sales target input ───────────────────────────────────────────────────────

interface SalesTargetInputProps {
  label:    string;
  value:    string;
  onChange: (v: string) => void;
  isDark:   boolean;
  helperText?: string;
  suffix?: string;
  keyboardType?: 'numeric' | 'decimal-pad';
}

const SalesTargetInput: React.FC<SalesTargetInputProps> = ({
  label,
  value,
  onChange,
  isDark,
  helperText,
  suffix = 'units/mo',
  keyboardType = 'numeric',
}) => {
  const inputBg     = isDark ? DARK_INPUT_BG     : '#F8F9FC';
  const inputBorder = isDark ? DARK_INPUT_BORDER  : '#E2E8F0';
  const textColor   = isDark ? 'rgba(255,255,255,0.90)' : staticTheme.colors.gray[900];
  const labelColor  = isDark ? 'rgba(255,255,255,0.60)' : staticTheme.colors.gray[700];
  const helperColor = isDark ? 'rgba(255,255,255,0.40)' : staticTheme.colors.gray[500];

  return (
    <View style={{ marginBottom: 12 }}>
      <Text variant="body-sm" weight="medium" style={{ color: labelColor, marginBottom: 6 }}>
        {label}
      </Text>
      <View style={[stInput.row, { backgroundColor: inputBg, borderColor: inputBorder }]}>
        <RNTextInput
          style={[stInput.input, { color: textColor }]}
          value={value}
          onChangeText={onChange}
          keyboardType={keyboardType}
          placeholder="0"
          placeholderTextColor={isDark ? 'rgba(255,255,255,0.25)' : staticTheme.colors.gray[400]}
        />
        <View style={[stInput.unitLabel, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : staticTheme.colors.gray[100] }]}>
          <Text variant="body-sm" weight="semibold" style={{ color: isDark ? 'rgba(255,255,255,0.50)' : staticTheme.colors.gray[500] }}>
            {suffix}
          </Text>
        </View>
      </View>
      {helperText !== undefined && (
        <Text variant="body-xs" style={{ color: helperColor, marginTop: 3 }}>
          {helperText}
        </Text>
      )}
    </View>
  );
};

const stInput = StyleSheet.create({
  row: {
    flexDirection:  'row',
    alignItems:     'center',
    borderRadius:   10,
    borderWidth:    1,
    overflow:       'hidden',
    height:         48,
  },
  input: {
    flex:         1,
    height:       '100%',
    fontSize:     15,
    paddingHorizontal: 14,
  },
  unitLabel: {
    paddingHorizontal: 12,
    height:           '100%',
    alignItems:       'center',
    justifyContent:   'center',
  },
});

// ─── Insight generator ────────────────────────────────────────────────────────

function generateBreakevenInsight(
  netProfit:          number,
  grossMarginPercent: number,
  totalUnitsNeeded:   number,
  monthlySalesPace:   number,
  timeMonths:         number,
  unitsStillNeeded:   number,
): { text: string; riskLevel: ROIRiskLevel } {
  if (netProfit < 0 && !isFinite(timeMonths)) {
    return {
      text: `Your business is currently running at a net loss of ${formatCurrency(Math.abs(netProfit))} and your monthly sales pace is too low to calculate a recovery timeline. Prioritise increasing your monthly unit volume or reducing fixed overhead costs to establish a clear path to breakeven.`,
      riskLevel: 'high',
    };
  }

  if (grossMarginPercent < 20) {
    return {
      text: `Your gross margin of ${formatPercent(grossMarginPercent)} is critically low — the SME benchmark for food and retail is 30–50%. With margins this thin, each unit sold contributes very little toward covering fixed costs. Review your selling prices or negotiate lower material costs before targeting higher sales volume.`,
      riskLevel: 'high',
    };
  }

  if (unitsStillNeeded <= 0 && netProfit >= 0) {
    return {
      text: `Your business has passed its break-even point with a gross margin of ${formatPercent(grossMarginPercent)}. Every additional unit sold now generates net profit. Maintain pricing discipline and watch for cost creep in overhead and utilities to protect your margin.`,
      riskLevel: 'low',
    };
  }

  if (isFinite(timeMonths) && monthlySalesPace > 0 && totalUnitsNeeded <= monthlySalesPace * 3) {
    return {
      text: `Strong momentum — at your current pace of ${monthlySalesPace.toLocaleString()} units/month you will cover all costs and losses within ${formatTime(timeMonths)}. Keep your gross margin of ${formatPercent(grossMarginPercent)} stable and resist the urge to discount.`,
      riskLevel: 'low',
    };
  }

  if (isFinite(timeMonths) && timeMonths > 12) {
    return {
      text: `At your current pace of ${monthlySalesPace > 0 ? `${monthlySalesPace.toLocaleString()} units/month` : 'zero units/month'}, full recovery will take approximately ${formatTime(timeMonths)}. Consider whether your monthly fixed costs can be reduced, or whether a targeted price increase on your highest-margin products would meaningfully shorten that timeline.`,
      riskLevel: 'medium',
    };
  }

  const timeStr = isFinite(timeMonths) && monthlySalesPace > 0
    ? ` Estimated time to full recovery at current pace: ${formatTime(timeMonths)}.`
    : '';

  const risk: ROIRiskLevel = grossMarginPercent >= 35 && isFinite(timeMonths) && timeMonths <= 6 ? 'low' : 'medium';
  return {
    text: `You need ${formatUnits(totalUnitsNeeded)} more units to cover all costs and recover your net ${netProfit < 0 ? 'loss' : 'position'}.${timeStr} Your gross margin of ${formatPercent(grossMarginPercent)} is ${grossMarginPercent >= 30 ? 'healthy' : 'moderate'} — consistent monthly volume is the fastest lever available.`,
    riskLevel: risk,
  };
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function BreakevenScreen() {
  const mode      = useThemeStore(selectThemeMode);
  const isDark    = mode === 'dark';
  const appTheme  = useAppTheme();
  const insets    = useSafeAreaInsets();

  // ── Store selectors (each primitive individually — Zustand v5 rule) ─────
  const netProfit            = useBusinessROIStore(s => s.netProfit);
  const monthlyOverheadAvg   = useBusinessROIStore(s => s.monthlyOverheadAvg);
  const monthlyUtilitiesAvg  = useBusinessROIStore(s => s.monthlyUtilitiesAvg);
  const unitsSoldToDate      = useBusinessROIStore(s => s.unitsSoldToDate);
  const breakevenUnits       = useBusinessROIStore(s => s.breakevenUnits);
  const unitsStillNeeded     = useBusinessROIStore(s => s.unitsStillNeeded);
  const currentMonthlyUnitPace = useBusinessROIStore(s => s.currentMonthlyUnitPace);
  const totalRevenue         = useBusinessROIStore(s => s.totalRevenue);
  const totalCOGS            = useBusinessROIStore(s => s.totalCOGS);
  const grossMarginPercent   = useBusinessROIStore(s => s.grossMarginPercent);
  const productBreakdown     = useBusinessROIStore(s => s.productBreakdown);
  const aiInsight            = useBusinessROIStore(s => s.aiInsight);
  const isLoading            = useBusinessROIStore(s => s.isLoading);
  const lastRefreshed        = useBusinessROIStore(s => s.lastRefreshed);
  const { refreshBusinessROI } = useBusinessROIStore();

  // ── User inputs ──────────────────────────────────────────────────────────
  // Monthly sales target — pre-seeded from store pace; user may override.
  const [salesTargetStr, setSalesTargetStr] = useState(
    () => currentMonthlyUnitPace > 0 ? String(Math.round(currentMonthlyUnitPace)) : '',
  );
  // Fallback price/cost inputs — shown when no sales history to derive CM/unit.
  const [manualPriceStr, setManualPriceStr]   = useState('');
  const [manualVarCostStr, setManualVarCostStr] = useState('');

  // ── Refresh on focus ─────────────────────────────────────────────────────
  useFocusEffect(
    useCallback(() => {
      void refreshBusinessROI();
    }, [refreshBusinessROI]),
  );

  // ── Derived values ───────────────────────────────────────────────────────
  const derived = useMemo(() => {
    const netLoss           = Math.abs(Math.min(0, netProfit));
    const monthlyFixedCosts = monthlyOverheadAvg + monthlyUtilitiesAvg;

    // Contribution per unit — prefer real sales data; fall back to manual inputs.
    const grossProfit          = totalRevenue - totalCOGS;
    const storeContribPerUnit  = unitsSoldToDate > 0
      ? grossProfit / unitsSoldToDate
      : 0;

    const manualPrice   = parseFloat(manualPriceStr)   || 0;
    const manualVarCost = parseFloat(manualVarCostStr)  || 0;
    const manualCM      = manualPrice > manualVarCost ? manualPrice - manualVarCost : 0;

    // Use store CM when available; otherwise fall back to manual inputs.
    const contribPerUnit    = storeContribPerUnit > 0 ? storeContribPerUnit : manualCM;
    const usingManualCM     = storeContribPerUnit <= 0 && manualCM > 0;
    const missingCMData     = contribPerUnit <= 0 && netLoss > 0;

    // Recovery analysis
    const unitsToRecoverLoss = contribPerUnit > 0 && netLoss > 0
      ? netLoss / contribPerUnit
      : 0;

    const totalUnitsNeeded  = unitsStillNeeded + unitsToRecoverLoss;

    // Revenue target
    const avgSellingPrice   = unitsSoldToDate > 0
      ? totalRevenue / unitsSoldToDate
      : 0;
    const revenueTarget     = totalUnitsNeeded * avgSellingPrice;

    // Time simulation using user-provided target (falls back to current pace)
    const salesTarget       = Math.max(0, parseFloat(salesTargetStr) || 0);
    const effectivePace     = salesTarget > 0 ? salesTarget : currentMonthlyUnitPace;
    const timeMonths        = effectivePace > 0 && totalUnitsNeeded > 0
      ? totalUnitsNeeded / effectivePace
      : Infinity;
    const dailySalesNeeded  = isFinite(totalUnitsNeeded) && totalUnitsNeeded > 0
      ? totalUnitsNeeded / 30.44
      : Infinity;

    // Per-product contribution margin per unit
    const topProducts = productBreakdown.slice(0, 3).map(p => ({
      name:      p.name,
      unitsSold: p.unitsSold,
      cmPerUnit: p.unitsSold > 0 ? p.contributionMargin / p.unitsSold : 0,
    }));

    return {
      netLoss,
      monthlyFixedCosts,
      contribPerUnit,
      usingManualCM,
      missingCMData,
      unitsToRecoverLoss,
      totalUnitsNeeded,
      revenueTarget,
      salesTarget,
      effectivePace,
      timeMonths,
      dailySalesNeeded,
      topProducts,
    };
  }, [
    netProfit,
    monthlyOverheadAvg,
    monthlyUtilitiesAvg,
    totalRevenue,
    totalCOGS,
    unitsSoldToDate,
    unitsStillNeeded,
    currentMonthlyUnitPace,
    productBreakdown,
    salesTargetStr,
    manualPriceStr,
    manualVarCostStr,
  ]);

  // ── Local insight (breakeven-specific, supplements store aiInsight) ──────
  const localInsight = useMemo(
    () => generateBreakevenInsight(
      netProfit,
      grossMarginPercent,
      derived.totalUnitsNeeded,
      derived.effectivePace,
      derived.timeMonths,
      unitsStillNeeded,
    ),
    [netProfit, grossMarginPercent, derived.totalUnitsNeeded, derived.effectivePace, derived.timeMonths, unitsStillNeeded],
  );

  // ── Theme tokens ─────────────────────────────────────────────────────────
  const rootBg          = isDark ? DARK_ROOT_BG : appTheme.colors.background;
  const cardBg          = isDark ? DARK_CARD_BG : '#FFFFFF';
  const border          = isDark ? DARK_BORDER  : staticTheme.colors.borderSubtle;
  const textMain        = isDark ? DARK_TEXT     : appTheme.colors.text;
  const textSec         = isDark ? DARK_TEXT_SEC : appTheme.colors.textSecondary;
  const accentPrimary   = isDark ? '#4F9EFF'     : appTheme.colors.primary[500];
  const accentGreen     = isDark ? '#3DD68C'     : staticTheme.colors.success[500];
  const accentAmber     = isDark ? '#FFB020'     : staticTheme.colors.warning[500];
  const accentRed       = isDark ? '#FF6B6B'     : staticTheme.colors.error[500];
  const accentPurple    = '#A78BFA';

  const isProfit        = netProfit >= 0;
  const profitColor     = isProfit ? accentGreen : accentRed;
  const heroValid       = derived.totalUnitsNeeded > 0;
  const heroBg          = isDark ? '#1A2235' : `${accentPrimary}0D`;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <ScrollView
        style={{ flex: 1, backgroundColor: rootBg }}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: Math.max(insets.bottom + 24, 40) },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >

        {/* ── Header card ─────────────────────────────────────────────── */}
        <View style={[styles.headerCard, { backgroundColor: cardBg, borderColor: border }]}>
          <View style={styles.headerTopRow}>
            <View style={[styles.headerIconPill, { backgroundColor: `${accentPrimary}1A` }]}>
              <Target size={22} color={accentPrimary} />
            </View>
            <Pressable
              style={[styles.refreshBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : staticTheme.colors.gray[100], borderColor: border }]}
              onPress={() => { void refreshBusinessROI(); }}
              disabled={isLoading}
            >
              {isLoading
                ? <LoadingSpinner size="small" color={accentPrimary} variant="ring" />
                : <RefreshCw size={14} color={accentPrimary} />
              }
              <Text variant="body-xs" weight="semibold" style={{ color: accentPrimary, marginLeft: 5 }}>
                {isLoading ? 'Refreshing…' : 'Refresh'}
              </Text>
            </Pressable>
          </View>

          <Text variant="h4" weight="bold" style={{ color: textMain, marginTop: 12, marginBottom: 4 }}>
            Break-Even Analysis
          </Text>
          <Text variant="body-sm" style={{ color: textSec, textAlign: 'center', lineHeight: 20 }}>
            How many units must you sell to stop losing money?
          </Text>

          <Text variant="body-xs" style={{ color: textSec, marginTop: 8 }}>
            {formatLastRefreshed(lastRefreshed)}
          </Text>
        </View>

        {/* ── Section 1: Business Snapshot ────────────────────────────── */}
        <SectionCard
          title="Business Snapshot"
          icon={<BarChart3 size={18} color={accentPrimary} />}
          iconColor={accentPrimary}
          isDark={isDark}
        >
          <Text variant="body-xs" style={{ color: textSec, marginBottom: 10, lineHeight: 18 }}>
            Live data from your stores — not editable here.
          </Text>
          <View style={styles.pillRow}>
            <SnapshotPill
              label="Net Profit / Loss"
              value={isProfit
                ? `+${formatCurrency(netProfit)}`
                : `-${formatCurrency(derived.netLoss)}`
              }
              color={profitColor}
              isDark={isDark}
            />
            <SnapshotPill
              label="Monthly Fixed Costs"
              value={formatCurrency(derived.monthlyFixedCosts)}
              color={accentAmber}
              isDark={isDark}
            />
            <SnapshotPill
              label="Sales Pace"
              value={currentMonthlyUnitPace > 0
                ? `${Math.round(currentMonthlyUnitPace).toLocaleString()} u/mo`
                : '—'
              }
              color={accentPrimary}
              isDark={isDark}
            />
          </View>

          {/* Blended contribution margin row */}
          <View style={[styles.cmRow, { backgroundColor: isDark ? DARK_SURFACE : `${accentGreen}08`, borderColor: isDark ? 'rgba(61,214,140,0.15)' : `${accentGreen}30` }]}>
            <DollarSign size={14} color={accentGreen} />
            <Text variant="body-xs" style={{ color: textSec, marginLeft: 6 }}>
              Blended contribution margin:
              <Text variant="body-xs" weight="bold" style={{ color: accentGreen }}>
                {' '}{derived.contribPerUnit > 0 ? formatCurrency(derived.contribPerUnit) : '—'} / unit
              </Text>
            </Text>
            <Text variant="body-xs" style={{ color: textSec, marginLeft: 4 }}>
              · Gross margin:
              <Text variant="body-xs" weight="bold" style={{ color: grossMarginPercent >= 30 ? accentGreen : grossMarginPercent >= 20 ? accentAmber : accentRed }}>
                {' '}{formatPercent(grossMarginPercent)}
              </Text>
            </Text>
          </View>
        </SectionCard>

        {/* ── Section 2: Per-Product Analysis ─────────────────────────── */}
        {derived.topProducts.length > 0 && (
          <SectionCard
            title="Top Products"
            icon={<Package size={18} color={accentPurple} />}
            iconColor={accentPurple}
            isDark={isDark}
            collapsible
          >
            <Text variant="body-xs" style={{ color: textSec, marginBottom: 12, lineHeight: 18 }}>
              Contribution margin per unit and recovery progress for your top {derived.topProducts.length} products.
            </Text>
            {derived.topProducts.map((p, i) => (
              <ProductCard
                key={p.name}
                name={p.name}
                unitsSold={p.unitsSold}
                cmPerUnit={p.cmPerUnit}
                totalUnitsNeeded={derived.totalUnitsNeeded}
                isDark={isDark}
                accentColor={accentPurple}
                rank={i + 1}
              />
            ))}
            {derived.topProducts.length === 0 && (
              <View style={styles.emptyState}>
                <AlertCircle size={18} color={textSec} />
                <Text variant="body-sm" style={{ color: textSec, marginTop: 6 }}>No sales data yet.</Text>
              </View>
            )}
          </SectionCard>
        )}

        {/* ── Section 3: Overall Break-Even Status ────────────────────── */}
        <SectionCard
          title="What You Still Need"
          icon={<TrendingUp size={18} color={accentGreen} />}
          iconColor={accentGreen}
          isDark={isDark}
        >
          {/* Hero total units needed */}
          <View style={[styles.heroCard, { backgroundColor: heroBg, borderColor: accentPrimary }]}>
            <View style={styles.heroTopRow}>
              <Text variant="body-xs" weight="semibold" style={{ color: textSec, letterSpacing: 0.8 }}>
                TOTAL UNITS TO FULL RECOVERY
              </Text>
              <View style={[styles.heroDot, { backgroundColor: accentPrimary }]} />
            </View>
            <Text
              variant="h2"
              weight="bold"
              style={{ color: heroValid ? accentPrimary : textSec, letterSpacing: -1, marginTop: 4 }}
              adjustsFontSizeToFit
              minimumFontScale={0.7}
              numberOfLines={1}
            >
              {heroValid ? Math.ceil(derived.totalUnitsNeeded).toLocaleString() : '—'}
            </Text>
            <Text variant="body-sm" style={{ color: textSec, marginTop: 2 }}>
              units to cover fixed costs{derived.netLoss > 0 ? ' and recover net loss' : ''}
            </Text>
            {heroValid && (
              <View style={[styles.heroSubRow, { borderTopColor: isDark ? 'rgba(255,255,255,0.08)' : `${accentPrimary}20` }]}>
                <Text variant="body-xs" style={{ color: textSec }}>
                  Revenue target:{' '}
                  <Text variant="body-xs" weight="semibold" style={{ color: textMain }}>
                    {formatCurrency(derived.revenueTarget)}
                  </Text>
                </Text>
              </View>
            )}
          </View>

          {/* Fallback inputs when no sales history to derive CM/unit */}
          {derived.netLoss > 0 && derived.missingCMData && (
            <View style={[styles.warningBox, { backgroundColor: isDark ? 'rgba(255,107,107,0.10)' : '#FFF5F5', borderColor: accentRed }]}>
              <AlertCircle size={14} color={accentRed} />
              <Text variant="body-xs" style={{ color: accentRed, flex: 1, marginLeft: 6, lineHeight: 18 }}>
                No sales history found — can't compute recovery units automatically.
                Enter your selling price and variable cost below to calculate how many units cover the ₱{Math.round(derived.netLoss).toLocaleString()} loss.
              </Text>
            </View>
          )}
          {derived.netLoss > 0 && (derived.missingCMData || derived.usingManualCM) && (
            <View style={{ gap: 8, marginBottom: 12 }}>
              <SalesTargetInput
                label="Selling Price / Unit"
                value={manualPriceStr}
                onChange={setManualPriceStr}
                isDark={isDark}
                helperText="What you charge customers per unit"
                suffix="₱ / unit"
                keyboardType="decimal-pad"
              />
              <SalesTargetInput
                label="Variable Cost / Unit"
                value={manualVarCostStr}
                onChange={setManualVarCostStr}
                isDark={isDark}
                helperText="Materials + labor cost per unit"
                suffix="₱ / unit"
                keyboardType="decimal-pad"
              />
              {derived.usingManualCM && (
                <Text variant="body-xs" style={{ color: accentAmber }}>
                  Using manual CM of {formatCurrency(derived.contribPerUnit)}/unit (no real sales data yet)
                </Text>
              )}
            </View>
          )}

          {/* Metric grid */}
          <View style={[styles.metricsGrid, IS_TABLET && styles.metricsGridTablet]}>
            <ROIMetricTile
              label="Still to Break Even"
              value={formatUnits(unitsStillNeeded)}
              subValue="from store data"
              {...(unitsStillNeeded <= 0 ? { trend: 'up' as const } : {})}
              color={unitsStillNeeded <= 0 ? accentGreen : accentAmber}
              style={styles.metricTile}
            />
            {derived.netLoss > 0 && (
              <ROIMetricTile
                label="To Recover Net Loss"
                value={derived.missingCMData ? 'Enter price↑' : formatUnits(derived.unitsToRecoverLoss)}
                subValue={formatCurrency(derived.netLoss)}
                color={accentRed}
                style={styles.metricTile}
              />
            )}
            <ROIMetricTile
              label="Breakeven Units"
              value={formatUnits(breakevenUnits)}
              subValue="fixed costs / CM"
              color={accentPrimary}
              style={styles.metricTile}
            />
            <ROIMetricTile
              label="Gross Margin"
              value={formatPercent(grossMarginPercent)}
              subValue={grossMarginPercent >= 30 ? 'Healthy' : grossMarginPercent >= 20 ? 'Moderate' : 'Low'}
              {...(grossMarginPercent >= 30 ? { trend: 'up' as const } : grossMarginPercent >= 20 ? { trend: 'neutral' as const } : { trend: 'down' as const })}
              color={grossMarginPercent >= 30 ? accentGreen : grossMarginPercent >= 20 ? accentAmber : accentRed}
              style={styles.metricTile}
            />
          </View>
        </SectionCard>

        {/* ── Section 4: Time to Recovery ─────────────────────────────── */}
        <SectionCard
          title="Time to Recovery"
          icon={<Clock size={18} color={accentAmber} />}
          iconColor={accentAmber}
          isDark={isDark}
        >
          <SalesTargetInput
            label="Monthly Sales Target (units)"
            value={salesTargetStr}
            onChange={setSalesTargetStr}
            isDark={isDark}
            helperText={currentMonthlyUnitPace > 0
              ? `Your current pace is ~${Math.round(currentMonthlyUnitPace).toLocaleString()} units/mo`
              : 'Enter your target monthly volume to simulate recovery time'
            }
          />

          <View style={[styles.recoveryGrid, IS_TABLET && styles.metricsGridTablet]}>
            <ROIMetricTile
              label="Estimated Time"
              value={formatTime(derived.timeMonths)}
              {...(isFinite(derived.timeMonths) && derived.effectivePace > 0
                ? { subValue: `at ${derived.effectivePace.toLocaleString()} units/mo` }
                : {})}
              color={
                !isFinite(derived.timeMonths)      ? textSec :
                derived.timeMonths <= 3            ? accentGreen :
                derived.timeMonths <= 6            ? accentAmber :
                accentRed
              }
              style={styles.metricTile}
            />
            <ROIMetricTile
              label="Required Daily Sales"
              value={isFinite(derived.dailySalesNeeded) && derived.dailySalesNeeded > 0
                ? `${Math.ceil(derived.dailySalesNeeded).toLocaleString()} units`
                : '—'
              }
              subValue="to recover in 30 days"
              color={accentPrimary}
              style={styles.metricTile}
            />
          </View>

          {!isFinite(derived.timeMonths) && derived.totalUnitsNeeded > 0 && (
            <View style={[styles.warningBanner, { backgroundColor: isDark ? 'rgba(255,176,32,0.10)' : '#FEF7E8', borderColor: isDark ? 'rgba(255,176,32,0.25)' : '#F5A623' }]}>
              <AlertCircle size={13} color={accentAmber} />
              <Text variant="body-xs" weight="medium" style={{ color: accentAmber, marginLeft: 6, flex: 1 }}>
                Set a monthly sales target above to calculate your estimated recovery time.
              </Text>
            </View>
          )}
        </SectionCard>

        {/* ── Section 5: Progress bar ──────────────────────────────────── */}
        <SectionCard
          title="Recovery Progress"
          icon={<Target size={18} color={accentPrimary} />}
          iconColor={accentPrimary}
          isDark={isDark}
        >
          <BreakevenProgress
            unitsSold={unitsSoldToDate}
            breakevenUnits={heroValid ? Math.ceil(derived.totalUnitsNeeded) : Math.max(1, breakevenUnits)}
            label="Units sold vs total units needed"
          />
        </SectionCard>

        {/* ── Section 6: AI Insight ────────────────────────────────────── */}
        {/* Use local breakeven-specific insight; fall back to store insight if blank */}
        <AIInsightCard
          insight={localInsight.text.length > 0 ? localInsight.text : aiInsight}
          riskLevel={localInsight.riskLevel}
          isLoading={isLoading}
        />

        <View style={{ height: Math.max(insets.bottom, 16) }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop:        12,
  },

  // Header card
  headerCard: {
    borderRadius:      16,
    borderWidth:       1,
    alignItems:        'center',
    paddingHorizontal: 20,
    paddingTop:        20,
    paddingBottom:     20,
    marginBottom:      12,
    shadowColor:       '#1E4D8C',
    shadowOffset:      { width: 0, height: 2 },
    shadowOpacity:     0.06,
    shadowRadius:      8,
    elevation:         3,
  },
  headerTopRow: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
    width:          '100%',
  },
  headerIconPill: {
    width:          48,
    height:         48,
    borderRadius:   14,
    alignItems:     'center',
    justifyContent: 'center',
  },
  refreshBtn: {
    flexDirection:     'row',
    alignItems:        'center',
    paddingVertical:    7,
    paddingHorizontal: 12,
    borderRadius:      20,
    borderWidth:       1,
  },

  // Snapshot section
  pillRow: {
    flexDirection: 'row',
    gap:           8,
    marginBottom:  10,
  },
  cmRow: {
    flexDirection:     'row',
    alignItems:        'center',
    paddingVertical:    8,
    paddingHorizontal: 12,
    borderRadius:      10,
    borderWidth:       1,
    flexWrap:          'wrap',
    gap:               2,
  },

  // Hero card
  heroCard: {
    borderRadius:  12,
    borderWidth:   1.5,
    padding:       16,
    marginBottom:  14,
  },
  heroTopRow: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
  },
  heroDot: {
    width:        8,
    height:       8,
    borderRadius: 4,
  },
  heroSubRow: {
    marginTop:      10,
    paddingTop:     10,
    borderTopWidth: 1,
  },

  // Warning box
  warningBox: {
    flexDirection:  'row',
    alignItems:     'flex-start',
    borderRadius:   10,
    borderWidth:    1,
    padding:        10,
    marginBottom:   12,
    gap:            6,
  },

  // Metric grids
  metricsGrid: {
    flexDirection: 'row',
    flexWrap:      'wrap',
    gap:           8,
  },
  metricsGridTablet: {
    gap: 12,
  },
  recoveryGrid: {
    flexDirection: 'row',
    flexWrap:      'wrap',
    gap:           8,
    marginTop:     4,
  },
  metricTile: {
    width:   IS_TABLET ? '31%' : '47.5%',
    flexGrow: 1,
  },

  // Warning banner
  warningBanner: {
    flexDirection:     'row',
    alignItems:        'center',
    marginTop:         10,
    paddingHorizontal: 12,
    paddingVertical:    9,
    borderRadius:      10,
    borderWidth:       1,
  },

  // Empty state
  emptyState: {
    alignItems:  'center',
    paddingVertical: 24,
  },
});
