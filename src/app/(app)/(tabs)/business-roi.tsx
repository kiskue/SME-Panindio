/**
 * BusinessROIScreen — business-roi.tsx
 *
 * Auto-computed Business ROI Overview — aggregates real data from inventory,
 * overhead, utilities, and POS sales to show the actual state of the business.
 * No manual inputs required.
 *
 * Sections (ScrollView):
 *   1. Header card          — title + last-refreshed + Refresh button
 *   2. ROI Hero tile        — large ROI% with colour coding + animated ring
 *   3. Investment Breakdown — 2×2 grid of cost tiles + Total row
 *   4. Revenue & Profit     — 3 tiles: Revenue / COGS / Net Profit
 *   5. AI Insight Card      — reuses AIInsightCard organism
 *   6. Breakeven Progress   — BreakevenProgress molecule
 *   7. Product ROI Breakdown — top 3 products
 *   8. Payback Timeline     — horizontal progress bar
 *   9. Monthly Burn Rate    — traffic-light card
 *
 * Data: useBusinessROIStore — computeBusinessROI() on mount, refreshBusinessROI()
 *       on pull-to-refresh and useFocusEffect.
 *
 * TypeScript constraints honoured:
 *   - exactOptionalPropertyTypes: no `prop: undefined`, conditional spread
 *   - noUncheckedIndexedAccess: ?? fallbacks on all array/object access
 *   - noUnusedLocals/Parameters: unused vars prefixed with _
 */

import React, {
  useCallback,
  useEffect,
  useRef,
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import {
  TrendingUp,
  TrendingDown,
  RefreshCw,
  DollarSign,
  Package,
  Building2,
  Zap,
  Activity,
  Clock,
  Flame,
} from 'lucide-react-native';
import { Text } from '@/components/atoms/Text';
import { AIInsightCard } from '@/components/organisms/AIInsightCard';
import { ROIMetricTile } from '@/components/molecules/ROIMetricTile';
import { BreakevenProgress } from '@/components/molecules/BreakevenProgress';
import {
  useBusinessROIStore,
  selectBusinessROILoading,
  selectBusinessROIPercent,
  selectBusinessROIInsight,
  selectBusinessROIRiskLevel,
  selectBusinessROILastRefreshed,
  selectBusinessROIError,
} from '@/store';
import { useThemeStore, selectThemeMode } from '@/store';
import { useAppTheme } from '@/core/theme';
import { theme as staticTheme } from '@/core/theme';
import type { ProductROIBreakdown } from '@/types/business_roi.types';

// ─── Color tokens ─────────────────────────────────────────────────────────────

const DARK_CARD_BG  = '#151A27';
const DARK_ROOT_BG  = '#0F0F14';
const DARK_SURFACE  = '#1E2435';
const DARK_BORDER   = 'rgba(255,255,255,0.08)';
const DARK_TEXT     = '#F1F5F9';
const DARK_TEXT_SEC = '#94A3B8';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const IS_TABLET = SCREEN_WIDTH >= 768;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatCurrency(value: number): string {
  return `₱${Math.abs(value).toLocaleString('en-PH', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;
}

function formatROI(value: number): string {
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(1)}%`;
}

function formatTimestamp(iso: string | null): string {
  if (iso === null) return 'Never refreshed';
  const d = new Date(iso);
  return d.toLocaleString('en-PH', {
    month:  'short',
    day:    'numeric',
    hour:   'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

function roiHealthColor(roiPercent: number, isDark: boolean): string {
  if (roiPercent >= 20) return isDark ? '#3DD68C' : staticTheme.colors.success[500];
  if (roiPercent >= 10) return isDark ? '#FFB020' : staticTheme.colors.warning[500];
  return isDark ? '#FF6B6B' : staticTheme.colors.error[500];
}

function burnRateTrafficLight(burnRate: number, revenue: number, isDark: boolean): string {
  if (revenue === 0) return isDark ? '#94A3B8' : staticTheme.colors.gray[400];
  const ratio = burnRate / revenue;
  if (ratio > 0.8) return isDark ? '#FF6B6B' : staticTheme.colors.error[500];
  if (ratio > 0.5) return isDark ? '#FFB020' : staticTheme.colors.warning[500];
  return isDark ? '#3DD68C' : staticTheme.colors.success[500];
}

// ─── Animated ROI ring ────────────────────────────────────────────────────────

interface ROIRingProps {
  roiPercent: number;
  isDark:     boolean;
  color:      string;
}

const ROIRing: React.FC<ROIRingProps> = ({ roiPercent, isDark, color }) => {
  const ringAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.85)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(ringAnim, {
        toValue:         1,
        duration:        900,
        useNativeDriver: true,
        delay:            200,
      }),
      Animated.spring(scaleAnim, {
        toValue:         1,
        friction:        6,
        tension:         40,
        useNativeDriver: true,
        delay:            150,
      }),
    ]).start();
  }, [ringAnim, scaleAnim]);

  const ringBg   = isDark ? DARK_SURFACE : staticTheme.colors.gray[100];
  const labelBg  = isDark ? DARK_CARD_BG : '#FFFFFF';
  const textMain = isDark ? DARK_TEXT     : staticTheme.colors.text;
  const textSec  = isDark ? DARK_TEXT_SEC : staticTheme.colors.textSecondary;

  return (
    <Animated.View
      style={[
        styles.roiRingOuter,
        {
          backgroundColor: ringBg,
          borderColor:     color,
          opacity:         ringAnim,
          transform:       [{ scale: scaleAnim }],
        },
      ]}
    >
      <View style={[styles.roiRingInner, { backgroundColor: labelBg }]}>
        {/* Glow dot */}
        <View style={[styles.roiGlowDot, { backgroundColor: color }]} />

        <Text
          variant="h2"
          weight="bold"
          style={{ color, letterSpacing: -1 }}
        >
          {formatROI(roiPercent)}
        </Text>
        <Text
          variant="body-xs"
          weight="medium"
          style={{ color: textSec, marginTop: 2 }}
        >
          Business ROI
        </Text>
        <Text
          variant="body-xs"
          weight="normal"
          style={{ color: textMain, marginTop: 4 }}
        >
          {roiPercent >= 20 ? 'Healthy return' :
           roiPercent >= 10 ? 'Moderate return' :
           'Needs improvement'}
        </Text>
      </View>
    </Animated.View>
  );
};

// ─── Skeleton ─────────────────────────────────────────────────────────────────

interface SkeletonProps {
  width:   number | `${number}%`;
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

// ─── Section header ───────────────────────────────────────────────────────────

interface SectionHeaderProps {
  title:   string;
  icon:    React.ReactNode;
  color:   string;
  isDark:  boolean;
}

const SectionHeader: React.FC<SectionHeaderProps> = ({ title, icon, color, isDark }) => {
  const textMain = isDark ? DARK_TEXT : staticTheme.colors.text;

  return (
    <View style={styles.sectionHeader}>
      <View style={[styles.sectionIconPill, { backgroundColor: `${color}1A` }]}>
        {icon}
      </View>
      <Text variant="h6" weight="semibold" style={{ color: textMain, marginLeft: 8 }}>
        {title}
      </Text>
    </View>
  );
};

// ─── Product card ─────────────────────────────────────────────────────────────

interface ProductRowProps {
  rank:       number;
  product:    ProductROIBreakdown;
  maxRevenue: number;
  isDark:     boolean;
}

const ProductRow: React.FC<ProductRowProps> = ({ rank, product, maxRevenue, isDark }) => {
  const cardBg    = isDark ? DARK_CARD_BG : '#FFFFFF';
  const border    = isDark ? DARK_BORDER  : staticTheme.colors.border;
  const textMain  = isDark ? DARK_TEXT    : staticTheme.colors.text;
  const textSec   = isDark ? DARK_TEXT_SEC : staticTheme.colors.textSecondary;

  const rankColors = ['#FFB020', '#94A3B8', '#CD7F32'] as const;
  const rankColor  = rankColors[(rank - 1) % 3] ?? rankColors[0];

  const barRatio  = maxRevenue > 0 ? product.revenue / maxRevenue : 0;
  const fillColor = rank === 1
    ? (isDark ? '#4F9EFF' : staticTheme.colors.primary[500])
    : (isDark ? '#3DD68C' : staticTheme.colors.success[500]);

  const margin = product.contributionMargin;
  const marginPct = product.revenue > 0
    ? ((margin / product.revenue) * 100).toFixed(1)
    : '0.0';

  return (
    <View style={[styles.productRow, { backgroundColor: cardBg, borderColor: border }]}>
      {/* Rank badge */}
      <View style={[styles.rankBadge, { backgroundColor: `${rankColor}1A` }]}>
        <Text variant="body-xs" weight="bold" style={{ color: rankColor }}>
          #{rank}
        </Text>
      </View>

      <View style={styles.productInfo}>
        {/* Name + units */}
        <View style={styles.productNameRow}>
          <Text
            variant="body-sm"
            weight="semibold"
            style={{ color: textMain, flex: 1 }}
            numberOfLines={1}
          >
            {product.name}
          </Text>
          <Text variant="body-xs" weight="medium" style={{ color: textSec }}>
            {product.unitsSold.toLocaleString('en-PH')} units
          </Text>
        </View>

        {/* Revenue bar */}
        <View style={[styles.miniTrack, { backgroundColor: isDark ? DARK_SURFACE : staticTheme.colors.gray[100] }]}>
          <View
            style={[
              styles.miniFill,
              {
                backgroundColor: fillColor,
                width: `${Math.round(barRatio * 100)}%` as `${number}%`,
              },
            ]}
          />
        </View>

        {/* Revenue + margin */}
        <View style={styles.productMetaRow}>
          <Text variant="body-xs" style={{ color: fillColor, fontWeight: '600' }}>
            {formatCurrency(product.revenue)}
          </Text>
          <Text variant="body-xs" style={{ color: textSec }}>
            Margin: {marginPct}%
          </Text>
        </View>
      </View>
    </View>
  );
};

// ─── Payback Timeline ─────────────────────────────────────────────────────────

interface PaybackTimelineProps {
  paybackPeriodMonths:     number;
  estimatedMonthsToTarget: number;
  isDark:                  boolean;
}

const PaybackTimeline: React.FC<PaybackTimelineProps> = ({
  paybackPeriodMonths,
  estimatedMonthsToTarget,
  isDark,
}) => {
  const cardBg  = isDark ? DARK_CARD_BG : '#FFFFFF';
  const border  = isDark ? DARK_BORDER  : staticTheme.colors.border;
  const textMain = isDark ? DARK_TEXT   : staticTheme.colors.text;
  const textSec  = isDark ? DARK_TEXT_SEC : staticTheme.colors.textSecondary;
  const trackBg  = isDark ? DARK_SURFACE : staticTheme.colors.gray[100];

  // Current month in operation (1 to N) — approximated as 1 for now
  const currentMonth    = 1;
  const maxMonths       = paybackPeriodMonths >= 999 ? 36 : Math.max(paybackPeriodMonths, 12);
  const currentRatio    = Math.min(1, currentMonth / maxMonths);
  const paybackRatio    = paybackPeriodMonths >= 999 ? 1 : Math.min(1, paybackPeriodMonths / maxMonths);

  const paybackColor    = paybackPeriodMonths <= 12
    ? (isDark ? '#3DD68C' : staticTheme.colors.success[500])
    : paybackPeriodMonths <= 24
    ? (isDark ? '#FFB020' : staticTheme.colors.warning[500])
    : (isDark ? '#FF6B6B' : staticTheme.colors.error[500]);

  const paybackLabel = paybackPeriodMonths >= 999
    ? 'Not yet projectable'
    : `${paybackPeriodMonths.toFixed(0)} months`;

  const targetLabel = estimatedMonthsToTarget >= 999
    ? 'Not yet projectable'
    : `${estimatedMonthsToTarget} months to 20% ROI`;

  return (
    <View style={[styles.timelineCard, { backgroundColor: cardBg, borderColor: border }]}>
      {/* Title row */}
      <View style={styles.timelineHeaderRow}>
        <Clock size={14} color={paybackColor} />
        <Text
          variant="body-sm"
          weight="semibold"
          style={{ color: textMain, marginLeft: 6, flex: 1 }}
        >
          Payback Timeline
        </Text>
        <View style={[styles.paybackBadge, { backgroundColor: `${paybackColor}1A` }]}>
          <Text variant="body-xs" weight="bold" style={{ color: paybackColor }}>
            {paybackLabel}
          </Text>
        </View>
      </View>

      {/* Track */}
      <View style={[styles.timelineTrack, { backgroundColor: trackBg }]}>
        {/* Current position marker */}
        <View
          style={[
            styles.timelineCurrentMarker,
            {
              left: `${Math.round(currentRatio * 100)}%` as `${number}%`,
              backgroundColor: isDark ? '#4F9EFF' : staticTheme.colors.primary[500],
            },
          ]}
        />

        {/* Payback target marker */}
        {paybackPeriodMonths < 999 && (
          <View
            style={[
              styles.timelineTargetMarker,
              {
                left:            `${Math.round(paybackRatio * 100)}%` as `${number}%`,
                backgroundColor: paybackColor,
              },
            ]}
          />
        )}

        {/* Fill up to current month */}
        <View
          style={[
            styles.timelineFill,
            {
              width:           `${Math.round(currentRatio * 100)}%` as `${number}%`,
              backgroundColor: isDark ? '#4F9EFF' : staticTheme.colors.primary[500],
            },
          ]}
        />
      </View>

      {/* Labels */}
      <View style={styles.timelineLabelRow}>
        <Text variant="body-xs" style={{ color: textSec }}>
          Month 1
        </Text>
        <Text variant="body-xs" style={{ color: textSec }}>
          Month {Math.round(maxMonths)}
        </Text>
      </View>

      <Text
        variant="body-xs"
        weight="normal"
        style={{ color: textSec, marginTop: 6, lineHeight: 17 }}
      >
        {targetLabel}
      </Text>
    </View>
  );
};

// ─── Monthly Burn Card ────────────────────────────────────────────────────────

interface BurnRateCardProps {
  monthlyBurnRate:     number;
  monthlyOverheadAvg:  number;
  monthlyUtilitiesAvg: number;
  totalRevenue:        number;
  elapsedMonths:       number;
  isDark:              boolean;
}

const BurnRateCard: React.FC<BurnRateCardProps> = ({
  monthlyBurnRate,
  monthlyOverheadAvg,
  monthlyUtilitiesAvg,
  totalRevenue,
  elapsedMonths,
  isDark,
}) => {
  const cardBg     = isDark ? DARK_CARD_BG : '#FFFFFF';
  const border     = isDark ? DARK_BORDER  : staticTheme.colors.border;
  const textMain   = isDark ? DARK_TEXT    : staticTheme.colors.text;
  const textSec    = isDark ? DARK_TEXT_SEC : staticTheme.colors.textSecondary;

  const monthlyRevenue = elapsedMonths > 0 ? totalRevenue / elapsedMonths : 0;
  const lightColor     = burnRateTrafficLight(monthlyBurnRate, monthlyRevenue, isDark);

  const monthlyCOGSEstimate = monthlyBurnRate - monthlyOverheadAvg - monthlyUtilitiesAvg;

  const burnRows = [
    { label: 'Overhead (avg/mo)',   value: monthlyOverheadAvg,       icon: <Building2 size={13} color={lightColor} /> },
    { label: 'Utilities (avg/mo)',  value: monthlyUtilitiesAvg,      icon: <Zap       size={13} color={lightColor} /> },
    { label: 'COGS estimate/mo',    value: Math.max(0, monthlyCOGSEstimate), icon: <Package   size={13} color={lightColor} /> },
  ] as const;

  return (
    <View style={[styles.burnCard, { backgroundColor: cardBg, borderColor: border }]}>
      {/* Top bar */}
      <View style={[styles.burnTopBar, { backgroundColor: lightColor }]} />

      <View style={styles.burnInner}>
        {/* Header */}
        <View style={styles.burnHeaderRow}>
          <View style={[styles.burnIconPill, { backgroundColor: `${lightColor}1A` }]}>
            <Flame size={14} color={lightColor} />
          </View>
          <Text variant="h6" weight="semibold" style={{ color: textMain, marginLeft: 8, flex: 1 }}>
            Monthly Burn Rate
          </Text>
          <Text variant="h5" weight="bold" style={{ color: lightColor }}>
            {formatCurrency(monthlyBurnRate)}
          </Text>
        </View>

        {/* Breakdown rows */}
        {burnRows.map((row) => (
          <View key={row.label} style={styles.burnRow}>
            {row.icon}
            <Text variant="body-xs" style={{ color: textSec, flex: 1, marginLeft: 6 }}>
              {row.label}
            </Text>
            <Text variant="body-xs" weight="semibold" style={{ color: textMain }}>
              {formatCurrency(row.value)}
            </Text>
          </View>
        ))}

        {/* vs revenue */}
        {monthlyRevenue > 0 && (
          <Text
            variant="body-xs"
            style={{ color: textSec, marginTop: 8, lineHeight: 17 }}
          >
            Monthly revenue: {formatCurrency(monthlyRevenue)} —{' '}
            {monthlyBurnRate > monthlyRevenue
              ? 'burn exceeds monthly revenue'
              : `${((1 - monthlyBurnRate / monthlyRevenue) * 100).toFixed(0)}% margin remaining`}
          </Text>
        )}
      </View>
    </View>
  );
};

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function BusinessROIScreen() {
  const mode   = useThemeStore(selectThemeMode);
  const isDark = mode === 'dark';
  const appTheme = useAppTheme();
  const insets   = useSafeAreaInsets();

  // Store state
  const isLoading   = useBusinessROIStore(selectBusinessROILoading);
  const roiPercent  = useBusinessROIStore(selectBusinessROIPercent);
  const insight     = useBusinessROIStore(selectBusinessROIInsight);
  const riskLevel   = useBusinessROIStore(selectBusinessROIRiskLevel);
  const lastRefresh = useBusinessROIStore(selectBusinessROILastRefreshed);
  const error       = useBusinessROIStore(selectBusinessROIError);

  // Full breakdown snapshot — accessed from store directly (not via selector to avoid over-subscribing)
  const {
    totalInventoryValue,
    totalEquipmentCost,
    totalOverheadAllTime,
    totalUtilitiesAllTime,
    totalInvestment,
    totalRevenue,
    totalCOGS,
    netProfit,
    grossMarginPercent,
    breakevenUnits,
    unitsSoldToDate,
    unitsStillNeeded,
    paybackPeriodMonths,
    estimatedMonthsToTarget,
    monthlyBurnRate,
    monthlyOverheadAvg,
    monthlyUtilitiesAvg,
    productBreakdown,
    computeBusinessROI,
    refreshBusinessROI,
  } = useBusinessROIStore();

  // Entrance animation
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    computeBusinessROI();
  }, [computeBusinessROI]);

  useEffect(() => {
    if (!isLoading) {
      Animated.timing(fadeAnim, {
        toValue:         1,
        duration:        350,
        useNativeDriver: true,
      }).start();
    }
  }, [isLoading, fadeAnim]);

  // Refresh on screen focus
  useFocusEffect(
    useCallback(() => {
      // Only refresh if data is stale (> 5 minutes) or never loaded
      const now = Date.now();
      const lastMs = lastRefresh !== null ? new Date(lastRefresh).getTime() : 0;
      if (now - lastMs > 5 * 60 * 1000) {
        refreshBusinessROI();
      }
    }, [lastRefresh, refreshBusinessROI]),
  );

  // Derived
  const healthColor    = roiHealthColor(roiPercent, isDark);
  const elapsedMonths  = Math.max(1, new Date().getMonth() + 1);
  const maxProductRev  = productBreakdown[0]?.revenue ?? 1;

  const rootBg   = isDark ? DARK_ROOT_BG : staticTheme.colors.background;
  const cardBg   = isDark ? DARK_CARD_BG : '#FFFFFF';
  const border   = isDark ? DARK_BORDER  : staticTheme.colors.border;
  const textMain = isDark ? DARK_TEXT    : staticTheme.colors.text;
  const textSec  = isDark ? DARK_TEXT_SEC : staticTheme.colors.textSecondary;

  // Map BusinessROIRiskLevel to ROIRiskLevel for AIInsightCard
  const mappedRiskLevel: 'low' | 'medium' | 'high' =
    riskLevel === 'low'    ? 'low'    :
    riskLevel === 'medium' ? 'medium' :
    'high';

  return (
    <View style={[styles.root, { backgroundColor: rootBg }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />

      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingBottom: Math.max(insets.bottom + 16, 32) },
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isLoading}
            onRefresh={refreshBusinessROI}
            tintColor={healthColor}
            colors={[healthColor]}
          />
        }
      >
        {/* ── 1. Header card ──────────────────────────────────────────────── */}
        <View style={[styles.headerCard, { backgroundColor: cardBg, borderColor: border }]}>
          <View style={[styles.headerAccentBar, { backgroundColor: healthColor }]} />
          <View style={styles.headerInner}>
            <View style={styles.headerLeft}>
              <View style={[styles.headerIconPill, { backgroundColor: `${healthColor}1A` }]}>
                <Activity size={16} color={healthColor} />
              </View>
              <Text variant="h5" weight="bold" style={{ color: textMain, marginLeft: 10 }}>
                Business ROI
              </Text>
            </View>

            <Pressable
              onPress={refreshBusinessROI}
              style={({ pressed }) => [
                styles.refreshBtn,
                {
                  backgroundColor: `${healthColor}1A`,
                  opacity: pressed ? 0.7 : 1,
                },
              ]}
              accessibilityLabel="Refresh ROI data"
              accessibilityRole="button"
            >
              <RefreshCw size={14} color={healthColor} />
              <Text variant="body-xs" weight="semibold" style={{ color: healthColor, marginLeft: 4 }}>
                Refresh
              </Text>
            </Pressable>
          </View>

          <Text
            variant="body-xs"
            style={{ color: textSec, paddingHorizontal: 14, paddingBottom: 12 }}
          >
            Last updated: {formatTimestamp(lastRefresh)}
          </Text>

          {/* Error state */}
          {error !== null && (
            <View style={[styles.errorBanner, { backgroundColor: `${staticTheme.colors.error[500]}1A` }]}>
              <Text variant="body-xs" style={{ color: isDark ? '#FF6B6B' : staticTheme.colors.error[600] }}>
                {error}
              </Text>
            </View>
          )}
        </View>

        {/* ── 2. ROI Hero ──────────────────────────────────────────────────── */}
        <View style={styles.heroSection}>
          {isLoading ? (
            <View style={styles.heroSkeleton}>
              <Skeleton width={160} height={160} radius={80} isDark={isDark} />
            </View>
          ) : (
            <ROIRing roiPercent={roiPercent} isDark={isDark} color={healthColor} />
          )}

          {/* Risk + Gross Margin pills */}
          <View style={styles.heroPillRow}>
            <View style={[styles.heroPill, { backgroundColor: `${healthColor}1A` }]}>
              {roiPercent >= 20
                ? <TrendingUp  size={12} color={healthColor} />
                : <TrendingDown size={12} color={healthColor} />
              }
              <Text variant="body-xs" weight="semibold" style={{ color: healthColor, marginLeft: 4 }}>
                {riskLevel.charAt(0).toUpperCase() + riskLevel.slice(1)} Risk
              </Text>
            </View>
            <View style={[styles.heroPill, { backgroundColor: isDark ? DARK_SURFACE : staticTheme.colors.gray[100] }]}>
              <Text variant="body-xs" weight="medium" style={{ color: textSec }}>
                Gross Margin: {grossMarginPercent.toFixed(1)}%
              </Text>
            </View>
          </View>
        </View>

        {/* ── 3. Investment Breakdown ───────────────────────────────────────── */}
        <SectionHeader
          title="Investment Breakdown"
          icon={<Package size={15} color={isDark ? '#4F9EFF' : appTheme.colors.primary[500]} />}
          color={isDark ? '#4F9EFF' : appTheme.colors.primary[500]}
          isDark={isDark}
        />

        <Animated.View style={{ opacity: fadeAnim }}>
          <View style={[styles.twoByTwo, { gap: IS_TABLET ? 12 : 10 }]}>
            <View style={[styles.tileHalf, { gap: IS_TABLET ? 12 : 10 }]}>
              {isLoading ? (
                <Skeleton width="100%" height={90} isDark={isDark} />
              ) : (
                <ROIMetricTile
                  label="Inventory Value"
                  value={formatCurrency(totalInventoryValue)}
                  color={isDark ? '#4F9EFF' : appTheme.colors.primary[500]}
                />
              )}
              {isLoading ? (
                <Skeleton width="100%" height={90} isDark={isDark} />
              ) : (
                <ROIMetricTile
                  label="Total Overhead"
                  value={formatCurrency(totalOverheadAllTime)}
                  color={isDark ? '#A78BFA' : '#7C3AED'}
                />
              )}
            </View>
            <View style={[styles.tileHalf, { gap: IS_TABLET ? 12 : 10 }]}>
              {isLoading ? (
                <Skeleton width="100%" height={90} isDark={isDark} />
              ) : (
                <ROIMetricTile
                  label="Equipment Cost"
                  value={formatCurrency(totalEquipmentCost)}
                  color={isDark ? '#FFB020' : appTheme.colors.highlight[400]}
                />
              )}
              {isLoading ? (
                <Skeleton width="100%" height={90} isDark={isDark} />
              ) : (
                <ROIMetricTile
                  label="Total Utilities"
                  value={formatCurrency(totalUtilitiesAllTime)}
                  color={isDark ? '#FB923C' : '#EA580C'}
                />
              )}
            </View>
          </View>

          {/* Total Investment — full width */}
          <View style={{ marginTop: IS_TABLET ? 12 : 10 }}>
            {isLoading ? (
              <Skeleton width="100%" height={80} isDark={isDark} />
            ) : (
              <ROIMetricTile
                label="Total Investment"
                value={formatCurrency(totalInvestment)}
                subValue="Inventory + Equipment + Overhead + Utilities"
                highlight
                color={isDark ? '#4F9EFF' : appTheme.colors.primary[500]}
              />
            )}
          </View>
        </Animated.View>

        {/* ── 4. Revenue & Profit ───────────────────────────────────────────── */}
        <SectionHeader
          title="Revenue & Profit"
          icon={<DollarSign size={15} color={isDark ? '#3DD68C' : appTheme.colors.success[500]} />}
          color={isDark ? '#3DD68C' : appTheme.colors.success[500]}
          isDark={isDark}
        />

        <Animated.View style={[styles.threeRow, { opacity: fadeAnim, gap: IS_TABLET ? 12 : 10 }]}>
          {isLoading ? (
            <>
              <Skeleton width="31%" height={90} isDark={isDark} />
              <Skeleton width="31%" height={90} isDark={isDark} />
              <Skeleton width="31%" height={90} isDark={isDark} />
            </>
          ) : (
            <>
              <View style={styles.tileTertiary}>
                <ROIMetricTile
                  label="Total Revenue"
                  value={formatCurrency(totalRevenue)}
                  trend={totalRevenue > 0 ? 'up' : 'neutral'}
                  color={isDark ? '#3DD68C' : appTheme.colors.success[500]}
                />
              </View>
              <View style={styles.tileTertiary}>
                <ROIMetricTile
                  label="Total COGS"
                  value={formatCurrency(totalCOGS)}
                  trend="down"
                  color={isDark ? '#FF6B6B' : appTheme.colors.error[500]}
                />
              </View>
              <View style={styles.tileTertiary}>
                <ROIMetricTile
                  label="Net Profit"
                  value={`${netProfit < 0 ? '-' : ''}${formatCurrency(netProfit)}`}
                  {...(netProfit >= 0
                    ? { trend: 'up',   color: isDark ? '#3DD68C' : appTheme.colors.success[500] }
                    : { trend: 'down', color: isDark ? '#FF6B6B' : appTheme.colors.error[500]   }
                  )}
                  highlight
                />
              </View>
            </>
          )}
        </Animated.View>

        {/* ── 5. AI Insight Card ────────────────────────────────────────────── */}
        <SectionHeader
          title="AI Business Insight"
          icon={<Activity size={15} color={isDark ? '#4F9EFF' : appTheme.colors.primary[400]} />}
          color={isDark ? '#4F9EFF' : appTheme.colors.primary[400]}
          isDark={isDark}
        />

        <AIInsightCard
          insight={insight}
          riskLevel={mappedRiskLevel}
          isLoading={isLoading}
          style={{ marginBottom: 20 }}
        />

        {/* ── 6. Breakeven Progress ────────────────────────────────────────── */}
        <SectionHeader
          title="Breakeven Progress"
          icon={<TrendingUp size={15} color={healthColor} />}
          color={healthColor}
          isDark={isDark}
        />

        {isLoading ? (
          <Skeleton width="100%" height={110} isDark={isDark} />
        ) : (
          <BreakevenProgress
            unitsSold={unitsSoldToDate}
            breakevenUnits={breakevenUnits}
            style={{ marginBottom: 20 }}
          />
        )}

        {/* Remaining units callout */}
        {!isLoading && unitsStillNeeded > 0 && (
          <View style={[styles.calloutBanner, {
            backgroundColor: `${healthColor}0D`,
            borderColor:     `${healthColor}33`,
          }]}>
            <TrendingUp size={14} color={healthColor} />
            <Text
              variant="body-xs"
              weight="medium"
              style={{ color: healthColor, marginLeft: 8, flex: 1 }}
            >
              Sell {unitsStillNeeded.toLocaleString('en-PH')} more units to reach breakeven
            </Text>
          </View>
        )}

        {/* ── 7. Product ROI Breakdown ───────────────────────────────────── */}
        {productBreakdown.length > 0 && (
          <>
            <SectionHeader
              title="Top Products by Revenue"
              icon={<Package size={15} color={isDark ? '#4F9EFF' : appTheme.colors.primary[500]} />}
              color={isDark ? '#4F9EFF' : appTheme.colors.primary[500]}
              isDark={isDark}
            />

            <View style={styles.productList}>
              {productBreakdown.map((product, i) => (
                <ProductRow
                  key={product.name}
                  rank={i + 1}
                  product={product}
                  maxRevenue={maxProductRev}
                  isDark={isDark}
                />
              ))}
            </View>
          </>
        )}

        {/* ── 8. Payback Timeline ───────────────────────────────────────────── */}
        <SectionHeader
          title="Payback Timeline"
          icon={<Clock size={15} color={isDark ? '#A78BFA' : '#7C3AED'} />}
          color={isDark ? '#A78BFA' : '#7C3AED'}
          isDark={isDark}
        />

        {isLoading ? (
          <Skeleton width="100%" height={100} isDark={isDark} />
        ) : (
          <PaybackTimeline
            paybackPeriodMonths={paybackPeriodMonths}
            estimatedMonthsToTarget={estimatedMonthsToTarget}
            isDark={isDark}
          />
        )}

        {/* ── 9. Monthly Burn Rate ──────────────────────────────────────────── */}
        <SectionHeader
          title="Monthly Burn Rate"
          icon={<Flame size={15} color={isDark ? '#FB923C' : '#EA580C'} />}
          color={isDark ? '#FB923C' : '#EA580C'}
          isDark={isDark}
        />

        {isLoading ? (
          <Skeleton width="100%" height={130} isDark={isDark} />
        ) : (
          <BurnRateCard
            monthlyBurnRate={monthlyBurnRate}
            monthlyOverheadAvg={monthlyOverheadAvg}
            monthlyUtilitiesAvg={monthlyUtilitiesAvg}
            totalRevenue={totalRevenue}
            elapsedMonths={elapsedMonths}
            isDark={isDark}
          />
        )}

        <View style={{ height: 8 }} />
      </ScrollView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  scroll: {
    paddingHorizontal: 16,
    paddingTop:         12,
  },

  // Header card
  headerCard: {
    borderRadius: 12,
    borderWidth:  1,
    overflow:     'hidden',
    marginBottom: 16,
    ...Platform.select({
      ios:     { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6 },
      android: { elevation: 2 },
    }),
  },
  headerAccentBar: {
    height: 3,
  },
  headerInner: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
    padding:         14,
    paddingBottom:    8,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems:    'center',
  },
  headerIconPill: {
    width:          32,
    height:         32,
    borderRadius:    8,
    alignItems:     'center',
    justifyContent: 'center',
  },
  refreshBtn: {
    flexDirection:     'row',
    alignItems:        'center',
    paddingVertical:    6,
    paddingHorizontal: 12,
    borderRadius:      20,
  },
  errorBanner: {
    marginHorizontal: 14,
    marginBottom:     10,
    padding:          10,
    borderRadius:      8,
  },

  // Hero section
  heroSection: {
    alignItems:   'center',
    marginBottom: 24,
  },
  heroSkeleton: {
    width:  160,
    height: 160,
    alignItems:     'center',
    justifyContent: 'center',
    marginVertical: 8,
  },
  heroPillRow: {
    flexDirection: 'row',
    gap:           8,
    marginTop:     14,
  },
  heroPill: {
    flexDirection:     'row',
    alignItems:        'center',
    paddingVertical:    5,
    paddingHorizontal: 12,
    borderRadius:      20,
  },

  // ROI ring
  roiRingOuter: {
    width:          160,
    height:         160,
    borderRadius:    80,
    borderWidth:      4,
    alignItems:     'center',
    justifyContent: 'center',
    marginVertical:  8,
  },
  roiRingInner: {
    width:          136,
    height:         136,
    borderRadius:    68,
    alignItems:     'center',
    justifyContent: 'center',
  },
  roiGlowDot: {
    position:     'absolute',
    top:           14,
    right:         14,
    width:          8,
    height:         8,
    borderRadius:   4,
  },

  // Section header
  sectionHeader: {
    flexDirection:  'row',
    alignItems:     'center',
    marginBottom:   10,
    marginTop:      20,
  },
  sectionIconPill: {
    width:          28,
    height:         28,
    borderRadius:    8,
    alignItems:     'center',
    justifyContent: 'center',
  },

  // 2×2 grid
  twoByTwo: {
    flexDirection: 'row',
  },
  tileHalf: {
    flex: 1,
  },

  // 3-column row
  threeRow: {
    flexDirection: 'row',
    marginBottom:  20,
  },
  tileTertiary: {
    flex: 1,
  },

  // Product list
  productList: {
    gap:          8,
    marginBottom: 20,
  },
  productRow: {
    flexDirection:  'row',
    alignItems:     'center',
    borderRadius:    12,
    borderWidth:      1,
    padding:         12,
    gap:             10,
  },
  rankBadge: {
    width:          34,
    height:         34,
    borderRadius:    8,
    alignItems:     'center',
    justifyContent: 'center',
  },
  productInfo: {
    flex: 1,
  },
  productNameRow: {
    flexDirection:  'row',
    alignItems:     'center',
    marginBottom:    4,
  },
  miniTrack: {
    height:       5,
    borderRadius:  3,
    overflow:     'hidden',
    marginBottom:  4,
  },
  miniFill: {
    height:       5,
    borderRadius:  3,
  },
  productMetaRow: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    alignItems:     'center',
  },

  // Payback timeline
  timelineCard: {
    borderRadius: 12,
    borderWidth:   1,
    padding:       14,
    marginBottom:  20,
  },
  timelineHeaderRow: {
    flexDirection:  'row',
    alignItems:     'center',
    marginBottom:   10,
  },
  paybackBadge: {
    paddingVertical:   3,
    paddingHorizontal: 8,
    borderRadius:      20,
  },
  timelineTrack: {
    height:       8,
    borderRadius:  4,
    overflow:     'hidden',
    position:     'relative',
  },
  timelineFill: {
    height:       8,
    borderRadius:  4,
    position:     'absolute',
    left:           0,
    top:            0,
    bottom:         0,
  },
  timelineCurrentMarker: {
    position:     'absolute',
    top:           0,
    bottom:        0,
    width:         2,
    zIndex:        2,
  },
  timelineTargetMarker: {
    position:     'absolute',
    top:          -2,
    bottom:       -2,
    width:         2,
    zIndex:        3,
    borderRadius:  1,
  },
  timelineLabelRow: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    marginTop:       5,
  },

  // Burn rate card
  burnCard: {
    borderRadius: 12,
    borderWidth:   1,
    overflow:     'hidden',
    marginBottom:  20,
  },
  burnTopBar: {
    height: 3,
  },
  burnInner: {
    padding: 14,
  },
  burnHeaderRow: {
    flexDirection: 'row',
    alignItems:    'center',
    marginBottom:  12,
  },
  burnIconPill: {
    width:          28,
    height:         28,
    borderRadius:    8,
    alignItems:     'center',
    justifyContent: 'center',
  },
  burnRow: {
    flexDirection:  'row',
    alignItems:     'center',
    paddingVertical: 5,
  },

  // Callout banner
  calloutBanner: {
    flexDirection:     'row',
    alignItems:        'center',
    borderRadius:       8,
    borderWidth:        1,
    paddingVertical:    8,
    paddingHorizontal: 12,
    marginBottom:      16,
    marginTop:         -10,
  },
});
